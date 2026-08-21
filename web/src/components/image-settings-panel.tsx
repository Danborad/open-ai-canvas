import { type ReactNode, useState } from "react";
import { ConfigProvider, Switch } from "antd";

import { type CanvasTheme } from "@/lib/canvas-theme";
import { flow2APIImageAspectOptions, flow2APIImageScaleLabel, flow2APIImageScaleOptions, isFlow2APIImageConfig, normalizeFlow2APIImageAspect, normalizeFlow2APIImageScale } from "@/lib/flow2api";
import { grok2APIImageAspectOptions, grok2APIImageResolutionOptions, isGrok2APIImageConfig, isGrok2APINewImageConfig, normalizeGrok2APIImageAspect, normalizeGrok2APIImageResolution } from "@/lib/grok-image";
import { modelCapabilityConfigFor, normalizeImageValue, type ImageCapabilityConfig } from "@/lib/model-capabilities";
import { type AiConfig } from "@/stores/use-config-store";

const qualityOptions = [
    { value: "auto", label: "自动" },
    { value: "high", label: "高" },
    { value: "medium", label: "中" },
    { value: "low", label: "低" },
];
const DIMENSION_STEP = 16;

const aspectOptions = [
    { value: "1:1", label: "1:1", width: 1024, height: 1024, icon: "square" },
    { value: "4:5", label: "4:5", width: 1024, height: 1280, icon: "portrait" },
    { value: "5:4", label: "5:4", width: 1280, height: 1024, icon: "landscape" },
    { value: "3:2", label: "3:2", width: 1536, height: 1024, icon: "landscape" },
    { value: "2:3", label: "2:3", width: 1024, height: 1536, icon: "portrait" },
    { value: "4:3", label: "4:3", width: 1360, height: 1024, icon: "landscape" },
    { value: "3:4", label: "3:4", width: 1024, height: 1360, icon: "portrait" },
    { value: "16:9", label: "16:9", width: 1824, height: 1024, icon: "landscape" },
    { value: "9:16", label: "9:16", width: 1024, height: 1824, icon: "portrait" },
    { value: "21:9", label: "21:9", size: "2352x1008", width: 2352, height: 1008, icon: "landscape" },
    { value: "9:21", label: "9:21", size: "1008x2352", width: 1008, height: 2352, icon: "portrait" },
    { value: "4:1", label: "4:1", width: 2048, height: 512, icon: "landscape" },
    { value: "1:4", label: "1:4", width: 512, height: 2048, icon: "portrait" },
    { value: "8:1", label: "8:1", width: 2048, height: 256, icon: "landscape" },
    { value: "1:8", label: "1:8", width: 256, height: 2048, icon: "portrait" },
    { value: "1:1-2k", label: "1:1(2k)", size: "2048x2048", width: 2048, height: 2048, icon: "square" },
    { value: "16:9-2k", label: "16:9(2k)", size: "2048x1152", width: 2048, height: 1152, icon: "landscape" },
    { value: "9:16-2k", label: "9:16(2k)", size: "1152x2048", width: 1152, height: 2048, icon: "portrait" },
    { value: "16:9-4k", label: "16:9(4k)", size: "3840x2160", width: 3840, height: 2160, icon: "landscape" },
    { value: "9:16-4k", label: "9:16(4k)", size: "2160x3840", width: 2160, height: 3840, icon: "portrait" },
    { value: "auto", label: "auto", width: 0, height: 0, icon: "auto" },
];

type ImageSettingsPanelProps = {
    config: AiConfig;
    onConfigChange: (key: "quality" | "size" | "transparentBackground" | "count", value: string) => void;
    theme: CanvasTheme;
    showTitle?: boolean;
    showCount?: boolean;
    className?: string;
    maxCount?: number;
    quickCount?: number;
};

