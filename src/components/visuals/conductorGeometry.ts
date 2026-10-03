/** Pure (canvas-free) geometry, easing and timing logic for ConductorVisual. */

export interface Point {
    x: number;
    y: number;
}

export interface TrailPoint extends Point {
    alpha: number;
}

export type CountingMode = 'numbers' | '1&2&' | '1e&a' | 'triplet_1la2la' | 'mnemonics_chacarera' | string | undefined;

/** Syllable shown under the beat dots for a step ('' when the step is not counted). */
export function getCountingText(
    stepIndex: number,
    subdivision: number,
    mode: CountingMode,
    timeSignature: [number, number],
): string {
    const beats = timeSignature[0];
    const stepsPerBeat = subdivision / beats;

    const beatNum = Math.floor(stepIndex / stepsPerBeat) + 1; // 1-based beat
    const subIndex = stepIndex % stepsPerBeat; // 0-based sub index within the beat

    if (mode === 'numbers') {
        return subIndex === 0 ? `${beatNum}` : '';
    }

    if (mode === '1&2&') {
        if (subIndex === 0) return `${beatNum}`;
        if (subIndex === 0.5 * stepsPerBeat) return '&';
        return '';
    }

    if (mode === '1e&a') {
        if (subIndex === 0) return `${beatNum}`;
        if (subIndex === 1) return 'e';
        if (subIndex === 2) return '&';
        if (subIndex === 3) return 'a';
    }

    if (mode === 'triplet_1la2la') {
        if (subIndex === 0) return `${beatNum}`;
        if (subIndex === 1) return 'la';
        if (subIndex === 2) return 'le';
    }

    if (mode === 'mnemonics_chacarera') {
        const mapping = ['MA', 'de', 'RA', 'PAR', 'che', 'PAR'];
        return mapping[stepIndex % 6] || '';
    }

    return '';
}

// ---------- Pendulum ----------

export const MAX_SWING_ANGLE = 0.45; // radians (~25 degrees)

/** Pendulum target angle: swings left on even beats, right on odd beats, along a cosine ease. */
export function swingTargetAngle(stepIndex: number, stepsPerBeat: number): number {
    const isOddBeat = Math.floor(stepIndex / stepsPerBeat) % 2 === 1;
    const interpolationFactor = (stepIndex % stepsPerBeat) / stepsPerBeat;
    const direction = isOddBeat ? 1 : -1;
    return MAX_SWING_ANGLE * direction * Math.cos(interpolationFactor * Math.PI);
}

/** True when a step starts a beat (triggers the background flash). */
export const isBeatStart = (stepIndex: number, stepsPerBeat: number): boolean =>
    stepIndex % stepsPerBeat === 0;

/** Exponential smoothing toward the target angle; snaps to it when motion is reduced. */
export function nextPendulumAngle(current: number, target: number, reduceMotion: boolean): number {
    return reduceMotion ? target : current * 0.82 + target * 0.18;
}

/** Next background pulse intensity: linear decay, or a single-frame flash when reduced. */
export function nextPulseIntensity(current: number, reduceMotion: boolean): number {
    return reduceMotion ? 0 : current - 0.05;
}

/** Normalized (0..1) BPM within the 40..240 range of the metronome weight. */
export function normalizeBpm(bpm: number): number {
    const minBpm = 40;
    const maxBpm = 240;
    return Math.max(0, Math.min(1, (bpm - minBpm) / (maxBpm - minBpm)));
}

/** Position of the sliding weight along the rod (fraction of rod length): lower BPM = higher up. */
export const weightPercent = (bpm: number): number => 0.35 + (1 - normalizeBpm(bpm)) * 0.45;

export interface PendulumLayout {
    centerX: number;
    centerY: number;
    baseWidth: number;
    topWidth: number;
    bodyHeight: number;
    apexY: number;
    faceWidthBase: number;
    faceWidthTop: number;
    faceHeight: number;
    faceY: number;
    rodLength: number;
    pivotX: number;
    pivotY: number;
}

export function pendulumLayout(w: number, h: number): PendulumLayout {
    const centerX = w / 2;
    const centerY = h - 25;
    const baseWidth = w * 0.45;
    const topWidth = w * 0.12;
    const bodyHeight = h * 0.75;
    const faceHeight = bodyHeight * 0.85;
    return {
        centerX,
        centerY,
        baseWidth,
        topWidth,
        bodyHeight,
        apexY: centerY - bodyHeight,
        faceWidthBase: baseWidth * 0.65,
        faceWidthTop: topWidth * 0.65,
        faceHeight,
        faceY: centerY - faceHeight - 5,
        rodLength: bodyHeight * 0.95,
        pivotX: centerX,
        pivotY: centerY - 10,
    };
}

/** Free end of the rod (measured from the body base, as drawn). */
export function rodEndPoint(layout: PendulumLayout, angle: number): Point {
    return {
        x: layout.centerX + Math.sin(angle) * layout.rodLength,
        y: layout.centerY - Math.cos(angle) * layout.rodLength,
    };
}

