import { useEffect, useState, type ReactNode } from "react";
import { Alert, App, Button, Image as AntImage, Input, Skeleton, Tabs, Typography } from "antd";
import { AdminEmpty, AdminStatusBadge } from "@/pages/admin/components/admin-ui";
import { AdminDrawer } from "@/pages/admin/ui/overlays";
import { Activity, Clipboard, Download, ExternalLink, HardDriveUpload, Image as ImageIcon, Link2, Music, Play, RefreshCw, Save, Video } from "lucide-react";
import { formatCredits } from "@/constant/credits";
import { getAdminApiLog, queryAdminApiLogTask, recoverAdminApiLogTaskMedia, recoverAdminApiLogVideoByURL, type ApiCallLog } from "@/services/api/auth";
import { videoRecoveryAvailable } from "../logs/log-view";

export function ApiLogDetailDrawer({ logId, onClose, onLogUpdated }: { logId: string | null; onClose: () => void; onLogUpdated?: (log: ApiCallLog) => void }) {
    const { message, modal } = App.useApp();
    const [log, setLog] = useState<ApiCallLog | null>(null);
    const [loading, setLoading] = useState(false);
    const [querying, setQuerying] = useState(false);
    const [providerRequestId, setProviderRequestId] = useState("");
    const [videoURL, setVideoURL] = useState("");
    const [resultText, setResultText] = useState("");

    const refresh = async (id: string) => {
        const refreshed = await getAdminApiLog(id);
        setLog(refreshed.log);
        setProviderRequestId(refreshed.log.providerRequestId || "");
        onLogUpdated?.(refreshed.log);
        return refreshed.log;
    };

    useEffect(() => {
        if (!logId) return;
        let active = true;
        setLoading(true);
        setLog(null);
        setResultText("");
        setVideoURL("");
        void getAdminApiLog(logId)
            .then((result) => {
                if (!active) return;
                setLog(result.log);
                setProviderRequestId(result.log.providerRequestId || "");
            })
            .catch((error) => active && message.error(error instanceof Error ? error.message : "读取请求详情失败"))
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, [logId, message]);

    const runQuery = async () => {
        if (!log) return;
        setQuerying(true);
        setResultText("");
        try {
            const result = await queryAdminApiLogTask(log.id, providerRequestId.trim() || undefined);
            await refresh(log.id);
            if (result.recovered) {
                window.dispatchEvent(new CustomEvent("wallet:updated"));
                setResultText(result.billingSettled ? "查询成功，视频已转存并完成结算。" : "视频已转存，计费状态待核对。");
                message.success("视频任务恢复成功");
            } else {
                setResultText(`上游仍在生成中${result.providerStatus ? `（${result.providerStatus}）` : ""}，暂不扣费。`);
            }
        } catch (error) {
            setResultText(error instanceof Error ? error.message : "查询上游任务失败");
        } finally {
            setQuerying(false);
        }
    };

    const runURLRecovery = async () => {
        if (!log || !videoURL.trim()) return;
        setQuerying(true);
        setResultText("");
        try {
            const result = await recoverAdminApiLogVideoByURL(log.id, videoURL.trim(), providerRequestId.trim() || undefined);
            await refresh(log.id);
            window.dispatchEvent(new CustomEvent("wallet:updated"));
            setResultText(result.billingSettled ? "视频已转存并完成结算。" : "视频已转存，计费状态待核对。");
            message.success("视频转存成功");
        } catch (error) {
            setResultText(error instanceof Error ? error.message : "视频转存失败");
        } finally {
            setQuerying(false);
        }
    };

    const runMediaRecovery = async (refundedBilling?: "charge" | "waive") => {
        if (!log) return;
        setQuerying(true);
        setResultText("");
        try {
            await recoverAdminApiLogTaskMedia(log.id, refundedBilling);
            await refresh(log.id);
            setResultText("已重新排队保存作品。对象存储仍不可用时会先保存到服务器，稍后自动同步。");
            message.success("已重新排队保存作品");
        } catch (error) {
            setResultText(error instanceof Error ? error.message : "恢复作品保存失败");
        } finally {
            setQuerying(false);
        }
    };

    const confirmMediaRecovery = (refundedBilling?: "charge" | "waive") => {
        if (!log) return;
        if (!refundedBilling) {
            void runMediaRecovery();
            return;
        }
        const charge = refundedBilling === "charge";
        modal.confirm({
            title: charge ? "恢复作品并补扣积分？" : "恢复作品并免除扣费？",
            content: charge ? `原订单已退回 ${formatCredits(log.billingReservedMicrocredits)} 积分预授权。作品保存成功后会从用户可用余额补扣，余额不足时会变为负数。` : "原订单保持已退回状态，作品保存成功后不再扣费。",
            okText: charge ? "恢复并补扣" : "恢复，不扣费",
            cancelText: "取消",
            onOk: () => runMediaRecovery(refundedBilling),
        });
    };

    const title = log ? (
        <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-500/12 text-blue-500">
                <Activity className="size-[18px]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
                <div className="truncate text-[var(--fs-body)] font-semibold text-foreground">请求日志详情</div>
                <div className="mt-0.5 truncate text-xs font-normal text-foreground/50">
                    {capabilityText(log.capability)} · {log.model || "未识别模型"} · {formatTime(log.startedAt || log.createdAt)}
                </div>
            </div>
        </div>
    ) : (
        "请求日志详情"
    );

    return (
        <AdminDrawer title={title} open={Boolean(logId)} onClose={onClose} size="min(1120px, 66vw)" className="api-log-detail-drawer-panel" rootClassName="api-log-detail-drawer">
            {loading ? (
                <Skeleton active paragraph={{ rows: 10 }} />
            ) : log ? (
                <LogDetail
                    log={log}
                    providerRequestId={providerRequestId}
                    videoURL={videoURL}
                    resultText={resultText}
                    querying={querying}
                    onProviderRequestIdChange={setProviderRequestId}
                    onVideoURLChange={setVideoURL}
                    onQuery={runQuery}
                    onRecoverURL={runURLRecovery}
                    onRecoverMedia={confirmMediaRecovery}
                />
            ) : (
                <AdminEmpty size="compact" title="没有请求详情" />
            )}
        </AdminDrawer>
    );
}

type LogDetailProps = {
    log: ApiCallLog;
    providerRequestId: string;
    videoURL: string;
    resultText: string;
    querying: boolean;
    onProviderRequestIdChange: (value: string) => void;
    onVideoURLChange: (value: string) => void;
    onQuery: () => void;
    onRecoverURL: () => void;
    onRecoverMedia: (refundedBilling?: "charge" | "waive") => void;
};

function LogDetail({ log, providerRequestId, videoURL, resultText, querying, onProviderRequestIdChange, onVideoURLChange, onQuery, onRecoverURL, onRecoverMedia }: LogDetailProps) {
    const mediaRecoverable = log.taskStatus === "failed" && Boolean(log.mediaStage) && log.mediaStage !== "completed";
    const refunded = log.billingStatus === "refunded";
    const providerStatus = log.providerStatus?.toLowerCase();
    const processing = ["queued", "pending", "processing", "running", "in_progress"].includes(providerStatus || "");
    const failed = log.status === "failed" || ["failed", "cancelled", "expired"].includes(providerStatus || "");
    const status = failed ? { label: "失败", tone: "error" as const } : processing ? { label: "处理中", tone: "warning" as const } : { label: "成功", tone: "success" as const };

    return (
        <div className="api-log-detail-body">
            <section className="api-log-detail-section">
                <div className="api-log-detail-section-heading">
                    <div>
                        <div className="api-log-detail-eyebrow">REQUEST OVERVIEW</div>
                        <h2>请求概览</h2>
                    </div>
                    <AdminStatusBadge label={status.label} tone={status.tone} />
                </div>
                <div className="api-log-detail-summary-grid">
                    <InfoItem label="能力类型" value={capabilityText(log.capability)} />
                    <InfoItem label="请求阶段" value={requestKindText(log.requestKind)} />
                    <InfoItem label="模型 / 渠道" value={`${log.model || "未识别模型"} / ${log.channelName || "未记录渠道"}`} />
                    <InfoItem label="用户" value={log.userDisplayName || log.userAccount || "未知用户"} detail={log.userAccount ? `@${log.userAccount}` : undefined} />
                    <InfoItem label="任务状态" value={mediaDeliveryText(log)} />
                    <InfoItem label="计费" value={billingText(log)} />
                    <InfoItem label="请求 ID" value={<CopyValue value={log.id} />} />
                    <InfoItem label="任务 ID" value={log.taskId ? <CopyValue value={log.taskId} /> : "未记录"} />
                    <InfoItem label="供应商任务 ID" value={log.providerRequestId ? <CopyValue value={log.providerRequestId} /> : "未记录"} />
                    <InfoItem label="耗时" value={<span className="tabular-nums">{formatDuration(log.durationMs)}</span>} />
                    <InfoItem label="HTTP 状态" value={log.statusCode || "未记录"} />
                    <InfoItem
                        label="请求地址"
                        value={
                            <span className="break-all font-mono text-xs">
                                {log.method} {log.path || "未记录"}
                            </span>
                        }
                    />
                    <InfoItem label="上游渠道 URL" value={<span className="break-all font-mono text-xs">{log.upstreamUrl || "未记录"}</span>} />
                </div>
                {log.error || log.errorCode ? (
                    <div className="api-log-detail-error">
                        <div className="text-xs font-semibold text-red-500">{log.errorCode || `HTTP ${log.statusCode || "失败"}`}</div>
                        <div className="mt-1 text-sm text-foreground/70">{log.error || "上游未返回错误详情"}</div>
                    </div>
                ) : null}
            </section>

            <ResultMediaSection log={log} />

            {mediaRecoverable ? (
                <section className="api-log-detail-section api-log-recovery-section">
                    <div className="api-log-detail-section-heading">
                        <div className="flex items-center gap-2">
                            <div className="grid size-8 place-items-center rounded-md bg-amber-500/12 text-amber-500">
                                <HardDriveUpload className="size-4" aria-hidden="true" />
                            </div>
                            <div>
                                <div className="api-log-detail-eyebrow">MEDIA DELIVERY</div>
                                <h2>作品保存恢复</h2>
                            </div>
                        </div>
                        <span className="text-xs text-foreground/45">作品已生成，不会重新生成</span>
                    </div>
                    <div className="api-log-recovery-body">
                        <div className="api-log-recovery-row">
                            <div className="api-log-recovery-label">
                                <span>重新保存作品</span>
                                <small>{refunded ? "原订单已退回，请选择恢复后是否补扣" : "保存成功后按原订单结算"}</small>
                            </div>
                            {refunded ? (
                                <>
                                    <Button icon={<Save className="size-3.5" />} loading={querying} onClick={() => onRecoverMedia("waive")}>
                                        恢复，不扣费
                                    </Button>
                                    <Button type="primary" icon={<Save className="size-3.5" />} loading={querying} onClick={() => onRecoverMedia("charge")}>
                                        恢复并补扣
                                    </Button>
                                </>
                            ) : (
                                <Button type="primary" icon={<Save className="size-3.5" />} loading={querying} onClick={() => onRecoverMedia()}>
                                    重新保存
                                </Button>
                            )}
                        </div>
                        {resultText ? <Alert className="api-log-recovery-result" type={resultText.includes("失败") || resultText.includes("错误") || resultText.includes("请") ? "error" : "success"} showIcon message={resultText} /> : null}
                    </div>
                </section>
            ) : null}

            {videoRecoveryAvailable(log) ? (
                <section className="api-log-detail-section api-log-recovery-section">
                    <div className="api-log-detail-section-heading">
                        <div className="flex items-center gap-2">
                            <div className="grid size-8 place-items-center rounded-md bg-violet-500/12 text-violet-500">
                                <Video className="size-4" aria-hidden="true" />
                            </div>
                            <div>
                                <div className="api-log-detail-eyebrow">VIDEO RECOVERY</div>
                                <h2>视频任务恢复</h2>
                            </div>
                        </div>
                        <span className="text-xs text-foreground/45">失败任务可用</span>
                    </div>
                    <div className="api-log-recovery-body">
                        <div className="api-log-recovery-row">
                            <div className="api-log-recovery-label">
                                <span>供应商任务 ID</span>
                                <small>默认使用当前记录，可手动覆盖</small>
                            </div>
                            <Input className="api-log-recovery-input" value={providerRequestId} onChange={(event) => onProviderRequestIdChange(event.target.value)} placeholder="输入供应商任务 ID" />
                            <Button type="primary" icon={<RefreshCw className="size-3.5" />} loading={querying} onClick={onQuery}>
                                查询上游任务
                            </Button>
                        </div>
                        <div className="api-log-recovery-row">
                            <div className="api-log-recovery-label">
                                <span>视频 URL 转存</span>
                                <small>仅支持公网 HTTP / HTTPS 视频地址</small>
                            </div>
                            <Input className="api-log-recovery-input" prefix={<Link2 className="size-4 text-foreground/35" />} value={videoURL} onChange={(event) => onVideoURLChange(event.target.value)} placeholder="https://example.com/video.mp4" />
                            <Button icon={<Save className="size-3.5" />} loading={querying} disabled={!videoURL.trim()} onClick={onRecoverURL}>
                                转存并回写
                            </Button>
                        </div>
                        {resultText ? <Alert className="api-log-recovery-result" type={resultText.includes("失败") || resultText.includes("错误") ? "error" : resultText.includes("生成中") ? "warning" : "success"} showIcon message={resultText} /> : null}
                    </div>
                </section>
            ) : null}

            <section className="api-log-detail-section api-log-payload-section">
                <div className="api-log-detail-section-heading">
                    <div>
                        <div className="api-log-detail-eyebrow">RAW PAYLOAD</div>
                        <h2>请求报文</h2>
                    </div>
                    <span className="text-xs text-foreground/45">{log.requestBody || log.responseBody ? "可复制原始内容" : "暂无报文"}</span>
                </div>
                <Tabs
                    items={[
                        { key: "request", label: "请求", children: <PayloadPanel value={log.requestBody} empty="该请求未记录请求报文" /> },
                        { key: "response", label: "响应", children: <PayloadPanel value={log.responseBody} empty="该请求未记录响应报文" /> },
                    ]}
                />
            </section>
        </div>
    );
}

function InfoItem({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
    return (
        <div className="api-log-detail-info-item">
            <div className="api-log-detail-info-label">{label}</div>
            <div className="api-log-detail-info-value">{value}</div>
            {detail ? <div className="api-log-detail-info-detail">{detail}</div> : null}
        </div>
    );
}

function CopyValue({ value }: { value: string }) {
    return (
        <Typography.Text className="api-log-copy-value" copyable={{ text: value, tooltips: ["复制", "已复制"] }}>
            <code>{value}</code>
        </Typography.Text>
    );
}

function PayloadPanel({ value, empty }: { value?: string; empty: string }) {
    if (!value) return <AdminEmpty size="compact" title={empty} />;
    return (
        <div className="api-log-payload-wrap">
            <div className="api-log-payload-actions">
                <Typography.Text copyable={{ text: value, tooltips: ["复制报文", "已复制"] }}>
                    <Clipboard className="mr-1 inline size-3.5" />
                    复制报文
                </Typography.Text>
            </div>
            <pre className="api-log-payload">{value}</pre>
        </div>
    );
}

function billingText(log: ApiCallLog) {
    if (!log.billable) return "不计费";
    if (!log.billingAvailable) return "未扣积分";
    const labels = { settled: "已结算", refunded: "已退回", uncertain: "待核对", running: "运行中", reserved: "已预授权" } as const;
    const settled = log.billingSettledMicrocredits !== undefined ? `实收 ${formatCredits(log.billingSettledMicrocredits)}` : "未结算";
    return `预授权 ${formatCredits(log.billingReservedMicrocredits)} · ${settled} 积分 · ${labels[log.billingStatus || "reserved"]}`;
}

function mediaDeliveryText(log: ApiCallLog) {
    if (log.taskStatus === "succeeded") return log.mediaStage === "completed" ? "已保存并登记" : "任务成功";
    if (log.taskStatus === "failed") return "任务失败";
    return log.taskStatus || "未记录";
}

function requestKindText(value: ApiCallLog["requestKind"]) {
    const labels: Partial<Record<ApiCallLog["requestKind"], string>> = {
        create: "模型生成",
        poll: "状态查询",
        download: "结果下载",
        upload: "上传 OSS",
        local_save: "保存文件",
        local_fallback: "本地兜底保存",
        offload: "同步 OSS",
        register: "登记素材",
        repair: "结果修复",
    };
    return labels[value] || "上游请求";
}

function capabilityText(value: string) {
    return ({ text: "文本", image: "图片", video: "视频", audio: "音频" } as Record<string, string>)[value] || "未知";
}

function formatTime(value?: string) {
    return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "--";
}

function formatDuration(value: number) {
    if (value < 1_000) return `${value} ms`;
    if (value < 60_000) return `${(value / 1_000).toFixed(value < 10_000 ? 1 : 0)} 秒`;
    return `${Math.floor(value / 60_000)} 分 ${Math.round((value % 60_000) / 1_000)} 秒`;
}

function ResultMediaSection({ log }: { log: ApiCallLog }) {
    const isMedia = log.capability === "image" || log.capability === "video" || log.capability === "audio";
    const mediaItems = extractMediaFromLog(log);
    if (!isMedia && !mediaItems.length) return null;

    const authMediaUrl = `/api/admin/api-logs/${log.id}/media`;
    const hasDelivery = Boolean(log.mediaStage === "completed" || log.mediaPreviewUrl || log.taskId);

    return (
        <section className="api-log-detail-section">
            <div className="api-log-detail-section-heading">
                <div className="flex items-center gap-2">
                    <div className="grid size-8 place-items-center rounded-md bg-emerald-500/12 text-emerald-500">
                        {log.capability === "video" ? <Video className="size-4" /> : log.capability === "audio" ? <Music className="size-4" /> : <ImageIcon className="size-4" />}
                    </div>
                    <div>
                        <div className="api-log-detail-eyebrow">RESULT PREVIEW</div>
                        <h2>生成结果预览</h2>
                    </div>
                </div>
                <span className="text-xs text-foreground/45">{log.capability === "video" ? "视频结果" : log.capability === "audio" ? "音频结果" : "图片结果"}</span>
            </div>
            <div className="rounded-xl border border-white/8 bg-black/20 p-4">
                {log.capability === "video" ? (
                    <div className="space-y-3">
                        <video controls className="max-h-[360px] w-full rounded-lg bg-black object-contain shadow-md" src={mediaItems[0] || authMediaUrl} poster={log.mediaPreviewKind === "image" ? log.mediaPreviewUrl : undefined} />
                        <div className="flex items-center justify-between text-xs text-foreground/50 pt-1">
                            <span>视频预览（支持直接播放）</span>
                            <div className="flex items-center gap-3">
                                <a href={mediaItems[0] || authMediaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                                    <ExternalLink className="size-3.5" />
                                    <span>新标签页打开</span>
                                </a>
                                <a href={`${mediaItems[0] || authMediaUrl}?download=1`} download={`video_${log.id}.mp4`} className="inline-flex items-center gap-1 hover:text-foreground">
                                    <Download className="size-3.5" />
                                    <span>下载原文件</span>
                                </a>
                            </div>
                        </div>
                    </div>
                ) : log.capability === "audio" ? (
                    <div className="space-y-3 py-2">
                        <audio controls className="w-full" src={mediaItems[0] || authMediaUrl} />
                        <div className="flex items-center justify-between text-xs text-foreground/50 pt-1">
                            <span>音频试听</span>
                            <a href={`${mediaItems[0] || authMediaUrl}?download=1`} download={`audio_${log.id}.mp3`} className="inline-flex items-center gap-1 hover:text-foreground">
                                <Download className="size-3.5" />
                                <span>下载音频</span>
                            </a>
                        </div>
                    </div>
                ) : (
                    <div>
                        {mediaItems.length > 0 ? (
                            <AntImage.PreviewGroup>
                                <div className={`grid gap-3 ${mediaItems.length === 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
                                    {mediaItems.map((url, index) => (
                                        <div key={index} className="group relative overflow-hidden rounded-lg border border-white/10 bg-black/30 aspect-square flex items-center justify-center">
                                            <AntImage src={url} alt={`输出图片 ${index + 1}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                                        </div>
                                    ))}
                                </div>
                            </AntImage.PreviewGroup>
                        ) : hasDelivery ? (
                            <div className="flex flex-col items-center justify-center py-4 space-y-3">
                                <AntImage
                                    src={authMediaUrl}
                                    alt="生成结果"
                                    className="max-h-[300px] rounded-lg object-contain shadow"
                                    fallback="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><text x='50%' y='50%' fill='%23666' text-anchor='middle' dy='.3em'>点击预览</text></svg>"
                                />
                                <div className="flex items-center gap-3 text-xs text-foreground/50">
                                    <a href={authMediaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                                        <ExternalLink className="size-3.5" />
                                        <span>在新标签查看高清原图</span>
                                    </a>
                                </div>
                            </div>
                        ) : (
                            <div className="py-4 text-center text-xs text-foreground/45">暂未从响应报文中提取到已物化的媒体直链</div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}

function extractMediaFromLog(log: ApiCallLog): string[] {
    const urls: string[] = [];
    if (log.mediaPreviewUrl?.trim()) {
        urls.push(log.mediaPreviewUrl.trim());
    }
    if (!log.responseBody?.trim()) return urls;

    try {
        const data = JSON.parse(log.responseBody);
        // 1. OpenAI 格式: { data: [{ url?: "...", b64_json?: "..." }] }
        if (Array.isArray(data.data)) {
            for (const item of data.data) {
                if (item?.url) urls.push(String(item.url));
                else if (item?.b64_json) urls.push(`data:image/png;base64,${item.b64_json}`);
            }
        }
        // 2. Gemini 格式: candidates[0].content.parts[].inlineData.data
        if (Array.isArray(data.candidates?.[0]?.content?.parts)) {
            for (const part of data.candidates[0].content.parts) {
                const inline = part.inlineData || part.inline_data;
                if (inline?.data) {
                    const mime = inline.mimeType || inline.mime_type || "image/png";
                    urls.push(`data:${mime};base64,${inline.data}`);
                }
            }
        }
        // 3. 常见直接返回: { url: "..." } 或 { video_url: "..." }
        if (typeof data.url === "string" && data.url.startsWith("http")) urls.push(data.url);
        if (typeof data.video_url === "string" && data.video_url.startsWith("http")) urls.push(data.video_url);
        if (typeof data.image_url === "string" && data.image_url.startsWith("http")) urls.push(data.image_url);
        // 4. images 数组
        if (Array.isArray(data.images)) {
            for (const img of data.images) {
                if (typeof img === "string" && (img.startsWith("http") || img.startsWith("data:"))) urls.push(img);
                else if (img?.url) urls.push(String(img.url));
                else if (img?.dataUrl) urls.push(String(img.dataUrl));
            }
        }
    } catch {
        // 非标准 JSON
    }
    return Array.from(new Set(urls.filter(Boolean)));
}
