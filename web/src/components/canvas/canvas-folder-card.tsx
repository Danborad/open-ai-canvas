import { App, Input } from "antd";
import { CanvasAnchoredDropdown as Dropdown } from "./canvas-anchored-dropdown";
import { Download, Eye, EyeOff, Image as ImageIcon, LoaderCircle, MoreHorizontal, Pencil, Trash2, Video } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";

import { ProjectPreview } from "@/components/canvas/canvas-project-card";
import { exportCanvasProjects } from "@/lib/canvas/canvas-export";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import type { CanvasLibrarySummary } from "@/services/api/user-data";
import { loadCanvasProjectForEditing, saveRemoteUserDataNow } from "@/services/user-data-sync";
import { useCanvasUiStore } from "@/stores/canvas/use-canvas-ui-store";
import { getCanvasProjectStats } from "@/services/api/user-data";
import { formatCredits } from "@/constant/credits";
import { cn } from "@/lib/utils";
import { CANVAS_STATS_PLUGIN_ID, useCanvasStatsEnabled } from "@/lib/plugins/builtin/canvas-stats";
import { CANVAS_COVER_BLUR_PLUGIN_ID, useCanvasCoverBlurEnabled } from "@/lib/plugins/builtin/canvas-cover-blur";
import { useCanvasPrivacyStore } from "@/stores/use-canvas-privacy-store";

type CanvasFolderCardProps = {
    project: CanvasLibrarySummary;
    projectName?: string;
    onClick: () => void;
    onPrefetch?: () => void;
    opening?: boolean;
};

