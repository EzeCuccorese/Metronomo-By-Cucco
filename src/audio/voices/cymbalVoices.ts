import type { VoiceHost } from './types';
import { scheduleFilter } from './filterSetup';

/** Highpassed-noise hi-hat, short when closed and longer when open. */
export function synthHiHat(host: VoiceHost, time: number, velocity: number, open: boolean): void {
    if (!host.noiseBuffer) return;
    const source = host.context.createBufferSource();
    source.buffer = host.noiseBuffer;

    const filter = host.getFilter();
    filter.type = 'highpass';
    scheduleFilter(filter, time, 7000);

    const gain = host.getGain();

    // Envelope: Short for closed, longer for open
    const decay = open ? 0.4 : 0.05; // 400ms vs 50ms

    source.connect(filter);
    filter.connect(gain);
    host.connectVoiceToChannel(gain, 'hihat');

    gain.gain.setValueAtTime(velocity * 0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + decay);

    source.onended = () => {
        host.releaseFilter(filter);
        host.releaseGain(gain);
    };

    host.startVoice(source, time);
    source.stop(time + decay);
}

/** Pedal hi-hat "chick". */
export function synthHiHatFoot(host: VoiceHost, time: number, velocity: number): void {
    if (!host.noiseBuffer) return;
    const source = host.context.createBufferSource();
    source.buffer = host.noiseBuffer;

    const filter = host.getFilter();
    filter.type = 'highpass';
    scheduleFilter(filter, time, 5000); // Lower than stick hit for more "chunk"

    const gain = host.getGain();

    // Very short, definitive chic
    const decay = 0.035;

    source.connect(filter);
    filter.connect(gain);
    host.connectVoiceToChannel(gain, 'hihat');

    gain.gain.setValueAtTime(velocity * 0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + decay);

    source.onended = () => {
        host.releaseFilter(filter);
        host.releaseGain(gain);
    };

    host.startVoice(source, time);
    source.stop(time + decay);
}

/** Crash cymbal: long highpassed noise decay. */
export function synthCrash(host: VoiceHost, time: number, velocity: number): void {
    if (!host.noiseBuffer) return;
    const source = host.context.createBufferSource();
    source.buffer = host.noiseBuffer;

    const filter = host.getFilter();
    filter.type = 'highpass';
    scheduleFilter(filter, time, 2000);

    const gain = host.getGain();

    source.connect(filter);
    filter.connect(gain);
    host.connectVoiceToChannel(gain, 'hihat');

    gain.gain.setValueAtTime(velocity * 0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 1.5); // Long decay

    source.onended = () => {
        host.releaseFilter(filter);
        host.releaseGain(gain);
    };

    host.startVoice(source, time);
    source.stop(time + 1.5);
}

/** Ride cymbal: stick ping, metallic noise wash and a low hum. */
export function synthRide(host: VoiceHost, time: number, velocity: number): void {
    const impact = host.context.createOscillator();
    const impactGain = host.getGain();
    impact.connect(impactGain);
    host.connectVoiceToChannel(impactGain, 'hihat');

    impact.type = 'sine';
    impact.frequency.setValueAtTime(4500, time);

    impactGain.gain.setValueAtTime(velocity * 0.5, time);
    impactGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03); // Very short

    impact.onended = () => host.releaseGain(impactGain);

    host.startVoice(impact, time);
    impact.stop(time + 0.05);

    // B. The "Body" wash - Simulated edge hit using band-pass filtered noise
    const noiseBuffer = host.noiseBuffer;
    if (noiseBuffer) {
        // Multiple band-passes for complex metallic shimmer
        const resonances = [6000, 8500, 11000];
        resonances.forEach((freq, i) => {
            const noise = host.context.createBufferSource();
            noise.buffer = noiseBuffer;

            const filter = host.getFilter();
            filter.type = 'bandpass';
            scheduleFilter(filter, time, freq, 5);

            const noiseGain = host.getGain();

            noise.connect(filter);
            filter.connect(noiseGain);
            host.connectVoiceToChannel(noiseGain, 'hihat');

            // Shimmer envelope
            noiseGain.gain.setValueAtTime(0, time);
            noiseGain.gain.linearRampToValueAtTime(velocity * (0.2 - (i * 0.05)), time + 0.02);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 1.2); // Clean decay

            noise.onended = () => {
                host.releaseFilter(filter);
                host.releaseGain(noiseGain);
            };

            host.startVoice(noise, time);
            noise.stop(time + 1.2);
        });
    }

    // C. Low-frequency metal "hum" (Very subtle, dry)
    const hum = host.context.createOscillator();
    const humGain = host.getGain();
    hum.connect(humGain);
    host.connectVoiceToChannel(humGain, 'hihat');

    hum.type = 'triangle';
    hum.frequency.setValueAtTime(320, time);

    humGain.gain.setValueAtTime(0, time);
    humGain.gain.linearRampToValueAtTime(velocity * 0.1, time + 0.05);
    humGain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

    hum.onended = () => host.releaseGain(humGain);

    host.startVoice(hum, time);
    hum.stop(time + 0.35);
}

/** Shaker/guache: bandpass noise sweep alternating push/pull. */
export function synthShaker(host: VoiceHost, time: number, velocity: number): void {
    if (!host.noiseBuffer) return;
    const source = host.context.createBufferSource();
    source.buffer = host.noiseBuffer;

    const filter = host.getFilter();
    filter.type = 'bandpass';

    // Alternate shaker direction (push/pull) for natural texture
    const isPush = host.nextShakerPush();

    const startFreq = isPush ? 3200 : 4500;
    const endFreq = isPush ? 6400 : 3400;
    const q = isPush ? 2.2 : 1.2;
    const decay = isPush ? 0.045 : 0.095;
    const volumeFactor = isPush ? 0.28 : 0.18;

    // Apply sweeping dynamic bandpass filter
    scheduleFilter(filter, time, startFreq, q);
    filter.frequency.exponentialRampToValueAtTime(endFreq, time + decay);

    const gain = host.getGain();

    source.connect(filter);
    filter.connect(gain);
    host.connectVoiceToChannel(gain, 'shaker');

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(velocity * volumeFactor, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

    source.onended = () => {
        host.releaseFilter(filter);
        host.releaseGain(gain);
    };

    host.startVoice(source, time);
    source.stop(time + decay + 0.02);
}
