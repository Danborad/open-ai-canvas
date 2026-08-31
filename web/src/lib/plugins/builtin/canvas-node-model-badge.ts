import { registerPlugin } from "../plugin-registry";
import { PLUGIN_API_VERSION, type RegisteredPlugin } from "../plugin-types";

export const CANVAS_NODE_MODEL_BADGE_PLUGIN_ID = "canvas-node-model-badge";

export const canvasNodeModelBadgePlugin: RegisteredPlugin = {
    manifest: {
        id: CANVAS_NODE_MODEL_BADGE_PLUGIN_ID,
        name: "画布生成模型标识",
        version: "1.0.0",
        publishedAt: "2026-08-28",
        updatedAt: "2026-08-28",
        apiVersion: PLUGIN_API_VERSION,
        description: "在画布生成结果节点顶部（标题与尺寸之间）小小的展示生成该结果所使用的模型名称。",
        author: "影策社区",
        surfaces: ["hybrid"],
        permissions: ["canvas.read"],
        trusted: true,
        contributes: { usageObservers: ["canvas-node-model-badge"] },
    },
};

registerPlugin(canvasNodeModelBadgePlugin);
