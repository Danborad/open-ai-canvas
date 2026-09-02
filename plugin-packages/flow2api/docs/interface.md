# Flow2API 接口字段

## 鉴权与入口

- 鉴权：`Authorization: Bearer <apiKey>`。
- 默认 Base URL：`https://api.flow2api.com`。
- 生成：`POST /v1/chat/completions`，`application/json`。

## 配置字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `apiKey` | secret | 是 | Flow2API API Key，由宿主写入 Bearer 鉴权头。 |
| `baseUrl` | string | 否 | 上游根地址，默认 `https://api.flow2api.com`。 |

## 接口协议

- 对话与多模态生成：`POST /v1/chat/completions`
- 图片比例：`generationConfig.imageConfig.aspectRatio`，支持 `16:9`、`9:16`、`1:1`、`4:3`、`3:4`。
- 图片分辨率：`generationConfig.imageConfig.imageSize`，Nano Banana Pro/2 支持 `1k`、`2k`、`4k`；Imagen 4 不发送该字段。
- 视频比例：`generationConfig.aspectRatio`，支持 `16:9`、`9:16`。
- Omni 1.1 Flash 额外读取 `generationConfig.durationSeconds`，支持 4/6/8/10 秒。
- 只有 Veo 3.1 - Quality 读取 `generationConfig.imageSize`，支持 `1080p`、`4k`；Lite/Fast 忽略时长和输出分辨率。

## 官方支持模型

- 图片：`Nano Banana Pro` / `Nano Banana 2` / `Imagen 4`
- 视频：`Omni 1.1 Flash` / `Omni Flash` / `Veo 3.1 - Lite` / `Veo 3.1 - Fast` / `Veo 3.1 - Quality`

## 响应

- `choices[0].message.content` 或 `data` 提取媒体结果。
- 临时媒体标记为 ephemeral，由宿主立即下载持久化。

<!-- YINGCE_MANIFEST_CONTRACT_START -->
## Manifest 完整接口定义

以下 JSON 与插件包内实际 `manifest.json` 逐字段一致，覆盖插件身份、权限、配置、鉴权、参数、校验、创建、Agent、查询、取消、结果下载、响应和 Agent 响应映射。`documentation` 字段的值就是当前完整文档；为避免文档在自身内部无限递归，JSON 中仅用等义占位文本表示正文。

```json
{
  "apiVersion": "yingce.plugin/v2",
  "id": "flow2api-provider",
  "name": "Flow2API 渠道",
  "version": "1.0.0",
  "enabled": true,
  "author": "影策社区",
  "description": "接入 Flow2API 生态模型服务，支持 Nano Banana 系列文生图/图生图以及 Omni 1.1 Flash、Veo 视频生成。",
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
        "label": "Flow2API Key",
        "required": true,
        "description": "填写 Flow2API 的 API Key。"
      }
    ]
  },
  "contributes": {
    "providers": [
      {
        "id": "flow2api-image",
        "label": "Flow2API 图片",
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
          "path": "/v1/chat/completions",
          "contentType": "application/json",
          "fields": {
            "model": "request.model",
            "messages": "request.messages",
            "generationConfig.imageConfig.aspectRatio": "request.aspectRatio|omit_empty",
            "generationConfig.imageConfig.imageSize": "request.quality|lower|omit_auto|omit_empty|omit_unless_model_contains:banana",
            "stream": "false|bool"
          }
        },
        "response": {
          "resultPaths": [
            "choices.0.message.content",
            "data"
          ],
          "resultKind": "image",
          "resultEphemeral": true
        }
      },
      {
        "id": "flow2api-video",
        "label": "Flow2API 视频",
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
            "name": "aspectRatio",
            "type": "string",
            "mapping": "aspectRatio"
          },
          {
            "name": "duration",
            "type": "integer",
            "mapping": "duration"
          },
          {
            "name": "resolution",
            "type": "string",
            "mapping": "resolution"
          }
        ],
        "create": {
          "method": "POST",
          "path": "/v1/chat/completions",
          "contentType": "application/json",
          "fields": {
            "model": "request.model",
            "messages": "request.messages",
            "generationConfig.aspectRatio": "request.aspectRatio|omit_empty",
            "generationConfig.durationSeconds": "request.duration|int|omit_zero|omit_unless_model_contains:omni",
            "generationConfig.imageSize": "request.resolution|lower|resolution_p|omit_empty|omit_unless_model_contains:quality",
            "stream": "false|bool"
          }
        },
        "response": {
          "resultPaths": [
            "choices.0.message.content",
            "data"
          ],
          "resultKind": "video",
          "resultEphemeral": true
        }
      }
    ],
    "workflows": [
      {
        "id": "Nano Banana 2",
        "label": "Nano Banana 2",
        "providerId": "flow2api-image",
        "capability": "image"
      },
      {
        "id": "Nano Banana Pro",
        "label": "Nano Banana Pro",
        "providerId": "flow2api-image",
        "capability": "image"
      },
      {
        "id": "Imagen 4",
        "label": "Imagen 4",
        "providerId": "flow2api-image",
        "capability": "image"
      },
      {
        "id": "Omni 1.1 Flash",
        "label": "Omni 1.1 Flash 视频",
        "providerId": "flow2api-video",
        "capability": "video"
      },
      {
        "id": "Omni Flash",
        "label": "Omni Flash 视频",
        "providerId": "flow2api-video",
        "capability": "video"
      },
      {
        "id": "Veo 3.1 - Lite",
        "label": "Veo 3.1 - Lite 视频",
        "providerId": "flow2api-video",
        "capability": "video"
      },
      {
        "id": "Veo 3.1 - Fast",
        "label": "Veo 3.1 - Fast 视频",
        "providerId": "flow2api-video",
        "capability": "video"
      },
      {
        "id": "Veo 3.1 - Quality",
        "label": "Veo 3.1 - Quality 视频",
        "providerId": "flow2api-video",
        "capability": "video"
      }
    ]
  }
}
```
<!-- YINGCE_MANIFEST_CONTRACT_END -->
