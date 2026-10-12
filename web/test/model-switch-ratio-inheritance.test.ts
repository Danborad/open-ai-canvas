import { describe, expect, test } from "bun:test";
import { defaultImageCapabilityConfig, defaultModelCapabilityConfig } from "@/lib/model-capabilities";
import { defaultImageParamsForModel, defaultVideoParamsForModel } from "@/lib/model-selection";
import { isolateCopiedNodeMetadata } from "@/lib/canvas/canvas-node-copy";
import { buildNodeConfig } from "@/components/canvas/canvas-node-prompt-config";
import { defaultConfig, type AiConfig } from "@/stores/use-config-store";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

function buildMultiModelTestConfig(): AiConfig {
    return {
        ...defaultConfig,
        channels: [
            {
                id: "ch-1",
                scope: "system",
                enabled: true,
                name: "综合渠道",
                baseUrl: "/api/ai/system/ch-1",
                apiFormat: "openai",
                concurrencyLimit: 0,
                models: [
                    "gpt-image-2",
                    "doubao-seedream-5-0-pro-260628",
                    "grok-imagine-image",
                    "gemini-image-pro",
                    "wan3.0-video",
                    "sora-video",
                ],
                modelCosts: [
                    {
                        model: "gpt-image-2",
                        capability: "image",
                        protocol: "openai-image",
                        priceConfigured: true,
                        capabilityConfig: defaultModelCapabilityConfig("openai-image", "gpt-image-2"),
                    },
                    {
                        model: "doubao-seedream-5-0-pro-260628",
                        capability: "image",
                        protocol: "km-kemei-seedream",
                        priceConfigured: true,
                        capabilityConfig: defaultModelCapabilityConfig("km-kemei-seedream", "doubao-seedream-5-0-pro-260628"),
                    },
                    {
                        model: "grok-imagine-image",
                        capability: "image",
                        protocol: "grok-image",
                        priceConfigured: true,
                        capabilityConfig: defaultModelCapabilityConfig("grok-image", "grok-imagine-image"),
                    },
                    {
                        model: "gemini-image-pro",
                        capability: "image",
                        protocol: "gemini-image",
                        priceConfigured: true,
                        capabilityConfig: defaultModelCapabilityConfig("gemini-image", "gemini-image-pro"),
                    },
                    {
                        model: "wan3.0-video",
                        capability: "video",
                        protocol: "km-kemei-wan3-video",
                        priceConfigured: true,
                        capabilityConfig: defaultModelCapabilityConfig("km-kemei-wan3-video", "wan3.0-video"),
                    },
                    {
                        model: "sora-video",
                        capability: "video",
                        protocol: "openai-video",
                        priceConfigured: true,
                        capabilityConfig: defaultModelCapabilityConfig("openai-video", "sora-video"),
                    },
                ],
                hasApiKey: true,
                hasSecretKey: false,
                createdAt: "",
                updatedAt: "",
            },
        ],
    } as unknown as AiConfig;
}

