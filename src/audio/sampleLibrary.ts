/**
 * Sample loading shared by every DrumSynthesizer on the same AudioContext.
 * AudioBuffers are immutable once decoded and can be played by any number of
 * source nodes, so each file is downloaded and decoded once per context, not
 * once per Scheduler (StrictMode used to do it twice on every mount).
 *
 * (ES) Carga de samples compartida: se descarga y decodifica una sola vez por contexto.
 */

const SAMPLE_ASSETS: { name: string; url: string }[] = [
    { name: 'kick', url: '/audio/kick.wav' },
    { name: 'snare', url: '/audio/snare.wav' },
    { name: 'hihat', url: '/audio/hihat.wav' },
    { name: 'hihat-open', url: '/audio/hihat-open.wav' },
    { name: 'ride', url: '/audio/ride.wav' },
    { name: 'surdo', url: '/audio/surdo.wav' },
    { name: 'tom_high', url: '/audio/tom1.wav' },
    { name: 'tom_low', url: '/audio/tom2.wav' },
    { name: 'tom_floor', url: '/audio/tom3.wav' },
    { name: 'bombo_parche_raw', url: '/audio/bombo_parche.ogg' },
    { name: 'bombo_aro_raw', url: '/audio/bombo_aro.ogg' },
    { name: 'caja_raw', url: '/audio/caja.ogg' },
    { name: 'cajon_raw', url: '/audio/cajon.ogg' },
    { name: 'palmas_raw', url: '/audio/palmas.ogg' },
    { name: 'shaker_real_raw', url: '/audio/shaker_real.ogg' },
    { name: 'clave_raw', url: '/audio/clave.ogg' },
    { name: 'candombe_chico_raw', url: '/audio/candombe_chico.ogg' },
    { name: 'candombe_repique_raw', url: '/audio/candombe_repique.ogg' },
    { name: 'candombe_piano_raw', url: '/audio/candombe_piano.ogg' }
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

async function loadSample(context: BaseAudioContext, url: string): Promise<AudioBuffer | null> {
    try {
        const baseUrl = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost';
        const response = await fetch(new URL(url, baseUrl).href);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await context.decodeAudioData(await response.arrayBuffer());
    } catch (e) {
        // The synthesizer falls back to its synthesized voice for this instrument.
        console.error(`Failed to load sample ${url}`, e);
        return null;
    }
}

export function trimBuffer(context: BaseAudioContext, buffer: AudioBuffer, threshold: number, durationSec: number): AudioBuffer {
    const sampleRate = buffer.sampleRate;
    const numChannels = buffer.numberOfChannels;
    const trimLength = Math.min(buffer.length, Math.floor(durationSec * sampleRate));
    
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
            
            const decayStart = Math.floor(trimLength * 0.75);
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
            const decoded = await Promise.all(SAMPLE_ASSETS.map(a => loadSample(context, a.url)));
            decoded.forEach((buffer, i) => { if (buffer) buffers.set(SAMPLE_ASSETS[i].name, buffer); });
            addTrimmedSamples(context, buffers);
            return buffers;
        })();
        cache.set(context, pending);
    }
    return pending;
}
