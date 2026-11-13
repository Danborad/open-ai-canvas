import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { Window } from "happy-dom";

describe("index.html boot recovery", () => {
    test("has boot recovery timeout handler in index.html", () => {
        const html = readFileSync(resolve(import.meta.dir, "../index.html"), "utf8");
        expect(html).toContain("boot-recovery");
        expect(html).toContain("MutationObserver");
    });

    test("执行真实启动脚本：超时提供重试，React 延迟挂载后移除提示", async () => {
        const html = readFileSync(resolve(import.meta.dir, "../index.html"), "utf8");
        const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]).find((source) => source.includes("bootTimer"))!;
        const dom = new Window({ url: "https://canvas.example/canvas?mode=recent" });
        dom.document.body.innerHTML = '<div id="root"></div>';
        let timer: (() => void) | undefined;
        let destination = "";
        try {
            runInNewContext(script, {
                document: dom.document,
                performance,
                URL,
                MutationObserver: dom.MutationObserver,
                setTimeout: (callback: () => void) => {
                    timer = callback;
                    return 1;
                },
                clearTimeout: () => {
                    timer = undefined;
                },
                location: {
                    href: dom.location.href,
                    replace: (url: string) => {
                        destination = url;
                    },
                },
            });
            timer!();
            const notice = dom.document.getElementById("boot-recovery")!;
            expect(notice.getAttribute("role")).toBe("alert");
            const button = notice.querySelector("button")!;
            expect(button.style.background).toBe("transparent");
            button.click();
            expect(new URL(destination).searchParams.get("mode")).toBe("recent");
            expect(new URL(destination).searchParams.has("__chunk_recovery")).toBe(true);
            dom.document.getElementById("root")!.appendChild(dom.document.createElement("main"));
            await dom.happyDOM.whenAsyncComplete();
            expect(dom.document.getElementById("boot-recovery")).toBeNull();
            expect(timer).toBeUndefined();
        } finally {
            await dom.happyDOM.abort();
        }
    });

    test("markChunkRecoverySucceeded 会清理地址栏 __chunk_recovery 且保留同标签页防循环标记", async () => {
        const dom = new Window({ url: "https://canvas.example/?__chunk_recovery=1794578651346" });
        const originalWindow = globalThis.window;
        const originalSessionStorage = globalThis.sessionStorage;
        try {
            Object.assign(globalThis, { window: dom.window, sessionStorage: dom.sessionStorage });
            const { installChunkRecovery, markChunkRecoverySucceeded, tryRecoverChunkFailure } = await import(`../src/lib/chunk-recovery?case=${Date.now()}`);
            installChunkRecovery();
            markChunkRecoverySucceeded();
            expect(dom.location.search).toBe("");
            expect(dom.location.href).toBe("https://canvas.example/");
            expect(tryRecoverChunkFailure()).toBe(false);
        } finally {
            Object.assign(globalThis, { window: originalWindow, sessionStorage: originalSessionStorage });
            await dom.happyDOM.abort();
        }
    });
});
