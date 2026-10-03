import { describe, expect, it } from 'vitest';
import {
    BOMBO_ARO_FROM,
    MIN_HIT,
    STACK_BREAKPOINT,
    computeLayout,
    contentBox,
    fitImageToPad,
    itemByKey,
    padKey,
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
    it('maps client pixels into layout space', () => {
        const rect = { left: 10, top: 20, width: 760, height: 350 };
        const logical = { width: 380, height: 175 };
        expect(toCanvasCoords(10, 20, rect, logical)).toEqual({ x: 0, y: 0 });
        expect(toCanvasCoords(770, 370, rect, logical)).toEqual({ x: 380, y: 175 });
        expect(toCanvasCoords(390, 195, rect, logical)).toEqual({ x: 190, y: 87.5 });
    });

    it('returns the origin for a collapsed (zero-size) canvas', () => {
        const z = { left: 0, top: 0, width: 0, height: 0 };
        expect(toCanvasCoords(5, 5, z, { width: 1, height: 1 })).toEqual({ x: 0, y: 0 });
    });
});

describe('initial state', () => {
    it('starts every instrument at rest', () => {
        expect(Object.keys(initialScales())).toEqual([...SCALE_KEYS]);
        expect(Object.values(initialScales()).every(v => v === 1)).toBe(true);
        expect(Object.values(initialVelocities()).every(v => v === 0)).toBe(true);
    });
});

const WIDTHS = [320, 360, 390, 600, 699, 700, 768, 1024, 1440, 1920];

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: { x: number; y: number; w: number; h: number }, o: { x: number; y: number; w: number; h: number }) =>
    a.x >= o.x - 1e-6 && a.y >= o.y - 1e-6 && a.x + a.w <= o.x + o.w + 1e-6 && a.y + a.h <= o.y + o.h + 1e-6;

describe('computeLayout', () => {
    it('is row mode from the breakpoint up and stacks below it', () => {
        expect(computeLayout(STACK_BREAKPOINT - 1).mode).toBe('stack');
        expect(computeLayout(STACK_BREAKPOINT).mode).toBe('row');
        const stacked = computeLayout(390);
        expect(stacked.height).toBeGreaterThan(computeLayout(1440).height * 2);
    });

    it('places every instrument exactly once', () => {
        const keys = computeLayout(800).items.map(i => i.key).sort();
        expect(new Set(keys).size).toBe(12);
        expect(keys).toEqual([...keys].sort());
    });

    it.each(WIDTHS)('width %i: sections fit the canvas and never overlap', w => {
        const l = computeLayout(w, 2);
        const canvas = { x: 0, y: 0, w: l.width, h: l.height };
        l.sections.forEach(s => expect(inside(s.rect, canvas)).toBe(true));
        for (let i = 0; i < l.sections.length; i++) {
            for (let j = i + 1; j < l.sections.length; j++) {
                expect(overlaps(l.sections[i].rect, l.sections[j].rect)).toBe(false);
            }
        }
    });

    it.each(WIDTHS)('width %i: labels are inside their section and never overlap', w => {
        const l = computeLayout(w);
        l.sections.forEach(s => expect(inside(s.labelRect, s.rect)).toBe(true));
        for (let i = 0; i < l.sections.length; i++) {
            for (let j = i + 1; j < l.sections.length; j++) {
                expect(overlaps(l.sections[i].labelRect, l.sections[j].labelRect)).toBe(false);
            }
        }
    });

    it.each(WIDTHS)('width %i: pads and names sit inside their section without overlapping', w => {
        const l = computeLayout(w);
        l.items.forEach(it => {
            const sec = l.sections.find(s => s.id === it.section)!;
            const pad = { x: it.cx - it.r, y: it.cy - it.r, w: 2 * it.r, h: 2 * it.r };
            const name = { x: it.nameX - it.nameMaxW / 2, y: it.nameY, w: it.nameMaxW, h: 12 };
            expect(inside(pad, sec.rect)).toBe(true);
            expect(inside(name, sec.rect)).toBe(true);
            expect(overlaps(pad, sec.labelRect)).toBe(false);
        });
        for (let i = 0; i < l.items.length; i++) {
            for (let j = i + 1; j < l.items.length; j++) {
                const a = l.items[i], b = l.items[j];
                expect(Math.hypot(a.cx - b.cx, a.cy - b.cy)).toBeGreaterThanOrEqual(a.r + b.r - 1e-6);
            }
        }
    });

    it('keeps hit areas at least 44px from 360px width up', () => {
        for (const w of [360, 390, 600, 768, 1440]) {
            computeLayout(w).items.forEach(it => expect(it.hitR * 2).toBeGreaterThanOrEqual(MIN_HIT));
        }
    });

    it('keeps adjacent hit areas from swallowing each other', () => {
        for (const w of [360, 700, 1440]) {
            const l = computeLayout(w);
            l.items.forEach((a, i) => l.items.slice(i + 1).forEach(b => {
                expect(Math.hypot(a.cx - b.cx, a.cy - b.cy)).toBeGreaterThanOrEqual(a.hitR + b.hitR - 1e-6);
            }));
        }
    });

    it('uses one pad size for all instruments and snaps the height to device pixels', () => {
        const l = computeLayout(1000, 3);
        expect(new Set(l.items.map(i => i.r)).size).toBe(1);
        expect(Math.abs(l.height * 3 - Math.round(l.height * 3))).toBeLessThan(1e-9);
    });

    it('survives degenerate widths', () => {
        expect(computeLayout(0).items).toHaveLength(12);
        expect(computeLayout(-5, 0).width).toBe(1);
    });
});

