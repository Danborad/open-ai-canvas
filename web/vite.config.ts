import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const webDir = dirname(fileURLToPath(import.meta.url));
const appVersion = readFileSync(resolve(webDir, "../VERSION"), "utf8").trim();
const appChangelog = readFileSync(resolve(webDir, "../CHANGELOG.md"), "utf8");
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET?.trim() || "http://127.0.0.1:8080";
const buildNonce = process.env.CANVAS_WEB_BUILD_NONCE || appVersion;

export default defineConfig({
    plugins: [react()],
    define: {
        __APP_VERSION__: JSON.stringify(appVersion),
        __APP_CHANGELOG__: JSON.stringify(appChangelog),
    },
    server: {
        proxy: {
            "/api": {
                target: apiProxyTarget,
                changeOrigin: true,
                xfwd: true,
            },
            "/oauth/linuxdo/callback": {
                target: apiProxyTarget,
                changeOrigin: true,
                xfwd: true,
            },
        },
    },
    resolve: {
        alias: {
            "@": resolve(webDir, "src"),
        },
    },
    build: {
        rollupOptions: {
            output: {
                entryFileNames: `assets/[name]-${buildNonce}-[hash].js`,
                chunkFileNames: `assets/[name]-${buildNonce}-[hash].js`,
                assetFileNames: `assets/[name]-${buildNonce}-[hash][extname]`,
            },
        },
    },
});
