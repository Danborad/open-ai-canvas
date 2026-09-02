# ZarkLab 渠道插件

该包提供 `zarklab-image` 和 `zarklab-video` 两个 provider，接入 ZarkLab.ai 格式模型与工具协议，支持 Kling、Seedance、Happy Horse 等模型。

字段、约束、响应和兼容注意事项见 [docs/interface.md](docs/interface.md)。

安装包由仓库根目录的 `plugin-packages/build-packages.sh` 生成，后端启动时从 `plugin-packages/*.yingce-plugin` 加载为官方插件。
