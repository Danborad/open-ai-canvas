import { buildImageResolutionOptions } from "../src/lib/image-resolution-tiers";
import { defaultImageCapabilityConfig, defaultImageSizes } from "../src/lib/model-capabilities";
import { kemeiSeedreamPresets } from "../src/lib/kemei-image-presets";
import { imageResolutionTiers } from "../src/lib/image-size-presets";
import { expect, test } from "bun:test";

test("Default models have 1K, 2K, 4K only (NO 1.5K) and have all 10 ratios in consistent order", () => {
    const options = buildImageResolutionOptions(defaultImageSizes);
    const expectedRatios = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "21:9"];

    // 1. 确保绝对没有 1.5k
    expect(options.some((o) => o.tier === "1.5k")).toBe(false);

    // 2. 各分辨率档位都完整包含 10 个比例，且顺序一致
    for (const tier of ["1k", "2k", "4k"]) {
        expect(options.filter((o) => o.tier === tier).map((o) => o.ratio)).toEqual(expectedRatios);
    }
});

test("Seedream 5.0 Pro/Flash has 1K, 1.5K, 2K only (NO 4K) with a unified ratio order", () => {
    const presets = kemeiSeedreamPresets();
    const expectedRatios = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"];

    // 1. 绝对没有 4K，且三档各 8 个比例
    expect(presets.some((preset) => preset.tier === "4k")).toBe(false);
    expect(presets).toHaveLength(24);

    // 2. 三档比例种类与顺序完全一致
    for (const tier of ["1k", "1.5k", "2k"] as const) {
        expect(presets.filter((preset) => preset.tier === tier).map((preset) => preset.ratio)).toEqual(expectedRatios);
    }
});

test("Seedream profile surfaces 1K/1.5K/2K and never 4K", () => {
    const profile = defaultImageCapabilityConfig("km-kemei-seedream", "doubao-seedream-5-0-pro-260628");
    const tiers = imageResolutionTiers(profile);
    expect(tiers).toEqual(["1k", "1.5k", "2k", "4k"]);
    expect(profile.size.presets?.some((preset) => preset.tier === "4k")).toBe(false);
    expect(profile.quality.supported).toBe(false);
    expect(profile.maxOutputs).toBe(1);
});
