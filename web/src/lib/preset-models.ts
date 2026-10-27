import { useEffect, useState, useSyncExternalStore } from "react";
import bundledData from "./preset-models-data.json";

export interface PresetModel {
    id: string;
    name: string;
    provider?: string;
    contextLimit?: number;
    outputLimit?: number;
    modalities?: {
        input?: string[];
        output?: string[];
    };
    cost?: {
        input?: number;
        output?: number;
        cacheRead?: number;
        cacheWrite?: number;
    };
    attachment?: boolean;
    reasoning?: boolean;
    tool_call?: boolean;
    temperature?: boolean;
    variants?: Record<string, unknown>;
    options?: Record<string, unknown>;
    description?: string;
}

export const PRESET_MODELS_REMOTE_URLS = [
    "https://raw.githubusercontent.com/coulsontl/ai-toolbox/main/tauri/resources/preset_models.json",
    "https://fastly.jsdelivr.net/gh/coulsontl/ai-toolbox@main/tauri/resources/preset_models.json",
    "https://cdn.jsdelivr.net/gh/coulsontl/ai-toolbox@main/tauri/resources/preset_models.json",
] as const;

const STORAGE_KEY = "yingce:preset_models";
const SYNCED_AT_KEY = "yingce:preset_models_synced_at";

export const BUNDLED_PRESET_MODELS: PresetModel[] = bundledData as PresetModel[];

let inMemoryModels: PresetModel[] = (() => {
    try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch {
        // ignore parse error
    }
    return BUNDLED_PRESET_MODELS;
})();

let presetVersion = 0;
const listeners = new Set<() => void>();

export function getPresetModels(): PresetModel[] {
    return inMemoryModels;
}

export function getPresetModelsVersion(): number {
    return presetVersion;
}

export function getLastSyncedAt(): string | null {
    try {
        return localStorage.getItem(SYNCED_AT_KEY);
    } catch {
        return null;
    }
}

export function subscribePresetModels(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function notifyUpdated() {
    presetVersion += 1;
    listeners.forEach((fn) => fn());
}

/**
 * Normalizes remote dictionary into flattened PresetModel array with provider names.
 */
function normalizeRemoteJson(raw: Record<string, PresetModel[]>): PresetModel[] {
    const list: PresetModel[] = [];
    for (const [providerKey, group] of Object.entries(raw)) {
        if (!Array.isArray(group)) continue;
        const provider = providerKey.replace("@ai-sdk/", "");
        for (const item of group) {
            if (item && item.id && item.name) {
                list.push({
                    ...item,
                    provider: item.provider || provider,
                });
            }
        }
    }

    // Merge classic models if not in remote list
    const existingIds = new Set(list.map((m) => m.id.toLowerCase()));
    for (const bundled of BUNDLED_PRESET_MODELS) {
        if (!existingIds.has(bundled.id.toLowerCase())) {
            list.push(bundled);
            existingIds.add(bundled.id.toLowerCase());
        }
    }

    return list;
}

/**
 * Fetch remote preset models from GitHub raw or fast CDN fallback.
 */
export async function syncRemotePresetModels(): Promise<{ count: number; syncedAt: string }> {
    let lastError: Error | null = null;
    let fetchedData: Record<string, PresetModel[]> | null = null;

    for (const url of PRESET_MODELS_REMOTE_URLS) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const resp = await fetch(url, {
                signal: controller.signal,
                cache: "no-cache",
            });
            clearTimeout(timeoutId);
            if (!resp.ok) {
                throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
            }
            const json = await resp.json();
            if (json && typeof json === "object" && Object.keys(json).length > 0) {
                fetchedData = json;
                break;
            }
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
        }
    }

    if (!fetchedData) {
        throw new Error(`无法从远程同步预设模型库：${lastError?.message || "网络请求超时"}`);
    }

    const normalized = normalizeRemoteJson(fetchedData);
    if (!normalized.length) {
        throw new Error("远程预设模型数据为空");
    }

    inMemoryModels = normalized;
    const syncedAt = new Date().toISOString();
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        localStorage.setItem(SYNCED_AT_KEY, syncedAt);
    } catch {
        // quota exceeded or storage disabled
    }

    notifyUpdated();
    return { count: normalized.length, syncedAt };
}

