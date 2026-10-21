import { App } from "antd";
import { useState } from "react";
import { Check, Gift, LoaderCircle } from "lucide-react";

import { formatCredits } from "@/constant/credits";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { sidebarCheckinTitle, shouldShowSidebarCheckin } from "@/lib/sidebar-checkin";
import { cn } from "@/lib/utils";
import { ApiError } from "@/services/api/request";
import { checkinCredits } from "@/services/api/wallet";
import { useAppearanceStore } from "@/stores/use-appearance-store";
import { useUserStore } from "@/stores/use-user-store";

export function WorkspaceSidebarCheckin({ collapsed }: { collapsed: boolean }) {
    const user = useUserStore((state) => state.user);
    const creditsEnabled = useUserStore((state) => state.features.creditsEnabled);
    const brandName = useAppearanceStore((state) => state.appearance.brandName);
    const { policy, refresh } = useWalletBalance(user?.id, Boolean(user) && creditsEnabled);
    const { message } = App.useApp();
    const [claiming, setClaiming] = useState(false);

    const visible = shouldShowSidebarCheckin({
        creditsEnabled,
        checkinBonusMicrocredits: policy?.checkinBonusMicrocredits,
        checkedInToday: policy?.checkedInToday,
    });
    if (!user || !visible || !policy) return null;

    const amount = formatCredits(policy.checkinBonusMicrocredits, 2);
    const title = sidebarCheckinTitle(brandName);
    const checkedIn = Boolean(policy.checkedInToday);
    const summary = checkedIn ? `${title}，今日已领取 ${amount} 积分` : `${title}，今日可领 ${amount} 积分`;

    const claim = async () => {
        if (claiming || checkedIn) return;
        setClaiming(true);
        try {
            await checkinCredits();
            window.dispatchEvent(new CustomEvent("wallet:updated"));
            await refresh();
            message.success("签到成功，积分已到账");
        } catch (error) {
            const alreadyClaimed = error instanceof ApiError && error.status === 409;
            window.dispatchEvent(new CustomEvent("wallet:updated"));
            await refresh();
            if (alreadyClaimed) return;
            message.error(error instanceof Error ? error.message : "领取失败");
        } finally {
            setClaiming(false);
        }
    };

    if (collapsed) {
        return (
            <button
                type="button"
                className={cn("app-workspace-sidebar-checkin is-collapsed", checkedIn && "opacity-75")}
                title={summary}
                aria-label={summary}
                aria-busy={claiming}
                disabled={claiming || checkedIn}
                onClick={() => void claim()}
            >
                {claiming ? (
                    <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : checkedIn ? (
                    <Check className="size-4 text-emerald-600" aria-hidden="true" />
                ) : (
                    <Gift className="size-5" aria-hidden="true" />
                )}
            </button>
        );
    }

    return (
        <aside className={cn("app-workspace-sidebar-checkin", checkedIn && "opacity-85")} aria-label={summary}>
            <div className="app-workspace-sidebar-checkin-copy">
                <strong className="app-workspace-sidebar-checkin-title">{title}</strong>
                <span className="app-workspace-sidebar-checkin-offer">
                    {checkedIn ? (
                        <span className="text-muted-foreground">今日已领 <em>{amount}</em> 积分</span>
                    ) : (
                        <>今日<em>{amount}</em>积分</>
                    )}
                </span>
            </div>
            <button
                type="button"
                className={cn(
                    "app-workspace-sidebar-checkin-claim",
                    claiming && "is-loading",
                    checkedIn && "!bg-muted !text-muted-foreground cursor-not-allowed opacity-80 hover:!bg-muted"
                )}
                disabled={claiming || checkedIn}
                aria-label={checkedIn ? "今日已领取" : `立即领取 ${amount} 积分`}
                onClick={() => void claim()}
            >
                {claiming ? "领取中" : checkedIn ? "已领取" : "立即领取"}
            </button>
        </aside>
    );
}
