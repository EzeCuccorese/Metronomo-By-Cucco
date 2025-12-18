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

    constructor() {
        this.context = AudioContextManager.getInstance().getContext();
        this.createNoiseBuffer();
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
            case 'rim': this.playBomboLegueroAro(time, velocity); break; // Reuse
        }
    }

    /**
     * Plays a Rock Kick Drum (Tight, punchy).
     * (ES) Reproduce un Bombo de Rock (Ajustado, con pegada).
     */
    public playRockKick(time: number, velocity: number = 1.0) {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.connect(gain);
        gain.connect(this.context.destination);

        // Frequency sweep (50Hz -> 0Hz)
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);

        // Amplitude envelope
        gain.gain.setValueAtTime(velocity, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

        osc.start(time);
        osc.stop(time + 0.5);
    }

    /**
    * Plays a Tom (High, Low, Floor).
    */
    public playTom(time: number, velocity: number, pitch: number) {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.connect(gain);
        gain.connect(this.context.destination);

        // Pitch Drop - Faster and deeper for "dry" sound
        osc.frequency.setValueAtTime(pitch, time);
        osc.frequency.exponentialRampToValueAtTime(pitch * 0.2, time + 0.15); // Faster drop

        // Volume Envelope - Very short sustain
        gain.gain.setValueAtTime(velocity, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15); // Reduced boominess

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
        gain.connect(this.context.destination);

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
        gain.connect(this.context.destination);

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
        gain.connect(this.context.destination);

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
        const impactGain = this.context.createGain();
        impact.connect(impactGain);
        impactGain.connect(this.context.destination);

        impact.type = 'sine';
        impact.frequency.setValueAtTime(4500, time);

        impactGain.gain.setValueAtTime(velocity * 0.5, time);
        impactGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03); // Very short

        impact.start(time);
        impact.stop(time + 0.05);

        // B. The "Body" wash - Simulated edge hit using band-pass filtered noise
        if (!this.noiseBuffer) return;

        // Multiple band-passes for complex metallic shimmer
        const resonances = [6000, 8500, 11000];
        resonances.forEach((freq, i) => {
            const noise = this.context.createBufferSource();
            noise.buffer = this.noiseBuffer!;

            const filter = this.context.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = freq;
            filter.Q.value = 5;

            const noiseGain = this.context.createGain();

            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(this.context.destination);

            // Shimmer envelope
            noiseGain.gain.setValueAtTime(0, time);
            noiseGain.gain.linearRampToValueAtTime(velocity * (0.2 - (i * 0.05)), time + 0.02);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 1.2); // Clean decay

            noise.start(time);
            noise.stop(time + 1.2);
        });

        // C. Low-frequency metal "hum" (Very subtle, dry)
        const hum = this.context.createOscillator();
        const humGain = this.context.createGain();
        hum.connect(humGain);
        humGain.connect(this.context.destination);

        hum.type = 'triangle';
        hum.frequency.setValueAtTime(320, time);

        humGain.gain.setValueAtTime(0, time);
        humGain.gain.linearRampToValueAtTime(velocity * 0.1, time + 0.05);
        humGain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

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
        const oscGain = this.context.createGain();
        osc.connect(oscGain);
        oscGain.connect(this.context.destination);

        // Less extreme pitch difference for OFF, just slightly tighter
        const basePitch = snaresOn ? 250 : 280;
        osc.frequency.setValueAtTime(basePitch, time);
        osc.frequency.exponentialRampToValueAtTime(basePitch * 0.5, time + 0.15);

        oscGain.gain.setValueAtTime(velocity * 0.6, time);
        oscGain.gain.exponentialRampToValueAtTime(0.01, time + (snaresOn ? 0.2 : 0.15));

        osc.start(time);
        osc.stop(time + 0.25);

        // 2. Noise component (Snares)
        if (snaresOn && this.noiseBuffer) {
            const noise = this.context.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const noiseFilter = this.context.createBiquadFilter();
            noiseFilter.type = 'highpass';
            noiseFilter.frequency.value = 1000;
            const noiseGain = this.context.createGain();

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.context.destination);

            noiseGain.gain.setValueAtTime(velocity * 0.8, time);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.25);

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

        const filter = this.context.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 7000;

        const gain = this.context.createGain();

        // Envelope: Short for closed, longer for open
        const decay = open ? 0.4 : 0.05; // 400ms vs 50ms

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.context.destination);

        gain.gain.setValueAtTime(velocity * 0.6, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + decay);

        source.start(time);
        source.stop(time + decay);
    }

    /**
     * Plays the "Parche" (Head) sound of a Bombo Legüero.
     */
    public playBomboLegueroParche(time: number, velocity: number = 1.0) {
        // Deep, earthy thud. Wood shell resonance + skin tension.

        // 1. Fundamental (Skin) - Soft Sine
        const osc = this.context.createOscillator();
        osc.type = 'sine';
        const gain = this.context.createGain();

        osc.connect(gain);
        gain.connect(this.context.destination);

        // Low pitch
        osc.frequency.setValueAtTime(80, time);
        osc.frequency.exponentialRampToValueAtTime(35, time + 0.3);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(velocity * 0.9, time + 0.01); // Softer attack
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4); // Long sustain

        osc.start(time);
        osc.stop(time + 0.45);

        // 2. Body Resonance (Wood Shell)
        const shellOsc = this.context.createOscillator();
        shellOsc.type = 'square';
        const shellFilter = this.context.createBiquadFilter();
        shellFilter.type = 'lowpass';
        shellFilter.frequency.value = 120;

        const shellGain = this.context.createGain();
        shellOsc.connect(shellFilter);
        shellFilter.connect(shellGain);
        shellGain.connect(this.context.destination);

        shellOsc.frequency.value = 65;
        shellGain.gain.setValueAtTime(velocity * 0.3, time);
        shellGain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

        shellOsc.start(time);
        shellOsc.stop(time + 0.2);
    }

    public playBomboLegueroAro(time: number, velocity: number = 1.0) {
        // Woodblock / Rim style.
        if (this.noiseBuffer) {
            const noise = this.context.createBufferSource();
            noise.buffer = this.noiseBuffer;

            // Dual resonance for complex wood sound
            const filter1 = this.context.createBiquadFilter();
            filter1.type = 'bandpass';
            filter1.frequency.value = 1600; // Main pitch
            filter1.Q.value = 8;

            const filter2 = this.context.createBiquadFilter();
            filter2.type = 'bandpass';
            filter2.frequency.value = 2400; // Overtone
            filter2.Q.value = 8;

            const noiseGain = this.context.createGain();

            // Parallel filtering
            noise.connect(filter1);
            filter1.connect(noiseGain);

            noise.connect(filter2);
            filter2.connect(noiseGain);

            noiseGain.connect(this.context.destination);

            noiseGain.gain.setValueAtTime(0, time);
            noiseGain.gain.linearRampToValueAtTime(velocity, time + 0.005); // Super sharp attack
            noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.08); // Short decay (dry wood)

            noise.start(time);
            noise.stop(time + 0.1);
        }
    }

    /**
     * Plays a Clave sound.
     */
    public playClave(time: number, velocity: number = 1.0) {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.connect(gain);
        gain.connect(this.context.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(2500, time); // High pitched wood

        gain.gain.setValueAtTime(velocity, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

        osc.start(time);
        osc.stop(time + 0.11);
    }

    /**
     * Plays a standard Metronome Click.
     */
    public playClick(time: number, velocity: number = 1.0) {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.connect(gain);
        gain.connect(this.context.destination);

        // Fixed velocity threshold for pitch differentiation
        const forte = velocity > 0.8;
        const pitch = forte ? 1500 : 800;
        osc.frequency.setValueAtTime(pitch, time);

        gain.gain.setValueAtTime(velocity, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + (forte ? 0.08 : 0.05));

        osc.start(time);
        osc.stop(time + 0.1);
    }
}

export default DrumSynthesizer;
