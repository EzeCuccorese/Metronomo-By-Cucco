import type { VoiceHost } from './types';

/** Bombo legüero head hit from the pre-rendered buffer. */
export function synthBomboParche(host: VoiceHost, time: number, velocity: number): void {
    if (!host.bomboBuffer) return;
    const source = host.context.createBufferSource();
    source.buffer = host.bomboBuffer;

    // Dynamic Filter: Mapped to make low velocity sound "muddy" and high velocity "slap"
    const dynamicsFilter = host.getFilter();
    dynamicsFilter.type = 'lowpass';
    // 0.1 vel -> ~200Hz, 1.0 vel -> ~12000Hz (Exponential-ish)
    dynamicsFilter.frequency.value = 150 + (12000 * Math.pow(velocity, 3));

    const gain = host.getGain();

    source.connect(dynamicsFilter);
    dynamicsFilter.connect(gain);
    host.connectVoiceToChannel(gain, 'bombo');

    source.playbackRate.value = 1.0 + ((Math.random() - 0.5) * 0.02); // Tiny pitch jitter
    gain.gain.setValueAtTime(velocity, time);

    source.onended = () => {
        host.releaseFilter(dynamicsFilter);
        host.releaseGain(gain);
    };

    host.startVoice(source, time);
    source.stop(time + 1.0);
}

/** Bombo legüero rim (aro) hit from the pre-rendered buffer. */
export function synthBomboAro(host: VoiceHost, time: number, velocity: number): void {
    if (!host.aroBuffer) return;
    const source = host.context.createBufferSource();
    source.buffer = host.aroBuffer;

    const dynamicsFilter = host.getFilter();
    dynamicsFilter.type = 'lowpass';
    dynamicsFilter.frequency.value = 2000 + (10000 * Math.pow(velocity, 2));

    const gain = host.getGain();
    source.connect(dynamicsFilter);
    dynamicsFilter.connect(gain);
    host.connectVoiceToChannel(gain, 'bombo');

    gain.gain.setValueAtTime(velocity, time);
    source.playbackRate.value = 1.0 + ((Math.random() - 0.5) * 0.04);

    source.onended = () => {
        host.releaseFilter(dynamicsFilter);
        host.releaseGain(gain);
    };

    host.startVoice(source, time);
    source.stop(time + 0.5);
}

/** Clave: noise impulse exciting two narrow bandpass resonances. */
export function synthClave(host: VoiceHost, time: number, velocity: number): void {
    if (!host.noiseBuffer) return;
    if (!host.noiseBuffer) return;

    const impulseSource = host.context.createBufferSource();
    impulseSource.buffer = host.noiseBuffer;

    const impulseGain = host.context.createGain();
    impulseGain.gain.setValueAtTime(0, time);
    impulseGain.gain.linearRampToValueAtTime(velocity * 0.95, time + 0.001);
    impulseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.003); // 3ms impulse excitation

    // Dual bandpass filters in parallel
    const bp1 = host.getFilter();
    bp1.type = 'bandpass';
    bp1.frequency.setValueAtTime(1800, time);
    bp1.Q.setValueAtTime(25.0, time);

    const bp2 = host.getFilter();
    bp2.type = 'bandpass';
    bp2.frequency.setValueAtTime(2200, time);
    bp2.Q.setValueAtTime(25.0, time);

    // Mix gain after filters
    const mixGain1 = host.getGain();
    mixGain1.gain.setValueAtTime(0.7, time);
    mixGain1.gain.exponentialRampToValueAtTime(0.001, time + 0.075); // rapid wood decay

    const mixGain2 = host.getGain();
    mixGain2.gain.setValueAtTime(0.5, time);
    mixGain2.gain.exponentialRampToValueAtTime(0.001, time + 0.055); // high mode decay

    impulseSource.connect(impulseGain);
    
    impulseGain.connect(bp1);
    bp1.connect(mixGain1);
    mixGain1.connect(host.getChannelNode('clave'));

    impulseGain.connect(bp2);
    bp2.connect(mixGain2);
    mixGain2.connect(host.getChannelNode('clave'));

    host.startVoice(impulseSource, time);
    impulseSource.stop(time + 0.08);

    impulseSource.onended = () => {
        host.releaseFilter(bp1);
        host.releaseFilter(bp2);
        host.releaseGain(mixGain1);
        host.releaseGain(mixGain2);
    };
}
