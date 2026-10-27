import { useMemo, useState } from "react";
import { App, Button, Input, Modal, Tag, Tooltip } from "antd";
import {
    Boxes,
    Brain,
    Check,
    Cpu,
    ExternalLink,
    Eye,
    Film,
    FileText,
    Mic,
    RefreshCw,
    Search,
    Sparkles,
    Wand2,
    Wrench,
    X,
} from "lucide-react";
import {
    findPresetModel,
    formatTokenLimit,
    getPresetBrand,
    PRESET_BRAND_LABELS,
    usePresetModels,
    type PresetBrand,
    type PresetModel,
} from "@/lib/preset-models";
import { cn } from "@/lib/utils";

export interface PresetModelSelectorProps {
    /** 当前输入的模型标识或上游模型ID，用于智能推荐匹配 */
    currentModelId?: string;
    /** 当前模型能力，默认 text */
    capability?: string;
    /** 选中预设后的回调函数 */
    onSelectPreset: (preset: PresetModel) => void;
    /** 自定义类名 */
    className?: string;
    /** 模式：bar 嵌入条，button 仅按钮 */
    variant?: "bar" | "button";
}

export function PresetModelSelector({
    currentModelId = "",
    capability = "text",
    onSelectPreset,
    className,
    variant = "bar",
}: PresetModelSelectorProps) {
    const { message } = App.useApp();
    const { models, lastSyncedAt, syncing, sync } = usePresetModels();
    const [modalOpen, setModalOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedBrand, setSelectedBrand] = useState<PresetBrand>("All");
    const [featureFilter, setFeatureFilter] = useState<"all" | "reasoning" | "tools" | "vision" | "long_ctx">("all");

    // Smart match candidate based on currentModelId
    const matchedPreset = useMemo(() => {
        if (!currentModelId?.trim()) return undefined;
        return findPresetModel(currentModelId, models);
    }, [currentModelId, models]);

    // Filter models
    const filteredModels = useMemo(() => {
        const query = search.trim().toLowerCase();
        return models.filter((item) => {
            // Brand filter
            if (selectedBrand !== "All") {
                if (getPresetBrand(item) !== selectedBrand) return false;
            }

            // Feature filter
            if (featureFilter === "reasoning" && !item.reasoning) return false;
            if (featureFilter === "tools" && !item.tool_call) return false;
            if (featureFilter === "vision" && !item.modalities?.input?.includes("image")) return false;
            if (featureFilter === "long_ctx" && (item.contextLimit || 0) < 1_000_000) return false;

            // Search query
            if (query) {
                const id = item.id.toLowerCase();
                const name = item.name.toLowerCase();
                const provider = (item.provider || "").toLowerCase();
                return id.includes(query) || name.includes(query) || provider.includes(query);
            }

            return true;
        });
    }, [models, search, selectedBrand, featureFilter]);

    const handleSync = async () => {
        try {
            const count = await sync();
            message.success(`成功从远程同步 ${count} 个最新预设模型（coulsontl/ai-toolbox）`);
        } catch (err) {
            message.error(err instanceof Error ? err.message : "同步预设模型失败");
        }
    };

    const handleSelect = (preset: PresetModel) => {
        onSelectPreset(preset);
        setModalOpen(false);
    };

    const formattedSyncTime = useMemo(() => {
        if (!lastSyncedAt) return "内置预设版本";
        try {
            const date = new Date(lastSyncedAt);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
        } catch {
            return lastSyncedAt;
        }
    }, [lastSyncedAt]);

    const modalContent = (
        <Modal
            open={modalOpen}
            onCancel={() => setModalOpen(false)}
            footer={null}
            width={920}
            centered
            destroyOnClose
            title={
                <div className="flex flex-wrap items-center justify-between gap-3 pr-6 pb-2 border-b border-[var(--border)]">
                    <div className="flex items-center gap-2.5">
                        <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                            <Sparkles className="size-4" />
                        </span>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-base font-semibold text-foreground">预设模型库</span>
                                <Tag color="blue" className="!mr-0 !px-1.5 !text-[11px] !border-none !bg-primary/10 !text-primary">
                                    共 {models.length} 款模型
                                </Tag>
                            </div>
                            <p className="text-xs text-muted-foreground font-normal mt-0.5">
                                参考 coulsontl/ai-toolbox · 一键填充模型名称、上下文窗口、输出限制与多模态能力参数（上游模型 ID 与调用协议保持不变）
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Tooltip title={`上次同步时间：${formattedSyncTime}（点击同步 GitHub raw/CDN 最新参数）`}>
                            <Button
                                size="small"
                                icon={<RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />}
                                loading={syncing}
                                onClick={() => void handleSync()}
                            >
                                {syncing ? "同步中..." : "同步预设"}
                            </Button>
                        </Tooltip>
                    </div>
                </div>
            }
            styles={{ body: { padding: "16px 4px 4px 4px", maxHeight: "72vh", overflowY: "auto" } }}
        >
            <div className="space-y-3 px-2">
                {/* Search & Capabilities */}
                <div className="flex flex-col sm:flex-row gap-2.5">
                    <Input
                        prefix={<Search className="size-4 text-muted-foreground" />}
                        allowClear
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="搜索模型名称、ID、厂商，如 deepseek, qwen, claude, gpt, glm..."
                        className="flex-1"
                    />
                    <div className="flex flex-wrap items-center gap-1">
                        <span className="text-xs text-muted-foreground mr-1">特性:</span>
                        {[
                            { key: "all", label: "全部" },
                            { key: "reasoning", label: "深度思考" },
                            { key: "tools", label: "工具调用" },
                            { key: "vision", label: "视觉理解" },
                            { key: "long_ctx", label: "1M+上下文" },
                        ].map((chip) => {
                            const isSelected = featureFilter === chip.key;
                            return (
                                <button
                                    key={chip.key}
                                    type="button"
                                    onClick={() => setFeatureFilter(chip.key as any)}
                                    className={cn(
                                        "px-2.5 py-0.5 text-xs rounded-full border transition-all cursor-pointer font-medium",
                                        isSelected
                                            ? "!bg-blue-600 !text-white !border-blue-600 shadow-sm"
                                            : "bg-muted/40 hover:bg-muted text-muted-foreground border-transparent hover:text-foreground",
                                    )}
                                >
                                    {chip.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Brands Bar */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 pb-2 border-b border-[var(--border)]">
                    <span className="text-xs text-muted-foreground mr-1">品牌:</span>
                    {(Object.keys(PRESET_BRAND_LABELS) as PresetBrand[]).map((brandKey) => {
                        const isSelected = selectedBrand === brandKey;
                        return (
                            <button
                                key={brandKey}
                                type="button"
                                onClick={() => setSelectedBrand(brandKey)}
                                className={cn(
                                    "px-2.5 py-1 text-xs rounded-md border transition-all cursor-pointer font-medium",
                                    isSelected
                                        ? "!bg-blue-600 !text-white !border-blue-600 shadow-sm"
                                        : "bg-muted/30 hover:bg-muted text-muted-foreground border-transparent hover:text-foreground",
                                )}
                            >
                                {PRESET_BRAND_LABELS[brandKey]}
                            </button>
                        );
                    })}
                </div>

                {/* Smart Match Recommendation Banner */}
                {matchedPreset && (
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-primary/25 bg-primary/5">
                        <div className="flex items-center gap-2 min-w-0">
                            <Sparkles className="size-4 shrink-0 text-primary" />
                            <div className="text-xs truncate">
                                匹配到当前模型 ID 对应的预设：
                                <strong className="text-primary font-semibold mx-1">{matchedPreset.name}</strong>
                                <span className="text-muted-foreground">
                                    （{formatTokenLimit(matchedPreset.contextLimit)} 上下文 / {formatTokenLimit(matchedPreset.outputLimit)} 输出）
                                </span>
                            </div>
                        </div>
                        <Button type="primary" size="small" onClick={() => handleSelect(matchedPreset)}>
                            一键应用此预设
                        </Button>
                    </div>
                )}

                {/* Model Grid */}
                {filteredModels.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                        {filteredModels.map((preset) => {
                            const isMatched = matchedPreset?.id === preset.id;
                            const hasVision = preset.modalities?.input?.includes("image");
                            const hasVideo = preset.modalities?.input?.includes("video");
                            const hasPdf = preset.modalities?.input?.includes("pdf");
                            const hasAudio = preset.modalities?.input?.includes("audio");

                            return (
                                <div
                                    key={preset.id}
                                    onClick={() => handleSelect(preset)}
                                    className={cn(
                                        "group relative flex flex-col justify-between p-3 rounded-lg border transition-all cursor-pointer select-none",
                                        isMatched
                                            ? "border-primary/40 bg-primary/[0.04] hover:bg-primary/[0.08]"
                                            : "border-[var(--border)] bg-card hover:border-foreground/30 hover:bg-muted/30",
                                    )}
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                                                        {preset.name}
                                                    </span>
                                                    {preset.provider && (
                                                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                                                            {preset.provider}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] font-mono text-muted-foreground truncate mt-0.5">
                                                    {preset.id}
                                                </div>
                                            </div>
                                            <Button
                                                size="small"
                                                type={isMatched ? "primary" : "default"}
                                                className="shrink-0 text-xs !h-7"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSelect(preset);
                                                }}
                                            >
                                                应用
                                            </Button>
                                        </div>

                                        {/* Metrics & Capabilities */}
                                        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-muted/60 text-foreground">
                                                上下文: <strong>{formatTokenLimit(preset.contextLimit)}</strong>
                                            </span>
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-muted/60 text-foreground">
                                                输出: <strong>{formatTokenLimit(preset.outputLimit)}</strong>
                                            </span>

                                            {preset.reasoning && (
                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                                    <Brain className="size-3" /> 深度思考
                                                </span>
                                            )}
                                            {preset.tool_call && (
                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                                    <Wrench className="size-3" /> 工具调用
                                                </span>
                                            )}
                                            {hasVision && (
                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                                    <Eye className="size-3" /> 视觉
                                                </span>
                                            )}
                                            {hasVideo && (
                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400">
                                                    <Film className="size-3" /> 视频
                                                </span>
                                            )}
                                            {hasPdf && (
                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                                                    <FileText className="size-3" /> PDF
                                                </span>
                                            )}
                                            {hasAudio && (
                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium bg-pink-500/10 text-pink-600 dark:text-pink-400">
                                                    <Mic className="size-3" /> 音频
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-12 text-center text-muted-foreground text-sm">
                        未找到符合条件的预设模型，可尝试调整筛选条件或搜索关键词
                    </div>
                )}
            </div>
        </Modal>
    );

    if (variant === "button") {
        return (
            <>
                <div className={cn("inline-flex items-center gap-2", className)}>
                    <Button
                        icon={<Sparkles className="size-4 text-primary" />}
                        onClick={() => setModalOpen(true)}
                        className="cursor-pointer"
                    >
                        选择预设模型
                    </Button>
                    <Tooltip title={`同步预设库（上次同步：${formattedSyncTime}）`}>
                        <Button
                            icon={<RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />}
                            loading={syncing}
                            onClick={() => void handleSync()}
                        />
                    </Tooltip>
                </div>
                {modalContent}
            </>
        );
    }

    return (
        <>
            <div
                className={cn(
                    "flex flex-wrap items-center justify-between gap-2.5 p-2.5 px-3 rounded-lg border border-[var(--border)] bg-muted/20 text-xs",
                    className,
                )}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <span className="grid size-6 place-items-center rounded-md bg-primary/10 text-primary shrink-0">
                        <Sparkles className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">预设模型库</span>
                        <span className="text-muted-foreground">
                            {models.length} 款模型参数已就绪 · 不改变渠道上游模型 ID 与调用协议
                        </span>
                        {matchedPreset ? (
                            <button
                                type="button"
                                onClick={() => handleSelect(matchedPreset)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium cursor-pointer"
                                title="点击一键应用此推荐预设"
                            >
                                <span>💡 匹配推荐: {matchedPreset.name}</span>
                                <span className="underline">一键填充</span>
                            </button>
                        ) : null}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <Tooltip title={`从 GitHub raw / jsDelivr CDN 同步最新预设（上次同步：${formattedSyncTime}）`}>
                        <Button
                            size="small"
                            icon={<RefreshCw className={cn("size-3", syncing && "animate-spin")} />}
                            loading={syncing}
                            onClick={() => void handleSync()}
                        >
                            {syncing ? "同步中" : "同步预设"}
                        </Button>
                    </Tooltip>
                    <Button
                        size="small"
                        type="primary"
                        icon={<Wand2 className="size-3" />}
                        onClick={() => setModalOpen(true)}
                    >
                        选择预设模型
                    </Button>
                </div>
            </div>
            {modalContent}
        </>
    );
}