export function ImageSettingsPanel({ config, onConfigChange, theme, showTitle = true, showCount = true, className = "w-[304px] space-y-3 rounded-2xl px-1 py-0.5", maxCount = 15, quickCount = 3 }: ImageSettingsPanelProps) {
    const [snapDimensionToStep, setSnapDimensionToStep] = useState(true);
    const selectedModel = config.model || config.imageModel;
    if (isFlow2APIImageConfig(config)) {
        return <Flow2APIImageSettingsPanel config={config} onConfigChange={onConfigChange} theme={theme} showTitle={showTitle} showCount={showCount} className={className} maxCount={maxCount} quickCount={quickCount} />;
    }
    if (isGrok2APINewImageConfig(config)) {
        return <Grok2APINewImageSettingsPanel config={config} onConfigChange={onConfigChange} theme={theme} showTitle={showTitle} showCount={showCount} className={className} maxCount={maxCount} quickCount={quickCount} />;
    }
    if (isGrok2APIImageConfig(config)) {
        return <Grok2APIImageSettingsPanel config={config} onConfigChange={onConfigChange} theme={theme} showTitle={showTitle} showCount={showCount} className={className} maxCount={maxCount} quickCount={quickCount} />;
    }
    const profile = modelCapabilityConfigFor(config, selectedModel).image!;
    const normalized = normalizeImageValue(profile, config);
    const quality = normalized.quality;
    const transparentBackground = normalized.transparentBackground === "true";
    const effectiveMaxCount = Math.min(maxCount, profile.maxOutputs || maxCount);
    const count = Math.max(1, Math.min(effectiveMaxCount, Number(normalized.count)));
    const activeSize = normalized.size;
    const availableAspects = resolveAvailableAspects(profile);
    const selectedAspect = availableAspects.find((item) => (item as { size?: string }).size === activeSize || item.value === activeSize);
    const dimensions = readSizeDimensions(activeSize, selectedAspect || aspectOptions[0]);
    const activeQualityOptions = profile.quality.values.map((value) => qualityOptions.find((item) => item.value === value) || { value, label: value });
    const selectAspect = (value: string) => {
        if (profile.size.parameter === "aspect_ratio") {
            onConfigChange("size", value);
            return;
        }
        const option = availableAspects.find((item) => item.value === value) || aspectOptions.find((item) => item.value === value);
        onConfigChange("size", option ? imageOptionValue(profile, option) : value);
    };
    const updateDimension = (key: "width" | "height", value: number | null) => {
        const next = Math.max(1, Math.floor(value || dimensions[key] || 1024));
        const width = key === "width" ? next : dimensions.width;
        const height = key === "height" ? next : dimensions.height;
        onConfigChange("size", `${alignDimension(width, snapDimensionToStep)}x${alignDimension(height, snapDimensionToStep)}`);
    };

    return (
        <ImageSettingsTheme theme={theme}>
            <div
                className={className}
                style={{ color: theme.node.text }}
                onMouseDown={(event) => {
                    event.stopPropagation();
                    if (event.target instanceof HTMLInputElement) return;
                    if (document.activeElement instanceof HTMLInputElement && event.currentTarget.contains(document.activeElement)) document.activeElement.blur();
                }}
            >
                {showTitle ? <div className="text-base font-semibold">图像设置</div> : null}
                {profile.quality.supported ? (
                    <div className="space-y-2">
                        <SettingTitle color={theme.node.muted}>质量</SettingTitle>
                        <div className="grid grid-cols-4 gap-1.5">
                            {activeQualityOptions.map((item) => (
                                <OptionPill key={item.value} selected={quality === item.value} theme={theme} onClick={() => onConfigChange("quality", item.value)}>
                                    {item.label}
                                </OptionPill>
                            ))}
                        </div>
                    </div>
                ) : null}
                {profile.transparentBackground.supported ? (
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <SettingTitle color={theme.node.muted}>透明背景</SettingTitle>
                            <div className="mt-1 text-[var(--fs-label)]" style={{ color: theme.node.muted }}>
                                请求模型输出保留 Alpha 通道的 PNG
                            </div>
                        </div>
                        <span title="是否支持透明背景由当前模型接口决定" onMouseDown={(event) => event.stopPropagation()}>
                            <Switch size="small" checked={transparentBackground} onChange={(checked) => onConfigChange("transparentBackground", checked ? "true" : "false")} />
                        </span>
                    </div>
                ) : null}
                {profile.size.parameter !== "none" ? (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <SettingTitle color={theme.node.muted}>尺寸</SettingTitle>
                            {profile.size.allowCustom ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium" style={{ color: theme.node.muted }}>
                                        16倍数对齐
                                    </span>
                                    <span title="输入完成后自动向上补成 16 的倍数" onMouseDown={(event) => event.stopPropagation()}>
                                        <Switch size="small" checked={snapDimensionToStep} onChange={setSnapDimensionToStep} />
                                    </span>
                                </div>
                            ) : null}
                        </div>
                        {profile.size.allowCustom ? (
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                                <DimensionInput prefix="W" value={dimensions.width} disabled={activeSize === "auto"} theme={theme} alignToStep={snapDimensionToStep} onChange={(value) => updateDimension("width", value)} />
                                <span className="text-sm opacity-45">↔</span>
                                <DimensionInput prefix="H" value={dimensions.height} disabled={activeSize === "auto"} theme={theme} alignToStep={snapDimensionToStep} onChange={(value) => updateDimension("height", value)} />
                            </div>
                        ) : null}
                    </div>
                ) : null}
                {availableAspects.length ? (
                    <div className="space-y-2">
                        <SettingTitle color={theme.node.muted}>宽高比</SettingTitle>
                        <div className="grid grid-cols-4 gap-1.5 min-[380px]:grid-cols-5">
                            {availableAspects.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    className="flex h-[52px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg bg-transparent text-[var(--fs-label)] transition-colors hover:brightness-110 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1"
                                    style={{ background: selectedAspect?.value === item.value ? theme.toolbar.activeBg : "transparent", color: theme.node.text, outlineColor: theme.node.muted }}
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onClick={() => selectAspect(item.value)}
                                >
                                    <AspectIcon type={item.icon} width={item.width} height={item.height} color={theme.node.text} />
                                    <span className="whitespace-nowrap">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : null}
                {showCount && effectiveMaxCount > 1 ? (
                    <div className="space-y-2">
                        <SettingTitle color={theme.node.muted}>生成张数</SettingTitle>
                        <div className="grid grid-cols-4 gap-1.5">
                            {Array.from({ length: Math.min(quickCount, effectiveMaxCount) }, (_, index) => index + 1).map((value) => (
                                <OptionPill key={value} selected={count === value} theme={theme} onClick={() => onConfigChange("count", String(value))}>
                                    {value}
                                </OptionPill>
                            ))}
                            <CountInput value={count} quickCount={quickCount} max={effectiveMaxCount} theme={theme} onChange={(value) => onConfigChange("count", String(value || 1))} />
                        </div>
                    </div>
                ) : null}
            </div>
        </ImageSettingsTheme>
    );
}

function Grok2APINewImageSettingsPanel({ config, onConfigChange, theme, showTitle, showCount, className, maxCount = 10, quickCount = 3 }: ImageSettingsPanelProps) {
    const profile = modelCapabilityConfigFor(config, config.model || config.imageModel).image!;
    const normalized = normalizeImageValue(profile, config);
    const count = Number(normalized.count);
    const countLimit = Math.min(maxCount, profile.maxOutputs || maxCount);
    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-base font-semibold">Grok2API New 图像设置</div> : null}
                {profile.size.parameter !== "none" ? (
                    <div className="space-y-2">
                        <SettingTitle color={theme.node.muted}>画幅</SettingTitle>
                        <div className="grid grid-cols-4 gap-1.5">
                            {profile.size.values.map((value) => (
                                <OptionPill key={value} selected={normalized.size === value} theme={theme} onClick={() => onConfigChange("size", value)}>
                                    {value}
                                </OptionPill>
                            ))}
                        </div>
                    </div>
                ) : null}
                {profile.quality.supported ? (
                    <div className="space-y-2">
                        <SettingTitle color={theme.node.muted}>分辨率</SettingTitle>
                        <div className="grid grid-cols-2 gap-1.5">
                            {profile.quality.values.map((value) => (
                                <OptionPill key={value} selected={normalized.quality === value} theme={theme} onClick={() => onConfigChange("quality", value)}>
                                    {value.toUpperCase()}
                                </OptionPill>
                            ))}
                        </div>
                    </div>
                ) : null}
                {showCount ? (
                    <div className="space-y-2">
                        <SettingTitle color={theme.node.muted}>生成张数</SettingTitle>
                        <div className="grid grid-cols-4 gap-1.5">
                            {Array.from({ length: Math.min(quickCount, countLimit) }, (_, index) => index + 1).map((value) => (
                                <OptionPill key={value} selected={count === value} theme={theme} onClick={() => onConfigChange("count", String(value))}>
                                    {value}
                                </OptionPill>
                            ))}
                            <CountInput value={count} quickCount={quickCount} max={countLimit} theme={theme} onChange={(value) => onConfigChange("count", String(value || 1))} />
                        </div>
                    </div>
                ) : null}
            </div>
        </ImageSettingsTheme>
    );
}

