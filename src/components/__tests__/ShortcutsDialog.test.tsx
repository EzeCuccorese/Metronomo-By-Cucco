import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { setPianoLayout } from '../../shortcuts/pianoLayout';
import ShortcutsDialog from '../ShortcutsDialog';
import { SHORTCUTS } from '../../shortcuts/registry';

describe('ShortcutsDialog', () => {
    it('lists every registry shortcut and flags the T conflict', () => {
        render(<ShortcutsDialog open onClose={() => {}} />);
        expect(screen.getByRole('dialog', { name: 'Atajos de teclado' })).toBeInTheDocument();
        for (const s of SHORTCUTS) expect(screen.getByTestId(`shortcut-${s.id}`)).toBeInTheDocument();
        expect(screen.getByText(/toca Fa♯/)).toBeInTheDocument();
    });

    it('shows the piano keys of the layout in use', () => {
        setPianoLayout('tracker');
        render(<ShortcutsDialog open onClose={() => {}} />);
        expect(screen.getByTestId('shortcut-piano.octave-down')).toHaveTextContent('-');
        expect(screen.getByText(/toca Sol/)).toBeInTheDocument();
        cleanup();
        setPianoLayout('ableton');
        render(<ShortcutsDialog open onClose={() => {}} />);
        expect(screen.getByTestId('shortcut-piano.octave-down')).toHaveTextContent('Z');
    });

    it('closes from the button', () => {
        const onClose = vi.fn();
        render(<ShortcutsDialog open onClose={onClose} />);
        fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
        expect(onClose).toHaveBeenCalled();
    });
});
