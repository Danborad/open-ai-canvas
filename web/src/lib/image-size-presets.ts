import { buildImageResolutionOptions, closestRatio, imageRatioForSize, parseImageResolutionOption, type ImageResolutionOption, type ImageResolutionTier } from "./image-resolution-tiers";
import type { ImageCapabilityConfig } from "./model-capabilities";

export const IMAGE_RESOLUTIONS: ImageResolutionTier[] = ["1k", "2k", "4k"];
// 1.5K 只在模型明确配置此档位时出现，既有模型的档位保持原有顺序。
export function imageResolutionTiers(profile: ImageCapabilityConfig): ImageResolutionTier[] {
    return profile.size.presets?.some((preset) => preset.tier === "1.5k") || profile.quality.values.includes("1.5k") ? ["1k", "1.5k", "2k", "4k"] : IMAGE_RESOLUTIONS;
}
export const IMAGE_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "21:9"];
const standardSizes: Record<string, string[]> = {
    "1:1": ["1024x1024", "2048x2048", "2880x2880"],
    "16:9": ["1824x1024", "2752x1536", "3840x2160"],
    "9:16": ["1024x1824", "1536x2752", "2160x3840"],
    "4:3": ["1360x1024", "2304x1728", "3264x2448"],
    "3:4": ["1024x1360", "1728x2304", "2448x3264"],
    "3:2": ["1536x1024", "2496x1664", "3504x2336"],
    "2:3": ["1024x1536", "1664x2496", "2336x3504"],
    "4:5": ["1024x1280", "1792x2240", "2560x3200"],
    "5:4": ["1280x1024", "2240x1792", "3200x2560"],
    "21:9": ["2048x878", "3136x1344", "3808x1632"],
};

/**
 * 从现有尺寸或宽高比中推导标准画幅比例（如 "16:9", "1:1", "9:16"）。
 */
export function inferImageRatio(size?: string, width?: number, height?: number): string | undefined {
    if (size && size !== "auto" && size !== "*") {
        const clean = size.trim().toLowerCase().replace(/×/g, "x");
        if (clean.includes(":")) {
            return clean;
        }
        const ratio = imageRatioForSize(clean);
        if (ratio) return ratio;
    }
    if (width && height && width > 0 && height > 0) {
        return closestRatio(width / height) || undefined;
    }
    return undefined;
}

/**
 * 从现有的尺寸或画质参数中推导分辨率档位（"1k" | "1.5k" | "2k" | "4k"）。
 * 当 size 是具体像素（含 "x"）时优先按像素面积推导，避免被全局遗留的默认 quality 干扰。
 */
export function inferImageResolutionTier(size?: string, quality?: string): ImageResolutionTier | undefined {
    if (size && size !== "auto" && size.toLowerCase().replace(/×/g, "x").includes("x")) {
        const cleanSize = size.trim().toLowerCase().replace(/×/g, "x");
        const match = cleanSize.match(/^(\d+)x(\d+)$/);
        if (match) {
            const pixels = Number(match[1]) * Number(match[2]);
            if (pixels <= 2_000_000) return "1k";
            if (pixels <= 2_600_000) return "1.5k";
            if (pixels <= 4_624_220) return "2k";
            return "4k";
        }
        const option = parseImageResolutionOption(cleanSize);
        if (option?.tier) return option.tier;
    }
    const cleanQuality = quality?.trim().toLowerCase();
    if (cleanQuality && (cleanQuality === "1k" || cleanQuality === "1.5k" || cleanQuality === "2k" || cleanQuality === "4k")) {
        return cleanQuality as ImageResolutionTier;
    }
    if (cleanQuality) {
        const mapped = ({ low: "1k", medium: "2k", high: "4k", xhigh: "4k", max: "4k" } as Record<string, ImageResolutionTier>)[cleanQuality];
        if (mapped) return mapped;
    }
    return undefined;
}

/**
 * 模型切换时智能继承相同比例和分辨率：
 * 若目标模型也支持当前比例（如 16:9），优先继承为目标模型对应的 16:9 尺寸与档位，
 * 避免普通换模型时每次都被重置回默认 1:1。
 */
