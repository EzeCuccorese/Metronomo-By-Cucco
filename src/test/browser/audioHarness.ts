/**
 * Helpers for the Vitest browser project: the engine runs on a real (offline) Web Audio graph in
 * Chromium and the tests measure the rendered samples, instead of asserting calls on mocks.
 */
import { vi } from 'vitest';
import AudioContextManager from '../../audio/AudioContextManager';

export const SAMPLE_RATE = 48000;
/** Frames between scheduler wake-ups while rendering (a multiple of the 128-frame render quantum). */
const TICK_FRAMES = 1024;

/**
 * Makes the engine's AudioContext singleton an OfflineAudioContext of `seconds` length.
 * Every test needs its own context: an offline context renders only once.
 */
export function createOfflineContext(seconds: number, sampleRate = SAMPLE_RATE): OfflineAudioContext {
    const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
    // AudioContextManager does `new window.AudioContext(...)`; a constructor returning an object yields that object.
    vi.stubGlobal('AudioContext', function FakeAudioContext() {
        return ctx;
    });
    (AudioContextManager as unknown as { instance?: AudioContextManager }).instance = undefined;
    return ctx;
}

/** Undoes createOfflineContext(): the global constructor and the engine singleton go back to normal. */
export function restoreAudioContext(): void {
    vi.unstubAllGlobals();
    (AudioContextManager as unknown as { instance?: AudioContextManager }).instance = undefined;
}

/**
 * Renders the context, pausing every few milliseconds of audio time so `onTick(time)` can schedule
 * events exactly like the Worker clock does in real time (the lookahead scheduler reads `currentTime`).
 */
export async function render(ctx: OfflineAudioContext, onTick?: (time: number) => void): Promise<RenderedAudio> {
    // An error thrown by onTick must not leave the context suspended (startRendering would hang): resume
    // anyway, skip the remaining ticks and rethrow once the render ends.
    let tickError: unknown = null;
    if (onTick) {
        for (let frame = 0; frame < ctx.length; frame += TICK_FRAMES) {
            const time = frame / ctx.sampleRate;
            void ctx.suspend(time).then(async () => {
                try {
                    if (tickError === null) onTick(time);
                } catch (error) {
                    tickError = error ?? new Error('onTick failed');
                } finally {
                    await ctx.resume();
                }
            });
        }
    }
    const buffer = await ctx.startRendering();
    if (tickError !== null) throw tickError;
    return new RenderedAudio(buffer);
}

export interface Onset {
    /** Seconds from the start of the render. */
    time: number;
    /** Peak absolute amplitude within `windowSeconds` after the onset. */
    peak: number;
}

export class RenderedAudio {
    readonly sampleRate: number;
    /** Left + right mixed to mono (the engine pans nothing by default, so this equals either channel). */
    readonly samples: Float32Array;

    constructor(buffer: AudioBuffer) {
        this.sampleRate = buffer.sampleRate;
        const left = buffer.getChannelData(0);
        const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
        this.samples = new Float32Array(left.length);
        for (let i = 0; i < left.length; i++) this.samples[i] = (left[i] + right[i]) / 2;
    }

    /** Peak absolute amplitude in [from, to) seconds. */
    peak(from: number, to: number): number {
        const a = Math.max(0, Math.floor(from * this.sampleRate));
        const b = Math.min(this.samples.length, Math.floor(to * this.sampleRate));
        let max = 0;
        for (let i = a; i < b; i++) max = Math.max(max, Math.abs(this.samples[i]));
        return max;
    }

    /** Peak over the whole render. */
    get maxPeak(): number {
        return this.peak(0, this.samples.length / this.sampleRate);
    }

    /**
     * Finds sound onsets: the first sample above `threshold` after at least `quietSeconds` below it.
     * (Two events closer than `quietSeconds` count as one onset.)
     */
    onsets({ threshold = 0.002, quietSeconds = 0.06, windowSeconds = 0.05 } = {}): Onset[] {
        const quiet = Math.floor(quietSeconds * this.sampleRate);
        const found: Onset[] = [];
        let lastLoud = -Infinity;
        for (let i = 0; i < this.samples.length; i++) {
            if (Math.abs(this.samples[i]) < threshold) continue;
            if (i - lastLoud > quiet) {
                const time = i / this.sampleRate;
                found.push({ time, peak: this.peak(time, time + windowSeconds) });
            }
            lastLoud = i;
        }
        return found;
    }
}

/** Frames of tolerance expressed in seconds (onsets must land within a few samples of the schedule). */
export const frames = (n: number, sampleRate = SAMPLE_RATE) => n / sampleRate;