describe("切换模型与创建生成副本时的画幅/分辨率参数智能继承", () => {
    test("1. 从 16:9 比例切换模型时：比例模型、通用像素模型、Seedream 均继承 16:9，不会重置回 1:1", () => {
        const config = { ...buildMultiModelTestConfig(), size: "16:9", quality: "2k" };

        // 切到 Grok（比例模型）：继承 16:9 和 2K
        const toGrok = defaultImageParamsForModel(config, "grok-imagine-image");
        expect(toGrok.size).toBe("16:9");
        expect(toGrok.quality).toBe("2k");

        // 切到 Gemini（比例模型）：继承 16:9
        const toGemini = defaultImageParamsForModel(config, "gemini-image-pro");
        expect(toGemini.size).toBe("16:9");

        // 切到 Seedream 5.0 Pro（官方像素预设模型）：继承 16:9 2K (2816x1584)，不回退到 2048x2048 (1:1)
        const toSeedream = defaultImageParamsForModel(config, "doubao-seedream-5-0-pro-260628");
        expect(toSeedream.size).toBe("2816x1584");

        // 切到 GPT-Image-2：继承 16:9
        const toGpt = defaultImageParamsForModel(config, "gpt-image-2");
        expect(toGpt.size).toBe("16:9");
    });

    test("2. 从具体像素尺寸（如 2560x1440 / 2816x1584 16:9 2K）切换模型时，跨协议自动对齐为目标模型的 16:9", () => {
        const base = buildMultiModelTestConfig();

        // 从通用 16:9 2K (2560x1440) 切到 Seedream 5.0 Pro -> 自动匹配 Seedream 的 16:9 2K (2816x1584)
        const fromGenericToSeedream = defaultImageParamsForModel({ ...base, size: "2560x1440" }, "doubao-seedream-5-0-pro-260628");
        expect(fromGenericToSeedream.size).toBe("2816x1584");

        // 从 Seedream 16:9 2K (2816x1584) 切到 Grok（比例模型） -> 自动匹配 Grok 的 16:9 与 2k
        const fromSeedreamToGrok = defaultImageParamsForModel({ ...base, size: "2816x1584" }, "grok-imagine-image");
        expect(fromSeedreamToGrok.size).toBe("16:9");
        expect(fromSeedreamToGrok.quality).toBe("2k");

        // 从 Seedream 16:9 1.5K (2048x1152) 切到 GPT-Image-2 -> 自动匹配 16:9 2K (2752x1536)
        const fromSeedream15kToGpt = defaultImageParamsForModel({ ...base, size: "2048x1152" }, "gpt-image-2");
        expect(["2752x1536", "2560x1440", "1824x1024", "16:9"]).toContain(fromSeedream15kToGpt.size);
    });

    test("3. 当目标模型确实不支持当前比例时，优雅回退至目标模型默认尺寸", () => {
        const base = buildMultiModelTestConfig();
        // Grok 不支持 21:9，从 21:9 切到 Grok 应回退到 Grok 默认的 1:1
        const toGrok = defaultImageParamsForModel({ ...base, size: "21:9" }, "grok-imagine-image");
        expect(toGrok.size).toBe("1:1");
    });

    test("4. 画布生成副本：继承原节点的比例或从原图真实宽高推导 16:9，且在副本上换模型继续保持 16:9", () => {
        const config = buildMultiModelTestConfig();
        const sourceNode: CanvasNodeData = {
            id: "img-source-1",
            type: CanvasNodeType.Image,
            title: "原图节点",
            position: { x: 100, y: 100 },
            width: 640,
            height: 360,
            metadata: {
                content: "https://example.com/16x9.png",
                naturalWidth: 1920,
                naturalHeight: 1080,
                status: "success",
            },
        };

        const copiedMeta = isolateCopiedNodeMetadata(sourceNode, new Map([["img-source-1", "img-copy-1"]]));
        expect(copiedMeta.size).toBe("16:9");

        const copiedNode: CanvasNodeData = {
            ...sourceNode,
            id: "img-copy-1",
            metadata: copiedMeta,
        };

        const nodeConfig = buildNodeConfig(config, copiedNode, "image", { capability: "image" });
        expect(nodeConfig.size).toBe("16:9");

        // 在副本上切换到 Seedream 5.0 Pro，依然保持 16:9（不会变成 1:1）
        const switched = defaultImageParamsForModel(nodeConfig, "doubao-seedream-5-0-pro-260628");
        expect(["1424x800", "2048x1152", "2816x1584"]).toContain(switched.size);
    });

    test("5. 视频模型切换时同样继承画幅比例（如 9:16 / 16:9）与分辨率", () => {
        const config = { ...buildMultiModelTestConfig(), size: "9:16", vquality: "1080p", videoSeconds: "5" };
        const videoSwitched = defaultVideoParamsForModel(config, "wan3.0-video");
        expect(videoSwitched.size).toBe("9:16");
        expect(videoSwitched.vquality.toLowerCase()).toBe("1080p");
        expect(videoSwitched.seconds).toBe("5");
    });
});
