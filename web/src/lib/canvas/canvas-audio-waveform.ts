import { getCachedResourceBlob } from "@/services/resource-blob-cache";
import { resolveAudioSource, type CanvasAudioSource } from "@/services/canvas-audio-playback";

const waveformMemoryCache = new Map<string, number[]>();
const waveformInFlight = new Map<string, Promise<number[]>>();

export const AUDIO_WAVEFORM_BARS = 36;

/**
 * 从已解码的 AudioBuffer 中提取指定柱数的归一化波形峰值（范围 0.12 ~ 1.0）。
 * 结合峰值（捕捉瞬态辅音/鼓点）与 RMS（反映感知响度），采用 0.7 幂次动态范围缩放，
 * 呈现贴合真实人声起伏的波形动画。
 */
export function computeWaveformPeaks(buffer: AudioBuffer, barCount = AUDIO_WAVEFORM_BARS): number[] {
    const channelCount = buffer.numberOfChannels;
    const length = buffer.length;
    if (length === 0 || barCount <= 0) return Array(barCount).fill(0.25);

    const c0 = buffer.getChannelData(0);
    const c1 = channelCount > 1 ? buffer.getChannelData(1) : null;
    const blockSize = Math.max(1, Math.floor(length / barCount));
    const rawPeaks: number[] = [];

    for (let i = 0; i < barCount; i++) {
        const start = i * blockSize;
        const end = Math.min(start + blockSize, length);
        if (start >= length) {
            rawPeaks.push(0);
            continue;
        }
        let peak = 0;
        let sumSquares = 0;
        let sampleCount = 0;
        // 单个采样块限制最多采样 2000 点，大幅加速长音频解析，避免卡顿
        const step = Math.max(1, Math.floor((end - start) / 2000));
        for (let j = start; j < end; j += step) {
            const val = c1 ? (Math.abs(c0[j]) + Math.abs(c1[j])) * 0.5 : Math.abs(c0[j]);
            if (val > peak) peak = val;
            sumSquares += val * val;
            sampleCount++;
        }
        const rms = sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0;
        rawPeaks.push(peak * 0.7 + rms * 0.3);
    }

    const maxPeak = Math.max(...rawPeaks, 0.0001);
    return rawPeaks.map((val) => {
        const normalized = Math.pow(val / maxPeak, 0.7);
        const clamped = 0.12 + 0.88 * normalized;
        return Math.round(clamped * 1000) / 1000;
    });
}

/**
 * 优先从本地 IndexedDB 缓存或网络拉取音频，并通过 Web Audio API 解码得到真实声波轮廓。
 */
export async function loadAudioWaveform(source: CanvasAudioSource, barCount = AUDIO_WAVEFORM_BARS): Promise<number[]> {
    const key = source.storageKey || source.content;
    if (!key) return [];
    if (waveformMemoryCache.has(key)) return waveformMemoryCache.get(key)!;
    const inFlight = waveformInFlight.get(key);
    if (inFlight) return inFlight;

    const promise = (async () => {
        let arrayBuffer: ArrayBuffer | null = null;
        if (source.storageKey) {
            try {
                const blob = await getCachedResourceBlob(source.storageKey);
                if (blob) arrayBuffer = await blob.arrayBuffer();
            } catch {
                // fall back to network fetch
            }
        }
        if (!arrayBuffer) {
            const url = await resolveAudioSource(source);
            if (!url) throw new Error("缺少音频播放地址");
            const response = await fetch(url, { credentials: "include" });
            if (!response.ok) throw new Error(`音频读取失败 (${response.status})`);
            arrayBuffer = await response.arrayBuffer();
        }

        const AudioContextClass = typeof window !== "undefined"
            ? (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
            : undefined;
        if (!AudioContextClass) throw new Error("当前环境不支持 Web Audio API");
        const ctx = new AudioContextClass();
        let buffer: AudioBuffer;
        try {
            buffer = await new Promise<AudioBuffer>((resolve, reject) => {
                ctx.decodeAudioData(arrayBuffer!.slice(0), resolve, reject);
            });
        } finally {
            void ctx.close?.();
        }
        const peaks = computeWaveformPeaks(buffer, barCount);
        waveformMemoryCache.set(key, peaks);
        return peaks;
    })().finally(() => {
        waveformInFlight.delete(key);
    });

    waveformInFlight.set(key, promise);
    return promise;
}
