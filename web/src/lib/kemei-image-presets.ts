import type { ImageResolutionOption, ImageResolutionTier } from "./image-resolution-tiers";

// Seedream 5.0 官方像素表；不能按通用像素阈值把 2K 横屏误分为 4K。
// 每个档位按统一的画幅顺序排列，保证切档时比例按钮数量与位置一致。
const SEEDREAM_RATIO_ORDER = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"] as const;

const SEEDREAM_TIER_SIZES: Partial<Record<ImageResolutionTier, Record<string, string>>> = {
    "1k": {
        "1:1": "1024x1024",
        "16:9": "1424x800",
        "9:16": "800x1424",
        "4:3": "1152x864",
        "3:4": "864x1152",
        "3:2": "1248x832",
        "2:3": "832x1248",
        "21:9": "1568x672",
    },
    "1.5k": {
        "1:1": "1536x1536",
        "16:9": "2048x1152",
        "9:16": "1152x2048",
        "4:3": "1792x1344",
        "3:4": "1344x1792",
        "3:2": "1872x1248",
        "2:3": "1248x1872",
        "21:9": "2352x1008",
    },
    "2k": {
        "1:1": "2048x2048",
        "16:9": "2816x1584",
        "9:16": "1584x2816",
        "4:3": "2368x1776",
        "3:4": "1776x2368",
        "3:2": "2496x1664",
        "2:3": "1664x2496",
        "21:9": "3136x1344",
    },
};

export function kemeiSeedreamPresets(): ImageResolutionOption[] {
    const tiers: ImageResolutionTier[] = ["1k", "1.5k", "2k"];
    return tiers.flatMap((tier) =>
        SEEDREAM_RATIO_ORDER.flatMap((ratio) => {
            const size = SEEDREAM_TIER_SIZES[tier]?.[ratio];
            if (!size) return [];
            const [width, height] = size.split("x").map(Number);
            return [{ tier, ratio, width, height, size }];
        }),
    );
}
