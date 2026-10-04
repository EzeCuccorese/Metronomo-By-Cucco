import { useEffect, useRef, useSyncExternalStore } from 'react';
import { SHORTCUTS, matchesEvent } from './registry';
import type { ShortcutId } from './registry';
import { isTextEditing, ownsKeys, ownsLetters } from './targets';

export interface ShortcutHandler {
    /** Key went down (auto-repeat is filtered by the registry's `allowRepeat`). */
    down?: (e: KeyboardEvent) => void;
    /** Any keyup, whatever the target: lets a handler release what it started. */
    up?: (e: KeyboardEvent) => void;
}
export type ShortcutHandlers = Partial<Record<ShortcutId, ShortcutHandler | ((e: KeyboardEvent) => void)>>;

const handlers = new Map<ShortcutId, ShortcutHandler>();

// --- Piano scope: while it is active, piano shortcuts win over global ones on the same key ---
interface PianoScope {
    /** The "Teclado PC" mode is on: the piano listens from anywhere on the page. */
    global: boolean;
    /** Otherwise the piano still listens while focus is inside its panel. */
    focused: () => boolean;
}
let pianoScope: PianoScope = { global: false, focused: () => false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => { listeners.delete(l); };
};

/** True while the global "Teclado PC" mode owns the letter keys (T plays Fa♯, not tap tempo). */
export const usePianoGlobalMode = (): boolean => useSyncExternalStore(subscribe, () => pianoScope.global, () => false);

export const isPianoActive = (): boolean => pianoScope.global || pianoScope.focused();

/** Called by the piano panel to say when it wants the letter keys. */
export function usePianoScope(global: boolean, focused: () => boolean) {
    const focusedRef = useRef(focused);
    useEffect(() => { focusedRef.current = focused; });
    useEffect(() => {
        const scope: PianoScope = { global, focused: () => focusedRef.current() };
        pianoScope = scope;
        emit();
        return () => {
            if (pianoScope === scope) {
                pianoScope = { global: false, focused: () => false };
                emit();
            }
        };
    }, [global]);
}

const normalise = (h: ShortcutHandler | ((e: KeyboardEvent) => void)): ShortcutHandler => (typeof h === 'function' ? { down: h } : h);

/**
 * Registers handlers for registry ids for as long as the component is mounted.
 * One handler per id: the last one registered wins, so two mounted components must not claim
 * the same id (a warning is logged in development).
 */
export function useShortcutHandlers(map: ShortcutHandlers) {
    const ref = useRef(map);
    useEffect(() => { ref.current = map; });
    const ids = (Object.keys(map) as ShortcutId[]).sort().join(',');
    useEffect(() => {
        const mine = ids ? (ids.split(',') as ShortcutId[]) : [];
        const wrapped = new Map<ShortcutId, ShortcutHandler>();
        for (const id of mine) {
            const w: ShortcutHandler = {
                down: e => { const h = ref.current[id]; if (h) normalise(h).down?.(e); },
                up: e => { const h = ref.current[id]; if (h) normalise(h).up?.(e); },
            };
            if (import.meta.env.DEV && handlers.has(id)) console.warn(`Shortcut "${id}" already has a handler: only one component may own each id.`);
            wrapped.set(id, w);
            handlers.set(id, w);
        }
        return () => {
            wrapped.forEach((w, id) => { if (handlers.get(id) === w) handlers.delete(id); });
        };
    }, [ids]);
}

/** Runs a shortcut's action without a keypress (command palette, buttons). */
export function invokeShortcut(id: ShortcutId, e: KeyboardEvent = new KeyboardEvent('keydown')) {
    handlers.get(id)?.down?.(e);
}

/**
 * The one keyboard listener of the app. Piano shortcuts are tried first while the piano is
 * active; text fields and widgets that own their keys are never hijacked.
 */
export function useShortcutDispatcher() {
    useEffect(() => {
        const swallow = new Set<string>();

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.defaultPrevented) return;
            const target = e.target instanceof Element ? e.target : null;
            if (target && isTextEditing(target)) return;
            const pianoOn = isPianoActive();
            for (const def of SHORTCUTS) {
                if (def.scope === 'piano' && !pianoOn) continue;
                if (!matchesEvent(def, e) || !handlers.has(def.id)) continue;
                if (target && (def.scope === 'piano' ? ownsLetters(target) : ownsKeys(target))) continue;
                if (def.preventDefault) e.preventDefault();
                if (def.swallowKeyup) swallow.add(e.code);
                if (e.repeat && !def.allowRepeat) return;
                handlers.get(def.id)!.down?.(e);
                return;
            }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            // Stop a focused button from "clicking" on Space keyup.
            if (swallow.delete(e.code)) e.preventDefault();
            handlers.forEach(h => h.up?.(e));
        };

        window.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('keyup', onKeyUp, true);
        return () => {
            window.removeEventListener('keydown', onKeyDown, true);
            window.removeEventListener('keyup', onKeyUp, true);
        };
    }, []);
}

