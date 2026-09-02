import { Check, Clapperboard, CloudUpload, Download, Eye, EyeOff, FileText, Frame, Image as ImageIcon, LoaderCircle, MoreHorizontal, Music2, Pencil, Plus, Settings2, Sparkles, Trash2, Video, X } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Dropdown, Input } from "antd";
import { useQuery } from "@tanstack/react-query";

import { useCanvasStore, type CanvasProject } from "@/stores/canvas/use-canvas-store";
import { useCanvasUiStore } from "@/stores/canvas/use-canvas-ui-store";
import { exportCanvasProjects } from "@/lib/canvas/canvas-export";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";
import { resourceFileUrl, resourceIdFromStorageKey } from "@/services/api/resources";
import { resolveBackendApiUrl } from "@/stores/use-config-store";
import { CachedResourceImage } from "@/components/cached-resource-image";
import { cn } from "@/lib/utils";
import { usePluginStore } from "@/stores/use-plugin-store";
import { CANVAS_COVER_BLUR_PLUGIN_ID } from "@/lib/plugins/builtin/canvas-cover-blur";
import { CANVAS_STATS_PLUGIN_ID } from "@/lib/plugins/builtin/canvas-stats";
import { useCanvasPrivacyStore } from "@/stores/use-canvas-privacy-store";
import { useSyncProgressStore } from "@/stores/use-sync-progress-store";
import { getCanvasProjectStats } from "@/services/api/user-data";
import { formatCredits } from "@/constant/credits";