export function matchCompatibleImageSize(
    targetProfile: ImageCapabilityConfig,
    currentSize?: string,
    currentQuality?: string,
    allowCustomFallback = true,
): { size: string; quality?: string } | undefined {
    if (targetProfile.size.parameter === "none") return undefined;

    const ratio = inferImageRatio(currentSize);
    if (!ratio) return undefined;

    const tier = inferImageResolutionTier(currentSize, currentQuality);
    const presets = imageSizePresets(targetProfile);

    // 1. 如果目标模型是 aspect_ratio 格式（如 Grok, Gemini, Flow2API 等）
    if (targetProfile.size.parameter === "aspect_ratio") {
        const hasPresetRatio = targetProfile.size.values.includes(ratio) || presets.some((p) => p.ratio === ratio);
        if (!hasPresetRatio && !(allowCustomFallback && targetProfile.size.allowCustom)) return undefined;

        let quality = targetProfile.quality.default || "auto";
        if (targetProfile.quality.supported && tier) {
            const fallbackTiers: ImageResolutionTier[] =
                tier === "4k" ? ["4k", "2k", "1.5k", "1k"] : tier === "2k" ? ["2k", "1.5k", "4k", "1k"] : tier === "1.5k" ? ["1.5k", "2k", "1k"] : ["1k", "1.5k", "2k"];
            for (const candidateTier of fallbackTiers) {
                const aliasMatch = imageQualityForTier(targetProfile, candidateTier);
                if (aliasMatch) {
                    quality = aliasMatch;
                    break;
                }
                if (targetProfile.quality.values.includes(candidateTier)) {
                    quality = candidateTier;
                    break;
                }
            }
        }
        return { size: ratio, quality };
    }

    // 2. 如果目标模型是具体像素 size 格式（如 OpenAI, Seedream, 通用模型等）
    if (targetProfile.size.parameter === "size") {
        const cleanCurrentSize = currentSize?.trim().toLowerCase().replace(/×/g, "x");
        // 如果目标模型直接支持当前像素（例如都是 1824x1024）
        if (cleanCurrentSize && targetProfile.size.values.includes(cleanCurrentSize)) {
            return { size: cleanCurrentSize };
        }

        // 寻找目标模型中相同比例的预设
        const matchingPresets = presets.filter((p) => p.ratio === ratio && imageTierAvailable(targetProfile, p.tier));
        if (matchingPresets.length > 0) {
            // 优先寻找同分辨率档位（如 16:9 2K 对 16:9 2K）
            let best = tier ? matchingPresets.find((p) => p.tier === tier) : undefined;
            if (!best && tier === "1.5k") {
                // 1.5K 向 2K 或 1K 寻找
                best = matchingPresets.find((p) => p.tier === "2k") || matchingPresets.find((p) => p.tier === "1k");
            }
            if (!best && tier === "4k") {
                // 4K 若不支持向 2K 降级
                best = matchingPresets.find((p) => p.tier === "2k");
            }
            if (!best) {
                best = matchingPresets[0];
            }
            return { size: imagePresetValue(targetProfile, best) };
        }

        // 若允许自定义且能按该比例计算
        if (allowCustomFallback && targetProfile.size.allowCustom) {
            try {
                const calculated = imagePresetForRatio(tier || "1k", ratio);
                return { size: calculated.size };
            } catch {
                // ignore
            }
        }
    }

    return undefined;
}

export function imagePresetForRatio(tier: ImageResolutionTier, input: string): ImageResolutionOption {
    const match = input.trim().match(/^(\d{1,5})\s*[:：]\s*(\d{1,5})$/);
    if (!match) throw new Error("请输入宽高比，例如 16:9");
    let w = Number(match[1]),
        h = Number(match[2]);
    if (!w || !h || Math.max(w, h) / Math.min(w, h) > 3) throw new Error("宽高比必须为正数，且不超过 3:1");
    let a = w,
        b = h;
    while (b) [a, b] = [b, a % b];
    w /= a;
    h /= a;
    const ratio =
        Object.keys(standardSizes).find((value) => {
            const [width, height] = value.split(":").map(Number);
            return width * h === height * w;
        }) || `${w}:${h}`;
    const index = IMAGE_RESOLUTIONS.indexOf(tier);
    if (index < 0 && tier !== "1.5k") throw new Error("分辨率仅支持 1K、1.5K、2K、4K");
    const standard = tier === "1.5k" ? undefined : standardSizes[ratio]?.[index];
    const pixels = tier === "1.5k" ? 2_359_296 : [1_048_576, 4_194_304, 8_294_400][index];
    let width = Math.round(Math.sqrt((pixels * w) / h) / 16) * 16;
    let height = Math.round((width * h) / w / 16) * 16;
    while (width * height > pixels || Math.max(width, height) > 3840) {
        if (width >= height) {
            width -= 16;
            height = Math.round((width * h) / w / 16) * 16;
        } else {
            height -= 16;
            width = Math.round((height * w) / h / 16) * 16;
        }
    }
    if (standard) [width, height] = standard.split("x").map(Number);
    return { tier, ratio, width, height, size: `${width}x${height}` };
}

