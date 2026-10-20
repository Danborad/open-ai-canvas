import { ImageSizePicker } from "./image-size-picker";
import { ImageParameterFields } from "./image-parameter-fields";
import { imageResolutionUsesQuality, imageSizePresets } from "@/lib/image-size-presets";
import { type ReactNode } from "react";
import { ConfigProvider } from "antd";
import { Switch } from "@/components/ui/base/switch";
import { Plus } from "lucide-react";

import { type CanvasTheme } from "@/lib/canvas-theme";
import { buildImageResolutionOptions, formatImageResolutionSize } from "@/lib/image-resolution-tiers";
import { modelCapabilityConfigFor, normalizeImageValue, type ImageCapabilityConfig } from "@/lib/model-capabilities";
import { mergedImageCapabilityConfig } from "@/lib/model-selection";
import { imagePriceSelector, normalizeImagePriceSelector } from "@/lib/image-pricing";
import { modelOptionName, resolveModelChannel, type AiConfig } from "@/stores/use-config-store";
import { imageQualityLabel } from "@/lib/image-quality";

export { imageQualityLabel } from "@/lib/image-quality";
type AspectOption = { value: string; label: string; width: number; height: number; icon: string; size?: string };

const aspectOptions: AspectOption[] = [
    { value: "1:1", label: "1:1", width: 1024, height: 1024, icon: "square" },
    { value: "3:2", label: "3:2", width: 1536, height: 1024, icon: "landscape" },
    { value: "2:3", label: "2:3", width: 1024, height: 1536, icon: "portrait" },
    { value: "4:3", label: "4:3", width: 1360, height: 1024, icon: "landscape" },
    { value: "3:4", label: "3:4", width: 1024, height: 1360, icon: "portrait" },
    { value: "16:9", label: "16:9", width: 1824, height: 1024, icon: "landscape" },
    { value: "2:1", label: "2:1", size: "2048x1024", width: 2048, height: 1024, icon: "landscape" },
    { value: "1:2", label: "1:2", size: "1024x2048", width: 1024, height: 2048, icon: "portrait" },
    { value: "21:9", label: "21:9", size: "1938x812", width: 1938, height: 812, icon: "landscape" },
    { value: "9:16", label: "9:16", width: 1024, height: 1824, icon: "portrait" },
    { value: "1:1-2k", label: "1:1(2k)", size: "2048x2048", width: 2048, height: 2048, icon: "square" },
    { value: "16:9-2k", label: "16:9(2k)", size: "2048x1152", width: 2048, height: 1152, icon: "landscape" },
    { value: "9:16-2k", label: "9:16(2k)", size: "1152x2048", width: 1152, height: 2048, icon: "portrait" },
    { value: "16:9-4k", label: "16:9(4k)", size: "3840x2160", width: 3840, height: 2160, icon: "landscape" },
    { value: "9:16-4k", label: "9:16(4k)", size: "2160x3840", width: 2160, height: 3840, icon: "portrait" },
    { value: "auto", label: "auto", width: 0, height: 0, icon: "auto" },
];

type ImageSettingsPanelProps = {
    config: AiConfig;
    onConfigChange: (key: "quality" | "imageResolution" | "size" | "transparentBackground" | "count" | "watermark" | "imageParameters", value: string) => void;
    theme: CanvasTheme;
    showTitle?: boolean;
    showQuality?: boolean;
    showTransparent?: boolean;
    showSize?: boolean;
    showCount?: boolean;
    className?: string;
    maxCount?: number;
    quickCount?: number;
    /** 局部编辑等场景需要先允许选择参数，由后端负责最终计费校验。 */
    bypassPriceGuard?: boolean;
};

