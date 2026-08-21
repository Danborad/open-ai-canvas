import type { ModelProtocol } from "@/lib/model-protocols";
import { modelOptionName } from "@/stores/use-config-store";

export type ModelCapabilityConfig = {
    version: number;
    image?: ImageCapabilityConfig;
    video?: VideoCapabilityConfig;
};

export type ImageSizeParameter = "none" | "size" | "aspect_ratio";

export type ImageCapabilityConfig = {
    references: {
        promptMaxChars: number;
        maxImages: number;
        maxImageBytes: number;
        maskSupported: boolean;
    };
    size: {
        parameter: ImageSizeParameter;
        values: string[];
        default: string;
        allowCustom: boolean;
    };
    quality: {
        supported: boolean;
        values: string[];
        default: string;
    };
    transparentBackground: { supported: boolean; default: boolean };
    responseFormat: { supported: boolean };
    outputFormat: { supported: boolean };
    maxOutputs: number;
};

export type VideoCapabilityConfig = {
    references: {
        promptMaxChars: number;
        maxImages: number;
        maxImageBytes: number;
        maxVideos: number;
        maxVideoBytes: number;
        maxVideoDurationSeconds: number;
        maxAudios: number;
        maxAudioBytes: number;
        maxAudioDurationSeconds: number;
    };
    duration: {
        selection: "range" | "enum";
        min?: number;
        max?: number;
        step?: number;
        values?: number[];
        default: number;
    };
    ratios: string[];
    defaultRatio: string;
    resolutions: string[];
    defaultResolution: string;
    generateAudio: { supported: boolean; default: boolean };
    watermark: { supported: boolean; default: boolean };
    operations: string[];
    defaultOperation: string;
    maxOutputs?: number;
};

const defaultImageSizes = ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "21:9", "9:16", "2048x2048", "2048x1152", "1152x2048", "3840x2160", "2160x3840"];

