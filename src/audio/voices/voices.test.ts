import { describe, it, expect, vi } from 'vitest';
import type { VoiceHost } from './types';
import {
    synthBomboAro, synthBomboParche, synthClave, synthClick, synthCrash, synthHiHat,
    synthHiHatFoot, synthKick, synthRide, synthShaker, synthSnare, synthSurdo, synthTom,
} from './index';

function param() {
    return {
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
    };
}

function node() {
    return {
        connect: vi.fn(),
        frequency: param(),
        gain: param(),
        Q: param(),
        playbackRate: param(),
        type: '',
        buffer: null as unknown,
        onended: null as (() => void) | null,
        stop: vi.fn(),
    };
}

function makeHost(withBuffers: boolean) {
    const buf = withBuffers ? ({} as AudioBuffer) : null;
    let push = false;
    const started: unknown[] = [];
    const host: VoiceHost = {
        context: {
            createOscillator: () => node(),
            createBufferSource: () => node(),
            createGain: () => node(),
            createBiquadFilter: () => node(),
        } as unknown as AudioContext,
        noiseBuffer: buf,
        bomboBuffer: buf,
        aroBuffer: buf,
        getGain: () => node() as unknown as GainNode,
        getFilter: () => node() as unknown as BiquadFilterNode,
        releaseGain: vi.fn(),
        releaseFilter: vi.fn(),
        startVoice: (n) => { started.push(n); },
        connectVoiceToChannel: vi.fn(),
        nextShakerPush: () => { const p = push; push = !push; return p; },
    };
    return { host, started };
}

describe('synth voices', () => {
    it('ride still plays the impact ping and the hum when the noise buffer is missing', () => {
        const { host, started } = makeHost(false);
        synthRide(host, 0, 1);
        expect(started).toHaveLength(2);
    });

    it('start at least one voice and release pooled nodes on end when buffers are ready', () => {
        const { host, started } = makeHost(true);
        const voices = [
            () => synthKick(host, 0, 1),
            () => synthTom(host, 0, 1, 150, 'snare'),
            () => synthSurdo(host, 0, 1),
            () => synthSnare(host, 0, 1, true),
            () => synthSnare(host, 0, 1, false),
            () => synthClick(host, 0, 1),
            () => synthClick(host, 0, 0.5),
            () => synthHiHat(host, 0, 1, true),
            () => synthHiHat(host, 0, 1, false),
            () => synthHiHatFoot(host, 0, 1),
            () => synthCrash(host, 0, 1),
            () => synthRide(host, 0, 1),
            () => synthShaker(host, 0, 1),
            () => synthShaker(host, 0, 1),
            () => synthBomboParche(host, 0, 1),
            () => synthBomboAro(host, 0, 1),
            () => synthClave(host, 0, 1),
        ];
        voices.forEach((play) => {
            const before = started.length;
            play();
            expect(started.length).toBeGreaterThan(before);
            const last = started[started.length - 1] as { onended?: () => void };
            last.onended?.();
        });
    });

    it('buffer-based voices stay silent until their buffer exists', () => {
        const { host, started } = makeHost(false);
        synthHiHat(host, 0, 1, false);
        synthHiHatFoot(host, 0, 1);
        synthCrash(host, 0, 1);
        synthShaker(host, 0, 1);
        synthClave(host, 0, 1);
        synthBomboParche(host, 0, 1);
        synthBomboAro(host, 0, 1);
        expect(started).toHaveLength(0);
    });

    it('shaker alternates push/pull through the host', () => {
        const { host } = makeHost(true);
        const spy = vi.spyOn(host, 'nextShakerPush');
        synthShaker(host, 0, 1);
        synthShaker(host, 0, 1);
        expect(spy.mock.results.map((r) => r.value)).toEqual([false, true]);
    });
});
