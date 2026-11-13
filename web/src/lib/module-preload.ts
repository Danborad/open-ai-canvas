const MAX_ACTIVE_PRELOADS = 4;
const PRELOAD_TIMEOUT_MS = 8_000;
const requests = new Map<string, Promise<void>>();
// 同一页面生命周期内已成功预热的内容寻址资源无需重复 fetch，避免嵌套懒加载把共享分片放大 4-5 倍。
const completed = new Set<string>();
const queue: Array<() => void> = [];
let active = 0;

/** Fetch before native import: failed module-map entries cannot be retried by importing the same URL. */
export async function warmPreloadResources(urls: string[]) {
    await Promise.all(
        urls.map((url) => {
            if (completed.has(url)) return Promise.resolve();
            let request = requests.get(url);
            if (!request) {
                request = scheduled(() => fetchResource(url))
                    .then(() => {
                        completed.add(url);
                    })
                    .finally(() => {
                        if (requests.get(url) === request) requests.delete(url);
                    });
                requests.set(url, request);
            }
            return request;
        }),
    );
}

function scheduled(task: () => Promise<void>) {
    return new Promise<void>((resolve, reject) => {
        queue.push(() => {
            active += 1;
            void task()
                .then(resolve, reject)
                .finally(() => {
                    active -= 1;
                    drain();
                });
        });
        drain();
    });
}

function drain() {
    while (active < MAX_ACTIVE_PRELOADS && queue.length) queue.shift()?.();
}

async function fetchResource(url: string) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        let retryable = true;
        const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
        const timer = controller ? setTimeout(() => controller.abort(), PRELOAD_TIMEOUT_MS) : undefined;
        try {
            const response = await fetch(url, { credentials: "same-origin", ...(controller ? { signal: controller.signal } : {}) });
            if (!response.ok) {
                retryable = response.status >= 500 || response.status === 408 || response.status === 429;
                await response.body?.cancel();
                throw new Error(`页面资源读取失败（${response.status}）`);
            }
            const type = response.headers.get("Content-Type") || "";
            if (!/(?:javascript|ecmascript|text\/css)/i.test(type)) {
                retryable = false;
                await response.body?.cancel();
                throw new Error("页面资源返回了非脚本或样式内容");
            }
            // Complete the body so the subsequent module/link load can reuse the immutable HTTP cache.
            await response.arrayBuffer();
            return;
        } catch (error) {
            if (!retryable || attempt === 4) throw error;
            await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        } finally {
            if (timer !== undefined) clearTimeout(timer);
        }
    }
}
