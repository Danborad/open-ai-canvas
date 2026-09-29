# KM 可美 Seedream 图片

该插件支持 KM 可美图像生成 OpenAI 兼容接口，专门适配字节跳动火山方舟豆包 Seedream 系列图像模型（如 `doubao-seedream-5-0-pro-260628`、`doubao-seedream-5-0-260128`、`doubao-seedream-4-5-251128` 与 `doubao-seedream-4-0-250828`）。支持文生单图、文生组图、多图参考生图、透明背景及图层拆分等高阶能力。

## 接口与鉴权

{{OPERATIONS}}

```http
POST {channel_base_url}/v1/images/generations
Authorization: Bearer <CHANNEL_API_KEY>
Content-Type: application/json
```

## 模型与约束来源

核心支持模型包括但不限于：
1. **Seedream 5.0 Pro (`doubao-seedream-5-0-pro-260628`)**：专为高精度单图设计，支持图层拆分 (`layer_decomposition`)、交互编辑与透明背景 (`background="transparent"`)。**注意**：Pro 模型仅支持单图生成，严禁配置或传入 `n > 1` 或 `sequential_image_generation`，否则上游将报错。
2. **Seedream 5.0 lite (`doubao-seedream-5-0-260128`)**：支持多张组图连续生成（`n` 参数支持 2~15 张）与联网搜索 (`web_search`)。
3. **Seedream 4.5 / 4.0**：稳定版通用生图与组图模型。

参考图支持：
- Seedream 5.0 Pro 支持 1–10 张参考图输入。
- Seedream 5.0 lite / 4.5 / 4.0 支持 1–14 张参考图输入。

分辨率档位支持 `2K`、`1K`、`1.5K`、`3K`、`4K` 或具体尺寸如 `2048x2048`、`2560x1440` 等，默认采用 `2K`。

## 参数与字段映射

{{PARAMETERS}}

实际提交参数包含 `model`、`prompt`、`images`、`imageCount`、`aspectRatio`、`resolution`、`quality`：
- `model`: 目标模型名称，如 `doubao-seedream-5-0-pro-260628`。
- `prompt`: 描述画面的正向提示词。
- `images`: 参考图输入，插件自动转换为 `image_urls` 数组或 `image` 字段发送给网关。
- `imageCount`: 生成张数（映射为 `n`），Pro 模型强制为 1；Lite 与 4.x 模型支持 1 至 15。
- `aspectRatio`: 比例或预设尺寸，与 `resolution` 一起解析为 `size` 参数传递。
- `resolution`: 分辨率档位，如 `2K`、`1K`、`4K`。
- `quality`: 画质档位，辅助映射或校验。
- `providerOptions`: 支持在命名空间 `km-kemei-seedream-image` 中透传 `background`（`transparent`/`opaque`）、`layer_decomposition`（图层拆分布尔值）、`output_format`（`png`/`jpeg`）、`web_search`（联网搜索）以及 `seed`。透明背景将自动配合 `output_format: png` 输出。

## 完整请求示例

文生单图（Seedream 5.0 Pro）：

```bash
curl "{channel_base_url}/v1/images/generations" \
  -H "Authorization: Bearer <CHANNEL_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedream-5-0-pro-260628",
    "prompt": "一只穿着红色唐装的小柴犬，坐在大门红灯笼下拜年，国潮插画风格，喜庆温馨",
    "size": "2K",
    "watermark": false,
    "response_format": "url"
  }'
```

图生图与多图参考示例：

```bash
curl "{channel_base_url}/v1/images/generations" \
  -H "Authorization: Bearer <CHANNEL_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedream-5-0-pro-260628",
    "prompt": "参考图一中柴犬的神态和图二的古风房屋背景，绘制一幅精美的贺年国画插图",
    "image_urls": [
      "https://example.com/assets/dog.png",
      "https://example.com/assets/house.png"
    ],
    "size": "2K"
  }'
```

透明背景示例：

```bash
curl "{channel_base_url}/v1/images/generations" \
  -H "Authorization: Bearer <CHANNEL_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedream-5-0-pro-260628",
    "prompt": "一只柴犬商品主图，纯透明背景",
    "size": "2K",
    "background": "transparent",
    "output_format": "png",
    "watermark": false
  }'
```

返回响应：

```json
{
  "created": 1719441600,
  "data": [
    { "url": "https://example.com/output/result.png", "size": "2048x2048" }
  ]
}
```

## 官方资料与边界

- 官方文档参考：`https://token.xinhankr.com/docs/examples/doc0009`。
- 上游火山引擎 Seedream 规范：Pro 模型专为单图及拆层交互设计，不支持组图。

{{CONTRACT}}
