# Grok2API 接口字段

## 鉴权与入口

- 鉴权：`Authorization: Bearer <apiKey>`。
- 默认 Base URL：`http://127.0.0.1:18000/v1`。
- 图片生图：`POST /v1/images/generations`。
- 图片编辑：`POST /v1/images/edits`。
- 视频生成（异步）：`POST /v1/videos/generations`。
- 视频轮询：`GET /v1/videos/{task_id}`。
- 视频内容下载：`GET /v1/videos/{task_id}/content`。

## 配置字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `apiKey` | secret | 是 | Grok2API API Key，由宿主写入 Bearer 鉴权头。 |
| `baseUrl` | string | 否 | 上游根地址，默认 `http://127.0.0.1:18000/v1`。 |

## 支持模型

- **图片生成/编辑**：`Web/grok-imagine-image-2.0` (推荐极速，约15秒)、`Web/grok-imagine-image`、`Console/grok-imagine-image-2.0`、`Console/grok-imagine-image`
- **视频生成**：`Web/grok-imagine-video` (推荐)、`Console/grok-imagine-video-1.5` (Console 1080p)、`Console/grok-imagine-video` (Console 720p)
- **语音模型**：`grok-voice-latest` (TTS)、`grok-voice-think-fast-2.0`、`grok-stt` (STT)
- **推理对话**：`Build/grok-4.6`、`Build/grok-4.5`、`Web/grok-chat-fast`

## 图片参数

- `aspect_ratio`: 支持 `1:1`、`16:9`、`9:16`、`4:3`、`3:4`、`3:2`、`2:3`、`2:1`、`1:2` (9 种宽高比)。
- `resolution`: 支持 `1k` (Web 默认)、`2k` (Console 渠道)。

## 视频参数

- `duration`: 视频时长 1~15 秒（推荐 6 或 8 秒）。
- `aspect_ratio`: `16:9`、`9:16`、`1:1`、`4:3`、`3:4`、`3:2`、`2:3`。
- `resolution`: `480p`、`720p`、`1080p`。
- `image`: 首帧输入对象 `{"url": "..."}`。
- `reference_images`: 角色/风格参考图列表，最多 7 张。

<!-- YINGCE_MANIFEST_CONTRACT_START -->
## Manifest 完整接口定义

以下 JSON 与插件包内实际 `manifest.json` 逐字段一致，覆盖插件身份、权限、配置、鉴权、参数、校验、创建、Agent、查询、取消、结果下载、响应和 Agent 响应映射。`documentation` 字段的值就是当前完整文档；为避免文档在自身内部无限递归，JSON 中仅用等义占位文本表示正文。

