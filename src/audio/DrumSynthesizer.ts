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

    // Node Pools
    private gainPool: GainNode[] = [];
    private filterPool: BiquadFilterNode[] = [];

    // Pre-rendered buffers
    private bomboBuffer: AudioBuffer | null = null;
    private aroBuffer: AudioBuffer | null = null;

    constructor() {
        this.context = AudioContextManager.getInstance().getContext();
        this.createNoiseBuffer();
        this.initPreRenderedSounds();

        // Initialize Master Bus
        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = 0.9; // Headroom

        // Ambience / Room Simulation (Warmth + High air dampening)
        this.ambienceFilter = this.context.createBiquadFilter();
        this.ambienceFilter.type = 'lowshelf';
        this.ambienceFilter.frequency.value = 150;
        this.ambienceFilter.gain.value = 3.0; // Boost bass/warmth

        // Chain: Master -> Ambience -> Destination
        this.masterGain.connect(this.ambienceFilter);
        this.ambienceFilter.connect(this.context.destination);

        // Pre-fill pools (optional but good for warmup)
        for (let i = 0; i < 20; i++) {
            this.gainPool.push(this.context.createGain());
            this.filterPool.push(this.context.createBiquadFilter());
        }
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
        // Render 1 second of audio
        const offlineCtx = new OfflineAudioContext(1, 44100 * 1.0, 44100);

        // --- RENDER BOMBO PARCHE ---
        const bomboGain = offlineCtx.createGain();
        bomboGain.connect(offlineCtx.destination);

        // 1. MEMBRANE
        const membraneOsc = offlineCtx.createOscillator();
        membraneOsc.type = 'sine';
        membraneOsc.frequency.setValueAtTime(80, 0);
        membraneOsc.frequency.exponentialRampToValueAtTime(35, 0.4);

        const membraneGain = offlineCtx.createGain();
        membraneOsc.connect(membraneGain);
        membraneGain.connect(bomboGain);

        membraneGain.gain.setValueAtTime(0, 0);
        membraneGain.gain.linearRampToValueAtTime(0.9, 0.008);
        membraneGain.gain.exponentialRampToValueAtTime(0.01, 0.5);
        membraneOsc.start(0);

        // 2. SHELL
        const shellOsc = offlineCtx.createOscillator();
        shellOsc.type = 'triangle';
        const shellFilter = offlineCtx.createBiquadFilter();
        shellFilter.type = 'bandpass';
        shellFilter.frequency.value = 140;
        shellFilter.Q.value = 2;

        const shellGain = offlineCtx.createGain();
        shellOsc.connect(shellFilter);
        shellFilter.connect(shellGain);
        shellGain.connect(bomboGain);

        shellOsc.frequency.value = 90;
        shellGain.gain.setValueAtTime(0, 0);
        shellGain.gain.linearRampToValueAtTime(0.4, 0.01);
        shellGain.gain.exponentialRampToValueAtTime(0.01, 0.2);
        shellOsc.start(0);

        // 3. ATTACK (Noise needs to be generated manually for offline context or reused?)
        // Minimal synth for attack
        const noiseData = offlineCtx.createBuffer(1, 44100, 44100);
        const nd = noiseData.getChannelData(0);
        for (let i = 0; i < noiseData.length; i++) nd[i] = Math.random() * 2 - 1;

        const clickSrc = offlineCtx.createBufferSource();
        clickSrc.buffer = noiseData;
        const clickFilter = offlineCtx.createBiquadFilter();
        clickFilter.type = 'highpass';
        clickFilter.frequency.value = 2500;
        const clickGain = offlineCtx.createGain();
        clickSrc.connect(clickFilter);
        clickFilter.connect(clickGain);
        clickGain.connect(bomboGain);

        clickGain.gain.setValueAtTime(0.4, 0);
        clickGain.gain.exponentialRampToValueAtTime(0.001, 0.02);
        clickSrc.start(0);

        this.bomboBuffer = await offlineCtx.startRendering();

        // --- RENDER BOMBO ARO ---
        const aroCtx = new OfflineAudioContext(1, 44100 * 0.5, 44100);
        const aroOut = aroCtx.createGain();
        aroOut.connect(aroCtx.destination);

        const aroNoise = aroCtx.createBufferSource();
        aroNoise.buffer = noiseData; // Reuse noise buffer data

        const f1 = aroCtx.createBiquadFilter();
        f1.type = 'bandpass'; f1.frequency.value = 1600; f1.Q.value = 6;
        const g1 = aroCtx.createGain();
        aroNoise.connect(f1); f1.connect(g1); g1.connect(aroOut);
        g1.gain.setValueAtTime(0, 0); g1.gain.linearRampToValueAtTime(0.8, 0.002); g1.gain.exponentialRampToValueAtTime(0.01, 0.08);

        const f2 = aroCtx.createBiquadFilter();
        f2.type = 'bandpass'; f2.frequency.value = 2800; f2.Q.value = 8;
        const g2 = aroCtx.createGain();
        aroNoise.connect(f2); f2.connect(g2); g2.connect(aroOut);
        g2.gain.setValueAtTime(0, 0); g2.gain.linearRampToValueAtTime(0.5, 0.002); g2.gain.exponentialRampToValueAtTime(0.01, 0.05);

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
        }
    }

    /**
     * Plays a Rock Kick Drum (Tight, punchy).
     * (ES) Reproduce un Bombo de Rock (Ajustado, con pegada).
     */
    public playRockKick(time: number, velocity: number = 1.0) {
        const osc = this.context.createOscillator();
        const gain = this.getGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

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
        const osc = this.context.createOscillator();
        const gain = this.getGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

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
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

        // Deep/Muffled
        osc.frequency.setValueAtTime(45, time);
        osc.frequency.exponentialRampToValueAtTime(35, time + 0.3);

        gain.gain.setValueAtTime(velocity, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);

        osc.start(time);
        osc.stop(time + 0.45);
    }

    /**
   * Plays a Shaker.
   * Filtered noise with short envelope.
   */
    public playShaker(time: number, velocity: number) {
        if (!this.noiseBuffer) return;

        const source = this.context.createBufferSource();
        source.buffer = this.noiseBuffer;

        const filter = this.context.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 6000;
        filter.Q.value = 1;

        const gain = this.context.createGain();

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        gain.gain.setValueAtTime(velocity * 0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

        source.start(time);
        source.stop(time + 0.1);
    }

    /**
     * Plays a Crash Cymbal.
     */
    public playCrash(time: number, velocity: number) {
        if (!this.noiseBuffer) return;

        const source = this.context.createBufferSource();
        source.buffer = this.noiseBuffer;

        const filter = this.context.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2000;

        const gain = this.context.createGain();

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        gain.gain.setValueAtTime(velocity * 0.8, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 1.5); // Long decay

        source.start(time);
        source.stop(time + 1.5);
    }

    /**
    * Plays a Ride Cymbal.
    * NEW IMPLEMENTATION: Pure FM Bell + Metallic Sustain.
    */
    /**
    * Plays a Ride Cymbal.
    * Improved: More complex metallic wash + high frequency stick impact.
    */
    public playRide(time: number, velocity: number) {
        // A. Stick Impact - Sharp, high-frequency "ping" (Dry)
        const impact = this.context.createOscillator();
        const impactGain = this.getGain();
        impact.connect(impactGain);
        impactGain.connect(this.masterGain);

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
            noiseGain.connect(this.masterGain);

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
        humGain.connect(this.masterGain);

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
        // 1. Tonal component (Body)
        const osc = this.context.createOscillator();
        const oscGain = this.getGain();
        osc.connect(oscGain);
        oscGain.connect(this.masterGain);

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
            noiseGain.connect(this.masterGain);

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
        gain.connect(this.masterGain);

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
        gain.connect(this.masterGain);

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
        gain.connect(this.masterGain);

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
        if (!this.aroBuffer) return;

        const source = this.context.createBufferSource();
        source.buffer = this.aroBuffer;

        const dynamicsFilter = this.getFilter();
        dynamicsFilter.type = 'lowpass';
        dynamicsFilter.frequency.value = 2000 + (10000 * Math.pow(velocity, 2));

        const gain = this.getGain();
        source.connect(dynamicsFilter);
        dynamicsFilter.connect(gain);
        gain.connect(this.masterGain);

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
        const osc = this.context.createOscillator();
        const gain = this.getGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(2500, time); // High pitched wood

        gain.gain.setValueAtTime(velocity, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

        osc.onended = () => this.releaseGain(gain);
        osc.start(time);
        osc.stop(time + 0.11);
    }

    /**
     * Plays a standard Metronome Click.
     */
    public playClick(time: number, velocity: number = 1.0) {
        const osc = this.context.createOscillator();
        const gain = this.getGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

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
}

export default DrumSynthesizer;
