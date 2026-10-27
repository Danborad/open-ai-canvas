import { useState, type ReactNode } from "react";
import { Popover, Switch, Tooltip } from "antd";
import { Check, ChevronRight, SlidersHorizontal, Sparkles, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { ModelLogo } from "@/components/model-logo";
import { useEffectiveConfig, type ModelChannel } from "@/stores/use-config-store";
import { useAgentModelPreferencesStore } from "@/stores/use-agent-model-preferences";

type ModelItem = {
    id: string;
    name: string;
    channelName: string;
    description: string;
    icon?: string;
};

export function AgentModelPreferencesPopover({ children }: { children?: ReactNode }) {
    const config = useEffectiveConfig();
    const { auto, imageModel, videoModel, setAuto, setImageModel, setVideoModel } = useAgentModelPreferencesStore();
    const [tab, setTab] = useState<"image" | "video">("image");
    const [open, setOpen] = useState(false);

    // Extract image and video models from configured channels and modelCosts
    const channels = config.channels || [];
    const imageList: ModelItem[] = [];
    const videoList: ModelItem[] = [];
    const seenImage = new Set<string>();
    const seenVideo = new Set<string>();

    for (const ch of channels) {
        if (!ch.models) continue;
        const costs = ch.modelCosts || [];
        for (const m of ch.models) {
            const cost = costs.find((c) => c.model === m);
            const cap = cost?.capability;
            const item: ModelItem = {
                id: m,
                name: cost?.displayName || cost?.channelLabel || m,
                channelName: ch.publicAlias || ch.name,
                description: cost?.description || ch.publicAlias || ch.name,
                icon: cost?.icon,
            };

            const isImage = cap === "image" || (!cap && config.imageModels?.includes(m));
            const isVideo = cap === "video" || (!cap && config.videoModels?.includes(m));

            if (isImage && !seenImage.has(m)) {
                seenImage.add(m);
                imageList.push(item);
            }
            if (isVideo && !seenVideo.has(m)) {
                seenVideo.add(m);
                videoList.push(item);
            }
        }
    }

    // Fallbacks if not populated
    if (!imageList.length && config.imageModels) {
        for (const m of config.imageModels) {
            if (!seenImage.has(m)) {
                seenImage.add(m);
                imageList.push({ id: m, name: m, channelName: "默认渠道", description: "高品质生图模型" });
            }
        }
    }
    if (!videoList.length && config.videoModels) {
        for (const m of config.videoModels) {
            if (!seenVideo.has(m)) {
                seenVideo.add(m);
                videoList.push({ id: m, name: m, channelName: "默认渠道", description: "高品质视频生成模型" });
            }
        }
    }

    const currentList = tab === "image" ? imageList : videoList;
    const selectedModelId = tab === "image" ? (imageModel || imageList[0]?.id) : (videoModel || videoList[0]?.id);

    const onSelectModel = (id: string) => {
        if (tab === "image") {
            setImageModel(id);
        } else {
            setVideoModel(id);
        }
        setAuto(false);
        setOpen(false);
    };

    const content = (
        <div className="w-[330px] p-1 font-sans text-foreground select-none" onMouseDown={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between pb-2">
                <span className="text-sm font-semibold tracking-tight">模型偏好</span>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground font-medium">
                        <span>自动</span>
                        <Switch
                            size="small"
                            checked={auto}
                            onChange={(checked) => setAuto(checked)}
                        />
                    </label>
                    <button
                        type="button"
                        className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground transition-colors cursor-pointer"
                        onClick={() => setOpen(false)}
                        aria-label="关闭"
                    >
                        <X className="size-3.5" />
                    </button>
                </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-normal pb-3">
                {auto
                    ? "由 Agent 针对画面风格与复杂度自动优选模型。"
                    : "已指定偏好模型，Agent 生成媒体时将优先调用。"}
            </p>

            {/* Segmented Tab */}
            <div className="grid grid-cols-2 rounded-xl bg-foreground/[0.06] p-0.5 text-xs font-medium mb-3">
                <button
                    type="button"
                    className={cn(
                        "rounded-lg py-1.5 transition-all text-center",
                        tab === "image" ? "bg-background text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setTab("image")}
                >
                    Image
                </button>
                <button
                    type="button"
                    className={cn(
                        "rounded-lg py-1.5 transition-all text-center",
                        tab === "video" ? "bg-background text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setTab("video")}
                >
                    Video
                </button>
            </div>

            {/* Category Subtitle */}
            <div className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {tab === "image" ? "图片模型" : "视频模型"}
            </div>

            {/* Model List */}
            <div className="max-h-[260px] overflow-y-auto space-y-1 thin-scrollbar pr-0.5">
                {currentList.length ? (
                    currentList.map((item) => {
                        const isSelected = item.id === selectedModelId;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                className={cn(
                                    "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors cursor-pointer border",
                                    isSelected
                                        ? "bg-foreground/[0.08] border-foreground/15 text-foreground"
                                        : "border-transparent hover:bg-foreground/[0.04] text-foreground/80 hover:text-foreground",
                                )}
                                onClick={() => onSelectModel(item.id)}
                            >
                                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-foreground/[0.05] border border-foreground/10 text-foreground">
                                    <ModelLogo icon={item.icon} size={18} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-xs font-semibold">{item.name}</div>
                                    <div className="truncate text-[10px] text-muted-foreground">{item.description}</div>
                                </div>
                                {isSelected ? (
                                    <Check className="size-4 shrink-0 text-primary" />
                                ) : (
                                    <ChevronRight className="size-3.5 shrink-0 opacity-25" />
                                )}
                            </button>
                        );
                    })
                ) : (
                    <div className="py-6 text-center text-xs text-muted-foreground">暂无可用模型</div>
                )}
            </div>
        </div>
    );

    return (
        <Popover
            content={content}
            trigger="click"
            open={open}
            onOpenChange={setOpen}
            placement="topLeft"
            overlayClassName="agent-model-preferences-popover"
            arrow={false}
        >
            {children || (
                <Tooltip title={auto ? "模型偏好：自动" : "模型偏好：自定义"} placement="top">
                    <button
                        type="button"
                        className={cn(
                            "relative grid size-8 shrink-0 place-items-center rounded-lg border border-transparent transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/25",
                            !auto
                                ? "bg-primary/10 border-primary/20 text-primary"
                                : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
                        )}
                        aria-label={auto ? "模型偏好：自动" : "模型偏好：自定义"}
                    >
                        <SlidersHorizontal className="size-4" />
                        {!auto ? <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" /> : null}
                    </button>
                </Tooltip>
            )}
        </Popover>
    );
}
