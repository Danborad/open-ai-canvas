import { http } from "@/services/api/request";

export type RedundantBackupStatus = {
    targetDir: string;
    configured: boolean;
    lastBackupTime?: string;
    version: string;
    schemaVersion: number;
    totalResources: number;
    totalResourceBytes: number;
    databaseSqlBytes: number;
    isRunning: boolean;
    lastError?: string;
};

// 兼容别名
export type PortableBackupStatus = RedundantBackupStatus;

export function getRedundantBackupStatus() {
    return http.get<RedundantBackupStatus>("/admin/redundant-backup/status");
}

export function triggerRedundantBackup() {
    return http.post<RedundantBackupStatus>("/admin/redundant-backup/run");
}

// 兼容别名导出
export const getPortableBackupStatus = getRedundantBackupStatus;
export const triggerPortableBackup = triggerRedundantBackup;
