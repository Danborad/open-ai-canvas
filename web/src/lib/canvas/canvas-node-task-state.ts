import type { CanvasNodeData } from "@/types/canvas";

/** A historical taskId is not a lock. Only live task states / submission are. */
export function isCanvasNodeGenerating(node: CanvasNodeData | undefined, runningNodeId?: string | null) {
    if (!node) return false;
    if (runningNodeId && runningNodeId === node.id) return true;
    const meta = node.metadata;
    if (meta?.taskId && (meta.taskStatus === "queued" || meta.taskStatus === "running")) return true;
    if (["succeeded", "failed", "cancelled"].includes(meta?.taskStatus || "")) return false;
    // 只有在存在活跃 taskId 且未到达终态，或者明确处于当前会话内存运行锁中时，才判定为生成中；
    // 孤立残留的 status: "loading" 不再死锁阻断用户再次点击生成。
    if (meta?.taskId && meta.status !== "success" && meta.status !== "error") return true;
    return Boolean(runningNodeId && runningNodeId === node.id);
}
