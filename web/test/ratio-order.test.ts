import { buildImageResolutionOptions } from "../src/lib/image-resolution-tiers";
import { defaultImageSizes, seedreamProImageSizes } from "../src/lib/model-capabilities";
import { expect, test } from "bun:test";

test("seedreamProImageSizes presets ratios across 1k, 1.5k, 2k", () => {
    const options = buildImageResolutionOptions(seedreamProImageSizes);
    const tiers = ["1k", "1.5k", "2k"] as const;
    const expectedRatios = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "21:9"];

    for (const tier of tiers) {
        const tierOptions = options.filter(o => o.tier === tier);
        const ratios = tierOptions.map(o => o.ratio);
        console.log(`Seedream Pro [${tier}] ratios:`, ratios);
        expect(ratios).toEqual(expectedRatios);
    }
});

test("defaultImageSizes presets ratios across 1k, 2k, 4k (no 1.5k)", () => {
    const options = buildImageResolutionOptions(defaultImageSizes);
    const tiers = ["1k", "2k", "4k"] as const;
    const expectedRatios = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "21:9"];

    // 验证普通模型中绝对没有 1.5k
    const has15k = options.some(o => o.tier === "1.5k");
    expect(has15k).toBe(false);

    for (const tier of tiers) {
        const tierOptions = options.filter(o => o.tier === tier);
        const ratios = tierOptions.map(o => o.ratio);
        console.log(`Default Model [${tier}] ratios:`, ratios);
        expect(ratios).toEqual(expectedRatios);
    }
});
