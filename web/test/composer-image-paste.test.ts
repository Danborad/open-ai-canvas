import { describe, expect, test } from "bun:test";
import { COMPOSER_IMAGE_PASTE_PLUGIN_ID, composerImagePastePlugin } from "../src/lib/plugins/builtin/composer-image-paste";
import { extractImageFilesFromClipboardData } from "../src/components/canvas/canvas-resource-mention-textarea";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("composer image paste plugin", () => {
    test("registers official application plugin with correct metadata", () => {
        expect(composerImagePastePlugin.manifest.id).toBe(COMPOSER_IMAGE_PASTE_PLUGIN_ID);
        expect(composerImagePastePlugin.manifest.name).toBe("创作框图片粘贴");
        expect(composerImagePastePlugin.manifest.surfaces).toContain("hybrid");
    });

    test("plugin is registered in official backend policy and frontend registry", () => {
        const backendPolicy = readFileSync(resolve(import.meta.dir, "../../backend/internal/app/plugin_management.go"), "utf8");
        expect(backendPolicy).toContain('PluginComposerImagePaste   = "composer-image-paste"');
        expect(backendPolicy).toContain('PluginComposerImagePaste: {');

        const builtinIndex = readFileSync(resolve(import.meta.dir, "../src/lib/plugins/builtin/index.ts"), "utf8");
        expect(builtinIndex).toContain('import "./composer-image-paste";');

        const officialApps = readFileSync(resolve(import.meta.dir, "../src/lib/plugins/official-applications.ts"), "utf8");
        expect(officialApps).toContain('"composer-image-paste"');
    });

    test("extractImageFilesFromClipboardData parses images from dataTransfer", () => {
        expect(extractImageFilesFromClipboardData(null)).toEqual([]);

        const textItem = { kind: "string", type: "text/plain", getAsFile: () => null } as unknown as DataTransferItem;
        const fakeFile = new File(["dummy"], "test.png", { type: "image/png" });
        const imageItem = { kind: "file", type: "image/png", getAsFile: () => fakeFile } as unknown as DataTransferItem;

        const fakeDataTransfer = {
            items: [textItem, imageItem],
            files: [fakeFile],
        } as unknown as DataTransfer;

        const extracted = extractImageFilesFromClipboardData(fakeDataTransfer);
        expect(extracted.length).toBe(1);
        expect(extracted[0].name).toBe("test.png");
        expect(extracted[0].type).toBe("image/png");
    });

    test("creation composer integrates paste capture and delegates to onAddFiles", () => {
        const composerSource = readFileSync(resolve(import.meta.dir, "../src/pages/create/creation-workspace.tsx"), "utf8");
        expect(composerSource).toContain("useComposerImagePasteEnabled");
        expect(composerSource).toContain("handleComposerPasteCapture");
        expect(composerSource).toContain("onPasteFiles={composerPastePluginEnabled ? props.onAddFiles : undefined}");
    });
});