export function CanvasCreateCard({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
    return (
        <button type="button" className="app-canvas-create-card" disabled={disabled} onClick={onClick}>
            <span className="app-canvas-create-preview">
                <Plus className="app-canvas-create-icon" />
            </span>
            <span className="app-canvas-create-title">新建画布</span>
            <span className="app-canvas-create-meta">从空白开始</span>
        </button>
    );
}

export function CanvasProjectCard({
    project,
    projectName,
    variant = "library",
    readOnly = false,
    opening = false,
    onPrefetch,
    footer,
}: {
    project: CanvasProject;
    projectName?: string;
    variant?: "library" | "recent";
    readOnly?: boolean;
    opening?: boolean;
    onPrefetch?: () => void;
    footer?: ReactNode;
}) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const renameProject = useCanvasStore((state) => state.renameProject);
    const selectedIds = useCanvasUiStore((state) => state.selectedProjectIds);
    const editingId = useCanvasUiStore((state) => state.editingProjectId);
    const editingTitle = useCanvasUiStore((state) => state.editingProjectTitle);
    const startEditing = useCanvasUiStore((state) => state.startEditingProject);
    const setEditingTitle = useCanvasUiStore((state) => state.setEditingProjectTitle);
    const stopEditing = useCanvasUiStore((state) => state.stopEditingProject);
    const toggleSelected = useCanvasUiStore((state) => state.toggleSelectedProjectId);
    const setDeleteIds = useCanvasUiStore((state) => state.setDeleteProjectIds);
    const coverBlurPluginEnabled = usePluginStore((state) => state.pluginStates[CANVAS_COVER_BLUR_PLUGIN_ID]?.effectiveEnabled ?? Boolean(state.installations.find((item) => item.manifest.id === CANVAS_COVER_BLUR_PLUGIN_ID)?.enabled));
    const isBlurred = Boolean(project.coverBlurred ?? useCanvasPrivacyStore.getState().isProjectBlurred(project.id));
    const toggleProjectBlur = (projectId: string) => {
        const nextBlurred = !isBlurred;
        useCanvasStore.getState().updateProject(projectId, { coverBlurred: nextBlurred }, false);
        useCanvasPrivacyStore.getState().setProjectBlur(projectId, nextBlurred);
    };
    const editing = editingId === project.id;
    const selected = selectedIds.includes(project.id);
    const statsEnabled = usePluginStore((state) => state.pluginStates[CANVAS_STATS_PLUGIN_ID]?.effectiveEnabled ?? Boolean(state.installations.find((item) => item.manifest.id === CANVAS_STATS_PLUGIN_ID)?.enabled));
    const statsQuery = useQuery({
        queryKey: ["canvas-project-stats", project.id],
        queryFn: () => getCanvasProjectStats(project.id),
        staleTime: 30_000,
        enabled: statsEnabled,
    });
    const open = () => navigate(`/canvas/${project.id}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`);
    const saveTitle = () => {
        renameProject(project.id, editingTitle);
        stopEditing();
    };

    const compact = variant === "recent";
    return (
        <article
            className={cn("app-canvas-project-card group h-full cursor-pointer", compact ? "is-recent" : "is-library", selected && "is-selected", opening && "is-opening")}
            onPointerEnter={onPrefetch}
            onPointerDown={onPrefetch}
            onFocusCapture={onPrefetch}
            onClick={() => (!editing || readOnly) && !opening && open()}
        >
            <div className="app-canvas-project-preview relative">
                <button
                    type="button"
                    className={cn("canvas-project-preview-button block w-full overflow-hidden text-left", compact ? "aspect-[16/10]" : "aspect-video")}
                    aria-busy={opening}
                    onClick={(event) => {
                        event.stopPropagation();
                        if (!opening) open();
                    }}
                >
                    <ProjectPreview project={project} isBlurred={coverBlurPluginEnabled && isBlurred} />
                    {opening ? (
                        <div className="canvas-folder-opening">
                            <LoaderCircle className="size-5 animate-spin" />
                            <span>正在打开</span>
                        </div>
                    ) : null}
                </button>
                {!compact && !readOnly ? (
                    <span className={`canvas-project-select ${selected ? "is-visible" : ""}`} onClick={(event) => event.stopPropagation()}>
                        <input type="checkbox" checked={selected} onChange={(event) => toggleSelected(project.id, event.target.checked)} className="app-canvas-project-checkbox" aria-label={`选择 ${project.title}`} />
                    </span>
                ) : null}
                {coverBlurPluginEnabled ? (
                    <button
                        type="button"
                        className={cn("canvas-folder-blur-toggle", isBlurred && "is-active")}
                        aria-label={isBlurred ? "取消封面隐私模糊" : "开启封面隐私模糊"}
                        title={isBlurred ? "隐私模式已开启（点击取消模糊）" : "开启封面隐私模糊"}
                        onClick={(event) => {
                            event.stopPropagation();
                            toggleProjectBlur(project.id);
                        }}
                    >
                        {isBlurred ? <EyeOff /> : <Eye />}
                    </button>
                ) : null}
                <div className="canvas-project-cover-meta" aria-hidden="true">
                    <span className="canvas-project-node-count">{project.nodes.length} 节点</span>
                </div>
            </div>

            <div className={cn("app-canvas-project-body", compact ? "is-compact" : "")}>
                <div className="canvas-project-heading-row">
                    {editing && !readOnly ? (
                        <Input
                            className="canvas-project-title-input"
                            value={editingTitle}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => setEditingTitle(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && saveTitle()}
                            autoFocus
                        />
                    ) : (
                        <button
                            type="button"
                            className="canvas-project-title-button"
                            onClick={(event) => {
                                event.stopPropagation();
                                open();
                            }}
                        >
                            <h2>{project.title}</h2>
                        </button>
                    )}
                    {editing && !readOnly ? (
                        <div className="canvas-project-actions" onClick={(event) => event.stopPropagation()}>
                            <button type="button" onClick={saveTitle} aria-label="保存名称">
                                <Check className="size-3.5" />
                            </button>
                            <button type="button" onClick={stopEditing} aria-label="取消重命名">
                                <X className="size-3.5" />
                            </button>
                        </div>
                    ) : !readOnly ? (
                        <div className="canvas-project-actions" onClick={(event) => event.stopPropagation()}>
                            <button type="button" onClick={() => startEditing(project.id, project.title)} aria-label={`重命名 ${project.title}`} title="重命名">
                                <Pencil className="size-3.5" />
                            </button>
                            <Dropdown
                                trigger={["click"]}
                                menu={{
                                    onClick: ({ domEvent }) => domEvent.stopPropagation(),
                                    items: [
                                        { key: "export", icon: <Download className="size-3.5" />, label: "导出画布", onClick: () => void exportCanvasProjects([project], project.title || "影策画布") },
                                        { type: "divider" },
                                        { key: "delete", danger: true, icon: <Trash2 className="size-3.5" />, label: "删除", onClick: () => setDeleteIds([project.id]) },
                                    ],
                                }}
                            >
                                <button type="button" aria-label={`${project.title} 画布操作`} title="更多操作">
                                    <MoreHorizontal className="size-4" />
                                </button>
                            </Dropdown>
                        </div>
                    ) : null}
                </div>
                <div className="canvas-project-stats">
                    <span>{projectName || "自由画布"}</span>
                    <span aria-hidden="true">·</span>
                    <span>{project.nodes.length} 节点</span>
                    {statsEnabled && statsQuery.data && (statsQuery.data.imageCount > 0 || statsQuery.data.videoCount > 0) ? (
                        <>
                            <span aria-hidden="true">·</span>
                            <span className="flex items-center gap-1 font-medium text-foreground/80">
                                <ImageIcon className="size-3 text-foreground/45" /> {statsQuery.data.imageCount} · {formatCredits(statsQuery.data.imageCreditsMicros, 1)}分
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="flex items-center gap-1 font-medium text-foreground/80">
                                <Video className="size-3 text-foreground/45" /> {statsQuery.data.videoCount} · {formatCredits(statsQuery.data.videoCreditsMicros, 1)}分
                            </span>
                        </>
                    ) : null}
                </div>
                {footer ? (
                    <div className="canvas-project-card-footer" onClick={(event) => event.stopPropagation()}>
                        {footer}
                    </div>
                ) : null}
            </div>
        </article>
    );
}

