# Flow2API 与 Grok2API 能力说明

本文记录当前画布对 Flow2API、Grok2API 图片和视频模型的参数约束。OpenAI Images、xAI 官方视频和其他协议不使用本文的专属设置。

## Flow2API 图片

协议：`flow2api-image`

适用模型：

- `Nano Banana Pro`
- `Nano Banana 2`
- `Nano Banana 2 Lite`

支持参数：

- 画幅：`1:1`、`16:9`、`4:3`、`3:4`、`9:16`
- 分辨率：`1K`、`2K`
- 单次请求最多生成 `4` 张图片

请求中的图片参数位于 `generationConfig.imageConfig`：

```json
{
  "aspectRatio": "16:9",
  "imageSize": "2K",
  "numberOfImages": 2
}
```

## Flow2API 视频

协议：`flow2api-video`

适用模型：

- `Omni Flash`
- `Veo 3.1 - Lite`

支持参数：

- 画幅：`16:9`、`9:16`
- `Omni Flash` 时长：`4s`、`6s`、`8s`、`10s`
- `Veo 3.1 - Lite` 时长：由模型固定，不显示时长选择
- 分辨率：不提供可选项
- 单次请求最多生成 `4` 个视频；请求使用 `numberOfVideos`，不使用 OpenAI 风格的 `n` 字段。

`Omni Flash` 请求使用 `generationConfig.durationSeconds`；`Veo 3.1 - Lite` 不发送时长字段。

## Grok2API 图片

协议：`grok2api-image`

支持参数：

- 画幅：`1:1`、`16:9`、`9:16`、`4:3`、`3:4`、`3:2`、`2:3`
- 分辨率：`1K`、`2K`
- 生成张数：`1-4`

## Grok2API 视频

协议：`grok2api-video`

支持参数：

- 画幅：`1:1`、`16:9`、`9:16`、`4:3`、`3:4`、`3:2`、`2:3`
- 时长：`6s`、`10s`、`15s`
- 分辨率：`480p`、`720p`
- 参考图：最多 `1` 张
- 单次请求生成 `1` 个视频；接口不接受 OpenAI 风格的 `n` 批量字段

视频请求使用 `duration`、`aspect_ratio`、`resolution` 和可选的 `reference_images` 字段。

## 修复记录与待验证

- Grok2API 视频请求已移除上游不支持的 `n` 字段；前后端统一按单次 1 个视频处理。
- Grok2API 视频设置已收敛到 `6/10/15` 秒、`480p/720p`、最多 1 张参考图，并兼容旧配置中的张数、时长、分辨率和像素画幅。
- Flow2API 视频保留接口支持的 `numberOfVideos` 批量字段和 `16:9` / `9:16` 请求比例。
- 画布视频节点在媒体没有可读宽高时使用任务请求画幅；任务恢复和重试路径不再把 Flow2API 视频退回旧的正方形节点。
- 待验证：使用 Flow2API `Omni Flash` 分别生成 `16:9` 和 `9:16` 视频，确认请求比例、画布节点外框、视频画面和重载恢复后的节点比例一致。

## 其他协议

- OpenAI Images 保持作者原有的质量、透明背景、自定义尺寸、画幅、2K/4K 和张数设置。
- Gemini Veo 继续使用项目原有的能力配置。

## Grok2API New 测试适配

新版接口使用独立协议值，不覆盖旧的 `grok2api-image` 和 `grok2api-video`：

- `grok2api-new-image`：`POST /v1/images/generations` 或 `POST /v1/images/edits`
- `grok2api-new-video`：`POST /v1/videos/generations`，轮询 `GET /v1/videos/{request_id}`
- 新版模型必须保留完整的 `Web/` 或 `Console/` 前缀；旧的无前缀模型仍使用旧 Grok2API 适配。
- 新版图片适配支持四类图片模型、`n=1..10`、新版比例集合、`1k/2k` 分辨率和 JSON 图片编辑结构。
- Web 图片编辑最多 8 张参考图且只生成 1 张；Console 图片编辑最多 3 张参考图；Web Lite 仅用于生成。
- `Web/grok-imagine-image-2.0` 和 Web 编辑模型仅使用 `1k`；Console 图片模型支持 `1k/2k`。
- 新版视频适配支持 `Web/grok-imagine-video`、`Console/grok-imagine-video` 和 `Console/grok-imagine-video-1.5`，时长 `1..15` 秒，最多 8 张图片输入。
- `Console/grok-imagine-video` 仅允许 `480p/720p`；Web 视频和 Console Video 1.5 可使用 `1080p`。
- 图片生视频时，首帧使用 `image`，其余素材使用 `reference_images`；没有首帧标记时，前端请求的第一张图作为首帧。
- Console 视频上游实际要求 `image` 与 `reference_images` 互斥：单图使用 `image`，多图使用纯 `reference_images`；显式首帧与其他参考图同时存在时在发送前明确报错。该行为优先遵循实际上游 400 合同。
- 旧 Grok2API 协议、字段归一化、单视频限制和旧模型路径保持不变。

当前测试状态：新版请求体、能力默认值、系统渠道代理白名单和前端协议类型已完成自动化验证；仍需使用实际新版 Grok2API 服务分别验证 Web/Console 图片生成、图片编辑、视频文生视频和图生视频。

## 渠道模型目录同步

- 管理员点击“拉取模型”时，系统现在按上游 `/models` 返回结果对当前系统渠道做完整对账。
- 新返回的模型继续新增为待配置状态；本地已有且仍在上游的模型保留原有定价和启用状态。
- 上游已经不再返回的模型会被软删除并从当前模型列表移除，不影响其他渠道或历史记录。
- 已软删除模型如果之后重新出现在上游，会恢复为待配置状态，并保留原有模型历史。
- xAI 官方视频继续使用自身的时长、分辨率和画幅规则。
