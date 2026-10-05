import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHarmonySync, useMelodySync } from './useEngineSync';
import { usePersistentState } from './usePersistentState';
import { STORAGE_PREFIX, isNumber } from '../state/storage';

const engine = () => ({ setHarmonyProgression: vi.fn(), setHarmonyVolume: vi.fn(), setAccompanimentStyle: vi.fn() });
const put = (key: string, value: unknown) => localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
const step = (degree: string, durationUnits: number, notes: string[]) => ({ id: degree, degree, durationUnits, notes });

describe('useHarmonySync', () => {
    afterEach(() => localStorage.clear());

    it('pushes the stored progression, style and volume with no card mounted', () => {
        put('harmony.sequence', [step('I', 2, ['C4', 'E4', 'G4']), step('V', 1, ['G3', 'B3', 'D4'])]);
        put('harmony.style', 'zamba_base');
        put('harmony.volume', 0.5);
        const e = engine();
        renderHook(() => useHarmonySync(e));
        // One entry per half bar: I lasts 2, V lasts 1.
        expect(e.setHarmonyProgression).toHaveBeenLastCalledWith([['C4', 'E4', 'G4'], ['C4', 'E4', 'G4'], ['G3', 'B3', 'D4']]);
        expect(e.setAccompanimentStyle).toHaveBeenLastCalledWith('zamba_base');
        expect(e.setHarmonyVolume).toHaveBeenLastCalledWith(0.5);
    });

    it('sends an empty progression and the defaults when nothing is stored', () => {
        const e = engine();
        const { result } = renderHook(() => useHarmonySync(e));
        expect(e.setHarmonyProgression).toHaveBeenLastCalledWith([]);
        expect(e.setAccompanimentStyle).toHaveBeenLastCalledWith('pad');
        expect(e.setHarmonyVolume).toHaveBeenLastCalledWith(0.3);
        expect(result.current).toBe('C mayor · sin acordes');
    });

    it('summarises the key, mode and degrees', () => {
        put('harmony.key', 'D');
        put('harmony.mode', 'minor');
        put('harmony.sequence', [step('i', 2, ['D4']), step('v', 2, ['A3'])]);
        const { result } = renderHook(() => useHarmonySync(engine()));
        expect(result.current).toBe('D menor · i–v');
    });

    it('follows edits made by a card that is mounted later (same persisted key)', () => {
        const e = engine();
        renderHook(() => useHarmonySync(e));
        const card = renderHook(() => usePersistentState<unknown[]>('harmony.sequence', [], (v): v is unknown[] => Array.isArray(v)));
        act(() => card.result.current[1]([step('IV', 2, ['F4', 'A4', 'C5'])]));
        expect(e.setHarmonyProgression).toHaveBeenLastCalledWith([['F4', 'A4', 'C5'], ['F4', 'A4', 'C5']]);
        // And the mirrored value is not written back (no ping-pong between instances).
        expect(JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}harmony.sequence`)!)).toHaveLength(1);
    });

    it('ignores a corrupt stored sequence', () => {
        put('harmony.sequence', [{ degree: 'I' }]);
        const e = engine();
        renderHook(() => useHarmonySync(e));
        expect(e.setHarmonyProgression).toHaveBeenLastCalledWith([]);
    });
});

describe('useMelodySync', () => {
    afterEach(() => localStorage.clear());
    const take = { bars: 1, subdivision: 4, notes: [{ step: 0, midi: 60, velocity: 0.9, length: 1 }] };

    it('loops the stored melody', () => {
        put('piano.melody.v1', take);
        const setMelody = vi.fn();
        renderHook(() => useMelodySync({ setMelody }));
        expect(setMelody).toHaveBeenLastCalledWith(take);
    });

    it('sends nothing to loop when the loop is switched off', () => {
        put('piano.melody.v1', take);
        put('piano.settings', { octave: 3, computerKeys: false, scale: 'none', bars: 2, loop: false });
        const setMelody = vi.fn();
        renderHook(() => useMelodySync({ setMelody }));
        expect(setMelody).toHaveBeenLastCalledWith(null);
    });

    it('does not mirror unrelated keys', () => {
        const a = renderHook(() => usePersistentState('n', 0, isNumber));
        const b = renderHook(() => usePersistentState('other', 0, isNumber));
        act(() => a.result.current[1](5));
        expect(b.result.current[0]).toBe(0);
    });
});
