/** Reduced-motion highlight windows: each key is highlighted until an expiry timestamp (ms). */
export const HIGHLIGHT_MS = 200;

export type HighlightMap = Record<string, number>;

/** Starts or extends a key's highlight; a later hit always wins over an earlier one. */
export function markHighlight(map: HighlightMap, key: string, now: number, durationMs = HIGHLIGHT_MS): void {
    map[key] = Math.max(map[key] ?? 0, now + durationMs);
}

export const isHighlighted = (map: HighlightMap, key: string, now: number): boolean =>
    (map[key] ?? 0) > now;
