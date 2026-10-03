/**
 * Sampled acoustic piano (Salamander Grand Piano, CC-BY 3.0, Alexander Holm).
 *
 * One recording every minor third from C2 to C6 is stored in /audio/piano/ as Ogg Opus
 * and AAC (m4a). The browser gets the format it can decode (Opus preferred, the other one
 * tried on failure), and notes in between are pitch-shifted from the nearest sample via
 * playbackRate (never more than one semitone away inside the range).
 * Until the samples are decoded, or if they can't be, notes go to a fallback voice.
 *
 * (ES) Piano sampleado. Se elige el formato que el navegador decodifica (Opus primero,
 * AAC como alternativa) y las notas intermedias se transponen desde el sample más cercano.
 */
import { noteToMidi } from './notes';

export type PianoBus = 'harmony' | 'melody' | 'live';
export type PianoStatus = 'idle' | 'loading' | 'ready' | 'failed';
export type PianoFormat = 'ogg' | 'm4a';

/** File names of the sampled notes (tone.js naming: "Ds" = D#, "Fs" = F#). */
export const PIANO_SAMPLE_FILES = ['C', 'Ds', 'Fs', 'A']
    .flatMap(n => [2, 3, 4, 5].map(o => `${n}${o}`))
    .concat('C6');

const fileToMidi = (file: string): number => noteToMidi(file.replace('s', '#'))!;

export const PIANO_SAMPLE_BASE_URL = '/audio/piano/';

/** Most simultaneous voices before the oldest one is stolen. */
export const MAX_VOICES = 40;
/** Release (damper) time constant when a key is let go. */
const RELEASE_TAU = 0.09;
/** Fast fade used when a voice is stolen or the transport stops. */
const STEAL_TAU = 0.012;
const ATTACK = 0.004;

/** Fallback voice used while samples are missing: (midi, time, velocity, duration seconds). */
export type PianoFallback = (midi: number, time: number, velocity: number, duration: number) => void;

/**
 * Picks the sample to play `midi` from and the playbackRate that transposes it.
 * Ties prefer the sample above (transposing down keeps the attack natural).
 */
export function pickSample(midi: number, available: readonly number[]): { sample: number; rate: number } | null {
    if (available.length === 0) return null;
    let sample = available[0];
    for (const candidate of available) {
        const d = Math.abs(candidate - midi);
        const best = Math.abs(sample - midi);
        if (d < best || (d === best && candidate > sample)) sample = candidate;
    }
    return { sample, rate: Math.pow(2, (midi - sample) / 12) };
}

/** Velocity (0-1) -> peak gain. Curved so soft notes are clearly softer. */
export const velocityToGain = (velocity: number): number => {
    const v = Math.min(1, Math.max(0, velocity));
    return 0.08 + 0.92 * Math.pow(v, 1.6);
};

/** Velocity (0-1) -> lowpass cutoff: soft notes sound slightly darker, like a real hammer. */
export const velocityToCutoff = (velocity: number): number => {
    const v = Math.min(1, Math.max(0, velocity));
    return 1400 * Math.pow(2, v * 3.8);
};

type CanPlay = (mime: string) => string;

const defaultCanPlay: CanPlay = (mime) => {
    try {
        return typeof document !== 'undefined' ? document.createElement('audio').canPlayType(mime) : '';
    } catch {
        return '';
    }
};

/** Formats to try, best first: Opus when the browser says it can play it, else AAC first. */
export function preferredFormats(canPlay: CanPlay = defaultCanPlay): PianoFormat[] {
    const opus = canPlay('audio/ogg; codecs="opus"');
    const aac = canPlay('audio/mp4; codecs="mp4a.40.2"');
    if (opus) return ['ogg', 'm4a'];
    if (aac) return ['m4a', 'ogg'];
    return ['ogg', 'm4a'];
}

async function fetchAndDecode(context: BaseAudioContext, url: string): Promise<AudioBuffer> {
    const baseUrl = typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null' ? window.location.origin : 'http://localhost';
    const response = await fetch(new URL(url, baseUrl).href);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return context.decodeAudioData(await response.arrayBuffer());
}

