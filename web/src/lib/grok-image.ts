import { modelOptionName, resolveModelRequestConfig, type AiConfig } from "@/stores/use-config-store";

export const grok2APIImageAspectOptions = [
    { value: "16:9", label: "16:9", width: 16, height: 9, icon: "landscape" as const },
    { value: "4:3", label: "4:3", width: 4, height: 3, icon: "landscape" as const },
    { value: "1:1", label: "1:1", width: 1, height: 1, icon: "square" as const },
    { value: "3:4", label: "3:4", width: 3, height: 4, icon: "portrait" as const },
    { value: "9:16", label: "9:16", width: 9, height: 16, icon: "portrait" as const },
    { value: "3:2", label: "3:2", width: 3, height: 2, icon: "landscape" as const },
    { value: "2:3", label: "2:3", width: 2, height: 3, icon: "portrait" as const },
] as const;

export const grok2APIImageResolutionOptions = [
    { value: "auto", label: "1K" },
    { value: "medium", label: "2K" },
] as const;

export function isGrok2APIImageConfig(config: AiConfig) {
    const model = config.model || config.imageModel || "";
    const requestInterface = resolveModelRequestConfig(config, model).interfaceType;
    const modelName = modelOptionName(model).trim().toLowerCase();
    return requestInterface === "grok2api-image" || (requestInterface !== "grok2api-new-image" && !modelName.startsWith("web/") && !modelName.startsWith("console/") && modelName.includes("grok-imagine-image"));
}

export function isGrok2APINewImageConfig(config: AiConfig) {
    const model = config.model || config.imageModel;
    return resolveModelRequestConfig(config, model).interfaceType === "grok2api-new-image";
}

export function normalizeGrok2APINewImageAspect(value?: string) {
    let current = String(value || "").trim().toLowerCase();
    if (current.includes("-")) current = current.split("-", 1)[0];
    const supported = ["auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "2:1", "1:2", "19.5:9", "9:19.5", "20:9", "9:20"];
    if (supported.includes(current)) return current;
    if (current.includes("x")) {
        const [width, height] = current.split("x").map(Number);
        if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) return width === height ? "1:1" : width > height ? "16:9" : "9:16";
    }
    return "auto";
}

export function normalizeGrok2APINewImageResolution(value?: string) {
    const raw = String(value || "").trim().toLowerCase();
    return ["2k", "2x", "medium", "high", "4k", "hd"].some((item) => raw.includes(item)) ? "2k" : "1k";
}

export function normalizeGrok2APIImageAspect(value?: string) {
    let current = String(value || "").trim().toLowerCase();
    if (current.includes("-")) current = current.split("-", 1)[0];
    if (current.includes("x")) {
        const [width, height] = current.split("x").map(Number);
        if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
            current = width >= height ? "16:9" : "9:16";
        }
    }
    return grok2APIImageAspectOptions.some((item) => item.value === current) ? current : "16:9";
}

export function normalizeGrok2APIImageResolution(value?: string) {
    const raw = String(value || "").trim().toLowerCase();
    return ["medium", "2k", "2x", "high", "4k", "hd"].some((item) => raw.includes(item)) ? "medium" : "auto";
}

export function grok2APIImageResolutionLabel(value?: string) {
    const normalized = normalizeGrok2APIImageResolution(value);
    return grok2APIImageResolutionOptions.find((item) => item.value === normalized)?.label || "1K";
}
