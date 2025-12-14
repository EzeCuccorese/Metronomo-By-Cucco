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

    public play(instrument: string, time: number, velocity: number) {
        switch (instrument) {
            case 'bombo_parche': this.playBomboLegueroParche(time, velocity); break;
            case 'bombo_aro': this.playBomboLegueroAro(time, velocity); break;
            case 'kick': this.playRockKick(time, velocity); break;
            case 'snare': this.playRockSnare(time, velocity); break;
            case 'hihat_closed': this.playHiHat(time, velocity, false); break;
            case 'hihat_open': this.playHiHat(time, velocity, true); break;
            case 'click': this.playClick(time, velocity); break;
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
     * Plays a Rock Snare Drum (Tone + Noise).
     * (ES) Reproduce un Redoblante de Rock (Tono + Ruido).
     */
    public playRockSnare(time: number, velocity: number = 1.0) {
        // 1. Tonal component (Body)
        const osc = this.context.createOscillator();
        const oscGain = this.context.createGain();
        osc.connect(oscGain);
        oscGain.connect(this.context.destination);

        osc.frequency.setValueAtTime(250, time);
        oscGain.gain.setValueAtTime(velocity * 0.5, time);
        oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

        osc.start(time);
        osc.stop(time + 0.2);

        // 2. Noise component (Snares)
        if (!this.noiseBuffer) return;
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

    /**
     * Plays a Hi-Hat using multiple square waves for metallic sound.
     * (ES) Reproduce un Hi-Hat usando múltiples ondas cuadradas para sonido metálico.
     */
    public playHiHat(time: number, velocity: number = 1.0, open: boolean = false) {
        // Simplified metallic noise using high-pass filtered noise for standard efficiency
        // (ES) Ruido metálico simplificado usando ruido filtrado paso-alto para eficiencia
        if (!this.noiseBuffer) return;

        const source = this.context.createBufferSource();
        source.buffer = this.noiseBuffer;

        const filter = this.context.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 7000;

        const gain = this.context.createGain();

        // Envelope: Short for closed, longer for open
        const decay = open ? 0.3 : 0.05;

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
     * Low frequency, deep, with a "skin" texture.
     * (ES) Reproduce el sonido de "Parche" de un Bombo Legüero.
     * Frecuencia baja, profunda, con textura de "piel".
     */
    public playBomboLegueroParche(time: number, velocity: number = 1.0) {
        // Deep, earthy thud. Wood shell resonance + skin tension.

        // 1. Fundamental (Skin) - Soft Sine
        const osc = this.context.createOscillator();
        osc.type = 'sine';
        const gain = this.context.createGain();

        osc.connect(gain);
        gain.connect(this.context.destination);

        // Pitch drop: 70Hz -> 40Hz (Slower drop for "looser" skin feel)
        osc.frequency.setValueAtTime(80, time);
        osc.frequency.exponentialRampToValueAtTime(35, time + 0.3);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(velocity * 0.9, time + 0.01); // Softer attack
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4); // Long sustain

        osc.start(time);
        osc.stop(time + 0.45);

        // 2. Body Resonance (Wood Shell) - Low passed Square/Saw mix
        // This gives the "box" sound.
        const shellOsc = this.context.createOscillator();
        shellOsc.type = 'square';
        const shellFilter = this.context.createBiquadFilter();
        shellFilter.type = 'lowpass';
        shellFilter.frequency.value = 120; // Muffly wood

        const shellGain = this.context.createGain();
        shellOsc.connect(shellFilter);
        shellFilter.connect(shellGain);
        shellGain.connect(this.context.destination);

        shellOsc.frequency.value = 65; // Constant low resonance
        shellGain.gain.setValueAtTime(velocity * 0.3, time);
        shellGain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

        shellOsc.start(time);
        shellOsc.stop(time + 0.2);

        // 3. Attack Click (Skin slap) - Filtered Noise
        if (this.noiseBuffer) {
            const noise = this.context.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = this.context.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 600; // Thuddy attack, not clicky

            const noiseGain = this.context.createGain();
            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(this.context.destination);

            noiseGain.gain.setValueAtTime(velocity * 0.5, time);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

            noise.start(time);
            noise.stop(time + 0.05);
        }
    }

    public playBomboLegueroAro(time: number, velocity: number = 1.0) {
        // Woodblock / Rim style.
        // High resonance bandpass filter on noise/pulse.

        // 1. Main Wood Tone (Resonant Filtered Noise)
        if (this.noiseBuffer) {
            const noise = this.context.createBufferSource();
            noise.buffer = this.noiseBuffer;

            // Dual resonance for complex wood sound
            const filter1 = this.context.createBiquadFilter();
            filter1.type = 'bandpass';
            filter1.frequency.value = 1600; // Main pitch
            filter1.Q.value = 8; // High resonance -> tones

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
    }/**
     * Plays a standard Metronome Click.
     * High pitch beep (Sine wave with fast decay).
     * (ES) Click de metrónomo estándar.
     */
    public playClick(time: number, velocity: number = 1.0) {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.connect(gain);
        gain.connect(this.context.destination);

        // High pitch (1000Hz for accent, 800Hz for others - managed by caller or velocity?)
        // Let's use velocity to detune slightly if needed, or just fixed pitch.
        // Accent usually higher pitch.
        const pitch = velocity > 0.9 ? 1200 : 800;
        osc.frequency.setValueAtTime(pitch, time);

        gain.gain.setValueAtTime(velocity, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

        osc.start(time);
        osc.stop(time + 0.1);
    }
}

export default DrumSynthesizer;
