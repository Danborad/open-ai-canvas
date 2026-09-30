import { buildImageResolutionOptions } from "../src/lib/image-resolution-tiers";
import { defaultImageSizes, seedreamProImageSizes } from "../src/lib/model-capabilities";
import { expect, test } from "bun:test";

test("Default models have 1K, 2K, 4K only (NO 1.5K) and have ALL 10 ratios in consistent order", () => {
    const options = buildImageResolutionOptions(defaultImageSizes);
    const expectedRatios = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "21:9"];

    // 1. 确保绝对没有 1.5k
    const has15k = options.some(o => o.tier === "1.5k");
    expect(has15k).toBe(false);

    // 2. 检查 1K
    const k1 = options.filter(o => o.tier === "1k");
    const k1Ratios = k1.map(o => o.ratio);
    console.log("1K Ratios:", k1Ratios);
    expect(k1Ratios).toEqual(expectedRatios);

    // 3. 检查 2K
    const k2 = options.filter(o => o.tier === "2k");
    const k2Ratios = k2.map(o => o.ratio);
    console.log("2K Ratios:", k2Ratios);
    expect(k2Ratios).toEqual(expectedRatios);

    // 4. 检查 4K
    const k4 = options.filter(o => o.tier === "4k");
    const k4Ratios = k4.map(o => o.ratio);
    console.log("4K Ratios:", k4Ratios);
    expect(k4Ratios).toEqual(expectedRatios);
});

test("Seedream Pro/Flash has 1K, 1.5K, 2K only (NO 4K) and has ALL 10 ratios in consistent order", () => {
    const options = buildImageResolutionOptions(seedreamProImageSizes);
    const expectedRatios = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "21:9"];

    // 1. 确保绝对没有 4k
    const has4k = options.some(o => o.tier === "4k");
    expect(has4k).toBe(false);

    // 2. 检查 1K
    const k1 = options.filter(o => o.tier === "1k");
    expect(k1.map(o => o.ratio)).toEqual(expectedRatios);

    // 3. 检查 1.5K
    const k15 = options.filter(o => o.tier === "1.5k");
    expect(k15.map(o => o.ratio)).toEqual(expectedRatios);

    // 4. 检查 2K
    const k2 = options.filter(o => o.tier === "2k");
    expect(k2.map(o => o.ratio)).toEqual(expectedRatios);
});
