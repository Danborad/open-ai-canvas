import { Check, Clapperboard, CloudUpload, Download, Eye, EyeOff, FileText, Frame, Image as ImageIcon, LoaderCircle, MoreHorizontal, Music2, Pencil, Play, Plus, Settings2, Sparkles, SquareDashed, Trash2, Video, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { App, Dropdown, Input } from "antd";
import { useQuery } from "@tanstack/react-query";

import { useCanvasStore, type CanvasProject } from "@/stores/canvas/use-canvas-store";
import { useCanvasUiStore } from "@/stores/canvas/use-canvas-ui-store";
import { exportCanvasProjects } from "@/lib/canvas/canvas-export";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";
import { resourceFileUrl, resourceIdFromStorageKey } from "@/services/api/resources";
import { resolveBackendApiUrl } from "@/stores/use-config-store";
import { CachedResourceImage } from "@/components/cached-resource-image";
import { MediaPlaceholder } from "@/components/ui/product/media-placeholder";
import { cn } from "@/lib/utils";
import { usePluginStore } from "@/stores/use-plugin-store";
import { CANVAS_COVER_BLUR_PLUGIN_ID } from "@/lib/plugins/builtin/canvas-cover-blur";
import { CANVAS_STATS_PLUGIN_ID } from "@/lib/plugins/builtin/canvas-stats";
import { useCanvasPrivacyStore } from "@/stores/use-canvas-privacy-store";
import { useSyncProgressStore } from "@/stores/use-sync-progress-store";
import { getCanvasProjectStats } from "@/services/api/user-data";
import { formatCredits } from "@/constant/credits";
import { resolveMediaUrl } from "@/services/file-storage";
import { hasRemoteUserDataSyncSession, loadCanvasProjectForEditing, saveRemoteUserDataNow } from "@/services/user-data-sync";
import { RelativeTime } from "@/components/ui/product/relative-time";

type ProjectPreviewMedia = { node: CanvasNodeData; url: string; storageKey?: string };
const projectPreviewMediaCache = new WeakMap<CanvasNodeData[], { first?: ProjectPreviewMedia; latest?: ProjectPreviewMedia }>();

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
    const { message } = App.useApp();
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
    const saveTitle = async () => {
        stopEditing();
        if (!hasRemoteUserDataSyncSession()) {
            renameProject(project.id, editingTitle);
            return;
        }
        try {
            await loadCanvasProjectForEditing(project.id);
            renameProject(project.id, editingTitle);
            await saveRemoteUserDataNow(project.id);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "重命名失败");
        }
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
                                        { key: "export", icon: <Download className="size-3.5" />, label: "导出画布", onClick: () => void exportCanvasProjects([project], project.title || "画布") },
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
                    <span aria-hidden="true">·</span>
                    <RelativeTime value={project.updatedAt} suffix="修改" />
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

/**
 * quiet：内容库卡片用的安静占位。空白画布与仅视频画布共用同一张浅渐变底 + 42px 图标 tile，
 * 不再输出「空白画布 / 等待第一幕」文案；其他调用方保持原有占位。
 */
export function ProjectPreview({ project, preferLatestImage = false, quiet = false, mosaic = false, isBlurred }: { project: Pick<CanvasProject, "id" | "nodes"> & { coverBlurred?: boolean }; preferLatestImage?: boolean; quiet?: boolean; mosaic?: boolean; isBlurred?: boolean }) {
    const syncProgress = useSyncProgressStore((state) => state.syncingProjects[project.id]);
    const isSyncing = Boolean(syncProgress && (syncProgress.phase === "uploading" || syncProgress.phase === "saving"));
    const coverBlurPluginEnabled = usePluginStore((state) => state.pluginStates[CANVAS_COVER_BLUR_PLUGIN_ID]?.effectiveEnabled ?? Boolean(state.installations.find((item) => item.manifest.id === CANVAS_COVER_BLUR_PLUGIN_ID)?.enabled));
    const shouldBlur = coverBlurPluginEnabled && (isBlurred !== undefined ? isBlurred : Boolean(project.coverBlurred ?? useCanvasPrivacyStore.getState().isProjectBlurred(project.id)));
    const media = projectPreviewMedia(project.nodes, preferLatestImage);
    const mosaicItems = mosaic ? projectPreviewMediaList(project.nodes, 3, preferLatestImage) : [];
    const quietPlaceholder = (icon: ReactNode, kind: "empty" | "video") => (
        <div className="canvas-project-placeholder size-full" data-kind={kind}>
            <span className="canvas-project-placeholder-tile">{icon}</span>
        </div>
    );

    const content = mosaicItems.length ? (
        <div className={cn("canvas-project-mosaic size-full", shouldBlur && "canvas-cover-privacy-blur is-blurred")} data-count={mosaicItems.length}>
            {mosaicItems.map((item, index) => (
                <span key={item.node.id || index} className="canvas-project-mosaic-cell">
                    <ProjectPreviewTile media={item} />
                </span>
            ))}
        </div>
    ) : quiet && media?.node.type === CanvasNodeType.Video ? (
        quietPlaceholder(<Video aria-hidden="true" />, "video")
    ) : quiet && !media && !project.nodes.length ? (
        quietPlaceholder(<SquareDashed aria-hidden="true" />, "empty")
    ) : media ? (
        <div className={cn("canvas-project-media size-full", shouldBlur && "canvas-cover-privacy-blur is-blurred")}>
            {media.node.type === CanvasNodeType.Video ? (
                <div className="canvas-project-video size-full">
                    <Video className="size-8" aria-label={media.node.title || "项目视频"} />
                </div>
            ) : (
                <CachedResourceImage storageKey={media.storageKey} src={media.url} alt={media.node.title || "项目图片"} loading="lazy" decoding="async" className="size-full min-h-0 object-cover" fallback={<MediaPlaceholder failed />} loadingFallback={<MediaPlaceholder label="正在读取封面" />} />
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
                    <span key={node.id} className="canvas-project-preview-node absolute flex min-w-0 items-center gap-2 overflow-hidden" style={style}>
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
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-stone-950/75 p-3 text-center backdrop-blur-sm transition-opacity duration-200 pointer-events-none select-none" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 text-amber-400">
                        <CloudUpload className="size-4 animate-bounce" />
                        <span className="text-xs font-medium tracking-wide">云端同步中</span>
                    </div>
                    <div className="w-full max-w-[150px] space-y-1">
                        {syncProgress.total > 0 ? (
                            <>
                                <div className="flex items-center justify-between text-[var(--fs-label)] text-white/80">
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
                            <div className="text-[var(--fs-label)] text-white/80">正在写入云端结构...</div>
                        )}
                        <div className="text-[var(--fs-label)] text-white/60">请勿关闭或刷新浏览器</div>
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

export function projectPreviewMedia(nodes: CanvasNodeData[], preferLatestImage = false) {
    let cached = projectPreviewMediaCache.get(nodes);
    if (!cached) {
        let firstMedia: ProjectPreviewMedia | undefined;
        let firstImage: ProjectPreviewMedia | undefined;
        let latestMedia: ProjectPreviewMedia | undefined;
        let latestImage: ProjectPreviewMedia | undefined;
        for (const node of nodes) {
            if (node.type !== CanvasNodeType.Image && node.type !== CanvasNodeType.Video) continue;
            const url = getNodeMediaUrl(node);
            if (!isPreviewUrl(url)) continue;
            const media = { node, url, storageKey: node.metadata?.storageKey };
            firstMedia ||= media;
            latestMedia = media;
            if (node.type === CanvasNodeType.Image) {
                firstImage ||= media;
                latestImage = media;
            }
        }
        cached = { first: firstImage || firstMedia, latest: latestImage || latestMedia };
        projectPreviewMediaCache.set(nodes, cached);
    }
    return preferLatestImage ? cached.latest : cached.first;
}

/** 封面拼图用：图片优先（视频首帧依赖浏览器解码，不稳定），同类型内按 preferLatest 决定先新后旧。 */
export function projectPreviewMediaList(nodes: CanvasNodeData[], limit: number, preferLatest = false) {
    const items: ProjectPreviewMedia[] = [];
    for (const node of nodes) {
        if (node.type !== CanvasNodeType.Image && node.type !== CanvasNodeType.Video) continue;
        const url = getNodeMediaUrl(node);
        if (isPreviewUrl(url)) items.push({ node, url, storageKey: node.metadata?.storageKey });
    }
    if (preferLatest) items.reverse();
    const images = items.filter((item) => item.node.type === CanvasNodeType.Image);
    const videos = items.filter((item) => item.node.type === CanvasNodeType.Video);
    return [...images, ...videos].slice(0, limit);
}

function ProjectPreviewTile({ media }: { media: ProjectPreviewMedia }) {
    if (media.node.type !== CanvasNodeType.Video) {
        return <CachedResourceImage storageKey={media.storageKey} src={media.url} alt="" loading="lazy" decoding="async" fallback={<MediaPlaceholder failed />} loadingFallback={<span className="canvas-project-mosaic-loading" />} />;
    }
    return <ProjectPreviewVideoFrame media={media} />;
}

/** 视频封面：远程资源先换取授权播放地址，再只加载 metadata 并解码首帧。 */
function ProjectPreviewVideoFrame({ media }: { media: ProjectPreviewMedia }) {
    const identity = media.storageKey || media.url;
    const [resolved, setResolved] = useState<{ identity: string; url: string; failed: boolean }>({ identity: "", url: "", failed: false });
    const [failedIdentity, setFailedIdentity] = useState("");
    useEffect(() => {
        let cancelled = false;
        void resolveMediaUrl(media.storageKey, media.url, "playback")
            .catch(() => resolveMediaUrl(media.storageKey, media.url, "original"))
            .then((url) => { if (!cancelled) setResolved({ identity, url: url || "", failed: !url }); })
            .catch(() => { if (!cancelled) setResolved({ identity, url: "", failed: true }); });
        return () => { cancelled = true; };
    }, [identity, media.storageKey, media.url]);
    const current = resolved.identity === identity ? resolved : null;
    if (current?.failed || failedIdentity === identity) {
        return (
            <span className="canvas-project-placeholder size-full" data-kind="video">
                <span className="canvas-project-placeholder-tile"><Video aria-hidden="true" /></span>
            </span>
        );
    }
    if (!current?.url) return <span className="canvas-project-mosaic-loading" />;
    return (
        <>
            <video
                src={current.url}
                muted
                playsInline
                preload="metadata"
                tabIndex={-1}
                aria-hidden="true"
                onLoadedMetadata={(event) => {
                    // 仅加载 metadata 时部分浏览器不绘制首帧；轻微 seek 强制解码一帧作为封面。
                    const video = event.currentTarget;
                    if (video.currentTime === 0 && Number.isFinite(video.duration) && video.duration > 0) video.currentTime = Math.min(0.001, video.duration);
                }}
                onError={() => setFailedIdentity(identity)}
            />
            <span className="canvas-project-mosaic-play" aria-hidden="true"><Play /></span>
        </>
    );
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
    const storageKey = node.metadata?.storageKey;
    const resourceId = resourceIdFromStorageKey(storageKey);
    if (resourceId) return resourceFileUrl(resourceId);
    const raw = node.metadata?.previewContent || node.metadata?.content;
    if (typeof raw === "string" && raw.trim()) {
        const trimmed = raw.trim();
        const resId = resourceIdFromStorageKey(trimmed);
        if (resId) return resourceFileUrl(resId);
        if (trimmed.startsWith("api/") || trimmed.startsWith("/api/")) return resolveBackendApiUrl(trimmed);
        return trimmed;
    }
    return "";
}

function isPreviewUrl(url: string) {
    if (!url) return false;
    return url.startsWith("blob:") || url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/api/");
}
