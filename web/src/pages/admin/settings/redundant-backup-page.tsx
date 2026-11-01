import { App, Button, Form, Input, InputNumber, Progress, Radio, Skeleton, Switch, Tag } from "antd";
import { CheckCircle2, Clock3, Database, RefreshCw, Server, ShieldCheck, Play, FolderKanban, Cloud, Save, DownloadCloud, HardDrive, KeyRound, Globe2, BadgeCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminPageFrame } from "../components/admin-shell";
import { AdminStatusBadge, SettingsSectionCard } from "../components/admin-ui";
import { cn } from "@/lib/utils";
import {
    getRedundantBackupStatus,
    triggerRedundantBackup,
    getRedundantBackupSetting,
    updateRedundantBackupSetting,
    type RedundantBackupStatus,
    type RedundantBackupSetting,
} from "@/services/api/redundant-backup";
import { getAdminOSSSetting } from "@/services/api/auth";

function formatBytes(value?: number) {
    if (value === undefined || !Number.isFinite(value)) return "--";
    if (!value || value < 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const amount = value / 1024 ** index;
    return `${amount >= 100 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}

function formatNumber(value?: number) {
    return value === undefined || !Number.isFinite(value) ? "--" : new Intl.NumberFormat("zh-CN").format(value);
}

export default function RedundantBackupPage() {
    const { message } = App.useApp();
    const [status, setStatus] = useState<RedundantBackupStatus | null>(null);
    const [setting, setSetting] = useState<RedundantBackupSetting | null>(null);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [savingCycle, setSavingCycle] = useState(false);
    const [savingWebdav, setSavingWebdav] = useState(false);

    // 独立维护 draft 状态以匹配邮件设置页体验
    const [draftAutoEnabled, setDraftAutoEnabled] = useState(true);
    const [draftIntervalMode, setDraftIntervalMode] = useState<string>("24");
    const [customHours, setCustomHours] = useState<number>(24);
    const [draftWebdavEnabled, setDraftWebdavEnabled] = useState(false);

    const [form] = Form.useForm<RedundantBackupSetting>();

    const loadSetting = useCallback(async (quiet = false) => {
        try {
            const settingData = await getRedundantBackupSetting();
            setSetting(settingData);
            setDraftAutoEnabled(settingData.enabled ?? true);
            setDraftWebdavEnabled(settingData.webdavEnabled ?? false);

            const hours = settingData.intervalHours || 24;
            setCustomHours(hours);
            if ([6, 12, 24, 72, 168].includes(hours)) {
                setDraftIntervalMode(String(hours));
            } else {
                setDraftIntervalMode("custom");
            }

            form.setFieldsValue({
                enabled: settingData.enabled ?? true,
                intervalHours: hours,
                targetDir: settingData.targetDir || "",
                webdavEnabled: settingData.webdavEnabled ?? false,
                webdavEndpoint: settingData.webdavEndpoint || "",
                webdavUsername: settingData.webdavUsername || "",
                webdavPathPrefix: settingData.webdavPathPrefix || "",
            });
        } catch (error) {
            if (!quiet) message.error(error instanceof Error ? error.message : "获取冗余备份设置失败");
        }
    }, [form, message]);

    const loadStatus = useCallback(async (quiet = false) => {
        if (!quiet) setLoading(true);
        try {
            const statusData = await getRedundantBackupStatus();
            setStatus(statusData);
        } catch (error) {
            if (!quiet) message.error(error instanceof Error ? error.message : "获取冗余备份状态失败");
        } finally {
            if (!quiet) setLoading(false);
        }
    }, [message]);

    useEffect(() => {
        void loadSetting(true);
        void loadStatus(false);
        const timer = setInterval(() => {
            void loadStatus(true);
        }, 5000);
        return () => clearInterval(timer);
    }, [loadSetting, loadStatus]);

    const handleRunBackup = async () => {
        setRunning(true);
        try {
            await triggerRedundantBackup();
            message.success("已启动全量冗余备份任务，后台正在增量导出数据库快照与媒体文件！");
            await loadStatus(true);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "启动备份失败");
        } finally {
            setRunning(false);
        }
    };

    const handleSaveCycle = async () => {
        setSavingCycle(true);
        try {
            const finalHours = draftIntervalMode === "custom" ? customHours : Number(draftIntervalMode);
            const currentVals = form.getFieldsValue();
            const updated = await updateRedundantBackupSetting({
                ...currentVals,
                enabled: draftAutoEnabled,
                intervalHours: finalHours,
            });
            setSetting(updated);
            message.success("定时周期策略已保存！后台调度器已更新。");
            await loadStatus(true);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存周期策略失败");
        } finally {
            setSavingCycle(false);
        }
    };

    const handleSaveWebdav = async () => {
        let values: RedundantBackupSetting;
        try {
            values = await form.validateFields();
        } catch {
            return;
        }

        setSavingWebdav(true);
        try {
            const finalHours = draftIntervalMode === "custom" ? customHours : Number(draftIntervalMode);
            const updated = await updateRedundantBackupSetting({
                ...values,
                enabled: draftAutoEnabled,
                intervalHours: finalHours,
                webdavEnabled: draftWebdavEnabled,
            });
            setSetting(updated);
            message.success("WebDAV 存储与备份配置已保存！");
            await loadStatus(true);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存 WebDAV 设置失败");
        } finally {
            setSavingWebdav(false);
        }
    };

    const handleImportFromOSS = async () => {
        try {
            const res = await getAdminOSSSetting();
            const oss = res.setting;
            if (oss.provider !== "webdav" || !oss.endpoint) {
                message.warning("当前存储服务未配置 WebDAV，请在存储设置中配置或在此手动填写。");
                return;
            }
            form.setFieldsValue({
                webdavEndpoint: oss.endpoint,
                webdavUsername: oss.accessKeyId,
                webdavPathPrefix: oss.pathPrefix || "mexaiai-canvas",
            });
            setDraftWebdavEnabled(true);
            message.success("已从存储服务导入 WebDAV 配置！请补充密码后保存。");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "导入存储配置失败");
        }
    };

    const isBusy = running || status?.isRunning;

    return (
        <AdminPageFrame
            title="冗余备份"
            description="全站画布、工程结构、数据库与媒体原件完整镜像。支持开箱即用的异地独立部署与灾难恢复。"
            scroll
            actions={
                <div className="flex items-center gap-2">
                    <Button icon={<RefreshCw className="size-3.5" />} onClick={() => void loadStatus()}>
                        刷新状态
                    </Button>
                    <Button
                        type="primary"
                        icon={isBusy ? <RefreshCw className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                        disabled={isBusy}
                        onClick={() => void handleRunBackup()}
                        className={cn("!rounded-xl", isBusy && "!opacity-90 !cursor-not-allowed")}
                    >
                        {isBusy ? "备份任务进行中..." : "立即执行全量冗余备份"}
                    </Button>
                </div>
            }
        >
            <div className="admin-settings-stack">
                {/* 实时备份进度面板 */}
                {status?.isRunning ? (
                    <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 space-y-3 shadow-md backdrop-blur-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                                <RefreshCw className="size-4 animate-spin text-blue-500" />
                                <strong className="text-sm font-semibold text-foreground">全量冗余备份正在执行中</strong>
                                {status.currentStep ? (
                                    <Tag color="processing" className="!text-xs font-normal">
                                        {status.currentStep}
                                    </Tag>
                                ) : null}
                            </div>
                            <span className="font-mono text-sm font-bold text-blue-400">
                                {status.progressPercent || 5}%
                            </span>
                        </div>
                        <Progress
                            percent={status.progressPercent || 5}
                            status="active"
                            showInfo={false}
                            strokeColor={{ "0%": "#1677ff", "100%": "#52c41a" }}
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="text-blue-300 font-medium">
                                {status.progressText || "正在执行增量同步..."}
                            </span>
                            {status.totalFiles && status.totalFiles > 0 ? (
                                <span className="font-mono text-muted-foreground">
                                    媒体传输进度：{formatNumber(status.processedFiles)} / {formatNumber(status.totalFiles)} 文件
                                </span>
                            ) : null}
                        </div>
                    </div>
                ) : null}

                {/* 1. 冗余备份仓状态与指标 */}
                <div id="admin-backup-status" className="admin-settings-anchor">
                    <SettingsSectionCard
                        icon={<Server className="size-4" aria-hidden="true" />}
                        title="1. 冗余备份仓状态与指标"
                        description="备份仓保存在外部备份目录或独立存储卷中，包含自动还原的数据库快照、全量媒体资源、Docker 编排配置与启动脚本。"
                        status={
                            <AdminStatusBadge
                                label={status?.isRunning ? "备份同步中..." : status?.lastBackupTime ? "自包含备份就绪" : "待执行首次同步"}
                                tone={status?.isRunning ? "warning" : status?.lastBackupTime ? "success" : "neutral"}
                            />
                        }
                    >
                        {loading && !status ? (
                            <Skeleton active paragraph={{ rows: 3 }} />
                        ) : (
                            <div className="space-y-4">
                                <div className="rounded-xl border border-white/5 bg-black/15 p-4 space-y-2.5">
                                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-2.5">
                                        <div className="flex items-center gap-2">
                                            <HardDrive className="size-4 text-primary" />
                                            <span className="text-sm font-semibold text-foreground">存储挂载目标</span>
                                        </div>
                                        <span className="text-xs text-muted-foreground font-mono">
                                            版本: {status?.version || "v1.7.3.2"} · Schema v{status?.schemaVersion || 80}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1.5 font-mono text-xs text-foreground/80 break-all">
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground select-none font-sans">本地目标：</span>
                                            <code className="rounded bg-black/30 px-1.5 py-0.5 font-bold">{status?.targetDir}</code>
                                        </div>
                                        {status?.webdavEnabled && status?.webdavTarget ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-muted-foreground select-none font-sans">WebDAV：</span>
                                                <code className="rounded bg-blue-500/10 text-blue-400 px-1.5 py-0.5 font-bold">
                                                    {status.webdavTarget}
                                                </code>
                                            </div>
                                        ) : null}
                                        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-muted-foreground font-sans mt-1">
                                            <div className="flex items-center gap-1.5">
                                                <Clock3 className="size-3.5" />
                                                <span>
                                                    上次备份：
                                                    {status?.lastBackupTime
                                                        ? new Date(status.lastBackupTime).toLocaleString("zh-CN")
                                                        : "尚未执行备份"}
                                                </span>
                                            </div>
                                            {status?.autoBackupEnabled && status?.nextBackupTime ? (
                                                <div className="flex items-center gap-1.5 text-emerald-400">
                                                    <CheckCircle2 className="size-3.5" />
                                                    <span>
                                                        下次预定：
                                                        {new Date(status.nextBackupTime).toLocaleString("zh-CN")}
                                                        （每 {status.intervalHours} 小时自动循环）
                                                    </span>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>

                                {/* 4 个指标统计卡片 */}
                                <div className="grid gap-3 sm:grid-cols-4">
                                    <div className="rounded-xl border border-white/5 bg-black/20 p-3.5">
                                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1.5">
                                            <FolderKanban className="size-3.5 text-blue-400" />
                                            <span>媒体资源总数</span>
                                        </div>
                                        <div className="text-xl font-bold font-mono text-foreground">
                                            {formatNumber(status?.totalResources)}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            媒体占用：{formatBytes(status?.totalResourceBytes)}
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-white/5 bg-black/20 p-3.5">
                                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1.5">
                                            <Database className="size-4 text-emerald-400" />
                                            <span>数据库快照</span>
                                        </div>
                                        <div className="text-xl font-bold font-mono text-foreground">
                                            {formatBytes(status?.databaseSqlBytes)}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            全量画布、连线与节点 (SQL)
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-white/5 bg-black/20 p-3.5">
                                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1.5">
                                            <Clock3 className="size-3.5 text-amber-400" />
                                            <span>备份周期调度</span>
                                        </div>
                                        <div className="text-base font-bold text-foreground">
                                            {status?.autoBackupEnabled ? `每 ${status.intervalHours}h 循环` : "手动模式"}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            {status?.autoBackupEnabled ? "后台守护定时增量同步" : "定时调度已停用"}
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-white/5 bg-black/20 p-3.5">
                                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1.5">
                                            <ShieldCheck className="size-3.5 text-purple-400" />
                                            <span>异地恢复特性</span>
                                        </div>
                                        <div className="text-base font-bold text-foreground">
                                            免配置 / 一键启动
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            docker-entrypoint 自动还原
                                        </p>
                                    </div>
                                </div>

                                {status?.lastError ? (
                                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                                        {status.lastError}
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </SettingsSectionCard>
                </div>

                {/* 2. 自动定时备份与循环周期 */}
                <div id="admin-backup-cycle" className="admin-settings-anchor">
                    <SettingsSectionCard
                        icon={<Clock3 className="size-4" aria-hidden="true" />}
                        title="2. 自动定时备份与循环周期"
                        description="设置全站数据库与媒体原件的自动循环备份频率，后台守护进程将准时执行增量镜像。"
                        status={
                            <AdminStatusBadge
                                label={draftAutoEnabled ? `每 ${draftIntervalMode === "custom" ? customHours : draftIntervalMode}h 循环` : "未启用"}
                                tone={draftAutoEnabled ? "success" : "neutral"}
                            />
                        }
                        footer={
                            <div className="flex w-full flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <BadgeCheck className="size-4" aria-hidden="true" />
                                    <span>定时任务每次仅增量导出新数据，不影响系统正常访问与生成任务</span>
                                </div>
                                <Button
                                    type="primary"
                                    icon={<Save className="size-4" />}
                                    loading={savingCycle}
                                    onClick={() => void handleSaveCycle()}
                                >
                                    保存周期策略
                                </Button>
                            </div>
                        }
                    >
                        {/* 仿照邮件服务 Policy 标准卡片行 */}
                        <div className="admin-email-delivery-policy">
                            <span className="admin-email-policy-icon">
                                <Clock3 className="size-5 text-primary" aria-hidden="true" />
                            </span>
                            <div className="admin-email-policy-copy">
                                <div className="flex flex-wrap items-center gap-2">
                                    <strong>自动定时周期备份</strong>
                                    <AdminStatusBadge label="保存后生效" tone="info" />
                                </div>
                                <p>开启后系统后台会自动按照设定的周期循环导出数据库快照并增量同步媒体资源，确保异地容灾副本始终最新。</p>
                                <span>关闭只停止后台自动定时触发，不影响随时点击顶部按钮手动执行备份。</span>
                            </div>
                            <Switch
                                checked={draftAutoEnabled}
                                aria-label="自动定时周期备份"
                                onChange={(checked) => setDraftAutoEnabled(checked)}
                            />
                        </div>

                        {draftAutoEnabled ? (
                            <div className="border-t border-border/60 p-4 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h4 className="text-sm font-semibold text-foreground">循环备份周期策略</h4>
                                        <p className="text-xs text-muted-foreground mt-0.5">选择定时循环的间隔频次；超期后后台将在 1 分钟内自动触发增量镜像。</p>
                                    </div>
                                    <Radio.Group
                                        value={draftIntervalMode}
                                        onChange={(e) => setDraftIntervalMode(e.target.value)}
                                        optionType="button"
                                        buttonStyle="solid"
                                        options={[
                                            { label: "每 6 小时", value: "6" },
                                            { label: "每 12 小时", value: "12" },
                                            { label: "每天 (24h)", value: "24" },
                                            { label: "每 3 天", value: "72" },
                                            { label: "每周", value: "168" },
                                            { label: "自定义", value: "custom" },
                                        ]}
                                    />
                                </div>

                                {draftIntervalMode === "custom" ? (
                                    <div className="flex items-center gap-3 pt-2 text-xs">
                                        <span className="text-foreground/70">自定义循环周期：</span>
                                        <InputNumber
                                            min={1}
                                            max={720}
                                            precision={0}
                                            value={customHours}
                                            onChange={(val) => setCustomHours(val || 24)}
                                            className="w-32"
                                            addonAfter="小时"
                                        />
                                        <span className="text-muted-foreground">（支持 1 ~ 720 小时，最长 30 天循环一次）</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-xs text-emerald-500/80 pt-1">
                                        <CheckCircle2 className="size-3.5" />
                                        <span>当前选择：每 {draftIntervalMode} 小时自动执行一次备份与增量同步。</span>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </SettingsSectionCard>
                </div>

                {/* 3. WebDAV 远程端同步容灾（可选） */}
                <div id="admin-backup-webdav" className="admin-settings-anchor">
                    <SettingsSectionCard
                        icon={<Cloud className="size-4" aria-hidden="true" />}
                        title="3. WebDAV 远程端同步容灾（可选）"
                        description="将备份仓镜像同步推送到 WebDAV，实现异地容灾，文件在 NAS 或网盘中直观可见并可随时下载启动。"
                        status={
                            <AdminStatusBadge
                                label={draftWebdavEnabled ? (setting?.hasWebdavPassword ? "已配置" : "待补全") : "未启用"}
                                tone={draftWebdavEnabled ? (setting?.hasWebdavPassword ? "success" : "warning") : "neutral"}
                            />
                        }
                        footer={
                            <div className="flex w-full flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <BadgeCheck className="size-4" aria-hidden="true" />
                                    <span>数据库快照在本地导出后由服务端加密直传 WebDAV，密码由服务端独立加密存储</span>
                                </div>
                                <Button
                                    type="primary"
                                    icon={<Save className="size-4" />}
                                    loading={savingWebdav}
                                    onClick={() => void handleSaveWebdav()}
                                >
                                    保存 WebDAV 设置
                                </Button>
                            </div>
                        }
                    >
                        <div className="admin-email-delivery-policy">
                            <span className="admin-email-policy-icon">
                                <Cloud className="size-5 text-blue-500" aria-hidden="true" />
                            </span>
                            <div className="admin-email-policy-copy">
                                <div className="flex flex-wrap items-center gap-2">
                                    <strong>同步至 WebDAV 远程备份仓</strong>
                                    <AdminStatusBadge label="多副本容灾" tone="info" />
                                </div>
                                <p>将数据库快照、媒体原件、Docker 启动编排直接增量推送到 WebDAV，实现异地容灾（在 NAS / 网盘中文件直观可见）。</p>
                                <span>未开启时仅保存在本地/挂载目录；开启后每次备份会自动上传增量文件至 WebDAV。</span>
                            </div>
                            <Switch
                                checked={draftWebdavEnabled}
                                aria-label="同步至 WebDAV 远程备份仓"
                                onChange={(checked) => setDraftWebdavEnabled(checked)}
                            />
                        </div>

                        {draftWebdavEnabled ? (
                            <div className="border-t border-border/60 p-4 space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/15 p-3 text-xs">
                                    <span className="text-muted-foreground">
                                        快捷操作：若你在「存储服务」中已配置过 WebDAV，可直接一键复用参数
                                    </span>
                                    <Button
                                        size="small"
                                        type="dashed"
                                        icon={<DownloadCloud className="size-3.5" />}
                                        onClick={() => void handleImportFromOSS()}
                                        className="!text-xs"
                                    >
                                        从存储服务一键导入
                                    </Button>
                                </div>

                                <Form form={form} layout="vertical" requiredMark={false} className="max-w-3xl">
                                    <div className="grid gap-x-4 sm:grid-cols-2">
                                        <Form.Item
                                            name="webdavEndpoint"
                                            label="WebDAV 服务地址"
                                            rules={[{ required: true, message: "请填写 WebDAV 服务地址" }]}
                                            extra="例如 http://192.168.31.141:5002/Life 或 https://dav.example.com"
                                        >
                                            <Input
                                                prefix={<Globe2 className="size-3.5 text-foreground/40" />}
                                                placeholder="http://192.168.31.141:5002/Life"
                                            />
                                        </Form.Item>

                                        <Form.Item
                                            name="webdavPathPrefix"
                                            label="远端备份子路径（可选）"
                                            extra="保存在 WebDAV 下的具体子目录，例如 mexaiai-canvas 或 backups"
                                        >
                                            <Input
                                                prefix={<FolderKanban className="size-3.5 text-foreground/40" />}
                                                placeholder="mexaiai-canvas"
                                            />
                                        </Form.Item>

                                        <Form.Item
                                            name="webdavUsername"
                                            label="用户名 (Username)"
                                            rules={[{ required: true, message: "请填写 WebDAV 用户名" }]}
                                        >
                                            <Input placeholder="admin" />
                                        </Form.Item>

                                        <Form.Item
                                            name="webdavPassword"
                                            label={setting?.hasWebdavPassword ? "密码 (Password，已配置)" : "密码 (Password)"}
                                            extra={setting?.hasWebdavPassword ? "留空表示保留已有密码" : "填写 WebDAV 访问密码"}
                                        >
                                            <Input.Password
                                                prefix={<KeyRound className="size-3.5 text-foreground/40" />}
                                                placeholder={setting?.hasWebdavPassword ? "留空保留原密码" : "输入密码"}
                                            />
                                        </Form.Item>
                                    </div>

                                    <div className="pt-2 border-t border-white/5">
                                        <Form.Item
                                            name="targetDir"
                                            label="本地备份存储路径（可选自定义）"
                                            extra="留空默认使用系统配置路径（/backups/redundant）。在 Docker 环境中建议挂载外部存储卷到该目录。"
                                            className="!mb-0"
                                        >
                                            <Input
                                                prefix={<HardDrive className="size-3.5 text-foreground/40" />}
                                                placeholder="/backups/redundant"
                                                className="max-w-md"
                                            />
                                        </Form.Item>
                                    </div>
                                </Form>
                            </div>
                        ) : null}
                    </SettingsSectionCard>
                </div>

                {/* 4. 异地环境 / 灾难恢复运行指南 */}
                <div id="admin-backup-recovery" className="admin-settings-anchor">
                    <SettingsSectionCard
                        icon={<ShieldCheck className="size-4" aria-hidden="true" />}
                        title="4. 异地环境 / 灾难恢复运行指南"
                        description="当当前机器故障、迁移到新服务器或需要在其他 VPS / 主机上运行时，按以下步骤直接启动即可恢复全站。"
                        status={<AdminStatusBadge label="开箱即用" tone="info" />}
                    >
                        <div className="space-y-4 text-xs leading-6 text-foreground/80 p-2">
                            <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/40 p-3.5">
                                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                                    1
                                </span>
                                <div>
                                    <strong className="text-sm text-foreground">访问或从 WebDAV / 本地拷贝备份仓目录</strong>
                                    <p className="text-muted-foreground mt-0.5">
                                        在新机器或备用服务器上获取该备份文件夹（通过从 WebDAV 目录下载、挂载共享或直接复制）。
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/40 p-3.5">
                                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                                    2
                                </span>
                                <div>
                                    <strong className="text-sm text-foreground">执行一键启动命令（无需二次配置）</strong>
                                    <p className="text-muted-foreground mt-0.5">
                                        进入该备份目录，执行目录下的启动脚本或 Compose 命令：
                                    </p>
                                    <pre className="mt-2 rounded bg-black/80 p-2.5 font-mono text-emerald-400 text-xs">
                                        ./start.sh   # 或者直接执行: docker compose up -d
                                    </pre>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/40 p-3.5">
                                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                                    3
                                </span>
                                <div>
                                    <strong className="text-sm text-foreground">直接在浏览器中打开使用</strong>
                                    <p className="text-muted-foreground mt-0.5">
                                        数据库首次启动会自动导入 <code>initdb/01-restore-canvas.sql</code>，媒体文件直接就位。浏览器访问 <code>http://新IP:3000</code>，所有画布和历史工程完全还原！
                                    </p>
                                </div>
                            </div>
                        </div>
                    </SettingsSectionCard>
                </div>
            </div>
        </AdminPageFrame>
    );
}