export function ImageSettingsPanel({ config, onConfigChange, theme, showTitle = true, showQuality = true, showTransparent = true, showSize = true, showCount = true, className = "w-[304px] space-y-3 rounded-2xl px-1 py-0.5", maxCount = 15, quickCount = 4, bypassPriceGuard = false }: ImageSettingsPanelProps) {
    const profile = mergedImageCapabilityConfig(config, config.model || config.imageModel);
    const normalized = normalizeImageValue(profile, config);
    const quality = normalized.quality;
    const transparentBackground = normalized.transparentBackground === "true";
    const watermark = (config.videoWatermark || (config as Record<string, unknown>).watermark || "false") === "true";
    const effectiveMaxCount = Math.min(maxCount, profile.maxOutputs);
    const count = Math.max(1, Math.min(effectiveMaxCount, Number(normalized.count)));
    const activeSize = normalized.size;
    const activeQualityOptions = profile.quality.values.map((value) => ({ value, label: imageQualityLabel(value) }));
    const priceTiers = imageModelPriceTiers(config);
    if (profile.parameters) return <ImageSettingsTheme theme={theme}><div className={className}>{showTitle ? <div className="mb-3 text-base font-semibold">图像设置</div> : null}<ImageParameterFields profile={profile} config={config} onChange={onConfigChange} showSize={showSize} showCount={showCount} showQuality={showQuality} showTransparent={showTransparent} /></div></ImageSettingsTheme>;

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
                {showQuality && profile.quality.supported && !imageResolutionUsesQuality(profile) ? <div className="space-y-2">
                    <SettingTitle color={theme.node.muted}>{isGrokResolutionQuality(profile) ? "分辨率" : "质量"}</SettingTitle>
                    <div className={`grid gap-1.5 ${activeQualityOptions.length <= 2 ? "grid-cols-2" : "grid-cols-4"}`}>
						{activeQualityOptions.map((item) => (
                            <OptionPill key={item.value} selected={quality === item.value} disabled={!bypassPriceGuard && !hasPriceTierForImageSelection(priceTiers, item.value, activeSize)} theme={theme} onClick={() => onConfigChange("quality", item.value)}>
                                {item.label}
                            </OptionPill>
                        ))}
                    </div>
                </div> : null}
                {showTransparent && profile.transparentBackground.supported ? <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <SettingTitle color={theme.node.muted}>透明背景</SettingTitle>
                        <div className="mt-1 text-[var(--fs-label)]" style={{ color: theme.node.muted }}>
                            请求模型输出保留 Alpha 通道的 PNG
                        </div>
                    </div>
                    <span title="是否支持透明背景由当前模型接口决定" onMouseDown={(event) => event.stopPropagation()}>
                        <Switch
                            size="sm"
                            checked={transparentBackground}
                            onChange={(checked) => onConfigChange("transparentBackground", checked ? "true" : "false")}
                        />
                    </span>
                </div> : null}
                {profile.watermark?.supported ? <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <SettingTitle color={theme.node.muted}>图片水印</SettingTitle>
                        <div className="mt-1 text-[var(--fs-label)]" style={{ color: theme.node.muted }}>
                            在输出图片右下角添加官方水印
                        </div>
                    </div>
                    <span title="是否添加官方水印（默认关闭）" onMouseDown={(event) => event.stopPropagation()}>
                        <Switch
                            size="sm"
                            checked={watermark}
                            onChange={(checked) => onConfigChange("watermark", checked ? "true" : "false")}
                        />
                    </span>
                </div> : null}
                {showSize ? <ImageSizePicker profile={profile} size={activeSize} quality={quality} onChange={(size, nextQuality) => applyImageSizeSelection(onConfigChange, size, nextQuality)} /> : null}
                {showCount && effectiveMaxCount > 1 ? (
                    <div className="space-y-2">
                        <SettingTitle color={theme.node.muted}>生成张数</SettingTitle>
                        <div className={effectiveMaxCount > quickCount ? "grid grid-cols-5 gap-1.5" : `grid grid-cols-${Math.min(quickCount, effectiveMaxCount)} gap-1.5`}>
                            {Array.from({ length: Math.min(quickCount, effectiveMaxCount) }, (_, index) => index + 1).map((value) => (
                                <OptionPill key={value} selected={count === value} theme={theme} onClick={() => onConfigChange("count", String(value))}>
                                    {value}
                                </OptionPill>
                            ))}
                            {effectiveMaxCount > quickCount ? (
                                <CountInput value={count} quickCount={quickCount} max={effectiveMaxCount} theme={theme} onChange={(value) => onConfigChange("count", String(value || 1))} />
                            ) : null}
                        </div>
                    </div>
                ) : null}
            </div>
        </ImageSettingsTheme>
    );
}

