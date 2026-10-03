/**
 * Sample loading shared by every DrumSynthesizer on the same AudioContext.
 * AudioBuffers are immutable once decoded and can be played by any number of
 * source nodes, so each file is downloaded and decoded once per context, not
 * once per Scheduler (StrictMode used to do it twice on every mount).
 *
 * (ES) Carga de samples compartida: se descarga y decodifica una sola vez por contexto.
 */

const SAMPLE_ASSETS: { name: string; base: string }[] = [
    { name: 'kick', base: '/audio/kick' },
    { name: 'snare', base: '/audio/snare' },
    { name: 'hihat', base: '/audio/hihat' },
    { name: 'hihat-open', base: '/audio/hihat-open' },
    { name: 'ride', base: '/audio/ride' },
    { name: 'surdo', base: '/audio/surdo' },
    { name: 'tom_high', base: '/audio/tom1' },
    { name: 'tom_low', base: '/audio/tom2' },
    { name: 'tom_floor', base: '/audio/tom3' },
    { name: 'bombo_parche_raw', base: '/audio/bombo_parche' },
    { name: 'bombo_aro_raw', base: '/audio/bombo_aro' },
    { name: 'caja_raw', base: '/audio/caja' },
    { name: 'cajon_raw', base: '/audio/cajon' },
    { name: 'palmas_raw', base: '/audio/palmas' },
    { name: 'shaker_real_raw', base: '/audio/shaker_real' },
    { name: 'clave_raw', base: '/audio/clave' },
    { name: 'candombe_chico_raw', base: '/audio/candombe_chico' },
    { name: 'candombe_repique_raw', base: '/audio/candombe_repique' },
    { name: 'candombe_piano_raw', base: '/audio/candombe_piano' }
];

/** Raw recordings are trimmed to the attack (first sample above `threshold`) and shortened. */
const TRIMS: { from: string; to: string; threshold: number; seconds: number }[] = [
    { from: 'bombo_parche_raw', to: 'bombo_parche', threshold: 0.02, seconds: 0.8 },
    { from: 'bombo_aro_raw', to: 'bombo_aro', threshold: 0.02, seconds: 0.25 },
    { from: 'caja_raw', to: 'caja', threshold: 0.02, seconds: 0.8 },
    { from: 'cajon_raw', to: 'cajon', threshold: 0.02, seconds: 0.8 },
    { from: 'palmas_raw', to: 'palmas', threshold: 0.02, seconds: 0.4 },
    { from: 'shaker_real_raw', to: 'shaker_real', threshold: 0.01, seconds: 0.3 },
    { from: 'clave_raw', to: 'clave', threshold: 0.02, seconds: 0.3 },
    { from: 'candombe_chico_raw', to: 'candombe_chico', threshold: 0.02, seconds: 0.5 },
    { from: 'candombe_repique_raw', to: 'candombe_repique', threshold: 0.02, seconds: 0.5 },
    { from: 'candombe_piano_raw', to: 'candombe_piano', threshold: 0.02, seconds: 0.8 },
];

const cache = new WeakMap<BaseAudioContext, Promise<Map<string, AudioBuffer>>>();

type SampleFormat = 'ogg' | 'm4a';

/**
 * Every sample ships as Opus-in-Ogg (smallest) and AAC-in-MP4 (old iOS Safari cannot
 * decode Ogg). Each device downloads only the format it can play, so the preferred
 * one is picked once; the other is the fallback if a file fails to load or decode.
 */
function sampleFormats(): SampleFormat[] {
    if (typeof Audio === 'undefined') return ['ogg', 'm4a'];
    try {
        const probe = new Audio();
        if (probe.canPlayType('audio/ogg; codecs="opus"') !== '') return ['ogg', 'm4a'];
        if (probe.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== '') return ['m4a', 'ogg'];
    } catch {
        // fall through to the default order
    }
    return ['ogg', 'm4a'];
}

async function fetchAndDecode(context: BaseAudioContext, url: string): Promise<AudioBuffer> {
    const baseUrl = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost';
    const response = await fetch(new URL(url, baseUrl).href);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await context.decodeAudioData(await response.arrayBuffer());
}

