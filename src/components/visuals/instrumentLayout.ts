/** Pure (canvas-free) layout, hit-testing and animation-state logic for InteractiveInstrumentVisual. */

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

// ---------------------------------------------------------------------------
// Responsive layout. Everything is in CSS pixels; the canvas backing store is
// width * dpr, the renderer applies ctx.scale(dpr, dpr).
// ---------------------------------------------------------------------------

/** Below this CSS width the three sections stack vertically. */
export const STACK_BREAKPOINT = 700;
/** Minimum touch target (diameter, CSS px). */
export const MIN_HIT = 44;

export type SectionId = 'folklore' | 'rioplatense' | 'moderna';
export type LayoutMode = 'row' | 'stack';

interface ItemDef {
    key: ScaleKey;
    /** Instrument id passed to the preview callback. */
    instrument: string;
    name: string;
    section: SectionId;
    color: string;
}

const SECTION_DEFS: { id: SectionId; label: string }[] = [
    { id: 'folklore', label: 'FOLKLORE NORTEÑO' },
    { id: 'rioplatense', label: 'RIOPLATENSE Y LITORAL' },
    { id: 'moderna', label: 'RÍTMICA MODERNA' },
];

const ITEM_DEFS: ItemDef[] = [
    { key: 'clave', instrument: 'clave', name: 'Claves', section: 'folklore', color: '#ffb300' },
    { key: 'caja', instrument: 'caja', name: 'Caja coplera', section: 'folklore', color: '#ffe082' },
    { key: 'bombo_parche', instrument: 'bombo_leguero', name: 'Bombo legüero', section: 'folklore', color: '#dfa15b' },
    { key: 'candombe_chico', instrument: 'candombe_chico', name: 'Chico', section: 'rioplatense', color: '#80cbc4' },
    { key: 'candombe_repique', instrument: 'candombe_repique', name: 'Repique', section: 'rioplatense', color: '#80cbc4' },
    { key: 'candombe_piano', instrument: 'candombe_piano', name: 'Piano', section: 'rioplatense', color: '#80cbc4' },
    { key: 'cajon', instrument: 'cajon', name: 'Cajón', section: 'rioplatense', color: '#dfa15b' },
    { key: 'palmas', instrument: 'palmas', name: 'Palmas', section: 'rioplatense', color: '#ffcc80' },
    { key: 'hihat', instrument: 'hihat', name: 'Hi-hat', section: 'moderna', color: '#ffd54f' },
    { key: 'snare', instrument: 'snare', name: 'Redoblante', section: 'moderna', color: '#b0bec5' },
    { key: 'kick', instrument: 'kick', name: 'Bombo', section: 'moderna', color: '#ff7043' },
    { key: 'shaker', instrument: 'shaker', name: 'Shaker', section: 'moderna', color: '#cfd8dc' },
];

const SEC_PAD_X = 8;
const SEC_GAP = 10;
const STACK_GAP = 8;
const TOP_PAD = 10;
export const LABEL_H = 14;
export const LABEL_FONT = 10;
const LABEL_GAP = 10;
const NAME_GAP = 8;
export const NAME_H = 12;
const BOTTOM_PAD = 12;
const FIXED_H = TOP_PAD + LABEL_H + LABEL_GAP + NAME_GAP + NAME_H + BOTTOM_PAD;
const PAD_FILL = 0.86; // pad diameter relative to its slot
const MAX_PAD_ROW = 96;
const MAX_PAD_STACK = 72;

export interface Rect { x: number; y: number; w: number; h: number }

export interface LayoutSection {
    id: SectionId;
    label: string;
    rect: Rect;
    /** Estimated rectangle occupied by the (centered) label text. */
    labelRect: Rect;
}

export interface LayoutItem {
    key: ScaleKey;
    instrument: string;
    name: string;
    section: SectionId;
    color: string;
    cx: number;
    cy: number;
    /** Visual pad radius. */
    r: number;
    /** Hit radius (>= MIN_HIT / 2). */
    hitR: number;
    nameX: number;
    nameY: number;
    /** Max width the name may take before the renderer must shrink the font. */
    nameMaxW: number;
}

export interface InstrumentLayout {
    width: number;
    height: number;
    mode: LayoutMode;
    sections: LayoutSection[];
    items: LayoutItem[];
}

