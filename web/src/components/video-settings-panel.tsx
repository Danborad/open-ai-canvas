import { type ReactNode } from "react";
import { Switch } from "antd";

import { ImageSettingsTheme } from "@/components/image-settings-panel";
import { boolConfig, isSeedanceFastModel, isSeedanceVideoConfig, normalizeSeedanceDuration, normalizeSeedanceRatio, normalizeSeedanceResolution, seedanceRatioOptions } from "@/lib/seedance-video";
import { type CanvasTheme } from "@/lib/canvas-theme";
import { isVideoResolutionMatch, normalizeVideoDuration, normalizeVideoResolution, VIDEO_DURATION_MIN } from "@/lib/video-generation-options";
import { modelCapabilityConfigFor, videoDurationOptions, type VideoCapabilityConfig } from "@/lib/model-capabilities";
import { modelOptionName, resolveModelChannel, resolveModelRequestConfig, type AiConfig } from "@/stores/use-config-store";

const sizeOptions = [
    { value: "1280x720", label: "横屏", width: 1280, height: 720 },
    { value: "720x1280", label: "竖屏", width: 720, height: 1280 },
    { value: "1024x1024", label: "方形", width: 1024, height: 1024 },
    { value: "1792x1024", label: "宽屏", width: 1792, height: 1024 },
    { value: "1024x1792", label: "长图", width: 1024, height: 1792 },
    { value: "auto", label: "auto", width: 0, height: 0 },
];

type VideoSettingsPanelProps = {
    config: AiConfig;
    onConfigChange: (key: "vquality" | "size" | "videoSeconds" | "videoGenerateAudio" | "videoWatermark" | "videoArkPrivateAssetUpload", value: string) => void;
    theme: CanvasTheme;
    showTitle?: boolean;
    className?: string;
};