export function imageQualityForTier(profile: ImageCapabilityConfig, tier: ImageResolutionTier) {
    const aliases = { "1k": ["1k", "low"], "1.5k": ["1.5k"], "2k": ["2k", "medium"], "4k": ["4k", "high"] }[tier];
    return profile.quality.supported ? profile.quality.values.find((value) => aliases.includes(value.toLowerCase())) : undefined;
}

export function imageResolutionUsesQuality(profile: ImageCapabilityConfig) {
    return profile.size.parameter === "aspect_ratio" && imageResolutionTiers(profile).some((tier) => imageQualityForTier(profile, tier));
}

export function imageTierAvailable(profile: ImageCapabilityConfig, tier: ImageResolutionTier) {
    // 质量参数能映射档位时按上游质量裁剪；管理员尺寸预设存在时再取交集，避免默认 low/medium/high 把未启用的 1K 显示出来。
    if (profile.size.parameter !== "aspect_ratio") return profile.size.parameter !== "none";
    const configuredTiers = new Set(profile.size.presets?.map((preset) => preset.tier));
    if (imageResolutionUsesQuality(profile)) {
        if (!imageQualityForTier(profile, tier)) return false;
        return configuredTiers.size ? configuredTiers.has(tier) : true;
    }
    if (configuredTiers.size) return configuredTiers.has(tier);
    // 无质量映射且无预设时,后端 filterImageSizePresets 会返回全部预设或空;
    // 前端不应硬编码 1k 兜底,避免产生后端不认可的幻影选项。
    return false;
}

export function imageQualityForSelection(profile: ImageCapabilityConfig, tier: ImageResolutionTier) {
    return imageQualityForTier(profile, tier) || (!imageResolutionUsesQuality(profile) && imageTierAvailable(profile, tier) ? tier : undefined);
}

export function imageSizePresets(profile: ImageCapabilityConfig): ImageResolutionOption[] {
    if (profile.size.parameter === "none") return [];
    if (profile.size.presets) return profile.size.presets;
    const pixels = buildImageResolutionOptions(profile.size.values);
    const tiers = profile.size.parameter === "aspect_ratio" ? imageResolutionTiers(profile).filter((tier) => imageQualityForTier(profile, tier)) : [];
    const ratios = tiers.flatMap((tier) =>
        profile.size.values.flatMap((ratio) => {
            try {
                const preset = imagePresetForRatio(tier, ratio);
                return pixels.some((pixel) => pixel.ratio === preset.ratio) ? [] : [preset];
            } catch {
                return [];
            }
        }),
    );
    return [...pixels, ...ratios];
}

export function imagePresetValue(profile: ImageCapabilityConfig, preset: ImageResolutionOption) {
    if (!profile.size.presets && !profile.size.allowCustom && preset.tier === "1k" && profile.size.values.includes(preset.ratio) && !profile.size.values.includes(preset.size)) return preset.ratio;
    return profile.size.parameter === "aspect_ratio" ? preset.ratio : preset.size;
}

export function imageSizeConfigWithPresets(profile: ImageCapabilityConfig, presets: ImageResolutionOption[]): ImageCapabilityConfig["size"] {
    const values = [...new Set(presets.map((preset) => (profile.size.parameter === "aspect_ratio" ? preset.ratio : preset.size)))];
    if (profile.size.values.includes("auto")) values.unshift("auto");
    if (!values.length) values.push("auto");
    return { ...profile.size, presets, values, default: values.includes(profile.size.default) ? profile.size.default : values[0] || "auto" };
}
