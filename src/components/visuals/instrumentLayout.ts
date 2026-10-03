/** Pure (canvas-free) layout, hit-testing and animation-state logic for InteractiveInstrumentVisual. */

export const CANVAS_W = 380;
export const CANVAS_H = 175;

export const SPRING_STIFFNESS = 0.2;
export const SPRING_DAMPING = 0.78;
export const CLICK_BOOST = 0.4;

/** Keys of the spring-scaled drawable instruments. */
export const SCALE_KEYS = [
    'bombo_parche', 'bombo_aro', 'snare', 'kick', 'hihat', 'clave', 'shaker',
    'caja', 'cajon', 'palmas', 'candombe_chico', 'candombe_repique', 'candombe_piano',
] as const;

export type ScaleKey = (typeof SCALE_KEYS)[number];

export interface Ripple {
    x: number;
    y: number;
    color: string;
    radius: number;
    maxRadius: number;
    opacity: number;
    speed: number;
}

export interface SparkParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    alpha: number;
    decay: number;
}

export const initialScales = (): Record<string, number> =>
    Object.fromEntries(SCALE_KEYS.map(k => [k, 1.0]));

export const initialVelocities = (): Record<string, number> =>
    Object.fromEntries(SCALE_KEYS.map(k => [k, 0]));

/** Maps a client-space pointer position to the 380x175 logical canvas space. */
export function toCanvasCoords(
    clientX: number,
    clientY: number,
    rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
    return {
        x: (clientX - rect.left) * (CANVAS_W / rect.width),
        y: (clientY - rect.top) * (CANVAS_H / rect.height),
    };
}

/** Result of clicking an instrument on the canvas. */
export interface InstrumentHit {
    key: ScaleKey;
    /** Instrument id passed to the preview callback. */
    instrument: string;
    color: string;
    rippleRadius: number;
}

const dist = (x: number, y: number, cx: number, cy: number) => Math.hypot(x - cx, y - cy);

// Bombo legüero geometry
export const BOMBO = { x: 75, centerY: 115, height: 52, rx: 22, ry: 9 } as const;
const BOMBO_Y_TOP = BOMBO.centerY - BOMBO.height / 2; // 89

const hit = (key: ScaleKey, instrument: string, color: string, rippleRadius: number): InstrumentHit =>
    ({ key, instrument, color, rippleRadius });

/** Hit-test in click order (first match wins). Coordinates are in 380x175 logical space. */
export function hitTestInstrument(x: number, y: number): InstrumentHit | null {
    if (dist(x, y, 45, 40) <= 18) return hit('clave', 'clave', '#ffb300', 30);
    if (dist(x, y, 105, 40) <= 18) return hit('caja', 'caja', '#ffe082', 30);

    // Bombo head ellipse (parche inside, aro on the ring)
    const headTest = (x - BOMBO.x) ** 2 / BOMBO.rx ** 2 + (y - BOMBO_Y_TOP) ** 2 / BOMBO.ry ** 2;
    if (headTest <= 1.0) {
        const parcheTest = (x - BOMBO.x) ** 2 / (BOMBO.rx - 3) ** 2 + (y - BOMBO_Y_TOP) ** 2 / (BOMBO.ry - 2) ** 2;
        return parcheTest <= 1.0
            ? hit('bombo_parche', 'bombo_leguero', '#dfa15b', 42)
            : hit('bombo_aro', 'rim', '#ffe082', 36);
    }
    // Bombo body
    if (Math.abs(x - BOMBO.x) < BOMBO.rx && y > BOMBO_Y_TOP && y < BOMBO_Y_TOP + BOMBO.height) {
        return hit('bombo_parche', 'bombo_leguero', '#dfa15b', 42);
    }

    if (dist(x, y, 179, 45) <= 10) return hit('candombe_chico', 'candombe_chico', '#80cbc4', 24);
    if (dist(x, y, 195, 45) <= 10) return hit('candombe_repique', 'candombe_repique', '#80cbc4', 24);
    if (dist(x, y, 211, 45) <= 12) return hit('candombe_piano', 'candombe_piano', '#80cbc4', 26);
    if (Math.abs(x - 180) < 11 && Math.abs(y - 115) < 19) return hit('cajon', 'cajon', '#dfa15b', 35);
    if (dist(x, y, 235, 115) <= 15) return hit('palmas', 'palmas', '#ffcc80', 25);
    if (dist(x, y, 290, 40) <= 14) return hit('hihat', 'hihat', '#ffd54f', 30);
    if (dist(x, y, 345, 40) <= 15) return hit('snare', 'snare', '#b0bec5', 30);
    if (dist(x, y, 300, 115) <= 24) return hit('kick', 'kick', '#ff7043', 35);
    if (dist(x, y, 345, 115) <= 16) return hit('shaker', 'shaker', '#cfd8dc', 25);
    return null;
}

