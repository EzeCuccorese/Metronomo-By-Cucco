/** Offline-rendered buffers for the bombo legüero (cheaper than synthesizing per hit). */

function addParcheTransient(ctx: OfflineAudioContext, dest: AudioNode) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, 0);
    osc.frequency.exponentialRampToValueAtTime(55, 0.01);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(0.9, 0.001);
    gain.gain.exponentialRampToValueAtTime(0.001, 0.012);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(0);
}

function createPinkNoiseBuffer(ctx: OfflineAudioContext, seconds: number, sr: number): AudioBuffer {
    const buf = ctx.createBuffer(1, Math.round(sr * seconds), sr);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < buf.length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
    }
    return buf;
}

function addLeatherResonance(ctx: OfflineAudioContext, dest: AudioNode, sr: number) {
    const noise = ctx.createBufferSource();
    noise.buffer = createPinkNoiseBuffer(ctx, 0.6, sr);

    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.setValueAtTime(85, 0);
    low.Q.setValueAtTime(4.0, 0);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(150, 0);
    bp.Q.setValueAtTime(2.0, 0);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(0.75, 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, 0.25);

    const lowGain = ctx.createGain();
    lowGain.gain.setValueAtTime(0.8, 0);
    const bpGain = ctx.createGain();
    bpGain.gain.setValueAtTime(0.3, 0);

    noise.connect(low);
    low.connect(lowGain);
    lowGain.connect(gain);
    noise.connect(bp);
    bp.connect(bpGain);
    bpGain.connect(gain);
    gain.connect(dest);
    noise.start(0);
}

function addResonantMode(
    ctx: OfflineAudioContext,
    dest: AudioNode,
    spec: { type: OscillatorType; freq: number; peak: number; attack: number; decay: number }
) {
    const osc = ctx.createOscillator();
    osc.type = spec.type;
    osc.frequency.setValueAtTime(spec.freq, 0);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(spec.peak, spec.attack);
    gain.gain.exponentialRampToValueAtTime(0.001, spec.decay);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(0);
}

/** Renders the deep bombo head (parche) hit. */
export function renderBomboParche(sampleRate: number = 44100): Promise<AudioBuffer> {
    const sr = Math.max(8000, Math.round(sampleRate));
    const ctx = new OfflineAudioContext(1, Math.round(sr * 1.2), sr);
    const out = ctx.createGain();
    out.connect(ctx.destination);

    addParcheTransient(ctx, out);
    addLeatherResonance(ctx, out, sr);
    addResonantMode(ctx, out, { type: 'sine', freq: 58, peak: 0.9, attack: 0.015, decay: 0.7 });
    addResonantMode(ctx, out, { type: 'sine', freq: 58 * 1.59, peak: 0.35, attack: 0.01, decay: 0.18 });
    addResonantMode(ctx, out, { type: 'triangle', freq: 116, peak: 0.2, attack: 0.01, decay: 0.3 });

    return ctx.startRendering();
}

function addAroFm(ctx: OfflineAudioContext, dest: AudioNode) {
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(200, 0);
    modulator.type = 'sine';
    modulator.frequency.setValueAtTime(390, 0);
    modGain.gain.setValueAtTime(360, 0);
    modGain.gain.exponentialRampToValueAtTime(0.01, 0.03);

    const fmGain = ctx.createGain();
    fmGain.gain.setValueAtTime(0, 0);
    fmGain.gain.linearRampToValueAtTime(0.9, 0.001);
    fmGain.gain.exponentialRampToValueAtTime(0.001, 0.055);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(fmGain);
    fmGain.connect(dest);
    modulator.start(0);
    carrier.start(0);
}

function addAroCrack(ctx: OfflineAudioContext, dest: AudioNode, sr: number) {
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, Math.round(sr * 0.15), sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < buf.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, 0);
    filter.Q.setValueAtTime(3.0, 0);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(0.5, 0.001);
    gain.gain.exponentialRampToValueAtTime(0.001, 0.016);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(0);
}

/** Renders the bombo rim (aro) click using FM synthesis. */
export function renderBomboAro(sampleRate: number = 44100): Promise<AudioBuffer> {
    const sr = Math.max(8000, Math.round(sampleRate));
    const ctx = new OfflineAudioContext(1, Math.round(sr * 0.5), sr);
    const out = ctx.createGain();
    out.connect(ctx.destination);

    addAroFm(ctx, out);
    addResonantMode(ctx, out, { type: 'sine', freq: 580, peak: 0.25, attack: 0.001, decay: 0.02 });
    addAroCrack(ctx, out, sr);

    return ctx.startRendering();
}
