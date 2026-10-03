import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { readSanitized, readStored, writeStored } from '../state/storage';

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

    useEffect(() => {
        if (Object.is(value, lastWritten.current)) return;
        lastWritten.current = value;
        writeStored(key, value);
    }, [key, value]);

    return [value, setValue];
}
