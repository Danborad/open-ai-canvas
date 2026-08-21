import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

export const MEDIA_NODE_MIN_SIZE = { width: 300, height: 220 } as const;
export const VIDEO_NODE_MAX_SIZE = { width: 480, height: 480 } as const;

export function fitNodeSize(width: number, height: number, maxWidth = 640, maxHeight = 640, minWidth = MEDIA_NODE_MIN_SIZE.width, minHeight = MEDIA_NODE_MIN_SIZE.height) {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    // 媒体节点既要保留原始比例，也要给生成状态、操作按钮留下稳定的可读空间。
    const preferredScale = Math.min(1, maxWidth / w, maxHeight / h);
    const minimumScale = Math.max(minWidth / w, minHeight / h);
    const scale = Math.max(preferredScale, minimumScale);
    return { width: w * scale, height: h * scale };
}

export function nodeSizeFromRatio(size: string, baseWidth: number, baseHeight: number) {
    const raw = String(size || "").trim();
    if (!raw || raw.toLowerCase() === "auto") return null;
    // 支持 16:9 / 1024x576 / 16:9-2k
    const match = raw.match(/^(\d+(?:\.\d+)?)(?:x|:)(\d+(?:\.\d+)?)/i);
    if (!match) return null;
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
    const ratio = width / Math.max(1, height);
    if (ratio < 0.25 || ratio > 4) return { width: baseWidth, height: baseHeight };
    const candidateSize = ratio >= baseWidth / baseHeight ? { width: baseWidth, height: baseWidth / ratio } : { width: baseHeight * ratio, height: baseHeight };
    return fitNodeSize(candidateSize.width, candidateSize.height, baseWidth, baseHeight);
}

export function fitVideoNodeSize(width: number | undefined, height: number | undefined, requestedSize: string | undefined, fallbackWidth: number = VIDEO_NODE_MAX_SIZE.width, fallbackHeight: number = VIDEO_NODE_MAX_SIZE.height) {
    const hasNaturalSize = Boolean(width && width > 0 && height && height > 0);
    const requested = !hasNaturalSize ? nodeSizeFromRatio(requestedSize || "", fallbackWidth, fallbackHeight) : null;
    const sourceWidth = hasNaturalSize ? width! : requested?.width || fallbackWidth;
    const sourceHeight = hasNaturalSize ? height! : requested?.height || fallbackHeight;
    // Flow2API 返回的内嵌视频可能没有可读的宽高，缺少元数据时必须使用请求画幅，不能继承旧节点比例。
    return fitNodeSize(sourceWidth, sourceHeight, fallbackWidth, fallbackHeight);
}

export function ensureMediaNodeMinimumSize(node: CanvasNodeData) {
    if (node.type !== CanvasNodeType.Image && node.type !== CanvasNodeType.Video) return node;
    let width = node.width;
    let height = node.height;
    const naturalWidth = node.metadata?.naturalWidth || 0;
    const naturalHeight = node.metadata?.naturalHeight || 0;
    const requestedSize = node.type === CanvasNodeType.Image && node.metadata?.generationType === "edit"
        ? nodeSizeFromRatio(node.metadata.size || "auto", node.width, node.height)
        : node.type === CanvasNodeType.Video
            ? nodeSizeFromRatio(node.metadata?.size || "auto", node.width, node.height)
            : null;
    const naturalRatio = naturalWidth / Math.max(1, naturalHeight);
    const nodeRatio = node.width / Math.max(1, node.height);
    const requestedRatio = requestedSize ? requestedSize.width / Math.max(1, requestedSize.height) : nodeRatio;
    const targetRatio = naturalWidth > 0 && naturalHeight > 0 ? naturalRatio : requestedRatio;
    // 生成结果缺少媒体尺寸时按请求画幅修正；已有自然尺寸时优先保留真实媒体比例。
    if (requestedSize && !node.metadata?.freeResize && !node.metadata?.locked && (node.type === CanvasNodeType.Video || (naturalWidth > 0 && naturalHeight > 0)) && Math.abs(targetRatio - nodeRatio) > 0.01) {
        const alignedSize = naturalWidth > 0 && naturalHeight > 0
            ? fitNodeSize(naturalWidth, naturalHeight, requestedSize.width, requestedSize.height)
            : requestedSize;
        width = alignedSize.width;
        height = alignedSize.height;
    }
    if (width < MEDIA_NODE_MIN_SIZE.width || height < MEDIA_NODE_MIN_SIZE.height) {
        const scale = Math.max(1, MEDIA_NODE_MIN_SIZE.width / Math.max(1, width), MEDIA_NODE_MIN_SIZE.height / Math.max(1, height));
        width *= scale;
        height *= scale;
    }
    if (width === node.width && height === node.height) return node;
    return {
        ...node,
        position: {
            x: node.position.x + node.width / 2 - width / 2,
            y: node.position.y + node.height / 2 - height / 2,
        },
        width,
        height,
    };
}
