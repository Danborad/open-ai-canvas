import { useState, useMemo } from "react";
import { App, AutoComplete, Button, Modal, Switch, Table, Tag, Input } from "antd";
import { FolderKanban, Pencil, Sparkles } from "lucide-react";
import type { ModelChannel } from "@/stores/use-config-store";
import { updateAdminChannel } from "@/services/api/auth";
import { setUserPluginEnabled } from "@/services/api/plugins";
import { usePluginStore } from "@/stores/use-plugin-store";
import { CHANNEL_GROUPING_PLUGIN_ID, useChannelGroupingEnabled } from "@/lib/plugins/builtin/channel-grouping";

type Props = {
    channels: ModelChannel[];
    onSaved: () => Promise<void>;
};

export function ChannelGroupDialog({ channels, onSaved }: Props) {
    const { message, modal } = App.useApp();
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const channelGroupingEnabled = useChannelGroupingEnabled();
    const setEnabled = usePluginStore((state) => state.setEnabled);
    const setPluginStates = usePluginStore((state) => state.setPluginStates);

    // 本地编辑状态：channelId -> publicAlias
    const [groupAssignments, setGroupAssignments] = useState<Record<string, string>>({});

    const initAssignments = () => {
        const initial: Record<string, string> = {};
        channels.forEach((c) => {
            initial[c.id] = (c.publicAlias || "").trim();
        });
        setGroupAssignments(initial);
    };

    const handleOpen = () => {
        initAssignments();
        setOpen(true);
    };

    // 统计当前分组情况
    const existingGroups = useMemo(() => {
        const groupMap = new Map<string, string[]>();
        channels.forEach((c) => {
            const alias = (groupAssignments[c.id] !== undefined ? groupAssignments[c.id] : c.publicAlias || "").trim();
            const groupName = alias || "（未指定分组 · 默认渠道名）";
            const list = groupMap.get(groupName) || [];
            list.push(c.name);
            groupMap.set(groupName, list);
        });
        return Array.from(groupMap.entries()).map(([name, chs]) => ({
            name,
            channels: chs,
            count: chs.length,
            isDefault: name.startsWith("（未指定分组"),
        }));
    }, [channels, groupAssignments]);

    const groupOptions = useMemo(() => {
        const set = new Set<string>();
        channels.forEach((c) => {
            const val = (groupAssignments[c.id] ?? c.publicAlias ?? "").trim();
            if (val) set.add(val);
        });
        return Array.from(set).map((g) => ({
            label: `${g} (已有分组)`,
            value: g,
        }));
    }, [channels, groupAssignments]);

    // 检测是否有未保存的改动
    const hasChanges = useMemo(() => {
        return channels.some((c) => {
            const current = (groupAssignments[c.id] ?? "").trim();
            const original = (c.publicAlias ?? "").trim();
            return current !== original;
        });
    }, [channels, groupAssignments]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const updates = channels
                .filter((c) => {
                    const current = (groupAssignments[c.id] ?? "").trim();
                    const original = (c.publicAlias ?? "").trim();
                    return current !== original;
                })
                .map((c) => {
                    const nextAlias = (groupAssignments[c.id] ?? "").trim();
                    return updateAdminChannel(c.id, { publicAlias: nextAlias });
                });

            if (updates.length > 0) {
                await Promise.all(updates);
                await onSaved();
                message.success(`已更新 ${updates.length} 个渠道的分组设置，画布将按新分组展示`);
            } else {
                message.info("分组无改动");
            }
            setOpen(false);
        } catch (err) {
            message.error(err instanceof Error ? err.message : "保存分组失败");
        } finally {
            setSaving(false);
        }
    };

    // 一键重命名某个分组下的所有渠道
    const handleRenameGroup = (oldGroupName: string) => {
        let newNameDraft = oldGroupName;
        modal.confirm({
            title: `重命名分组「${oldGroupName}」`,
            content: (
                <div className="mt-3">
                    <p className="mb-2 text-xs text-foreground/60">
                        将把该分组下的所有渠道的前台分组名称一键修改为：
                    </p>
                    <Input
                        defaultValue={oldGroupName}
                        placeholder="输入新的分组名称"
                        onChange={(e) => { newNameDraft = e.target.value.trim(); }}
                    />
                </div>
            ),
            okText: "确认修改",
            cancelText: "取消",
            onOk: () => {
                if (!newNameDraft || newNameDraft === oldGroupName) return;
                setGroupAssignments((prev) => {
                    const next = { ...prev };
                    channels.forEach((c) => {
                        const current = (next[c.id] ?? c.publicAlias ?? "").trim();
                        if (current === oldGroupName) {
                            next[c.id] = newNameDraft;
                        }
                    });
                    return next;
                });
                message.success(`已将分组「${oldGroupName}」改名为「${newNameDraft}」，请点击保存生效`);
            },
        });
    };

    return (
        <>
            <Button icon={<FolderKanban className="size-4" />} onClick={handleOpen}>
                分组管理
            </Button>

            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <FolderKanban className="size-5 text-blue-500" />
                        <span>渠道分组管理</span>
                        <Tag color="blue" className="ml-1 border-0">画布多渠道合并</Tag>
                    </div>
                }
                open={open}
                width={780}
                onCancel={() => setOpen(false)}
                footer={[
                    <Button key="cancel" onClick={() => setOpen(false)}>
                        取消
                    </Button>,
                    <Button
                        key="save"
                        type="primary"
                        loading={saving}
                        disabled={!hasChanges}
                        onClick={handleSave}
                    >
                        {hasChanges ? "保存分组修改" : "暂无修改"}
                    </Button>,
                ]}
            >
                <div className="space-y-4 py-2">
                    {/* 功能开关与说明 */}
                    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 p-3">
                        <div className="min-w-0 pr-4">
                            <div className="flex items-center gap-1.5 font-medium text-foreground">
                                <Sparkles className="size-4 text-amber-500" />
                                <span>画布合并展示分组</span>
                            </div>
                            <div className="mt-0.5 text-xs text-foreground/60">
                                开启后，画布与创作台的模型选择器会将具有相同分组名称的渠道聚合为一个分组展示，彻底消除重复标题，节省空间。
                            </div>
                        </div>
                        <Switch
                            checked={channelGroupingEnabled}
                            onChange={async (checked) => {
                                try {
                                    const next = await setUserPluginEnabled(CHANNEL_GROUPING_PLUGIN_ID, checked);
                                    setEnabled(CHANNEL_GROUPING_PLUGIN_ID, checked);
                                    setPluginStates({ ...usePluginStore.getState().pluginStates, [next.pluginId]: next });
                                } catch {
                                    setEnabled(CHANNEL_GROUPING_PLUGIN_ID, checked);
                                }
                                message.success(checked ? "已启用渠道分组合并展示" : "已停用渠道分组合并展示");
                            }}
                        />
                    </div>

                    {/* 分组概览面板 */}
                    <div className="rounded-lg border border-border/40 p-3">
                        <div className="mb-2 text-xs font-semibold text-foreground/70">当前前台展示分组概览：</div>
                        <div className="flex flex-wrap gap-2">
                            {existingGroups.map((grp) => (
                                <div
                                    key={grp.name}
                                    className="flex items-center gap-1.5 rounded-md border border-border/60 bg-surface px-2.5 py-1 text-xs shadow-sm"
                                >
                                    <span className="font-medium text-foreground">{grp.name}</span>
                                    <span className="rounded bg-muted px-1.5 py-0.2 text-[11px] text-foreground/60">
                                        {grp.count} 个渠道
                                    </span>
                                    {!grp.isDefault ? (
                                        <button
                                            type="button"
                                            onClick={() => handleRenameGroup(grp.name)}
                                            className="ml-1 cursor-pointer text-foreground/40 transition hover:text-blue-500"
                                            title="一键重命名此分组"
                                        >
                                            <Pencil className="size-3" />
                                        </button>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 渠道分组归属表格 */}
                    <div>
                        <div className="mb-1.5 text-xs font-semibold text-foreground/70">各渠道分组设置：</div>
                        <Table
                            dataSource={channels}
                            rowKey="id"
                            size="small"
                            pagination={false}
                            scroll={{ y: 320 }}
                            columns={[
                                {
                                    title: "渠道名称",
                                    dataIndex: "name",
                                    key: "name",
                                    width: 220,
                                    render: (name, record) => (
                                        <div className="min-w-0">
                                            <div className="truncate font-medium text-foreground">{name}</div>
                                            <div className="truncate text-[11px] text-foreground/40">{record.baseUrl}</div>
                                        </div>
                                    ),
                                },
                                {
                                    title: "协议类型",
                                    dataIndex: "interfaceType",
                                    key: "interfaceType",
                                    width: 140,
                                    render: (type) => (
                                        <span className="text-xs text-foreground/60">{type || "openai"}</span>
                                    ),
                                },
                                {
                                    title: "所属展示分组（前台别名）",
                                    key: "publicAlias",
                                    render: (_, record) => {
                                        const currentVal = groupAssignments[record.id] ?? record.publicAlias ?? "";
                                        return (
                                            <AutoComplete
                                                className="w-full"
                                                placeholder="输入分组名或从下拉选择；留空则按渠道名"
                                                allowClear
                                                value={currentVal}
                                                options={groupOptions}
                                                filterOption={(inputValue, option) =>
                                                    String(option?.value || "").toLowerCase().includes(inputValue.toLowerCase())
                                                }
                                                onChange={(val) => {
                                                    setGroupAssignments((prev) => ({
                                                        ...prev,
                                                        [record.id]: (val || "").trim(),
                                                    }));
                                                }}
                                            />
                                        );
                                    },
                                },
                            ]}
                        />
                    </div>
                </div>
            </Modal>
        </>
    );
}

