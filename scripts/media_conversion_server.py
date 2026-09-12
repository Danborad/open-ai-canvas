#!/usr/bin/env python3
"""
Lightweight Server-side Media Conversion Service for Open AI Canvas.
Runs OpenPose, Lineart, and Depth Anything V2 Small on CPU.
"""

from __future__ import annotations

import io
import json
import logging
import os
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

# Set offline environment variables
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
PYTHON_MODULES_DIR = os.path.join(PROJECT_ROOT, "canvas-agent", "python")
if PYTHON_MODULES_DIR not in sys.path:
    sys.path.insert(0, PYTHON_MODULES_DIR)

HF_CACHE = os.environ.get("HF_HUB_CACHE") or os.path.join(PROJECT_ROOT, ".local", "cache", "huggingface", "hub")
os.environ["HF_HUB_CACHE"] = HF_CACHE
os.environ["CANVAS_POSE_MODEL_ID"] = os.environ.get("CANVAS_POSE_MODEL_ID", "lllyasviel/Annotators")
os.environ["CANVAS_LINEART_MODEL_ID"] = os.environ.get("CANVAS_LINEART_MODEL_ID", "lllyasviel/Annotators")
os.environ["CANVAS_DEPTH_MODEL_ID"] = os.environ.get("CANVAS_DEPTH_MODEL_ID", "depth-anything/Depth-Anything-V2-Small-hf")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("media_conversion_server")

try:
    import depth_anything_runtime
    import lineart_runtime
    import pose_runtime
    logger.info("Media conversion runtimes imported successfully.")
except Exception as e:
    logger.error("Failed to import conversion runtimes: %s", e)
    raise


class ConversionRequestHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format: str, *args: object) -> None:
        logger.info("%s - - %s", self.address_string(), format % args)

    def send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Requested-With")

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        if path.startswith("/api/media-conversion"):
            path = path[len("/api/media-conversion"):]
        if not path:
            path = "/"

        if path in ("", "/", "/status", "/health", "/pose-estimation/status", "/lineart-estimation/status", "/depth-estimation/status"):
            module_name = "pose-estimation" if "pose" in path else "lineart-estimation" if "lineart" in path else "depth-estimation" if "depth" in path else "all"
            response_data = {
                "ok": True,
                "module": module_name,
                "apiVersion": 1,
                "ready": True,
                "configured": True,
                "modelCached": True,
                "loaded": True,
                "device": "cpu",
            }
            self.send_json(HTTPStatus.OK, response_data)
            return

        self.send_error(HTTPStatus.NOT_FOUND, "Not Found")

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        if path.startswith("/api/media-conversion"):
            path = path[len("/api/media-conversion"):]

        content_length = int(self.headers.get("Content-Length", 0))
        if content_length <= 0 or content_length > 25 * 1024 * 1024:
            self.send_json(HTTPStatus.BAD_REQUEST, {
                "ok": False,
                "code": "payload_too_large" if content_length > 25 * 1024 * 1024 else "empty_body",
                "message": "图片数据过大或请求体为空（上限 25MB）",
            })
            return

        try:
            raw_body = self.rfile.read(content_length)
            body = json.loads(raw_body.decode("utf-8"))
        except Exception as err:
            self.send_json(HTTPStatus.BAD_REQUEST, {
                "ok": False,
                "code": "invalid_json",
                "message": f"请求体 JSON 解析失败: {err}",
            })
            return

        operation = body.get("operation")
        if not operation:
            if "pose" in path:
                operation = "pose"
            elif "lineart" in path:
                operation = "lineart"
            elif "depth" in path:
                operation = "depth"

        try:
            if operation == "pose" or path.endswith("/pose-estimation/run"):
                logger.info("Processing pose estimation on CPU...")
                res = pose_runtime.handle(body)
                self.send_json(HTTPStatus.OK, {
                    "ok": True,
                    "module": "pose-estimation",
                    "apiVersion": 1,
                    "result": res,
                })
            elif operation == "lineart" or path.endswith("/lineart-estimation/run"):
                logger.info("Processing lineart estimation on CPU...")
                res = lineart_runtime.handle(body)
                self.send_json(HTTPStatus.OK, {
                    "ok": True,
                    "module": "lineart-estimation",
                    "apiVersion": 1,
                    "result": res,
                })
            elif operation == "depth" or path.endswith("/depth-estimation/run"):
                logger.info("Processing depth estimation on CPU...")
                res = depth_anything_runtime.handle(body)
                self.send_json(HTTPStatus.OK, {
                    "ok": True,
                    "module": "depth-estimation",
                    "apiVersion": 1,
                    "result": res,
                })
            else:
                self.send_json(HTTPStatus.BAD_REQUEST, {
                    "ok": False,
                    "code": "unsupported_operation",
                    "message": f"不支持的转换操作: {operation}",
                })
        except RuntimeError as err:
            code = str(err)
            msg = "转换推理失败"
            status = HTTPStatus.INTERNAL_SERVER_ERROR
            if code == "pose_no_person":
                msg = "未检测到可用人物姿态"
                status = HTTPStatus.BAD_REQUEST
            elif "missing" in code:
                msg = "模型文件缺失"
                status = HTTPStatus.SERVICE_UNAVAILABLE
            self.send_json(status, {
                "ok": False,
                "code": code,
                "message": msg,
            })
        except Exception as err:
            logger.exception("Unexpected conversion error: %s", err)
            self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {
                "ok": False,
                "code": "internal_error",
                "message": str(err),
            })

    def send_json(self, status: HTTPStatus, data: dict[str, object]) -> None:
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(payload)


def run_server(port: int = 17372) -> None:
    server_address = ("0.0.0.0", port)
    httpd = ThreadingHTTPServer(server_address, ConversionRequestHandler)
    logger.info("Media Conversion Server listening on 0.0.0.0:%d (HF_HUB_CACHE=%s)", port, HF_CACHE)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down server...")
        httpd.server_close()


if __name__ == "__main__":
    port = int(os.environ.get("CANVAS_CONVERSION_PORT", "17372"))
    run_server(port)
