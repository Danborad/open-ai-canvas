import { http } from "@/services/api/request";

export type PromotionOverview = {
    enabled: boolean;
    inviteCode: string;
    inviterRewardCredits: number;
    inviteeRewardCredits: number;
    invitedCount: number;
    totalRewardCredits: number;
};

export type PromotionInvitationItem = {
    id: string;
    inviteeId: string;
    inviteeName: string;
    inviteeContact: string;
    rewardCredits: number;
    createdAt: string;
};

export type PromotionInvitationPage = {
    items: PromotionInvitationItem[];
    total: number;
    page: number;
    limit: number;
};

export type AdminPromotionInvitationRow = {
    id: string;
    inviterId: string;
    inviterName: string;
    inviterContact: string;
    inviteeId: string;
    inviteeName: string;
    inviteeContact: string;
    code: string;
    rewardCredits: number;
    createdAt: string;
};

export type AdminPromotionInvitationPage = {
    items: AdminPromotionInvitationRow[];
    total: number;
    page: number;
    limit: number;
};

export type PromotionPolicy = {
    enabled: boolean;
    inviterRewardCredits: number;
    inviteeRewardCredits: number;
};

// 用户端获取推广中心看板
export function getPromotionOverview() {
    return http.get<{ overview: PromotionOverview }>("/promotion/overview");
}

// 注册页未登录时使用：返回推广是否开放及校验邀请码
export function getPublicPromotionStatus(code?: string) {
    return http.get<{ enabled: boolean; inviteCodeValid: boolean }>("/public/promotion-status", {
        params: code ? { code } : undefined,
    });
}

// 用户端分页查询我邀请的好友明细
export function listPromotionInvitations(params: { page?: number; pageSize?: number } = {}) {
    return http.get<PromotionInvitationPage>("/promotion/invitations", { params });
}

// 管理端读取推广注册送积分策略
export function getAdminPromotionPolicy() {
    return http.get<{ policy: PromotionPolicy }>("/admin/promotion/policy");
}

// 管理端更新推广注册送积分策略
export function updateAdminPromotionPolicy(policy: PromotionPolicy) {
    return http.patch<{ policy: PromotionPolicy }>("/admin/promotion/policy", policy);
}

// 管理端分页查询全站邀请记录
export function listAdminPromotionInvitations(params: { page?: number; pageSize?: number } = {}) {
    return http.get<AdminPromotionInvitationPage>("/admin/promotion/invitations", { params });
}
