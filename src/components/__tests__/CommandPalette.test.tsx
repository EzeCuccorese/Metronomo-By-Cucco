import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CommandPalette from '../CommandPalette';
import type { PaletteCommand } from '../CommandPalette';
import { useShortcutHandlers } from '../../shortcuts/dispatcher';

function Harness({ play, commands, onSetBpm, onClose = () => {}, tempoLocked = false }: { play: () => void; commands: PaletteCommand[]; onSetBpm: (n: number) => void; onClose?: () => void; tempoLocked?: boolean }) {
    useShortcutHandlers({ 'transport.play': play });
    return <CommandPalette open onClose={onClose} commands={commands} onSetBpm={onSetBpm} tempoLocked={tempoLocked} />;
}

const setup = (over: Partial<Parameters<typeof Harness>[0]> = {}) => {
    const props = { play: vi.fn(), commands: [{ id: 'rhythm.x', label: 'Ritmo: Chacarera', group: 'Ritmos', run: vi.fn() }] as PaletteCommand[], onSetBpm: vi.fn(), onClose: vi.fn(), ...over };
    render(<Harness {...props} />);
    return props;
};

describe('CommandPalette', () => {
    it('lists the registry shortcuts and the extra commands', () => {
        setup();
        expect(screen.getByRole('dialog', { name: 'Paleta de comandos' })).toBeInTheDocument();
        expect(screen.getByText('Iniciar / detener')).toBeInTheDocument();
        expect(screen.getByText('Ritmo: Chacarera')).toBeInTheDocument();
        expect(screen.queryByText('Tocar notas')).not.toBeInTheDocument(); // piano keys are not commands
    });

    it('filters while typing and runs the selected command, closing the palette', () => {
        const p = setup();
        const input = screen.getByPlaceholderText(/Buscá un comando/);
        fireEvent.change(input, { target: { value: 'chacar' } });
        expect(screen.queryByText('Iniciar / detener')).not.toBeInTheDocument();
        fireEvent.click(screen.getByText('Ritmo: Chacarera'));
        expect(p.commands[0].run).toHaveBeenCalled();
        expect(p.onClose).toHaveBeenCalled();
    });

    it('running a shortcut command invokes its handler', () => {
        const p = setup();
        fireEvent.click(screen.getByText('Iniciar / detener'));
        expect(p.play).toHaveBeenCalledTimes(1);
    });

    it('turns a typed number into a tempo command, within the BPM range', () => {
        const p = setup();
        const input = screen.getByPlaceholderText(/Buscá un comando/);
        fireEvent.change(input, { target: { value: '90' } });
        fireEvent.click(screen.getByText('Poner tempo 90 BPM'));
        expect(p.onSetBpm).toHaveBeenCalledWith(90);
        fireEvent.change(input, { target: { value: '999' } });
        expect(screen.getByText(/fuera de/)).toBeInTheDocument();
    });

    it('does not offer the tempo while the trainer owns it', () => {
        const p = setup({ tempoLocked: true });
        fireEvent.change(screen.getByPlaceholderText(/Buscá un comando/), { target: { value: '90' } });
        fireEvent.click(screen.getByText(/Poner tempo 90 BPM/));
        expect(p.onSetBpm).not.toHaveBeenCalled();
    });
});