export function VideoSettingsPanel({ config, onConfigChange, theme, showTitle = true, className = "w-[292px] space-y-3" }: VideoSettingsPanelProps) {
    const targetModel = config.model || config.videoModel;
    const profile = modelCapabilityConfigFor(config, targetModel).video!;
    const priceTiers = modelPriceTiers(config, targetModel);
    const reqConfig = resolveModelRequestConfig(config, targetModel);
    const interfaceType = reqConfig.interfaceType;
    const modelName = modelOptionName(targetModel).toLowerCase();

    if (interfaceType === "flow2api-video") {
        return <Flow2APIVideoSettingsPanel config={config} profile={profile} priceTiers={priceTiers} onConfigChange={onConfigChange} theme={theme} showTitle={showTitle} className={className} />;
    }
    if (interfaceType === "autodl-comfyui" || interfaceType === "autodl-comfyui-video") {
        return <AutoDLVideoSettingsPanel config={config} profile={profile} priceTiers={priceTiers} onConfigChange={onConfigChange} theme={theme} showTitle={showTitle} className={className} />;
    }
    if (interfaceType === "grok2api-video" || interfaceType === "grok2api-new-video" || interfaceType === "xai-video" || modelName.includes("grok-imagine-video")) {
        return <Grok2APIVideoSettingsPanel config={config} profile={profile} priceTiers={priceTiers} onConfigChange={onConfigChange} theme={theme} showTitle={showTitle} className={className} />;
    }
    if (interfaceType === "volcengine-jimeng-video") {
		return <JiMengVideoSettingsPanel config={config} profile={profile} priceTiers={priceTiers} onConfigChange={onConfigChange} theme={theme} showTitle={showTitle} className={className} />;
    }
    if (isSeedanceVideoConfig(config)) {
		return <SeedanceVideoSettingsPanel config={config} profile={profile} priceTiers={priceTiers} onConfigChange={onConfigChange} theme={theme} showTitle={showTitle} className={className} />;
    }

    const seconds = normalizeVideoDuration(config.videoSeconds);
    const size = normalizeVideoSizeValue(config.size);
    const dimensions = readSizeDimensions(size);
    const resolution = config.vquality || profile.defaultResolution || "";
    const configuredResolutions = profile.resolutions.map((value) => ({ value, label: value.toUpperCase() }));
    const generateAudio = boolConfig(config.videoGenerateAudio, profile.generateAudio.default);
    const watermark = boolConfig(config.videoWatermark, profile.watermark.default);
    const updateDimension = (key: "width" | "height", value: number | null) => {
        const next = Math.max(1, Math.floor(value || dimensions[key] || 720));
        onConfigChange("size", `${key === "width" ? next : dimensions.width}x${key === "height" ? next : dimensions.height}`);
    };

    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-sm font-semibold">视频设置</div> : null}
                {configuredResolutions.length ? <SettingGroup title="分辨率" color={theme.node.muted}>
                    <div className="grid grid-cols-3 gap-1.5">
                        {configuredResolutions.map((item) => (
							<OptionPill key={item.value} selected={isVideoResolutionMatch(resolution, item.value)} disabled={!hasPriceTierForVideoSelection(priceTiers, item.value, Number(seconds))} theme={theme} onClick={() => onConfigChange("vquality", item.value)}>
                                {item.label}
                            </OptionPill>
                        ))}
                    </div>
                </SettingGroup> : null}
                <SettingGroup title="尺寸" color={theme.node.muted}>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                        <DimensionInput prefix="W" value={dimensions.width} disabled={size === "auto"} theme={theme} onChange={(value) => updateDimension("width", value)} />
                        <span className="text-xs opacity-45">×</span>
                        <DimensionInput prefix="H" value={dimensions.height} disabled={size === "auto"} theme={theme} onChange={(value) => updateDimension("height", value)} />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                        {profile.ratios.map((value) => (
                            <RatioOption
                                key={value}
                                value={value}
                                selected={normalizeRatioValue(config.size) === value}
                                theme={theme}
                                onClick={() => onConfigChange("size", value)}
                            />
                        ))}
                    </div>
                </SettingGroup>
                <SettingGroup title="秒数" color={theme.node.muted}>
					<VideoDurationControl profile={profile} value={Number(seconds)} theme={theme} disabled={(value) => !hasPriceTierForVideoSelection(priceTiers, resolution, value)} onChange={(value) => onConfigChange("videoSeconds", String(value))} />
                </SettingGroup>
                {profile.generateAudio.supported || profile.watermark.supported ? <SettingGroup title="输出" color={theme.node.muted}><div className="grid grid-cols-2 gap-3 rounded-md px-2" style={{ background: theme.toolbar.itemHover }}>{profile.generateAudio.supported ? <SwitchRow label="生成声音" checked={generateAudio} theme={theme} onChange={(checked) => onConfigChange("videoGenerateAudio", String(checked))} /> : null}{profile.watermark.supported ? <SwitchRow label="添加水印" checked={watermark} theme={theme} onChange={(checked) => onConfigChange("videoWatermark", String(checked))} /> : null}</div></SettingGroup> : null}
            </div>
        </ImageSettingsTheme>
    );
}

function JiMengVideoSettingsPanel({ config, profile, priceTiers, onConfigChange, theme, showTitle, className }: VideoSettingsPanelProps & { profile: VideoCapabilityConfig; priceTiers: ReturnType<typeof modelPriceTiers> }) {
    const seconds = normalizeVideoDuration(config.videoSeconds);
    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-sm font-semibold">视频设置</div> : null}
                <SettingGroup title="比例" color={theme.node.muted}>
                    <div className="grid grid-cols-3 gap-1.5">
                        {profile.ratios.map((value) => <RatioOption key={value} value={value} selected={config.size === value} theme={theme} onClick={() => onConfigChange("size", value)} />)}
                    </div>
                </SettingGroup>
                <SettingGroup title="秒数" color={theme.node.muted}>
					<VideoDurationControl profile={profile} value={Number(seconds)} theme={theme} disabled={(value) => !hasPriceTierForVideoSelection(priceTiers, "*", value)} onChange={(value) => onConfigChange("videoSeconds", String(value))} />
                </SettingGroup>
            </div>
        </ImageSettingsTheme>
    );
}

