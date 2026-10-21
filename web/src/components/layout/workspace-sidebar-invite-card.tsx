import { Gift } from "lucide-react";
import { useNavigate } from "react-router";
import { Tooltip } from "antd";

import { useUserStore } from "@/stores/use-user-store";

export function WorkspaceSidebarInviteCard({ collapsed }: { collapsed: boolean }) {
    const navigate = useNavigate();
    const user = useUserStore((state) => state.user);
    const promotionEnabled = useUserStore((state) => state.features.promotionEnabled);

    if (!user || !promotionEnabled) return null;

    if (collapsed) {
        return (
            <Tooltip title="邀请中心 · 邀请好友注册送积分" placement="right">
                <button
                    type="button"
                    onClick={() => navigate("/promotion")}
                    className="app-workspace-sidebar-checkin is-collapsed my-1 flex size-9 items-center justify-center rounded-xl bg-white text-neutral-900 shadow-md transition hover:scale-105 active:scale-95"
                    aria-label="邀请中心"
                >
                    <Gift className="size-4 text-emerald-600" />
                </button>
            </Tooltip>
        );
    }

    return (
        <aside
            className="app-workspace-sidebar-checkin group my-1 cursor-pointer transition hover:shadow-lg"
            onClick={() => navigate("/promotion")}
            title="点击进入邀请中心，分享专属链接赚取积分"
        >
            <div className="app-workspace-sidebar-checkin-copy min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <strong className="app-workspace-sidebar-checkin-title font-bold text-neutral-900">邀请中心</strong>
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
                        奖励
                    </span>
                </div>
                <span className="app-workspace-sidebar-checkin-offer block truncate text-[11px] text-neutral-500">
                    邀请好友注册<em>+100</em>积分
                </span>
            </div>
            <button
                type="button"
                className="app-workspace-sidebar-checkin-claim shrink-0 rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white shadow-sm transition group-hover:bg-black"
                onClick={(e) => {
                    e.stopPropagation();
                    navigate("/promotion");
                }}
            >
                立即邀请
            </button>
        </aside>
    );
}