/** Point at `fraction` of the rod length measured from the pivot (where the weight sits). */
export function rodPointFromPivot(layout: PendulumLayout, angle: number, fraction: number): Point {
    const len = layout.rodLength * fraction;
    return {
        x: layout.pivotX + Math.sin(angle) * len,
        y: layout.pivotY - Math.cos(angle) * len,
    };
}

// ---------- Orchestra / path conductor ----------

export const CONDUCTOR_PADDING = 45;

/** Cosine ease-in-out of a 0..1 fraction. */
export const easeCosine = (t: number): number => 0.5 - 0.5 * Math.cos(t * Math.PI);

/** Duration of one sequencer step in ms for a pattern at the given BPM. */
export function stepDurationMs(bpm: number, timeSignature: [number, number], subdivision: number): number {
    const timePerBar = (60.0 / bpm) * (4.0 / timeSignature[1]) * timeSignature[0];
    return (timePerBar / subdivision) * 1000;
}

/** Fractional step position: current step plus progress through it (capped at 0.99, 0 when reduced). */
export function smoothStepPosition(
    currentStepIndex: number,
    elapsedMs: number,
    durationMs: number,
    reduceMotion: boolean,
): number {
    const progress = reduceMotion ? 0 : Math.min(0.99, elapsedMs / durationMs);
    return currentStepIndex + progress;
}

/** Corner points visited per beat for the standard (single spark) conductor pattern. */
export function conductorPath(beats: number, w: number, h: number): Point[] {
    const padding = CONDUCTOR_PADDING;
    const bottomY = h - padding;
    const topY = padding;
    const leftX = padding;
    const rightX = w - padding;
    const centerX = w / 2;

    if (beats === 3) {
        return [
            { x: centerX, y: bottomY },
            { x: rightX, y: bottomY - (h - 2 * padding) * 0.15 },
            { x: centerX, y: topY },
        ];
    }
    if (beats === 2 || beats === 6) {
        return [
            { x: centerX - w * 0.15, y: bottomY },
            { x: centerX + w * 0.15, y: topY },
        ];
    }
    return [
        { x: centerX, y: bottomY },
        { x: leftX, y: bottomY - (h - 2 * padding) * 0.3 },
        { x: rightX, y: bottomY - (h - 2 * padding) * 0.3 },
        { x: centerX, y: topY },
    ];
}

/** Position of a spark travelling along a closed path of points at a fractional beat index. */
export function pathPosition(points: Point[], smoothBeatIndex: number): Point {
    const currentBeatIndex = Math.floor(smoothBeatIndex);
    const eased = easeCosine(smoothBeatIndex % 1);
    const from = points[currentBeatIndex % points.length];
    const to = points[(currentBeatIndex + 1) % points.length];
    return {
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased,
    };
}

export interface HemiolaLayout {
    triangle: Point[];
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
    bottomY: number;
}

/** Layout for the chacarera hemiola visual (3/4 triangle + 6/8 ellipse). */
export function hemiolaLayout(w: number, h: number): HemiolaLayout {
    const padding = CONDUCTOR_PADDING;
    const bottomY = h - padding;
    const topY = padding;
    const rightX = w - padding;
    const centerX = w / 2;
    const centerY = h / 2;
    return {
        triangle: [
            { x: centerX, y: bottomY },
            { x: rightX - 20, y: centerY + 15 },
            { x: centerX, y: topY },
        ],
        centerX,
        centerY,
        radiusX: w * 0.32,
        radiusY: h * 0.22,
        bottomY,
    };
}

/** 3/4 spark position: 4 steps per beat along the triangle. */
export function hemiolaTrianglePosition(layout: HemiolaLayout, smoothStep: number): Point {
    return pathPosition(layout.triangle, smoothStep / 4);
}

/** 6/8 spark position: one full ellipse revolution per 12 steps, starting at the top. */
export function hemiolaEllipsePosition(layout: HemiolaLayout, smoothStep: number): Point {
    const angle = -Math.PI / 2 + Math.PI * 2 * (smoothStep / 12);
    return {
        x: layout.centerX + Math.cos(angle) * layout.radiusX,
        y: layout.centerY + Math.sin(angle) * layout.radiusY,
    };
}

export const MAX_TRAIL_LENGTH = 25;

/** Appends a point to a trail (mutates), clearing it first when reduced; keeps at most 25 points. */
export function pushTrailPoint(trail: TrailPoint[], p: Point, reduceMotion: boolean): void {
    if (reduceMotion) trail.length = 0;
    trail.push({ x: p.x, y: p.y, alpha: 1.0 });
    if (trail.length > MAX_TRAIL_LENGTH) trail.shift();
}

/** Alpha of the trail point at idx (older points fade): idx / length. */
export const trailAlpha = (idx: number, length: number): number => idx / length;