function SeedanceVideoSettingsPanel({ config, profile, priceTiers, onConfigChange, theme, showTitle, className }: VideoSettingsPanelProps & { profile: VideoCapabilityConfig; priceTiers: ReturnType<typeof modelPriceTiers> }) {
    const model = modelOptionName(config.model || config.videoModel);
    const resolution = normalizeSeedanceResolution(config.vquality, model);
    const ratio = normalizeSeedanceRatio(config.size);
    const duration = normalizeSeedanceDuration(config.videoSeconds);
    const generateAudio = boolConfig(config.videoGenerateAudio, profile.generateAudio.default);
    const watermark = boolConfig(config.videoWatermark, profile.watermark.default);
    const useArkPrivateAssets = boolConfig(config.videoArkPrivateAssetUpload, true);
    const isArkSeedance = resolveModelRequestConfig(config, config.model).interfaceType === "volcengine-ark-video";

    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-sm font-semibold">视频设置</div> : null}
                <SettingGroup title="分辨率" color={theme.node.muted}>
                    <div className="grid grid-cols-3 gap-1.5">
                        {profile.resolutions.map((value) => {
                            const item = { value, label: value.toUpperCase() };
							const disabled = (item.value === "1080p" && isSeedanceFastModel(model)) || !hasPriceTierForVideoSelection(priceTiers, item.value, duration);
                            return (
                                <OptionPill key={item.value} selected={resolution === item.value} disabled={disabled} theme={theme} onClick={() => onConfigChange("vquality", item.value)}>
                                    {item.label}
                                </OptionPill>
                            );
                        })}
                    </div>
                    {isSeedanceFastModel(model) ? <div className="text-[var(--fs-tiny)] leading-4 opacity-55">fast 模型自动使用 720P</div> : null}
                </SettingGroup>
                <SettingGroup title="比例" color={theme.node.muted}>
                    <div className="grid grid-cols-4 gap-1.5">
                        {profile.ratios.map((value) => {
                            const item = { value, label: value };
                            return (
                            <button
                                key={item.value}
                                type="button"
                                className="flex h-11 min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[var(--fs-tiny)] font-medium leading-none transition-colors hover:brightness-110 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1"
                                style={{ background: ratio === item.value ? theme.toolbar.activeBg : "transparent", color: theme.node.text, outlineColor: theme.node.muted }}
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={() => onConfigChange("size", item.value)}
                            >
                                <span className="grid h-4 place-items-center">
                                    <SizePreview width={ratioPreview(item.value).width} height={ratioPreview(item.value).height} color={theme.node.text} />
                                </span>
                                <span className="whitespace-nowrap">{item.label}</span>
                            </button>
                            );
                        })}
                    </div>
                </SettingGroup>
                <SettingGroup title="时长" color={theme.node.muted}>
					<VideoDurationControl profile={profile} value={duration} theme={theme} disabled={(value) => !hasPriceTierForVideoSelection(priceTiers, resolution, value)} onChange={(value) => onConfigChange("videoSeconds", String(value))} />
                </SettingGroup>
                <SettingGroup title="输出" color={theme.node.muted}>
                    <div className="grid grid-cols-2 gap-3 rounded-md px-2" style={{ background: theme.toolbar.itemHover }}>
                        {profile.generateAudio.supported ? <SwitchRow label="生成声音" checked={generateAudio} theme={theme} onChange={(checked) => onConfigChange("videoGenerateAudio", String(checked))} /> : null}
                        {profile.watermark.supported ? <SwitchRow label="添加水印" checked={watermark} theme={theme} onChange={(checked) => onConfigChange("videoWatermark", String(checked))} /> : null}
                    </div>
                </SettingGroup>
                {isArkSeedance ? (
                    <SettingGroup title="参考图" color={theme.node.muted}>
                        <div className="rounded-md px-2" style={{ background: theme.toolbar.itemHover }}>
                            <SwitchRow label="自动同步可信素材（确认拥有使用权）" checked={useArkPrivateAssets} theme={theme} onChange={(checked) => onConfigChange("videoArkPrivateAssetUpload", String(checked))} />
                        </div>
                    </SettingGroup>
                ) : null}
            </div>
        </ImageSettingsTheme>
    );
}

export function videoResolutionLabel(value: string) {
    const raw = String(value || "").trim();
    if (!raw) return "默认";
    if (raw.toLowerCase() === "2k" || raw === "1440") return "2K";
    if (raw.toLowerCase() === "4k" || raw === "2160") return "4K";
    if (raw.toLowerCase() === "768p" || raw === "768") return "768P";
    if (raw.toLowerCase() === "1080p" || raw === "1080") return "1080P";
    if (raw.toLowerCase() === "720p" || raw === "720") return "720P";
    if (raw.toLowerCase() === "480p" || raw === "480") return "480P";
    if (/^\d+$/i.test(raw)) return `${raw}P`;
    return raw.toUpperCase();
}

