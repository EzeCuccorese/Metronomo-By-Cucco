import type { ChannelId } from './instrumentChannels';

/**
 * Channels whose meter follows the real audio output (an AnalyserNode on the strip) because
 * their notes are not steps of the rhythm pattern: the harmony pad and the piano.
 * (ES) Canales cuyo medidor sigue el audio real, porque sus notas no son pasos del patrón.
 */
export const ANALYSED_CHANNELS: readonly ChannelId[] = ['synth', 'piano'];

/** Peak absolute amplitude (0..1+) of a block of samples. */
export function peakLevel(samples: ArrayLike<number>): number {
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
        const v = Math.abs(samples[i]);
        if (v > peak) peak = v;
    }
    return peak;
}

/** Maps a raw peak amplitude to a 0..1 meter value (soft boost: musical peaks sit around 0.1-0.4). */
export const meterFromPeak = (peak: number): number => Math.min(1, peak * 3);
