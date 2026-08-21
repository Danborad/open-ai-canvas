import { modelOptionName, resolveModelRequestConfig, type AiConfig } from "@/stores/use-config-store";

export const flow2APIImageAspectOptions = [
    { value: "16:9", label: "16:9", width: 16, height: 9, icon: "landscape" as const },
    { value: "4:3", label: "4:3", width: 4, height: 3, icon: "landscape" as const },
    { value: "1:1", label: "1:1", width: 1, height: 1, icon: "square" as const },
    { value: "3:4", label: "3:4", width: 3, height: 4, icon: "portrait" as const },
    { value: "9:16", label: "9:16", width: 9, height: 16, icon: "portrait" as const },
];

// Nano Banana 默认档就是 1K；2K 通过 imageSize=2k 显式传给 Flow2API。
export const flow2APIImageScaleOptions = [
    { value: "1K", label: "1K", imageSize: "1K" },
    { value: "2K", label: "2K", imageSize: "2K" },
];

export const flow2APIVideoResolutionOptions = [
    { value: "720p", label: "720P" },
    { value: "1080p", label: "1080P" },
] as const;

export const flow2APIVideoAspectOptions = [
    { value: "9:16", label: "9:16", width: 9, height: 16 },
    { value: "16:9", label: "16:9", width: 16, height: 9 },
];

export const flow2APIOmniDurationOptions = [4, 6, 8, 10] as const;

export function isFlow2APIImageConfig(config: AiConfig) {
    const model = config.model || config.imageModel || "";
    const request = resolveModelRequestConfig(config, model);
    const modelName = String(request.model || model)
        .trim()
        .toLowerCase();
    // GPT Image 2 follows OpenAI Images even if an old channel record carried
    // the generic Flow2API image label.
    if (modelName.startsWith("gpt-image") || modelName.startsWith("gpt image") || modelName.includes("grok-imagine-image")) return false;
    return request.interfaceType === "flow2api-image";
}

export function isFlow2APIVideoConfig(config: AiConfig) {
    const model = config.model || config.videoModel || "";
    const request = resolveModelRequestConfig(config, model);
    const modelName = String(request.model || model)
        .trim()
        .toLowerCase();
    return !modelName.includes("grok-imagine-video") && request.interfaceType === "flow2api-video";
}

export function isFlow2APIOmniFlash(config: Pick<AiConfig, "model" | "videoModel">) {
    const name = modelOptionName(config.model || config.videoModel || "").toLowerCase();
    return name.includes("omni flash") || name.includes("omni-flash") || name === "omni";
}

export function isFlow2APIImagen(config: Pick<AiConfig, "model" | "imageModel">) {
    const name = modelOptionName(config.model || config.imageModel || "").toLowerCase();
    return name.includes("imagen");
}

export function normalizeFlow2APIImageAspect(size?: string) {
    const value = String(size || "")
        .trim()
        .toLowerCase();
    if (!value || value === "auto") return "16:9";
    if (value.includes("x")) {
        const [w, h] = value.split("x").map((part) => Number(part));
        if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
            const ratio = w / h;
            const options = [
                { value: "1:1", ratio: 1 },
                { value: "16:9", ratio: 16 / 9 },
                { value: "9:16", ratio: 9 / 16 },
                { value: "4:3", ratio: 4 / 3 },
                { value: "3:4", ratio: 3 / 4 },
            ];
            return options.reduce((best, item) => (Math.abs(ratio - item.ratio) < Math.abs(ratio - best.ratio) ? item : best)).value;
        }
    }
    const base = value.includes("-") ? value.split("-")[0] : value;
    if (["16:9", "9:16", "1:1", "4:3", "3:4"].includes(base)) return base;
    if (base === "3:2" || base === "21:9") return "16:9";
    if (base === "2:3") return "9:16";
    return "16:9";
}

export function normalizeFlow2APIImageScale(quality?: string, size?: string) {
    const raw = `${quality || ""} ${size || ""}`.toLowerCase();
    if (raw.includes("2x") || raw.includes("2k") || raw.includes("medium") || raw.includes("high") || raw.includes("4k")) return "2K";
    return "1K";
}

export function normalizeFlow2APIVideoAspect(size?: string) {
    const value = normalizeFlow2APIImageAspect(size);
    return value === "9:16" ? "9:16" : "16:9";
}

export function normalizeFlow2APIOmniDuration(seconds?: string) {
    const value = Number.parseInt(String(seconds || "").replace(/s$/i, ""), 10);
    if (flow2APIOmniDurationOptions.includes(value as (typeof flow2APIOmniDurationOptions)[number])) return String(value);
    return "6";
}

export function flow2APIImageScaleLabel(value: string) {
    return flow2APIImageScaleOptions.find((item) => item.value.toLowerCase() === value.toLowerCase())?.label || value || "1K";
}
