import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ImageSettingsPanel } from "../src/components/image-settings-panel";
import { canvasThemes } from "../src/lib/canvas-theme";
import type { AiConfig } from "../src/stores/use-config-store";

describe("ImageSettingsPanel with km-kemei-seedream-image", () => {
    test("does not duplicate resolution, Pro/Flash show 1K / 1.5K / 2K, while other models show standard 1K / 2K / 4K (no 1.5K)", () => {
        // 1. Pro 模型（只显示 1K / 1.5K / 2K，不显示 4K）
        const proConfig = {
            interfaceType: "km-kemei-seedream-image",
            model: "doubao-seedream-5-0-pro-260628",
            size: "2560x1440",
            transparentBackground: "false",
            channels: [],
            models: [],
        } as unknown as AiConfig;

        const proHtml = renderToStaticMarkup(
            <ImageSettingsPanel
                config={proConfig}
                onConfigChange={() => {}}
                theme={canvasThemes.dark}
            />
        );

        const proOccurrences = (proHtml.match(/分辨率/g) || []).length;
        expect(proOccurrences).toBe(1);
        expect(proHtml).toContain("1K");
        expect(proHtml).toContain("1.5K");
        expect(proHtml).toContain("2K");
        expect(proHtml).not.toContain("4K");
        expect(proHtml).toContain("宽高比");
        expect(proHtml).toContain("透明背景");

        // 2. Flash 模型（和 Pro 一样，只显示 1K / 1.5K / 2K，不显示 4K）
        const flashConfig = {
            interfaceType: "km-kemei-seedream-image",
            model: "doubao-seedream-5-0-flash-260915",
            size: "2560x1440",
            transparentBackground: "false",
            channels: [],
            models: [],
        } as unknown as AiConfig;

        const flashHtml = renderToStaticMarkup(
            <ImageSettingsPanel
                config={flashConfig}
                onConfigChange={() => {}}
                theme={canvasThemes.dark}
            />
        );

        expect(flashHtml).toContain("1K");
        expect(flashHtml).toContain("1.5K");
        expect(flashHtml).toContain("2K");
        expect(flashHtml).not.toContain("4K");

        // 3. 其他通用/Lite 模型（显示标准的 1K / 2K / 4K，不显示 1.5K）
        const liteConfig = {
            interfaceType: "km-kemei-seedream-image",
            model: "doubao-seedream-5-0-260128",
            size: "2560x1440",
            transparentBackground: "false",
            channels: [],
            models: [],
        } as unknown as AiConfig;

        const liteHtml = renderToStaticMarkup(
            <ImageSettingsPanel
                config={liteConfig}
                onConfigChange={() => {}}
                theme={canvasThemes.dark}
            />
        );

        expect(liteHtml).toContain("1K");
        expect(liteHtml).not.toContain("1.5K");
        expect(liteHtml).toContain("2K");
        expect(liteHtml).toContain("4K");
    });
});
