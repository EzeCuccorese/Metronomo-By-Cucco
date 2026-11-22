import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { useState } from 'react';
import PatternEditor from '../PatternEditor';
import type { RhythmPattern } from '../../rhythms/RhythmPatterns';
import { DEFAULT_CUSTOM_PATTERN, resolvePattern } from '../../rhythms/patternLibrary';

function Harness({ initial, onChange }: { initial: RhythmPattern; onChange: (p: RhythmPattern) => void }) {
    const [pattern, setPattern] = useState(initial);
    return <PatternEditor pattern={pattern} onPatternUpdate={p => { setPattern(p); onChange(p); }} />;
}

const setup = (initial: RhythmPattern = DEFAULT_CUSTOM_PATTERN) => {
    const onChange = vi.fn();
    render(<Harness initial={initial} onChange={onChange} />);
    return { onChange, last: () => onChange.mock.calls.at(-1)![0] as RhythmPattern };
};

describe('PatternEditor', () => {
    afterEach(cleanup);

    it('adds a note with a click and toggles it off with a second click', () => {
        const { last } = setup();
        const cell = screen.getByTestId('cell-kick-1');
        fireEvent.pointerDown(cell, { button: 0 });
        expect(last().steps).toEqual([{ step: 1, instrument: 'kick', velocity: 0.7, modifier: undefined }]);
        expect(screen.getByTestId('cell-kick-1')).toHaveAttribute('aria-pressed', 'true');

        fireEvent.pointerDown(screen.getByTestId('cell-kick-1'), { button: 0 });
        expect(last().steps).toEqual([]);
    });

    it('is operable from the keyboard', () => {
        const { last } = setup();
        fireEvent.keyDown(screen.getByTestId('cell-snare-5'), { key: 'Enter' });
        expect(last().steps[0]).toMatchObject({ step: 5, instrument: 'snare' });
    });

    it('switches to a real 6/8 meter', async () => {
        const { last } = setup();
        fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Compás' }));
        fireEvent.click(within(await screen.findByRole('listbox')).getByText('6/8'));
        expect(last().timeSignature).toEqual([6, 8]);
        expect(last().subdivision).toBe(12); // sixteenths stay sixteenths: 2 per eighth
    });

    it('clears the pattern and can undo it', () => {
        const initial = { ...DEFAULT_CUSTOM_PATTERN, steps: [{ step: 1, instrument: 'kick' as const, velocity: 1 }] };
        const { last } = setup(initial);
        fireEvent.click(screen.getByRole('button', { name: 'Borrar patrón' }));
        expect(last().steps).toEqual([]);
        fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
        expect(last().steps).toEqual(initial.steps);
    });

    it('only offers restore for edited presets', () => {
        const onRestore = vi.fn();
        render(<PatternEditor pattern={DEFAULT_CUSTOM_PATTERN} onPatternUpdate={vi.fn()} canRestore onRestore={onRestore} />);
        fireEvent.click(screen.getByRole('button', { name: 'Restaurar ritmo original' }));
        expect(onRestore).toHaveBeenCalled();
    });

    it('preserves programmed steps across non-destructive figure switches (Corcheas -> Tresillos -> Negras -> Corcheas)', async () => {
        const rock = resolvePattern('rock_basic', {});
        const { last } = setup(rock);

        const pickSub = async (name: string) => {
            fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Subdivisión' }));
            fireEvent.click(within(await screen.findByRole('listbox')).getByText(name));
        };

        await pickSub('Tresillos');
        expect(last().subdivision).toBe(12);
        await pickSub('Negras');
        expect(last().subdivision).toBe(4);
        await pickSub('Corcheas');
        expect(last().subdivision).toBe(8);
        expect(last().steps).toEqual(rock.steps);
    });

    it('renders SVG note glyphs without broken Unicode SMP glyphs and hides phantom Aro rows on Zamba', () => {
        const zamba = resolvePattern('zamba', {});
        const { container } = render(<PatternEditor pattern={zamba} onPatternUpdate={vi.fn()} />);
        expect(container.textContent).not.toContain('𝅘𝅥𝅯');
        expect(container.textContent).not.toContain('𝅘𝅥𝅰');
        expect(screen.queryByText('Aro')).toBeNull();
        expect(screen.getByTestId('cell-bombo_leguero-9').querySelector('svg')).not.toBeNull();
    });
});
