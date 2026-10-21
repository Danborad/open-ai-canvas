import { useCallback, useEffect, useState } from "react";
import { App, Button, Form, InputNumber, Switch, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Coins, Gift, RefreshCw, Save, Users } from "lucide-react";

import { PaginationBar, TableSurface } from "@/components/layout/workspace-page";
import { AdminPageFrame } from "@/pages/admin/components/admin-shell";
import { WorkspaceState } from "@/components/layout/workspace-state";
import {
    getAdminPromotionPolicy,
    listAdminPromotionInvitations,
    updateAdminPromotionPolicy,
    type AdminPromotionInvitationPage,
    type AdminPromotionInvitationRow,
    type PromotionPolicy,
} from "@/services/api/promotion";

export default function AdminPromotionPage() {
    const { message } = App.useApp();
    const [policyForm] = Form.useForm<PromotionPolicy>();
    const [policy, setPolicy] = useState<PromotionPolicy | null>(null);
    const [savingPolicy, setSavingPolicy] = useState(false);
    const [loadingPolicy, setLoadingPolicy] = useState(true);

    const [invitationsPage, setInvitationsPage] = useState<AdminPromotionInvitationPage | null>(null);
    const [loadingInvitations, setLoadingInvitations] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const loadPolicy = useCallback(async () => {
        setLoadingPolicy(true);
        try {
            const { policy: data } = await getAdminPromotionPolicy();
            setPolicy(data);
            policyForm.setFieldsValue(data);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取推广策略失败");
        } finally {
            setLoadingPolicy(false);
        }
    }, [message, policyForm]);

    const loadInvitations = useCallback(
        async (targetPage = page, targetPageSize = pageSize) => {
            setLoadingInvitations(true);
            try {
                const data = await listAdminPromotionInvitations({ page: targetPage, pageSize: targetPageSize });
                setInvitationsPage(data);
            } catch (error) {
                message.error(error instanceof Error ? error.message : "读取全站邀请记录失败");
            } finally {
                setLoadingInvitations(false);
            }
        },
        [message, page, pageSize],
    );

    useEffect(() => {
        void loadPolicy();
    }, [loadPolicy]);

    useEffect(() => {
        void loadInvitations(page, pageSize);
    }, [loadInvitations, page, pageSize]);

    const handleSavePolicy = async (values: PromotionPolicy) => {
        setSavingPolicy(true);
        try {
            const { policy: updated } = await updateAdminPromotionPolicy(values);
            setPolicy(updated);
            policyForm.setFieldsValue(updated);
            message.success("推广送积分规则已保存生效");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存策略失败");
        } finally {
            setSavingPolicy(false);
        }
    };

    const columns: ColumnsType<AdminPromotionInvitationRow> = [
        {
            title: "邀请人（推广员）",
            key: "inviter",
            render: (_, record) => (
                <div className="flex flex-col">
                    <span className="font-medium text-foreground">{record.inviterName || "用户"}</span>
                    <span className="font-mono text-xs text-muted-foreground">{record.inviterContact || record.inviterId}</span>
                </div>
            ),
        },
        {
            title: "邀请码",
            dataIndex: "code",
            key: "code",
            render: (value) => <span className="font-mono font-semibold text-foreground tracking-wider">{value}</span>,
        },
        {
            title: "被邀请人（新用户）",
            key: "invitee",
            render: (_, record) => (
                <div className="flex flex-col">
                    <span className="font-medium text-foreground">{record.inviteeName || "新用户"}</span>
                    <span className="font-mono text-xs text-muted-foreground">{record.inviteeContact || record.inviteeId}</span>
                </div>
            ),
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
            title: "邀请人奖励",
            dataIndex: "rewardCredits",
            key: "rewardCredits",
            align: "right",
            render: (value: number) => (
                <span className="font-semibold text-emerald-600">
                    +{value > 0 ? value : policy?.inviterRewardCredits || 100} 积分
                </span>
            ),
        },
    ];

    return (
        <AdminPageFrame
            title="邀请中心"
            description="配置用户邀请好友注册送积分规则，查看全站用户邀请关系与奖励明细"
            scroll
            actions={
                <Button
                    icon={<RefreshCw className="size-3.5" />}
                    onClick={() => {
                        void loadPolicy();
                        void loadInvitations();
                    }}
                    loading={loadingPolicy || loadingInvitations}
                >
                    刷新数据
                </Button>
            }
        >
            <div className="space-y-6">
                {/* 规则配置卡片 */}
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                        <Gift className="size-4 text-[var(--accent)]" />
                        <h2 className="text-sm font-semibold text-foreground">推广注册奖励规则配置</h2>
                    </div>

                    <Form
                        form={policyForm}
                        layout="vertical"
                        onFinish={(values) => void handleSavePolicy(values)}
                        initialValues={{
                            enabled: true,
                            inviterRewardCredits: 100,
                            inviteeRewardCredits: 50,
                        }}
                    >
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <Form.Item
                                name="enabled"
                                label="开启推广注册送积分"
                                valuePropName="checked"
                                extra="关闭后新用户填邀请码注册将不再发放推广积分。"
                            >
                                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                            </Form.Item>

                            <Form.Item
                                name="inviterRewardCredits"
                                label="邀请人奖励积分（每人）"
                                rules={[{ required: true, message: "请输入邀请人奖励积分" }]}
                                extra="新用户成功注册后，直接打入邀请人的可用积分账户。"
                            >
                                <InputNumber min={0} max={100000} className="w-full" addonAfter="积分" />
                            </Form.Item>

                            <Form.Item
                                name="inviteeRewardCredits"
                                label="新人专属奖励积分（每人）"
                                rules={[{ required: true, message: "请输入新人专属奖励积分" }]}
                                extra="新用户填码注册后额外获赠的可用积分（与普通注册积分叠加）。"
                            >
                                <InputNumber min={0} max={100000} className="w-full" addonAfter="积分" />
                            </Form.Item>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button type="primary" htmlType="submit" icon={<Save className="size-4" />} loading={savingPolicy}>
                                保存奖励规则
                            </Button>
                        </div>
                    </Form>
                </div>

                {/* 全站邀请记录明细 */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Users className="size-4 text-muted-foreground" />
                            <h2 className="text-sm font-semibold text-foreground">全站推广邀请明细</h2>
                        </div>
                        <span className="text-xs text-muted-foreground">共 {invitationsPage?.total || 0} 次邀请记录</span>
                    </div>

                    <TableSurface>
                        <Table
                            columns={columns}
                            dataSource={invitationsPage?.items || []}
                            rowKey="id"
                            loading={loadingInvitations}
                            pagination={false}
                            locale={{ emptyText: <WorkspaceState icon="empty" title="暂无邀请记录" description="当有用户通过邀请码或推广链接注册时，记录将在此呈现。" /> }}
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
        </AdminPageFrame>
    );
}
