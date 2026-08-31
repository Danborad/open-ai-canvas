# SenseNova 图片

SenseNova 图片插件接入商汤日日新 (SenseNova) 图像生成与单图编辑能力，支持文生图与图生图路由。

## 接口与鉴权

{{OPERATIONS}}

```http
POST {channel_base_url}/images/generations
POST {channel_base_url}/images/edits
Authorization: Bearer <SENSENOVA_API_KEY>
Content-Type: application/json
```

## 模型与支持边界

- `sensenova-u1.5-lite`：支持 2K/4K 文生图及 `/images/edits` 单图编辑。
- `sensenova-u1-fast`：信息图专用，支持 11 种预设 2K 尺寸。

## 参数与字段映射

{{PARAMETERS}}

文生图请求发送至 `/images/generations`；包含参考图时自动路由至 `/images/edits` 并以 `images: [{"image_url": "..."}]` 结构提交。

## 响应与错误

插件解析 `data[]` 中的 `b64_json` 或 `url` 并转存为影策图片资源。上游错误状态及审核拦截将原样向上透传。

## 官方资料

- [商汤日日新开放平台文档](https://token.sensenova.cn/v1)

{{CONTRACT}}
