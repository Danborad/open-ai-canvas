import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { Window } from "happy-dom";

test("entry failure has an inline retry exit, removed when the real application mounts", () => {
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)![1];
    const window = new Window();
    window.document.body.innerHTML = '<div id="root"></div>';
    let timeout: () => void = () => {};
    let mounted: () => void = () => {};
    let cleared = false;
    let disconnected = false;
    runInNewContext(code, {
        document: window.document,
        performance,
        setTimeout: (callback: () => void, delay: number) => {
            expect(delay).toBe(20000);
            timeout = callback;
        },
        clearTimeout: () => {
            cleared = true;
        },
        MutationObserver: class {
            constructor(callback: () => void) {
                mounted = callback;
            }
            observe() {}
            disconnect() {
                disconnected = true;
            }
        },
    });
    timeout();
    expect(window.document.querySelector('[role="alert"]')?.textContent).toContain("不会清除浏览器中的画布缓存");
    expect(window.document.querySelector("button")?.textContent).toBe("重新加载");
    window.document.getElementById("root")!.appendChild(window.document.createElement("main"));
    mounted();
    expect(window.document.getElementById("boot-recovery")).toBeNull();
    expect(cleared && disconnected).toBe(true);
});