/** Decodes one note, trying each format in order. Null when none works. */
export async function loadPianoNote(context: BaseAudioContext, file: string, formats: readonly PianoFormat[]): Promise<AudioBuffer | null> {
    for (const format of formats) {
        try {
            return await fetchAndDecode(context, `${PIANO_SAMPLE_BASE_URL}${file}.${format}`);
        } catch {
            // Try the next format.
        }
    }
    return null;
}

const cache = new WeakMap<BaseAudioContext, Promise<Map<number, AudioBuffer>>>();

/** Downloads and decodes every piano note once per AudioContext. */
export function loadPianoSamples(context: BaseAudioContext, formats: readonly PianoFormat[] = preferredFormats()): Promise<Map<number, AudioBuffer>> {
    let pending = cache.get(context);
    if (!pending) {
        pending = Promise.all(PIANO_SAMPLE_FILES.map(f => loadPianoNote(context, f, formats))).then(buffers => {
            const map = new Map<number, AudioBuffer>();
            buffers.forEach((b, i) => { if (b) map.set(fileToMidi(PIANO_SAMPLE_FILES[i]), b); });
            if (map.size === 0) {
                console.error('Piano samples could not be loaded; using the synthesized fallback');
                if (cache.get(context) === pending) cache.delete(context); // let a later call retry
            }
            return map;
        }, error => {
            if (cache.get(context) === pending) cache.delete(context);
            throw error;
        });
        cache.set(context, pending);
    }
    return pending;
}

interface Voice {
    id: number;
    midi: number;
    bus: PianoBus;
    source: AudioBufferSourceNode;
    env: GainNode;
    peak: number;
    start: number;
    released: boolean;
}

export class PianoSampler {
    private context: BaseAudioContext;
    private output: GainNode;
    private buses: Record<PianoBus, GainNode>;
    private buffers: Map<number, AudioBuffer> | null = null;
    private sampleMidis: number[] = [];
    private voices = new Map<number, Voice>();
    private nextId = 1;
    private loading: Promise<boolean> | null = null;
    private statusListeners = new Set<(status: PianoStatus) => void>();
    private disposed = false;
    private fallback: PianoFallback | null;
    public status: PianoStatus = 'idle';

    constructor(context: BaseAudioContext, fallback: PianoFallback | null = null) {
        this.context = context;
        this.fallback = fallback;
        this.output = context.createGain();
        this.output.connect(context.destination);
        const bus = () => {
            const g = context.createGain();
            g.connect(this.output);
            return g;
        };
        this.buses = { harmony: bus(), melody: bus(), live: bus() };
        this.buses.harmony.gain.value = 0.6;
    }

    public connect(node: AudioNode) {
        this.output.disconnect();
        this.output.connect(node);
    }

    /** Volume of the accompaniment bus (shares the harmony volume slider). */
    public setHarmonyVolume(volume: number) {
        this.buses.harmony.gain.value = Math.min(1.5, Math.max(0, volume * 2));
    }

    public onStatusChange(listener: (status: PianoStatus) => void): () => void {
        this.statusListeners.add(listener);
        return () => this.statusListeners.delete(listener);
    }

    private setStatus(status: PianoStatus) {
        this.status = status;
        this.statusListeners.forEach(l => l(status));
    }

    /** Starts loading the samples (idempotent). Resolves true when the real piano is available. */
    public load(): Promise<boolean> {
        if (!this.loading) {
            this.setStatus('loading');
            this.loading = loadPianoSamples(this.context).then(
                map => {
                    if (this.disposed) return false;
                    this.buffers = map;
                    this.sampleMidis = Array.from(map.keys()).sort((a, b) => a - b);
                    if (map.size === 0) this.loading = null; // allow a retry later
                    this.setStatus(map.size > 0 ? 'ready' : 'failed');
                    return map.size > 0;
                },
                () => {
                    this.loading = null;
                    this.setStatus('failed');
                    return false;
                },
            );
        }
        return this.loading;
    }

