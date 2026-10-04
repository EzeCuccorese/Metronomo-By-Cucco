import AudioContextManager from './AudioContextManager';
import { CHANNEL_IDS, INSTRUMENT_CHANNEL } from './instrumentChannels';
import type { ChannelId } from './instrumentChannels';
import { meterFromPeak, peakLevel } from './channelLevel';
import { VoiceTracker } from './VoiceTracker';
import { loadSamples } from './sampleLibrary';
import {
    renderBomboAro, renderBomboParche,
    synthBomboAro, synthBomboParche, synthClave, synthClick, synthCrash, synthHiHat,
    synthHiHatFoot, synthKick, synthRide, synthShaker, synthSnare, synthSurdo, synthTom,
} from './voices';
import type { VoiceHost } from './voices';

/**
 * Synthesizes drum sounds using oscillators and noise buffers.
 * Contains logic for Rock drums and Argentine Folklore "Bombo Legüero".
 *
 * (ES) Sintetiza sonidos de batería usando osciladores y buffers de ruido.
 * Contiene lógica para batería de Rock y Bombo Legüero.
 */
class DrumSynthesizer {
    private context: AudioContext;
    private noiseBuffer: AudioBuffer | null = null;
    private masterGain: GainNode;
    private ambienceFilter: BiquadFilterNode;
    private saturator: WaveShaperNode;
    // Transport gains sit between the mixer strips and the outputs so stop() can fade everything at once.
    private drumTransport: GainNode;
    private clickTransport: GainNode;
    private voices = new VoiceTracker();
    private audioBuffers: Map<string, AudioBuffer> = new Map();
    public loadPromise: Promise<void> | null = null;

    // Multi-channel mixer strips
    private channels = {} as Record<ChannelId, { gain: GainNode; panner: StereoPannerNode; analyser: AnalyserNode; originalVolume: number; isMuted: boolean }>;

    private levelBuffer = new Float32Array(0);

    // Node Pools
    private gainPool: GainNode[] = [];
    private filterPool: BiquadFilterNode[] = [];

    // Pre-rendered buffers
    private bomboBuffer: AudioBuffer | null = null;
    private aroBuffer: AudioBuffer | null = null;

    // Shaker push/pull alternating state
    private shakerState: boolean = false;

    // Context handed to the synthesized voices in ./voices
    private readonly host: VoiceHost = this.createVoiceHost();

    constructor() {
        this.context = AudioContextManager.getInstance().getContext();
        this.createNoiseBuffer();
        this.initPreRenderedSounds();
        this.loadPromise = this.loadAssets();

        // Initialize Master Bus
        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = 0.85; // Headroom

        // Setup saturator (soft clipping warm analog emulation)
        this.saturator = this.context.createWaveShaper();
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = Math.tanh(x * 1.2); // Warm analog tube saturation emulation
        }
        this.saturator.curve = curve;
        this.saturator.oversample = '4x';

        // Ambience / Room Simulation (Warmth + High air dampening)
        this.ambienceFilter = this.context.createBiquadFilter();
        this.ambienceFilter.type = 'lowshelf';
        this.ambienceFilter.frequency.value = 150;
        this.ambienceFilter.gain.value = 3.0; // Boost bass/warmth

        // Chain: Master -> Saturator -> Ambience -> Destination
        this.masterGain.connect(this.saturator);
        this.saturator.connect(this.ambienceFilter);
        this.ambienceFilter.connect(this.context.destination);

        this.drumTransport = this.context.createGain();
        this.drumTransport.connect(this.masterGain);

        // The guide click bypasses saturation/EQ: it must stay a clean, precise transient.
        this.clickTransport = this.context.createGain();
        this.clickTransport.gain.value = 0.85;
        this.clickTransport.connect(this.context.destination);

        // Initialize Mixer Channels
        CHANNEL_IDS.forEach(name => {
            const gainNode = this.context.createGain();
            gainNode.gain.value = 1.0;

            const pannerNode = this.context.createStereoPanner();
            pannerNode.pan.value = 0.0;

            // Route: gainNode -> pannerNode -> transport
            gainNode.connect(pannerNode);
            pannerNode.connect(name === 'click' ? this.clickTransport : this.drumTransport);

            // Level tap (post gain/pan, no output): the mixer meters read it.
            const analyser = this.context.createAnalyser();
            analyser.fftSize = 256;
            pannerNode.connect(analyser);

            this.channels[name] = {
                gain: gainNode,
                panner: pannerNode,
                analyser,
                originalVolume: 1.0,
                isMuted: false
            };
        });

