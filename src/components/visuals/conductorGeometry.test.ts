import { describe, expect, it } from 'vitest';
import {
    MAX_SWING_ANGLE,
    MAX_TRAIL_LENGTH,
    conductorPath,
    easeCosine,
    getCountingText,
    hemiolaEllipsePosition,
    hemiolaLayout,
    hemiolaTrianglePosition,
    isBeatStart,
    nextPendulumAngle,
    nextPulseIntensity,
    normalizeBpm,
    pathPosition,
    pendulumLayout,
    pushTrailPoint,
    rodEndPoint,
    rodPointFromPivot,
    smoothStepPosition,
    stepDurationMs,
    swingTargetAngle,
    trailAlpha,
    weightPercent,
} from './conductorGeometry';
import type { TrailPoint } from './conductorGeometry';

describe('getCountingText', () => {
    it('numbers: only on beat starts', () => {
        expect(getCountingText(0, 16, 'numbers', [4, 4])).toBe('1');
        expect(getCountingText(4, 16, 'numbers', [4, 4])).toBe('2');
        expect(getCountingText(1, 16, 'numbers', [4, 4])).toBe('');
    });

    it('1&2&: beat numbers and the & at mid-beat', () => {
        expect(getCountingText(0, 8, '1&2&', [4, 4])).toBe('1');
        expect(getCountingText(1, 8, '1&2&', [4, 4])).toBe('&');
        expect(getCountingText(2, 16, '1&2&', [4, 4])).toBe('&');
        expect(getCountingText(6, 16, '1&2&', [4, 4])).toBe('&');
        expect(getCountingText(1, 16, '1&2&', [4, 4])).toBe('');
    });

    it('1e&a: four syllables per beat', () => {
        const out = [0, 1, 2, 3, 4].map(i => getCountingText(i, 16, '1e&a', [4, 4]));
        expect(out).toEqual(['1', 'e', '&', 'a', '2']);
    });

    it('triplet: 1 la le', () => {
        const out = [0, 1, 2, 3].map(i => getCountingText(i, 12, 'triplet_1la2la', [4, 4]));
        expect(out).toEqual(['1', 'la', 'le', '2']);
        expect(getCountingText(3, 16, 'triplet_1la2la', [4, 4])).toBe('');
    });

    it('chacarera mnemonics cycle every 6 steps', () => {
        const out = [0, 1, 2, 3, 4, 5, 6].map(i => getCountingText(i, 12, 'mnemonics_chacarera', [6, 8]));
        expect(out).toEqual(['MA', 'de', 'RA', 'PAR', 'che', 'PAR', 'MA']);
    });

    it('returns empty for unknown/undefined modes', () => {
        expect(getCountingText(0, 16, undefined, [4, 4])).toBe('');
        expect(getCountingText(0, 16, 'other', [4, 4])).toBe('');
    });
});

describe('pendulum swing', () => {
    it('swings left on even beats and right on odd beats', () => {
        expect(swingTargetAngle(0, 4)).toBeCloseTo(-MAX_SWING_ANGLE);
        expect(swingTargetAngle(4, 4)).toBeCloseTo(MAX_SWING_ANGLE);
        expect(swingTargetAngle(8, 4)).toBeCloseTo(-MAX_SWING_ANGLE);
    });

    it('crosses zero mid-beat', () => {
        expect(swingTargetAngle(2, 4)).toBeCloseTo(0);
    });

    it('detects beat starts', () => {
        expect(isBeatStart(0, 4)).toBe(true);
        expect(isBeatStart(8, 4)).toBe(true);
        expect(isBeatStart(3, 4)).toBe(false);
    });

    it('lerps toward the target, or snaps when motion is reduced', () => {
        expect(nextPendulumAngle(0, 1, false)).toBeCloseTo(0.18);
        expect(nextPendulumAngle(1, 1, false)).toBeCloseTo(1);
        expect(nextPendulumAngle(0.3, 0.7, true)).toBe(0.7);
    });

    it('decays the pulse, or ends it in one frame when reduced', () => {
        expect(nextPulseIntensity(1, false)).toBeCloseTo(0.95);
        expect(nextPulseIntensity(1, true)).toBe(0);
    });
});

