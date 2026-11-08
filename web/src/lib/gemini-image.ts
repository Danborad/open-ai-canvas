export type GeminiImageGenerationConfig = {
    responseModalities: ["TEXT", "IMAGE"];
    imageConfig?: { aspectRatio?: string; imageSize?: "1K" | "2K" | "4K" };
    thinkingConfig?: { thinkingLevel?: "LOW" | "MEDIUM" | "HIGH" | "MINIMAL" };
};

export type GeminiInlineImage = {
    mimeType: string;
    data: string;
};

const GEMINI_IMAGE_SIZES: Record<string, GeminiInlineImageGenerationSize> = {
    "1k": "1K",
    "2k": "2K",
    "4k": "4K",
    low: "1K",
    medium: "2K",
    high: "4K",
};

export const GEMINI_THINKING_LEVEL_OPTIONS = [
    { value: "low", label: "低 (low)" },
    { value: "medium", label: "中 (medium)" },
    { value: "high", label: "高 (high，默认推荐)" },
] as const;

const GEMINI_THINKING_LEVELS: Record<string, "LOW" | "MEDIUM" | "HIGH" | "MINIMAL"> = {
    low: "LOW",
    medium: "MEDIUM",
    high: "HIGH",
    minimal: "MINIMAL",
    min: "MINIMAL",
    med: "MEDIUM",
};

type GeminiInlineImageGenerationSize = "1K" | "2K" | "4K";

export function parseGeminiImageDataUrl(dataUrl: string): GeminiInlineImage {
    const match = dataUrl.trim().match(/^data:([^;,\s]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/=_-]+)$/i);
    if (!match) throw new Error("参考图片读取失败：未得到有效的 image data URL");
    const mimeType = match[1].toLowerCase();
    const data = match[2].replace(/-/g, "+").replace(/_/g, "/");
    if (!mimeType.startsWith("image/")) throw new Error(`参考图片 MIME 类型无效：${mimeType}`);
    if (!data) throw new Error("参考图片读取失败：图片数据为空");
    return { mimeType, data };
}

export function buildGeminiImageGenerationConfig(size?: string, quality?: string, thinkingLevel?: string): GeminiImageGenerationConfig {
    const imageConfig: NonNullable<GeminiImageGenerationConfig["imageConfig"]> = {};
    const normalizedSize = size?.trim();
    const normalizedQuality = quality?.trim().toLowerCase();
    if (normalizedSize && normalizedSize !== "auto" && /^\d+:\d+$/.test(normalizedSize)) imageConfig.aspectRatio = normalizedSize;
    const imageSize = GEMINI_IMAGE_SIZES[normalizedQuality || ""] || "2K";
    if (imageSize) imageConfig.imageSize = imageSize;

    // 思考等级（图片等级）：默认为 HIGH（高，默认推荐）
    const effectiveThinking = thinkingLevel?.trim().toLowerCase() || "high";
    const thinking = GEMINI_THINKING_LEVELS[effectiveThinking] || "HIGH";

    return {
        responseModalities: ["TEXT", "IMAGE"],
        ...(Object.keys(imageConfig).length ? { imageConfig } : {}),
        thinkingConfig: { thinkingLevel: thinking },
    };
}