export function ProjectPreview({ project, preferLatestImage = false, isBlurred }: { project: CanvasProject; preferLatestImage?: boolean; isBlurred?: boolean }) {
    const syncProgress = useSyncProgressStore((state) => state.syncingProjects[project.id]);
    const isSyncing = Boolean(syncProgress && (syncProgress.phase === "uploading" || syncProgress.phase === "saving"));
    const coverBlurPluginEnabled = usePluginStore((state) => state.pluginStates[CANVAS_COVER_BLUR_PLUGIN_ID]?.effectiveEnabled ?? Boolean(state.installations.find((item) => item.manifest.id === CANVAS_COVER_BLUR_PLUGIN_ID)?.enabled));
    const shouldBlur = coverBlurPluginEnabled && (isBlurred !== undefined ? isBlurred : Boolean(project.coverBlurred ?? useCanvasPrivacyStore.getState().isProjectBlurred(project.id)));
    const mediaNodes = project.nodes.flatMap((node) => {
        if (node.type !== CanvasNodeType.Image && node.type !== CanvasNodeType.Video) return [];
        const url = getNodeMediaUrl(node);
        const storageKey = node.metadata?.storageKey;
        return isPreviewUrl(url) || Boolean(storageKey) ? [{ node, url, storageKey }] : [];
    });
    const imageNodes = mediaNodes.filter(({ node }) => node.type === CanvasNodeType.Image);
    const media = preferLatestImage ? imageNodes[imageNodes.length - 1] || mediaNodes[mediaNodes.length - 1] : imageNodes[0] || mediaNodes[0];

    const content = media ? (
        <div className={cn("canvas-project-media size-full", shouldBlur && "canvas-cover-privacy-blur is-blurred")}>
            {media.node.type === CanvasNodeType.Video ? (
                <div className="canvas-project-video size-full">
                    <Video className="size-8" aria-label={media.node.title || "项目视频"} />
                </div>
            ) : (
                <CachedResourceImage storageKey={media.storageKey} src={media.url} alt={media.node.title || "项目图片"} loading="lazy" decoding="async" className="size-full min-h-0 object-cover" />
            )}
        </div>
    ) : !project.nodes.length ? (
        <div className="canvas-project-empty size-full">
            <Plus className="canvas-project-empty-icon" />
            <span>空白画布</span>
            <small>等待第一幕</small>
        </div>
    ) : (
        <div className={cn("canvas-project-preview-canvas relative size-full overflow-hidden", shouldBlur && "canvas-cover-privacy-blur is-blurred")}>
            {buildNodePreviewLayout(project.nodes.slice(0, 8)).map(({ node, style }) => {
                const presentation = getNodePresentation(node);
                return (
                    <span key={node.id} className="canvas-project-preview-node absolute flex min-w-0 items-center gap-1.5 overflow-hidden" style={style}>
                        <span className="canvas-project-preview-node-icon">{presentation.icon}</span>
                        <span className="canvas-project-preview-node-label">{node.title || presentation.label}</span>
                    </span>
                );
            })}
        </div>
    );

    return (
        <div className="relative size-full overflow-hidden">
            {content}
            {isSyncing && syncProgress ? (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-stone-950/75 p-3 text-center backdrop-blur-sm transition-all duration-300 pointer-events-none select-none" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5 text-amber-400">
                        <CloudUpload className="size-4 animate-bounce" />
                        <span className="text-xs font-medium tracking-wide">云端同步中</span>
                    </div>
                    <div className="w-full max-w-[150px] space-y-1">
                        {syncProgress.total > 0 ? (
                            <>
                                <div className="flex items-center justify-between text-[10px] text-white/80">
                                    <span>媒体上传</span>
                                    <span className="font-mono text-amber-300">
                                        {syncProgress.completed}/{syncProgress.total}
                                    </span>
                                </div>
                                <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
                                    <div
                                        className="h-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-200"
                                        style={{
                                            width: `${Math.max(8, Math.round((syncProgress.completed / syncProgress.total) * 100))}%`,
                                        }}
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="text-[10px] text-white/80">正在写入云端结构...</div>
                        )}
                        <div className="text-[9px] text-white/60">请勿关闭或刷新浏览器</div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function getNodePresentation(node: CanvasNodeData) {
    if (node.type === CanvasNodeType.Image) return { label: "图片", icon: <ImageIcon className="size-3.5" /> };
    if (node.type === CanvasNodeType.Video) return { label: "视频", icon: <Video className="size-3.5" /> };
    if (node.type === CanvasNodeType.Audio) return { label: "音频", icon: <Music2 className="size-3.5" /> };
    if (node.type === CanvasNodeType.Text) return { label: "文本", icon: <FileText className="size-3.5" /> };
    if (node.type === "section") return { label: "分节", icon: <Frame className="size-3.5" /> };
    if (node.type === "storyboard") return { label: "分镜", icon: <Clapperboard className="size-3.5" /> };
    if (node.type === "config") return { label: "配置", icon: <Settings2 className="size-3.5" /> };
    return { label: "节点", icon: <Sparkles className="size-3.5" /> };
}

function buildNodePreviewLayout(nodes: CanvasNodeData[]) {
    if (!nodes.length) return [];
    const minX = Math.min(...nodes.map((node) => node.position.x));
    const maxX = Math.max(...nodes.map((node) => node.position.x + (node.width || 200)));
    const minY = Math.min(...nodes.map((node) => node.position.y));
    const maxY = Math.max(...nodes.map((node) => node.position.y + (node.height || 120)));
    const width = maxX - minX || 1;
    const height = maxY - minY || 1;

    return nodes.map((node) => {
        const left = ((node.position.x - minX) / width) * 100;
        const top = ((node.position.y - minY) / height) * 100;
        const nodeWidth = Math.max(16, ((node.width || 200) / width) * 100);
        const nodeHeight = Math.max(12, ((node.height || 120) / height) * 100);
        return {
            node,
            style: {
                left: `${left}%`,
                top: `${top}%`,
                width: `${nodeWidth}%`,
                height: `${nodeHeight}%`,
            },
        };
    });
}

function getNodeMediaUrl(node: CanvasNodeData) {
    const raw = node.metadata?.previewContent || node.metadata?.content || node.metadata?.dataUrl || node.metadata?.url;
    if (typeof raw !== "string" || !raw.trim()) return "";
    const trimmed = raw.trim();
    const resourceId = resourceIdFromStorageKey(trimmed) || resourceIdFromStorageKey(node.metadata?.storageKey);
    if (resourceId) return resourceFileUrl(resourceId);
    if (trimmed.startsWith("api/")) return resolveBackendApiUrl(trimmed);
    return trimmed;
}

function isPreviewUrl(url: string) {
    if (!url) return false;
    return url.startsWith("blob:") || url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/api/");
}