describe('weight position', () => {
    it('normalises bpm within 40..240', () => {
        expect(normalizeBpm(40)).toBe(0);
        expect(normalizeBpm(240)).toBe(1);
        expect(normalizeBpm(140)).toBeCloseTo(0.5);
        expect(normalizeBpm(10)).toBe(0);
        expect(normalizeBpm(500)).toBe(1);
    });

    it('slower tempos put the weight higher on the rod', () => {
        expect(weightPercent(40)).toBeCloseTo(0.8);
        expect(weightPercent(240)).toBeCloseTo(0.35);
        expect(weightPercent(60)).toBeGreaterThan(weightPercent(180));
    });
});

describe('pendulumLayout', () => {
    const l = pendulumLayout(400, 200);

    it('derives the body and face proportions', () => {
        expect(l.centerX).toBe(200);
        expect(l.centerY).toBe(175);
        expect(l.baseWidth).toBeCloseTo(180);
        expect(l.topWidth).toBeCloseTo(48);
        expect(l.bodyHeight).toBeCloseTo(150);
        expect(l.apexY).toBeCloseTo(25);
        expect(l.faceWidthBase).toBeCloseTo(117);
        expect(l.faceWidthTop).toBeCloseTo(31.2);
        expect(l.faceHeight).toBeCloseTo(127.5);
        expect(l.faceY).toBeCloseTo(42.5);
        expect(l.rodLength).toBeCloseTo(142.5);
        expect(l.pivotX).toBe(200);
        expect(l.pivotY).toBe(165);
    });

    it('rod end is measured from the base, weight from the pivot', () => {
        expect(rodEndPoint(l, 0)).toEqual({ x: 200, y: 175 - 142.5 });
        const end = rodEndPoint(l, Math.PI / 2);
        expect(end.x).toBeCloseTo(200 + 142.5);
        expect(end.y).toBeCloseTo(175);
        const w = rodPointFromPivot(l, 0, 0.5);
        expect(w).toEqual({ x: 200, y: 165 - 71.25 });
        const w2 = rodPointFromPivot(l, Math.PI / 2, 1);
        expect(w2.x).toBeCloseTo(342.5);
        expect(w2.y).toBeCloseTo(165);
    });
});

describe('timing', () => {
    it('computes step duration', () => {
        // 120 bpm 4/4 with 16 steps: 2s bar / 16 = 125ms
        expect(stepDurationMs(120, [4, 4], 16)).toBeCloseTo(125);
        // 6/8: 1.5s bar / 12 steps
        expect(stepDurationMs(120, [6, 8], 12)).toBeCloseTo(125);
    });

    it('interpolates within a step, capped and disabled when reduced', () => {
        expect(smoothStepPosition(3, 50, 100, false)).toBeCloseTo(3.5);
        expect(smoothStepPosition(3, 500, 100, false)).toBeCloseTo(3.99);
        expect(smoothStepPosition(3, 50, 100, true)).toBe(3);
    });

    it('eases with a cosine curve', () => {
        expect(easeCosine(0)).toBeCloseTo(0);
        expect(easeCosine(0.5)).toBeCloseTo(0.5);
        expect(easeCosine(1)).toBeCloseTo(1);
        expect(easeCosine(0.25)).toBeLessThan(0.25);
    });
});

describe('conductorPath', () => {
    const w = 400;
    const h = 200;

    it('uses 3 points for 3 beats', () => {
        const p = conductorPath(3, w, h);
        expect(p).toHaveLength(3);
        expect(p[0]).toEqual({ x: 200, y: 155 });
        expect(p[1].x).toBe(355);
        expect(p[2]).toEqual({ x: 200, y: 45 });
    });

    it('uses 2 points for 2 and 6 beats', () => {
        for (const beats of [2, 6]) {
            const p = conductorPath(beats, w, h);
            expect(p).toEqual([
                { x: 140, y: 155 },
                { x: 260, y: 45 },
            ]);
        }
    });

    it('defaults to the 4-beat pattern', () => {
        for (const beats of [4, 5, 7]) {
            const p = conductorPath(beats, w, h);
            expect(p).toHaveLength(4);
            expect(p[1].x).toBe(45);
            expect(p[2].x).toBe(355);
            expect(p[1].y).toBeCloseTo(155 - 110 * 0.3);
        }
    });
});

