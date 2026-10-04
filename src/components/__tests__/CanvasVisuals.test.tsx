import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import InteractiveInstrumentVisual from '../InteractiveInstrumentVisual';
import ConductorVisual from '../ConductorVisual';
import { PRESET_PATTERNS } from '../../rhythms/RhythmPatterns';

const pattern = PRESET_PATTERNS[0];

beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
        observe() {}
        unobserve() {}
        disconnect() {}
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('InteractiveInstrumentVisual accessibility', () => {
    it('hides the decorative canvas from assistive tech', () => {
        const { container } = render(
            <InteractiveInstrumentVisual pattern={pattern} isPlaying={false} onPreviewInstrument={vi.fn()} />
        );
        expect(container.querySelector('canvas')).toHaveAttribute('aria-hidden', 'true');
    });

    it('exposes a labelled button per instrument that plays on click', () => {
        const onPreview = vi.fn();
        render(<InteractiveInstrumentVisual pattern={pattern} isPlaying={false} onPreviewInstrument={onPreview} />);
        const list = screen.getByRole('list', { name: 'Probar instrumentos', hidden: true });
        expect(list.querySelectorAll('button').length).toBeGreaterThanOrEqual(10);

        fireEvent.click(screen.getByRole('button', { name: 'Tocar tambor chico' }));
        expect(onPreview).toHaveBeenCalledWith('candombe_chico', undefined);

        fireEvent.click(screen.getByRole('button', { name: 'Tocar bombo legüero (aro)' }));
        expect(onPreview).toHaveBeenLastCalledWith('rim', undefined);
    });

    it('buttons are native, focusable and keyboard-activatable', () => {
        const onPreview = vi.fn();
        render(<InteractiveInstrumentVisual pattern={pattern} isPlaying={false} onPreviewInstrument={onPreview} />);
        const btn = screen.getByRole('button', { name: 'Tocar claves' });
        expect(btn.tagName).toBe('BUTTON');
        expect(btn).not.toHaveAttribute('tabindex', '-1');
        btn.focus();
        expect(btn).toHaveFocus();
        // Native buttons turn Enter/Space into a click; jsdom does not, so dispatch it.
        fireEvent.click(document.activeElement as HTMLElement);
        expect(onPreview).toHaveBeenCalledWith('clave', undefined);
    });
});

describe('ConductorVisual accessibility', () => {
    it('marks the decorative canvas aria-hidden without role or label', () => {
        const { container } = render(
            <ConductorVisual pattern={pattern} isPlaying={false} trainerActive={false} totalBarsInterval={4} />
        );
        const canvas = container.querySelector('canvas')!;
        expect(canvas).toHaveAttribute('aria-hidden', 'true');
        expect(canvas).not.toHaveAttribute('role');
        expect(canvas).not.toHaveAttribute('aria-label');
    });
});
