import { useCallback, useEffect, useRef, useState } from "react";
import { App, Button, QRCode, Spin } from "antd";
import { Check, Copy, QrCode, RefreshCw } from "lucide-react";

import { getAuthSession, getAuthSettings, getWechatQRTicket, getWechatTicketStatus, type WechatQRTicketData } from "@/services/api/auth";
import { cn } from "@/lib/utils";

function getBrowserSearchParam(key: string): string {
    if (typeof window === "undefined") return "";
    try {
        return new URLSearchParams(window.location.search).get(key) || "";
    } catch {
        return "";
    }
}

export function WechatQRLogin({ next = "/", invite }: { next?: string; invite?: string }) {
    const { message } = App.useApp();
    const [ticketData, setTicketData] = useState<WechatQRTicketData | null>(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<"pending" | "scanned" | "confirmed" | "failed" | "expired">("pending");
    const [errorMessage, setErrorMessage] = useState("");
    const [copied, setCopied] = useState(false);
    const [viewMode, setViewMode] = useState<"qr" | "manual">("qr");
    const [envVersion, setEnvVersion] = useState<"release" | "trial">("release");
    const [allowTrial, setAllowTrial] = useState(() => {
        return getBrowserSearchParam("trial") === "1" || getBrowserSearchParam("env") === "trial";
    });
    const timerRef = useRef<number | null>(null);

    const safeRedirect = (target: string) => {
        if (typeof window !== "undefined") {
            window.location.assign(target);
        }
    };

    useEffect(() => {
        void getAuthSettings()
            .then((settings) => {
                if (settings.wechatTrialEnabled || getBrowserSearchParam("trial") === "1" || getBrowserSearchParam("env") === "trial") {
                    setAllowTrial(true);
                }
            })
            .catch(() => {});
    }, []);

    const loadTicket = useCallback(async (targetEnv?: "release" | "trial") => {
        setLoading(true);
        setStatus("pending");
        setErrorMessage("");
        const reqEnv = targetEnv || envVersion;
        try {
            const data = await getWechatQRTicket("login", invite, reqEnv);
            setTicketData(data);
            if (data.envVersion === "release" || data.envVersion === "trial") {
                setEnvVersion(data.envVersion);
            }
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : "获取微信登录二维码失败");
        } finally {
            setLoading(false);
        }
    }, [invite, envVersion]);

    const handleEnvChange = (env: "release" | "trial") => {
        if (env === envVersion || loading) return;
        setEnvVersion(env);
        void loadTicket(env);
    };

    useEffect(() => {
        void loadTicket();
    }, []);

    // 轮询票据状态
    useEffect(() => {
        const ticketId = ticketData?.ticket;
        if (!ticketId || status === "confirmed" || status === "expired" || status === "failed") {
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
                    const { applyUserSession } = await import("@/lib/user-session");
                    await applyUserSession(await getAuthSession());
                    message.success("微信登录成功！");
                    safeRedirect(next || "/");
                } else if (res.status === "expired") {
                    cancelled = true;
                    setStatus("expired");
                } else if (res.status === "failed") {
                    cancelled = true;
                    setStatus("failed");
                    setErrorMessage(res.error || "授权失败");
                } else if (res.status === "scanned") {
                    setStatus("scanned");
                }
            } catch {
                // 网络偶发波动，继续轮询
            }
        };

        const timer = window.setInterval(poll, 1500);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [ticketData?.ticket, status, message]);

    const handleCopyCode = async () => {
        if (!ticketData?.code) return;
        try {
            await navigator.clipboard.writeText(ticketData.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            message.success("登录码已复制");
        } catch {
            message.error("复制失败");
        }
    };

    const showQR = !ticketData?.manual && Boolean(ticketData?.qrImage) && viewMode === "qr";

    return (
        <div className="flex flex-col items-center justify-center gap-4 py-2">
            {/* 环境版本独立切换器：仅在后台开启体验版测试入口或带 ?trial=1 参数时展示 */}
            {allowTrial ? (
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
                        <span className="text-[11px] text-amber-600/90 dark:text-amber-400/90 font-medium text-center">
                            ⚠️ 体验版小程序码仅供开发者或体验成员扫码测试
                        </span>
                    ) : null}
                </div>
            ) : null}

            {loading ? (
                <div className="flex size-52 flex-col items-center justify-center gap-3">
                    <Spin size="large" />
                    <span className="text-xs text-muted-foreground">正在生成{envVersion === "trial" ? "体验版" : "正式版"}小程序码…</span>
                </div>
            ) : errorMessage && !ticketData ? (
                <div className="flex size-52 flex-col items-center justify-center gap-3 text-center">
                    <span className="text-xs text-red-500">{errorMessage}</span>
                    <Button icon={<RefreshCw className="size-3.5" />} onClick={() => void loadTicket()}>
                        重新获取
                    </Button>
                </div>
            ) : (
                /* 二维码与授权码模式：始终呈现完整的扫码交互 */
                <div className="flex flex-col items-center gap-3">
                    <div className="relative flex size-52 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white p-2 shadow-sm">
                        {ticketData?.qrImage ? (
                            <img src={ticketData.qrImage} alt="微信扫码登录" className="size-full object-contain" />
                        ) : (
                            <div className="flex flex-col items-center justify-center p-1">
                                <QRCode
                                    value={ticketData?.code ? `https://mexai.cc/wechat-login?t=${ticketData.ticket}&c=${ticketData.code}` : "https://mexai.cc"}
                                    size={184}
                                    bordered={false}
                                />
                            </div>
                        )}
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
                                <span className="text-xs font-medium">已扫码，请在手机上确认</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-muted-foreground">登录授权码：</span>
                        <div className="rounded-lg border border-dashed border-emerald-500/40 bg-emerald-500/10 px-3.5 py-1 font-mono text-lg font-bold tracking-widest text-emerald-600 dark:text-emerald-400">
                            {ticketData?.code}
                        </div>
                        <Button
                            size="small"
                            icon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                            onClick={() => void handleCopyCode()}
                        >
                            {copied ? "已复制" : "复制"}
                        </Button>
                    </div>
                    <span className="text-[11px] text-muted-foreground text-center max-w-[240px]">
                        {ticketData?.qrImage ? "微信扫一扫自动登录；或在小程序内输入上方 6 位授权码" : "请打开小程序输入上方授权码确认登录"}
                    </span>
                </div>
            )}

            {status === "pending" && (
                <div className="flex flex-col items-center gap-1.5 text-center">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <QrCode className="size-3.5" />
                        <span>微信扫一扫，在手机上点击确认即可登录</span>
                    </div>
                </div>
            )}
        </div>
    );
}
