import type { ChannelId } from '../instrumentChannels';
import type { VoiceHost } from './types';
import { scheduleFilter } from './filterSetup';

/** Rock kick: sine sweep with exponential amplitude decay. */
export function synthKick(host: VoiceHost, time: number, velocity: number): void {
    const osc = host.context.createOscillator();
    const gain = host.getGain();

    osc.connect(gain);
    host.connectVoiceToChannel(gain, 'kick');

    // Frequency sweep (50Hz -> 0Hz)
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);

    // Amplitude envelope
    gain.gain.setValueAtTime(velocity, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

    osc.onended = () => {
        host.releaseGain(gain);
    };

    host.startVoice(osc, time);
    osc.stop(time + 0.5);
}

/** Tom with a fast pitch drop; `pitch` is the starting frequency in Hz. */
export function synthTom(host: VoiceHost, time: number, velocity: number, pitch: number, channel: ChannelId): void {
    const osc = host.context.createOscillator();
    const gain = host.getGain();

    osc.connect(gain);
    host.connectVoiceToChannel(gain, channel);

    // Pitch Drop - Faster and deeper for "dry" sound
    osc.frequency.setValueAtTime(pitch, time);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.2, time + 0.15); // Faster drop

    // Volume Envelope - Very short sustain
    gain.gain.setValueAtTime(velocity, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15); // Reduced boominess

    osc.onended = () => {
        host.releaseGain(gain);
    };

    host.startVoice(osc, time);
    osc.stop(time + 0.25);
}

/** Deep, muffled samba surdo. */
export function synthSurdo(host: VoiceHost, time: number, velocity: number): void {
    const osc = host.context.createOscillator();
    const gain = host.getGain();

    osc.connect(gain);
    host.connectVoiceToChannel(gain, 'bombo');

    // Deep/Muffled
    osc.frequency.setValueAtTime(45, time);
    osc.frequency.exponentialRampToValueAtTime(35, time + 0.3);

    gain.gain.setValueAtTime(velocity, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);

    osc.onended = () => host.releaseGain(gain);

    host.startVoice(osc, time);
    osc.stop(time + 0.45);
}

/** Rock snare: tonal body plus (optionally) highpassed noise. */
export function synthSnare(host: VoiceHost, time: number, velocity: number, snaresOn: boolean): void {
    // 1. Tonal component (Body)
    const osc = host.context.createOscillator();
    const oscGain = host.getGain();
    osc.connect(oscGain);
    host.connectVoiceToChannel(oscGain, 'snare');

    // Less extreme pitch difference for OFF, just slightly tighter
    const basePitch = snaresOn ? 250 : 280;
    osc.frequency.setValueAtTime(basePitch, time);
    osc.frequency.exponentialRampToValueAtTime(basePitch * 0.5, time + 0.15);

    oscGain.gain.setValueAtTime(velocity * 0.6, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + (snaresOn ? 0.2 : 0.15));

    osc.onended = () => host.releaseGain(oscGain);
    host.startVoice(osc, time);
    osc.stop(time + 0.25);

    // 2. Noise component (Snares)
    if (snaresOn && host.noiseBuffer) {
        const noise = host.context.createBufferSource();
        noise.buffer = host.noiseBuffer;
        const noiseFilter = host.getFilter();
        noiseFilter.type = 'highpass';
        scheduleFilter(noiseFilter, time, 1000);
        const noiseGain = host.getGain();

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        host.connectVoiceToChannel(noiseGain, 'snare');

        noiseGain.gain.setValueAtTime(velocity * 0.8, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.25);

        noise.onended = () => {
            host.releaseFilter(noiseFilter);
            host.releaseGain(noiseGain);
        };

        host.startVoice(noise, time);
        noise.stop(time + 0.25);
    }
}

/** Metronome click; accented (higher pitch) above 0.8 velocity. */
export function synthClick(host: VoiceHost, time: number, velocity: number): void {
    const osc = host.context.createOscillator();
    const gain = host.getGain();

    osc.connect(gain);
    host.connectVoiceToChannel(gain, 'click');

    // Fixed velocity threshold for pitch differentiation
    const forte = velocity > 0.8;
    const pitch = forte ? 1500 : 800;
    osc.frequency.setValueAtTime(pitch, time);

    gain.gain.setValueAtTime(velocity, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + (forte ? 0.08 : 0.05));

    osc.onended = () => host.releaseGain(gain);
    host.startVoice(osc, time);
    osc.stop(time + 0.1);
}