describe('hitTestInstrument', () => {
    it.each([320, 360, 390, 768, 1440])('width %i: every instrument center hits that instrument', w => {
        const l = computeLayout(w);
        for (const it of l.items) {
            const h = hitTestInstrument(l, it.cx, it.cy);
            expect(h).toMatchObject({ key: it.key, instrument: it.instrument });
        }
    });

    it('hits near the edge of the 44px target but not beyond', () => {
        const l = computeLayout(360);
        const it = l.items[0];
        expect(hitTestInstrument(l, it.cx + it.hitR - 0.5, it.cy)?.key).toBe(it.key);
        expect(hitTestInstrument(l, it.cx + it.hitR + 6, it.cy + it.hitR + 6)).toBeNull();
    });

    it('distinguishes bombo parche from aro', () => {
        const l = computeLayout(800);
        const b = itemByKey(l, 'bombo_parche')!;
        expect(hitTestInstrument(l, b.cx, b.cy)).toMatchObject({ key: 'bombo_parche', instrument: 'bombo_leguero' });
        const rim = hitTestInstrument(l, b.cx + b.r * (BOMBO_ARO_FROM + 0.1), b.cy);
        expect(rim).toMatchObject({ key: 'bombo_aro', instrument: 'rim' });
    });

    it('returns null on empty space and outside the canvas', () => {
        const l = computeLayout(800);
        expect(hitTestInstrument(l, 1, 1)).toBeNull();
        expect(hitTestInstrument(l, -50, -50)).toBeNull();
        expect(hitTestInstrument(l, l.width + 50, l.height + 50)).toBeNull();
    });
});

describe('image normalisation', () => {
    const rgba = (w: number, h: number, fill: (x: number, y: number) => [number, number, number, number]) => {
        const d = new Uint8ClampedArray(w * h * 4);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(fill(x, y), (y * w + x) * 4);
        return d;
    };

    it('finds the bright content box on a dark background', () => {
        const data = rgba(20, 10, (x, y) => (x >= 4 && x < 12 && y >= 2 && y < 8 ? [200, 150, 90, 255] : [5, 5, 5, 255]));
        expect(contentBox(data, 20, 10)).toEqual({ x: 4, y: 2, w: 8, h: 6 });
    });

    it('ignores transparent pixels and falls back to the full image when empty', () => {
        const transparent = rgba(6, 4, () => [255, 255, 255, 0]);
        expect(contentBox(transparent, 6, 4)).toEqual({ x: 0, y: 0, w: 6, h: 4 });
    });

    it('fits content so its longest side spans the requested pad fraction, centered', () => {
        const fit = fitImageToPad(100, 100, { x: 20, y: 40, w: 40, h: 20 }, 30, 0.8);
        const k = fit.dw / 100;
        expect(40 * k).toBeCloseTo(48); // 2 * 30 * 0.8
        expect(fit.dx + (20 + 20) * k).toBeCloseTo(0);
        expect(fit.dy + (40 + 10) * k).toBeCloseTo(0);
    });
});

describe('stepTrigger', () => {
    it('distinguishes bombo aro from parche', () => {
        expect(stepTrigger('bombo_leguero', 'aro')).toMatchObject({ key: 'bombo_aro', rim: true });
        expect(stepTrigger('bombo_leguero')).toMatchObject({ key: 'bombo_parche' });
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
            expect(t.radiusFactor).toBeGreaterThan(0);
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

describe('padKey', () => {
    it('maps the bombo aro onto the bombo pad', () => {
        expect(padKey('bombo_aro')).toBe('bombo_parche');
        expect(padKey('snare')).toBe('snare');
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
