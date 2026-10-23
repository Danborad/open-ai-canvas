import { nanoid } from "nanoid";

// randomUUID 在 HTTP 内网地址（非安全上下文）下不可用；提供环境兼容垫片
if (typeof crypto !== "undefined" && typeof crypto.randomUUID !== "function") {
    try {
        Object.defineProperty(crypto, "randomUUID", {
            value: function randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
                if (typeof crypto.getRandomValues === "function") {
                    const bytes = new Uint8Array(16);
                    crypto.getRandomValues(bytes);
                    bytes[6] = (bytes[6] & 0x0f) | 0x40;
                    bytes[8] = (bytes[8] & 0x3f) | 0x80;
                    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
                    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as `${string}-${string}-${string}-${string}-${string}`;
                }
                const raw = nanoid(32);
                return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-8${raw.slice(17, 20)}-${raw.slice(20)}` as `${string}-${string}-${string}-${string}-${string}`;
            },
            configurable: true,
            writable: true,
        });
    } catch {
        // ignore if not configurable
    }
}

export function createClientId() {
    // randomUUID 在 HTTP 内网地址下不可用；nanoid 依赖仍可用的 getRandomValues。
    return nanoid();
}

/**
 * RFC 4122 v4 UUID。`crypto.randomUUID` 只在安全上下文（HTTPS / localhost）暴露，
 * 局域网 IP 走 HTTP 时不存在；`getRandomValues` 不受此限制，用它按同一格式生成。
 */
export function createClientUUID(): string {
    const cryptoApi = globalThis.crypto;
    if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10xx
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
