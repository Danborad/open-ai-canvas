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
        description: "开启画布封面隐私模式，对工程列表中的封面图片进行高斯模糊遮罩（鼠标悬浮时可恢复清晰预览），适合录屏或公开演示场合。",
        author: "影策社区",
        surfaces: ["hybrid"],
        permissions: ["canvas.read"],
        trusted: true,
        contributes: { usageObservers: ["canvas-cover-blur"] },
    },
};

registerPlugin(canvasCoverBlurPlugin);