function Flow2APIImageSettingsPanel({ config, onConfigChange, theme, showTitle, showCount, className, maxCount = 4, quickCount = 3 }: ImageSettingsPanelProps) {
    const aspect = normalizeFlow2APIImageAspect(config.size);
    const scale = normalizeFlow2APIImageScale(config.quality, config.size);
    const count = Math.max(1, Math.min(Math.min(maxCount, 4), Math.floor(Math.abs(Number(config.count)) || 1)));
    const countOptions = Array.from({ length: Math.min(quickCount, Math.min(maxCount, 4)) }, (_, index) => index + 1);

    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-base font-semibold">图像设置</div> : null}
                <div className="space-y-2">
                    <SettingTitle color={theme.node.muted}>画幅</SettingTitle>
                    <div className="grid grid-cols-4 gap-1.5">
                        {flow2APIImageAspectOptions.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                className="flex h-[52px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg text-[var(--fs-label)] transition-colors hover:brightness-110 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1"
                                style={{ background: aspect === item.value ? theme.toolbar.activeBg : "transparent", color: theme.node.text, outlineColor: theme.node.muted }}
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={() => onConfigChange("size", item.value)}
                            >
                                <AspectIcon type={item.icon} width={item.width} height={item.height} color={theme.node.text} />
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
                {showCount ? (
                    <div className="space-y-2">
                        <SettingTitle color={theme.node.muted}>生成张数</SettingTitle>
                        <div className="grid grid-cols-4 gap-1.5">
                            {countOptions.map((value) => (
                                <OptionPill key={value} selected={count === value} theme={theme} onClick={() => onConfigChange("count", String(value))}>
                                    {value}
                                </OptionPill>
                            ))}
                            <CountInput value={count} quickCount={quickCount} max={Math.min(maxCount, 4)} theme={theme} onChange={(value) => onConfigChange("count", String(value || 1))} />
                        </div>
                    </div>
                ) : null}
                <div className="space-y-2">
                    <SettingTitle color={theme.node.muted}>分辨率</SettingTitle>
                    <div className="grid grid-cols-2 gap-1.5">
                        {flow2APIImageScaleOptions.map((item) => (
                            <OptionPill key={item.value} selected={scale === item.value} theme={theme} onClick={() => onConfigChange("quality", item.value)}>
                                {item.label}
                            </OptionPill>
                        ))}
                    </div>
                </div>
            </div>
        </ImageSettingsTheme>
    );
}

