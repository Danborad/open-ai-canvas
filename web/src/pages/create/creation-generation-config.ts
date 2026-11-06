import { modelCapabilityConfigFor, normalizeImageValue, normalizeVideoValue } from "@/lib/model-capabilities";
import { resolveModelVideoBooleanOptions } from "@/lib/model-selection";
import type { AiConfig } from "@/stores/use-config-store";
import type { CreationSettings } from "./creation-types";

export function creationImageConfig(config: AiConfig, model: string, settings: { ratio?: string; imageResolution?: string; quality?: string; count?: string | number; imageParameters?: string }): AiConfig {
    const profile = modelCapabilityConfigFor(config, model).image!;
    const normalized = normalizeImageValue(profile, {
        size: settings.ratio || profile.size.default,
        quality: settings.quality || profile.quality.default,
        imageResolution: settings.imageResolution || profile.resolution.default,
        imageParameters: settings.imageParameters,
        count: String(settings.count || config.count || "1"),
    });
    return {
        ...config,
        model,
        imageModel: model,
        size: normalized.size || config.size || "1:1",
        quality: normalized.quality || config.quality || "auto",
        imageResolution: normalized.imageResolution || config.imageResolution || "auto",
        imageParameters: settings.imageParameters || "{}",
        count: String(settings.count || config.count || "1"),
    };
}

// 创作台没有音频和水印开关；报价与提交共用所选模型的默认值和能力限制。
export function creationVideoConfig(config: AiConfig, model: string, settings: Pick<CreationSettings, "ratio" | "seconds" | "videoQuality">): AiConfig {
    const profile = modelCapabilityConfigFor(config, model).video!;
    const normalized = normalizeVideoValue(profile, {
        ratio: settings.ratio,
        seconds: settings.seconds,
        resolution: settings.videoQuality,
    });
    return {
        ...config,
        model,
        videoModel: model,
        size: normalized.ratio,
        videoSeconds: normalized.seconds,
        vquality: normalized.resolution.replace(/p$/i, ""),
        ...resolveModelVideoBooleanOptions(
            config,
            model,
            {},
            {
                videoGenerateAudio: config.videoGenerateAudio,
                videoWatermark: config.videoWatermark,
            },
        ),
    };
}
