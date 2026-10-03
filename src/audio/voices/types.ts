import type { ChannelId } from '../instrumentChannels';

/**
 * Everything a synthesized voice needs from the engine: the audio context, shared buffers,
 * node pooling, mixer routing and voice tracking. DrumSynthesizer implements it; voices
 * stay plain functions of (host, time, velocity, ...).
 *
 * (ES) Lo que una voz sintetizada necesita del motor.
 */
export interface VoiceHost {
    readonly context: AudioContext;
    /** Shared white-noise buffer; null until created. */
    readonly noiseBuffer: AudioBuffer | null;
    /** Pre-rendered bombo head hit; null until rendering finishes. */
    readonly bomboBuffer: AudioBuffer | null;
    /** Pre-rendered bombo rim hit; null until rendering finishes. */
    readonly aroBuffer: AudioBuffer | null;
    getGain(): GainNode;
    getFilter(): BiquadFilterNode;
    releaseGain(node: GainNode): void;
    releaseFilter(node: BiquadFilterNode): void;
    /** Starts a source node and registers it so silence() can cut it. */
    startVoice(node: AudioScheduledSourceNode, time: number): void;
    /** Connects a voice output to a mixer channel strip (master bus for unknown names). */
    connectVoiceToChannel(voiceNode: AudioNode, channel: ChannelId): void;
    getChannelNode(name: string): AudioNode;
    /** Returns the current shaker direction and flips it for the next hit (push/pull alternation). */
    nextShakerPush(): boolean;
}