/** 画布库中的文件夹封面：单一卡片表面承载预览和信息，避免相邻卡片互相侵入。 */
export function CanvasFolderCard({ project, projectName, onClick, onPrefetch, opening = false }: CanvasFolderCardProps) {
    const { message } = App.useApp();
    const renameProject = useCanvasStore((state) => state.renameProject);
    const selectedIds = useCanvasUiStore((state) => state.selectedProjectIds);
    const editingId = useCanvasUiStore((state) => state.editingProjectId);
    const editingTitle = useCanvasUiStore((state) => state.editingProjectTitle);
    const startEditing = useCanvasUiStore((state) => state.startEditingProject);
    const setEditingTitle = useCanvasUiStore((state) => state.setEditingProjectTitle);
    const stopEditing = useCanvasUiStore((state) => state.stopEditingProject);
    const toggleSelected = useCanvasUiStore((state) => state.toggleSelectedProjectId);
    const setDeleteIds = useCanvasUiStore((state) => state.setDeleteProjectIds);
    const coverBlurPluginEnabled = useCanvasCoverBlurEnabled();
    const isBlurred = Boolean(project.coverBlurred ?? useCanvasPrivacyStore.getState().isProjectBlurred(project.id));
    const toggleProjectBlur = (projectId: string) => {
        const nextBlurred = !isBlurred;
        useCanvasStore.getState().updateProject(projectId, { coverBlurred: nextBlurred }, false);
        useCanvasPrivacyStore.getState().setProjectBlur(projectId, nextBlurred);
    };
    const editing = editingId === project.id;
    const selected = selectedIds.includes(project.id);
    const statsEnabled = useCanvasStatsEnabled();
    const statsQuery = useQuery({
        queryKey: ["canvas-project-stats", project.id],
        queryFn: () => getCanvasProjectStats(project.id),
        staleTime: 30_000,
        enabled: statsEnabled,
    });

    const saveTitle = async () => {
        if (!editing) return;
        stopEditing();
        try {
            await loadCanvasProjectForEditing(project.id);
            renameProject(project.id, editingTitle);
            await saveRemoteUserDataNow(project.id);
        } catch (error) { message.error(error instanceof Error ? error.message : "重命名失败"); }
    };
    const exportProject = async () => {
        try {
            const fullProject = await loadCanvasProjectForEditing(project.id);
            if (!fullProject) throw new Error("画布不存在");
            await exportCanvasProjects([fullProject], project.title || "画布");
        } catch (error) { message.error(error instanceof Error ? error.message : "导出失败"); }
    };

    const handleOpenKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (!editing && !opening) onClick();
        }
    };

    return (
        <article className={cn("product-collection-card canvas-collection-card canvas-folder-card", selected && "is-selected", editing && "is-editing", opening && "is-opening")} onPointerEnter={onPrefetch} onPointerDown={onPrefetch} onFocusCapture={onPrefetch}>
            <div className="canvas-collection-open" role="button" tabIndex={0} aria-label={`打开画布 ${project.title}`} aria-busy={opening} onClick={() => !editing && !opening && onClick()} onKeyDown={handleOpenKeyDown}>
                <div className="canvas-collection-preview relative" aria-hidden="true">
                    <ProjectPreview project={{ id: project.id, nodes: project.previewNodes }} preferLatestImage isBlurred={coverBlurPluginEnabled && isBlurred} />
                    {opening ? (
                        <div className="canvas-collection-opening">
                            <LoaderCircle className="size-5 animate-spin" />
                            <span>正在打开</span>
                        </div>
                    ) : null}
                    {coverBlurPluginEnabled ? (
                        <button
                            type="button"
                            className={cn("canvas-folder-blur-toggle", isBlurred && "is-active")}
                            aria-label={isBlurred ? `取消 ${project.title} 封面隐私模糊` : `开启 ${project.title} 封面隐私模糊`}
                            title={isBlurred ? "隐私模式已开启（点击取消模糊）" : "开启封面隐私模糊"}
                            onClick={(event) => {
                                event.stopPropagation();
                                toggleProjectBlur(project.id);
                            }}
                        >
                            {isBlurred ? <EyeOff /> : <Eye />}
                        </button>
                    ) : null}
                </div>
                <div className="canvas-collection-body">
                    <div className="canvas-collection-heading-row">
                        {editing ? (
                            <Input
                                className="canvas-collection-title-input"
                                value={editingTitle}
                                onChange={(event) => setEditingTitle(event.target.value)}
                                onClick={(event) => event.stopPropagation()}
                                onBlur={saveTitle}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") saveTitle();
                                    if (event.key === "Escape") stopEditing();
                                }}
                                autoFocus
                            />
                        ) : (
                            <span className="canvas-collection-title">{project.title}</span>
                        )}
                    </div>
                    <div className="canvas-collection-meta">
                        <span className="canvas-collection-meta-item">{projectName ? `所属项目：${projectName}` : "自由画布"}</span>
                        <span className="canvas-collection-meta-separator" aria-hidden="true">·</span>
                        <span className="canvas-collection-meta-item">{project.nodeCount ?? project.previewNodes?.length ?? 0} 节点</span>
                    </div>
                    {statsEnabled && statsQuery.data && (statsQuery.data.imageCount > 0 || statsQuery.data.videoCount > 0) ? (
                        <div className="canvas-collection-stats flex items-center gap-1.5 text-xs text-foreground/80 font-medium my-0.5">
                            {statsQuery.data.imageCount > 0 ? (
                                <span className="inline-flex items-center gap-1">
                                    <ImageIcon className="size-3 text-foreground/45" /> {statsQuery.data.imageCount}张 · {formatCredits(statsQuery.data.imageCreditsMicros, 1)}分
                                </span>
                            ) : null}
                            {statsQuery.data.imageCount > 0 && statsQuery.data.videoCount > 0 ? (
                                <span className="text-foreground/30">·</span>
                            ) : null}
                            {statsQuery.data.videoCount > 0 ? (
                                <span className="inline-flex items-center gap-1">
                                    <Video className="size-3 text-foreground/45" /> {statsQuery.data.videoCount}条 · {formatCredits(statsQuery.data.videoCreditsMicros, 1)}分
                                </span>
                            ) : null}
                        </div>
                    ) : null}
                    <time className="canvas-collection-updated" dateTime={project.updatedAt} title={`创建于 ${formatCanvasDate(project.createdAt)}`}>{formatCanvasDate(project.updatedAt)} 更新</time>
                </div>
            </div>

            <span className={cn("canvas-collection-select", selected && "is-visible")} onClick={(event) => event.stopPropagation()}>
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => toggleSelected(project.id, event.target.checked)}
                    aria-label={`选择 ${project.title}`}
                />
            </span>

            <div className="canvas-collection-actions" onClick={(event) => event.stopPropagation()}>
                {!editing ? (
                    <button
                        type="button"
                        className="product-icon-button canvas-collection-rename"
                        aria-label={`重命名 ${project.title}`}
                        title="重命名"
                        onClick={(event) => {
                            event.stopPropagation();
                            startEditing(project.id, project.title);
                        }}
                    >
                        <Pencil />
                    </button>
                ) : null}

                <Dropdown
                    trigger={["click"]}
                    placement="bottomRight"
                    menu={{
                        onClick: ({ domEvent }) => domEvent.stopPropagation(),
                        items: [
                            { key: "export", icon: <Download className="size-3.5" />, label: "导出画布", onClick: () => void exportProject() },
                            { type: "divider" },
                            { key: "delete", danger: true, icon: <Trash2 className="size-3.5" />, label: "删除", onClick: () => setDeleteIds([project.id]) },
                        ],
                    }}
                >
                    <button type="button" className="product-icon-button canvas-collection-more" aria-label={`${project.title} 画布操作`} title="更多操作" onClick={(event) => event.stopPropagation()}>
                        <MoreHorizontal />
                    </button>
                </Dropdown>
            </div>
        </article>
    );
}

function formatCanvasDate(value: string) {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp)
        ? new Date(timestamp).toLocaleString("zh-CN", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
          })
        : "时间不可用";
}
