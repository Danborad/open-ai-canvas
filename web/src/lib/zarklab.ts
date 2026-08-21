import { modelOptionName, resolveModelRequestConfig, type AiConfig } from "@/stores/use-config-store";

export const ZARK_IMAGE_MODELS = [
    { value: "auto", label: "auto", description: "默认推荐，系统自动智能选择" },
    { value: "GPT Image 2", label: "GPT Image 2", description: "构图精细、文字排版、Prompt 遵循度最高（默认）" },
    { value: "Seedream 5 Pro", label: "Seedream 5 Pro", description: "即梦 5 专业高清版，色彩质感丰富" },
    { value: "Seedream 5 Lite", label: "Seedream 5 Lite", description: "即梦 5 极速版，出图迅速" },
    { value: "Kling Image O3", label: "Kling Image O3", description: "可灵 O3 生图，人物、光影与概念设计优秀" },
    { value: "Nano Banana Pro", label: "Nano Banana Pro", description: "Google 图像专业版，写实摄影质感" },
    { value: "Nano Banana 2", label: "Nano Banana 2", description: "Google 2.0 全模态图像" },
    { value: "Nano Banana 2 Lite", label: "Nano Banana 2 Lite", description: "独家支持 Banner 横幅与超高长条" },
    { value: "Nano Banana Lite", label: "Nano Banana Lite", description: "Google 轻量版，支持极宽极窄画幅" },
    { value: "Grok Image", label: "Grok Image", description: "xAI 图像大模型，独家支持 4:3 与 3:4 复古构图" },
];

export const ZARK_VIDEO_MODELS = [
    { value: "auto", label: "auto", description: "默认推荐，系统自动智能选择" },
    { value: "Gemini Omni Flash", label: "Gemini Omni Flash", description: "极速秒级出片，3s~10s" },
    { value: "Seedance 2.5", label: "Seedance 2.5", description: "全站最长连续动态（最高支持 30 秒）" },
    { value: "Seedance 2", label: "Seedance 2", description: "全画质档位，支持原生 4K 渲染" },
    { value: "Seedance 2 Lite", label: "Seedance 2 Lite", description: "极速轻量视频，4s~15s" },
    { value: "Seedance 2 Mini", label: "Seedance 2 Mini", description: "低消耗快速出片，4s~15s" },
    { value: "Kling O3 4K", label: "Kling O3 4K", description: "可灵 O3 原生 4K 超清画质" },
    { value: "Kling O3 Pro", label: "Kling O3 Pro", description: "可灵 O3 专业版，肢体运动更稳定" },
    { value: "Kling 3.0 Turbo", label: "Kling 3.0 Turbo", description: "可灵 3.0 极速加速版" },
    { value: "Kling 3.0 Lite", label: "Kling 3.0 Lite", description: "可灵 3.0 轻量版" },
    { value: "Veo 3.1", label: "Veo 3.1", description: "Google 电影级写实渲染，4s/6s/8s" },
    { value: "Veo 3.1 Fast", label: "Veo 3.1 Fast", description: "Veo 3.1 快速生成版，4s/6s/8s" },
    { value: "Veo 3.1 Lite", label: "Veo 3.1 Lite", description: "Veo 3.1 轻量版，4s/6s/8s" },
    { value: "Grok Video", label: "Grok Video", description: "xAI 视频大模型，4s~10s" },
    { value: "MiniMax H3", label: "MiniMax H3", description: "独家提供 768P/2K/4K 画质档位，5s~15s" },
    { value: "Happy Horse", label: "Happy Horse", description: "全站比例最全（含 9:21 超长竖屏），强写实动态与音画同步" },
];

export function isZarkLabImageConfig(config: AiConfig) {
    const model = config.model || config.imageModel || "";
    return resolveModelRequestConfig(config, model).interfaceType === "zarklab-image";
}

export function isZarkLabVideoConfig(config: AiConfig) {
    const model = config.model || config.videoModel || "";
    return resolveModelRequestConfig(config, model).interfaceType === "zarklab-video";
}

export function normalizeZarkLabAspectRatio(value?: string, mediaKind: "image" | "video" = "image") {
    const raw = String(value || "")
        .trim()
        .toLowerCase();
    const supported = ["1:1", "4:5", "2:3", "3:2", "9:16", "16:9", "4:3", "3:4", "21:9", "5:4", "9:21", "4:1", "1:4", "8:1", "1:8"];
    if (supported.includes(raw)) return raw;
    if (raw === "auto") return "1:1";
    return mediaKind === "video" ? "16:9" : "1:1";
}

export function extractZarkFileId(item: { url?: string } | string | undefined): string {
    const raw = typeof item === "string" ? item.trim() : item?.url?.trim() || "";
    if (raw.startsWith("file-") || raw.startsWith("zark-")) return raw;
    if (raw.startsWith("asset://file-")) return raw.replace(/^asset:\/\//, "");
    return "";
}

export function parseZarkEventStreamFileIds(data: string): string[] {
    const fileIds: string[] = [];
    const seen = new Set<string>();
    const lines = data.split("\n");
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
            const ev = JSON.parse(payload) as {
                type?: string;
                file_id?: string;
                status?: string;
                generated_file_ids?: string[];
                error?: unknown;
                message?: string;
            };
            if (ev.type === "error") {
                const msg = typeof ev.error === "string" ? ev.error : ev.message || JSON.stringify(ev.error);
                throw new Error(msg || "ZarkLab 生成出错");
            }
            if (ev.type === "agent_run_complete" && ev.status === "failed") {
                throw new Error(ev.message || "ZarkLab 任务执行失败");
            }
            if (ev.type === "generation_complete" && ev.file_id?.trim()) {
                const fid = ev.file_id.trim();
                if (!seen.has(fid)) {
                    seen.add(fid);
                    fileIds.push(fid);
                }
            }
            if (Array.isArray(ev.generated_file_ids)) {
                for (const fid of ev.generated_file_ids) {
                    const cleaned = String(fid || "").trim();
                    if (cleaned && !seen.has(cleaned)) {
                        seen.add(cleaned);
                        fileIds.push(cleaned);
                    }
                }
            }
        } catch (e) {
            if (e instanceof Error && (e.message.includes("ZarkLab") || e.message.includes("失败") || e.message.includes("出错"))) {
                throw e;
            }
        }
    }
    return fileIds;
}
