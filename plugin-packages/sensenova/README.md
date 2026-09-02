# SenseNova 商汤日日新渠道插件

该包提供 `sensenova-chat` 和 `sensenova-image` 两个 provider，接入商汤日日新 (SenseNova) 生态大模型服务，支持 SenseNova 6.8 Flash Lite 文本与多模态对话，以及 SenseNova U1.5 Lite、SenseNova U1 Fast 图像生成与单图编辑。

字段、约束、响应和兼容注意事项见 [docs/interface.md](docs/interface.md)。

安装包由仓库根目录的 `plugin-packages/build-packages.sh` 生成，后端启动时从 `plugin-packages/*.yingce-plugin` 或随包目录加载为官方插件。
