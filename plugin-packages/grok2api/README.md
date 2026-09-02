# Grok2API 渠道插件

该包提供 `grok2api-image` 和 `grok2api-video` 两个 provider，接入 Grok2API 与 xAI 格式图片与视频生成服务，支持多图参考和可变时长视频生成。

字段、约束、响应和兼容注意事项见 [docs/interface.md](docs/interface.md)。

安装包由仓库根目录的 `plugin-packages/build-packages.sh` 生成，后端启动时从 `plugin-packages/*.yingce-plugin` 加载为官方插件。
