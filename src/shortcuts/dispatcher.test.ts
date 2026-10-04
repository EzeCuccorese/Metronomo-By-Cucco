import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useShortcutDispatcher, useShortcutHandlers, usePianoScope, invokeShortcut, usePianoGlobalMode } from './dispatcher';

const press = (code: string, target: EventTarget = document.body, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
};

describe('shortcut dispatcher', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    const setup = () => {
        const h = { play: vi.fn(), tap: vi.fn(), up: vi.fn(), down: vi.fn(), help: vi.fn(), note: vi.fn() };
        const hook = renderHook(({ pianoOn }: { pianoOn: boolean }) => {
            useShortcutDispatcher();
            usePianoScope(pianoOn, () => false);
            useShortcutHandlers({
                'transport.play': h.play, 'transport.tap': h.tap, 'transport.bpm-up': h.up, 'transport.bpm-down': h.down,
                'help.shortcuts': h.help, 'piano.notes': h.note,
            });
            return usePianoGlobalMode();
        }, { initialProps: { pianoOn: false } });
        return { ...hook, h };
    };

    it('maps Space, T, arrows and ?', () => {
        const { h } = setup();
        expect(press('Space').defaultPrevented).toBe(true);
        press('KeyT');
        press('ArrowUp', document.body, { shiftKey: true });
        press('ArrowDown');
        press('Slash', document.body, { key: '?', shiftKey: true });
        expect(h.play).toHaveBeenCalledTimes(1);
        expect(h.tap).toHaveBeenCalledTimes(1);
        expect(h.up.mock.calls[0][0].shiftKey).toBe(true);
        expect(h.down).toHaveBeenCalledTimes(1);
        expect(h.help).toHaveBeenCalledTimes(1);
    });

    it('lets piano keys through only while the piano scope is active, and T goes to the piano then', () => {
        const { h, rerender, result } = setup();
        press('KeyA');
        expect(h.note).not.toHaveBeenCalled();
        expect(result.current).toBe(false);

        rerender({ pianoOn: true });
        expect(result.current).toBe(true);
        press('KeyA');
        press('KeyT'); // Fa♯ wins over tap tempo, visibly
        expect(h.note).toHaveBeenCalledTimes(2);
        expect(h.tap).not.toHaveBeenCalled();
        // Space is always play/stop, even with the piano on.
        press('Space');
        expect(h.play).toHaveBeenCalledTimes(1);
        // Back off: T is tap tempo again.
        rerender({ pianoOn: false });
        press('KeyT');
        expect(h.tap).toHaveBeenCalledTimes(1);
    });

    it('leaves text fields, sliders and menus alone', () => {
        const { h } = setup();
        const input = document.createElement('input');
        const slider = document.createElement('span');
        slider.setAttribute('role', 'slider');
        const listbox = document.createElement('ul');
        listbox.setAttribute('role', 'listbox');
        document.body.append(input, slider, listbox);
        press('KeyT', input);
        press('Space', input);
        press('ArrowUp', slider);
        press('Space', listbox);
        expect(h.tap).not.toHaveBeenCalled();
        expect(h.play).not.toHaveBeenCalled();
        expect(h.up).not.toHaveBeenCalled();
    });

    it('still works with a plain button focused, without letting the button click', () => {
        const { h } = setup();
        const button = document.createElement('button');
        document.body.append(button);
        expect(press('Space', button).defaultPrevented).toBe(true);
        const keyup = new KeyboardEvent('keyup', { code: 'Space', bubbles: true, cancelable: true });
        button.dispatchEvent(keyup);
        expect(keyup.defaultPrevented).toBe(true);
        expect(h.play).toHaveBeenCalledTimes(1);
    });

    it('respects handled, modified and repeated keys', () => {
        const { h } = setup();
        const handled = new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true });
        handled.preventDefault();
        document.body.dispatchEvent(handled);
        press('Space', document.body, { ctrlKey: true });
        press('KeyT', document.body, { metaKey: true });
        press('Space', document.body, { repeat: true });
        expect(h.play).not.toHaveBeenCalled();
        expect(h.tap).not.toHaveBeenCalled();
        press('ArrowUp', document.body, { repeat: true }); // arrows keep nudging while held
        expect(h.up).toHaveBeenCalledTimes(1);
    });

    it('Cmd/Ctrl+K works even from a text field, where plain keys never do', () => {
        const palette = vi.fn();
        renderHook(() => { useShortcutDispatcher(); useShortcutHandlers({ 'palette.open': palette }); });
        const input = document.createElement('input');
        document.body.append(input);
        press('KeyK', input);
        expect(palette).not.toHaveBeenCalled();
        expect(press('KeyK', input, { metaKey: true }).defaultPrevented).toBe(true);
        press('KeyK', document.body, { ctrlKey: true });
        expect(palette).toHaveBeenCalledTimes(2);
    });

    it('stops dispatching a handler once unmounted, and invokeShortcut runs it directly', () => {
        const { h, unmount } = setup();
        invokeShortcut('transport.play');
        expect(h.play).toHaveBeenCalledTimes(1);
        unmount();
        press('Space');
        invokeShortcut('transport.play');
        expect(h.play).toHaveBeenCalledTimes(1);
    });
});
