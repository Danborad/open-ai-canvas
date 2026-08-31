import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { scopedLocalStorage } from "@/lib/user-scope";

export const CANVAS_PRIVACY_STORE_KEY = "infinite-canvas:privacy-store";

type CanvasPrivacyStore = {
    blurredProjectIds: string[];
    isProjectBlurred: (projectId: string) => boolean;
    toggleProjectBlur: (projectId: string) => void;
    setProjectBlur: (projectId: string, blurred: boolean) => void;
};

export const useCanvasPrivacyStore = create<CanvasPrivacyStore>()(
    persist(
        (set, get) => ({
            blurredProjectIds: [],
            isProjectBlurred: (projectId: string) => get().blurredProjectIds.includes(projectId),
            toggleProjectBlur: (projectId: string) =>
                set((state) => {
                    const exists = state.blurredProjectIds.includes(projectId);
                    return {
                        blurredProjectIds: exists
                            ? state.blurredProjectIds.filter((id) => id !== projectId)
                            : [...state.blurredProjectIds, projectId],
                    };
                }),
            setProjectBlur: (projectId: string, blurred: boolean) =>
                set((state) => ({
                    blurredProjectIds: blurred
                        ? Array.from(new Set([...state.blurredProjectIds, projectId]))
                        : state.blurredProjectIds.filter((id) => id !== projectId),
                })),
        }),
        {
            name: CANVAS_PRIVACY_STORE_KEY,
            storage: createJSONStorage(() => scopedLocalStorage),
        },
    ),
);
