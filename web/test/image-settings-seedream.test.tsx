import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ImageSettingsPanel } from "../src/components/image-settings-panel";
import { canvasThemes } from "../src/lib/canvas-theme";
import type { AiConfig } from "../src/stores/use-config-store";

describe("ImageSettingsPanel with km-kemei-seedream-image", () => {
    test("does not duplicate resolution or quality section", () => {
        const config = {
            interfaceType: "km-kemei-seedream-image",
            model: "doubao-seedream-5-0-pro-260628",
            size: "2560x1440",
            quality: "2K",
            transparentBackground: "false",
            channels: [],
            models: [],
        } as unknown as AiConfig;

        const html = renderToStaticMarkup(
            <ImageSettingsPanel
                config={config}
                onConfigChange={() => {}}
                theme={canvasThemes.dark}
            />
        );

        // 统计“分辨率”在页面中出现的次数
        const occurrences = (html.match(/分辨率/g) || []).length;
        console.log("Count of '分辨率' in html:", occurrences);

        // 之前因为 quality 被误判为 isGrokResolutionQuality，上面出现了一个“分辨率”，下面 ImageSizePicker 又有一个“分辨率”，共出现 2 次！
        // 修正后，Seedream 的 quality.supported 为 false，顶部不渲染多余的“分辨率”，只有尺寸选择器中的“分辨率”档位，出现且仅出现 1 次！
        expect(occurrences).toBe(1);

        // 并且包含 1K / 2K / 4K 与 16:9 / 1:1
        expect(html).toContain("1K");
        expect(html).toContain("2K");
        expect(html).toContain("4K");
        expect(html).toContain("宽高比");
        expect(html).toContain("透明背景");
    });
});
