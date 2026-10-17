import { AudioSettingsPanel } from "@/components/audio-settings-panel";
import { audioFormatLabelForConfig, audioSpeedLabel, audioVoiceLabelForConfig } from "@/lib/audio-generation";
import { canvasThemes } from "@/lib/canvas-theme";
import { useActiveTheme } from "@/stores/canvas/use-canvas-theme-store";
import type { AiConfig } from "@/stores/use-config-store";
import { CanvasSettingsPopover, type CanvasSettingsPlacement } from "./canvas-settings-popover";

export type CanvasAudioSettingKey = "audioVoice" | "audioFormat" | "audioSpeed" | "audioLanguage" | "audioDialect" | "audioInstructions" | "audioEmotionControlMethod" | "audioEmotionRandom" | "audioEmotionHappy" | "audioEmotionAngry" | "audioEmotionSad" | "audioEmotionAfraid" | "audioEmotionDisgusted" | "audioEmotionMelancholic" | "audioEmotionSurprised" | "audioEmotionCalm";
type AudioPopoverProps = {
    config: AiConfig;
    onConfigChange: (key: CanvasAudioSettingKey, value: string) => void;
    buttonClassName?: string;
    placement?: CanvasSettingsPlacement;
    referenceAudios?: Array<{ id: string; title?: string; label?: string }>;
};

export function CanvasAudioSettingsPopover({ config, onConfigChange, referenceAudios = [], ...popover }: AudioPopoverProps) {
    const theme = canvasThemes[useActiveTheme()];
    const hasAudioRef = referenceAudios.length > 0;
    const voiceSummary = hasAudioRef
        ? (referenceAudios.length === 1 ? `参考音频 (${referenceAudios[0].title || referenceAudios[0].label || "音频"})` : `参考音频 (${referenceAudios.length}段)`)
        : (audioVoiceLabelForConfig(config, config.audioVoice) || "不指定音色");
    const parts = [voiceSummary, audioFormatLabelForConfig(config, config.audioFormat), audioSpeedLabel(config.audioSpeed)];
    return <CanvasSettingsPopover {...popover} label="音频设置" summary={parts.join(" · ")}>
        <AudioSettingsPanel config={config} onConfigChange={onConfigChange} theme={theme} referenceAudios={referenceAudios} className="space-y-4" />
    </CanvasSettingsPopover>;
}
