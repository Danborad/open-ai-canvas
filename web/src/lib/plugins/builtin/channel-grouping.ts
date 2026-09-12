import { registerPlugin } from "../plugin-registry";
import { PLUGIN_API_VERSION, type RegisteredPlugin } from "../plugin-types";
import { usePluginStore } from "@/stores/use-plugin-store";

export const CHANNEL_GROUPING_PLUGIN_ID = "channel-grouping";

export const channelGroupingPlugin: RegisteredPlugin = {
    manifest: {
        id: CHANNEL_GROUPING_PLUGIN_ID,
        name: "渠道分组合并展示",
        version: "1.0.0",
        publishedAt: "2026-09-12",
        updatedAt: "2026-09-12",
        apiVersion: PLUGIN_API_VERSION,
        description: "将属于相同前台别名或分组名称的多个渠道在模型选择菜单中合并为一个统一分组展示，消除重复渠道标题，显著精简画布与创作界面的下拉空间。",
        author: "影策社区",
        surfaces: ["hybrid"],
        permissions: ["canvas.read"],
        trusted: true,
        contributes: { usageObservers: ["channel-grouping"] },
    },
};

registerPlugin(channelGroupingPlugin);

export function useChannelGroupingEnabled(): boolean {
    return usePluginStore((state) => {
        const pluginState = state.pluginStates[CHANNEL_GROUPING_PLUGIN_ID];
        if (pluginState && typeof pluginState.effectiveEnabled === "boolean") {
            return pluginState.effectiveEnabled;
        }
        const installation = state.installations.find((item) => item.manifest.id === CHANNEL_GROUPING_PLUGIN_ID);
        if (installation && typeof installation.enabled === "boolean") {
            return installation.enabled;
        }
        return true;
    });
}
