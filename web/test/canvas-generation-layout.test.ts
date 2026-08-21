import { describe, expect, test } from "bun:test";

import { canGenerateImageInPlace, findAvailableGenerationGroupPosition, imageGenerationGroupSize } from "../src/lib/canvas/canvas-generation-layout";
import { fitVideoNodeSize } from "../src/lib/canvas/canvas-node-size";
import { modelCapabilityConfigFor } from "../src/lib/model-capabilities";
import { shouldOverwriteGeneratedVideoVariant } from "../src/lib/canvas/canvas-media-versions";
import { getNodePanelPosition } from "../src/components/canvas/canvas-workspace-overlays";
import { remapSerializedCanvasReferences } from "../src/lib/canvas/canvas-node-copy";
import { normalizeVideoValue } from "../src/lib/model-capabilities";
import { CanvasNodeType, type CanvasNodeData } from "../src/types/canvas";

function node(id: string, x: number, y: number, width = 340, height = 240): CanvasNodeData {
    return { id, type: CanvasNodeType.Image, title: id, position: { x, y }, width, height };
}

describe("findAvailableGenerationGroupPosition", () => {
    test("首选位置没有占用时保持原坐标", () => {
        expect(findAvailableGenerationGroupPosition([node("source", 0, 0)], { x: 436, y: 0 }, { width: 340, height: 240 })).toEqual({ x: 436, y: 0 });
    });

    test("右侧已有节点时选择距离更短的下方空位", () => {
        expect(findAvailableGenerationGroupPosition([node("occupied", 436, 0)], { x: 436, y: 0 }, { width: 340, height: 240 })).toEqual({ x: 436, y: 276 });
    });

    test("纵向大节点遮挡时改为向右避让", () => {
        expect(findAvailableGenerationGroupPosition([node("occupied", 436, 0, 340, 900)], { x: 436, y: 0 }, { width: 340, height: 240 })).toEqual({ x: 812, y: 0 });
    });

    test("按完整批次范围检测碰撞", () => {
        const groupSize = imageGenerationGroupSize({ width: 340, height: 240 }, { width: 340, height: 240 }, 4);
        expect(groupSize).toEqual({ width: 1176, height: 516 });
        expect(findAvailableGenerationGroupPosition([node("child-area", 900, 0)], { x: 436, y: 0 }, groupSize)).toEqual({ x: 436, y: 276 });
    });
});

describe("canGenerateImageInPlace", () => {
    test("只有空图片节点复用原节点", () => {
        expect(canGenerateImageInPlace(node("empty", 0, 0))).toBe(true);
        expect(canGenerateImageInPlace({ ...node("result", 0, 0), metadata: { content: "image-url" } })).toBe(false);
        expect(canGenerateImageInPlace({ ...node("text", 0, 0), type: CanvasNodeType.Text })).toBe(false);
    });
});

describe("fitVideoNodeSize", () => {
    test("媒体尺寸缺失时使用任务画幅而不是旧节点比例", () => {
        expect(fitVideoNodeSize(undefined, undefined, "16:9", 480, 480)).toEqual({ width: 480, height: 270 });
        expect(fitVideoNodeSize(undefined, undefined, "9:16", 480, 480)).toEqual({ width: 300, height: 533.3333333333334 });
    });

    test("有真实媒体尺寸时优先保留视频实际比例", () => {
        expect(fitVideoNodeSize(1920, 1080, "9:16", 480, 480)).toEqual({ width: 480, height: 270 });
    });
});

describe("Grok2API New capability", () => {
    test("渠道级新版协议保留完整图片和视频能力", () => {
        const image = modelCapabilityConfigFor({ channels: [{ id: "grok-new", interfaceType: "grok2api-new-image", models: ["Web/grok-imagine-image-quality-2.0"] }] }, "grok-new::Web/grok-imagine-image-quality-2.0").image!;
        expect(image.maxOutputs).toBe(10);
        expect(image.size.values).toContain("19.5:9");

        const video = modelCapabilityConfigFor({ channels: [{ id: "grok-new", interfaceType: "grok2api-new-video", models: ["Console/grok-imagine-video-1.5"] }] }, "grok-new::Console/grok-imagine-video-1.5").video!;
        expect(video.references.maxImages).toBe(7);
        expect(video.resolutions).toContain("1080p");
    });
});

describe("视频参数变体复用", () => {
    test("B/C 等参数变体再次生成时覆盖当前节点", () => {
        expect(shouldOverwriteGeneratedVideoVariant({ id: "a", type: CanvasNodeType.Video, title: "A", position: { x: 0, y: 0 }, width: 480, height: 270, metadata: { versionLabel: "A" } })).toBe(false);
        expect(shouldOverwriteGeneratedVideoVariant({ id: "b", type: CanvasNodeType.Video, title: "B", position: { x: 0, y: 0 }, width: 480, height: 270, metadata: { versionOfNodeId: "a", versionLabel: "B", versionPrimary: false } })).toBe(true);
        expect(shouldOverwriteGeneratedVideoVariant({ id: "c", type: CanvasNodeType.Video, title: "C", position: { x: 0, y: 0 }, width: 480, height: 270, metadata: { versionOfNodeId: "a", versionLabel: "C", versionPrimary: true } })).toBe(true);
    });
});