/** Rough text width for a letter-spaced uppercase label (renderer uses real measureText). */
export const estimateLabelWidth = (text: string, fontSize: number = LABEL_FONT): number =>
    text.length * fontSize * 0.75;

const snap = (v: number, dpr: number): number => Math.round(v * dpr) / dpr;

/** Pure layout for a canvas of CSS `width`. Height is derived (the canvas defines its own height). */
export function computeLayout(width: number, dpr: number = 1): InstrumentLayout {
    const w = Math.max(1, width);
    const d = dpr > 0 ? dpr : 1;
    const mode: LayoutMode = w < STACK_BREAKPOINT ? 'stack' : 'row';
    const counts = SECTION_DEFS.map(s => ITEM_DEFS.filter(i => i.section === s.id).length);
    const maxCount = Math.max(...counts);
    const totalCount = counts.reduce((a, b) => a + b, 0);

    let padD: number;
    let height: number;
    const sectionRects: Rect[] = [];

    if (mode === 'row') {
        const slot = (w - 2 * SEC_PAD_X * SECTION_DEFS.length - SEC_GAP * (SECTION_DEFS.length - 1)) / totalCount;
        padD = Math.min(MAX_PAD_ROW, slot * PAD_FILL);
        height = padD + FIXED_H;
        let x = 0;
        counts.forEach((c, i) => {
            const sw = c * slot + 2 * SEC_PAD_X;
            sectionRects.push({ x, y: 0, w: sw, h: height });
            x += sw + (i < counts.length - 1 ? SEC_GAP : 0);
        });
    } else {
        const slot = (w - 2 * SEC_PAD_X) / maxCount;
        padD = Math.min(MAX_PAD_STACK, slot * PAD_FILL);
        const sh = padD + FIXED_H;
        counts.forEach((_, i) => sectionRects.push({ x: 0, y: i * (sh + STACK_GAP), w, h: sh }));
        height = sh * counts.length + STACK_GAP * (counts.length - 1);
    }
    padD = snap(padD, d);
    height = Math.ceil(height * d) / d;

    const r = padD / 2;
    const sections: LayoutSection[] = SECTION_DEFS.map((def, i) => {
        const rect = sectionRects[i];
        const lw = Math.min(estimateLabelWidth(def.label), rect.w - 2 * SEC_PAD_X);
        return {
            id: def.id,
            label: def.label,
            rect,
            labelRect: { x: rect.x + (rect.w - lw) / 2, y: rect.y + TOP_PAD, w: lw, h: LABEL_H },
        };
    });

    const items: LayoutItem[] = [];
    SECTION_DEFS.forEach((def, si) => {
        const rect = sectionRects[si];
        const defs = ITEM_DEFS.filter(i => i.section === def.id);
        const innerW = rect.w - 2 * SEC_PAD_X;
        const slotW = innerW / defs.length;
        const cy = rect.y + TOP_PAD + LABEL_H + LABEL_GAP + r;
        defs.forEach((it, k) => {
            const cx = rect.x + SEC_PAD_X + slotW * (k + 0.5);
            items.push({
                ...it,
                cx,
                cy,
                r,
                hitR: Math.max(r, MIN_HIT / 2),
                nameX: cx,
                nameY: cy + r + NAME_GAP,
                nameMaxW: slotW - 4,
            });
        });
    });

    return { width: w, height, mode, sections, items };
}

export const itemByKey = (layout: InstrumentLayout, key: ScaleKey): LayoutItem | undefined =>
    layout.items.find(i => i.key === key);

