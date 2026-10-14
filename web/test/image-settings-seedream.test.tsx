import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ImageSettingsPanel } from "../src/components/image-settings-panel";
import { canvasThemes } from "../src/lib/canvas-theme";
import type { AiConfig } from "../src/stores/use-config-store";

function seedreamConfig(model: string): AiConfig {
    return {
        imageModel: model,
        model,
        size: "2048x2048",
        transparentBackground: "false",
        channels: [
            {
                id: "ch-seedream",
                scope: "system",
                enabled: true,
                name: "可美",
                baseUrl: "/api/ai/system/CHANNEL_000007",
                apiFormat: "openai",
                concurrencyLimit: 0,
                models: [model],
                modelCosts: [{ model, protocol: "km-kemei-seedream-image", capability: "image", priceConfigured: true }],
                hasApiKey: true,
                hasSecretKey: false,
                createdAt: "",
                updatedAt: "",
            },
        ],
    } as unknown as AiConfig;
}

describe("ImageSettingsPanel with km-kemei-seedream-image", () => {
    test("Pro/Flash 只显示 1K / 1.5K / 2K，不显示 4K，且分辨率分段只有一处", () => {
        for (const model of ["doubao-seedream-5-0-pro-260628", "doubao-seedream-5-0-flash-260915"]) {
            const html = renderToStaticMarkup(<ImageSettingsPanel config={seedreamConfig(model)} onConfigChange={() => {}} theme={canvasThemes.dark} />);
            expect((html.match(/分辨率/g) || []).length).toBe(1);
            expect(html).toContain("1K");
            expect(html).toContain("1.5K");
            expect(html).toContain("2K");
            expect(html).not.toContain("4K");
            expect(html).toContain("宽高比");
        }
    });

    test("Pro/Flash 各档位比例种类与顺序统一，且没有 4K 像素", () => {
        const html = renderToStaticMarkup(<ImageSettingsPanel config={seedreamConfig("doubao-seedream-5-0-pro-260628")} onConfigChange={() => {}} theme={canvasThemes.dark} />);
        for (const ratio of ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"]) {
            expect(html).toContain(`>${ratio}<`);
        }
        expect(html).not.toContain("3840");
        expect(html).not.toContain("2880");
    });

    test("存量 Seedream 价格档 quality=1k/1.5k/2k 安全迁移为 imageResolution，无冲突", () => {
        const { priceTierToForm, skuSelectorFromForm } = require("../src/pages/admin/components/channel-model-price-tier-form");
        const { defaultImageCapabilityConfig } = require("../src/lib/model-capabilities");
        const profile = defaultImageCapabilityConfig("km-kemei-seedream-image", "doubao-seedream-5-0-pro-260628");

        const rawTiers = [
            { id: "t1", selector: { quality: "1k" }, billingMode: "fixed_request", unitPriceMicrocredits: 20000000, priceConfigured: true, enabled: true },
            { id: "t2", selector: { quality: "1.5k" }, billingMode: "fixed_request", unitPriceMicrocredits: 40000000, priceConfigured: true, enabled: true },
            { id: "t3", selector: { quality: "2k" }, billingMode: "fixed_request", unitPriceMicrocredits: 40000000, priceConfigured: true, enabled: true },
        ];

        const formValues = rawTiers.map((tier) => priceTierToForm(tier, profile, "km-kemei-seedream-image"));
        expect(formValues[0].imageResolution).toBe("1k");
        expect(formValues[1].imageResolution).toBe("1.5k");
        expect(formValues[2].imageResolution).toBe("2k");

        const selectors = formValues.map((fv) => skuSelectorFromForm("image", fv, { image: profile }));
        expect(selectors[0]).toEqual({ imageResolution: "1k" });
        expect(selectors[1]).toEqual({ imageResolution: "1.5k" });
        expect(selectors[2]).toEqual({ imageResolution: "2k" });

        // 验证 3 个 selector 各不相同，不会被判定为重复
        const keys = new Set(selectors.map((s) => JSON.stringify(s)));
        expect(keys.size).toBe(3);
    });
});
