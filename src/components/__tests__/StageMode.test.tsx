import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { StageMode } from '../StageMode';
import { PlaybackContext } from '../../state/PlaybackContext';
import { createPlaybackStore } from '../../state/playbackStore';
import { PRESET_PATTERNS } from '../../rhythms/RhythmPatterns';
import { STORAGE_PREFIX } from '../../state/storage';
import { isFullscreenSupported } from '../../hooks/useFullscreen';

const pattern = PRESET_PATTERNS.find(p => p.id === 'rock_basic')!;
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1';

function setup(props: Partial<React.ComponentProps<typeof StageMode>> = {}) {
    const store = createPlaybackStore();
    const handlers = { onClose: vi.fn(), onTogglePlay: vi.fn(), onNudgeBpm: vi.fn() };
    const view = (extra: Partial<React.ComponentProps<typeof StageMode>> = {}) => (
        <PlaybackContext.Provider value={store}>
            <StageMode open pattern={pattern} bpm={100} isPlaying={false} {...handlers} {...props} {...extra} />
        </PlaybackContext.Provider>
    );
    const utils = render(view());
    return { ...utils, ...handlers, store, rerenderWith: (extra: Partial<React.ComponentProps<typeof StageMode>>) => utils.rerender(view(extra)) };
}

const stubFullscreen = (enabled: boolean | undefined, ua?: string) => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: enabled });
    if (ua) vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
};

describe('StageMode', () => {
    beforeEach(() => stubFullscreen(false));
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        Reflect.deleteProperty(document, 'fullscreenEnabled');
        Reflect.deleteProperty(document, 'fullscreenElement');
        localStorage.clear();
    });

    it('shows the tempo and rhythm big, and stays closed when not open', async () => {
        const { rerenderWith } = setup();
        expect(screen.getByRole('dialog', { name: 'Modo escenario' })).toBeInTheDocument();
        expect(screen.getByTestId('stage-bpm')).toHaveTextContent('100');
        expect(screen.getByText(pattern.name)).toBeInTheDocument();
        rerenderWith({ open: false });
        await waitFor(() => expect(screen.queryByTestId('stage-bpm')).toBeNull());
    });

    it('lights the beat that is sounding', () => {
        const { store, rerenderWith } = setup();
        expect(screen.getByTestId('stage-beats')).toHaveAttribute('aria-label', '4 pulsos por compás');
        const stepsPerBeat = pattern.subdivision / pattern.timeSignature[0];
        act(() => store.update({ step: stepsPerBeat }));
        rerenderWith({ isPlaying: true });
        expect(screen.getByTestId('stage-beats')).toHaveAttribute('aria-label', 'Pulso 2 de 4');
        const lit = [...document.querySelectorAll('[data-testid="stage-beats"] [data-active]')].map(el => el.getAttribute('data-active'));
        expect(lit).toEqual(['false', 'true', 'false', 'false']);
    });

    it('starts and stops, nudges the tempo and closes', () => {
        const { onTogglePlay, onNudgeBpm, onClose } = setup();
        fireEvent.click(screen.getByTestId('stage-play-toggle'));
        fireEvent.pointerDown(screen.getByTestId('stage-bpm-up'), { button: 0 });
        fireEvent.pointerDown(screen.getByTestId('stage-bpm-down'), { button: 0 });
        fireEvent.click(screen.getByTestId('stage-close'));
        expect(onTogglePlay).toHaveBeenCalled();
        expect(onNudgeBpm).toHaveBeenNthCalledWith(1, 1);
        expect(onNudgeBpm).toHaveBeenNthCalledWith(2, -1);
        expect(onClose).toHaveBeenCalled();
    });

    it('closes with Escape', () => {
        const { onClose } = setup();
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });

    it('locks the tempo buttons while the trainer runs and offers Stop while playing', () => {
        setup({ isPlaying: true, tempoLocked: true });
        expect(screen.getByTestId('stage-play-toggle')).toHaveTextContent('DETENER');
        expect(screen.getByTestId('stage-bpm-up')).toBeDisabled();
    });

    it('shows the sounding chord from the saved progression', () => {
        localStorage.setItem(`${STORAGE_PREFIX}harmony.sequence`, JSON.stringify([
            { degree: 'I', durationUnits: 2, notes: ['C4', 'E4', 'G4'] },
            { degree: 'V', durationUnits: 2, notes: ['G3', 'B3', 'D4'] },
        ]));
        const { store, rerenderWith } = setup({ isPlaying: true });
        expect(screen.queryByTestId('stage-chord')).toBeNull();
        act(() => store.update({ chordIndex: 3 }));
        rerenderWith({ isPlaying: true });
        expect(screen.getByTestId('stage-chord')).toHaveTextContent('V · Sol');
        act(() => store.update({ chordIndex: 9 }));
        rerenderWith({ isPlaying: true });
        expect(screen.queryByTestId('stage-chord')).toBeNull();
    });

    describe('fullscreen', () => {
        it('hides the button where element fullscreen is not available', () => {
            stubFullscreen(false);
            setup();
            expect(screen.queryByRole('button', { name: /pantalla completa/i })).toBeNull();
        });

        it('hides the button on iPhone even if the browser claims support', () => {
            stubFullscreen(true, IPHONE);
            expect(isFullscreenSupported()).toBe(false);
            setup();
            expect(screen.queryByRole('button', { name: /pantalla completa/i })).toBeNull();
        });

        it('offers it on other devices, enters on demand and follows the browser state', async () => {
            stubFullscreen(true, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15');
            const request = vi.fn(async () => {});
            HTMLElement.prototype.requestFullscreen = request;
            document.exitFullscreen = vi.fn(async () => {});
            setup();
            const button = await screen.findByRole('button', { name: 'Pantalla completa' });
            await act(async () => { fireEvent.click(button); });
            expect(request).toHaveBeenCalled();
            Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: document.body });
            act(() => { document.dispatchEvent(new Event('fullscreenchange')); });
            const exit = screen.getByRole('button', { name: 'Salir de pantalla completa' });
            await act(async () => { fireEvent.click(exit); });
            expect(document.exitFullscreen).toHaveBeenCalled();
        });

        it('does not fail when the browser refuses fullscreen', async () => {
            stubFullscreen(true, 'Mozilla/5.0 (Macintosh)');
            HTMLElement.prototype.requestFullscreen = vi.fn(async () => { throw new Error('denied'); });
            setup();
            await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Pantalla completa' })); });
            expect(screen.getByTestId('stage-bpm')).toBeInTheDocument();
        });

        it('leaves fullscreen when closing', async () => {
            stubFullscreen(true, 'Mozilla/5.0 (Macintosh)');
            document.exitFullscreen = vi.fn(async () => {});
            Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: document.body });
            const { onClose } = setup();
            await act(async () => { fireEvent.click(screen.getByTestId('stage-close')); });
            expect(document.exitFullscreen).toHaveBeenCalled();
            expect(onClose).toHaveBeenCalled();
        });
    });
});
