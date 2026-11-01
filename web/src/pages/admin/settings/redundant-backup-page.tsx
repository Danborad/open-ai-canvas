import { App, Button, Form, Input, InputNumber, Skeleton, Switch } from "antd";
import { CheckCircle2, Clock3, Database, RefreshCw, Server, ShieldCheck, Play, FolderKanban, Cloud, Save, Settings2, DownloadCloud } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminPageFrame } from "../components/admin-shell";
import { SettingsSectionCard } from "../components/admin-ui";
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

const PRESET_INTERVALS = [
    { label: "每 6 小时", hours: 6 },
    { label: "每 12 小时", hours: 12 },
    { label: "每天 (24 小时)", hours: 24 },
    { label: "每 3 天 (72 小时)", hours: 72 },
    { label: "每周 (168 小时)", hours: 168 },
];

export default function RedundantBackupPage() {
    const { message } = App.useApp();
    const [status, setStatus] = useState<RedundantBackupStatus | null>(null);
    const [setting, setSetting] = useState<RedundantBackupSetting | null>(null);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [savingSetting, setSavingSetting] = useState(false);
    const [form] = Form.useForm<RedundantBackupSetting>();

    const loadSetting = useCallback(async (quiet = false) => {
        try {
            const settingData = await getRedundantBackupSetting();
            setSetting(settingData);
            form.setFieldsValue({
                enabled: settingData.enabled ?? true,
                intervalHours: settingData.intervalHours || 24,
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

    const handleSaveSetting = async () => {
        let values: RedundantBackupSetting;
        try {
            values = await form.validateFields();
        } catch {
            return;
        }

        setSavingSetting(true);
        try {
            const updated = await updateRedundantBackupSetting(values);
            setSetting(updated);
            message.success("冗余备份策略已保存！后台调度器已更新。");
            await loadStatus(true);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存备份策略失败");
        } finally {
            setSavingSetting(false);
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
                webdavEnabled: true,
                webdavEndpoint: oss.endpoint,
                webdavUsername: oss.accessKeyId,
                webdavPathPrefix: oss.pathPrefix || "mexaiai-canvas",
            });
            message.success("已从存储服务导入 WebDAV 配置！请补充密码后保存。");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "导入存储配置失败");
        }
    };

    const isBusy = running || status?.isRunning;
    const currentIntervalHours = Form.useWatch("intervalHours", form) || 24;
    const watchWebdavEnabled = Form.useWatch("webdavEnabled", form);

    return (
        <AdminPageFrame
            title="冗余备份"
            description="全站画布、工程结构、数据库与媒体原件完整镜像。支持自定义周期自动循环备份与 WebDAV 远程容灾。"
            scroll
            actions={
                <div className="flex items-center gap-2">
                    <Button icon={<RefreshCw className="size-3.5" />} onClick={() => void loadStatus()}>
                        刷新状态
                    </Button>
                    <Button
                        type="primary"
                        icon={<Play className="size-3.5" />}
                        loading={isBusy}
                        onClick={() => void handleRunBackup()}
                        className="!rounded-xl"
                    >
                        {isBusy ? (status?.progressText || "备份同步中...") : "立即执行全量冗余备份"}
                    </Button>
                </div>
            }
        >
            <div className="w-full space-y-6">
                {/* 1. 状态卡片 */}
                <SettingsSectionCard
                    layout="stacked"
                    className="w-full !max-w-none"
                    contentClassName="w-full !max-w-none"
                    title="冗余备份仓状态"
                    description="备份仓保存在外部备份目录或独立存储卷中，包含自动还原的数据库快照、全量媒体资源、Docker 编排配置与启动脚本。"
                >
                    {loading && !status ? (
                        <Skeleton active paragraph={{ rows: 3 }} />
                    ) : (
                        <div className="w-full space-y-5">
                            <div className="w-full rounded-xl border border-border/80 bg-background/50 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                                    <div className="flex items-center gap-2">
                                        <Server className="size-4 text-primary" />
                                        <span className="text-sm font-semibold text-foreground">备份存储目标</span>
                                    </div>
                                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                        <CheckCircle2 className="size-3" />
                                        {status?.lastBackupTime ? "自包含备份就绪" : "就绪 · 待首次同步"}
                                    </span>
                                </div>
                                <div className="mt-3 flex flex-col gap-2 font-mono text-xs text-foreground/80 break-all">
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground select-none font-sans">本地目录：</span>
                                        <code className="rounded bg-muted px-1.5 py-0.5 font-bold">{status?.targetDir}</code>
                                    </div>
                                    {status?.webdavEnabled && status?.webdavTarget ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground select-none font-sans">WebDAV 远端：</span>
                                            <code className="rounded bg-blue-500/10 text-blue-500 px-1.5 py-0.5 font-bold">
                                                {status.webdavTarget}
                                            </code>
                                        </div>
                                    ) : null}
                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-muted-foreground font-sans mt-0.5">
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
                                            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                                <Clock3 className="size-3.5" />
                                                <span>
                                                    下次计划备份：
                                                    {new Date(status.nextBackupTime).toLocaleString("zh-CN")}
                                                    （每 {status.intervalHours} 小时循环）
                                                </span>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            {/* 核心指标 */}
                            <div className="grid gap-4 sm:grid-cols-4">
                                <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                                        <FolderKanban className="size-4 text-blue-500" />
                                        <span>媒体资源总数</span>
                                    </div>
                                    <div className="text-2xl font-bold font-mono text-foreground">
                                        {formatNumber(status?.totalResources)}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        媒体占用：{formatBytes(status?.totalResourceBytes)}
                                    </p>
                                </div>

                                <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                                        <Database className="size-4 text-emerald-500" />
                                        <span>数据库快照</span>
                                    </div>
                                    <div className="text-2xl font-bold font-mono text-foreground">
                                        {formatBytes(status?.databaseSqlBytes)}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        全量画布、连线与节点元数据 (SQL)
                                    </p>
                                </div>

                                <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                                        <Clock3 className="size-4 text-amber-500" />
                                        <span>备份周期策略</span>
                                    </div>
                                    <div className="text-lg font-bold text-foreground">
                                        {status?.autoBackupEnabled ? `每 ${status.intervalHours} 小时自动循环` : "仅手动触发"}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        {status?.autoBackupEnabled ? "后台守护定时增量同步" : "自动调度已停用"}
                                    </p>
                                </div>

                                <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                                        <ShieldCheck className="size-4 text-purple-500" />
                                        <span>异地恢复特性</span>
                                    </div>
                                    <div className="text-lg font-bold text-foreground">
                                        免配置 / 一键启动
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        docker-entrypoint 自动导入
                                    </p>
                                </div>
                            </div>

                            {status?.lastError ? (
                                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
                                    {status.lastError}
                                </div>
                            ) : null}
                        </div>
                    )}
                </SettingsSectionCard>

                {/* 2. 自动周期备份策略与目标配置 */}
                <SettingsSectionCard
                    layout="stacked"
                    className="w-full !max-w-none"
                    contentClassName="w-full !max-w-none"
                    icon={<Settings2 className="size-4" />}
                    title="自动周期备份与远程存储设置"
                    description="设置全站数据库与媒体原件的定时循环备份频率，并可直接开启 WebDAV 远程端同步，将完整备份镜像至 NAS 或云盘。"
                    footer={
                        <div className="flex items-center justify-end gap-2 w-full">
                            <Button
                                type="primary"
                                icon={<Save className="size-3.5" />}
                                loading={savingSetting}
                                onClick={() => void handleSaveSetting()}
                            >
                                保存备份策略
                            </Button>
                        </div>
                    }
                >
                    <Form form={form} layout="vertical" requiredMark={false}>
                        <div className="space-y-6">
                            {/* 周期策略 */}
                            <div className="rounded-xl border border-border/70 bg-card/60 p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-foreground">自动定时周期备份</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            开启后系统后台会自动按照设定的周期循环导出数据库快照并同步媒体资源。
                                        </div>
                                    </div>
                                    <Form.Item name="enabled" valuePropName="checked" noStyle>
                                        <Switch checkedChildren="已开启" unCheckedChildren="已关闭" />
                                    </Form.Item>
                                </div>

                                <div className="pt-2 border-t border-border/50">
                                    <div className="text-xs font-medium text-foreground mb-2">常用周期预设快捷选择：</div>
                                    <div className="flex flex-wrap gap-2">
                                        {PRESET_INTERVALS.map((item) => (
                                            <Button
                                                key={item.hours}
                                                size="small"
                                                type={currentIntervalHours === item.hours ? "primary" : "default"}
                                                onClick={() => form.setFieldValue("intervalHours", item.hours)}
                                                className="!text-xs"
                                            >
                                                {item.label}
                                            </Button>
                                        ))}
                                    </div>

                                    <div className="mt-3 flex items-center gap-3">
                                        <Form.Item
                                            name="intervalHours"
                                            label="循环周期（小时）"
                                            className="!mb-0"
                                            extra="支持设置 1 ~ 720 小时（最长 30 天循环一次）"
                                        >
                                            <InputNumber min={1} max={720} precision={0} className="w-36" addonAfter="小时" />
                                        </Form.Item>
                                    </div>
                                </div>
                            </div>

                            {/* WebDAV 远程备份仓设置 */}
                            <div className="rounded-xl border border-border/70 bg-card/60 p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Cloud className="size-4 text-blue-500" />
                                        <div>
                                            <div className="text-sm font-semibold text-foreground">同步至 WebDAV 远程备份仓</div>
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                将数据库快照、媒体原件、Docker 启动编排直接增量推送到 WebDAV，实现异地容灾（在 NAS / 网盘中文件直观可见）。
                                            </div>
                                        </div>
                                    </div>
                                    <Form.Item name="webdavEnabled" valuePropName="checked" noStyle>
                                        <Switch checkedChildren="开启同步" unCheckedChildren="仅本地保存" />
                                    </Form.Item>
                                </div>

                                {watchWebdavEnabled ? (
                                    <div className="pt-3 border-t border-border/50 space-y-4">
                                        <div className="flex justify-end">
                                            <Button
                                                size="small"
                                                icon={<DownloadCloud className="size-3.5" />}
                                                onClick={() => void handleImportFromOSS()}
                                                className="!text-xs"
                                            >
                                                从存储服务一键导入 WebDAV 配置
                                            </Button>
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <Form.Item
                                                name="webdavEndpoint"
                                                label="WebDAV 服务地址"
                                                rules={[{ required: true, message: "请填写 WebDAV 服务地址" }]}
                                                extra="例如 http://192.168.31.141:5002/Life 或 https://dav.example.com"
                                            >
                                                <Input placeholder="http://192.168.31.141:5002/Life" />
                                            </Form.Item>

                                            <Form.Item
                                                name="webdavPathPrefix"
                                                label="远端备份子路径（可选）"
                                                extra="保存在 WebDAV 下的具体子目录，例如 mexaiai-canvas 或 backups"
                                            >
                                                <Input placeholder="mexaiai-canvas" />
                                            </Form.Item>
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-2">
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
                                                <Input.Password placeholder={setting?.hasWebdavPassword ? "留空保留原密码" : "输入密码"} />
                                            </Form.Item>
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            {/* 本地挂载路径设置 */}
                            <Form.Item
                                name="targetDir"
                                label="本地备份存储路径（可选自定义）"
                                extra="留空默认使用系统配置路径（/backups/redundant）。在 Docker 环境中建议挂载外部存储卷到该目录。"
                            >
                                <Input placeholder="/backups/redundant" />
                            </Form.Item>
                        </div>
                    </Form>
                </SettingsSectionCard>

                {/* 3. 恢复使用指南 */}
                <SettingsSectionCard
                    layout="stacked"
                    className="w-full !max-w-none"
                    contentClassName="w-full !max-w-none"
                    title="异地环境 / 灾难恢复运行指南"
                    description="当当前机器故障、迁移到新服务器或需要在其他 VPS / 主机上运行时，按以下步骤直接启动即可恢复全站。"
                >
                    <div className="w-full space-y-4 text-xs leading-6 text-foreground/80">
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
        </AdminPageFrame>
    );
}
