import { useEffect, useState } from "react";
import { App, Button, Modal } from "antd";
import { Play } from "lucide-react";

import { Switch } from "@/components/ui/base/switch";
import { getAdminBillingAutoRefund, runAdminBillingAutoReconcile, updateAdminBillingAutoRefund } from "@/services/api/wallet";

export interface BillingAutoRefundToggleProps {
    onReconciled?: () => void;
}

/**
 * 积分运营页右上角的“自动对账”控件组。
 * 1. 自动对账开关：开启后后台每小时自动穿透核验真实文件，未出片自动退还预扣积分，出片自动结算。
 * 2. 立即自动对账按钮：管理员可随时一键执行批量穿透核验，即刻释放积压的待核对单。
 */
export function BillingAutoRefundToggle({ onReconciled }: BillingAutoRefundToggleProps) {
    const { message } = App.useApp();
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [reconciling, setReconciling] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    useEffect(() => {
        let active = true;
        void getAdminBillingAutoRefund()
            .then(({ setting }) => {
                if (active) setEnabled(setting.enabled);
            })
            .catch((error) => {
                if (active) message.error(error instanceof Error ? error.message : "读取自动对账设置失败");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [message]);

    const save = async (next: boolean) => {
        setSaving(true);
        try {
            const { setting } = await updateAdminBillingAutoRefund(next);
            setEnabled(setting.enabled);
            setConfirmOpen(false);
            message.success(setting.enabled ? "已开启自动对账：系统每小时将自动穿透核验文件，未出片全额退回预扣积分" : "已关闭自动对账");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存自动对账设置失败");
        } finally {
            setSaving(false);
        }
    };

    const handleRunReconcile = async () => {
        setReconciling(true);
        try {
            const { stats } = await runAdminBillingAutoReconcile();
            message.success(`自动对账完成：共核验 ${stats.totalChecked} 笔（退还 ${stats.refunded} 笔，结算 ${stats.settled} 笔，跳过 ${stats.skipped} 笔）`);
            if (onReconciled) {
                onReconciled();
            } else {
                // 如果没有显式回调，派发一个全局自定义事件通知页面刷新订单表格
                window.dispatchEvent(new CustomEvent("billing-orders:refresh"));
            }
        } catch (error) {
            message.error(error instanceof Error ? error.message : "执行自动对账失败");
        } finally {
            setReconciling(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <Button
                icon={<Play className="size-3.5" />}
                loading={reconciling}
                disabled={loading || saving || reconciling}
                onClick={() => void handleRunReconcile()}
                title="根据实体文件真实生成情况，一键自动对账待核对订单（未出片全额退还，已出片自动结算）"
            >
                立即自动对账
            </Button>
            <label className="inline-flex h-8 items-center gap-2 rounded-[var(--r-md)] px-2 text-[var(--fs-body)]" title="开启后，系统每小时自动对账巡检：未出片订单全额退还，已出片订单自动结算">
                <span>每小时自动对账</span>
                <Switch
                    size="sm"
                    aria-label="每小时自动对账退还"
                    checked={enabled}
                    loading={loading || (saving && !confirmOpen)}
                    disabled={loading || saving || reconciling}
                    onChange={(checked) => {
                        if (checked) setConfirmOpen(true);
                        else void save(false);
                    }}
                />
            </label>
            <Modal
                title="开启定时自动对账退还"
                open={confirmOpen}
                okText="确认开启"
                cancelText="取消"
                okButtonProps={{ danger: false }}
                confirmLoading={saving}
                closable={!saving}
                mask={{ closable: !saving }}
                onCancel={() => {
                    if (!saving) setConfirmOpen(false);
                }}
                onOk={() => void save(true)}
                destroyOnHidden
                rootClassName="admin-modal-root"
            >
                <p className="admin-operation-confirmation-copy">
                    开启后，系统每 1 小时自动对账巡检一次“待核对队列”。
                </p>
                <p className="admin-operation-confirmation-copy">
                    系统将以用户是否实际拿到有效媒体文件为准：未出片订单（524网关超时、协议未返回地址、任务失败）自动全额退还预扣积分；已恢复出片订单自动结算。
                </p>
            </Modal>
        </div>
    );
}
