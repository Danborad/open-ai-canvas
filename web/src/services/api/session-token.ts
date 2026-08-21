import type { AxiosInstance } from "axios";

const SESSION_STORAGE_KEY = "open_ai_canvas_session_token";

export function readSessionToken() {
    try {
        const exp = Number(localStorage.getItem(`${SESSION_STORAGE_KEY}_exp`) || 0);
        if (exp > 0 && Date.now() > exp) {
            clearSessionToken();
            return "";
        }
        return localStorage.getItem(SESSION_STORAGE_KEY) || "";
    } catch {
        return "";
    }
}

export function writeSessionToken(token: string, maxAgeSecs?: number) {
    try {
        const value = String(token || "").trim();
        if (!value) {
            clearSessionToken();
            return;
        }
        localStorage.setItem(SESSION_STORAGE_KEY, value);
        if (typeof maxAgeSecs === "number" && maxAgeSecs > 0) {
            localStorage.setItem(`${SESSION_STORAGE_KEY}_exp`, String(Date.now() + maxAgeSecs * 1000));
        } else {
            localStorage.removeItem(`${SESSION_STORAGE_KEY}_exp`);
        }
    } catch {
        // ignore quota / private mode
    }
}

export function clearSessionToken() {
    try {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        localStorage.removeItem(`${SESSION_STORAGE_KEY}_exp`);
    } catch {
        // ignore
    }
}

export function attachSessionToken(api: AxiosInstance) {
    api.interceptors.request.use((config) => {
        const token = readSessionToken();
        if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
            config.headers["X-Canvas-Session"] = token;
        }
        return config;
    });
    return api;
}
