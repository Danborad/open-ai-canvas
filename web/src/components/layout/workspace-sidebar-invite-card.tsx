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
            className="group my-1 flex flex-col justify-center rounded-[12px] bg-white px-3 py-2 text-neutral-900 shadow-sm transition hover:shadow-md cursor-pointer"
            onClick={() => navigate("/promotion")}
            title="点击进入邀请中心，分享专属推广链接赚取积分"
        >
            {/* 上排：左边小字「邀请中心」，右边黑色胶囊按钮「立即邀请」 */}
            <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-bold tracking-tight text-neutral-900">
                    邀请中心
                </span>
                <button
                    type="button"
                    className="flex h-[26px] shrink-0 items-center justify-center rounded-full bg-neutral-900 px-2.5 text-[11px] font-semibold text-white transition group-hover:bg-black active:scale-95"
                    onClick={(e) => {
                        e.stopPropagation();
                        navigate("/promotion");
                    }}
                >
                    立即邀请
                </button>
            </div>

            {/* 下排：整行横向小字说明，字号精致，绝不折行挤压 */}
            <div className="mt-1 flex items-center text-[10.5px] leading-tight text-neutral-500 whitespace-nowrap overflow-hidden text-ellipsis">
                邀请好友送积分
            </div>
        </aside>
    );
}
