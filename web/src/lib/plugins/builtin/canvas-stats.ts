import { registerPlugin } from "../plugin-registry";
import { PLUGIN_API_VERSION, type RegisteredPlugin } from "../plugin-types";
import { usePluginStore } from "@/stores/use-plugin-store";

export const CANVAS_STATS_PLUGIN_ID = "canvas-project-stats";

export const canvasStatsPlugin: RegisteredPlugin = {
    manifest: {
        id: CANVAS_STATS_PLUGIN_ID,
        name: "画布使用积分统计",
        version: "1.0.0",
        publishedAt: "2026-08-26",
        updatedAt: "2026-08-26",
        apiVersion: PLUGIN_API_VERSION,
        description: "在画布项目封面展示该画布生成的图片/视频数量与积分消耗明细。",
        author: "影策社区",
        surfaces: ["hybrid"],
        permissions: ["canvas.read"],
        trusted: true,
        contributes: { usageObservers: ["canvas-project-stats"] },
    },
};

registerPlugin(canvasStatsPlugin);

export function useCanvasStatsEnabled(): boolean {
    return usePluginStore((state) => {
        const pluginState = state.pluginStates[CANVAS_STATS_PLUGIN_ID];
        if (pluginState && typeof pluginState.effectiveEnabled === "boolean") {
            return pluginState.effectiveEnabled;
        }
        if (CANVAS_STATS_PLUGIN_ID in state.runtimeStatuses) {
            return state.runtimeStatuses[CANVAS_STATS_PLUGIN_ID] === "enabled";
        }
        const installation = state.installations.find((item) => item.manifest.id === CANVAS_STATS_PLUGIN_ID);
        if (installation && typeof installation.enabled === "boolean") {
            return installation.enabled;
        }
        return true;
    });
}
