import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AgentModelPreferences = {
    auto: boolean;
    imageModel: string;
    videoModel: string;
    setAuto: (auto: boolean) => void;
    setImageModel: (model: string) => void;
    setVideoModel: (model: string) => void;
};

export const useAgentModelPreferencesStore = create<AgentModelPreferences>()(
    persist(
        (set) => ({
            auto: true,
            imageModel: "",
            videoModel: "",
            setAuto: (auto) => set({ auto }),
            setImageModel: (imageModel) => set({ imageModel }),
            setVideoModel: (videoModel) => set({ videoModel }),
        }),
        {
            name: "yingce:agent_model_preferences",
        },
    ),
);
