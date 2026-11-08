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
    low: "1K",
    medium: "2K",
    high: "4K",
    "1k": "1K",
    "2k": "2K",
    "4k": "4K",
};

const GEMINI_THINKING_LEVELS: Record<string, "LOW" | "MEDIUM" | "HIGH" | "MINIMAL"> = {
    minimal: "MINIMAL",
    min: "MINIMAL",
    low: "LOW",
    medium: "MEDIUM",
    med: "MEDIUM",
    high: "HIGH",
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
    const imageSize = GEMINI_IMAGE_SIZES[normalizedQuality || ""] || "4K";
    if (imageSize) imageConfig.imageSize = imageSize;

    const thinking = thinkingLevel ? GEMINI_THINKING_LEVELS[thinkingLevel.trim().toLowerCase()] : undefined;

    return {
        responseModalities: ["TEXT", "IMAGE"],
        ...(Object.keys(imageConfig).length ? { imageConfig } : {}),
        ...(thinking ? { thinkingConfig: { thinkingLevel: thinking } } : {}),
    };
}
