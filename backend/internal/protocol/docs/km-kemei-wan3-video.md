# KM 可美 Wan 3.0 视频

该插件支持 KM 可美视频 OpenAI 兼容异步视频生成接口，专门适配万相 Wan 3.0 视频模型（如 `wan3.0-video`）。支持文生视频、首帧与首尾帧生视频、多图参考生视频以及参考音视频多模态生视频。

## 接口与鉴权

{{OPERATIONS}}

```http
POST {channel_base_url}/v1/video/generations
GET  {channel_base_url}/v1/video/generations/{task_id}
Authorization: Bearer <CHANNEL_API_KEY>
Content-Type: application/json
```

## 模型与约束来源

核心默认模型为 `wan3.0-video`，亦兼容其他可美视频生成模型。分辨率支持 `720P`、`1080P` 等档位（插件自动格式化为大写）；画幅比例支持 `16:9`、`9:16`、`1:1` 等；时长默认 5 秒；支持同步音频生成与水印控制。

> **场景互斥**：首尾帧（`first_frame` / `last_frame`）与参考类素材（`reference_image` / `reference_video`）不可混用。

## 参数与字段映射

{{PARAMETERS}}

实际提交参数包括 `model`、`prompt`、`duration`、`ratio`、`resolution`、可选 `images`、`videos`、`audios`、`generate_audio`、`watermark`。
图片参数 `images` 支持单张图自动推断为 `first_frame`、双图推断为 `first_frame` 与 `last_frame`、多图推断为 `reference_image`，并支持显式带 `role` 的对象。

## 完整请求示例

```bash
curl "{channel_base_url}/v1/video/generations" \
  -H "Authorization: Bearer <CHANNEL_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "wan3.0-video",
    "prompt": "一只金毛寻回犬在金色秋叶中奔跑，电影感慢镜头，阳光穿透树林",
    "resolution": "1080P",
    "ratio": "16:9",
    "duration": 5,
    "images": [
      { "url": "https://example.com/first.png", "role": "first_frame" }
    ],
    "generate_audio": false,
    "watermark": false
  }'
```

## 任务状态与结果轮询

```json
{"task_id":"video_task_001","status":"pending"}
```

```bash
curl "{channel_base_url}/v1/video/generations/video_task_001" \
  -H "Authorization: Bearer <CHANNEL_API_KEY>"
```

状态会归一化为等待 (`pending`)、处理中 (`processing`)、成功 (`completed`) 或失败 (`failed`)。成功结果从 `data[].url` 提取。

## 官方资料与边界

- 官方文档参考：`https://token.xinhankr.com/docs/examples/doc0014`。
- 阿里百炼万相视频规范：首尾帧与多图参考互斥，不可仅传音频。

{{CONTRACT}}
