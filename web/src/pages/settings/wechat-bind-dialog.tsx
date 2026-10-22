import { useCallback, useEffect, useRef, useState } from "react";
import { App, Button, Modal, Spin } from "antd";
import { Check, Copy, QrCode, RefreshCw } from "lucide-react";

import { getWechatQRTicket, getWechatTicketStatus, type WechatQRTicketData } from "@/services/api/auth";

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
    const timerRef = useRef<number | null>(null);

    const loadTicket = useCallback(async () => {
        setLoading(true);
        setStatus("pending");
        setErrorMessage("");
        try {
            const data = await getWechatQRTicket("bind");
            setTicketData(data);
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : "获取微信绑定码失败");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (open) {
            void loadTicket();
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            setTicketData(null);
            setStatus("pending");
        }
    }, [open, loadTicket]);

    useEffect(() => {
        if (!open || !ticketData?.ticket || status === "confirmed" || status === "expired" || status === "failed") {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        const poll = async () => {
            try {
                const res = await getWechatTicketStatus(ticketData.ticket);
                if (res.status === "confirmed") {
                    setStatus("confirmed");
                    if (timerRef.current) clearInterval(timerRef.current);
                    message.success("微信账号绑定成功！");
                    onSuccess();
                    onCancel();
                } else if (res.status === "expired") {
                    setStatus("expired");
                    if (timerRef.current) clearInterval(timerRef.current);
                } else if (res.status === "failed") {
                    setStatus("failed");
                    setErrorMessage(res.error || "绑定失败");
                    if (timerRef.current) clearInterval(timerRef.current);
                } else if (res.status === "scanned") {
                    setStatus("scanned");
                }
            } catch {
                // ignore
            }
        };

        timerRef.current = window.setInterval(poll, 1500);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [open, ticketData?.ticket, status, onSuccess, onCancel, message]);

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
                {loading ? (
                    <div className="flex h-52 flex-col items-center justify-center gap-2">
                        <Spin />
                        <span className="text-xs text-muted-foreground">正在生成绑定凭证…</span>
                    </div>
                ) : errorMessage && !ticketData ? (
                    <div className="flex h-52 flex-col items-center justify-center gap-3">
                        <span className="text-xs text-red-500">{errorMessage}</span>
                        <Button size="small" icon={<RefreshCw className="size-3" />} onClick={() => void loadTicket()}>
                            重新获取
                        </Button>
                    </div>
                ) : ticketData?.manual ? (
                    <div className="flex flex-col items-center gap-3">
                        <span className="text-xs text-foreground">
                            请在微信打开小程序，输入绑定验证码：
                        </span>
                        <div className="flex items-center gap-2">
                            <div className="rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/10 px-5 py-2.5 font-mono text-2xl font-bold tracking-widest text-emerald-600 dark:text-emerald-400">
                                {ticketData.code}
                            </div>
                            <Button icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />} onClick={() => void handleCopyCode()}>
                                {copied ? "已复制" : "复制"}
                            </Button>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                            在小程序中确认绑定后，网页将自动完成关联
                        </span>
                    </div>
                ) : ticketData?.qrImage ? (
                    <div className="relative flex size-52 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white p-2 shadow-sm">
                        <img src={ticketData.qrImage} alt="微信扫码绑定" className="size-full object-contain" />
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
                ) : null}

                {status === "pending" && !ticketData?.manual && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <QrCode className="size-3.5" />
                        <span>请使用本人微信扫码完成账号绑定</span>
                    </div>
                )}
            </div>
        </Modal>
    );
}
