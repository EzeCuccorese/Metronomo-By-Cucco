import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MixerConsole } from '../MixerConsole';
import { PRESET_PATTERNS } from '../../rhythms/RhythmPatterns';
import { DEFAULT_CUSTOM_PATTERN, METRONOME_PATTERN_ID } from '../../rhythms/patternLibrary';

const metronome = PRESET_PATTERNS.find(p => p.id === METRONOME_PATTERN_ID)!;
const rock = PRESET_PATTERNS.find(p => p.id === 'rock_basic')!;

const renderMixer = (pattern = metronome) => {
    const handlers = { onVolumeChange: vi.fn(), onPanChange: vi.fn(), onMuteChange: vi.fn() };
    const utils = render(<MixerConsole pattern={pattern} isPlaying={false} {...handlers} />);
    return { ...utils, ...handlers };
};

describe('MixerConsole', () => {
    afterEach(() => {
        cleanup();
        localStorage.clear();
    });

    it('keeps the click audible for the metronome preset (C1 regression)', () => {
        const { onMuteChange } = renderMixer(metronome);
        expect(screen.getByTestId('mute-click')).toHaveAttribute('aria-pressed', 'false');
        expect(onMuteChange).toHaveBeenCalledWith('click', false);
        expect(onMuteChange).not.toHaveBeenCalledWith('click', true);
    });

    it('keeps the click audible for the custom pattern', () => {
        renderMixer(DEFAULT_CUSTOM_PATTERN);
        expect(screen.getByTestId('mute-click')).toHaveAttribute('aria-pressed', 'false');
    });

    it('mutes the click when a rhythm preset is selected', () => {
        const { rerender, onMuteChange } = renderMixer(metronome);
        rerender(<MixerConsole pattern={rock} isPlaying={false} onVolumeChange={vi.fn()} onPanChange={vi.fn()} onMuteChange={onMuteChange} />);
        expect(screen.getByTestId('mute-click')).toHaveAttribute('aria-pressed', 'true');
        expect(onMuteChange).toHaveBeenLastCalledWith('click', true);
    });

    it('mute does not overwrite the fader volume (A11)', () => {
        const { onVolumeChange, onMuteChange } = renderMixer(rock);
        onVolumeChange.mockClear();
        fireEvent.click(screen.getByTestId('mute-kick'));
        expect(onMuteChange).toHaveBeenCalledWith('kick', true);
        expect(onVolumeChange).not.toHaveBeenCalledWith('kick', 0);
    });

    it('persists the mixer and respects a manual click choice after reload', () => {
        renderMixer(rock);
        fireEvent.click(screen.getByTestId('mute-click')); // user unmutes the click on a rhythm
        cleanup();
        renderMixer(rock);
        expect(screen.getByTestId('mute-click')).toHaveAttribute('aria-pressed', 'false');
    });

    it('pans with the keyboard', () => {
        const { onPanChange } = renderMixer(rock);
        const knob = screen.getByRole('slider', { name: 'Paneo KICK' });
        fireEvent.keyDown(knob, { key: 'ArrowRight' });
        expect(onPanChange).toHaveBeenLastCalledWith('kick', 0.05);
        fireEvent.keyDown(knob, { key: 'Home' });
        expect(onPanChange).toHaveBeenLastCalledWith('kick', 0);
    });

    it('changes the volume from the fader', () => {
        const { onVolumeChange } = renderMixer(rock);
        fireEvent.change(screen.getByLabelText('Volumen KICK'), { target: { value: '0.5' } });
        expect(onVolumeChange).toHaveBeenLastCalledWith('kick', 0.5);
    });
});
