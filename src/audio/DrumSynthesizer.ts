import AudioContextManager from './AudioContextManager';

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
    private audioBuffers: Map<string, AudioBuffer> = new Map();
    public loadPromise: Promise<void> | null = null;

    // Multi-channel mixer strips
    private channels: Record<string, { gain: GainNode; panner: StereoPannerNode | null; originalVolume: number; isMuted: boolean }> = {};

    // Node Pools
    private gainPool: GainNode[] = [];
    private filterPool: BiquadFilterNode[] = [];

    // Pre-rendered buffers
    private bomboBuffer: AudioBuffer | null = null;
    private aroBuffer: AudioBuffer | null = null;

    // Shaker push/pull alternating state
    private shakerState: boolean = false;

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

        // Initialize Mixer Channels
        const channelNames = ['bombo', 'clave', 'shaker', 'kick', 'snare', 'hihat', 'click', 'synth'];
        channelNames.forEach(name => {
            const gainNode = this.context.createGain();
            gainNode.gain.value = 1.0;

            const pannerNode = this.context.createStereoPanner ? this.context.createStereoPanner() : null;
            if (pannerNode) {
                pannerNode.pan.value = 0.0;
            }

            // Route: gainNode -> pannerNode -> masterGain
            if (pannerNode) {
                gainNode.connect(pannerNode);
                pannerNode.connect(this.masterGain);
            } else {
                gainNode.connect(this.masterGain);
            }

            this.channels[name] = {
                gain: gainNode,
                panner: pannerNode,
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
        const chan = this.channels[name];
        if (chan) {
            return chan.gain;
        }
        return this.masterGain;
    }

    public setChannelVolume(name: string, volume: number) {
        const chan = this.channels[name];
        if (chan) {
            chan.originalVolume = volume;
            if (!chan.isMuted) {
                chan.gain.gain.setValueAtTime(volume, this.context.currentTime);
            }
        }
    }

    public setChannelPan(name: string, pan: number) {
        const chan = this.channels[name];
        if (chan && chan.panner) {
            chan.panner.pan.setValueAtTime(pan, this.context.currentTime);
        }
    }

    public setChannelMute(name: string, isMuted: boolean) {
        const chan = this.channels[name];
        if (chan) {
            chan.isMuted = isMuted;
            chan.gain.gain.setValueAtTime(isMuted ? 0 : chan.originalVolume, this.context.currentTime);
        }
    }

    private connectVoiceToChannel(voiceNode: AudioNode, channelName: string) {
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

    private async loadAsset(name: string, url: string) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
            this.audioBuffers.set(name, audioBuffer);
        } catch (e) {
            console.error(`Failed to load asset ${name} from ${url}`, e);
        }
    }

    private async loadAssets() {
        const assets = [
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

        await Promise.all(assets.map(asset => this.loadAsset(asset.name, asset.url)));
        this.trimBomboAssets();
    }

    private trimBomboAssets() {
        const rawParche = this.audioBuffers.get('bombo_parche_raw');
        if (rawParche) {
            const trimmed = this.trimBuffer(rawParche, 0.02, 0.8);
            this.audioBuffers.set('bombo_parche', trimmed);
        }

        const rawAro = this.audioBuffers.get('bombo_aro_raw');
        if (rawAro) {
            const trimmed = this.trimBuffer(rawAro, 0.02, 0.25);
            this.audioBuffers.set('bombo_aro', trimmed);
        }

        const rawCaja = this.audioBuffers.get('caja_raw');
        if (rawCaja) {
            const trimmed = this.trimBuffer(rawCaja, 0.02, 0.8);
            this.audioBuffers.set('caja', trimmed);
        }

        const rawCajon = this.audioBuffers.get('cajon_raw');
        if (rawCajon) {
            const trimmed = this.trimBuffer(rawCajon, 0.02, 0.8);
            this.audioBuffers.set('cajon', trimmed);
        }

        const rawPalmas = this.audioBuffers.get('palmas_raw');
        if (rawPalmas) {
            const trimmed = this.trimBuffer(rawPalmas, 0.02, 0.4);
            this.audioBuffers.set('palmas', trimmed);
        }

        const rawShakerReal = this.audioBuffers.get('shaker_real_raw');
        if (rawShakerReal) {
            const trimmed = this.trimBuffer(rawShakerReal, 0.01, 0.3);
            this.audioBuffers.set('shaker_real', trimmed);
        }

        const rawClave = this.audioBuffers.get('clave_raw');
        if (rawClave) {
            const trimmed = this.trimBuffer(rawClave, 0.02, 0.3);
            this.audioBuffers.set('clave', trimmed);
        }

        const rawChico = this.audioBuffers.get('candombe_chico_raw');
        if (rawChico) {
            const trimmed = this.trimBuffer(rawChico, 0.02, 0.5);
            this.audioBuffers.set('candombe_chico', trimmed);
        }

        const rawRepique = this.audioBuffers.get('candombe_repique_raw');
        if (rawRepique) {
            const trimmed = this.trimBuffer(rawRepique, 0.02, 0.5);
            this.audioBuffers.set('candombe_repique', trimmed);
        }

        const rawPiano = this.audioBuffers.get('candombe_piano_raw');
        if (rawPiano) {
            const trimmed = this.trimBuffer(rawPiano, 0.02, 0.8);
            this.audioBuffers.set('candombe_piano', trimmed);
        }
    }

    private trimBuffer(buffer: AudioBuffer, threshold: number, durationSec: number): AudioBuffer {
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

        const trimmedBuffer = this.context.createBuffer(numChannels, trimLength, sampleRate);

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

    private playBuffer(bufferName: string, channelName: string, time: number, velocity: number, pitchRate: number = 1.0): boolean {
        const buffer = this.audioBuffers.get(bufferName);
        if (!buffer) {
            return false;
        }

        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.setValueAtTime(pitchRate, time);

        const channel = this.channels[channelName];
        if (!channel || channel.isMuted) return true;

        const gainNode = this.context.createGain();
        const gainVal = Math.pow(velocity, 1.5); // Fixed: do not scale by channel.originalVolume twice!
        gainNode.gain.setValueAtTime(gainVal, time);

        source.connect(gainNode);
        gainNode.connect(channel.gain);

        source.start(time);
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
        // Render 1.2 seconds of audio for the deep woolly Bombo Legüero drum skin hit
        const bomboCtx = new OfflineAudioContext(1, 44100 * 1.2, 44100);
        const bomboGain = bomboCtx.createGain();
        bomboGain.connect(bomboCtx.destination);

        // 1. SKIN TRANSIENT (Triangle sweep 180Hz -> 55Hz in 10ms for a thick, woolly mazo strike impact)
        const transientOsc = bomboCtx.createOscillator();
        transientOsc.type = 'triangle';
        transientOsc.frequency.setValueAtTime(180, 0);
        transientOsc.frequency.exponentialRampToValueAtTime(55, 0.01);

        const transientGain = bomboCtx.createGain();
        transientGain.gain.setValueAtTime(0, 0);
        transientGain.gain.linearRampToValueAtTime(0.9, 0.001);
        transientGain.gain.exponentialRampToValueAtTime(0.001, 0.012);

        transientOsc.connect(transientGain);
        transientGain.connect(bomboGain);
        transientOsc.start(0);

        // 2. LEATHER RESONANCE (Pink Noise to emulate animal fur scraping on thick goat skin)
        const leatherNoise = bomboCtx.createBufferSource();
        const noiseBuf = bomboCtx.createBuffer(1, 44100 * 0.6, 44100);
        const noiseDataArray = noiseBuf.getChannelData(0);
        
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < noiseBuf.length; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            noiseDataArray[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
            noiseDataArray[i] *= 0.11; // Normalize approximate volume
            b6 = white * 0.115926;
        }
        leatherNoise.buffer = noiseBuf;

        const leatherFilter = bomboCtx.createBiquadFilter();
        leatherFilter.type = 'lowpass';
        leatherFilter.frequency.setValueAtTime(85, 0);
        leatherFilter.Q.setValueAtTime(4.0, 0);

        const leatherBandpass = bomboCtx.createBiquadFilter();
        leatherBandpass.type = 'bandpass';
        leatherBandpass.frequency.setValueAtTime(150, 0);
        leatherBandpass.Q.setValueAtTime(2.0, 0);

        const leatherGain = bomboCtx.createGain();
        leatherGain.gain.setValueAtTime(0, 0);
        leatherGain.gain.linearRampToValueAtTime(0.75, 0.005);
        leatherGain.gain.exponentialRampToValueAtTime(0.001, 0.25);

        const noiseGainLow = bomboCtx.createGain();
        noiseGainLow.gain.setValueAtTime(0.8, 0);
        const noiseGainBP = bomboCtx.createGain();
        noiseGainBP.gain.setValueAtTime(0.3, 0);

        leatherNoise.connect(leatherFilter);
        leatherFilter.connect(noiseGainLow);
        noiseGainLow.connect(leatherGain);

        leatherNoise.connect(leatherBandpass);
        leatherBandpass.connect(noiseGainBP);
        noiseGainBP.connect(leatherGain);

        leatherGain.connect(bomboGain);
        leatherNoise.start(0);

        // 3. CAVITY BOOM & MEMBRANE RESONANCE (Acoustic physical modeling of drum shell and skin)
        // 3.1. Deep sub-bass fundamental at 58Hz
        const subOsc = bomboCtx.createOscillator();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(58, 0);

        const subGain = bomboCtx.createGain();
        subGain.gain.setValueAtTime(0, 0);
        subGain.gain.linearRampToValueAtTime(0.9, 0.015);
        subGain.gain.exponentialRampToValueAtTime(0.001, 0.7);

        subOsc.connect(subGain);
        subGain.connect(bomboGain);
        subOsc.start(0);

        // 3.2. Circular membrane inharmonic mode (1,1) at 58Hz * 1.59 = 92.2Hz
        const inharmonicOsc = bomboCtx.createOscillator();
        inharmonicOsc.type = 'sine';
        inharmonicOsc.frequency.setValueAtTime(58 * 1.59, 0);

        const inharmonicGain = bomboCtx.createGain();
        inharmonicGain.gain.setValueAtTime(0, 0);
        inharmonicGain.gain.linearRampToValueAtTime(0.35, 0.01);
        inharmonicGain.gain.exponentialRampToValueAtTime(0.001, 0.18);

        inharmonicOsc.connect(inharmonicGain);
        inharmonicGain.connect(bomboGain);
        inharmonicOsc.start(0);

        // 3.3. Ceibo wood drum shell resonance at 58Hz * 2 = 116Hz
        const ceiboResonance = bomboCtx.createOscillator();
        ceiboResonance.type = 'triangle'; // triangle waves add pleasant woody warmth
        ceiboResonance.frequency.setValueAtTime(116, 0);

        const ceiboGain = bomboCtx.createGain();
        ceiboGain.gain.setValueAtTime(0, 0);
        ceiboGain.gain.linearRampToValueAtTime(0.2, 0.01);
        ceiboGain.gain.exponentialRampToValueAtTime(0.001, 0.3);

        ceiboResonance.connect(ceiboGain);
        ceiboGain.connect(bomboGain);
        ceiboResonance.start(0);

        this.bomboBuffer = await bomboCtx.startRendering();

        // --- RENDER BOMBO ARO (Ceibo hollow wood click - Physical Modeling using FM Synthesis) ---
        const aroCtx = new OfflineAudioContext(1, 44100 * 0.5, 44100);
        const aroOut = aroCtx.createGain();
        aroOut.connect(aroCtx.destination);

        // 1. FM SYNTHESIS (Ceibo hollow thick wood trunk modeling at lower inharmonic frequencies)
        const carrier = aroCtx.createOscillator();
        const modulator = aroCtx.createOscillator();
        const modGain = aroCtx.createGain();

        carrier.type = 'sine';
        carrier.frequency.setValueAtTime(200, 0); // Carrier at 200Hz

        modulator.type = 'sine';
        modulator.frequency.setValueAtTime(390, 0); // Modulator at 390Hz (inharmonic ratio ~1.95)

        modGain.gain.setValueAtTime(360, 0); // High index for high wooden strike transient
        modGain.gain.exponentialRampToValueAtTime(0.01, 0.03);

        const fmGain = aroCtx.createGain();
        fmGain.gain.setValueAtTime(0, 0);
        fmGain.gain.linearRampToValueAtTime(0.9, 0.001);
        fmGain.gain.exponentialRampToValueAtTime(0.001, 0.055);

        modulator.connect(modGain);
        modGain.connect(carrier.frequency);
        carrier.connect(fmGain);
        fmGain.connect(aroOut);

        modulator.start(0);
        carrier.start(0);

        // 1.2. Secondary wood resonance mode (Helmholtz hollow box tone at 580Hz)
        const ceiboHollow = aroCtx.createOscillator();
        ceiboHollow.type = 'sine';
        ceiboHollow.frequency.setValueAtTime(580, 0);

        const hollowGain = aroCtx.createGain();
        hollowGain.gain.setValueAtTime(0, 0);
        hollowGain.gain.linearRampToValueAtTime(0.25, 0.001);
        hollowGain.gain.exponentialRampToValueAtTime(0.001, 0.02);

        ceiboHollow.connect(hollowGain);
        hollowGain.connect(aroOut);
        ceiboHollow.start(0);

        // 2. STICK SCRAPE & WOOD CRACK (Band-pass filtered wood noise)
        const aroNoise = aroCtx.createBufferSource();
        const aroNoiseBuf = aroCtx.createBuffer(1, 44100 * 0.15, 44100);
        const aroND = aroNoiseBuf.getChannelData(0);
        for (let i = 0; i < aroNoiseBuf.length; i++) {
            aroND[i] = Math.random() * 2 - 1;
        }
        aroNoise.buffer = aroNoiseBuf;

        const crackFilter = aroCtx.createBiquadFilter();
        crackFilter.type = 'bandpass';
        crackFilter.frequency.setValueAtTime(1000, 0); // 1.0kHz band-pass resonances
        crackFilter.Q.setValueAtTime(3.0, 0);

        const crackGain = aroCtx.createGain();
        crackGain.gain.setValueAtTime(0, 0);
        crackGain.gain.linearRampToValueAtTime(0.5, 0.001);
        crackGain.gain.exponentialRampToValueAtTime(0.001, 0.016);

        aroNoise.connect(crackFilter);
        crackFilter.connect(crackGain);
        crackGain.connect(aroOut);
        aroNoise.start(0);

        this.aroBuffer = await aroCtx.startRendering();
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

    /**
     * Plays a Rock Kick Drum (Tight, punchy).
     */
    public playRockKick(time: number, velocity: number = 1.0) {
        if (this.playBuffer('kick', 'kick', time, velocity)) return;
        const osc = this.context.createOscillator();
        const gain = this.getGain();

        osc.connect(gain);
        this.connectVoiceToChannel(gain, 'kick');

        // Frequency sweep (50Hz -> 0Hz)
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);

        // Amplitude envelope
        gain.gain.setValueAtTime(velocity, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

        osc.onended = () => {
            this.releaseGain(gain);
        };

        osc.start(time);
        osc.stop(time + 0.5);
    }

    /**
    * Plays a Tom (High, Low, Floor).
    */
    public playTom(time: number, velocity: number, pitch: number) {
        let bufName = 'tom_low';
        if (pitch > 180) bufName = 'tom_high';
        else if (pitch < 120) bufName = 'tom_floor';
        const channelName = pitch > 180 ? 'snare' : 'kick';
        if (this.playBuffer(bufName, channelName, time, velocity)) return;

        const osc = this.context.createOscillator();
        const gain = this.getGain();

        osc.connect(gain);
        this.connectVoiceToChannel(gain, channelName);

        // Pitch Drop - Faster and deeper for "dry" sound
        osc.frequency.setValueAtTime(pitch, time);
        osc.frequency.exponentialRampToValueAtTime(pitch * 0.2, time + 0.15); // Faster drop

        // Volume Envelope - Very short sustain
        gain.gain.setValueAtTime(velocity, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15); // Reduced boominess

        osc.onended = () => {
            this.releaseGain(gain);
        };

        osc.start(time);
        osc.stop(time + 0.25);
    }

    /**
    * Plays a Surdo (Deep samba drum).
    */
    public playSurdo(time: number, velocity: number) {
        if (this.playBuffer('surdo', 'bombo', time, velocity)) return;
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.connect(gain);
        this.connectVoiceToChannel(gain, 'bombo');

        // Deep/Muffled
        osc.frequency.setValueAtTime(45, time);
        osc.frequency.exponentialRampToValueAtTime(35, time + 0.3);

        gain.gain.setValueAtTime(velocity, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);

        osc.start(time);
        osc.stop(time + 0.45);
    }

    /**
     * Plays a Shaker & Guache.
     * Sweep dynamic bandpass filtered white noise with push/pull alternate acoustics.
     */
    public playShaker(time: number, velocity: number) {
        if (this.playBuffer('shaker_real', 'shaker', time, velocity)) return;
        if (!this.noiseBuffer) return;

        const source = this.context.createBufferSource();
        source.buffer = this.noiseBuffer;

        const filter = this.getFilter();
        filter.type = 'bandpass';

        // Alternate shaker direction (push/pull) for natural texture
        const isPush = this.shakerState;
        this.shakerState = !this.shakerState;

        const startFreq = isPush ? 3200 : 4500;
        const endFreq = isPush ? 6400 : 3400;
        const q = isPush ? 2.2 : 1.2;
        const decay = isPush ? 0.045 : 0.095;
        const volumeFactor = isPush ? 0.28 : 0.18;

        // Apply sweeping dynamic bandpass filter
        filter.Q.setValueAtTime(q, time);
        filter.frequency.setValueAtTime(startFreq, time);
        filter.frequency.exponentialRampToValueAtTime(endFreq, time + decay);

        const gain = this.getGain();

        source.connect(filter);
        filter.connect(gain);
        this.connectVoiceToChannel(gain, 'shaker');

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(velocity * volumeFactor, time + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

        source.onended = () => {
            this.releaseFilter(filter);
            this.releaseGain(gain);
        };

        source.start(time);
        source.stop(time + decay + 0.02);
    }

    public playCrash(time: number, velocity: number) {
        if (this.playBuffer('ride', 'hihat', time, velocity, 1.35)) return;
        if (!this.noiseBuffer) return;

        const source = this.context.createBufferSource();
        source.buffer = this.noiseBuffer;

        const filter = this.context.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2000;

        const gain = this.context.createGain();

        source.connect(filter);
        filter.connect(gain);
        this.connectVoiceToChannel(gain, 'hihat');

        gain.gain.setValueAtTime(velocity * 0.8, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 1.5); // Long decay

        source.start(time);
        source.stop(time + 1.5);
    }

    /**
    * Plays a Ride Cymbal.
    * Improved: More complex metallic wash + high frequency stick impact.
    */
    public playRide(time: number, velocity: number) {
        if (this.playBuffer('ride', 'hihat', time, velocity, 1.0)) return;
        // A. Stick Impact - Sharp, high-frequency "ping" (Dry)
        const impact = this.context.createOscillator();
        const impactGain = this.getGain();
        impact.connect(impactGain);
        this.connectVoiceToChannel(impactGain, 'hihat');

        impact.type = 'sine';
        impact.frequency.setValueAtTime(4500, time);

        impactGain.gain.setValueAtTime(velocity * 0.5, time);
        impactGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03); // Very short

        impact.onended = () => this.releaseGain(impactGain);

        impact.start(time);
        impact.stop(time + 0.05);

        // B. The "Body" wash - Simulated edge hit using band-pass filtered noise
        if (!this.noiseBuffer) return;

        // Multiple band-passes for complex metallic shimmer
        const resonances = [6000, 8500, 11000];
        resonances.forEach((freq, i) => {
            const noise = this.context.createBufferSource();
            noise.buffer = this.noiseBuffer!;

            const filter = this.getFilter();
            filter.type = 'bandpass';
            filter.frequency.value = freq;
            filter.Q.value = 5;

            const noiseGain = this.getGain();

            noise.connect(filter);
            filter.connect(noiseGain);
            this.connectVoiceToChannel(noiseGain, 'hihat');

            // Shimmer envelope
            noiseGain.gain.setValueAtTime(0, time);
            noiseGain.gain.linearRampToValueAtTime(velocity * (0.2 - (i * 0.05)), time + 0.02);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 1.2); // Clean decay

            noise.onended = () => {
                this.releaseFilter(filter);
                this.releaseGain(noiseGain);
            };

            noise.start(time);
            noise.stop(time + 1.2);
        });

        // C. Low-frequency metal "hum" (Very subtle, dry)
        const hum = this.context.createOscillator();
        const humGain = this.getGain();
        hum.connect(humGain);
        this.connectVoiceToChannel(humGain, 'hihat');

        hum.type = 'triangle';
        hum.frequency.setValueAtTime(320, time);

        humGain.gain.setValueAtTime(0, time);
        humGain.gain.linearRampToValueAtTime(velocity * 0.1, time + 0.05);
        humGain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

        hum.onended = () => this.releaseGain(humGain);

        hum.start(time);
        hum.stop(time + 0.35);
    }

    /**
     * Plays a Rock Snare Drum.
     * @param snaresOn If true (default), plays noise. If false, timbal-like tone.
     */
    public playRockSnare(time: number, velocity: number = 1.0, snaresOn: boolean = true) {
        if (this.playBuffer('snare', 'snare', time, velocity)) return;
        // 1. Tonal component (Body)
        const osc = this.context.createOscillator();
        const oscGain = this.getGain();
        osc.connect(oscGain);
        this.connectVoiceToChannel(oscGain, 'snare');

        // Less extreme pitch difference for OFF, just slightly tighter
        const basePitch = snaresOn ? 250 : 280;
        osc.frequency.setValueAtTime(basePitch, time);
        osc.frequency.exponentialRampToValueAtTime(basePitch * 0.5, time + 0.15);

        oscGain.gain.setValueAtTime(velocity * 0.6, time);
        oscGain.gain.exponentialRampToValueAtTime(0.01, time + (snaresOn ? 0.2 : 0.15));

        osc.onended = () => this.releaseGain(oscGain);
        osc.start(time);
        osc.stop(time + 0.25);

        // 2. Noise component (Snares)
        if (snaresOn && this.noiseBuffer) {
            const noise = this.context.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const noiseFilter = this.getFilter();
            noiseFilter.type = 'highpass';
            noiseFilter.frequency.value = 1000;
            const noiseGain = this.getGain();

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            this.connectVoiceToChannel(noiseGain, 'snare');

            noiseGain.gain.setValueAtTime(velocity * 0.8, time);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.25);

            noise.onended = () => {
                this.releaseFilter(noiseFilter);
                this.releaseGain(noiseGain);
            };

            noise.start(time);
            noise.stop(time + 0.25);
        }
    }

    /**
     * Plays a Hi-Hat.
     * Unified logic for Open/Closed.
     */
    public playHiHat(time: number, velocity: number = 1.0, open: boolean = false) {
        const bufName = open ? 'hihat-open' : 'hihat';
        if (this.playBuffer(bufName, 'hihat', time, velocity)) return;
        if (!this.noiseBuffer) return;

        const source = this.context.createBufferSource();
        source.buffer = this.noiseBuffer;

        const filter = this.getFilter();
        filter.type = 'highpass';
        filter.frequency.value = 7000;

        const gain = this.getGain();

        // Envelope: Short for closed, longer for open
        const decay = open ? 0.4 : 0.05; // 400ms vs 50ms

        source.connect(filter);
        filter.connect(gain);
        this.connectVoiceToChannel(gain, 'hihat');

        gain.gain.setValueAtTime(velocity * 0.6, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + decay);

        source.onended = () => {
            this.releaseFilter(filter);
            this.releaseGain(gain);
        };

        source.start(time);
        source.stop(time + decay);
    }

    /**
     * Plays a Hi-Hat Foot (Pedal "Chick").
     */
    public playHiHatFoot(time: number, velocity: number = 1.0) {
        if (this.playBuffer('hihat', 'hihat', time, velocity * 0.7)) return;
        if (!this.noiseBuffer) return;

        const source = this.context.createBufferSource();
        source.buffer = this.noiseBuffer;

        const filter = this.getFilter();
        filter.type = 'highpass';
        filter.frequency.value = 5000; // Lower than stick hit for more "chunk"

        const gain = this.getGain();

        // Very short, definitive chic
        const decay = 0.035;

        source.connect(filter);
        filter.connect(gain);
        this.connectVoiceToChannel(gain, 'hihat');

        gain.gain.setValueAtTime(velocity * 0.7, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + decay);

        source.onended = () => {
            this.releaseFilter(filter);
            this.releaseGain(gain);
        };

        source.start(time);
        source.stop(time + decay);
    }

    /**
     * Plays the "Parche" (Head) sound of a Bombo Legüero.
     */
    public playBomboLegueroParche(time: number, velocity: number = 1.0) {
        if (this.playBuffer('bombo_parche', 'bombo', time, velocity)) return;
        if (!this.bomboBuffer) return;

        const source = this.context.createBufferSource();
        source.buffer = this.bomboBuffer;

        // Dynamic Filter: Mapped to make low velocity sound "muddy" and high velocity "slap"
        const dynamicsFilter = this.getFilter();
        dynamicsFilter.type = 'lowpass';
        // 0.1 vel -> ~200Hz, 1.0 vel -> ~12000Hz (Exponential-ish)
        dynamicsFilter.frequency.value = 150 + (12000 * Math.pow(velocity, 3));

        const gain = this.getGain();

        source.connect(dynamicsFilter);
        dynamicsFilter.connect(gain);
        this.connectVoiceToChannel(gain, 'bombo');

        source.playbackRate.value = 1.0 + ((Math.random() - 0.5) * 0.02); // Tiny pitch jitter
        gain.gain.setValueAtTime(velocity, time);

        source.onended = () => {
            this.releaseFilter(dynamicsFilter);
            this.releaseGain(gain);
        };

        source.start(time);
        source.stop(time + 1.0);
    }

    public playBomboLegueroAro(time: number, velocity: number = 1.0) {
        if (this.playBuffer('bombo_aro', 'bombo', time, velocity)) return;
        if (!this.aroBuffer) return;

        const source = this.context.createBufferSource();
        source.buffer = this.aroBuffer;

        const dynamicsFilter = this.getFilter();
        dynamicsFilter.type = 'lowpass';
        dynamicsFilter.frequency.value = 2000 + (10000 * Math.pow(velocity, 2));

        const gain = this.getGain();
        source.connect(dynamicsFilter);
        dynamicsFilter.connect(gain);
        this.connectVoiceToChannel(gain, 'bombo');

        gain.gain.setValueAtTime(velocity, time);
        source.playbackRate.value = 1.0 + ((Math.random() - 0.5) * 0.04);

        source.onended = () => {
            this.releaseFilter(dynamicsFilter);
            this.releaseGain(gain);
        };

        source.start(time);
        source.stop(time + 0.5);
    }

    /**
     * Plays a Clave sound.
     */
    public playClave(time: number, velocity: number = 1.0) {
        if (this.playBuffer('clave', 'clave', time, velocity)) return;
        // High quality physical modeling of hardwood rosewood claves
        // Mode 1: 1800 Hz (Bandpass Q=25)
        // Mode 2: 2200 Hz (Bandpass Q=25)
        // Fed by a short 2ms noise click (impulse excitation)
        
        if (!this.noiseBuffer) return;

        const impulseSource = this.context.createBufferSource();
        impulseSource.buffer = this.noiseBuffer;

        const impulseGain = this.context.createGain();
        impulseGain.gain.setValueAtTime(0, time);
        impulseGain.gain.linearRampToValueAtTime(velocity * 0.95, time + 0.001);
        impulseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.003); // 3ms impulse excitation

        // Dual bandpass filters in parallel
        const bp1 = this.getFilter();
        bp1.type = 'bandpass';
        bp1.frequency.setValueAtTime(1800, time);
        bp1.Q.setValueAtTime(25.0, time);

        const bp2 = this.getFilter();
        bp2.type = 'bandpass';
        bp2.frequency.setValueAtTime(2200, time);
        bp2.Q.setValueAtTime(25.0, time);

        // Mix gain after filters
        const mixGain1 = this.getGain();
        mixGain1.gain.setValueAtTime(0.7, time);
        mixGain1.gain.exponentialRampToValueAtTime(0.001, time + 0.075); // rapid wood decay

        const mixGain2 = this.getGain();
        mixGain2.gain.setValueAtTime(0.5, time);
        mixGain2.gain.exponentialRampToValueAtTime(0.001, time + 0.055); // high mode decay

        impulseSource.connect(impulseGain);
        
        impulseGain.connect(bp1);
        bp1.connect(mixGain1);
        mixGain1.connect(this.getChannelNode('clave'));

        impulseGain.connect(bp2);
        bp2.connect(mixGain2);
        mixGain2.connect(this.getChannelNode('clave'));

        impulseSource.start(time);
        impulseSource.stop(time + 0.08);

        impulseSource.onended = () => {
            this.releaseFilter(bp1);
            this.releaseFilter(bp2);
            this.releaseGain(mixGain1);
            this.releaseGain(mixGain2);
        };
    }

    /**
     * Plays a standard Metronome Click.
     */
    public playClick(time: number, velocity: number = 1.0) {
        const osc = this.context.createOscillator();
        const gain = this.getGain();

        osc.connect(gain);
        this.connectVoiceToChannel(gain, 'click');

        // Fixed velocity threshold for pitch differentiation
        const forte = velocity > 0.8;
        const pitch = forte ? 1500 : 800;
        osc.frequency.setValueAtTime(pitch, time);

        gain.gain.setValueAtTime(velocity, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + (forte ? 0.08 : 0.05));

        osc.onended = () => this.releaseGain(gain);
        osc.start(time);
        osc.stop(time + 0.1);
    }

    public playCaja(time: number, velocity: number = 1.0, modifier?: string) {
        const isAro = modifier === 'aro' || modifier === 'open';
        const pitch = isAro ? 1.45 : 1.0;
        if (this.playBuffer('caja', 'snare', time, velocity, pitch)) return;
        this.playRockSnare(time, velocity * (isAro ? 0.75 : 1.0), false);
    }

    public playCajon(time: number, velocity: number = 1.0, modifier?: string) {
        const isAro = modifier === 'aro' || modifier === 'open';
        const pitch = isAro ? 1.55 : 1.0;
        if (this.playBuffer('cajon', 'kick', time, velocity, pitch)) return;
        this.playRockKick(time, velocity * (isAro ? 0.65 : 1.0));
    }

    public playPalmas(time: number, velocity: number = 1.0) {
        if (this.playBuffer('palmas', 'snare', time, velocity)) return;
        this.playRockSnare(time, velocity * 0.5, false);
    }

    public playCandombeChico(time: number, velocity: number = 1.0) {
        if (this.playBuffer('candombe_chico', 'tom_high', time, velocity)) return;
        this.playTom(time, velocity, 200);
    }

    public playCandombeRepique(time: number, velocity: number = 1.0) {
        if (this.playBuffer('candombe_repique', 'tom_low', time, velocity)) return;
        this.playTom(time, velocity, 150);
    }

    public playCandombePiano(time: number, velocity: number = 1.0) {
        if (this.playBuffer('candombe_piano', 'tom_floor', time, velocity)) return;
        this.playTom(time, velocity, 100);
    }
}

export default DrumSynthesizer;