async function loadSample(context: BaseAudioContext, base: string, formats: SampleFormat[]): Promise<AudioBuffer | null> {
    for (const format of formats) {
        const url = `${base}.${format}`;
        try {
            return await fetchAndDecode(context, url);
        } catch (e) {
            console.error(`Failed to load sample ${url}`, e);
        }
    }
    // The synthesizer falls back to its synthesized voice for this instrument.
    return null;
}

export function trimBuffer(context: BaseAudioContext, buffer: AudioBuffer, threshold: number, durationSec: number): AudioBuffer {
    const sampleRate = buffer.sampleRate;
    const numChannels = buffer.numberOfChannels;
    const trimLength = Math.min(buffer.length, Math.floor(durationSec * sampleRate));
    const decayStart = Math.floor(trimLength * 0.75);

    // Find peak index in first channel
    const firstChanData = buffer.getChannelData(0);
    let peakIndex = 0;
    for (let i = 0; i < firstChanData.length; i++) {
        if (Math.abs(firstChanData[i]) > threshold) {
            peakIndex = i;
            break;
        }
    }

    const trimmedBuffer = context.createBuffer(numChannels, trimLength, sampleRate);

    for (let ch = 0; ch < numChannels; ch++) {
        const srcData = buffer.getChannelData(ch);
        const dstData = trimmedBuffer.getChannelData(ch);
        
        for (let i = 0; i < trimLength; i++) {
            const srcIdx = peakIndex + i;
            if (srcIdx < srcData.length) {
                dstData[i] = srcData[srcIdx];
            } else {
                dstData[i] = 0;
            }

            if (i > decayStart) {
                const decayProgress = (i - decayStart) / (trimLength - decayStart);
                dstData[i] *= Math.exp(-decayProgress * 4.0);
            }
        }
    }

    return trimmedBuffer;
}

/**
 * Removes leading near-silence (|x| < threshold across all channels), capped at `maxSeconds`.
 * Guards against decoders that keep AAC encoder priming (~44 ms) instead of honouring the
 * file's edit list: a drum hit must land on the grid, not a few tens of ms late.
 * Returns the same buffer when there is nothing to strip.
 */
export function stripLeadingSilence(context: BaseAudioContext, buffer: AudioBuffer, threshold = 0.001, maxSeconds = 0.05): AudioBuffer {
    const maxSkip = Math.min(buffer.length - 1, Math.floor(maxSeconds * buffer.sampleRate));
    const channels: Float32Array[] = [];
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) channels.push(buffer.getChannelData(ch));
    let skip = 0;
    while (skip < maxSkip && channels.every(data => Math.abs(data[skip]) < threshold)) skip++;
    if (skip === 0) return buffer;

    const out = context.createBuffer(buffer.numberOfChannels, buffer.length - skip, buffer.sampleRate);
    channels.forEach((data, ch) => out.getChannelData(ch).set(data.subarray(skip)));
    return out;
}

/** Adds the trimmed versions of the raw recordings present in `buffers`. */
export function addTrimmedSamples(context: BaseAudioContext, buffers: Map<string, AudioBuffer>): void {
    TRIMS.forEach(({ from, to, threshold, seconds }) => {
        const raw = buffers.get(from);
        if (raw) buffers.set(to, trimBuffer(context, raw, threshold, seconds));
    });
}

/** Downloads, decodes and trims every sample once per AudioContext. */
export function loadSamples(context: BaseAudioContext): Promise<Map<string, AudioBuffer>> {
    let pending = cache.get(context);
    if (!pending) {
        pending = (async () => {
            const buffers = new Map<string, AudioBuffer>();
            const formats = sampleFormats();
            const decoded = await Promise.all(SAMPLE_ASSETS.map(a => loadSample(context, a.base, formats)));
            decoded.forEach((buffer, i) => {
                if (!buffer) return;
                const { name } = SAMPLE_ASSETS[i];
                // Raw recordings are aligned to their attack by trimBuffer instead.
                buffers.set(name, name.endsWith('_raw') ? buffer : stripLeadingSilence(context, buffer));
            });
            addTrimmedSamples(context, buffers);
            return buffers;
        })();
        cache.set(context, pending);
    }
    return pending;
}
