import { expect, test } from "bun:test";
import localforage from "localforage";

import { isolateCopiedNodeMetadata } from "../src/lib/canvas/canvas-node-copy";
import { removeCanvasNodes } from "../src/lib/canvas/canvas-project-domain";
import { resetGenerationTaskMetadata } from "../src/lib/canvas/canvas-project-generation";
import { parseCanvasStorageDocument } from "../src/lib/canvas/canvas-storage-revision";
import { setActiveUserScope } from "../src/lib/user-scope";
import { persistCanvasGenerationEffect } from "../src/services/canvas-generation-consumer";
import { CANVAS_STORE_KEY, flushCanvasStorePersistence, useCanvasStore, withCanvasStorePersistenceSuppressed, type CanvasProject } from "../src/stores/canvas/use-canvas-store";
import { CanvasNodeType, type CanvasNodeData } from "../src/types/canvas";

for (const mode of ["variant", "copy"] as const) {
    test(`${mode}: 成功图片的副本可落盘、回填和刷新，删除后不被旧结果复活`, async () => {
        await flushCanvasStorePersistence();
        const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
        const originalGetItem = localforage.getItem;
        const originalSetItem = localforage.setItem;
        const previousState = useCanvasStore.getState();
        const values = new Map<string, string>();
        const localStorage = new Map<string, string>();
        const scope = `canvas-node-copy-persistence-${mode}`;
        const storageKey = `${CANVAS_STORE_KEY}:user:${scope}`;
        Object.defineProperty(globalThis, "window", {
            configurable: true,
            value: {
                localStorage: {
                    getItem: (key: string) => localStorage.get(key) ?? null,
                    setItem: (key: string, value: string) => localStorage.set(key, value),
                    removeItem: (key: string) => localStorage.delete(key),
                },
            },
        });
        localforage.getItem = (async (key: string) => values.get(key) ?? null) as typeof localforage.getItem;
        localforage.setItem = (async (key: string, value: string) => {
            values.set(key, value);
            return value;
        }) as typeof localforage.setItem;

        try {
            setActiveUserScope(scope);
            const source: CanvasNodeData = {
                id: "source",
                type: CanvasNodeType.Image,
                title: "原图",
                position: { x: 100, y: 100 },
                width: 340,
                height: 240,
                metadata: { status: "loading", taskId: "source-task" },
            };
            const project: CanvasProject = {
                id: "copy-project",
                title: "副本回归",
                createdAt: "2026-09-09T00:00:00.000Z",
                updatedAt: "2026-09-09T00:00:00.000Z",
                nodes: [source],
                connections: [],
                chatSessions: [],
                activeChatId: null,
                backgroundMode: "dots",
                showImageInfo: false,
                viewport: { x: 0, y: 0, k: 1 },
                directorScenes: [],
            };
            useCanvasStore.setState({ projects: [project] });
            await flushCanvasStorePersistence();
            const sourceEffect = "attach-node:source-task:source:0";
            const completedSource: CanvasNodeData = {
                ...source,
                metadata: { ...source.metadata, status: "success", content: "/api/resources/source/file", storageKey: "resource:source", assetId: "source-asset", generationEffectKeys: [sourceEffect] },
            };
            await persistCanvasGenerationEffect({ projectId: project.id, effectKey: sourceEffect, previousNodes: [source], nodes: [completedSource] });
            const currentProject = () => useCanvasStore.getState().projects.find((item) => item.id === project.id)!;
            const durableProject = () => parseCanvasStorageDocument(values.get(storageKey) ?? null).state.projects.find((item) => item.id === project.id)!;
            const original = currentProject().nodes[0];
            expect(original.metadata?.generationEffectKeys).toEqual([sourceEffect]);

            const copyId = `${mode}-node`;
            const copied: CanvasNodeData = {
                ...original,
                id: copyId,
                title: mode === "variant" ? "原图 · B" : "原图_copy1",
                position: { x: 100, y: 400 },
                metadata: {
                    ...isolateCopiedNodeMetadata(original, new Map([[source.id, copyId]])),
                    ...(mode === "variant" ? { versionOfNodeId: source.id, versionLabel: "B", versionPrimary: false } : {}),
                },
            };
            useCanvasStore.getState().updateProject(project.id, { nodes: [original, copied] });
            await flushCanvasStorePersistence();

            // 普通保存必须包含新副本，不能把源节点的确认标记当成副本尚未确认的生成。
            expect(durableProject().nodes.map((node) => node.id)).toEqual([source.id, copyId]);
            expect(durableProject().nodes[1].metadata?.generationEffectKeys).toBeUndefined();

            const pending: CanvasNodeData = { ...copied, metadata: { ...copied.metadata, status: "loading", content: "", taskId: "copy-task" } };
            useCanvasStore.getState().updateProject(project.id, { nodes: [original, pending] });
            const copyEffect = `attach-node:copy-task:${copyId}:0`;
            const completed: CanvasNodeData = {
                ...pending,
                metadata: { ...pending.metadata, status: "success", content: "/api/resources/copy/file", storageKey: "resource:copy", assetId: "copy-asset", generationEffectKeys: [copyEffect] },
            };
            await persistCanvasGenerationEffect({ projectId: project.id, effectKey: copyEffect, previousNodes: [original, pending], nodes: [original, completed] });
            await flushCanvasStorePersistence();
            await useCanvasStore.persist.rehydrate();

            expect(currentProject().nodes.map((node) => node.id)).toEqual([source.id, copyId]);
            expect(currentProject().nodes[0]).toEqual(original);
            expect(currentProject().nodes[1].metadata).toMatchObject({ content: "/api/resources/copy/file", assetId: "copy-asset", taskId: "copy-task", generationEffectKeys: [copyEffect] });
            expect(currentProject().nodes[1].position).toEqual(copied.position);
            if (mode === "variant") expect(currentProject().nodes[1].metadata?.versionOfNodeId).toBe(source.id);
            else expect(currentProject().nodes[1].metadata?.versionOfNodeId).toBeUndefined();
            // 同一节点重试仍需保留本节点已经确认的标记。
            expect(resetGenerationTaskMetadata(currentProject().nodes[1].metadata).generationEffectKeys).toEqual([copyEffect]);

            const beforeDelete = currentProject().nodes;
            useCanvasStore.getState().updateProject(project.id, { nodes: removeCanvasNodes(beforeDelete, new Set([copyId])).nodes });
            await flushCanvasStorePersistence();
            await useCanvasStore.persist.rehydrate();
            expect(currentProject().nodes.map((node) => node.id)).toEqual([source.id]);

            const lateEffect = `attach-node:late-task:${copyId}:0`;
            const lateNodes = beforeDelete.map((node) => node.id === copyId ? { ...node, metadata: { ...node.metadata, generationEffectKeys: [copyEffect, lateEffect] } } : node);
            await expect(persistCanvasGenerationEffect({ projectId: project.id, effectKey: lateEffect, previousNodes: beforeDelete, nodes: lateNodes })).rejects.toThrow("画布生成副作用与已删除内容冲突");
            await flushCanvasStorePersistence();
            await useCanvasStore.persist.rehydrate();
            expect(durableProject().nodes.map((node) => node.id)).toEqual([source.id]);
            expect(currentProject().nodes.map((node) => node.id)).toEqual([source.id]);
        } finally {
            await flushCanvasStorePersistence();
            withCanvasStorePersistenceSuppressed(() => useCanvasStore.setState({ projects: previousState.projects, hydrated: previousState.hydrated }));
            localforage.getItem = originalGetItem;
            localforage.setItem = originalSetItem;
            if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
            else delete (globalThis as { window?: unknown }).window;
        }
    });
}

