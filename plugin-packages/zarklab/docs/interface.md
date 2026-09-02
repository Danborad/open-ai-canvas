# ZarkLab 接口字段

## 鉴权与入口

- 任务提交：`POST /mcp` (JSON-RPC `tools/call` `zark_ai`)
- 结果查询：`GET /media/files/{id}`
- 鉴权请求头：`X-API-Key: <key>`
- 默认 Base URL：`https://api.zarklab.ai`

## 配置字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `apiKey` | secret | 是 | ZarkLab API Key，由宿主写入 X-API-Key 鉴权头。 |
| `baseUrl` | string | 否 | 上游根地址，默认 `https://api.zarklab.ai`。 |

<!-- YINGCE_MANIFEST_CONTRACT_START -->
## Manifest 完整接口定义

以下 JSON 与插件包内实际 `manifest.json` 逐字段一致，覆盖插件身份、权限、配置、鉴权、参数、校验、创建、Agent、查询、取消、结果下载、响应和 Agent 响应映射。`documentation` 字段的值就是当前完整文档；为避免文档在自身内部无限递归，JSON 中仅用等义占位文本表示正文。

```json
{
  "apiVersion": "yingce.plugin/v2",
  "id": "zarklab-provider",
  "name": "ZarkLab 渠道",
  "version": "1.0.0",
  "enabled": true,
  "author": "影策社区",
  "description": "接入 ZarkLab.ai 格式模型与工具协议，支持 Kling、Seedance、Happy Horse 等模型。",
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
        "label": "ZarkLab API Key",
        "required": true,
        "description": "填写 ZarkLab API Key。"
      }
    ]
  },
  "contributes": {
    "providers": [
      {
        "id": "zarklab-image",
        "label": "ZarkLab 图片",
        "capabilities": [
          "image"
        ],
        "scopes": [
          "admin.system-channel",
          "user.custom-channel",
          "canvas",
          "creation"
        ],
        "baseUrl": "https://api.zarklab.ai",
        "auth": {
          "type": "header",
          "field": "apiKey",
          "header": "X-API-Key"
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
          }
        ],
        "create": {
          "method": "POST",
          "path": "/mcp",
          "contentType": "application/json",
          "fields": {
            "jsonrpc": "2.0",
            "id": "1",
            "method": "tools/call",
            "params.name": "zark_ai",
            "params.arguments.prompt": "request.prompt",
            "params.arguments.aspect_ratio": "request.aspectRatio"
          }
        },
        "response": {
          "taskIdPaths": [
            "result.structuredContent.run_id"
          ],
          "statusPaths": [
            "result.status",
            "status"
          ],
          "resultPaths": [
            "result.structuredContent.generated_file_ids",
            "result.content"
          ],
          "resultKind": "image",
          "resultEphemeral": true
        }
      },
      {
        "id": "zarklab-video",
        "label": "ZarkLab 视频",
        "capabilities": [
          "video"
        ],
        "scopes": [
          "admin.system-channel",
          "user.custom-channel",
          "canvas",
          "creation"
        ],
        "baseUrl": "https://api.zarklab.ai",
        "auth": {
          "type": "header",
          "field": "apiKey",
          "header": "X-API-Key"
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
          }
        ],
        "create": {
          "method": "POST",
          "path": "/mcp",
          "contentType": "application/json",
          "fields": {
            "jsonrpc": "2.0",
            "id": "1",
            "method": "tools/call",
            "params.name": "zark_ai",
            "params.arguments.prompt": "request.prompt",
            "params.arguments.duration": "request.duration",
            "params.arguments.aspect_ratio": "request.aspectRatio"
          }
        },
        "response": {
          "taskIdPaths": [
            "result.structuredContent.run_id"
          ],
          "statusPaths": [
            "result.status",
            "status"
          ],
          "resultPaths": [
            "result.structuredContent.generated_file_ids"
          ],
          "resultKind": "video",
          "resultEphemeral": true
        }
      }
    ],
    "workflows": [
      {
        "id": "GPT Image 2",
        "label": "GPT Image 2",
        "providerId": "zarklab-image",
        "capability": "image"
      },
      {
        "id": "Happy Horse",
        "label": "Happy Horse 视频",
        "providerId": "zarklab-video",
        "capability": "video"
      },
      {
        "id": "Seedance 2.5",
        "label": "Seedance 2.5 视频",
        "providerId": "zarklab-video",
        "capability": "video"
      }
    ]
  }
}
```
<!-- YINGCE_MANIFEST_CONTRACT_END -->
