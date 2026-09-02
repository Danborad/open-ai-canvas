# SenseNova 接口字段

## 鉴权与入口

- 鉴权：`Authorization: Bearer <apiKey>`。
- 默认 Base URL：`https://token.sensenova.cn/v1`。
- 文本与多模态对话：`POST /chat/completions`。
- 文生图：`POST /images/generations`。
- 图像编辑（单图编辑）：`POST /images/edits`。

## 配置字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `apiKey` | secret | 是 | SenseNova API Key，由宿主写入 Bearer 鉴权头。 |
| `baseUrl` | string | 否 | 上游根地址，默认 `https://token.sensenova.cn/v1`。 |

## 接口协议

- 对话与多模态：`POST /chat/completions`
- 文生图：`POST /images/generations`
- 图像编辑：`POST /images/edits`，支持 `images: [{"image_url": "..."}]`
- 图片比例与尺寸：`size` 字段（支持 1024x1024、2048x2048、3840x2160、2160x3840、3456x2304、2304x3456 等 32 倍数画幅）。
- 水印开关：`watermark: false`。

## 官方支持模型

- 文本：`sensenova-6.8-flash-lite`
- 图片：`sensenova-u1.5-lite` / `sensenova-u1-fast`

## 响应

- 对话从 `choices[0].message.content` 提取回复。
- 图片从 `data` 或 `images` 提取媒体结果。
- 临时媒体标记为 ephemeral，由宿主立即下载持久化。