describe('pathPosition', () => {
    const pts = [
        { x: 0, y: 0 },
        { x: 10, y: 20 },
        { x: 0, y: 40 },
    ];

    it('sits on a vertex at integer beats', () => {
        expect(pathPosition(pts, 0)).toEqual({ x: 0, y: 0 });
        expect(pathPosition(pts, 1)).toEqual({ x: 10, y: 20 });
    });

    it('is halfway at mid-beat (cosine ease midpoint)', () => {
        const p = pathPosition(pts, 0.5);
        expect(p.x).toBeCloseTo(5);
        expect(p.y).toBeCloseTo(10);
    });

    it('wraps around the closed path', () => {
        expect(pathPosition(pts, 3)).toEqual({ x: 0, y: 0 });
        const p = pathPosition(pts, 2.5);
        expect(p.x).toBeCloseTo(0);
        expect(p.y).toBeCloseTo(20);
    });
});

describe('hemiola', () => {
    const l = hemiolaLayout(400, 200);

    it('lays out the triangle and ellipse', () => {
        expect(l.triangle).toEqual([
            { x: 200, y: 155 },
            { x: 335, y: 115 },
            { x: 200, y: 45 },
        ]);
        expect(l.centerX).toBe(200);
        expect(l.centerY).toBe(100);
        expect(l.radiusX).toBeCloseTo(128);
        expect(l.radiusY).toBeCloseTo(44);
        expect(l.bottomY).toBe(155);
    });

    it('3/4 spark advances one corner every 4 steps', () => {
        expect(hemiolaTrianglePosition(l, 0)).toEqual({ x: 200, y: 155 });
        expect(hemiolaTrianglePosition(l, 4)).toEqual({ x: 335, y: 115 });
        expect(hemiolaTrianglePosition(l, 12)).toEqual({ x: 200, y: 155 });
    });

    it('6/8 spark starts at the top and completes a lap in 12 steps', () => {
        const start = hemiolaEllipsePosition(l, 0);
        expect(start.x).toBeCloseTo(200);
        expect(start.y).toBeCloseTo(100 - 44);
        const quarter = hemiolaEllipsePosition(l, 3);
        expect(quarter.x).toBeCloseTo(200 + 128);
        expect(quarter.y).toBeCloseTo(100);
        const lap = hemiolaEllipsePosition(l, 12);
        expect(lap.x).toBeCloseTo(start.x);
        expect(lap.y).toBeCloseTo(start.y);
    });
});

describe('trails', () => {
    it('appends points and caps the length', () => {
        const trail: TrailPoint[] = [];
        for (let i = 0; i < MAX_TRAIL_LENGTH + 5; i++) pushTrailPoint(trail, { x: i, y: 0 }, false);
        expect(trail).toHaveLength(MAX_TRAIL_LENGTH);
        expect(trail[0].x).toBe(5);
        expect(trail.at(-1)).toEqual({ x: MAX_TRAIL_LENGTH + 4, y: 0, alpha: 1 });
    });

    it('keeps only the latest point when motion is reduced', () => {
        const trail: TrailPoint[] = [];
        pushTrailPoint(trail, { x: 1, y: 1 }, true);
        pushTrailPoint(trail, { x: 2, y: 2 }, true);
        expect(trail).toEqual([{ x: 2, y: 2, alpha: 1 }]);
    });

    it('fades older points', () => {
        expect(trailAlpha(0, 10)).toBe(0);
        expect(trailAlpha(5, 10)).toBe(0.5);
        expect(trailAlpha(9, 10)).toBeCloseTo(0.9);
    });
});

describe('robustness', () => {
    it('smoothStepPosition ignores invalid durations', () => {
        expect(smoothStepPosition(2, 50, 0, false)).toBe(2);
        expect(smoothStepPosition(2, 50, -10, false)).toBe(2);
        expect(smoothStepPosition(2, 50, Infinity, false)).toBe(2);
        expect(smoothStepPosition(2, 50, NaN, false)).toBe(2);
    });

    it('pathPosition handles negative beat indexes', () => {
        const pts = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 20, y: 0 },
        ];
        expect(pathPosition(pts, -1)).toEqual({ x: 20, y: 0 });
        expect(pathPosition(pts, -3)).toEqual({ x: 0, y: 0 });
        const mid = pathPosition(pts, -0.5); // halfway between index -1 (20) and 0 (0)
        expect(mid.x).toBeCloseTo(10);
        expect(Number.isNaN(mid.x)).toBe(false);
    });

    it('pathPosition returns the origin for an empty path', () => {
        expect(pathPosition([], 3)).toEqual({ x: 0, y: 0 });
    });
});
