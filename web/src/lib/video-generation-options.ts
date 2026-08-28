export const VIDEO_DURATION_OPTIONS = [6, 9, 10, 15] as const;
export const VIDEO_RESOLUTION_OPTIONS = [480, 720, 1080, 1440, 2160] as const;
export const VIDEO_RESOLUTION_CAPABILITY_OPTIONS = VIDEO_RESOLUTION_OPTIONS.map((value) => `${value}p`);
export const VIDEO_DURATION_MIN = 1;

export function normalizeVideoDuration(value: string | number | undefined) {
    const seconds = Math.floor(Number(value) || VIDEO_DURATION_OPTIONS[0]);
    return String(Math.max(VIDEO_DURATION_MIN, seconds));
}

export function normalizeVideoResolution(value: string | number | undefined) {
    const raw = String(value || "").trim();
    const token = raw.toLowerCase();
    if (!token) return "";
    if (token === "low") return "480";
    if (token === "auto" || token === "medium" || token === "high") return "720";
    if (token === "2k" || token === "1440" || token === "1440p") return "2k";
    if (token === "4k" || token === "2160" || token === "2160p") return "4k";
    const resolution = Number(token.replace(/p$/i, ""));
    if (Number.isFinite(resolution) && resolution > 0) return String(Math.floor(resolution));
    // Channel-declared values are opaque enums, not necessarily numeric tiers.
    // Preserve them verbatim so values such as `768p竖` remain selectable and
    // can be sent back to the provider without being collapsed to 720p.
    return raw;
}

export function normalizeVideoResolutionValue(value: string | number | undefined): string {
    return normalizeVideoResolution(value) || "720";
}

export function isVideoResolutionMatch(selected: string | undefined, target: string | undefined) {
    const s = String(selected || "").trim().toLowerCase().replace(/p$/i, "");
    const t = String(target || "").trim().toLowerCase().replace(/p$/i, "");
    if (!s && !t) return true;
    if (s === t) return true;
    if ((s === "2k" || s === "1440") && (t === "2k" || t === "1440")) return true;
    if ((s === "4k" || s === "2160") && (t === "4k" || t === "2160")) return true;
    if ((s === "768" || s === "768p") && (t === "768" || t === "768p")) return true;
    if ((s === "1080" || s === "1080p") && (t === "1080" || t === "1080p")) return true;
    if ((s === "720" || s === "720p") && (t === "720" || t === "720p")) return true;
    if ((s === "480" || s === "480p") && (t === "480" || t === "480p")) return true;
    return false;
}

export function videoResolutionComparisonKey(value: string | number | undefined) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const normalized = normalizeVideoResolution(raw);
    return /^\d+$/.test(normalized) ? `${normalized}p` : normalized.toLowerCase();
}

export function formatVideoResolutionLabel(value: string | number | undefined) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const normalized = normalizeVideoResolution(raw);
    if (normalized.toLowerCase() === "2k" || normalized === "1440") return "2K";
    if (normalized.toLowerCase() === "4k" || normalized === "2160") return "4K";
    if (/^\d+$/.test(normalized)) return `${normalized}P`;
    return normalized.replace(/^(\\d+)p/i, "$1P");
}