```json
{
  "apiVersion": "yingce.plugin/v2",
  "id": "grok2api-provider",
  "name": "Grok2API 渠道",
  "version": "1.0.0",
  "enabled": true,
  "author": "影策社区",
  "description": "接入 Grok2API 与 xAI 接口服务，支持 Grok Imagine 2.0 极速生图、Grok Video 视频生成、Grok Voice 多语言语音合成与 Grok 4.6 推理对话。",
  "documentation": "<当前插件的完整 documentation，由 README.md 与 docs/interface.md 拼接而成；为避免 JSON 递归，此处不重复展开正文。>",
  "permissions": [
    "generation.run",
    "media.read"
  ],
  "configuration": {
    "fields": [
      {
        "name": "apiKey",
        "type": "secret",
        "label": "Grok2API Key",
        "required": true,
        "description": "填写 Grok2API 的 API Key。"
      }
    ]
  },
  "contributes": {
    "providers": [
      {
        "id": "grok2api-image",
        "label": "Grok2API 图片",
        "capabilities": [
          "image"
        ],
        "scopes": [
          "admin.system-channel",
          "user.custom-channel",
          "canvas",
          "creation"
        ],
        "auth": {
          "type": "bearer",
          "field": "apiKey",
          "header": "Authorization"
        },
        "parameters": [
          {
            "name": "model",
            "type": "string",
            "required": true,
            "mapping": "model"
          },
          {
            "name": "prompt",
            "type": "string",
            "required": true,
            "mapping": "prompt"
          },
          {
            "name": "aspectRatio",
            "type": "string",
            "mapping": "aspectRatio",
            "values": [
              "1:1",
              "16:9",
              "9:16",
              "4:3",
              "3:4",
              "3:2",
              "2:3",
              "2:1",
              "1:2"
            ]
          },
          {
            "name": "quality",
            "type": "string",
            "mapping": "quality",
            "values": [
              "1k",
              "2k"
            ]
          }
        ],
        "create": {
          "method": "POST",
          "path": "/v1/images/generations",
          "contentType": "application/json",
          "fields": {
            "model": "request.model",
            "prompt": "request.prompt",
            "aspect_ratio": "request.aspectRatio",
            "resolution": "request.quality|lower",
            "image": "request.images.0.url"
          }
        },
        "response": {
          "resultPaths": [
            "data"
          ],
          "resultKind": "image"
        }
      },
      {
        "id": "grok2api-video",
        "label": "Grok2API 视频",
        "capabilities": [
          "video"
        ],
        "scopes": [
          "admin.system-channel",
          "user.custom-channel",
          "canvas",
          "creation"
        ],
        "auth": {
          "type": "bearer",
          "field": "apiKey",
          "header": "Authorization"
        },
        "parameters": [
          {
            "name": "model",
            "type": "string",
            "required": true,
            "mapping": "model"
          },
          {
            "name": "prompt",
            "type": "string",
            "required": true,
            "mapping": "prompt"
          },
          {
            "name": "duration",
            "type": "integer",
            "mapping": "duration",
            "description": "视频时长 1~15 秒（推荐 6 或 8 秒）"
          },
          {
            "name": "aspectRatio",
            "type": "string",
            "mapping": "aspectRatio",
            "values": [
              "16:9",
              "9:16",
              "1:1",
              "4:3",
              "3:4",
              "3:2",
              "2:3"
            ]
          },
          {
            "name": "resolution",
            "type": "string",
            "mapping": "resolution",
            "values": [
              "480p",
              "720p",
              "1080p"
            ]
          }
        ],
        "create": {
          "method": "POST",
          "path": "/v1/videos/generations",
          "contentType": "application/json",
          "fields": {
            "model": "request.model",
            "prompt": "request.prompt",
            "duration": "request.duration",
            "aspect_ratio": "request.aspectRatio",
            "resolution": "request.resolution|lower",
            "image.url": "request.images.0.url"
          }
        },
        "poll": {
          "method": "GET",
          "path": "/v1/videos/{{taskId}}"
        },
        "response": {
          "taskIdPaths": [
            "id",
            "request_id",
            "data.task_id"
          ],
          "statusPaths": [
            "status",
            "state",
            "data.status"
          ],
          "errorPaths": [
            "code",
            "error"
          ],
          "messagePaths": [
            "message",
            "error.message"
          ],
          "resultPaths": [
            "video_url",
            "url",
            "data.url",
            "videos"
          ],
          "resultKind": "video"
        }
      }
    ],
    "workflows": [
      {
        "id": "Web/grok-imagine-image-2.0",
        "label": "Grok Imagine 2.0 (极速生图)",
        "providerId": "grok2api-image",
        "capability": "image"
      },
      {
        "id": "Web/grok-imagine-image",
        "label": "Grok Imagine (标准生图)",
        "providerId": "grok2api-image",
        "capability": "image"
      },
      {
        "id": "Console/grok-imagine-image-2.0",
        "label": "Grok Imagine 2.0 (Console)",
        "providerId": "grok2api-image",
        "capability": "image"
      },
      {
        "id": "Web/grok-imagine-video",
        "label": "Grok Video (Web)",
        "providerId": "grok2api-video",
        "capability": "video"
      },
      {
        "id": "Console/grok-imagine-video-1.5",
        "label": "Grok Video 1.5 (Console 1080p)",
        "providerId": "grok2api-video",
        "capability": "video"
      },
      {
        "id": "Console/grok-imagine-video",
        "label": "Grok Video (Console 720p)",
        "providerId": "grok2api-video",
        "capability": "video"
      }
    ]
  }
}
```
<!-- YINGCE_MANIFEST_CONTRACT_END -->
