import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { scopedLocalStorage } from "@/lib/user-scope";
import type { PluginInstallation, PluginManifest } from "@/lib/plugins/plugin-types";

export const PLUGIN_STORE_KEY = "infinite-canvas:plugin-store";

type PluginStore = {
    hydrated: boolean;
    installations: PluginInstallation[];
    ensurePlugin: (manifest: PluginManifest) => void;
    setEnabled: (pluginId: string, enabled: boolean) => void;
    updateConfig: (pluginId: string, config: Record<string, string | number | boolean>) => void;
    setError: (pluginId: string, error?: string) => void;
    removePlugin: (pluginId: string) => void;
};

function now() {
    return new Date().toISOString();
}

export const usePluginStore = create<PluginStore>()(
    persist(
        (set) => ({
            hydrated: false,
            installations: [],
            ensurePlugin: (manifest) =>
                set((state) => {
                    const current = state.installations.find((item) => item.manifest.id === manifest.id);
                    const timestamp = now();
                    if (current) {
                        if (current.manifest.version === manifest.version && current.manifest.name === manifest.name) {
                            return state;
                        }
                        return {
                            hydrated: true,
                            installations: state.installations.map((item) =>
                                item.manifest.id === manifest.id
                                    ? { ...item, manifest, updatedAt: timestamp }
                                    : item
                            ),
                        };
                    }
                    const next: PluginInstallation = {
                        manifest,
                        enabled: false,
                        config: {},
                        installedAt: timestamp,
                        updatedAt: timestamp,
                    };
                    return {
                        hydrated: true,
                        installations: [...state.installations, next],
                    };
                }),
            setEnabled: (pluginId, enabled) =>
                set((state) => ({
                    installations: state.installations.map((item) =>
                        item.manifest.id === pluginId
                            ? { ...item, enabled, updatedAt: now(), lastError: undefined }
                            : item
                    ),
                })),
            updateConfig: (pluginId, config) =>
                set((state) => ({
                    installations: state.installations.map((item) =>
                        item.manifest.id === pluginId
                            ? { ...item, config: { ...item.config, ...config }, updatedAt: now() }
                            : item
                    ),
                })),
            setError: (pluginId, error) =>
                set((state) => ({
                    installations: state.installations.map((item) =>
                        item.manifest.id === pluginId
                            ? { ...item, lastError: error, updatedAt: now() }
                            : item
                    ),
                })),
            removePlugin: (pluginId) =>
                set((state) => ({
                    installations: state.installations.filter((item) => item.manifest.id !== pluginId),
                })),
        }),
        {
            name: PLUGIN_STORE_KEY,
            storage: createJSONStorage(() => scopedLocalStorage),
            partialize: (state) => ({ installations: state.installations }),
            merge: (persisted, current) => {
                const stored = (persisted || {}) as Partial<PluginStore>;
                const storedInstallations = Array.isArray(stored.installations) ? stored.installations : [];
                return {
                    ...current,
                    hydrated: true,
                    installations: storedInstallations,
                };
            },
            onRehydrateStorage: () => (state) => {
                if (state) state.hydrated = true;
            },
        },
    ),
);
