import { apiClient, request } from "./request";

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
    return request<{ setting: WecomSetting }>(apiClient.get("/admin/wecom/settings", { signal }));
}

export function updateWecomSetting(req: WecomSettingRequest) {
    return request<{ setting: WecomSetting }>(apiClient.patch("/admin/wecom/settings", req));
}

export function testWecomNotification() {
    return request<WecomTestResult>(apiClient.post("/admin/wecom/test", {}));
}

export function testWecomRegisterNotification() {
    return request<WecomTestResult>(apiClient.post("/admin/wecom/test-register-notice", {}));
}

export function previewWecomReport(signal?: AbortSignal) {
    return request<WecomPreviewResult>(apiClient.get("/admin/wecom/preview", { signal }));
}
