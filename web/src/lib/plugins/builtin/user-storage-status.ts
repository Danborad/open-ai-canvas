import { registerPlugin } from "../plugin-registry";
import { PLUGIN_API_VERSION, type RegisteredPlugin } from "../plugin-types";
import { usePluginStore } from "@/stores/use-plugin-store";

export const USER_STORAGE_STATUS_PLUGIN_ID = "user-storage-status";

export const userStorageStatusPlugin: RegisteredPlugin = {
    manifest: {
        id: USER_STORAGE_STATUS_PLUGIN_ID,
        name: "侧边栏存储空间显示",
        version: "1.0.0",
        publishedAt: "2026-09-12",
        updatedAt: "2026-09-12",
        apiVersion: PLUGIN_API_VERSION,
        description: "在工作区左下角展示当前用户的云端存储使用量与总配额进度条，点击可直达素材库与存储详情。",
        author: "影策社区",
        surfaces: ["hybrid"],
        permissions: ["canvas.read"],
        trusted: true,
        contributes: { usageObservers: ["user-storage-status"] },
    },
};

registerPlugin(userStorageStatusPlugin);

export function useUserStorageStatusEnabled(): boolean {
    return usePluginStore((state) => {
        const pluginState = state.pluginStates[USER_STORAGE_STATUS_PLUGIN_ID];
        if (pluginState && typeof pluginState.effectiveEnabled === "boolean") {
            return pluginState.effectiveEnabled;
        }
        const installation = state.installations.find((item) => item.manifest.id === USER_STORAGE_STATUS_PLUGIN_ID);
        if (installation && typeof installation.enabled === "boolean") {
            return installation.enabled;
        }
        return true;
    });
}
