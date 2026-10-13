import { expect, test } from "bun:test";
import { sameCanvasContent } from "../src/lib/canvas/canvas-content";
import { useSyncProgressStore } from "../src/stores/use-sync-progress-store";
import type { CanvasProject } from "../src/stores/canvas/use-canvas-store";

test("sameCanvasContent 兼容服务端的 null 与客户端的 undefined 缺省值", () => {
    const baseProject: CanvasProject = {
        id: "p1",
        revision: 1,
        title: "测试画布",
        createdAt: "2026-10-13T00:00:00Z",
        updatedAt: "2026-10-13T00:00:00Z",
        nodes: [],
        connections: [],
        chatSessions: [],
        activeChatId: null as unknown as null,
        appearance: { mode: "dark" },
        backgroundMode: "dots",
        showImageInfo: false,
        viewport: { x: 0, y: 0, k: 1 },
        previsScenes: [],
    };

    const clientProject: CanvasProject = {
        ...baseProject,
        activeChatId: undefined as unknown as null,
        coverBlurred: undefined,
        timeline: undefined,
        starterMode: undefined,
    };

    // 结构语义相同，不能被判定为修改未保存
    expect(sameCanvasContent(baseProject, clientProject)).toBe(true);
});

test("isAnySyncing 只在真正处于上传或保存时拦截，不把已停止的 error 误判为正在同步", () => {
    useSyncProgressStore.getState().clearAll();
    expect(useSyncProgressStore.getState().isAnySyncing()).toBe(false);

    // saving 中应该拦截
    useSyncProgressStore.getState().setProjectProgress("p1", {
        phase: "saving",
        projectId: "p1",
        total: 0,
        completed: 0,
    });
    expect(useSyncProgressStore.getState().isAnySyncing()).toBe(true);

    // done 时不拦截
    useSyncProgressStore.getState().setProjectProgress("p1", {
        phase: "done",
    });
    expect(useSyncProgressStore.getState().isAnySyncing()).toBe(false);

    // error 时不假装正在同步
    useSyncProgressStore.getState().setProjectProgress("p1", {
        phase: "error",
    });
    expect(useSyncProgressStore.getState().isAnySyncing()).toBe(false);

    useSyncProgressStore.getState().clearAll();
});

test("user-data-sync 中 operations 为空时明确收敛为 done，不悬挂 saving 状态", async () => {
    const syncFile = await Bun.file(new URL("../src/services/user-data-sync.ts", import.meta.url)).text();

    expect(syncFile).toContain("if (!operations.length) {");
    expect(syncFile).toContain('phase: "done"');
    expect(syncFile).toContain("pendingChanges: 0");
});
