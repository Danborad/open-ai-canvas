import { http } from "./request";

export interface WecomSetting {
    enabled: boolean;
    webhookUrl: string;
    hasWebhookUrl: boolean;
    scheduleTime: string;
    targetDomain: string;
    mentionAll: boolean;
    notifyNewUser: boolean;
    lastSentAt?: string;
    lastSentStatus?: string;
    updatedAt: string;
}

export interface WecomSettingRequest {
    enabled: boolean;
    webhookUrl?: string;
    scheduleTime?: string;
    targetDomain?: string;
    mentionAll?: boolean;
    notifyNewUser?: boolean;
}

export interface ModelUsageStat {
    modelName: string;
    channelName?: string;
    taskCount: number;
    successCount: number;
    failedCount: number;
}

export interface WecomDailyReportData {
    reportTime: string;
    totalUsers: number;
    activeUsersToday: number;
    totalTasksToday: number;
    successTasks: number;
    failedTasks: number;
    totalImagesToday: number;
    imageSuccess: number;
    imageFailed: number;
    totalVideosToday: number;
    videoSuccess: number;
    videoFailed: number;
    topCreators: Array<{
        accountName: string;
        taskCount: number;
    }>;
    modelStats: ModelUsageStat[];
    systemImages: number;
    systemImageBytes: number;
    systemVideos: number;
    systemVideoBytes: number;
    systemTotalBytes: number;
    esaDomain: string;
    esaTrafficBytes: number;
    esaRequestCount: number;
    esaEnabled: boolean;
    esaError?: string;
}

export interface WecomTestResult {
    sent: boolean;
    content: string;
    message: string;
    data?: WecomDailyReportData;
}

export interface WecomPreviewResult {
    data: WecomDailyReportData;
    content: string;
}

export function getWecomSetting(signal?: AbortSignal) {
    return http.get<{ setting: WecomSetting }>("/admin/wecom/settings", { signal });
}

export function updateWecomSetting(req: WecomSettingRequest) {
    return http.patch<{ setting: WecomSetting }>("/admin/wecom/settings", req);
}

export function testWecomNotification() {
    return http.post<WecomTestResult>("/admin/wecom/test", {});
}

export function testWecomRegisterNotification() {
    return http.post<WecomTestResult>("/admin/wecom/test-register-notice", {});
}

export function previewWecomReport(signal?: AbortSignal) {
    return http.get<WecomPreviewResult>("/admin/wecom/preview", { signal });
}