/**
 * Formats token count (e.g., 1048576 -> 1M, 128000 -> 128k, 8192 -> 8k).
 */
export function formatTokenLimit(tokens?: number): string {
    if (!tokens || tokens <= 0) return "—";
    if (tokens >= 1_000_000) {
        const m = tokens / 1_000_000;
        return `${Number(m.toFixed(2))}M`;
    }
    if (tokens >= 1_000) {
        const k = tokens / 1_000;
        return `${Number(k.toFixed(1))}k`;
    }
    return String(tokens);
}

export type PresetBrand =
    | "All"
    | "DeepSeek"
    | "Qwen"
    | "GLM"
    | "Kimi"
    | "Step"
    | "MiniMax"
    | "Gemini"
    | "Claude"
    | "OpenAI"
    | "Grok"
    | "Other";

export function getPresetBrand(model: PresetModel): PresetBrand {
    const id = model.id.toLowerCase();
    const name = model.name.toLowerCase();
    if (id.includes("deepseek") || name.includes("deepseek")) return "DeepSeek";
    if (id.includes("qwen") || name.includes("qwen") || name.includes("通义")) return "Qwen";
    if (id.includes("glm") || name.includes("glm") || name.includes("智谱")) return "GLM";
    if (id.includes("kimi") || name.includes("kimi") || name.includes("moonshot")) return "Kimi";
    if (id.includes("step") || name.includes("step") || name.includes("阶跃")) return "Step";
    if (id.includes("minimax") || name.includes("minimax") || name.includes("海螺")) return "MiniMax";
    if (id.includes("gemini") || name.includes("gemini") || id.includes("google")) return "Gemini";
    if (id.includes("claude") || name.includes("claude") || id.includes("anthropic")) return "Claude";
    if (id.includes("gpt") || name.includes("gpt") || id.startsWith("o1") || id.startsWith("o3") || id.includes("openai")) return "OpenAI";
    if (id.includes("grok") || name.includes("grok") || id.includes("xai")) return "Grok";
    return "Other";
}

export const PRESET_BRAND_LABELS: Record<PresetBrand, string> = {
    All: "全部",
    DeepSeek: "DeepSeek",
    Qwen: "通义千问",
    GLM: "智谱清言",
    Kimi: "月之暗面",
    MiniMax: "MiniMax",
    Step: "阶跃星辰",
    Gemini: "谷歌 Gemini",
    Claude: "Claude",
    OpenAI: "OpenAI GPT",
    Grok: "xAI Grok",
    Other: "其它",
};

/**
 * Searches and finds matching preset model by ID or name.
 */
export function findPresetModel(query: string, models: PresetModel[] = inMemoryModels): PresetModel | undefined {
    const raw = query.trim().toLowerCase();
    if (!raw) return undefined;

    // Strip common model prefixes
    const clean = raw
        .replace(/^models\//, "")
        .replace(/^openai\//, "")
        .replace(/^anthropic\//, "")
        .replace(/^google\//, "");

    // 1. Exact ID match
    const exactId = models.find((m) => m.id.toLowerCase() === raw || m.id.toLowerCase() === clean);
    if (exactId) return exactId;

    // 2. Exact Name match
    const exactName = models.find((m) => m.name.toLowerCase() === raw || m.name.toLowerCase() === clean);
    if (exactName) return exactName;

    // 3. Substring match (either id contains clean or clean contains id)
    const sub = models.find((m) => {
        const mid = m.id.toLowerCase();
        return (clean.length >= 4 && mid.includes(clean)) || (mid.length >= 4 && clean.includes(mid));
    });
    if (sub) return sub;

    return undefined;
}

/**
 * React hook to access and sync preset models.
 */
export function usePresetModels() {
    const version = useSyncExternalStore(subscribePresetModels, getPresetModelsVersion, getPresetModelsVersion);
    const [models, setModels] = useState<PresetModel[]>(getPresetModels());
    const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(getLastSyncedAt());
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        setModels(getPresetModels());
        setLastSyncedAt(getLastSyncedAt());
    }, [version]);

    const sync = async () => {
        setSyncing(true);
        try {
            const res = await syncRemotePresetModels();
            setLastSyncedAt(res.syncedAt);
            return res.count;
        } finally {
            setSyncing(false);
        }
    };

    return {
        models,
        lastSyncedAt,
        syncing,
        sync,
        version,
    };
}