    public get isReady(): boolean {
        return this.status === 'ready';
    }

    public get activeVoiceCount(): number {
        return this.voices.size;
    }

    /**
     * Starts a note at `time`. Returns a voice id for noteOff, or null when the fallback
     * voice played it (fixed length, nothing to release).
     */
    public noteOn(midi: number, time: number, velocity: number, bus: PianoBus = 'live', fallbackDuration = 1.2): number | null {
        const picked = this.buffers ? pickSample(midi, this.sampleMidis) : null;
        if (!picked) {
            if (this.status === 'idle') void this.load();
            this.fallback?.(midi, time, velocity, fallbackDuration);
            return null;
        }

        if (this.voices.size >= MAX_VOICES) this.stealOldest(time);

        const ctx = this.context;
        const source = ctx.createBufferSource();
        source.buffer = this.buffers!.get(picked.sample)!;
        source.playbackRate.value = picked.rate;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = velocityToCutoff(velocity);
        filter.Q.value = 0.5;

        // A note asked for a moment ago starts now: ramps can't be scheduled in the past.
        const start = Math.max(time, ctx.currentTime);
        const env = ctx.createGain();
        const peak = velocityToGain(velocity);
        env.gain.setValueAtTime(0, start);
        env.gain.linearRampToValueAtTime(peak, start + ATTACK);

        source.connect(filter);
        filter.connect(env);
        env.connect(this.buses[bus]);

        const id = this.nextId++;
        const voice: Voice = { id, midi, bus, source, env, peak, start, released: false };
        this.voices.set(id, voice);
        source.addEventListener('ended', () => {
            this.voices.delete(id);
            source.disconnect();
            filter.disconnect();
            env.disconnect();
        }, { once: true });
        source.start(start);
        return id;
    }

    /** Lifts the key: the damper fades the voice out. */
    public noteOff(id: number | null, time: number, tau = RELEASE_TAU) {
        if (id === null) return;
        const voice = this.voices.get(id);
        if (!voice || voice.released) return;
        voice.released = true;
        const param = voice.env.gain;
        const at = Math.max(time, this.context.currentTime);
        if (typeof param.cancelAndHoldAtTime === 'function') {
            param.cancelAndHoldAtTime(at);
        } else {
            param.cancelScheduledValues(at);
            // Hold the level the envelope has reached at `at` (it may still be in the attack).
            const level = at <= voice.start ? 0 : at >= voice.start + ATTACK ? voice.peak : voice.peak * ((at - voice.start) / ATTACK);
            param.setValueAtTime(level, at);
        }
        param.setTargetAtTime(0, at, tau);
        try {
            voice.source.stop(at + tau * 8);
        } catch {
            // Already stopped.
        }
    }

    /** Schedules a whole note (accompaniment and melody playback). */
    public play(midi: number, time: number, velocity: number, duration: number, bus: PianoBus) {
        const id = this.noteOn(midi, time, velocity, bus, duration);
        if (id !== null) this.noteOff(id, time + Math.max(0.05, duration));
    }

    private stealOldest(time: number) {
        // Map keeps insertion order: the first non-released voice is the oldest one still ringing.
        let victim: Voice | undefined;
        for (const v of this.voices.values()) {
            if (!v.released) { victim = v; break; }
        }
        victim ??= this.voices.values().next().value;
        if (!victim) return;
        this.noteOff(victim.id, time, STEAL_TAU);
        this.voices.delete(victim.id);
    }

    /** Cuts every scheduled or ringing voice of the given buses (all by default). */
    public silence(buses: readonly PianoBus[] = ['harmony', 'melody', 'live']) {
        const now = this.context.currentTime;
        for (const voice of Array.from(this.voices.values())) {
            if (!buses.includes(voice.bus)) continue;
            voice.released = false; // force a fresh fade even if a release was scheduled
            this.noteOff(voice.id, now, STEAL_TAU);
            this.voices.delete(voice.id);
        }
    }

    public dispose() {
        this.disposed = true;
        this.silence();
        this.statusListeners.clear();
        this.output.disconnect();
    }
}