        // Pre-fill pools (optional but good for warmup)
        for (let i = 0; i < 20; i++) {
            this.gainPool.push(this.context.createGain());
            this.filterPool.push(this.context.createBiquadFilter());
        }
    }

    public getChannelNode(name: string): AudioNode {
        const chan = this.channels[name as ChannelId];
        if (chan) {
            return chan.gain;
        }
        return this.masterGain;
    }

    /** Current peak level (0..1) of a mixer strip's actual output; 0 for unknown channels. */
    public getChannelLevel(name: string): number {
        const chan = this.channels[name as ChannelId];
        if (!chan) return 0;
        if (this.levelBuffer.length !== chan.analyser.fftSize) this.levelBuffer = new Float32Array(chan.analyser.fftSize);
        chan.analyser.getFloatTimeDomainData(this.levelBuffer);
        return meterFromPeak(peakLevel(this.levelBuffer));
    }

    public setChannelVolume(name: string, volume: number) {
        const chan = this.channels[name as ChannelId];
        if (chan) {
            chan.originalVolume = volume;
            if (!chan.isMuted) {
                chan.gain.gain.setValueAtTime(volume, this.context.currentTime);
            }
        }
    }

    public setChannelPan(name: string, pan: number) {
        const chan = this.channels[name as ChannelId];
        if (chan) {
            chan.panner.pan.setValueAtTime(pan, this.context.currentTime);
        }
    }

    public setChannelMute(name: string, isMuted: boolean) {
        const chan = this.channels[name as ChannelId];
        if (chan) {
            chan.isMuted = isMuted;
            chan.gain.gain.setValueAtTime(isMuted ? 0 : chan.originalVolume, this.context.currentTime);
        }
    }

    /**
     * Cuts every scheduled or ringing voice with a short fade (no clicks), then restores the transport.
     * (ES) Corta todas las voces agendadas o sonando con un fade corto.
     */
    public silence(fadeSeconds: number = 0.012) {
        const now = this.context.currentTime;
        [this.drumTransport, this.clickTransport].forEach(t => {
            const level = t === this.clickTransport ? 0.85 : 1.0;
            t.gain.cancelScheduledValues(now);
            t.gain.setValueAtTime(level, now);
            t.gain.linearRampToValueAtTime(0, now + fadeSeconds);
            t.gain.setValueAtTime(level, now + fadeSeconds + 0.005);
        });
        this.voices.stopAll(now + fadeSeconds);
    }

    public get activeVoiceCount(): number {
        return this.voices.size;
    }

    public dispose() {
        this.voices.stopAll(this.context.currentTime);
        Object.values(this.channels).forEach(ch => {
            ch.gain.disconnect();
            ch.panner.disconnect();
            ch.analyser.disconnect();
        });
        this.drumTransport.disconnect();
        this.clickTransport.disconnect();
        this.masterGain.disconnect();
        this.saturator.disconnect();
        this.ambienceFilter.disconnect();
    }

    private startVoice(node: AudioScheduledSourceNode, time: number) {
        node.start(time);
        this.voices.add(node);
    }

    private connectVoiceToChannel(voiceNode: AudioNode, channelName: ChannelId) {
        const chanNode = this.getChannelNode(channelName);
        voiceNode.connect(chanNode);
    }

    // --- POOLING SYSTEM ---
    private getGain(): GainNode {
        const node = this.gainPool.pop() || this.context.createGain();
        node.gain.cancelScheduledValues(this.context.currentTime);
        node.gain.value = 1.0;
        return node;
    }

    private getFilter(): BiquadFilterNode {
        const node = this.filterPool.pop() || this.context.createBiquadFilter();
        node.frequency.cancelScheduledValues(this.context.currentTime);
        node.gain.cancelScheduledValues(this.context.currentTime);
        node.Q.cancelScheduledValues(this.context.currentTime);
        node.detune.cancelScheduledValues(this.context.currentTime);
        return node;
    }

    private releaseGain(node: GainNode) {
        node.disconnect();
        this.gainPool.push(node);
    }

    private releaseFilter(node: BiquadFilterNode) {
        node.disconnect();
        this.filterPool.push(node);
    }

    private async loadAssets() {
        const shared = await loadSamples(this.context);
        shared.forEach((buffer, name) => this.audioBuffers.set(name, buffer));
    }

    private playBuffer(bufferName: string, channelName: ChannelId, time: number, velocity: number, pitchRate: number = 1.0): boolean {
        const buffer = this.audioBuffers.get(bufferName);
        if (!buffer) {
            return false;
        }

        const channel = this.channels[channelName];
        if (channel.isMuted) return true;

        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.setValueAtTime(pitchRate, time);

        const gainNode = this.context.createGain();
        const gainVal = Math.pow(velocity, 1.5); // Fixed: do not scale by channel.originalVolume twice!
        gainNode.gain.setValueAtTime(gainVal, time);

        source.connect(gainNode);
        gainNode.connect(channel.gain);

        this.startVoice(source, time);
        return true;
    }

    /**
     * Creates a white noise buffer for Snare and texture.
     * (ES) Crea un buffer de ruido blanco para el Redoblante y texturas.
     */
    private createNoiseBuffer() {
        const bufferSize = this.context.sampleRate * 2; // 2 seconds
        const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        this.noiseBuffer = buffer;
    }

    /**
     * Pre-renders complex sounds using OfflineAudioContext to save CPU.
     */
    private async initPreRenderedSounds() {
        [this.bomboBuffer, this.aroBuffer] = await Promise.all([renderBomboParche(), renderBomboAro()]);
    }

    /** Adapter handed to the synthesized voices (see ./voices). */
    private createVoiceHost(): VoiceHost {
        // eslint-disable-next-line @typescript-eslint/no-this-alias -- the getters below need the engine instance
        const self = this;
        return {
            get context() { return self.context; },
            get noiseBuffer() { return self.noiseBuffer; },
            get bomboBuffer() { return self.bomboBuffer; },
            get aroBuffer() { return self.aroBuffer; },
            getGain: () => self.getGain(),
            getFilter: () => self.getFilter(),
            releaseGain: (node) => self.releaseGain(node),
            releaseFilter: (node) => self.releaseFilter(node),
            startVoice: (node, time) => self.startVoice(node, time),
            connectVoiceToChannel: (node, channel) => self.connectVoiceToChannel(node, channel),
            nextShakerPush: () => {
                const isPush = self.shakerState;
                self.shakerState = !self.shakerState;
                return isPush;
            },
        };
    }

    public play(instrument: string, time: number, velocity: number, modifier?: string) {
        switch (instrument) {
            case 'bombo_leguero':
                if (modifier === 'aro') this.playBomboLegueroAro(time, velocity);
                else this.playBomboLegueroParche(time, velocity);
                break;
            case 'kick': this.playRockKick(time, velocity); break;
            case 'snare':
                // Default snares ON unless specified OFF
                this.playRockSnare(time, velocity, modifier !== 'snares_off');
                break;
            case 'hihat':
                this.playHiHat(time, velocity, modifier === 'open');
                break;
            case 'tom_high': this.playTom(time, velocity, 200); break;
            case 'tom_low': this.playTom(time, velocity, 150); break;
            case 'tom_floor': this.playTom(time, velocity, 100); break;
            case 'crash': this.playCrash(time, velocity); break;
            case 'ride': this.playRide(time, velocity); break;
            case 'click': this.playClick(time, velocity); break;
            case 'shaker': this.playShaker(time, velocity); break;
            case 'clave': this.playClave(time, velocity); break;
            case 'surdo': this.playSurdo(time, velocity); break;
            case 'hihat_foot': this.playHiHatFoot(time, velocity); break;
            case 'rim': this.playBomboLegueroAro(time, velocity); break; // Reuse
            case 'caja': this.playCaja(time, velocity, modifier); break;
            case 'cajon': this.playCajon(time, velocity, modifier); break;
            case 'palmas': this.playPalmas(time, velocity); break;
            case 'candombe_chico': this.playCandombeChico(time, velocity); break;
            case 'candombe_repique': this.playCandombeRepique(time, velocity); break;
            case 'candombe_piano': this.playCandombePiano(time, velocity); break;
        }
    }

    // Each public play* method tries the recorded sample first and falls back to the synthesized voice.

    /** Plays a Rock Kick Drum (Tight, punchy). */
    public playRockKick(time: number, velocity: number = 1.0) {
        if (this.playBuffer('kick', INSTRUMENT_CHANNEL.kick, time, velocity)) return;
        synthKick(this.host, time, velocity);
    }

    /** Plays a Tom (High, Low, Floor). */
    public playTom(time: number, velocity: number, pitch: number) {
        let bufName = 'tom_low';
        if (pitch > 180) bufName = 'tom_high';
        else if (pitch < 120) bufName = 'tom_floor';
        const channelName = pitch > 180 ? INSTRUMENT_CHANNEL.tom_high : (pitch < 120 ? INSTRUMENT_CHANNEL.tom_floor : INSTRUMENT_CHANNEL.tom_low);
        if (this.playBuffer(bufName, channelName, time, velocity)) return;
        synthTom(this.host, time, velocity, pitch, channelName);
    }

    /** Plays a Surdo (Deep samba drum). */
    public playSurdo(time: number, velocity: number) {
        if (this.playBuffer('surdo', INSTRUMENT_CHANNEL.surdo, time, velocity)) return;
        synthSurdo(this.host, time, velocity);
    }

    /** Plays a Shaker & Guache. */
    public playShaker(time: number, velocity: number) {
        if (this.playBuffer('shaker_real', INSTRUMENT_CHANNEL.shaker, time, velocity)) return;
        synthShaker(this.host, time, velocity);
    }

    public playCrash(time: number, velocity: number) {
        if (this.playBuffer('ride', INSTRUMENT_CHANNEL.ride, time, velocity, 1.35)) return;
        synthCrash(this.host, time, velocity);
    }

    /** Plays a Ride Cymbal. */
    public playRide(time: number, velocity: number) {
        if (this.playBuffer('ride', INSTRUMENT_CHANNEL.ride, time, velocity, 1.0)) return;
        synthRide(this.host, time, velocity);
    }

    /**
     * Plays a Rock Snare Drum.
     * @param snaresOn If true (default), plays noise. If false, timbal-like tone.
     */
    public playRockSnare(time: number, velocity: number = 1.0, snaresOn: boolean = true) {
        if (this.playBuffer('snare', INSTRUMENT_CHANNEL.snare, time, velocity)) return;
        synthSnare(this.host, time, velocity, snaresOn);
    }

    /** Plays a Hi-Hat (open or closed). */
    public playHiHat(time: number, velocity: number = 1.0, open: boolean = false) {
        const bufName = open ? 'hihat-open' : 'hihat';
        if (this.playBuffer(bufName, 'hihat', time, velocity)) return;
        synthHiHat(this.host, time, velocity, open);
    }

    /** Plays a Hi-Hat Foot (Pedal "Chick"). */
    public playHiHatFoot(time: number, velocity: number = 1.0) {
        if (this.playBuffer('hihat', INSTRUMENT_CHANNEL.hihat_foot, time, velocity * 0.7)) return;
        synthHiHatFoot(this.host, time, velocity);
    }

    /** Plays the "Parche" (Head) sound of a Bombo Legüero. */
    public playBomboLegueroParche(time: number, velocity: number = 1.0) {
        if (this.playBuffer('bombo_parche', INSTRUMENT_CHANNEL.bombo_leguero, time, velocity)) return;
        synthBomboParche(this.host, time, velocity);
    }

    public playBomboLegueroAro(time: number, velocity: number = 1.0) {
        if (this.playBuffer('bombo_aro', INSTRUMENT_CHANNEL.rim, time, velocity)) return;
        synthBomboAro(this.host, time, velocity);
    }

    /** Plays a Clave sound. */
    public playClave(time: number, velocity: number = 1.0) {
        if (this.playBuffer('clave', INSTRUMENT_CHANNEL.clave, time, velocity)) return;
        synthClave(this.host, time, velocity);
    }

    /** Plays a standard Metronome Click. */
    public playClick(time: number, velocity: number = 1.0) {
        synthClick(this.host, time, velocity);
    }

    public playCaja(time: number, velocity: number = 1.0, modifier?: string) {
        const isAro = modifier === 'aro' || modifier === 'open';
        const pitch = isAro ? 1.45 : 1.0;
        if (this.playBuffer('caja', INSTRUMENT_CHANNEL.caja, time, velocity, pitch)) return;
        this.playRockSnare(time, velocity * (isAro ? 0.75 : 1.0), false);
    }

    public playCajon(time: number, velocity: number = 1.0, modifier?: string) {
        const isAro = modifier === 'aro' || modifier === 'open';
        const pitch = isAro ? 1.55 : 1.0;
        if (this.playBuffer('cajon', INSTRUMENT_CHANNEL.cajon, time, velocity, pitch)) return;
        this.playRockKick(time, velocity * (isAro ? 0.65 : 1.0));
    }

    public playPalmas(time: number, velocity: number = 1.0) {
        if (this.playBuffer('palmas', INSTRUMENT_CHANNEL.palmas, time, velocity)) return;
        this.playRockSnare(time, velocity * 0.5, false);
    }

    public playCandombeChico(time: number, velocity: number = 1.0) {
        if (this.playBuffer('candombe_chico', INSTRUMENT_CHANNEL.candombe_chico, time, velocity)) return;
        this.playTom(time, velocity, 200);
    }

    public playCandombeRepique(time: number, velocity: number = 1.0) {
        if (this.playBuffer('candombe_repique', INSTRUMENT_CHANNEL.candombe_repique, time, velocity)) return;
        this.playTom(time, velocity, 150);
    }

    public playCandombePiano(time: number, velocity: number = 1.0) {
        if (this.playBuffer('candombe_piano', INSTRUMENT_CHANNEL.candombe_piano, time, velocity)) return;
        this.playTom(time, velocity, 100);
    }
}

export default DrumSynthesizer;