function Grok2APIImageSettingsPanel({ config, onConfigChange, theme, showTitle, showCount, className, maxCount = 4, quickCount = 3 }: ImageSettingsPanelProps) {
    const aspect = normalizeGrok2APIImageAspect(config.size);
    const resolution = normalizeGrok2APIImageResolution(config.quality);
    const count = Math.max(1, Math.min(Math.min(maxCount, 4), Math.floor(Math.abs(Number(config.count)) || 1)));
    const countOptions = Array.from({ length: Math.min(quickCount, Math.min(maxCount, 4)) }, (_, index) => index + 1);
    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-base font-semibold">图像设置</div> : null}
                <div className="space-y-2">
                    <SettingTitle color={theme.node.muted}>画幅</SettingTitle>
                    <div className="grid grid-cols-4 gap-1.5">
                        {grok2APIImageAspectOptions.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                className="flex h-[52px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg text-[var(--fs-label)] transition-colors hover:brightness-110 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1"
                                style={{ background: aspect === item.value ? theme.toolbar.activeBg : "transparent", color: theme.node.text, outlineColor: theme.node.muted }}
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={() => onConfigChange("size", item.value)}
                            >
                                <AspectIcon type={item.icon} width={item.width} height={item.height} color={theme.node.text} />
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="space-y-2">
                    <SettingTitle color={theme.node.muted}>分辨率</SettingTitle>
                    <div className="grid grid-cols-2 gap-1.5">
                        {grok2APIImageResolutionOptions.map((item) => (
                            <OptionPill key={item.value} selected={resolution === item.value} theme={theme} onClick={() => onConfigChange("quality", item.value)}>
                                {item.label}
                            </OptionPill>
                        ))}
                    </div>
                </div>
                {showCount ? (
                    <div className="space-y-2">
                        <SettingTitle color={theme.node.muted}>生成张数</SettingTitle>
                        <div className="grid grid-cols-4 gap-1.5">
                            {countOptions.map((value) => (
                                <OptionPill key={value} selected={count === value} theme={theme} onClick={() => onConfigChange("count", String(value))}>
                                    {value}
                                </OptionPill>
                            ))}
                            <CountInput value={count} quickCount={quickCount} max={Math.min(maxCount, 4)} theme={theme} onChange={(value) => onConfigChange("count", String(value || 1))} />
                        </div>
                    </div>
                ) : null}
            </div>
        </ImageSettingsTheme>
    );
}

