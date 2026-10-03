/**
 * Versioned localStorage helpers. Every access is guarded: private browsing,
 * quota errors or corrupted JSON must never break the app.
 *
 * (ES) Helpers de localStorage versionados y tolerantes a errores.
 */
export const STORAGE_PREFIX = 'metronomo:v1:';

export function readStored<T>(key: string, fallback: T, validate?: (value: unknown) => value is T): T {
    try {
        const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
        if (raw === null) return fallback;
        const parsed: unknown = JSON.parse(raw);
        if (validate && !validate(parsed)) return fallback;
        return parsed as T;
    } catch {
        return fallback;
    }
}

/**
 * Like readStored, but repairs instead of rejecting: `sanitize` keeps whatever is still
 * valid (e.g. drops one corrupted entry of a map) and returns undefined only when nothing is.
 */
export function readSanitized<T>(key: string, fallback: T, sanitize: (value: unknown) => T | undefined): T {
    try {
        const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
        if (raw === null) return fallback;
        return sanitize(JSON.parse(raw)) ?? fallback;
    } catch {
        return fallback;
    }
}

export function writeStored<T>(key: string, value: T): void {
    try {
        window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch {
        // Storage unavailable or full: persistence is best-effort.
    }
}

export const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const isString = (v: unknown): v is string => typeof v === 'string';
export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);
