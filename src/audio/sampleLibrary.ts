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

/** Every sample ships as Opus-in-Ogg, which every supported browser decodes. */
async function loadSample(context: BaseAudioContext, base: string): Promise<AudioBuffer | null> {
    const url = `${base}.ogg`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await context.decodeAudioData(await response.arrayBuffer());
    } catch (e) {
        console.error(`Failed to load sample ${url}`, e);
        // The synthesizer falls back to its synthesized voice for this instrument.
        return null;
    }
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
            const decoded = await Promise.all(SAMPLE_ASSETS.map(a => loadSample(context, a.base)));
            decoded.forEach((buffer, i) => {
                if (!buffer) return;
                const { name } = SAMPLE_ASSETS[i];
                buffers.set(name, buffer);
            });
            addTrimmedSamples(context, buffers);
            return buffers;
        })();
        cache.set(context, pending);
    }
    return pending;
}
