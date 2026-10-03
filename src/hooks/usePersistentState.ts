import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { readStored, writeStored } from '../state/storage';

/**
 * useState that survives reloads. Invalid stored values fall back to `initial`.
 * (ES) useState que persiste en localStorage.
 */
export function usePersistentState<T>(
    key: string,
    initial: T,
    validate?: (value: unknown) => value is T,
): [T, Dispatch<SetStateAction<T>>] {
    const [value, setValue] = useState<T>(() => readStored(key, initial, validate));

    useEffect(() => {
        writeStored(key, value);
    }, [key, value]);

    return [value, setValue];
}