export function videoSizeLabel(value: string) {
    const ratio = normalizeSeedanceRatio(value);
    if (value === "adaptive" || value === "auto") return "自适应";
    // The compact summary must mirror the selected value (for example 16:9),
    // while the settings panel can still use semantic labels such as 横屏.
    if (ratio === value) return ratio;
    const size = normalizeVideoSizeValue(value);
    return sizeOptions.find((item) => item.value === size)?.label || size;
}

export function videoSecondsLabel(value: string) {
    return `${normalizeVideoDuration(value)}s`;
}

export function normalizeVideoSizeValue(value: string) {
    if (value === "auto") return "auto";
    if (/^\d+x\d+$/.test(value || "")) return value;
    return ["9:16", "2:3", "3:4"].includes(value) ? "720x1280" : "1280x720";
}

export function normalizeVideoResolutionValue(value: string) {
    return normalizeVideoResolution(value);
}

function OptionPill({ selected, disabled = false, theme, onClick, children }: { selected: boolean; disabled?: boolean; theme: CanvasTheme; onClick: () => void; children: ReactNode }) {
    return (
        <button type="button" disabled={disabled} className="h-8 cursor-pointer whitespace-nowrap rounded-md px-1 text-[var(--fs-label)] font-medium leading-none transition-colors hover:brightness-110 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-35" style={{ background: selected ? theme.toolbar.activeBg : "transparent", color: theme.node.text, outlineColor: theme.node.muted }} onMouseDown={(event) => event.stopPropagation()} onClick={onClick}>
            {children}
        </button>
    );
}

function SettingGroup({ title, color, children }: { title: string; color: string; children: ReactNode }) {
    return (
        <div className="space-y-1.5">
            <div className="text-[var(--fs-tiny)] font-semibold" style={{ color }}>
                {title}
            </div>
            {children}
        </div>
    );
}

function DimensionInput({ prefix, value, disabled, theme, onChange }: { prefix: string; value: number; disabled: boolean; theme: CanvasTheme; onChange: (value: number | null) => void }) {
    return (
        <label className="flex h-8 overflow-hidden rounded-md text-[var(--fs-label)]" style={{ background: theme.toolbar.itemHover, color: theme.node.text, opacity: disabled ? 0.55 : 1 }}>
            <span className="grid w-7 place-items-center" style={{ color: theme.node.muted }}>
                {prefix}
            </span>
            <input type="number" min={1} disabled={disabled} className="min-w-0 flex-1 bg-transparent px-2 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" value={value || ""} onChange={(event) => onChange(Number(event.target.value) || null)} onMouseDown={(event) => event.stopPropagation()} />
        </label>
    );
}

function DurationInput({ value, min, max, theme, onChange }: { value: number; min: number; max?: number; theme: CanvasTheme; onChange: (value: number) => void }) {
    const commit = (input: HTMLInputElement) => {
        const next = Math.min(max || Number.POSITIVE_INFINITY, Math.max(min, Math.floor(Number(input.value) || value || min)));
        input.value = String(next);
        onChange(next);
    };

    return (
        <label className="flex h-8 w-20 shrink-0 items-center overflow-hidden rounded-md border text-[var(--fs-label)]" style={{ background: theme.toolbar.itemHover, borderColor: theme.toolbar.border, color: theme.node.text }}>
            <input
                key={`${min}-${value}`}
                type="number"
                inputMode="numeric"
                min={min}
                max={max}
                defaultValue={value}
                aria-label="视频时长（秒）"
                className="min-w-0 flex-1 bg-transparent pl-2 text-right outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                onBlur={(event) => commit(event.currentTarget)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                }}
                onMouseDown={(event) => event.stopPropagation()}
            />
            <span className="shrink-0 px-1.5" style={{ color: theme.node.muted }}>秒</span>
        </label>
    );
}

