import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Button, Form, Input, Switch, Alert, Spin, Tag, Card, Row, Col, Typography, Space, Tooltip } from "antd";
import { Send, RefreshCw, CheckCircle2, AlertCircle, Clock3, Globe, Users, Image as ImageIcon, Video, HardDrive, Bell, Check, Copy } from "lucide-react";

import { AdminPageFrame } from "@/pages/admin/components/admin-shell";
import { getWecomSetting, updateWecomSetting, testWecomNotification, previewWecomReport, type WecomSettingRequest } from "@/services/api/wecom";
import { cn } from "@/lib/utils";

const { Text, Paragraph } = Typography;

export default function WecomNotificationPage() {
    const { message } = App.useApp();
    const queryClient = useQueryClient();
    const [form] = Form.useForm<WecomSettingRequest>();
    const [testLoading, setTestLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // 读取企微配置
    const settingQuery = useQuery({
        queryKey: ["admin", "wecom", "settings"],
        queryFn: () => getWecomSetting(),
    });

    // 预览汇报数据
    const previewQuery = useQuery({
        queryKey: ["admin", "wecom", "preview"],
        queryFn: () => previewWecomReport(),
        refetchInterval: 60 * 1000,
    });

    const setting = settingQuery.data?.setting;
    const preview = previewQuery.data;

    useEffect(() => {
        if (setting) {
            form.setFieldsValue({
                enabled: setting.enabled,
                scheduleTime: setting.scheduleTime || "22:00",
                targetDomain: setting.targetDomain || "art.960916.xyz",
                mentionAll: setting.mentionAll || false,
            });
        }
    }, [form, setting]);

    // 保存设置
    const saveMutation = useMutation({
        mutationFn: updateWecomSetting,
        onSuccess: (data) => {
            message.success("企业微信机器人配置已保存");
            queryClient.setQueryData(["admin", "wecom", "settings"], data);
            queryClient.invalidateQueries({ queryKey: ["admin", "wecom"] });
            form.setFieldValue("webhookUrl", "");
        },
        onError: (err) => {
            message.error(err instanceof Error ? err.message : "保存设置失败");
        },
    });

    // 立即测试发送
    const handleTestSend = async () => {
        if (!setting?.hasWebhookUrl && !form.getFieldValue("webhookUrl")) {
            message.warning("请先配置并保存 Webhook 地址");
            return;
        }
        setTestLoading(true);
        try {
            const res = await testWecomNotification();
            if (res.sent) {
                message.success("测试简报已成功发送至企业微信群！");
            } else {
                message.error(`发送失败：${res.message}`);
            }
            await queryClient.invalidateQueries({ queryKey: ["admin", "wecom"] });
        } catch (err) {
            message.error(err instanceof Error ? err.message : "发送异常，请检查 Webhook 地址与网络");
        } finally {
            setTestLoading(false);
        }
    };

    const handleCopyContent = () => {
        if (!preview?.content) return;
        const text = preview.content;
        const markCopied = () => {
            setCopied(true);
            message.success("已复制简报文本内容");
            setTimeout(() => setCopied(false), 2000);
        };
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            navigator.clipboard.writeText(text).then(markCopied).catch(() => {
                const ta = document.createElement("textarea");
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                try {
                    document.execCommand("copy");
                    markCopied();
                } catch {
                    message.warning("复制失败，请手动选取文本复制");
                }
                document.body.removeChild(ta);
            });
        } else {
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand("copy");
                markCopied();
            } catch {
                message.warning("复制失败，请手动选取文本复制");
            }
            document.body.removeChild(ta);
        }
    };

    return (
        <AdminPageFrame
            title="企微简报"
            description="企业微信运行总结与生成情况每日汇报机器人，支持定时自动推送与纯文本高兼容格式"
            actions={
                <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                        icon={<RefreshCw className={cn("size-3.5", previewQuery.isFetching && "animate-spin")} />}
                        onClick={() => previewQuery.refetch()}
                        loading={previewQuery.isFetching}
                    >
                        刷新实时数据
                    </Button>
                    <Button
                        type="primary"
                        icon={<Send className="size-3.5" />}
                        onClick={handleTestSend}
                        loading={testLoading}
                    >
                        立即测试发送
                    </Button>
                </div>
            }
        >
            <div className="space-y-6">
                {/* 状态总览 Banner */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="text-xs font-medium">机器人状态</span>
                            <Bell className="size-4" />
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                            <Tag color={setting?.enabled ? "success" : "default"} className="px-2 py-0.5 text-xs font-medium">
                                {setting?.enabled ? "已启用定时" : "未启用"}
                            </Tag>
                            <span className="text-xs text-muted-foreground">
                                每天 {setting?.scheduleTime || "22:00"}
                            </span>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="text-xs font-medium">今日生成量</span>
                            <ImageIcon className="size-4" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-2xl font-bold tracking-tight text-foreground">
                                {preview?.data?.totalTasksToday ?? "--"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                (图 {preview?.data?.totalImagesToday ?? 0} / 视 {preview?.data?.totalVideosToday ?? 0})
                            </span>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="text-xs font-medium">今日生成成功率</span>
                            <CheckCircle2 className="size-4 text-emerald-500" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-2xl font-bold tracking-tight text-foreground">
                                {preview?.data?.totalTasksToday
                                    ? `${((preview.data.successTasks / preview.data.totalTasksToday) * 100).toFixed(1)}%`
                                    : "100.0%"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                成功 {preview?.data?.successTasks ?? 0} / 失败 {preview?.data?.failedTasks ?? 0}
                            </span>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="text-xs font-medium">ESA 监控 (art.960916.xyz)</span>
                            <Globe className="size-4 text-sky-500" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-2xl font-bold tracking-tight text-foreground">
                                {preview?.data?.esaRequestCount != null ? preview.data.esaRequestCount.toLocaleString() : "--"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                次请求 / {preview?.data?.esaTrafficBytes ? `${(preview.data.esaTrafficBytes / (1024 * 1024)).toFixed(1)} MB` : "0 MB"}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    {/* 左侧：实时汇报文本预览 */}
                    <div className="lg:col-span-7">
                        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                            <div className="mb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <h3 className="text-sm font-semibold text-foreground">企业微信文本消息预览</h3>
                                    <Tag color="cyan" className="text-[10px]">msgtype: text</Tag>
                                </div>
                                <Button
                                    size="small"
                                    icon={copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                                    onClick={handleCopyContent}
                                >
                                    {copied ? "已复制" : "复制简报"}
                                </Button>
                            </div>

                            <p className="mb-3 text-xs text-muted-foreground">
                                发送采用企业微信标准文本消息格式，无 Markdown 排版割裂风险，兼容手机端、桌面端及弹窗预览。
                            </p>

                            {previewQuery.isLoading ? (
                                <div className="flex h-72 items-center justify-center">
                                    <Spin tip="正在实时汇总今日运行与流量数据..." />
                                </div>
                            ) : (
                                <div className="relative rounded-lg bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-100 shadow-inner overflow-x-auto select-text">
                                    <pre className="whitespace-pre-wrap break-all">{preview?.content || "暂无简报内容"}</pre>
                                </div>
                            )}

                            {setting?.lastSentAt ? (
                                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                                    <Clock3 className="size-3.5" />
                                    <span>上次发送时间：{new Date(setting.lastSentAt).toLocaleString()}</span>
                                    <span>·</span>
                                    <span>状态：</span>
                                    <Tag color={setting.lastSentStatus === "success" ? "success" : "error"} className="text-[10px]">
                                        {setting.lastSentStatus === "success" ? "发送成功" : setting.lastSentStatus}
                                    </Tag>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {/* 右侧：机器人与定时配置表单 */}
                    <div className="lg:col-span-5">
                        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                            <h3 className="mb-1.5 text-sm font-semibold text-foreground">通知机器人设置</h3>
                            <p className="mb-4 text-xs text-muted-foreground">
                                在企业微信群创建自定义机器人后，复制其 Webhook 地址填入即可。
                            </p>

                            <Form
                                form={form}
                                layout="vertical"
                                onFinish={(values) => saveMutation.mutate(values)}
                            >
                                <Form.Item
                                    name="enabled"
                                    label="启用每日定时自动汇报"
                                    valuePropName="checked"
                                    extra="开启后将在指定时间自动汇聚全天业务、资源与流量数据并发往企业微信群。"
                                >
                                    <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                                </Form.Item>

                                <Form.Item
                                    name="webhookUrl"
                                    label="企业微信 Webhook 地址"
                                    extra={
                                        setting?.hasWebhookUrl
                                            ? `当前已配置：${setting.webhookUrl}（留空表示不修改原密钥）`
                                            : "格式示例：https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxx"
                                    }
                                >
                                    <Input.Password
                                        placeholder={setting?.hasWebhookUrl ? "已配置，输入新地址将覆盖" : "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."}
                                    />
                                </Form.Item>

                                <Form.Item
                                    name="scheduleTime"
                                    label="每日定时推送时间 (北京时间)"
                                    extra="每天在此时间点自动触发汇总推送（24小时制，如 22:00）。"
                                    rules={[{ required: true, message: "请输入时间格式，如 22:00" }]}
                                >
                                    <Input placeholder="22:00" />
                                </Form.Item>

                                <Form.Item
                                    name="targetDomain"
                                    label="ESA 流量统计域名"
                                    extra="仅统计指定域名的当天请求数与出站流量，默认对齐主站 art.960916.xyz。"
                                >
                                    <Input placeholder="art.960916.xyz" />
                                </Form.Item>

                                <Form.Item
                                    name="mentionAll"
                                    label="推送时 @所有人"
                                    valuePropName="checked"
                                >
                                    <Switch checkedChildren="是" unCheckedChildren="否" />
                                </Form.Item>

                                <div className="pt-2 flex items-center justify-end gap-3">
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        loading={saveMutation.isPending}
                                    >
                                        保存机器人设置
                                    </Button>
                                </div>
                            </Form>
                        </div>
                    </div>
                </div>
            </div>
        </AdminPageFrame>
    );
}