function resolveAvailableAspects(profile: ImageCapabilityConfig) {
    if (profile.size.parameter === "none") return [];
    if (!profile.size.values || profile.size.values.length === 0) {
        return aspectOptions.filter((item) => imageOptionAllowed(profile, item));
    }
    return profile.size.values.map((val) => {
        const matched = aspectOptions.find((opt) => opt.value === val || (opt as { size?: string }).size === val);
        if (matched) return matched;
        const ratioMatch = val.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
        if (ratioMatch) {
            const w = parseFloat(ratioMatch[1]);
            const h = parseFloat(ratioMatch[2]);
            return {
                value: val,
                label: val,
                width: w * 256,
                height: h * 256,
                icon: w === h ? "square" : w > h ? "landscape" : "portrait",
            };
        }
        const dimMatch = val.match(/^(\d+)x(\d+)$/);
        if (dimMatch) {
            const w = parseInt(dimMatch[1], 10);
            const h = parseInt(dimMatch[2], 10);
            return {
                value: val,
                size: val,
                label: val,
                width: w,
                height: h,
                icon: w === h ? "square" : w > h ? "landscape" : "portrait",
            };
        }
        return {
            value: val,
            label: val,
            width: 1024,
            height: 1024,
            icon: val === "auto" ? "auto" : "square",
        };
    });
}

function imageOptionAllowed(profile: ImageCapabilityConfig, option: (typeof aspectOptions)[number]) {
    if (profile.size.parameter === "none") return false;
    if (profile.size.allowCustom && profile.size.values.length === 0) return true;
    return [option.value, option.size, option.width && option.height ? `${option.width}x${option.height}` : ""].filter(Boolean).some((value) => profile.size.values.includes(String(value)));
}

function imageOptionValue(profile: ImageCapabilityConfig, option: (typeof aspectOptions)[number]) {
    const candidates = [option.size, option.value, option.width && option.height ? `${option.width}x${option.height}` : ""].filter(Boolean).map(String);
    return candidates.find((value) => profile.size.values.includes(value)) || option.size || option.value || "auto";
}

export function ImageSettingsTheme({ theme, children }: { theme: CanvasTheme; children: ReactNode }) {
    return (
        <ConfigProvider
            theme={{
                token: { colorBgContainer: theme.canvas.background, colorBgElevated: theme.canvas.background, colorBorder: theme.node.stroke, colorPrimary: theme.node.activeStroke, colorText: theme.node.text, colorTextLightSolid: theme.node.panel },
                components: { Button: { defaultBg: theme.canvas.background, defaultBorderColor: theme.node.stroke, defaultColor: theme.node.text } },
            }}
        >
            {children}
        </ConfigProvider>
    );
}

