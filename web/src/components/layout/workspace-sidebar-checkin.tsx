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
                className={cn(
                    "app-workspace-sidebar-checkin is-collapsed dark:border-white/10 dark:!bg-white/[0.06] dark:!text-white dark:shadow-none",
                    checkedIn && "opacity-75"
                )}
                title={summary}
                aria-label={summary}
                aria-busy={claiming}
                disabled={claiming || checkedIn}
                onClick={() => void claim()}
            >
                {claiming ? (
                    <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : checkedIn ? (
                    <Check className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                ) : (
                    <Gift className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                )}
            </button>
        );
    }

    return (
        <aside
            className={cn(
                "app-workspace-sidebar-checkin dark:border-white/10 dark:!bg-white/[0.06] dark:!text-white dark:shadow-none",
                checkedIn && "opacity-85"
            )}
            aria-label={summary}
        >
            <div className="app-workspace-sidebar-checkin-copy">
                <strong className="app-workspace-sidebar-checkin-title dark:!text-white">
                    今日 <span className="text-emerald-500 dark:text-emerald-400 font-bold">{amount}</span> 积分
                </strong>
                <span className="app-workspace-sidebar-checkin-offer dark:!text-neutral-400">
                    {checkedIn ? "今日签到已完成" : "每日签到免费领"}
                </span>
            </div>
            <button
                type="button"
                className={cn(
                    "app-workspace-sidebar-checkin-claim dark:!bg-white dark:!text-neutral-900 dark:hover:!bg-neutral-200",
                    claiming && "is-loading",
                    checkedIn && "!bg-muted !text-muted-foreground cursor-not-allowed opacity-80 hover:!bg-muted"
                )}
                disabled={claiming || checkedIn}
                aria-label={checkedIn ? "今日已领取" : `立即领取 ${amount} 积分`}
                onClick={() => void claim()}
            >
                <span className="font-bold tracking-tight">
                    {claiming ? "领取中" : checkedIn ? "已领取" : "立即领取"}
                </span>
            </button>
        </aside>
    );
}
