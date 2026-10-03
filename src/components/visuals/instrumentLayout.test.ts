import { describe, expect, it } from 'vitest';
import {
    BOMBO,
    CANVAS_H,
    CANVAS_W,
    SCALE_KEYS,
    SPRING_DAMPING,
    SPRING_STIFFNESS,
    advanceAndPrune,
    advanceParticle,
    advanceRipple,
    createParticle,
    createRipple,
    hitTestInstrument,
    initialScales,
    initialVelocities,
    reducedScale,
    springStep,
    stepBoost,
    stepTrigger,
    toCanvasCoords,
} from './instrumentLayout';

describe('toCanvasCoords', () => {
    it('maps client pixels into 380x175 logical space', () => {
        const rect = { left: 10, top: 20, width: 760, height: 350 };
        expect(toCanvasCoords(10, 20, rect)).toEqual({ x: 0, y: 0 });
        expect(toCanvasCoords(770, 370, rect)).toEqual({ x: CANVAS_W, y: CANVAS_H });
        expect(toCanvasCoords(390, 195, rect)).toEqual({ x: 190, y: 87.5 });
    });

    it('returns the origin for a collapsed (zero-size) canvas', () => {
        expect(toCanvasCoords(5, 5, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
    });
});

describe('initial state', () => {
    it('starts every instrument at rest', () => {
        expect(Object.keys(initialScales())).toEqual([...SCALE_KEYS]);
        expect(Object.values(initialScales()).every(v => v === 1)).toBe(true);
        expect(Object.values(initialVelocities()).every(v => v === 0)).toBe(true);
    });
});

describe('hitTestInstrument', () => {
    it.each([
        [45, 40, 'clave', 'clave'],
        [105, 40, 'caja', 'caja'],
        [179, 45, 'candombe_chico', 'candombe_chico'],
        [195, 45, 'candombe_repique', 'candombe_repique'],
        [211, 45, 'candombe_piano', 'candombe_piano'],
        [180, 115, 'cajon', 'cajon'],
        [235, 115, 'palmas', 'palmas'],
        [290, 40, 'hihat', 'hihat'],
        [345, 40, 'snare', 'snare'],
        [300, 115, 'kick', 'kick'],
        [345, 115, 'shaker', 'shaker'],
    ])('hits (%i,%i) -> %s', (x, y, key, instrument) => {
        expect(hitTestInstrument(x, y)).toMatchObject({ key, instrument });
    });

    it('distinguishes bombo parche, aro and body', () => {
        const top = BOMBO.centerY - BOMBO.height / 2;
        expect(hitTestInstrument(BOMBO.x, top)).toMatchObject({ key: 'bombo_parche', instrument: 'bombo_leguero', rippleRadius: 42 });
        // Inside the outer ellipse but outside the inner (parche) ellipse
        expect(hitTestInstrument(BOMBO.x + BOMBO.rx - 1, top)).toMatchObject({ key: 'bombo_aro', instrument: 'rim', rippleRadius: 36 });
        // Below the head, within the body
        expect(hitTestInstrument(BOMBO.x, top + 30)).toMatchObject({ key: 'bombo_parche', instrument: 'bombo_leguero' });
    });

    it('respects radius edges', () => {
        expect(hitTestInstrument(45 + 18, 40)).not.toBeNull();
        expect(hitTestInstrument(45 + 19, 40)).toBeNull();
        expect(hitTestInstrument(180 + 11, 115)).toBeNull(); // cajón uses strict bounds
        expect(hitTestInstrument(180 + 10, 115 + 18)).toMatchObject({ key: 'cajon' });
    });

    it('returns null on empty space and outside the canvas', () => {
        expect(hitTestInstrument(1, 1)).toBeNull();
        expect(hitTestInstrument(-50, -50)).toBeNull();
        expect(hitTestInstrument(CANVAS_W + 100, CANVAS_H + 100)).toBeNull();
    });
});

describe('stepTrigger', () => {
    it('distinguishes bombo aro from parche', () => {
        expect(stepTrigger('bombo_leguero', 'aro')).toMatchObject({ key: 'bombo_aro', y: 85 });
        expect(stepTrigger('bombo_leguero')).toMatchObject({ key: 'bombo_parche', y: 115 });
        expect(stepTrigger('rim')).toMatchObject({ key: 'bombo_aro' });
    });

    it('aliases instruments onto shared drawables', () => {
        expect(stepTrigger('surdo')).toEqual(stepTrigger('kick'));
        expect(stepTrigger('hihat_foot')).toEqual(stepTrigger('hihat'));
        expect(stepTrigger('ride')).toEqual(stepTrigger('hihat'));
    });

    it.each(['caja', 'cajon', 'palmas', 'candombe_chico', 'candombe_repique', 'candombe_piano', 'snare', 'clave', 'shaker'])(
        'maps %s to its own key',
        inst => {
            const t = stepTrigger(inst)!;
            expect(t.key).toBe(inst);
            expect(t.maxRadius).toBeGreaterThan(0);
        },
    );

    it('ignores unknown instruments', () => {
        expect(stepTrigger('cowbell')).toBeNull();
    });

    it('only produces known scale keys', () => {
        for (const inst of ['bombo_leguero', 'rim', 'kick', 'hihat', 'caja']) {
            expect(SCALE_KEYS).toContain(stepTrigger(inst)!.key);
        }
    });
});

describe('stepBoost', () => {
    it('scales with velocity and defaults to 1', () => {
        expect(stepBoost(1)).toBeCloseTo(0.35);
        expect(stepBoost(0.5)).toBeCloseTo(0.175);
        expect(stepBoost(undefined)).toBeCloseTo(0.35);
        expect(stepBoost(0)).toBeCloseTo(0.35);
    });
});

describe('springStep', () => {
    it('stays at rest at scale 1', () => {
        expect(springStep(1, 0)).toEqual({ scale: 1, velocity: 0 });
    });

    it('applies stiffness then damping', () => {
        const r = springStep(0.5, 0);
        expect(r.velocity).toBeCloseTo(0.5 * SPRING_STIFFNESS * SPRING_DAMPING);
        expect(r.scale).toBeCloseTo(0.5 + r.velocity);
    });

    it('settles back to 1 after an impulse', () => {
        let s = { scale: 1, velocity: 0.4 };
        for (let i = 0; i < 200; i++) s = springStep(s.scale, s.velocity);
        expect(s.scale).toBeCloseTo(1, 4);
        expect(Math.abs(s.velocity)).toBeLessThan(1e-4);
    });
});

describe('reducedScale', () => {
    it('emphasises highlighted instruments only', () => {
        expect(reducedScale(true)).toBeGreaterThan(1);
        expect(reducedScale(false)).toBe(1);
    });
});

describe('ripples', () => {
    it('creates and advances until faded', () => {
        const rp = createRipple(10, 20, '#fff', 20);
        expect(rp).toMatchObject({ x: 10, y: 20, radius: 4, maxRadius: 20, opacity: 1, speed: 1.6 });
        let frames = 0;
        while (advanceRipple(rp)) frames++;
        expect(frames).toBeGreaterThan(5);
        expect(rp.opacity).toBeLessThanOrEqual(0);
    });
});

describe('particles', () => {
    it('is deterministic with an injected rng', () => {
        const p = createParticle(1, 2, '#abc', () => 0);
        expect(p).toEqual({ x: 1, y: 2, vx: 0.8, vy: 0, color: '#abc', size: 1.2, alpha: 1, decay: 0.025 });
    });

    it('uses Math.random by default within documented ranges', () => {
        const p = createParticle(0, 0, '#000');
        expect(Math.hypot(p.vx, p.vy)).toBeGreaterThanOrEqual(0.8 - 1e-9);
        expect(Math.hypot(p.vx, p.vy)).toBeLessThanOrEqual(3.6 + 1e-9);
        expect(p.size).toBeGreaterThanOrEqual(1.2);
        expect(p.decay).toBeGreaterThanOrEqual(0.025);
    });

    it('moves with gravity and fades out', () => {
        const p = createParticle(0, 0, '#000', () => 0);
        expect(advanceParticle(p)).toBe(true);
        expect(p.x).toBeCloseTo(0.8);
        expect(p.vy).toBeCloseTo(0.045);
        expect(p.alpha).toBeCloseTo(0.975);
        let alive = true;
        for (let i = 0; i < 100 && alive; i++) alive = advanceParticle(p);
        expect(alive).toBe(false);
    });
});

describe('advanceAndPrune', () => {
    it('advances every item exactly once', () => {
        const items = [{ n: 0 }, { n: 0 }, { n: 0 }];
        advanceAndPrune(items, it => {
            it.n++;
            return true;
        });
        expect(items.map(i => i.n)).toEqual([1, 1, 1]);
    });

    it('does not skip consecutive expired items (regression)', () => {
        const seen: number[] = [];
        const items = [1, 2, 3, 4, 5];
        const out = advanceAndPrune(items, n => {
            seen.push(n);
            return n === 5;
        });
        expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
        expect(out).toEqual([5]);
    });

    it('keeps survivor order and handles empty lists', () => {
        expect(advanceAndPrune([1, 2, 3, 4], n => n % 2 === 0)).toEqual([2, 4]);
        expect(advanceAndPrune([], () => true)).toEqual([]);
    });
});
