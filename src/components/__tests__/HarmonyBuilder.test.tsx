import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import HarmonyBuilder from '../HarmonyBuilder';
import { useHarmonySync } from '../../hooks/useEngineSync';
import { STORAGE_PREFIX } from '../../state/storage';

/** What App does: the card edits the saved harmony, `useHarmonySync` sends it to the engine. */
function Synced({ engine }: { engine: { setHarmonyProgression: (p: string[][]) => void; setHarmonyVolume: (v: number) => void; setAccompanimentStyle: (s: never) => void } }) {
    useHarmonySync(engine as never);
    return <HarmonyBuilder />;
}

const renderBuilder = () => {
    const onUpdateProgression = vi.fn();
    render(<Synced engine={{ setHarmonyProgression: onUpdateProgression, setHarmonyVolume: vi.fn(), setAccompanimentStyle: vi.fn() }} />);
    return { onUpdateProgression };
};

const choose = async (name: string, option: string | RegExp) => {
    fireEvent.mouseDown(screen.getByRole('combobox', { name }));
    fireEvent.click(within(await screen.findByRole('listbox')).getByText(option));
};

const stored = (key: string) => JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${key}`) ?? 'null');

describe('HarmonyBuilder (Tonal.js)', () => {
    beforeEach(() => localStorage.clear());
    afterEach(cleanup);

    it('keeps a progression saved by the previous version (settings and sequence)', () => {
        localStorage.setItem(`${STORAGE_PREFIX}harmony.key`, JSON.stringify('Eb'));
        localStorage.setItem(`${STORAGE_PREFIX}harmony.mode`, JSON.stringify('mixolydian'));
        localStorage.setItem(`${STORAGE_PREFIX}harmony.sequence`, JSON.stringify([
            { id: 'a', degree: 'I', durationUnits: 2, notes: ['Eb4', 'G4', 'Bb4'] },
            { id: 'b', degree: 'v', durationUnits: 4, notes: ['Bb4', 'D5', 'F5'] },
        ]));
        const { onUpdateProgression } = renderBuilder();
        expect(screen.getAllByTestId('harmony-step')).toHaveLength(2);
        // Old steps carry no symbol: it is derived from their notes.
        expect(screen.getAllByTestId('harmony-symbol').map(e => e.textContent)).toEqual(['Eb', 'Bb']);
        expect(onUpdateProgression.mock.calls.at(-1)![0]).toHaveLength(6);
        expect(screen.getByRole('combobox', { name: 'Modo' })).toHaveTextContent('Mixolidio');
        expect(screen.getByRole('switch', { name: 'Séptimas' })).not.toBeChecked();
    });

    it('falls back to defaults when a stored mode is unknown', () => {
        localStorage.setItem(`${STORAGE_PREFIX}harmony.mode`, JSON.stringify('bebop'));
        renderBuilder();
        expect(screen.getByRole('combobox', { name: 'Modo' })).toHaveTextContent('Mayor');
    });

    it('offers every mode and shows chord symbols under the degrees', async () => {
        renderBuilder();
        expect(screen.getByText('Dm')).toBeInTheDocument();
        await choose('Modo', 'Frigio (Flamenco)');
        expect(screen.getByText('II')).toBeInTheDocument(); // Frigio: the Neapolitan-flavoured II (Reb)
        expect(screen.getByText('Db')).toBeInTheDocument();
        await choose('Modo', 'Menor armónica');
        expect(screen.getByText('V')).toBeInTheDocument();
        expect(screen.getByText('G')).toBeInTheDocument();
        expect(stored('harmony.mode')).toBe('harmonic_minor');
    });

    it('adds seventh chords with the Séptimas toggle and persists it', () => {
        const { onUpdateProgression } = renderBuilder();
        fireEvent.click(screen.getByRole('switch', { name: 'Séptimas' }));
        expect(stored('harmony.sevenths')).toBe(true);
        fireEvent.click(screen.getByText('V7'));
        const [step] = screen.getAllByTestId('harmony-step');
        expect(within(step).getByTestId('harmony-symbol')).toHaveTextContent('G7');
        expect(onUpdateProgression.mock.calls.at(-1)![0][0]).toEqual(['G4', 'B4', 'D5', 'F5']);
    });
});
