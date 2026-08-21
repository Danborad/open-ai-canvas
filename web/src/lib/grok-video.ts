import { modelOptionName, resolveModelRequestConfig, type AiConfig } from "@/stores/use-config-store";

export const grokImageVideoRatioOptions = [
    { value: "16:9", label: "16:9", width: 16, height: 9 },
    { value: "9:16", label: "9:16", width: 9, height: 16 },
    { value: "1:1", label: "1:1", width: 1, height: 1 },
    { value: "4:3", label: "4:3", width: 4, height: 3 },
    { value: "3:4", label: "3:4", width: 3, height: 4 },
    { value: "3:2", label: "3:2", width: 3, height: 2 },
    { value: "2:3", label: "2:3", width: 2, height: 3 },
] as const;

export const grokVideo15RatioOptions = [
    { value: "16:9", label: "16:9", width: 16, height: 9 },
    { value: "9:16", label: "9:16", width: 9, height: 16 },
] as const;

export const grokImageVideoDurationOptions = [6, 10, 15] as const;
export const grokImageVideoMultiRefDurationOptions = [6, 10] as const;
export const grokVideo15DurationOptions = [4, 6, 8, 10, 12, 15] as const;
export const grokVideoResolutionOptions = [
    { value: "480p", label: "480P" },
    { value: "720p", label: "720P" },
] as const;

export function isGrokVideoModel(model: string) {
    const value = modelOptionName(model).toLowerCase();
    return value.includes("grok-image-video") || value.includes("grok-video-1.5") || value === "grok-video" || value.includes("grok-imagine-video");
}

export function isGrokVideo15Model(model: string) {
    // 含 grok-video-1.5 / grok-video-1.5fast / grok-video-1.5-1080p
    const value = modelOptionName(model).toLowerCase();
    return value.includes("grok-video-1.5");
}

export function isGrokVideo15_1080pModel(model: string) {
    const value = modelOptionName(model).toLowerCase();
    return value.includes("grok-video-1.5-1080p");
}

export function isGrokImageVideoModel(model: string) {
    const value = modelOptionName(model).toLowerCase();
    return value.includes("grok-image-video") || (isGrokVideoModel(value) && !isGrokVideo15Model(value));
}

export function isGrokVideoConfig(config: AiConfig) {
    const model = config.model || config.videoModel || "";
    const request = resolveModelRequestConfig(config, model);
    if (request.interfaceType === "newapi-channel-2") return true;
    return isGrokVideoModel(request.model || model);
}

export function isGrok2APIVideoConfig(config: AiConfig) {
    const model = config.model || config.videoModel || "";
    const modelName = modelOptionName(model).trim().toLowerCase();
    const requestInterface = resolveModelRequestConfig(config, model).interfaceType;
    return requestInterface === "grok2api-video" || (requestInterface !== "grok2api-new-video" && !modelName.startsWith("web/") && !modelName.startsWith("console/") && modelName.includes("grok-imagine-video"));
}

export function isGrok2APINewVideoConfig(config: AiConfig) {
    const model = config.model || config.videoModel;
    return resolveModelRequestConfig(config, model).interfaceType === "grok2api-new-video";
}

export function grokVideoRatioOptionsForModel(model: string) {
    return isGrokVideo15Model(model) ? grokVideo15RatioOptions : grokImageVideoRatioOptions;
}

export function grokVideoDurationOptionsForModel(model: string, referenceImageCount = 0) {
    if (isGrokVideo15Model(model)) return grokVideo15DurationOptions;
    if (referenceImageCount >= 2) return grokImageVideoMultiRefDurationOptions;
    return grokImageVideoDurationOptions;
}

export function grokVideoResolutionOptionsForModel(model: string) {
    if (isGrokVideo15_1080pModel(model)) return [{ value: "1080p", label: "1080P" }] as const;
    return grokVideoResolutionOptions;
}

export function normalizeGrokVideoRatio(size: string | undefined, model: string) {
    const value = String(size || "")
        .trim()
        .toLowerCase();
    const options = grokVideoRatioOptionsForModel(model).map((item) => item.value);
    if (options.includes(value as (typeof options)[number])) return value;
    if (value.includes("x")) {
        const [w, h] = value.split("x").map((part) => Number(part));
        if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
            if (w === h && options.includes("1:1")) return "1:1";
            return w > h ? (options.includes("16:9") ? "16:9" : options[0]) : options.includes("9:16") ? "9:16" : options[0];
        }
    }
    if (value === "3:2" || value === "21:9" || value === "4:3") return options.includes("16:9") ? "16:9" : options[0];
    if (value === "2:3" || value === "3:4") return options.includes("9:16") ? "9:16" : options[0];
    return options[0] || "16:9";
}

export function normalizeGrokVideoDuration(seconds: string | number | undefined, model: string, referenceImageCount = 0) {
    const options = grokVideoDurationOptionsForModel(model, referenceImageCount);
    const value = Math.floor(Number(String(seconds || "").replace(/s$/i, "")) || options[0]);
    return String(options.reduce((nearest, option) => (Math.abs(option - value) < Math.abs(nearest - value) ? option : nearest), options[0]));
}

export function normalizeGrokVideoResolution(value: string | undefined, model: string) {
    if (isGrokVideo15_1080pModel(model)) return "1080p";
    const token = String(value || "")
        .trim()
        .toLowerCase();
    if (token === "480" || token === "480p" || token === "low") return "480p";
    if (token === "1080" || token === "1080p") return "720p";
    return "720p";
}

export function normalizeGrok2APIVideoResolution(value: string | undefined) {
    const token = String(value || "")
        .trim()
        .toLowerCase();
    if (token === "480" || token === "480p" || token === "low") return "480p";
    return "720p";
}

export function normalizeGrok2APIVideoDuration(value: string | number | undefined) {
    const seconds = Math.floor(Number(String(value || "").replace(/s$/i, "")) || 6);
    return [6, 10, 15].reduce((nearest, option) => (Math.abs(option - seconds) < Math.abs(nearest - seconds) ? option : nearest), 6);
}

export function normalizeGrok2APIVideoAspect(value: string | undefined) {
    const raw = String(value || "")
        .trim()
        .toLowerCase();
    if (["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"].includes(raw)) return raw;
    const match = raw.match(/^(\d+)x(\d+)$/);
    if (match) return Number(match[1]) / Number(match[2]) >= 1 ? "16:9" : "9:16";
    return "16:9";
}

export function normalizeGrok2APINewVideoDuration(value: string | number | undefined) {
    const seconds = Math.floor(Number(String(value || "").replace(/s$/i, "")) || 8);
    return Math.min(15, Math.max(1, seconds));
}

export function normalizeGrok2APINewVideoResolution(value: string | undefined, model: string) {
    const raw = String(value || "")
        .trim()
        .toLowerCase();
    const requested = raw === "480" || raw === "480p" ? "480p" : raw === "1080" || raw === "1080p" ? "1080p" : "720p";
    const modelName = modelOptionName(model).toLowerCase();
    return modelName === "console/grok-imagine-video" && requested === "1080p" ? "720p" : requested;
}
