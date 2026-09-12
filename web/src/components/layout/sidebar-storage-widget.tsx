import { useQuery } from "@tanstack/react-query";
import { Tooltip } from "antd";
import { HardDrive } from "lucide-react";
import { Link } from "react-router";

import { formatBytes } from "@/lib/image-utils";
import { cn } from "@/lib/utils";
import { useUserStorageStatusEnabled } from "@/lib/plugins/builtin/user-storage-status";
import { assetStorageUsageQueryKey } from "@/pages/assets/asset-storage-usage";
import { getAccountFileStorageUsage } from "@/services/api/resources";
import { useUserStore } from "@/stores/use-user-store";

function storageBytes(value: number) {
    return formatBytes(value) || "0 B";
}

export function SidebarStorageWidget({ collapsed }: { collapsed: boolean }) {
    const enabled = useUserStorageStatusEnabled();
    const user = useUserStore((state) => state.user);

    const query = useQuery({
        queryKey: assetStorageUsageQueryKey,
        queryFn: getAccountFileStorageUsage,
        enabled: Boolean(user?.id) && enabled,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
    });

    if (!enabled || !user?.id) return null;

    const usage = query.data;
    const usedBytes = usage?.usedBytes ?? 0;
    const totalBytes = usage?.totalBytes ?? 0;
    const percent = totalBytes > 0 ? Math.min(100, Math.max(0, (usedBytes / totalBytes) * 100)) : 0;
    const percentLabel = usedBytes && percent < 0.1 ? "<0.1%" : `${Math.round(percent * 10) / 10}%`;
    const isFull = Boolean(totalBytes > 0 && usedBytes >= totalBytes);
    const isWarning = percent >= 80;

    const barColorClass = isFull || percent >= 95
        ? "bg-red-500"
        : isWarning
            ? "bg-amber-500"
            : "bg-primary";

    if (collapsed) {
        const tooltipTitle = usage
            ? `存储空间：已使用 ${storageBytes(usedBytes)} / ${storageBytes(totalBytes)} (${percentLabel})`
            : "存储空间：正在统计…";

        return (
            <Tooltip placement="right" title={tooltipTitle}>
                <Link
                    to="/assets"
                    className="app-workspace-nav-link is-collapsed relative group mb-1 flex min-h-9 w-full items-center justify-center rounded-[var(--r-sm)] px-2.5 py-2 text-foreground/60 transition-colors hover:bg-surface-hover hover:text-foreground"
                    aria-label={tooltipTitle}
                >
                    <HardDrive className="size-4 shrink-0" strokeWidth={1.6} />
                    {isWarning || isFull ? (
                        <span
                            className={cn(
                                "absolute right-2 top-2 size-1.5 rounded-full ring-2 ring-background",
                                isFull ? "bg-red-500" : "bg-amber-500",
                            )}
                        />
                    ) : null}
                </Link>
            </Tooltip>
        );
    }

    return (
        <Link
            to="/assets"
            className="group/storage relative mb-2 block rounded-[var(--r-md)] border border-border/40 bg-foreground/[0.03] p-2.5 text-inherit no-underline transition-all hover:border-border/70 hover:bg-foreground/[0.06]"
            title="点击查看素材库与容量详情"
        >
            <div className="flex items-center justify-between gap-1 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-foreground/75 transition-colors group-hover/storage:text-foreground">
                    <HardDrive className="size-3.5 text-foreground/60 transition-colors group-hover/storage:text-foreground/90" strokeWidth={1.8} />
                    <span>存储空间</span>
                </div>
                {usage ? (
                    <span
                        className={cn(
                            "font-semibold tabular-nums",
                            isFull ? "text-red-500 font-bold" : isWarning ? "text-amber-500" : "text-foreground/85",
                        )}
                    >
                        {percentLabel}
                    </span>
                ) : query.isPending ? (
                    <span className="text-[11px] text-foreground/40">统计中…</span>
                ) : (
                    <span className="text-[11px] text-foreground/40">--</span>
                )}
            </div>

            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
                <div
                    className={cn("h-full rounded-full transition-all duration-300", barColorClass)}
                    style={{ width: `${percent}%` }}
                />
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[11px] text-foreground/50 tabular-nums">
                <span>{usage ? `已用 ${storageBytes(usedBytes)}` : "正在获取已用容量…"}</span>
                <span>{usage ? `共 ${storageBytes(totalBytes)}` : ""}</span>
            </div>
        </Link>
    );
}