function VideoDurationControl({ profile, value, theme, disabled, onChange }: { profile: VideoCapabilityConfig; value: number; theme: CanvasTheme; disabled?: (value: number) => boolean; onChange: (value: number) => void }) {
    if (profile.duration.selection === "range") {
        const min = profile.duration.min || VIDEO_DURATION_MIN;
        const max = Math.max(min, profile.duration.max || min);
        const step = Math.max(1, profile.duration.step || 1);
        const normalized = normalizeDurationValue(value, profile.duration.default, min, max, step);
		return <DurationRangeControl value={normalized} min={min} max={max} step={step} theme={theme} onChange={(next) => { if (!disabled?.(next)) onChange(next); }} />;
    }

    const options = videoDurationOptions(profile);
    return <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 4)}, minmax(0, 1fr))` }}>
		{options.map((option) => <OptionPill key={option} selected={normalizedNumber(value) === option} disabled={disabled?.(option)} theme={theme} onClick={() => onChange(option)}>{option}s</OptionPill>)}
    </div>;
}

function modelPriceTiers(config: AiConfig, targetModelOverride?: string) {
	const targetModel = targetModelOverride || config.videoModel || config.model;
	const channel = resolveModelChannel(config, targetModel);
	const cost = channel.modelCosts?.find((item) => item.model === modelOptionName(targetModel));
	return cost?.logicalPriceTiers || [];
}

function hasPriceTierForVideoSelection(tiers: ReturnType<typeof modelPriceTiers>, resolution: string, seconds: number) {
	if (!tiers.length) return true;
	const normalizedResolution = normalizeTierResolution(resolution);
	return tiers.some((tier) => {
		const selector = tier.selector || {};
		const tierResolution = selector.vquality || tier.resolution;
		const tierSeconds = selector.videoSeconds ? Number(selector.videoSeconds) : tier.videoSeconds;
		return (tierResolution === "*" || !tierResolution || normalizeTierResolution(tierResolution) === normalizedResolution) && (!tierSeconds || tierSeconds === seconds);
	});
}

function normalizeTierResolution(value: string) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw || raw === "*") return "*";
    if (raw === "2k" || raw === "1440" || raw === "1440p") return "2k";
    if (raw === "4k" || raw === "2160" || raw === "2160p") return "4k";
    if (raw.endsWith("p")) return raw;
    return `${raw}p`;
}

function DurationRangeControl({ value, min, max, step, theme, onChange }: { value: number; min: number; max: number; step: number; theme: CanvasTheme; onChange: (value: number) => void }) {
    return <div className="space-y-1.5">
        <div className="flex min-w-0 items-center gap-2">
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                aria-label="视频时长（秒）"
                className="video-duration-range h-8 min-w-0 flex-1"
                style={{ accentColor: theme.accent.primary }}
                onChange={(event) => onChange(Number(event.target.value))}
                onMouseDown={(event) => event.stopPropagation()}
            />
            <DurationInput value={value} min={min} max={max} theme={theme} onChange={onChange} />
        </div>
        <div className="flex justify-between px-0.5 text-[var(--fs-tiny)]" style={{ color: theme.node.muted }}>
            <span>{min}s</span>
            <span>{max}s</span>
        </div>
    </div>;
}

function normalizeDurationValue(value: number, fallback: number, min: number, max: number, step: number) {
    const candidate = Number.isFinite(value) ? value : fallback;
    const clamped = Math.min(max, Math.max(min, Math.floor(candidate)));
    const maxStep = Math.max(0, Math.floor((max - min) / step));
    return min + Math.min(maxStep, Math.max(0, Math.round((clamped - min) / step))) * step;
}

function normalizedNumber(value: number) {
    return Number.isFinite(value) ? Math.floor(value) : 0;
}

function SizePreview({ width, height, color }: { width: number; height: number; color: string }) {
    if (!width || !height) return null;
    const longSide = Math.max(width, height);
    const previewWidth = Math.max(7, Math.round((width / longSide) * 16));
    const previewHeight = Math.max(7, Math.round((height / longSide) * 16));
    return <span className="shrink-0 rounded-[2px] border" style={{ width: previewWidth, height: previewHeight, borderColor: color }} />;
}

function ratioPreview(ratio: string) {
    if (ratio === "9:16") return { width: 9, height: 16 };
    if (ratio === "1:1") return { width: 1, height: 1 };
    if (ratio === "4:3") return { width: 4, height: 3 };
    if (ratio === "3:4") return { width: 3, height: 4 };
    if (ratio === "21:9") return { width: 21, height: 9 };
    if (ratio === "adaptive") return { width: 0, height: 0 };
    return { width: 16, height: 9 };
}

function SwitchRow({ label, checked, theme, onChange }: { label: string; checked: boolean; theme: CanvasTheme; onChange: (checked: boolean) => void }) {
    return (
        <div className="flex h-8 items-center justify-between gap-2">
            <span className="min-w-0 whitespace-nowrap text-[var(--fs-label)]" style={{ color: theme.node.text }}>
                {label}
            </span>
            <span className="shrink-0" onMouseDown={(event) => event.stopPropagation()}>
                <Switch size="small" checked={checked} onChange={onChange} />
            </span>
        </div>
    );
}

function readSizeDimensions(size: string) {
    if (size === "auto") return { width: 0, height: 0 };
    const match = size.match(/^(\d+)x(\d+)$/);
    return { width: Number(match?.[1]) || 1280, height: Number(match?.[2]) || 720 };
}

function normalizeRatioValue(value: string) {
    const match = String(value || "").match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
    if (!match) return value;
    return `${match[1]}:${match[2]}`;
}

function AutoDLVideoSettingsPanel({ config, profile, priceTiers, onConfigChange, theme, showTitle, className }: VideoSettingsPanelProps & { profile: VideoCapabilityConfig; priceTiers: ReturnType<typeof modelPriceTiers> }) {
    const seconds = normalizeVideoDuration(config.videoSeconds || String(profile.duration?.default || 5));
    const resolution = String(config.vquality || profile.defaultResolution || "768p竖");
    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-sm font-semibold">AutoDL.Art 视频设置</div> : null}
                <SettingGroup title="分辨率 / 比例" color={theme.node.muted}>
                    <div className="grid grid-cols-3 gap-1.5">
                        {profile.resolutions.map((value) => {
                            const ratio = autoDLResolutionRatio(value);
                            return (
                                <AutoDLResolutionOption
                                    key={value}
                                    value={value}
                                    ratio={ratio}
                                    selected={resolution === value}
                                    disabled={!hasPriceTierForVideoSelection(priceTiers, value, Number(seconds))}
                                    theme={theme}
                                    onClick={() => {
                                        onConfigChange("vquality", value);
                                        onConfigChange("size", ratio);
                                    }}
                                />
                            );
                        })}
                    </div>
                </SettingGroup>
                <SettingGroup title="秒数" color={theme.node.muted}>
                    <VideoDurationControl profile={profile} value={Number(seconds)} theme={theme} onChange={(value) => onConfigChange("videoSeconds", String(value))} />
                </SettingGroup>
            </div>
        </ImageSettingsTheme>
    );
}

function AutoDLResolutionOption({ value, ratio, selected, disabled, theme, onClick }: { value: string; ratio: string; selected: boolean; disabled?: boolean; theme: CanvasTheme; onClick: () => void }) {
    const preview = ratioPreview(ratio);
    return (
        <button
            type="button"
            disabled={disabled}
            className="flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-xs font-medium transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1"
            style={{ background: selected ? theme.toolbar.activeBg : "transparent", color: theme.node.text, outlineColor: theme.node.muted }}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={onClick}
        >
            <span className="flex items-center gap-1">
                <SizePreview width={preview.width} height={preview.height} color={theme.node.text} />
                <span>{ratio}</span>
            </span>
            <span className="whitespace-nowrap text-[var(--fs-tiny)]">{value}</span>
        </button>
    );
}

function autoDLResolutionRatio(value: string) {
    if (value.includes("竖")) return "9:16";
    if (value.includes("横")) return "16:9";
    if (value.includes("(1:1)") || value.includes("1:1")) return "1:1";
    return "9:16";
}

function Flow2APIVideoSettingsPanel({ config, profile, priceTiers, onConfigChange, theme, showTitle, className }: VideoSettingsPanelProps & { profile: VideoCapabilityConfig; priceTiers?: ReturnType<typeof modelPriceTiers> }) {
    const targetModel = config.model || config.videoModel;
    const model = modelOptionName(targetModel).toLowerCase();
    const isOmni = model.includes("omni flash") || model.includes("omni-flash") || model === "omni";
    const isQuality = model.includes("quality");
    const ratio = normalizeRatioValue(config.size || profile.defaultRatio || "16:9");
    const duration = profile.duration.selection === "enum" && profile.duration.values?.length
        ? String(profile.duration.values.includes(Number(config.videoSeconds)) ? Number(config.videoSeconds) : profile.duration.default)
        : "";
    const resolution = config.vquality || profile.defaultResolution || "";
    const resolutionToken = resolution.replace(/p$/i, "").toLowerCase();

    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-sm font-semibold">Flow2API 视频设置</div> : null}
                <SettingGroup title="画幅" color={theme.node.muted}>
                    <div className="grid grid-cols-2 gap-1.5">
                        {profile.ratios.map((value) => (
                            <RatioOption key={value} value={value} selected={ratio === value} theme={theme} onClick={() => onConfigChange("size", value)} />
                        ))}
                    </div>
                </SettingGroup>
                {isOmni && profile.duration.values?.length ? (
                    <SettingGroup title="秒数" color={theme.node.muted}>
                        <div className="grid grid-cols-4 gap-1.5">
                            {profile.duration.values.map((value) => (
                                <OptionPill key={value} selected={Number(duration) === value} theme={theme} onClick={() => onConfigChange("videoSeconds", String(value))}>
                                    {value}s
                                </OptionPill>
                            ))}
                        </div>
                    </SettingGroup>
                ) : null}
                {isQuality ? (
                    <SettingGroup title="输出分辨率" color={theme.node.muted}>
                        <div className="grid grid-cols-3 gap-1.5">
                            <OptionPill selected={!resolution || resolution === "default"} theme={theme} onClick={() => onConfigChange("vquality", "")}>
                                默认
                            </OptionPill>
                            {(profile.resolutions.length ? profile.resolutions : ["1080p", "4k"]).map((value) => (
                                <OptionPill key={value} selected={resolutionToken === value.replace(/p$/i, "").toLowerCase()} theme={theme} onClick={() => onConfigChange("vquality", value.replace(/p$/i, ""))}>
                                    {value.toUpperCase()}
                                </OptionPill>
                            ))}
                        </div>
                    </SettingGroup>
                ) : null}
            </div>
        </ImageSettingsTheme>
    );
}

function Grok2APIVideoSettingsPanel({ config, profile, priceTiers, onConfigChange, theme, showTitle, className }: VideoSettingsPanelProps & { profile: VideoCapabilityConfig; priceTiers: ReturnType<typeof modelPriceTiers> }) {
    const seconds = normalizeVideoDuration(config.videoSeconds || String(profile.duration?.default || 6));
    const resolution = normalizeVideoResolutionValue(config.vquality || profile.defaultResolution || "720p");
    const ratio = normalizeRatioValue(config.size || profile.defaultRatio || "1:1");

    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-sm font-semibold">Grok 视频设置</div> : null}
                <SettingGroup title="画幅" color={theme.node.muted}>
                    <div className="grid grid-cols-3 gap-1.5">
                        {profile.ratios.map((value) => (
                            <RatioOption key={value} value={value} selected={ratio === value} theme={theme} onClick={() => onConfigChange("size", value)} />
                        ))}
                    </div>
                </SettingGroup>
                <SettingGroup title="秒数" color={theme.node.muted}>
                    <VideoDurationControl profile={profile} value={Number(seconds)} theme={theme} disabled={(value) => !hasPriceTierForVideoSelection(priceTiers, resolution, value)} onChange={(value) => onConfigChange("videoSeconds", String(value))} />
                </SettingGroup>
                <SettingGroup title="分辨率" color={theme.node.muted}>
                    <div className="grid grid-cols-3 gap-1.5">
                        {profile.resolutions.map((value) => {
                            const normalized = normalizeVideoResolutionValue(value);
                            return (
                                <OptionPill key={value} selected={resolution === normalized} disabled={!hasPriceTierForVideoSelection(priceTiers, normalized, Number(seconds))} theme={theme} onClick={() => onConfigChange("vquality", value)}>
                                    {value.toUpperCase()}
                                </OptionPill>
                            );
                        })}
                    </div>
                </SettingGroup>
            </div>
        </ImageSettingsTheme>
    );
}

function RatioOption({ value, selected, theme, onClick }: { value: string; selected: boolean; theme: CanvasTheme; onClick: () => void }) {
    const preview = ratioPreview(value);
    return (
        <button
            type="button"
            className="flex h-11 min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[var(--fs-tiny)] font-medium leading-none transition-colors hover:brightness-110 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1"
            style={{ background: selected ? theme.toolbar.activeBg : "transparent", color: theme.node.text, outlineColor: theme.node.muted }}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={onClick}
        >
            <span className="grid h-4 place-items-center">
                <SizePreview width={preview.width} height={preview.height} color={theme.node.text} />
            </span>
            <span className="whitespace-nowrap">{value}</span>
        </button>
    );
}
