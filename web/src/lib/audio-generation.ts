export interface AudioVoiceOption {
    value: string;
    label: string;
    zh: string;
    en: string;
    description: string;
}

export const audioVoiceOptions: AudioVoiceOption[] = [
    { value: "alloy", label: "合金 (alloy)", zh: "合金", en: "alloy", description: "中性均衡，泛用亲和" },
    { value: "ash", label: "烟灰 (ash)", zh: "烟灰", en: "ash", description: "低沉沉稳，纪实质感" },
    { value: "ballad", label: "歌谣 (ballad)", zh: "歌谣", en: "ballad", description: "温暖抒情，故事叙事" },
    { value: "coral", label: "珊瑚 (coral)", zh: "珊瑚", en: "coral", description: "温和亲切，自然柔和" },
    { value: "echo", label: "回声 (echo)", zh: "回声", en: "echo", description: "浑厚磁性，演讲播音" },
    { value: "fable", label: "寓言 (fable)", zh: "寓言", en: "fable", description: "生动活泼，剧情童话" },
    { value: "nova", label: "新星 (nova)", zh: "新星", en: "nova", description: "热情明朗，活力感染" },
    { value: "onyx", label: "玛瑙 (onyx)", zh: "玛瑙", en: "onyx", description: "深沉严谨，专业稳重" },
    { value: "sage", label: "贤者 (sage)", zh: "贤者", en: "sage", description: "睿智知性，从容学者" },
    { value: "shimmer", label: "微光 (shimmer)", zh: "微光", en: "shimmer", description: "清澈空灵，柔美抒情" },
    { value: "verse", label: "诗韵 (verse)", zh: "诗韵", en: "verse", description: "诗意韵律，动态表现" },
    { value: "marin", label: "海滨 (marin)", zh: "海滨", en: "marin", description: "自然随和，现代清新" },
    { value: "cedar", label: "雪松 (cedar)", zh: "雪松", en: "cedar", description: "温厚大气，稳重深邃" },
];

export const audioFormatOptions = [
    { value: "mp3", label: "MP3" },
    { value: "wav", label: "WAV" },
    { value: "opus", label: "Opus" },
    { value: "aac", label: "AAC" },
    { value: "flac", label: "FLAC" },
    { value: "pcm", label: "PCM" },
];

export function normalizeAudioVoiceValue(value: string) {
    return audioVoiceOptions.some((item) => item.value === value) ? value : "alloy";
}

export function normalizeAudioFormatValue(value: string) {
    return audioFormatOptions.some((item) => item.value === value) ? value : "mp3";
}

export function normalizeAudioSpeedValue(value: string) {
    const speed = Number(value);
    if (!Number.isFinite(speed)) return "1";
    return String(Math.max(0.25, Math.min(4, Number(speed.toFixed(2)))));
}

export function audioVoiceLabel(value: string) {
    const voice = normalizeAudioVoiceValue(value);
    return audioVoiceOptions.find((item) => item.value === voice)?.label || voice;
}

export function audioFormatLabel(value: string) {
    const format = normalizeAudioFormatValue(value);
    return audioFormatOptions.find((item) => item.value === format)?.label || format;
}

export function audioSpeedLabel(value: string) {
    return `${normalizeAudioSpeedValue(value)}x`;
}

export function audioMimeType(format: string) {
    if (format === "wav") return "audio/wav";
    if (format === "opus") return "audio/opus";
    if (format === "aac") return "audio/aac";
    if (format === "flac") return "audio/flac";
    if (format === "pcm") return "audio/pcm";
    return "audio/mpeg";
}
