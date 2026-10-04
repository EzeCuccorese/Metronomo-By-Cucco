import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { CompactTransport } from '../CompactTransport';
import { BeatLeds } from '../TransportControls';
import { PlaybackContext } from '../../state/PlaybackContext';
import { createPlaybackStore } from '../../state/playbackStore';
import { PRESET_PATTERNS } from '../../rhythms/RhythmPatterns';
import { useElementOutOfView } from '../../hooks/useElementOutOfView';

const pattern = PRESET_PATTERNS.find(p => p.id === 'rock_basic')!;

const renderBar = (props: Partial<React.ComponentProps<typeof CompactTransport>> = {}) => {
    const store = createPlaybackStore();
    const handlers = { onTogglePlay: vi.fn(), onNudgeBpm: vi.fn(), onTapTempo: vi.fn() };
    const utils = render(
        <PlaybackContext.Provider value={store}>
            <CompactTransport pattern={pattern} bpm={96} isPlaying={false} {...handlers} {...props} />
        </PlaybackContext.Provider>
    );
    return { ...utils, ...handlers, store };
};

describe('CompactTransport', () => {
    afterEach(cleanup);

    it('shows tempo, rhythm and the controls', () => {
        renderBar();
        expect(screen.getByRole('toolbar', { name: 'Transporte' })).toBeInTheDocument();
        expect(screen.getByTestId('compact-bpm')).toHaveTextContent('96');
        expect(screen.getByText(pattern.name)).toBeInTheDocument();
    });

    it('plays, taps and nudges the tempo', () => {
        const { onTogglePlay, onTapTempo, onNudgeBpm } = renderBar();
        fireEvent.click(screen.getByTestId('compact-play-toggle'));
        fireEvent.click(screen.getByRole('button', { name: 'Tap tempo' }));
        fireEvent.pointerDown(screen.getByRole('button', { name: 'Subir tempo' }), { button: 0 });
        fireEvent.pointerDown(screen.getByRole('button', { name: 'Bajar tempo' }), { button: 0 });
        expect(onTogglePlay).toHaveBeenCalled();
        expect(onTapTempo).toHaveBeenCalled();
        expect(onNudgeBpm).toHaveBeenNthCalledWith(1, 1);
        expect(onNudgeBpm).toHaveBeenNthCalledWith(2, -1);
    });

    it('offers Stop while playing and locks the tempo while the trainer runs', () => {
        renderBar({ isPlaying: true, tempoLocked: true });
        expect(screen.getByTestId('compact-play-toggle')).toHaveTextContent('DETENER');
        expect(screen.getByRole('button', { name: 'Tap tempo' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Subir tempo' })).toBeDisabled();
    });

    it('renders the view control it is given', () => {
        renderBar({ viewControl: <button type="button">Vista</button> });
        expect(screen.getByRole('button', { name: 'Vista' })).toBeInTheDocument();
    });
});

describe('BeatLeds', () => {
    afterEach(cleanup);

    it('lights the current beat only while playing', () => {
        const store = createPlaybackStore();
        const view = (isPlaying: boolean) => (
            <PlaybackContext.Provider value={store}>
                <BeatLeds pattern={pattern} isPlaying={isPlaying} />
            </PlaybackContext.Provider>
        );
        const { rerender } = render(view(false));
        expect(screen.getByTestId('beat-leds')).toHaveAttribute('aria-label', '4 pulsos por compás');
        expect(document.querySelectorAll('[data-active="true"]')).toHaveLength(0);

        const stepsPerBeat = pattern.subdivision / pattern.timeSignature[0];
        act(() => store.update({ step: stepsPerBeat * 2 }));
        rerender(view(true));
        expect(screen.getByTestId('beat-leds')).toHaveAttribute('aria-label', 'Pulso 3 de 4');
        const lit = [...document.querySelectorAll('[data-active]')].map(el => el.getAttribute('data-active'));
        expect(lit).toEqual(['false', 'false', 'true', 'false']);
    });
});

describe('useElementOutOfView', () => {
    afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

    function Probe({ element }: { element: Element | null }) {
        return <span data-testid="out">{String(useElementOutOfView(element))}</span>;
    }

    it('follows the intersection of the element', () => {
        const target = document.createElement('div');
        let callback!: (entries: { isIntersecting: boolean }[]) => void;
        const disconnect = vi.fn();
        vi.stubGlobal('IntersectionObserver', class { constructor(cb: typeof callback) { callback = cb; } observe() {} disconnect = disconnect; });
        const { unmount } = render(<Probe element={target} />);
        expect(screen.getByTestId('out')).toHaveTextContent('false');
        act(() => callback([{ isIntersecting: false }]));
        expect(screen.getByTestId('out')).toHaveTextContent('true');
        act(() => callback([{ isIntersecting: true }]));
        expect(screen.getByTestId('out')).toHaveTextContent('false');
        unmount();
        expect(disconnect).toHaveBeenCalled();
    });

    it('stays false without an element or without IntersectionObserver', () => {
        render(<Probe element={null} />);
        expect(screen.getByTestId('out')).toHaveTextContent('false');
        cleanup();
        vi.stubGlobal('IntersectionObserver', undefined);
        render(<Probe element={document.createElement('div')} />);
        expect(screen.getByTestId('out')).toHaveTextContent('false');
    });
});
