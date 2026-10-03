/** Offline-rendered buffers for the bombo legüero (cheaper than synthesizing per hit). */

/** Renders the deep bombo head (parche) hit. */
export function renderBomboParche(): Promise<AudioBuffer> {
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

    return bomboCtx.startRendering();
}

/** Renders the bombo rim (aro) click using FM synthesis. */
export function renderBomboAro(): Promise<AudioBuffer> {
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

    return aroCtx.startRendering();
}
