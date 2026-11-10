import { describe, expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import { startupChunks } from "../build/startup-chunks";
import { resilientPreload } from "../build/resilient-preload";

async function loader(fetchResource: (url: string) => Promise<unknown>) {
    const build = await Bun.build({ entrypoints: [new URL("../src/lib/module-preload.ts", import.meta.url).pathname], format: "iife", target: "browser" });
    expect(build.success).toBe(true);
    const code = (await build.outputs[0].text()).replace(/\}\)\(\);\s*$/, "globalThis.warm = warmPreloadResources;})();");
    const context = { fetch: fetchResource, AbortSignal, setTimeout: (callback: () => void) => callback(), warm: undefined as unknown as (urls: string[]) => Promise<void> };
    runInNewContext(code, context);
    return context.warm;
}

function response(status = 200, type = "application/javascript") {
    return new Response(status === 200 ? "export default 1" : "", { status, headers: { "Content-Type": type } });
}

describe("bounded module preloading", () => {
    test("retries transient 521 responses before native import", async () => {
        let calls = 0;
        const warm = await loader(async () => response(++calls === 1 ? 521 : 200));
        await warm(["https://example.test/assets/page.js"]);
        expect(calls).toBe(2);
    });

    test("stops after three failures and does not retry missing files or HTML challenges", async () => {
        for (const [status, type, expected] of [
            [521, "application/javascript", 3],
            [404, "text/html", 1],
            [200, "text/html", 1],
        ] as const) {
            let calls = 0;
            const warm = await loader(async () => {
                calls += 1;
                return response(status, type);
            });
            await expect(warm(["https://example.test/assets/page.js"])).rejects.toThrow();
            expect(calls).toBe(expected);
        }
    });

    test("deduplicates consumers and limits active resource downloads to four", async () => {
        const releases: Array<() => void> = [];
        const started: string[] = [];
        const warm = await loader(
            (url) =>
                new Promise((resolve) => {
                    started.push(url);
                    releases.push(() => resolve(response()));
                }),
        );
        const urls = Array.from({ length: 8 }, (_, index) => `https://example.test/assets/${index}.js`);
        const first = warm(urls);
        const duplicate = warm(urls);
        expect(started.length).toBe(4);
        for (let batch = 0; batch < 2; batch += 1) {
            releases.splice(0).forEach((release) => release());
            for (let turn = 0; turn < 20; turn += 1) await Promise.resolve();
        }
        await Promise.all([first, duplicate]);
        expect(started).toEqual(urls);
    });
});

test("startup grouping excludes entry dependencies and lazy pages", () => {
    const plugin = startupChunks();
    const modules = new Map([
        ["/src/main.tsx", { importedIds: ["/entry-shared.js"] }],
        ["/entry-shared.js", { importedIds: [] }],
        ["/src/application.tsx", { importedIds: ["/entry-shared.js", "/startup.js"], dynamicallyImportedIds: ["/page.js"] }],
        ["/startup.js", { importedIds: [] }],
        ["/page.js", { importedIds: [] }],
    ]);
    (plugin.buildEnd as Function).call({ getModuleIds: () => modules.keys(), getModuleInfo: (id: string) => modules.get(id) });
    const output = (plugin.outputOptions as Function)({ codeSplitting: { groups: [{ name: "vendor", priority: 30 }] } });
    const group = output.codeSplitting.groups[1];
    expect(group.test("/startup.js")).toBe(true);
    expect(group.test("/entry-shared.js")).toBe(false);
    expect(group.test("/page.js")).toBe(false);
});

test("preload adapter rejects unexpected Vite helpers instead of silently disabling protection", () => {
    const transform = resilientPreload().transform as Function;
    expect(() => transform("changed helper", "\0vite/preload-helper.js")).toThrow("Vite preload helper changed");
    expect(transform("function preload(baseModule, deps, importerUrl) {}", "\0vite/preload-helper.js").code).toContain("await warmPreloadResources");
});
