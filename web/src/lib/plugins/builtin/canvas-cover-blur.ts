import { registerPlugin } from "../plugin-registry";
import { PLUGIN_API_VERSION, type RegisteredPlugin } from "../plugin-types";

export const CANVAS_COVER_BLUR_PLUGIN_ID = "canvas-cover-blur";

export const canvasCoverBlurPlugin: RegisteredPlugin = {
    manifest: {
        id: CANVAS_COVER_BLUR_PLUGIN_ID,
        name: "画布封面隐私模糊",
        version: "1.0.0",
        publishedAt: "2026-08-29",
        updatedAt: "2026-08-29",
        apiVersion: PLUGIN_API_VERSION,
        description: "在画布项目封面右下角提供【眼睛】隐私开关，点击即可锁定该画布封面为高斯模糊状态并持久记住，再次点击取消。",
        author: "影策社区",
        surfaces: ["hybrid"],
        permissions: ["canvas.read"],
        trusted: true,
        contributes: { usageObservers: ["canvas-cover-blur"] },
    },
};

registerPlugin(canvasCoverBlurPlugin);
