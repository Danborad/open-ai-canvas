# Grok2API 接口字段

## 鉴权与入口

- 鉴权：`Authorization: Bearer <apiKey>`。
- 生成：`POST /v1/images/generations`、`POST /v1/images/edits`、`POST /v1/videos/generations`。
- 轮询：`GET /v1/videos/{task_id}`。

## 配置字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `apiKey` | secret | 是 | Grok2API API Key，由宿主写入 Bearer 鉴权头。 |
| `baseUrl` | string | 否 | 上游根地址。 |

## 支持模型

- `Web/grok-imagine-image-2.0` / `Web/grok-imagine-image-quality-2.0`
- `Web/grok-imagine-video` / `Console/grok-imagine-video`

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
  "description": "接入 Grok2API 与 xAI 格式图片与视频生成服务，支持多图参考和可变时长视频生成。",
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
            "mapping": "aspectRatio"
          },
          {
            "name": "quality",
            "type": "string",
            "mapping": "quality"
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
            "mapping": "duration"
          },
          {
            "name": "aspectRatio",
            "type": "string",
            "mapping": "aspectRatio"
          },
          {
            "name": "resolution",
            "type": "string",
            "mapping": "resolution"
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
        "label": "Grok Imagine 图片",
        "providerId": "grok2api-image",
        "capability": "image"
      },
      {
        "id": "Web/grok-imagine-video",
        "label": "Grok Imagine 视频",
        "providerId": "grok2api-video",
        "capability": "video"
      }
    ]
  }
}
```
<!-- YINGCE_MANIFEST_CONTRACT_END -->
