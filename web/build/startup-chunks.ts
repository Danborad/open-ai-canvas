import type { Plugin } from "vite";

/** Keep the startup dependency graph together without pulling in lazy routes. */
export function startupChunks(): Plugin {
    const startupModules = new Set<string>();
    const entryModules = new Set<string>();
    const isolatedModules = new Set<string>();
    const userLayoutModules = new Set<string>();
    const createModules = new Set<string>();
    const authModules = new Set<string>();
    return {
        name: "canvas-startup-chunks",
        apply: "build",
        buildEnd(error) {
            if (error) return;
            const visit = (id: string, target: Set<string>) => {
                if (target.has(id)) return;
                target.add(id);
                const info = this.getModuleInfo(id);
                for (const dependency of info?.importedIds || []) visit(dependency, target);
            };
            for (const id of this.getModuleIds()) {
                if (/[\\/]src[\\/]main\.tsx$/.test(id)) visit(id, entryModules);
                if (/[\\/]src[\\/]application\.tsx$/.test(id)) visit(id, startupModules);
                if (/[\\/]src[\\/]welcome-application\.tsx$/.test(id)) visit(id, isolatedModules);
                if (/[\\/]src[\\/](?:components[\\/]auth[\\/]auth-dialog\.tsx|pages[\\/]auth[\\/](?:login|register|forgot-password)\.tsx)$/.test(id)) visit(id, authModules);
                if (/[\\/]src[\\/]layouts[\\/]user-layout\.tsx$/.test(id)) visit(id, userLayoutModules);
                if (/[\\/]src[\\/]pages[\\/]create[\\/]index\.tsx$/.test(id)) visit(id, createModules);
            }
        },
        outputOptions(options) {
            const splitting = typeof options.codeSplitting === "object" ? options.codeSplitting : {};
            return {
                ...options,
                codeSplitting: {
                    ...splitting,
                    groups: [
                        ...(splitting.groups || []),
                        {
                            // 把 main.tsx 与 application.tsx 共享的启动外观小模块合并为单一分片，减少 head 里的 modulepreload 数量。
                            name: "boot-appearance",
                            test: (id) => entryModules.has(id) && !/[\\/]src[\\/](?:main|welcome-application)\.tsx$/.test(id) && !/[\\/]node_modules[\\/]/.test(id),
                            priority: 6,
                            minSize: 0,
                            includeDependenciesRecursively: false,
                        },
                        {
                            name: "app-bootstrap",
                            test: (id) => startupModules.has(id) && !entryModules.has(id),
                            // Dedicated framework groups remain authoritative.
                            priority: 5,
                            minSize: 0,
                            includeDependenciesRecursively: false,
                        },
                        {
                            // 把工作区外壳的零碎共享组件/工具收敛到单一分片，避免首页并发拉取几十个 1KB 小文件。
                            name: "user-layout-shell",
                            test: (id) => userLayoutModules.has(id) && !startupModules.has(id) && !entryModules.has(id) && !isolatedModules.has(id) && !/[\\/]node_modules[\\/]/.test(id),
                            priority: 4,
                            minSize: 0,
                            includeDependenciesRecursively: false,
                        },
                        {
                            // 把创作首页的零碎内部模块收敛到单一分片，不影响登录/欢迎页等独立入口。
                            name: "create-home",
                            test: (id) => createModules.has(id) && !userLayoutModules.has(id) && !startupModules.has(id) && !entryModules.has(id) && !isolatedModules.has(id) && !/[\\/]node_modules[\\/]/.test(id),
                            priority: 3,
                            minSize: 0,
                            includeDependenciesRecursively: false,
                        },
                        {
                            // 把登录弹窗与独立登录页的零碎模块收敛为单一 auth-ui 分片，降低打开登录时的请求次数。
                            name: "auth-ui",
                            test: (id) => authModules.has(id) && !createModules.has(id) && !userLayoutModules.has(id) && !startupModules.has(id) && !entryModules.has(id) && !isolatedModules.has(id) && !/[\\/]node_modules[\\/]/.test(id),
                            priority: 3,
                            minSize: 0,
                            includeDependenciesRecursively: false,
                        },
                    ],
                },
            };
        },
    };
}
