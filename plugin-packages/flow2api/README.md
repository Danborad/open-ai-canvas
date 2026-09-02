# Flow2API 渠道插件

该包提供 `flow2api-image` 和 `flow2api-video` 两个 provider，接入 Flow2API 生态模型服务，支持 Nano Banana 系列文生图/图生图以及 Omni 1.1 Flash、Veo 系列视频生成。

字段、约束、响应和兼容注意事项见 [docs/interface.md](docs/interface.md)。

安装包由仓库根目录的 `plugin-packages/build-packages.sh` 生成，后端启动时从 `plugin-packages/*.yingce-plugin` 加载为官方插件。
