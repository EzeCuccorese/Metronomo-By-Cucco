import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { readSanitized, readStored, writeStored } from '../state/storage';

/**
 * Instances of the same key stay in step: a card that is mounted only some of the time
 * (a hidden panel) and the App-level hook that keeps the audio engine updated read the same value.
 */
type Listener = (value: unknown, source: object) => void;
const listeners = new Map<string, Set<Listener>>();

type Validator<T> = (value: unknown) => value is T;
type Sanitizer<T> = { sanitize: (value: unknown) => T | undefined };

/**
 * useState that survives reloads. Stored values are checked with a type guard
 * (invalid -> `initial`) or repaired with a sanitizer (keeps the valid parts).
 * Nothing is written until the value actually changes, so a value this version
 * can't read is never overwritten just by opening the app.
 *
 * (ES) useState que persiste en localStorage.
 */
export function usePersistentState<T>(
    key: string,
    initial: T,
    check?: Validator<T> | Sanitizer<T>,
): [T, Dispatch<SetStateAction<T>>] {
    const [value, setValue] = useState<T>(() =>
        check && typeof check === 'object'
            ? readSanitized(key, initial, check.sanitize)
            : readStored(key, initial, check)
    );
    const lastWritten = useRef<T>(value);
    const self = useRef({});

    useEffect(() => {
        const listener: Listener = (next, source) => {
            if (source === self.current) return;
            lastWritten.current = next as T;
            setValue(next as T);
        };
        let set = listeners.get(key);
        if (!set) listeners.set(key, set = new Set());
        set.add(listener);
        return () => {
            set.delete(listener);
            if (set.size === 0) listeners.delete(key);
        };
    }, [key]);

    useEffect(() => {
        if (Object.is(value, lastWritten.current)) return;
        lastWritten.current = value;
        writeStored(key, value);
        listeners.get(key)?.forEach(listener => listener(value, self.current));
    }, [key, value]);

    return [value, setValue];
}
