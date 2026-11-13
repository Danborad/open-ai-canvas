const RECOVERY_QUERY = "__chunk_recovery";
const RECOVERY_KEY = "canvas:chunk-recovery";
let recovering = false;
let recoveryUsed = false;

function hasRecoveryQuery() {
    if (typeof window === "undefined") return false;
    const search = window.location?.search;
    if (typeof search === "string") return new URLSearchParams(search).has(RECOVERY_QUERY);
    if (typeof URL !== "undefined" && typeof window.location?.href === "string") {
        return new URL(window.location.href).searchParams.has(RECOVERY_QUERY);
    }
    return false;
}

export function isChunkLoadError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
    return (
        message.includes("dynamically imported module") ||
        message.includes("Failed to fetch dynamically imported module") ||
        message.includes("Importing a module script failed") ||
        message.includes("error loading dynamically imported module") ||
        message.includes("Loading chunk")
    );
}

export function installChunkRecovery() {
    if (hasRecoveryQuery()) {
        recoveryUsed = true;
        try {
            sessionStorage.setItem(RECOVERY_KEY, "1");
        } catch {
            // 浏览器禁止 sessionStorage 时仍由内存标记 recoveryUsed 兜底防循环。
        }
    }
    window.addEventListener("vite:preloadError", handlePreloadError);
    window.addEventListener("unhandledrejection", (event) => {
        if (isChunkLoadError(event.reason)) {
            if (tryRecoverChunkFailure()) {
                event.preventDefault();
            }
        }
    });
}

export function markChunkRecoverySucceeded() {
    if (typeof window === "undefined" || typeof URL === "undefined" || !window.location?.href) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has(RECOVERY_QUERY)) return;
    recoveryUsed = true;
    try {
        sessionStorage.setItem(RECOVERY_KEY, "1");
    } catch {
        // Ignore storage errors; recoveryUsed stays true for this document lifetime.
    }
    url.searchParams.delete(RECOVERY_QUERY);
    // 启动已成功接管，把一次性防缓存参数从地址栏清理掉，恢复干净路径。
    window.history?.replaceState?.(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

/** Explicit user retry is allowed even after the automatic recovery was used. */
export function reloadAfterChunkFailure() {
    navigateToFreshEntry();
}

export function tryRecoverChunkFailure() {
    if (recovering) return true;
    if (recoveryUsed || hasRecoveryQuery()) {
        recoveryUsed = true;
        return false;
    }
    try {
        if (sessionStorage.getItem(RECOVERY_KEY) === "1") return false;
        sessionStorage.setItem(RECOVERY_KEY, "1");
    } catch {
        // The query marker survives the reload when session storage is denied.
    }
    recovering = true;
    recoveryUsed = true;
    navigateToFreshEntry();
    return true;
}

function navigateToFreshEntry() {
    const url = new URL(window.location.href);
    url.searchParams.set(RECOVERY_QUERY, String(Date.now()));
    window.location.replace(url.toString());
}

function handlePreloadError(event: Event) {
    // On the second failure let Vite throw to the route error boundary.
    if (tryRecoverChunkFailure()) event.preventDefault();
}