export function imageQualityLabel(value: string) {
    return ({ auto: "自动", high: "高", medium: "中", low: "低", "1k": "1K", "2k": "2K" } as Record<string, string>)[value] || flow2APIImageScaleLabel(value);
}

export function imageSizeLabel(size: string) {
    return aspectOptions.find((item) => (item.size || item.value) === size || item.value === size)?.label || size;
}

function OptionPill({ selected, theme, onClick, children }: { selected: boolean; theme: CanvasTheme; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            className="h-8 cursor-pointer rounded-full px-2 text-xs transition-colors hover:brightness-110 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1"
            style={{ background: selected ? theme.toolbar.activeBg : "transparent", color: theme.node.text, outlineColor: theme.node.muted }}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function DimensionInput({ prefix, value, disabled, theme, alignToStep, onChange }: { prefix: string; value: number; disabled: boolean; theme: CanvasTheme; alignToStep: boolean; onChange: (value: number | null) => void }) {
    const commit = (input: HTMLInputElement) => {
        const next = alignDimension(Math.max(1, Math.floor(Number(input.value) || value || 1024)), alignToStep);
        input.value = String(next);
        onChange(next);
    };

    return (
        <label className="flex h-8 overflow-hidden rounded-lg text-xs" style={{ background: theme.toolbar.itemHover, color: theme.node.text, opacity: disabled ? 0.55 : 1 }}>
            <span className="grid w-8 place-items-center" style={{ color: theme.node.muted }}>
                {prefix}
            </span>
            <input
                type="number"
                min={1}
                disabled={disabled}
                className="min-w-0 flex-1 bg-transparent px-2 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                defaultValue={value || ""}
                key={`${prefix}-${value}`}
                onBlur={(event) => commit(event.currentTarget)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                }}
                onMouseDown={(event) => event.stopPropagation()}
            />
        </label>
    );
}

function CountInput({ value, quickCount, max, theme, onChange }: { value: number; quickCount: number; max: number; theme: CanvasTheme; onChange: (value: number | null) => void }) {
    const commit = (input: HTMLInputElement) => {
        const next = Math.max(1, Math.min(max, Math.floor(Number(input.value) || 1)));
        input.value = String(next);
        onChange(next);
    };
    return (
        <label className="flex h-8 overflow-hidden rounded-full text-xs" style={{ background: theme.toolbar.itemHover, color: theme.node.text }}>
            <input
                key={value > quickCount ? `custom-${value}` : "quick"}
                type="number"
                min={1}
                max={max}
                aria-label="自定义生成张数"
                placeholder="输入"
                className="min-w-0 flex-1 bg-transparent px-2 text-center outline-none placeholder:text-current placeholder:opacity-55 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                style={{ color: theme.node.text, WebkitTextFillColor: theme.node.text }}
                defaultValue={value > quickCount ? value : ""}
                onBlur={(event) => commit(event.currentTarget)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                }}
                onMouseDown={(event) => event.stopPropagation()}
            />
        </label>
    );
}

function AspectIcon({ type, width, height, color }: { type: string; width: number; height: number; color: string }) {
    if (type === "auto") return null;
    const ratio = width / Math.max(1, height);
    const boxWidth = ratio >= 1 ? 22 : Math.max(9, 22 * ratio);
    const boxHeight = ratio >= 1 ? Math.max(9, 22 / ratio) : 22;
    return (
        <span className="grid h-6 w-8 place-items-center">
            <span className="border-2" style={{ width: boxWidth, height: boxHeight, borderColor: color }} />
        </span>
    );
}

function SettingTitle({ children, color }: { children: string; color: string }) {
    return (
        <div className="text-xs font-medium" style={{ color }}>
            {children}
        </div>
    );
}

function readSizeDimensions(size: string, fallback: { width: number; height: number }) {
    const match = size?.match(/^(\d+)x(\d+)$/);
    return {
        width: match ? Number(match[1]) : fallback.width,
        height: match ? Number(match[2]) : fallback.height,
    };
}

function alignDimension(value: number, enabled: boolean) {
    return enabled ? Math.ceil(value / DIMENSION_STEP) * DIMENSION_STEP : value;
}
