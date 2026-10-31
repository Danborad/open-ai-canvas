import { App, Button, Skeleton } from "antd";
import { Archive, CheckCircle2, Clock3, Database, HardDrive, RefreshCw, Server, ShieldCheck, Play, FolderKanban } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminPageFrame } from "../components/admin-shell";
import { SettingsSectionCard } from "../components/admin-ui";
import { getPortableBackupStatus, triggerPortableBackup, type PortableBackupStatus } from "@/services/api/portable-backup";

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

export default function PortableBackupPage() {
    const { message } = App.useApp();
    const [status, setStatus] = useState<PortableBackupStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);

    const load = useCallback(async (quiet = false) => {
        if (!quiet) setLoading(true);
        try {
            const data = await getPortableBackupStatus();
            setStatus(data);
        } catch (error) {
            if (!quiet) message.error(error instanceof Error ? error.message : "获取灾备状态失败");
        } finally {
            if (!quiet) setLoading(false);
        }
    }, [message]);

    useEffect(() => {
        void load();
        const timer = setInterval(() => {
            void load(true);
        }, 8000);
        return () => clearInterval(timer);
    }, [load]);

    const handleRunBackup = async () => {
        setRunning(true);
        try {
            await triggerPortableBackup();
            message.success("已启动便携全量灾备任务，后台正在向 NAS 增量同步数据与数据库快照！");
            await load(true);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "启动备份失败");
        } finally {
            setRunning(false);
        }
    };

    const isBusy = running || status?.isRunning;

    return (
        <AdminPageFrame
            title="便携全量灾备"
            description="全站画布、工程结构、数据库与媒体原件完整镜像。新机器开箱即用，执行一条命令直接启动恢复。"
            scroll
            actions={
                <div className="flex items-center gap-2">
                    <Button icon={<RefreshCw className="size-3.5" />} onClick={() => void load()}>
                        刷新状态
                    </Button>
                    <Button
                        type="primary"
                        icon={<Play className="size-3.5" />}
                        loading={isBusy}
                        onClick={() => void handleRunBackup()}
                        className="!rounded-xl"
                    >
                        {isBusy ? "灾备同步中..." : "立即全量同步到 NAS"}
                    </Button>
                </div>
            }
        >
            <div className="space-y-6">
                <SettingsSectionCard
                    title="便携自愈备份仓状态"
                    description="备份仓保存在 NAS / 外部大容量存储中，包含自动还原的数据库、全量媒体资源原件、Docker 编排配置与启动脚本。"
                >
                    {loading ? (
                        <Skeleton active paragraph={{ rows: 3 }} />
                    ) : (
                        <div className="space-y-5">
                            <div className="rounded-xl border border-border/80 bg-background/50 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                                    <div className="flex items-center gap-2">
                                        <Server className="size-4 text-primary" />
                                        <span className="text-sm font-semibold text-foreground">备份仓存储目标</span>
                                    </div>
                                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                        <CheckCircle2 className="size-3" />
                                        {status?.lastBackupTime ? "自包含备份就绪" : "就绪 · 待首次同步"}
                                    </span>
                                </div>
                                <div className="mt-3 flex flex-col gap-1.5 font-mono text-xs text-foreground/80 break-all">
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground select-none font-sans">目标路径：</span>
                                        <code className="rounded bg-muted px-1.5 py-0.5 font-bold">{status?.targetDir}</code>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground font-sans mt-0.5">
                                        <Clock3 className="size-3.5" />
                                        <span>
                                            上次备份时间：
                                            {status?.lastBackupTime
                                                ? new Date(status.lastBackupTime).toLocaleString("zh-CN")
                                                : "尚未执行全量备份"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* 核心指标 */}
                            <div className="grid gap-4 sm:grid-cols-3">
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
                                        <ShieldCheck className="size-4 text-purple-500" />
                                        <span>自愈恢复特性</span>
                                    </div>
                                    <div className="text-lg font-bold text-foreground">
                                        0 填配置 / 一键启动
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

                {/* 灾难恢复使用指南 */}
                <SettingsSectionCard
                    title="新机器 / 灾难恢复运行说明"
                    description="当当前机器损坏、系统重装或需要在局域网另一台机器上运行时，按照以下步骤直接启动即可恢复全站。"
                >
                    <div className="space-y-4 text-xs leading-6 text-foreground/80">
                        <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/40 p-3.5">
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                                1
                            </span>
                            <div>
                                <strong className="text-sm text-foreground">在新机器上访问或挂载 NAS 备份目录</strong>
                                <p className="text-muted-foreground mt-0.5">
                                    确保新机器能够访问该备份文件夹（无论通过本地路径、网络共享还是直接把硬盘插到新机器上）。
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/40 p-3.5">
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                                2
                            </span>
                            <div>
                                <strong className="text-sm text-foreground">直接执行一键启动命令（无需进入后台配置）</strong>
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
                                    数据库首次启动会自动导入 <code>initdb/01-restore-canvas.sql</code>，媒体文件直接就位。浏览器访问 <code>http://新机器IP:3000</code>，所有画布和历史工程完全还原！
                                </p>
                            </div>
                        </div>
                    </div>
                </SettingsSectionCard>
            </div>
        </AdminPageFrame>
    );
}
