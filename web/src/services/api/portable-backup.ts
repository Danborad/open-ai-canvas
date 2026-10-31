import { http } from "@/services/api/request";

export type PortableBackupStatus = {
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

export function getPortableBackupStatus() {
    return http.get<PortableBackupStatus>("/admin/portable-backup/status");
}

export function triggerPortableBackup() {
    return http.post<PortableBackupStatus>("/admin/portable-backup/run");
}
