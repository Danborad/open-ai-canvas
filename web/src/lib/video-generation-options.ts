export const VIDEO_DURATION_OPTIONS = [6, 9, 10, 15] as const;
export const VIDEO_RESOLUTION_OPTIONS = [480, 720, 1080, 1440, 2160] as const;
export const VIDEO_RESOLUTION_CAPABILITY_OPTIONS = VIDEO_RESOLUTION_OPTIONS.map((value) => `${value}p`);
export const VIDEO_DURATION_MIN = 1;

export function normalizeVideoDuration(value: string | number | undefined) {
    const seconds = Math.floor(Number(value) || VIDEO_DURATION_OPTIONS[0]);
    return String(Math.max(VIDEO_DURATION_MIN, seconds));
}

export function normalizeVideoResolution(value: string | number | undefined) {
    const token = String(value || "").trim().toLowerCase();
    if (!token) return "";
    if (token === "low") return "480p";
    if (token === "auto" || token === "medium" || token === "high") return "720p";
    if (token === "2k" || token === "1440" || token === "1440p") return "2k";
    if (token === "4k" || token === "2160" || token === "2160p") return "4k";
    if (token.endsWith("p")) return token;
    const resolution = Number(token);
    return Number.isFinite(resolution) && resolution > 0 ? `${Math.floor(resolution)}p` : token;
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
