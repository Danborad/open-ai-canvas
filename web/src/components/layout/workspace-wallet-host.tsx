import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { openWorkspaceWallet, WORKSPACE_WALLET_OPEN_EVENT, type WorkspaceWalletOpenDetail } from "@/lib/workspace-wallet";
import { useUserStore } from "@/stores/use-user-store";

const WorkspaceWalletModal = lazy(() => import("@/components/layout/workspace-wallet-modal").then((module) => ({ default: module.WorkspaceWalletModal })));

export function WorkspaceWalletHost() {
    const creditsEnabled = useUserStore((state) => state.features.creditsEnabled);
    const loggedIn = useUserStore((state) => Boolean(state.user));
    const { pathname, search } = useLocation();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [openDetail, setOpenDetail] = useState<WorkspaceWalletOpenDetail>({});

    // 积分关闭时仍要能打开充值页购买存储空间，只是隐藏积分余额、兑换和积分记录。
    const applyOpen = (detail: WorkspaceWalletOpenDetail = {}) => {
        setOpenDetail(detail);
        setOpen(true);
    };

    useEffect(() => {
        const handleOpen = (raw: Event) => {
            applyOpen((raw as CustomEvent<WorkspaceWalletOpenDetail>).detail || {});
        };
        window.addEventListener(WORKSPACE_WALLET_OPEN_EVENT, handleOpen);
        return () => window.removeEventListener(WORKSPACE_WALLET_OPEN_EVENT, handleOpen);
    }, []);

    useEffect(() => {
        if (pathname !== "/wallet") return;
        const params = new URLSearchParams(search);
        openWorkspaceWallet({
            paymentOrderId: params.get("paymentOrder") || undefined,
            paymentInvalid: params.get("payment") === "invalid",
        });
        navigate("/", { replace: true });
    }, [navigate, pathname, search]);

    if (!loggedIn || !open) return null;
    return (
        <Suspense fallback={null}>
            <WorkspaceWalletModal
                open={open}
                creditsEnabled={creditsEnabled}
                initialTab={openDetail.tab}
                initialCategory={openDetail.category}
                pendingPaymentOrderId={openDetail.paymentOrderId}
                paymentInvalid={openDetail.paymentInvalid}
                onClose={() => {
                    setOpen(false);
                    setOpenDetail({});
                }}
            />
        </Suspense>
    );
}
