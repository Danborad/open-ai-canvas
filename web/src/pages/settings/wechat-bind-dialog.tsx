import { useCallback, useEffect, useRef, useState } from "react";
import { App, Button, Modal, Spin } from "antd";
import { Check, Copy, QrCode, RefreshCw } from "lucide-react";

import { getWechatQRTicket, getWechatTicketStatus, type WechatQRTicketData } from "@/services/api/auth";
import { cn } from "@/lib/utils";

export function WechatBindDialog({
    open,
    onCancel,
    onSuccess,
}: {
    open: boolean;
    onCancel: () => void;
    onSuccess: () => void;
}) {
    const { message } = App.useApp();
    const [ticketData, setTicketData] = useState<WechatQRTicketData | null>(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<"pending" | "scanned" | "confirmed" | "failed" | "expired">("pending");
    const [errorMessage, setErrorMessage] = useState("");
    const [copied, setCopied] = useState(false);
    const [viewMode, setViewMode] = useState<"qr" | "manual">("qr");
    const [envVersion, setEnvVersion] = useState<"release" | "trial">("release");

    const callbacksRef = useRef({ onSuccess, onCancel });
    useEffect(() => {
        callbacksRef.current = { onSuccess, onCancel };
    }, [onSuccess, onCancel]);

    const loadTicket = useCallback(async (targetEnv?: "release" | "trial") => {
        setLoading(true);
        setStatus("pending");
        setErrorMessage("");
        const reqEnv = targetEnv || envVersion;
        try {
            const data = await getWechatQRTicket("bind", undefined, reqEnv);
            setTicketData(data);
            if (data.envVersion === "release" || data.envVersion === "trial") {
                setEnvVersion(data.envVersion);
            }
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : "获取微信绑定码失败");
        } finally {
            setLoading(false);
        }
    }, [envVersion]);

    const handleEnvChange = (env: "release" | "trial") => {
        if (env === envVersion || loading) return;
        setEnvVersion(env);
        void loadTicket(env);
    };

    useEffect(() => {
        if (open) {
            void loadTicket();
        } else {
            setTicketData(null);
            setStatus("pending");
        }
    }, [open, loadTicket]);

    useEffect(() => {
        const ticketId = ticketData?.ticket;
        if (!open || !ticketId || status === "confirmed" || status === "expired" || status === "failed") {
            return;
        }

        let cancelled = false;

        const poll = async () => {
            if (cancelled) return;
            try {
                const res = await getWechatTicketStatus(ticketId);
                if (cancelled) return;
                if (res.status === "confirmed") {
                    cancelled = true;
                    setStatus("confirmed");
                    message.success("微信账号绑定成功！");
                    callbacksRef.current.onSuccess();
                    callbacksRef.current.onCancel();
                } else if (res.status === "expired") {
                    cancelled = true;
                    setStatus("expired");
                } else if (res.status === "failed") {
                    cancelled = true;
                    setStatus("failed");
                    setErrorMessage(res.error || "绑定失败");
                } else if (res.status === "scanned") {
                    setStatus("scanned");
                }
            } catch {
                // 忽略偶发网络抖动
            }
        };

        const timer = window.setInterval(poll, 1500);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [open, ticketData?.ticket, status, message]);

    const handleCopyCode = async () => {
        if (!ticketData?.code) return;
        try {
            await navigator.clipboard.writeText(ticketData.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            message.success("绑定码已复制");
        } catch {
            message.error("复制失败");
        }
    };

    return (
        <Modal
            open={open}
            onCancel={onCancel}
            footer={null}
            title="绑定微信账号"
            centered
            width={400}
            destroyOnHidden
        >
            <div className="flex flex-col items-center justify-center gap-4 py-4 text-center">
                {/* 运行环境切换：正式版 vs 体验版 */}
                <div className="flex flex-col items-center gap-1.5">
                    <div className="flex items-center rounded-lg bg-muted/60 p-0.5 text-xs">
                        <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleEnvChange("release")}
                            className={cn(
                                "rounded-md px-3.5 py-1 font-medium transition-all",
                                envVersion === "release"
                                    ? "bg-background text-foreground shadow-sm font-semibold"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            正式版
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleEnvChange("trial")}
                            className={cn(
                                "rounded-md px-3.5 py-1 font-medium transition-all",
                                envVersion === "trial"
                                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            体验版 (测试)
                        </button>
                    </div>
                    {envVersion === "trial" ? (
                        <span className="text-[11px] text-amber-600/90 dark:text-amber-400/90 font-medium">
                            ⚠️ 体验版仅供开发者或体验成员扫码测试
                        </span>
                    ) : null}
                </div>

                {loading ? (
                    <div className="flex size-52 flex-col items-center justify-center gap-2">
                        <Spin />
                        <span className="text-xs text-muted-foreground">正在生成{envVersion === "trial" ? "体验版" : "正式版"}绑定码…</span>
                    </div>
                ) : errorMessage && !ticketData ? (
                    <div className="flex size-52 flex-col items-center justify-center gap-3">
                        <span className="text-xs text-red-500">{errorMessage}</span>
                        <Button size="small" icon={<RefreshCw className="size-3" />} onClick={() => void loadTicket()}>
                            重新获取
                        </Button>
                    </div>
                ) : (!ticketData?.manual && Boolean(ticketData?.qrImage) && viewMode === "qr") ? (
                    <div className="relative flex size-52 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white p-2 shadow-sm">
                        <img src={ticketData?.qrImage} alt="微信扫码绑定" className="size-full object-contain" />
                        {status === "expired" && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75 p-4 text-center text-white backdrop-blur-sm">
                                <span className="text-xs font-medium">二维码已过期</span>
                                <Button size="small" type="primary" icon={<RefreshCw className="size-3" />} onClick={() => void loadTicket()}>
                                    点击刷新
                                </Button>
                            </div>
                        )}
                        {status === "scanned" && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-emerald-950/80 p-4 text-center text-white backdrop-blur-sm">
                                <Check className="size-8 text-emerald-400" />
                                <span className="text-xs font-medium">已扫码，请在手机上确认绑定</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3">
                        <span className="text-xs text-foreground">
                            请在微信打开小程序，输入绑定验证码：
                        </span>
                        <div className="flex items-center gap-2">
                            <div className="rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/10 px-5 py-2.5 font-mono text-2xl font-bold tracking-widest text-emerald-600 dark:text-emerald-400">
                                {ticketData?.code}
                            </div>
                            <Button icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />} onClick={() => void handleCopyCode()}>
                                {copied ? "已复制" : "复制"}
                            </Button>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                            在小程序中确认绑定后，网页将自动完成关联
                        </span>
                    </div>
                )}

                {status === "pending" && (
                    <div className="flex flex-col items-center gap-1.5 text-center">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <QrCode className="size-3.5" />
                            <span>请使用本人微信扫码完成账号绑定</span>
                        </div>
                        {ticketData?.qrImage && !ticketData?.manual && (
                            <button
                                type="button"
                                className="text-[11px] text-muted-foreground/80 underline decoration-dotted transition-colors hover:text-foreground"
                                onClick={() => setViewMode(viewMode === "qr" ? "manual" : "qr")}
                            >
                                {viewMode === "qr" ? "无法扫码？切换为 6 位绑定码" : "返回小程序码扫码"}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
}
