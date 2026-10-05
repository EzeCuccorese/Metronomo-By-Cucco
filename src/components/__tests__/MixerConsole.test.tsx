import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MixerConsole } from '../MixerConsole';
import { useMixer } from '../../hooks/useMixer';
import type { MixerEngine } from '../../hooks/useMixer';
import type { RhythmPattern } from '../../rhythms/RhythmPatterns';
import { PRESET_PATTERNS } from '../../rhythms/RhythmPatterns';
import { DEFAULT_CUSTOM_PATTERN, METRONOME_PATTERN_ID } from '../../rhythms/patternLibrary';

const metronome = PRESET_PATTERNS.find(p => p.id === METRONOME_PATTERN_ID)!;
const rock = PRESET_PATTERNS.find(p => p.id === 'rock_basic')!;

/** What App does: the mix lives in `useMixer`, the card only draws it. */
const MixerHarness = ({ pattern, isPlaying = false, getChannelLevel, ...engine }: { pattern: RhythmPattern; isPlaying?: boolean; getChannelLevel?: (id: string) => number } & MixerEngine) => {
    const mixer = useMixer(pattern, engine);
    return (
        <MixerConsole
            channels={mixer.channels}
            onVolume={mixer.setVolume}
            onPan={mixer.setPan}
            onToggleMute={mixer.toggleMute}
            pattern={pattern}
            isPlaying={isPlaying}
            getChannelLevel={getChannelLevel}
        />
    );
};

const renderMixer = (pattern = metronome) => {
    const handlers = { onVolumeChange: vi.fn(), onPanChange: vi.fn(), onMuteChange: vi.fn() };
    const utils = render(<MixerHarness pattern={pattern} {...handlers} />);
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
        rerender(<MixerHarness pattern={rock} onVolumeChange={vi.fn()} onPanChange={vi.fn()} onMuteChange={onMuteChange} />);
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

    it('has a PIANO strip', () => {
        const { onVolumeChange } = renderMixer();
        expect(screen.getByTestId('mixer-channel-piano')).toHaveTextContent('PIANO');
        expect(onVolumeChange).toHaveBeenCalledWith('piano', 0.9);
    });

    it('keeps a mix saved before the PIANO strip existed, adding the new strip', () => {
        const old = {
            clickRulePatternId: METRONOME_PATTERN_ID,
            channels: [
                { id: 'bombo', name: 'BOMBO', volume: 0.4, pan: 0, isMuted: true },
                { id: 'synth', name: 'TECLADO', volume: 0.2, pan: -0.3, isMuted: false },
                { id: 'ghost', name: 'X', volume: 1, pan: 0, isMuted: false },
            ],
        };
        localStorage.setItem('metronomo:v1:mixer', JSON.stringify(old));
        const { onVolumeChange, onMuteChange } = renderMixer();
        expect(onVolumeChange).toHaveBeenCalledWith('bombo', 0.4);
        expect(onMuteChange).toHaveBeenCalledWith('bombo', true);
        expect(onVolumeChange).toHaveBeenCalledWith('synth', 0.2);
        expect(onVolumeChange).toHaveBeenCalledWith('piano', 0.9);
        expect(screen.getByTestId('mute-piano')).toHaveAttribute('aria-pressed', 'false');
    });

    it.each([
        ['not an object', 'x'],
        ['no valid channel', { clickRulePatternId: null, channels: [{ id: 'ghost' }] }],
        ['bad click rule', { clickRulePatternId: 3, channels: [] }],
        ['channels missing', { clickRulePatternId: null }],
    ])('falls back to the default mix when the stored one is %s', (_, value) => {
        localStorage.setItem('metronomo:v1:mixer', JSON.stringify(value));
        const { onVolumeChange } = renderMixer();
        expect(onVolumeChange).toHaveBeenCalledWith('bombo', 1);
    });

    describe('meters follow each channel output', () => {
        const litSegments = (id: string) =>
            screen.getByTestId(`mixer-channel-${id}`).querySelectorAll('.vu-segment.active').length;

        const setup = (levels: Record<string, number>) => {
            const frames: FrameRequestCallback[] = [];
            vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
            vi.stubGlobal('cancelAnimationFrame', () => {});
            const getChannelLevel = vi.fn((id: string) => levels[id] ?? 0);
            render(<MixerHarness pattern={rock} isPlaying onVolumeChange={vi.fn()} onPanChange={vi.fn()} onMuteChange={vi.fn()} getChannelLevel={getChannelLevel} />);
            act(() => { frames.shift()?.(0); });
        };

        afterEach(() => vi.unstubAllGlobals());

        it('lights only PIANO when only the piano strip has output', () => {
            setup({ piano: 0.9 });
            expect(litSegments('piano')).toBeGreaterThan(0);
            expect(litSegments('synth')).toBe(0);
        });

        it('lights only TECLADO when only the pad strip has output', () => {
            setup({ synth: 0.9 });
            expect(litSegments('synth')).toBeGreaterThan(0);
            expect(litSegments('piano')).toBe(0);
        });

        it('does not run a per-frame loop while idle (slow poll only)', () => {
            vi.useFakeTimers();
            const frames: FrameRequestCallback[] = [];
            vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
            vi.stubGlobal('cancelAnimationFrame', () => {});
            render(<MixerHarness pattern={rock} isPlaying={false} onVolumeChange={vi.fn()} onPanChange={vi.fn()} onMuteChange={vi.fn()} getChannelLevel={() => 0} />);
            act(() => { frames.shift()?.(0); });
            expect(frames).toHaveLength(0); // nothing queued right away
            act(() => { vi.advanceTimersByTime(200); });
            expect(frames).toHaveLength(1); // next check comes from the idle timer
            vi.useRealTimers();
        });

        it('does not light TECLADO from chord changes alone', () => {
            setup({});
            expect(litSegments('synth')).toBe(0);
            expect(litSegments('piano')).toBe(0);
        });
    });
});