export function applyImageSizeSelection(onConfigChange: ImageSettingsPanelProps["onConfigChange"], size: string, quality?: string) {
    onConfigChange("size", size);
    if (quality) onConfigChange("quality", quality);
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

function isGrokResolutionQuality(profile: ImageCapabilityConfig) {
    const values = profile.quality.values.map((item) => item.toLowerCase());
    return values.some((value) => ["1k", "2k", "4k"].includes(value));
}

export function imageSizeLabel(size: string) {
    const resolutionLabel = formatImageResolutionSize(size, buildImageResolutionOptions([size]));
    return resolutionLabel !== size ? resolutionLabel : aspectOptions.find((item) => (item.size || item.value) === size || item.value === size)?.label || size;
}

function imageModelPriceTiers(config: AiConfig) {
	const channel = resolveModelChannel(config, config.model || config.imageModel);
	const cost = channel.modelCosts?.find((item) => item.model === modelOptionName(config.model || config.imageModel));
	return cost?.logicalPriceTiers || [];
}

function hasPriceTierForImageSelection(tiers: ReturnType<typeof imageModelPriceTiers>, quality: string, size: string) {
    if (!tiers.length) return true;
    const requested = imagePriceSelector(quality, size);
    return tiers.some((tier) => {
        const selector = normalizeImagePriceSelector(tier.selector || {});
        return Object.entries(selector).every(([key, value]) => value === "*" || requested[key] === value);
    });
}

function OptionPill({ selected, disabled = false, theme, onClick, children }: { selected: boolean; disabled?: boolean; theme: CanvasTheme; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
			className="h-8 cursor-pointer rounded-full px-2 text-xs transition-colors hover:brightness-110 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-40"
			style={{ background: selected ? theme.toolbar.activeBg : "transparent", color: theme.node.text, outlineColor: theme.node.muted }}
			disabled={disabled}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function CountInput({ value, quickCount, max, theme, onChange }: { value: number; quickCount: number; max: number; theme: CanvasTheme; onChange: (value: number | null) => void }) {
    const isCustom = value > quickCount;
    const commit = (input: HTMLInputElement) => {
        const next = Math.max(1, Math.min(max, Math.floor(Number(input.value) || (quickCount + 1))));
        input.value = String(next);
        onChange(next);
    };

    const handlePlusClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        if (value <= quickCount) {
            onChange(quickCount + 1);
        } else if (value < max) {
            onChange(value + 1);
        }
    };

    return (
        <label
            className="group flex h-8 items-center overflow-hidden rounded-full px-1.5 text-xs transition-colors cursor-pointer select-none"
            style={{
                background: isCustom ? theme.toolbar.activeBg : theme.toolbar.itemHover,
                color: theme.node.text,
            }}
            onClick={() => {
                if (value <= quickCount) {
                    onChange(Math.min(max, quickCount + 1));
                }
            }}
        >
            <span
                onClick={handlePlusClick}
                className="grid size-4 place-items-center rounded-full hover:bg-black/15 dark:hover:bg-white/15 transition-colors shrink-0"
                title="增加生成数量"
            >
                <Plus className="size-3" style={{ color: isCustom ? theme.accent.primary : "inherit" }} />
            </span>
            <input
                key={isCustom ? `custom-${value}` : "quick"}
                type="number"
                min={1}
                max={max}
                aria-label="自定义生成张数"
                placeholder={isCustom ? String(value) : "+"}
                className="min-w-0 flex-1 bg-transparent px-0.5 text-center outline-none placeholder:text-current placeholder:opacity-75 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none font-semibold text-xs"
                style={{ color: theme.node.text, WebkitTextFillColor: theme.node.text }}
                defaultValue={isCustom ? value : ""}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={(event) => {
                    if (event.currentTarget.value) commit(event.currentTarget);
                }}
                onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                }}
                onMouseDown={(event) => event.stopPropagation()}
            />
        </label>
    );
}

function SettingTitle({ children, color }: { children: string; color: string }) {
    return (
        <div className="text-xs font-medium" style={{ color }}>
            {children}
        </div>
    );
}