export function defaultImageCapabilityConfig(protocol?: ModelProtocol, model = ""): ImageCapabilityConfig {
    const cleanModel = modelOptionName(model).trim();
    const image: ImageCapabilityConfig = {
        references: { promptMaxChars: 32000, maxImages: 16, maxImageBytes: 30 * 1024 * 1024, maskSupported: true },
        size: { parameter: "size", values: [...defaultImageSizes], default: "1:1", allowCustom: true },
        quality: { supported: true, values: ["auto", "low", "medium", "high"], default: "auto" },
        transparentBackground: { supported: true, default: false },
        responseFormat: { supported: true },
        outputFormat: { supported: true },
        maxOutputs: 15,
    };
    if (protocol === "grok-image" || protocol === "grok2api-image" || protocol === "grok2api-new-image") {
        image.references.maxImages = protocol === "grok2api-image" || protocol === "grok2api-new-image" ? 8 : 1;
        image.references.maskSupported = false;
        image.size =
            protocol === "grok2api-new-image"
                ? { parameter: "aspect_ratio", values: ["auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "2:1", "1:2", "19.5:9", "9:19.5", "20:9", "9:20"], default: "auto", allowCustom: false }
                : protocol === "grok2api-image"
                  ? { parameter: "aspect_ratio", values: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"], default: "16:9", allowCustom: false }
                  : { parameter: "none", values: [], default: "auto", allowCustom: false };
        image.quality =
            protocol === "grok2api-new-image"
                ? { supported: true, values: ["1k", "2k"], default: "1k" }
                : protocol === "grok2api-image"
                  ? { supported: true, values: ["auto", "medium"], default: "auto" }
                  : { supported: false, values: [], default: "auto" };
        image.transparentBackground = { supported: false, default: false };
        image.responseFormat = { supported: true };
        image.outputFormat = { supported: false };
        image.maxOutputs = protocol === "grok2api-new-image" ? 10 : protocol === "grok2api-image" ? 4 : 1;
        if (protocol === "grok2api-new-image") {
            const modelName = cleanModel.toLowerCase();
            if (modelName.startsWith("console/")) image.references.maxImages = 3;
            if (modelName.startsWith("console/")) image.size = { parameter: "aspect_ratio", values: ["auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "2:1", "1:2"], default: "auto", allowCustom: false };
            if (modelName.startsWith("web/") && modelName.endsWith("-lite")) image.references.maxImages = 0;
            if (modelName === "web/grok-imagine-image-lite") {
                image.size = { parameter: "none", values: [], default: "auto", allowCustom: false };
                image.quality = { supported: false, values: [], default: "auto" };
            }
            if (modelName === "web/grok-imagine-image-2.0" || modelName === "web/grok-imagine-image-edit") image.quality = { supported: true, values: ["1k"], default: "1k" };
        }
    }
    if (protocol === "zarklab-image") {
        image.references.maxImages = 8;
        image.references.maskSupported = false;
        const standardRatios = ["1:1", "4:5", "2:3", "3:2", "9:16", "16:9"];
        switch (cleanModel) {
            case "Nano Banana 2":
            case "Nano Banana 2 Lite":
            case "Nano Banana Lite":
                image.size = { parameter: "aspect_ratio", values: [...standardRatios, "4:1", "1:4", "8:1", "1:8"], default: "1:1", allowCustom: false };
                break;
            case "Grok Image":
                image.size = { parameter: "aspect_ratio", values: [...standardRatios, "4:3", "3:4"], default: "1:1", allowCustom: false };
                break;
            default:
                image.size = { parameter: "aspect_ratio", values: standardRatios, default: "1:1", allowCustom: false };
                break;
        }
        image.quality = { supported: true, values: ["Standard", "High"], default: "High" };
        image.transparentBackground = { supported: false, default: false };
        image.responseFormat = { supported: false };
        image.outputFormat = { supported: false };
        image.maxOutputs = 10;
    }
    if (protocol === "volcengine-ark-image") {
        image.references.maskSupported = false;
        image.quality.supported = false;
        image.transparentBackground.supported = false;
        image.responseFormat.supported = false;
        image.outputFormat.supported = false;
    }
    if (protocol === "volcengine-jimeng-image") {
        image.references.maxImages = 14;
        image.references.maskSupported = false;
        image.quality.supported = false;
        image.transparentBackground.supported = false;
        image.responseFormat.supported = false;
        image.outputFormat.supported = false;
    }
    if (protocol === "flow2api-image") {
        image.references.maxImages = 8;
        image.references.maskSupported = false;
        image.size = { parameter: "aspect_ratio", values: ["1:1", "16:9", "9:16", "4:3", "3:4"], default: "16:9", allowCustom: false };
        image.quality = { supported: true, values: ["1K", "2K"], default: "1K" };
        image.transparentBackground = { supported: false, default: false };
        image.maxOutputs = 4;
    }
    if (protocol !== "grok-image" && protocol !== "grok2api-image" && protocol !== "grok2api-new-image" && model.trim().toLowerCase().startsWith("grok-imagine-image")) {
        image.references.maxImages = 0;
        image.references.maskSupported = false;
        image.size = { parameter: "none", values: [], default: "auto", allowCustom: false };
        image.quality = { supported: false, values: [], default: "auto" };
        image.transparentBackground = { supported: false, default: false };
        image.responseFormat = { supported: true };
        image.outputFormat = { supported: false };
        image.maxOutputs = 1;
    }
    return image;
}

export function defaultModelCapabilityConfig(protocol?: ModelProtocol, model = ""): ModelCapabilityConfig {
    const cleanModel = modelOptionName(model).trim();
    const video: VideoCapabilityConfig = {
        references: {
            promptMaxChars: 1000,
            maxImages: 9,
            maxImageBytes: 30 * 1024 * 1024,
            maxVideos: 0,
            maxVideoBytes: 0,
            maxVideoDurationSeconds: 0,
            maxAudios: 0,
            maxAudioBytes: 0,
            maxAudioDurationSeconds: 0,
        },
        duration: { selection: "range", min: 1, max: 15, step: 1, default: 6 },
        ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
        defaultRatio: "16:9",
        resolutions: ["480p", "720p", "1080p", "2160p"],
        defaultResolution: "720p",
        generateAudio: { supported: false, default: false },
        watermark: { supported: false, default: false },
        operations: ["text_to_video", "image_to_video"],
        defaultOperation: "text_to_video",
    };
    if (protocol === "volcengine-jimeng-video") video.duration = { selection: "enum", values: [5, 10], default: 5 };
    if (protocol === "gemini-veo") {
        video.duration = { selection: "enum", values: [4, 6, 8], default: 6 };
        video.resolutions = ["720p", "1080p"];
    }
    if (protocol === "flow2api-video") {
        video.duration = { selection: "enum", values: [4, 6, 8, 10], default: 6 };
        video.ratios = ["16:9", "9:16"];
        video.resolutions = ["720p", "1080p"];
        video.generateAudio = { supported: false, default: false };
        video.watermark = { supported: false, default: false };
        video.maxOutputs = 4;
    }
    if (protocol === "grok2api-video") {
        video.duration = { selection: "enum", values: [6, 10, 15], default: 6 };
        video.ratios = ["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3"];
        video.resolutions = ["480p", "720p"];
        video.references.maxImages = 1;
        video.maxOutputs = 1;
    }
    if (protocol === "grok2api-new-video") {
        video.duration = { selection: "range", min: 1, max: 15, step: 1, default: 8 };
        video.ratios = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "2:1", "1:2"];
        video.resolutions = ["480p", "720p", "1080p"];
        video.references.maxImages = 8;
        video.maxOutputs = 0;
        const modelName = model.trim().toLowerCase();
        if (modelName === "console/grok-imagine-video") video.resolutions = ["480p", "720p"];
        if (modelName.startsWith("console/")) video.references.maxImages = 7;
    }
    if (protocol === "zarklab-video") {
        video.operations = ["text_to_video", "image_to_video"];
        video.references.maxImages = 8;
        video.maxOutputs = 0;
        switch (cleanModel) {
            case "Gemini Omni Flash":
                video.duration = { selection: "range", min: 3, max: 10, step: 1, default: 5 };
                video.ratios = ["16:9", "9:16"];
                video.resolutions = ["720p"];
                video.generateAudio = { supported: false, default: false };
                break;
            case "Seedance 2.5":
                video.duration = { selection: "range", min: 4, max: 30, step: 1, default: 6 };
                video.ratios = ["auto", "16:9", "21:9", "4:3", "1:1", "3:4", "9:16"];
                video.resolutions = ["480p", "720p"];
                video.generateAudio = { supported: true, default: true };
                break;
            case "Seedance 2":
                video.duration = { selection: "range", min: 4, max: 15, step: 1, default: 6 };
                video.ratios = ["auto", "16:9", "21:9", "4:3", "1:1", "3:4", "9:16"];
                video.resolutions = ["480p", "720p", "1080p", "4K"];
                video.generateAudio = { supported: true, default: true };
                break;
            case "Seedance 2 Lite":
            case "Seedance 2 Mini":
                video.duration = { selection: "range", min: 4, max: 15, step: 1, default: 6 };
                video.ratios = ["auto", "16:9", "21:9", "4:3", "1:1", "3:4", "9:16"];
                video.resolutions = ["480p", "720p"];
                video.generateAudio = { supported: true, default: true };
                break;
            case "Kling O3 4K":
                video.duration = { selection: "range", min: 3, max: 15, step: 1, default: 5 };
                video.ratios = ["16:9", "1:1", "9:16"];
                video.resolutions = ["4K"];
                video.defaultResolution = "4K";
                video.generateAudio = { supported: true, default: true };
                break;
            case "Kling O3 Pro":
            case "Kling 3.0 Turbo":
                video.duration = { selection: "range", min: 3, max: 15, step: 1, default: 5 };
                video.ratios = ["16:9", "1:1", "9:16"];
                video.resolutions = ["1080p"];
                video.defaultResolution = "1080p";
                video.generateAudio = { supported: true, default: true };
                break;
            case "Kling 3.0 Lite":
                video.duration = { selection: "range", min: 3, max: 15, step: 1, default: 5 };
                video.ratios = ["16:9", "1:1", "9:16"];
                video.resolutions = ["720p", "1080p"];
                video.defaultResolution = "720p";
                video.generateAudio = { supported: true, default: true };
                break;
            case "Veo 3.1":
            case "Veo 3.1 Fast":
            case "Veo 3.1 Lite":
                video.duration = { selection: "enum", values: [4, 6, 8], default: 6 };
                video.ratios = ["auto", "16:9", "9:16"];
                video.resolutions = ["720p", "1080p"];
                video.generateAudio = { supported: true, default: true };
                break;
            case "Grok Video":
                video.duration = { selection: "range", min: 4, max: 10, step: 1, default: 6 };
                video.ratios = ["auto", "16:9", "4:3", "1:1", "3:4", "9:16"];
                video.resolutions = ["480p", "720p"];
                video.generateAudio = { supported: false, default: false };
                break;
            case "MiniMax H3":
                video.duration = { selection: "range", min: 5, max: 15, step: 1, default: 5 };
                video.ratios = ["16:9", "21:9", "4:3", "1:1", "3:4", "9:16"];
                video.resolutions = ["768p", "2K", "4K"];
                video.defaultResolution = "768p";
                video.generateAudio = { supported: false, default: false };
                break;
            case "Happy Horse":
                video.duration = { selection: "range", min: 3, max: 15, step: 1, default: 5 };
                video.ratios = ["16:9", "21:9", "4:3", "1:1", "3:4", "4:5", "5:4", "9:16", "9:21"];
                video.resolutions = ["720p", "1080p"];
                video.defaultResolution = "720p";
                video.generateAudio = { supported: true, default: true };
                break;
            default:
                video.duration = { selection: "range", min: 3, max: 15, step: 1, default: 5 };
                video.ratios = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"];
                video.resolutions = ["720p", "1080p"];
                video.generateAudio = { supported: true, default: true };
                break;
        }
    }
    if (protocol === "volcengine-ark-video" || protocol === "newapi-channel-1" || protocol === "newapi-channel-2") {
        video.references.maxVideos = 3;
        video.references.maxAudios = 3;
        video.references.maxVideoBytes = 200 * 1024 * 1024;
        video.references.maxAudioBytes = 15 * 1024 * 1024;
        video.references.maxVideoDurationSeconds = 15;
        video.references.maxAudioDurationSeconds = 15;
        video.generateAudio = { supported: true, default: true };
    }
    if (protocol === "volcengine-ark-video") video.watermark = { supported: true, default: false };
    return { version: 1, image: defaultImageCapabilityConfig(protocol, model), video };
}

export function modelCapabilityConfigFor(
    config: { channels: Array<{ id: string; models: string[]; interfaceType?: ModelProtocol; modelCosts?: Array<{ model: string; capabilityConfig?: ModelCapabilityConfig; protocol?: ModelProtocol }> }> },
    model: string,
) {
    const separator = model.indexOf("::");
    const channelId = separator >= 0 ? model.slice(0, separator) : "";
    const modelName = separator >= 0 ? model.slice(separator + 2) : model;
    const channel = config.channels.find((item) => item.id === channelId) || config.channels.find((item) => item.models.includes(modelName));
    const cost = channel?.modelCosts?.find((item) => item.model === modelName);
    const normalizedModelName = modelName.toLowerCase();
    const explicitProtocol = cost?.protocol || channel?.interfaceType;
    const protocol =
        explicitProtocol === "grok2api-new-image" || explicitProtocol === "grok2api-new-video" || explicitProtocol === "zarklab-image" || explicitProtocol === "zarklab-video"
            ? explicitProtocol
            : normalizedModelName.startsWith("gpt-image") || normalizedModelName.startsWith("gpt image")
              ? "openai-image"
              : normalizedModelName.startsWith("grok-imagine-image")
                ? "grok2api-image"
                : normalizedModelName.startsWith("grok-imagine-video")
                  ? "grok2api-video"
                  : cost?.protocol;
    const fallback = defaultModelCapabilityConfig(protocol, modelName);
    if (protocol === "grok2api-video" || protocol === "grok2api-image") return { ...fallback, image: fallback.image, video: fallback.video };
    if (cost?.capabilityConfig) {
        let image = cost.capabilityConfig.image || fallback.image;
        if (protocol === "zarklab-image" && fallback.image) {
            const fallbackValues = fallback.image.size.values || [];
            const existingValues = image?.size.values || [];
            const merged = Array.from(new Set([...existingValues, ...fallbackValues])).filter((v) => v !== "auto");
            image = {
                ...fallback.image,
                ...image,
                size: {
                    ...fallback.image.size,
                    ...image?.size,
                    values: merged.length ? merged : fallbackValues,
                },
            };
        }
        let video = cost.capabilityConfig.video || fallback.video;
        if (protocol === "zarklab-video" && fallback.video) {
            const fallbackRatios = fallback.video.ratios || [];
            const existingRatios = video?.ratios || [];
            const merged = Array.from(new Set([...existingRatios, ...fallbackRatios]));
            video = {
                ...fallback.video,
                ...video,
                ratios: merged.length ? merged : fallbackRatios,
            };
        }
        return { ...fallback, ...cost.capabilityConfig, image, video };
    }
    return fallback;
}

export function normalizeImageValue(profile: ImageCapabilityConfig, value: { size?: string; quality?: string; count?: string; transparentBackground?: string }) {
    const size = normalizeImageSizeSetting(profile, value.size);
    const quality = profile.quality.supported && profile.quality.values.includes(value.quality || "") ? value.quality! : profile.quality.default || "auto";
    const count = String(Math.max(1, Math.min(profile.maxOutputs || Number.POSITIVE_INFINITY, Math.floor(Math.abs(Number(value.count)) || 1))));
    const transparentBackground = profile.transparentBackground.supported && value.transparentBackground === "true" ? "true" : "false";
    return { size, quality, count, transparentBackground };
}

export function normalizeImageSizeSetting(profile: ImageCapabilityConfig, value?: string) {
    if (profile.size.parameter === "none") return "auto";
    const candidate = value?.trim() || profile.size.default;
    if (profile.size.allowCustom || profile.size.values.includes(candidate)) return candidate;
    return profile.size.default || profile.size.values[0] || "auto";
}

export function imageSizeRequest(profile: ImageCapabilityConfig, value?: string) {
    const parameter = profile.size.parameter;
    if (parameter === "none") return undefined;
    const normalized = normalizeImageSizeSetting(profile, value);
    if (!normalized || normalized === "auto") return undefined;
    return { parameter, value: normalized };
}

export function normalizeVideoValue(profile: VideoCapabilityConfig, value: { seconds?: string; ratio?: string; resolution?: string }) {
    const duration = profile.duration.selection === "enum" ? ((profile.duration.values || []).includes(Number(value.seconds)) ? Number(value.seconds) : profile.duration.default) : normalizeRangeDuration(profile, Number(value.seconds));
    const ratio = profile.ratios.includes(value.ratio || "") ? value.ratio! : profile.defaultRatio;
    const resolution = profile.resolutions.includes(value.resolution || "") ? value.resolution! : profile.defaultResolution;
    return { seconds: String(duration), ratio, resolution };
}

function normalizeRangeDuration(profile: VideoCapabilityConfig, value: number) {
    const min = profile.duration.min || 1;
    const max = profile.duration.max || min;
    const step = profile.duration.step || 1;
    const candidate = Number.isFinite(value) ? Math.floor(value) : profile.duration.default;
    const clamped = Math.min(max, Math.max(min, candidate));
    const maxStep = Math.max(0, Math.floor((max - min) / step));
    return min + Math.min(maxStep, Math.max(0, Math.round((clamped - min) / step))) * step;
}

export function videoDurationOptions(profile: VideoCapabilityConfig) {
    if (profile.duration.selection === "enum") return profile.duration.values || [];
    const min = profile.duration.min || 1;
    const max = profile.duration.max || min;
    const step = profile.duration.step || 1;
    return Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, index) => min + index * step);
}

export function videoDurationAllowed(profile: VideoCapabilityConfig, value: number) {
    if (profile.duration.selection === "enum") return (profile.duration.values || []).includes(value);
    const min = profile.duration.min || 1;
    const max = profile.duration.max || min;
    const step = profile.duration.step || 1;
    return value >= min && value <= max && (value - min) % step === 0;
}
