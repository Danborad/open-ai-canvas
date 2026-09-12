import { useState, useMemo } from "react";
import { App, Button, Modal, Switch, Table, Tag, Input, Select } from "antd";
import { FolderKanban, Pencil, Plus, Sparkles, Trash2, Info } from "lucide-react";
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
    // 允许单独新建的分组列表
    const [createdGroups, setCreatedGroups] = useState<string[]>([]);

    const initAssignments = () => {
        const initial: Record<string, string> = {};
        const discovered: string[] = [];
        channels.forEach((c) => {
            const alias = (c.publicAlias || "").trim();
            initial[c.id] = alias;
            if (alias && !discovered.includes(alias)) {
                discovered.push(alias);
            }
        });
        setGroupAssignments(initial);
        setCreatedGroups(discovered);
    };

    const handleOpen = () => {
        initAssignments();
        setOpen(true);
    };

    // 统计当前分组情况
    const existingGroups = useMemo(() => {
        const groupMap = new Map<string, string[]>();
        // 包含所有已创建的分组，即使暂无渠道
        createdGroups.forEach((g) => {
            if (!groupMap.has(g)) groupMap.set(g, []);
        });

        channels.forEach((c) => {
            const alias = (groupAssignments[c.id] !== undefined ? groupAssignments[c.id] : c.publicAlias || "").trim();
            if (alias) {
                const list = groupMap.get(alias) || [];
                list.push(c.name);
                groupMap.set(alias, list);
            }
        });

        return Array.from(groupMap.entries()).map(([name, chs]) => ({
            name,
            channels: chs,
            count: chs.length,
        }));
    }, [channels, createdGroups, groupAssignments]);

    // 所有可用分组列表（用于下拉选择）
    const allGroupNames = useMemo(() => {
        const set = new Set<string>(createdGroups);
        channels.forEach((c) => {
            const val = (groupAssignments[c.id] ?? c.publicAlias ?? "").trim();
            if (val) set.add(val);
        });
        return Array.from(set);
    }, [channels, createdGroups, groupAssignments]);

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
                message.success(`已保存分组设置，画布已实时同步并按分组聚合展示`);
            } else {
                message.info("分组设置无变更");
            }
            setOpen(false);
        } catch (err) {
            message.error(err instanceof Error ? err.message : "保存分组失败");
        } finally {
            setSaving(false);
        }
    };

    // 新建分组
    const handleCreateNewGroup = () => {
        let nameDraft = "";
        modal.confirm({
            title: "新建渠道展示分组",
            content: (
                <div className="mt-3">
                    <p className="mb-2 text-xs text-foreground/60">
                        分组名称仅用于前端画布与创作台聚合展示（例如“福利渠道”、“专业生图专线”）：
                    </p>
                    <Input
                        placeholder="例如：福利渠道 / 绘图专线 / 高速集群"
                        autoFocus
                        onChange={(e) => { nameDraft = e.target.value.trim(); }}
                    />
                </div>
            ),
            okText: "创建",
            cancelText: "取消",
            onOk: () => {
                if (!nameDraft) {
                    message.warning("分组名称不能为空");
                    return;
                }
                if (allGroupNames.includes(nameDraft)) {
                    message.warning("该分组已存在");
                    return;
                }
                setCreatedGroups((prev) => [...prev, nameDraft]);
                message.success(`分组「${nameDraft}」已创建，请在下方为相应渠道分配此分组`);
            },
        });
    };

    // 重命名分组
    const handleRenameGroup = (oldGroupName: string) => {
        let newNameDraft = oldGroupName;
        modal.confirm({
            title: `重命名分组「${oldGroupName}」`,
            content: (
                <div className="mt-3">
                    <p className="mb-2 text-xs text-foreground/60">
                        将把该分组下所有已绑定的渠道一并更新为新分组名：
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
                setCreatedGroups((prev) => prev.map((g) => (g === oldGroupName ? newNameDraft : g)));
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
                message.success(`已将分组「${oldGroupName}」改名为「${newNameDraft}」，请点击底部保存生效`);
            },
        });
    };

    // 删除分组（解绑）
    const handleDeleteGroup = (groupName: string) => {
        modal.confirm({
            title: `解散分组「${groupName}」？`,
            content: `解散后，该分组下的所有渠道将恢复为【未设置分组】，在画布中恢复为按自身渠道名单独展示。`,
            okText: "确认解散",
            okButtonProps: { danger: true },
            cancelText: "取消",
            onOk: () => {
                setCreatedGroups((prev) => prev.filter((g) => g !== groupName));
                setGroupAssignments((prev) => {
                    const next = { ...prev };
                    channels.forEach((c) => {
                        const current = (next[c.id] ?? c.publicAlias ?? "").trim();
                        if (current === groupName) {
                            next[c.id] = "";
                        }
                    });
                    return next;
                });
                message.success(`已解散分组「${groupName}」，请点击保存生效`);
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
                width={820}
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

                    {/* 规则提示横幅 */}
                    <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-xs leading-5 text-blue-200">
                        <Info className="mt-0.5 size-4 shrink-0 text-blue-400" />
                        <div>
                            <span className="font-semibold text-blue-300">分组与渠道名称互相独立：</span>
                            <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-blue-200/85">
                                <li>
                                    <strong>设置了分组的渠道</strong>：具有相同分组名称的多个渠道将<strong>合并展示在同一个分组</strong>下（例如 3 个渠道都设为“福利渠道”，在画布中仅显示一个统一的“福利渠道 平台服务”）。
                                </li>
                                <li>
                                    <strong>未设置分组的渠道</strong>：将继续<strong>按其自身渠道名称单独展示</strong>（和原来完全一样，互不干扰）。
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* 分组概览与操作栏 */}
                    <div className="rounded-lg border border-border/40 p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <div className="text-xs font-semibold text-foreground/70">当前已定义的分组：</div>
                            <Button
                                size="small"
                                type="dashed"
                                icon={<Plus className="size-3" />}
                                onClick={handleCreateNewGroup}
                            >
                                新建分组
                            </Button>
                        </div>
                        {existingGroups.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {existingGroups.map((grp) => (
                                    <div
                                        key={grp.name}
                                        className="flex items-center gap-1.5 rounded-md border border-border/60 bg-surface px-2.5 py-1 text-xs shadow-sm"
                                    >
                                        <span className="font-semibold text-foreground">{grp.name}</span>
                                        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground/60">
                                            {grp.count} 个渠道
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleRenameGroup(grp.name)}
                                            className="ml-1 cursor-pointer text-foreground/40 transition hover:text-blue-400"
                                            title="重命名此分组"
                                        >
                                            <Pencil className="size-3" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteGroup(grp.name)}
                                            className="cursor-pointer text-foreground/40 transition hover:text-red-400"
                                            title="解散此分组（所有渠道恢复未分组）"
                                        >
                                            <Trash2 className="size-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-2 text-xs text-foreground/40">
                                暂无任何分组，所有渠道均按自身名称单独展示。点击右上角「新建分组」开始创建。
                            </div>
                        )}
                    </div>

                    {/* 渠道分组归属表格 */}
                    <div>
                        <div className="mb-1.5 text-xs font-semibold text-foreground/70">为渠道指定展示分组：</div>
                        <Table
                            dataSource={channels}
                            rowKey="id"
                            size="small"
                            pagination={false}
                            scroll={{ y: 300 }}
                            columns={[
                                {
                                    title: "渠道名称",
                                    dataIndex: "name",
                                    key: "name",
                                    width: 240,
                                    render: (name, record) => (
                                        <div className="min-w-0">
                                            <div className="truncate font-medium text-foreground">{name}</div>
                                            <div className="truncate text-[11px] text-foreground/40">{record.baseUrl}</div>
                                        </div>
                                    ),
                                },
                                {
                                    title: "所属展示分组",
                                    key: "publicAlias",
                                    render: (_, record) => {
                                        const currentVal = groupAssignments[record.id] ?? record.publicAlias ?? "";
                                        const selectOptions = [
                                            { label: "（未设置分组 · 按渠道原名单独展示）", value: "" },
                                            ...allGroupNames.map((g) => ({
                                                label: `📁 分组：${g}`,
                                                value: g,
                                            })),
                                        ];
                                        return (
                                            <Select
                                                className="w-full"
                                                value={currentVal}
                                                options={selectOptions}
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
