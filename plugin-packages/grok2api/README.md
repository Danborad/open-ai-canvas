# Grok2API 渠道插件

该包提供 `grok2api-image`、`grok2api-video` 与 `grok2api-audio` 三个 provider，接入 Grok2API 与 xAI 格式图片、视频与语音合成服务。

字段、约束、响应和兼容注意事项见 [docs/interface.md](docs/interface.md)。

安装包由仓库根目录的 `plugin-packages/build-packages.sh` 生成，后端启动时从 `plugin-packages/*.yingce-plugin` 加载为官方插件。
