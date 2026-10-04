import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { FirstUseTips } from '../FirstUseTips';
import { STORAGE_PREFIX } from '../../state/storage';

const stubDevice = (desktop: boolean) =>
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: desktop && q.includes('hover: hover'), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
const seen = () => JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}tips.seen`) ?? '[]');

function Page() {
    return (
        <>
            <button type="button" data-testid="play-toggle">Iniciar</button>
            <section data-panel="piano"><span data-testid="key">do</span></section>
            <FirstUseTips />
        </>
    );
}

/** A long scroll: moves the page a full screen, then lets it settle. */
function longScroll(to: number) {
    (window as { scrollY: number }).scrollY = to;
    fireEvent.scroll(window);
    act(() => { vi.advanceTimersByTime(400); });
}

describe('FirstUseTips', () => {
    beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); stubDevice(true); });
    afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); (window as { scrollY: number }).scrollY = 0; });

    it('says nothing until something triggers it', () => {
        render(<Page />);
        expect(screen.queryByText(/Tip:/)).toBeNull();
    });

    it('offers the Space bar after the first Play with the mouse, once', () => {
        render(<Page />);
        fireEvent.click(screen.getByTestId('play-toggle'), { detail: 1 });
        expect(screen.getByText(/barra Espacio/)).toBeInTheDocument();
        expect(seen()).toEqual(['play']);
        fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
        act(() => { vi.advanceTimersByTime(500); });
        expect(screen.queryByText(/barra Espacio/)).toBeNull();
        fireEvent.click(screen.getByTestId('play-toggle'), { detail: 1 });
        expect(screen.queryByText(/barra Espacio/)).toBeNull();
    });

    it('does not show it for a keyboard activation or on a touch device', () => {
        const { unmount } = render(<Page />);
        fireEvent.click(screen.getByTestId('play-toggle'), { detail: 0 });
        expect(screen.queryByText(/Tip:/)).toBeNull();
        unmount();
        stubDevice(false);
        render(<Page />);
        fireEvent.click(screen.getByTestId('play-toggle'), { detail: 1 });
        fireEvent.pointerOver(screen.getByTestId('key'), { pointerType: 'mouse' });
        expect(screen.queryByText(/Tip:/)).toBeNull();
    });

    it('offers the computer keyboard on the first mouse hover over the piano', () => {
        render(<Page />);
        fireEvent.pointerOver(screen.getByTestId('key'), { pointerType: 'touch' });
        expect(screen.queryByText(/Tip:/)).toBeNull();
        fireEvent.pointerOver(screen.getByTestId('key'), { pointerType: 'mouse' });
        expect(screen.getByText(/teclado de la computadora/)).toBeInTheDocument();
    });

    it('shows one tip at a time; the one that had to wait comes back at its next trigger', () => {
        render(<Page />);
        fireEvent.click(screen.getByTestId('play-toggle'), { detail: 1 });
        fireEvent.pointerOver(screen.getByTestId('key'), { pointerType: 'mouse' });
        expect(screen.queryByText(/teclado de la computadora/)).toBeNull();
        expect(seen()).toEqual(['play']);
        fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
        act(() => { vi.advanceTimersByTime(500); });
        fireEvent.pointerOver(screen.getByTestId('key'), { pointerType: 'mouse' });
        expect(screen.getByText(/teclado de la computadora/)).toBeInTheDocument();
    });

    it('points to the Vista menu after the third long scroll, not after short ones', () => {
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
        render(<Page />);
        longScroll(100); // short
        longScroll(1100);
        longScroll(100);
        expect(screen.queryByText(/Vista/)).toBeNull();
        longScroll(1100);
        expect(screen.getByText(/Ocultá o plegá paneles desde "Vista"/)).toBeInTheDocument();
        expect(seen()).toEqual(['layout']);
    });

    it('stays quiet about tips already seen', () => {
        localStorage.setItem(`${STORAGE_PREFIX}tips.seen`, JSON.stringify(['play']));
        render(<Page />);
        fireEvent.click(screen.getByTestId('play-toggle'), { detail: 1 });
        expect(screen.queryByText(/Tip:/)).toBeNull();
    });

    it('hides itself after a while', () => {
        render(<Page />);
        fireEvent.click(screen.getByTestId('play-toggle'), { detail: 1 });
        act(() => { vi.advanceTimersByTime(13000); });
        act(() => { vi.advanceTimersByTime(500); });
        expect(screen.queryByText(/barra Espacio/)).toBeNull();
    });
});