describe("画布输入框定位", () => {
    test("节点放大到顶部时遵守顶部工具栏安全边界", () => {
        const position = getNodePanelPosition({ id: "video", type: CanvasNodeType.Video, title: "video", position: { x: 160, y: -420 }, width: 480, height: 270 }, { x: 0, y: 0, k: 2 }, { width: 900, height: 700 }, 624, 420, 96);
        expect(position.top).toBe(96);
    });

    test("节点底部空间不足时仍保持在节点下方", () => {
        const position = getNodePanelPosition({ id: "video", type: CanvasNodeType.Video, title: "video", position: { x: 160, y: 260 }, width: 480, height: 270 }, { x: 0, y: 0, k: 1 }, { width: 900, height: 700 }, 624, 420, 96);
        expect(position.top).toBe(540);
    });
});

describe("参数变体引用复制", () => {
    test("复制节点时保留外部引用并改写被复制节点引用", () => {
        const idMap = new Map([["source-image", "copied-image"]]);
        expect(remapSerializedCanvasReferences("镜头 @[node:source-image]，参考 @[node:external-image]", idMap)).toBe("镜头 @[node:copied-image]，参考 @[node:external-image]");
    });
});

describe("Seedance 视频时长能力", () => {
    test("使用渠道配置的最短时长并保留当前 5 秒值", () => {
        const profile = {
            duration: { selection: "range" as const, min: 4, max: 15, step: 1, default: 6 },
            ratios: ["16:9"],
            defaultRatio: "16:9",
            resolutions: ["720p"],
            defaultResolution: "720p",
            references: { promptMaxChars: 1000, maxImages: 9, maxImageBytes: 0, maxVideos: 0, maxVideoBytes: 0, maxVideoDurationSeconds: 0, maxAudios: 0, maxAudioBytes: 0, maxAudioDurationSeconds: 0 },
            generateAudio: { supported: false, default: false },
            watermark: { supported: false, default: false },
            operations: ["text_to_video" as const],
            defaultOperation: "text_to_video" as const,
        };
        expect(normalizeVideoValue(profile, { seconds: "1", ratio: "16:9", resolution: "720p" }).seconds).toBe("4");
        expect(normalizeVideoValue(profile, { seconds: "5", ratio: "16:9", resolution: "720p" }).seconds).toBe("5");
    });

    test("新版 Grok2API 使用后台保存的分辨率列表", () => {
        const config = {
            channels: [
                {
                    id: "grok-new",
                    interfaceType: "grok2api-new-video" as const,
                    models: ["Web/grok-imagine-video"],
                    modelCosts: [
                        {
                            model: "Web/grok-imagine-video",
                            capability: "video" as const,
                            protocol: "grok2api-new-video" as const,
                            billingMode: "fixed_request" as const,
                            unitPriceMicrocredits: 1,
                            capabilityConfig: {
                                version: 1,
                                video: {
                                    duration: { selection: "enum" as const, values: [6, 10, 15], default: 6 },
                                    ratios: ["16:9"],
                                    defaultRatio: "16:9",
                                    resolutions: ["480p", "720p"],
                                    defaultResolution: "720p",
                                },
                            },
                        },
                    ],
                },
            ],
        };
        const video = modelCapabilityConfigFor(config, "grok-new::Web/grok-imagine-video").video!;
        expect(video.duration.selection).toBe("enum");
        expect(video.duration.values).toEqual([6, 10, 15]);
        expect(video.resolutions).toEqual(["480p", "720p"]);
        expect(normalizeVideoValue(video, { seconds: "7", ratio: "16:9", resolution: "1080p" })).toEqual({ seconds: "6", ratio: "16:9", resolution: "720p" });
    });

    test("ZarkLab 图片与视频默认能力与比例", () => {
        const image = modelCapabilityConfigFor({ channels: [{ id: "zark", interfaceType: "zarklab-image" as const, models: ["GPT Image 2"] }] }, "zark::GPT Image 2").image!;
        expect(image.maxOutputs).toBe(10);
        expect(image.size.values).toEqual(["1:1", "4:5", "2:3", "3:2", "9:16", "16:9"]);

        const video = modelCapabilityConfigFor({ channels: [{ id: "zark", interfaceType: "zarklab-video" as const, models: ["Happy Horse"] }] }, "zark::Happy Horse").video!;
        expect(video.duration.min).toBe(3);
        expect(video.generateAudio.supported).toBe(true);
        expect(video.ratios).toEqual(["16:9", "21:9", "4:3", "1:1", "3:4", "4:5", "5:4", "9:16", "9:21"]);
    });
});
