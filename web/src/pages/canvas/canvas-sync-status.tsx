import { AlertCircle, CloudCheck, LoaderCircle } from "lucide-react";
import { useSyncProgressStore } from "@/stores/use-sync-progress-store";
import "./canvas-sync-status.css";

export function CanvasSyncStatus({ projectId }: { projectId: string }) {
    const progress = useSyncProgressStore((state) => state.syncingProjects[projectId]);
    const isError = progress?.phase === "error" || progress?.localPhase === "error" || Boolean(progress?.errorKind);
    const saving = !isError && (progress?.phase === "pending" || progress?.phase === "saving" || progress?.phase === "uploading" || progress?.localPhase === "pending");
    const tone = isError ? "error" : saving ? "pending" : progress?.phase === "done" ? "done" : "idle";
    const label = isError ? (progress?.message || "同步失败，点击重试") : saving ? "正在同步画布" : progress?.phase === "done" ? "已同步" : "尚未同步";
    return (
        <span className={`canvas-sync-status-trigger canvas-sync-status-trigger--${tone} inline-flex size-8 items-center justify-center rounded-full`} role="status" aria-label={label} title={label}>
            {saving ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : isError ? <AlertCircle className="size-4 text-amber-500" /> : <CloudCheck className="size-4" />}
        </span>
    );
}