/** Maps a client-space pointer position to layout (CSS px) coordinates of the canvas. */
export function toCanvasCoords(
    clientX: number,
    clientY: number,
    rect: { left: number; top: number; width: number; height: number },
    logical: { width: number; height: number },
): { x: number; y: number } {
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    return {
        x: (clientX - rect.left) * (logical.width / rect.width),
        y: (clientY - rect.top) * (logical.height / rect.height),
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

/** Fraction of the bombo pad radius (outer ring) that counts as the aro. */
export const BOMBO_ARO_FROM = 0.78;

/** Hit-test in layout coordinates: the closest instrument within its hit radius wins. */
export function hitTestInstrument(layout: InstrumentLayout, x: number, y: number): InstrumentHit | null {
    let best: LayoutItem | null = null;
    let bestD = Infinity;
    for (const it of layout.items) {
        const dd = Math.hypot(x - it.cx, y - it.cy);
        if (dd <= it.hitR && dd < bestD) {
            best = it;
            bestD = dd;
        }
    }
    if (!best) return null;
    if (best.key === 'bombo_parche' && bestD > best.r * BOMBO_ARO_FROM && bestD <= best.r) {
        return { key: 'bombo_aro', instrument: 'rim', color: '#ffe082', rippleRadius: best.r * 1.5 };
    }
    return { key: best.key, instrument: best.instrument, color: best.color, rippleRadius: best.r * 1.6 };
}

/** What a sequencer step should animate for an instrument (position comes from the layout). */
export interface StepTrigger {
    key: ScaleKey;
    color: string;
    /** Ripple max radius as a multiple of the pad radius. */
    radiusFactor: number;
    /** True when the ripple should originate on the rim (top of the pad). */
    rim?: boolean;
}

const trig = (key: ScaleKey, color: string, radiusFactor: number, rim = false): StepTrigger =>
    ({ key, color, radiusFactor, rim });

/** Visual trigger for a pattern step; null for instruments without a drawable (e.g. unknown ids). */
export function stepTrigger(instrument: string, modifier?: string): StepTrigger | null {
    switch (instrument) {
        case 'bombo_leguero':
            return modifier === 'aro'
                ? trig('bombo_aro', '#ffe082', 1.5, true)
                : trig('bombo_parche', '#dfa15b', 1.7);
        case 'rim': return trig('bombo_aro', '#ffe082', 1.5, true);
        case 'caja': return trig('caja', '#ffe082', 1.6);
        case 'cajon': return trig('cajon', '#dfa15b', 1.6);
        case 'palmas': return trig('palmas', '#ffcc80', 1.6);
        case 'candombe_chico': return trig('candombe_chico', '#80cbc4', 1.5);
        case 'candombe_repique': return trig('candombe_repique', '#80cbc4', 1.5);
        case 'candombe_piano': return trig('candombe_piano', '#80cbc4', 1.5);
        case 'kick':
        case 'surdo': return trig('kick', '#ff7043', 1.6);
        case 'snare': return trig('snare', '#b0bec5', 1.6);
        case 'hihat':
        case 'hihat_foot':
        case 'ride': return trig('hihat', '#ffd54f', 1.6);
        case 'clave': return trig('clave', '#ffb300', 1.6);
        case 'shaker': return trig('shaker', '#cfd8dc', 1.6);
        default: return null;
    }
}

/** Layout key whose pad a scale key is drawn on (the bombo aro shares the bombo pad). */
export const padKey = (key: ScaleKey): ScaleKey => (key === 'bombo_aro' ? 'bombo_parche' : key);

// ---------------------------------------------------------------------------
// Image normalisation: every photo is fitted by its content box, not its file size.
// ---------------------------------------------------------------------------

export interface ContentBox { x: number; y: number; w: number; h: number }

/**
 * Bounding box of the "content" pixels of RGBA data: opaque and brighter than `lumThreshold`
 * (the photos sit on near-black backgrounds). Falls back to the whole image when empty.
 */
export function contentBox(
    data: ArrayLike<number>,
    width: number,
    height: number,
    lumThreshold = 38,
): ContentBox {
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
            if (data[i + 3] > 32 && lum > lumThreshold) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (maxX < 0) return { x: 0, y: 0, w: width, h: height };
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Destination rectangle (relative to the pad center) for drawing an image so that its content
 * box is centered and its longest side spans `fill` of the pad diameter.
 */
export function fitImageToPad(
    imgW: number,
    imgH: number,
    box: ContentBox,
    padRadius: number,
    fill = 0.8,
): { dx: number; dy: number; dw: number; dh: number } {
    const k = (2 * padRadius * fill) / Math.max(box.w, box.h, 1);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    return { dx: -cx * k, dy: -cy * k, dw: imgW * k, dh: imgH * k };
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

/**
 * Advances every item and removes the ones that expired, in place. Iterates in reverse so
 * splicing never skips a neighbour. Returns the survivors in their original order.
 */
export function advanceAndPrune<T>(items: T[], advance: (item: T) => boolean): T[] {
    for (let i = items.length - 1; i >= 0; i--) {
        if (!advance(items[i])) items.splice(i, 1);
    }
    return items;
}