test("创建参数变体后批量生成多图，普通持久化与副作用确认不丢弃变体根与子节点", async () => {
    await flushCanvasStorePersistence();
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
    const originalGetItem = localforage.getItem;
    const originalSetItem = localforage.setItem;
    const previousState = useCanvasStore.getState();
    const values = new Map<string, string>();
    const localStorage = new Map<string, string>();
    const scope = "canvas-variant-batch-persistence";
    const storageKey = `${CANVAS_STORE_KEY}:user:${scope}`;
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
            localStorage: {
                getItem: (key: string) => localStorage.get(key) ?? null,
                setItem: (key: string, value: string) => localStorage.set(key, value),
                removeItem: (key: string) => localStorage.delete(key),
            },
        },
    });
    localforage.getItem = (async (key: string) => values.get(key) ?? null) as typeof localforage.getItem;
    localforage.setItem = (async (key: string, value: string) => {
        values.set(key, value);
        return value;
    }) as typeof localforage.setItem;

    try {
        setActiveUserScope(scope);
        const source: CanvasNodeData = {
            id: "source-a",
            type: CanvasNodeType.Image,
            title: "原图 · A",
            position: { x: 0, y: 0 },
            width: 340,
            height: 240,
            metadata: {
                status: "success",
                content: "/api/resources/source/file",
                storageKey: "resource:source",
                versionOfNodeId: "source-a",
                versionLabel: "A",
                versionPrimary: true,
                generationEffectKeys: ["attach-node:source-task:source-a:0"],
            },
        };
        const project: CanvasProject = {
            id: "batch-project",
            title: "变体批次项目",
            createdAt: "2026-09-09T00:00:00.000Z",
            updatedAt: "2026-09-09T00:00:00.000Z",
            nodes: [source],
            connections: [],
            chatSessions: [],
            activeChatId: null,
            backgroundMode: "dots",
            showImageInfo: false,
            viewport: { x: 0, y: 0, k: 1 },
            directorScenes: [],
        };
        useCanvasStore.setState({ projects: [project] });
        await flushCanvasStorePersistence();

        const variantId = "variant-b";
        const variantNode: CanvasNodeData = {
            ...source,
            id: variantId,
            title: "原图 · B",
            position: { x: 36, y: 36 },
            metadata: {
                ...isolateCopiedNodeMetadata(source, new Map([[source.id, variantId]])),
                versionOfNodeId: source.id,
                versionLabel: "B",
                versionPrimary: false,
            },
        };

        const childIds = ["batch-c0", "batch-c1", "batch-c2", "batch-c3"];
        const rootGeneratingNode: CanvasNodeData = {
            ...variantNode,
            metadata: {
                ...variantNode.metadata,
                status: "loading",
                content: "",
                isBatchRoot: true,
                batchChildIds: childIds,
            },
        };
        const childNodes: CanvasNodeData[] = childIds.map((cid, i) => ({
            id: cid,
            type: CanvasNodeType.Image,
            title: `原图 · B · ${i + 1}`,
            position: { x: 100 + i * 50, y: 100 },
            width: 340,
            height: 240,
            metadata: { status: "loading", batchRootId: variantId },
        }));

        const currentNodes = [source, rootGeneratingNode, ...childNodes];
        useCanvasStore.getState().updateProject(project.id, { nodes: currentNodes });

        // 模拟 4 个子任务并发完成并确认持久化
        let nodesRef = [...currentNodes];
        for (let i = 0; i < childIds.length; i += 1) {
            const cid = childIds[i]!;
            const effectKey = `attach-node:task-${i}:${cid}:0`;
            const previousNodes = [...nodesRef];
            const appliedNodes = nodesRef.map((node) => {
                if (node.id === cid) {
                    return {
                        ...node,
                        metadata: {
                            ...node.metadata,
                            status: "success" as const,
                            content: `/api/resources/${cid}/file`,
                            storageKey: `resource:${cid}`,
                            generationEffectKeys: [effectKey],
                        },
                    };
                }
                return node;
            });

            const persisted = await persistCanvasGenerationEffect({
                projectId: project.id,
                effectKey,
                previousNodes,
                nodes: appliedNodes,
            });
            nodesRef = persisted.nodes;

            // 批次首图回填主图
            if (i === 0) {
                const updatedRoot = nodesRef.map((node) =>
                    node.id === variantId
                        ? {
                              ...node,
                              metadata: {
                                  ...node.metadata,
                                  content: `/api/resources/${cid}/file`,
                                  primaryImageId: cid,
                                  status: "success" as const,
                              },
                          }
                        : node,
                );
                useCanvasStore.getState().updateProject(project.id, { nodes: updatedRoot });
                nodesRef = updatedRoot;
            }
        }

        await flushCanvasStorePersistence();
        await useCanvasStore.persist.rehydrate();

        const currentProject = () => useCanvasStore.getState().projects.find((item) => item.id === project.id)!;
        const durableProject = () => parseCanvasStorageDocument(values.get(storageKey) ?? null).state.projects.find((item) => item.id === project.id)!;

        // 验证变体根与所有子节点全部稳定保留
        expect(currentProject().nodes.map((node) => node.id)).toEqual([source.id, variantId, ...childIds]);
        expect(durableProject().nodes.map((node) => node.id)).toEqual([source.id, variantId, ...childIds]);
    } finally {
        await flushCanvasStorePersistence();
        withCanvasStorePersistenceSuppressed(() => useCanvasStore.setState({ projects: previousState.projects, hydrated: previousState.hydrated }));
        localforage.getItem = originalGetItem;
        localforage.setItem = originalSetItem;
        if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
        else delete (globalThis as { window?: unknown }).window;
    }
});
