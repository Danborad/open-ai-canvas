import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ImageSettingsPanel } from "../src/components/image-settings-panel";
import { canvasThemes } from "../src/lib/canvas-theme";
import type { AiConfig } from "../src/stores/use-config-store";

describe("ImageSettingsPanel with km-kemei-seedream-image", () => {
    test("does not duplicate resolution and Pro models show 1K / 1.5K / 2K tiers (no 4K)", () => {
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

        // 1. 统计“分辨率”在页面中出现的次数，只有尺寸选择器中的标题，出现且仅出现 1 次
        const proOccurrences = (proHtml.match(/分辨率/g) || []).length;
        expect(proOccurrences).toBe(1);

        // 2. Pro 模型最大支持 2K (≤4,624,220 像素)，必须包含 1K / 1.5K / 2K，不能包含 4K
        expect(proHtml).toContain("1K");
        expect(proHtml).toContain("1.5K");
        expect(proHtml).toContain("2K");
        expect(proHtml).not.toContain("4K");
        expect(proHtml).toContain("宽高比");
        expect(proHtml).toContain("透明背景");

        // 3. Lite 模型支持 4K
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
        expect(liteHtml).toContain("1.5K");
        expect(liteHtml).toContain("2K");
        expect(liteHtml).toContain("4K");
    });
});
