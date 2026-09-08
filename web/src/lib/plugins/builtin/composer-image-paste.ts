import { registerPlugin } from "../plugin-registry";
import { PLUGIN_API_VERSION, type RegisteredPlugin } from "../plugin-types";
import { usePluginStore } from "@/stores/use-plugin-store";

export const COMPOSER_IMAGE_PASTE_PLUGIN_ID = "composer-image-paste";

export const composerImagePastePlugin: RegisteredPlugin = {
    manifest: {
        id: COMPOSER_IMAGE_PASTE_PLUGIN_ID,
        name: "创作框图片粘贴",
        version: "1.0.0",
        publishedAt: "2026-09-08",
        updatedAt: "2026-09-08",
        apiVersion: PLUGIN_API_VERSION,
        description: "支持在创作框或提示词输入框中直接使用 Ctrl+V / Cmd+V 粘贴剪贴板截图或图片文件，自动上传并添加为参考内容或素材，无需手动保存文件。",
        author: "影策社区",
        surfaces: ["hybrid"],
        permissions: ["media.read", "canvas.read"],
        trusted: true,
        contributes: { usageObservers: ["composer-image-paste"] },
    },
};

registerPlugin(composerImagePastePlugin);

export function useComposerImagePasteEnabled(): boolean {
    return usePluginStore((state) => {
        const pluginState = state.pluginStates[COMPOSER_IMAGE_PASTE_PLUGIN_ID];
        if (pluginState && typeof pluginState.effectiveEnabled === "boolean") {
            return pluginState.effectiveEnabled;
        }
        const installation = state.installations.find((item) => item.manifest.id === COMPOSER_IMAGE_PASTE_PLUGIN_ID);
        if (installation && typeof installation.enabled === "boolean") {
            return installation.enabled;
        }
        return true;
    });
}