/** What a sequencer step should animate for an instrument. */
export interface StepTrigger {
    key: ScaleKey;
    x: number;
    y: number;
    color: string;
    maxRadius: number;
}

const trig = (key: ScaleKey, x: number, y: number, color: string, maxRadius: number): StepTrigger =>
    ({ key, x, y, color, maxRadius });

/** Visual trigger for a pattern step; null for instruments without a drawable (e.g. unknown ids). */
export function stepTrigger(instrument: string, modifier?: string): StepTrigger | null {
    switch (instrument) {
        case 'bombo_leguero':
            return modifier === 'aro'
                ? trig('bombo_aro', 75, 85, '#ffe082', 38)
                : trig('bombo_parche', 75, 115, '#dfa15b', 45);
        case 'rim': return trig('bombo_aro', 75, 85, '#ffe082', 38);
        case 'caja': return trig('caja', 105, 40, '#ffe082', 35);
        case 'cajon': return trig('cajon', 180, 115, '#dfa15b', 40);
        case 'palmas': return trig('palmas', 235, 115, '#ffcc80', 30);
        case 'candombe_chico': return trig('candombe_chico', 180, 45, '#80cbc4', 25);
        case 'candombe_repique': return trig('candombe_repique', 195, 45, '#80cbc4', 25);
        case 'candombe_piano': return trig('candombe_piano', 210, 45, '#80cbc4', 28);
        case 'kick':
        case 'surdo': return trig('kick', 300, 115, '#ff7043', 40);
        case 'snare': return trig('snare', 345, 40, '#b0bec5', 35);
        case 'hihat':
        case 'hihat_foot':
        case 'ride': return trig('hihat', 290, 40, '#ffd54f', 32);
        case 'clave': return trig('clave', 45, 40, '#ffb300', 30);
        case 'shaker': return trig('shaker', 345, 115, '#cfd8dc', 25);
        default: return null;
    }
}

/** Velocity impulse applied to a spring for a step of the given velocity (0/undefined counts as 1). */
export const stepBoost = (velocity: number | undefined): number => 0.35 * (velocity || 1.0);

/** One elastic-spring integration step toward scale 1. */
export function springStep(scale: number, velocity: number): { scale: number; velocity: number } {
    const v = (velocity + (1.0 - scale) * SPRING_STIFFNESS) * SPRING_DAMPING;
    return { scale: scale + v, velocity: v };
}

/** Scale used while reduced motion is on: static emphasis for highlighted instruments. */
export const reducedScale = (highlighted: boolean): number => (highlighted ? 1.12 : 1.0);

export function createRipple(x: number, y: number, color: string, maxRadius: number): Ripple {
    return { x, y, color, radius: 4, maxRadius, opacity: 1.0, speed: 1.6 };
}

/** Advances a ripple one frame (mutates). Returns false once it has faded out. */
export function advanceRipple(rp: Ripple): boolean {
    rp.radius += rp.speed;
    rp.opacity = 1.0 - rp.radius / rp.maxRadius;
    return rp.opacity > 0;
}

/** `rand` is injectable for deterministic tests. */
export function createParticle(
    x: number,
    y: number,
    color: string,
    rand: () => number = Math.random,
): SparkParticle {
    const angle = rand() * Math.PI * 2;
    const speed = 0.8 + rand() * 2.8;
    return {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 1.2 + rand() * 2.2,
        alpha: 1.0,
        decay: 0.025 + rand() * 0.035,
    };
}

/** Advances a particle one frame (mutates). Returns false once it has faded out. */
export function advanceParticle(p: SparkParticle): boolean {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.045; // gravity
    p.alpha -= p.decay;
    return p.alpha > 0;
}
