import { http } from "@/services/api/request";

export type RedundantBackupStatus = {
    targetDir: string;
    configured: boolean;
    lastBackupTime?: string;
    nextBackupTime?: string;
    version: string;
    schemaVersion: number;
    totalResources: number;
    totalResourceBytes: number;
    databaseSqlBytes: number;
    isRunning: boolean;
    progressText?: string;
    progressPercent?: number;
    currentStep?: string;
    processedFiles?: number;
    totalFiles?: number;
    lastError?: string;
    autoBackupEnabled: boolean;
    intervalHours: number;
    webdavEnabled?: boolean;
    webdavTarget?: string;
};

export type RedundantBackupSetting = {
    enabled: boolean;
    intervalHours: number;
    targetDir?: string;
    webdavEnabled?: boolean;
    webdavEndpoint?: string;
    webdavUsername?: string;
    webdavPassword?: string;
    hasWebdavPassword?: boolean;
    webdavPathPrefix?: string;
    updatedAt?: string;
};

// 兼容别名
export type PortableBackupStatus = RedundantBackupStatus;

export function getRedundantBackupStatus() {
    return http.get<RedundantBackupStatus>("/admin/redundant-backup/status");
}

export function triggerRedundantBackup() {
    return http.post<RedundantBackupStatus>("/admin/redundant-backup/run");
}

export function getRedundantBackupSetting() {
    return http.get<RedundantBackupSetting>("/admin/redundant-backup/setting");
}

export function updateRedundantBackupSetting(input: Partial<RedundantBackupSetting>) {
    return http.patch<RedundantBackupSetting>("/admin/redundant-backup/setting", input);
}

// 兼容别名导出
export const getPortableBackupStatus = getRedundantBackupStatus;
export const triggerPortableBackup = triggerRedundantBackup;
