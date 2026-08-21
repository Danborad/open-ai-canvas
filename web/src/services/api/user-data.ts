import type { Asset } from "@/stores/use-asset-store";
import type { CanvasProject } from "@/stores/canvas/use-canvas-store";
import { apiClient, request } from "@/services/api/request";

const api = apiClient;

export type RemoteUserDataSummary = {
    id: string;
    kind?: string;
    title: string;
    createdAt: string;
    updatedAt: string;
};

export function listRemoteAssets() {
    return request<{ assets: RemoteUserDataSummary[] }>(api.get("/assets"));
}

export function getRemoteAsset(id: string) {
    return request<{ asset: Asset }>(api.get(`/assets/${encodeURIComponent(id)}`));
}

export function upsertRemoteAsset(asset: Asset) {
    return request<{ asset: RemoteUserDataSummary }>(api.put(`/assets/${encodeURIComponent(asset.id)}`, { asset }));
}

export function deleteRemoteAsset(id: string) {
    return request<{ id: string }>(api.delete(`/assets/${encodeURIComponent(id)}`));
}

export function listRemoteCanvasProjects() {
    return request<{ projects: RemoteUserDataSummary[] }>(api.get("/canvas-projects"));
}

export function getRemoteCanvasProject(id: string) {
    return request<{ project: CanvasProject }>(api.get(`/canvas-projects/${encodeURIComponent(id)}`));
}

export function upsertRemoteCanvasProject(project: CanvasProject) {
    return request<{ project: RemoteUserDataSummary }>(api.put(`/canvas-projects/${encodeURIComponent(project.id)}`, { project }));
}

export function deleteRemoteCanvasProject(id: string) {
    return request<{ id: string }>(api.delete(`/canvas-projects/${encodeURIComponent(id)}`));
}

export type CanvasProjectStats = {
    projectId: string;
    imageCount: number;
    videoCount: number;
    imageCreditsMicros: number;
    videoCreditsMicros: number;
};

export function getCanvasProjectStats(id: string) {
    return request<{ stats: CanvasProjectStats[] }>(api.get("/canvas-project-stats", { params: { ids: id } })).then(({ stats }) => stats[0] || { projectId: id, imageCount: 0, videoCount: 0, imageCreditsMicros: 0, videoCreditsMicros: 0 });
}
