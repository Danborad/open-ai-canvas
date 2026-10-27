import { useCallback, useEffect, useMemo, useState } from "react";
import { App, Button, Input, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Check, Coins, Copy, Gift, Link2, Sparkles, Users } from "lucide-react";

import { PaginationBar, TableSurface } from "@/components/layout/workspace-page";
import { WorkspaceState } from "@/components/layout/workspace-state";
import {
    getPromotionOverview,
    listPromotionInvitations,
    type PromotionInvitationItem,
    type PromotionInvitationPage,
    type PromotionOverview,
} from "@/services/api/promotion";

export default function PromotionPage() {
    const { message } = App.useApp();
    const [overview, setOverview] = useState<PromotionOverview | null>(null);
    const [loadingOverview, setLoadingOverview] = useState(true);
    const [copiedCode, setCopiedCode] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    // 邀请好友列表状态
    const [invitationsPage, setInvitationsPage] = useState<PromotionInvitationPage | null>(null);
    const [loadingInvitations, setLoadingInvitations] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const loadOverview = useCallback(async () => {
        setLoadingOverview(true);
        try {
            const { overview: data } = await getPromotionOverview();
            setOverview(data);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取推广中心数据失败");
        } finally {
            setLoadingOverview(false);
        }
    }, [message]);

    const loadInvitations = useCallback(
        async (targetPage = page, targetPageSize = pageSize) => {
            setLoadingInvitations(true);
            try {
                const data = await listPromotionInvitations({ page: targetPage, pageSize: targetPageSize });
                setInvitationsPage(data);
            } catch (error) {
                message.error(error instanceof Error ? error.message : "读取邀请记录失败");
            } finally {
                setLoadingInvitations(false);
            }
        },
        [message, page, pageSize],
    );

    useEffect(() => {
        void loadOverview();
    }, [loadOverview]);

    useEffect(() => {
        void loadInvitations(page, pageSize);
    }, [loadInvitations, page, pageSize]);

    const inviteLink = useMemo(() => {
        if (!overview?.inviteCode) return "";
        if (typeof window === "undefined") return `/register?invite=${overview.inviteCode}`;
        return `${window.location.origin}/register?invite=${overview.inviteCode}`;
    }, [overview?.inviteCode]);

    const copyText = async (text: string, isLink: boolean) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            if (isLink) {
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
            } else {
                setCopiedCode(true);
                setTimeout(() => setCopiedCode(false), 2000);
            }
            message.success(isLink ? "推广注册链接已复制到剪贴板" : "邀请码已复制");
        } catch {
            message.error("复制失败，请手动选取复制");
        }
    };

    const columns: ColumnsType<PromotionInvitationItem> = [
        {
            title: "好友昵称",
            dataIndex: "inviteeName",
            key: "inviteeName",
            render: (value, record) => value || record.inviteeContact || "新用户",
        },
        {
            title: "账号信息",
            dataIndex: "inviteeContact",
            key: "inviteeContact",
            render: (value) => <span className="font-mono text-muted-foreground">{value || "—"}</span>,
        },
        {
            title: "注册时间",
            dataIndex: "createdAt",
            key: "createdAt",
            render: (value: string) => {
                if (!value) return "—";
                return new Date(value).toLocaleString("zh-CN", { hour12: false });
            },
        },
        {
            title: "推广奖励",
            dataIndex: "rewardCredits",
            key: "rewardCredits",
            align: "right",
            render: (value: number) => (
                <span className="font-semibold text-[var(--accent-text)]">
                    +{value > 0 ? value : overview?.inviterRewardCredits || 100} 积分
                </span>
            ),
        },
    ];

    if (loadingOverview && !overview) {
        return (
            <div className="flex h-full w-full items-center justify-center p-8">
                <WorkspaceState icon="loading" title="正在加载推广中心" description="正在读取您的专属邀请码与推广奖励统计…" />
            </div>
        );
    }

    return (
        <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-6 overflow-y-auto p-6 md:p-8">
            {/* 顶栏标题与介绍 */}
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-[var(--r-md)] bg-[var(--accent-surface)] text-[var(--accent)]">
                        <Gift className="size-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">邀请中心</h1>
                        <p className="text-sm text-muted-foreground">
                            邀请好友注册影策创作平台，好友注册即送积分，您立享丰厚邀请奖励，直接到账可用！
                        </p>
                    </div>
                </div>
            </div>

            {/* 核心邀请工具卡片与规则 Banner */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* 专属邀请链接与邀请码 */}
                <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">我的专属推广方式</span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-surface)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">
                                <Sparkles className="size-3" /> 长期有效
                            </span>
                        </div>

                        {/* 邀请链接复制 */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground">专属推广链接（好友点击直接带码注册）</label>
                            <div className="flex gap-2">
                                <Input
                                    readOnly
                                    value={inviteLink}
                                    prefix={<Link2 className="size-4 text-muted-foreground" />}
                                    className="font-mono text-xs selection:bg-[var(--accent-surface)]"
                                />
                                <Button
                                    type="primary"
                                    icon={copiedLink ? <Check className="size-4" /> : <Copy className="size-4" />}
                                    onClick={() => void copyText(inviteLink, true)}
                                >
                                    {copiedLink ? "已复制" : "复制链接"}
                                </Button>
                            </div>
                        </div>

                        {/* 专属邀请码 */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground">专属邀请码（手填注册使用）</label>
                            <div className="flex items-center gap-3">
                                <div className="inline-block rounded-lg border border-dashed border-[var(--accent)] bg-[var(--accent-surface)]/40 px-4 py-2 font-mono text-lg font-bold tracking-widest text-[var(--accent-text)]">
                                    {overview?.inviteCode || "—"}
                                </div>
                                <Button
                                    icon={copiedCode ? <Check className="size-4" /> : <Copy className="size-4" />}
                                    onClick={() => void copyText(overview?.inviteCode || "", false)}
                                >
                                    {copiedCode ? "已复制" : "复制邀请码"}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* 奖励规则简报 */}
                    <div className="flex flex-wrap items-center gap-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5 text-foreground font-medium">
                            <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 font-bold">1</span>
                            每成功邀请 1 人：您得 <span className="text-emerald-600 font-bold">+{overview?.inviterRewardCredits || 100} 积分</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-foreground font-medium">
                            <span className="flex size-5 items-center justify-center rounded-full bg-blue-500/15 text-blue-600 font-bold">2</span>
                            受邀好友注册：立享 <span className="text-blue-600 font-bold">+{overview?.inviteeRewardCredits || 50} 专属新人积分</span>
                        </div>
                    </div>
                </div>

                {/* 推广战绩卡 */}
                <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">我的推广收益</span>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3.5">
                            <div className="flex items-center gap-2.5">
                                <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600">
                                    <Users className="size-4" />
                                </div>
                                <span className="text-sm font-medium text-muted-foreground">已成功邀请</span>
                            </div>
                            <span className="font-mono text-2xl font-bold text-foreground">
                                {overview?.invitedCount || 0} <span className="text-xs font-normal text-muted-foreground">人</span>
                            </span>
                        </div>

                        <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3.5">
                            <div className="flex items-center gap-2.5">
                                <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
                                    <Coins className="size-4" />
                                </div>
                                <span className="text-sm font-medium text-muted-foreground">累计获得奖励</span>
                            </div>
                            <span className="font-mono text-2xl font-bold text-emerald-600">
                                +{overview?.totalRewardCredits || 0} <span className="text-xs font-normal text-muted-foreground">积分</span>
                            </span>
                        </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                        奖励积分在好友注册成功时自动打入您的可用积分账户，无需申请提现，直接用于 AI 画布与视频生成。
                    </p>
                </div>
            </div>

            {/* 邀请记录明细 */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-foreground">邀请记录明细</h2>
                    <span className="text-xs text-muted-foreground">共 {invitationsPage?.total || 0} 条记录</span>
                </div>

                <TableSurface>
                    <Table
                        columns={columns}
                        dataSource={invitationsPage?.items || []}
                        rowKey="id"
                        loading={loadingInvitations}
                        pagination={false}
                        locale={{ emptyText: <WorkspaceState icon="empty" title="暂无邀请记录" description="赶快把专属推广链接分享给好友，一起体验 AI 影视创作吧！" /> }}
                    />
                    {(invitationsPage?.total || 0) > 0 && (
                        <PaginationBar
                            current={page}
                            pageSize={pageSize}
                            total={invitationsPage?.total || 0}
                            onChange={(p, ps) => {
                                setPage(p);
                                setPageSize(ps);
                            }}
                        />
                    )}
                </TableSurface>
            </div>
        </div>
    );
}
