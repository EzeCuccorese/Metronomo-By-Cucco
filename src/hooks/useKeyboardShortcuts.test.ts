import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

const press = (code: string, target: EventTarget = document.body, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
};

describe('useKeyboardShortcuts', () => {
    const setup = () => {
        const handlers = { onTogglePlay: vi.fn(), onTap: vi.fn(), onNudgeBpm: vi.fn() };
        renderHook(() => useKeyboardShortcuts(handlers));
        return handlers;
    };

    it('maps Space, T and arrows', () => {
        const h = setup();
        expect(press('Space').defaultPrevented).toBe(true);
        press('KeyT');
        press('ArrowUp');
        press('ArrowDown', document.body, { shiftKey: true });
        expect(h.onTogglePlay).toHaveBeenCalledTimes(1);
        expect(h.onTap).toHaveBeenCalledTimes(1);
        expect(h.onNudgeBpm).toHaveBeenNthCalledWith(1, 1);
        expect(h.onNudgeBpm).toHaveBeenNthCalledWith(2, -5);
    });

    it('leaves text fields, sliders and menus alone', () => {
        const h = setup();
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
        expect(h.onTap).not.toHaveBeenCalled();
        expect(h.onTogglePlay).not.toHaveBeenCalled();
        expect(h.onNudgeBpm).not.toHaveBeenCalled();
        input.remove(); slider.remove(); listbox.remove();
    });

    it('still works when a plain button has focus, without letting the button click', () => {
        const h = setup();
        const button = document.createElement('button');
        document.body.append(button);

        expect(press('Space', button).defaultPrevented).toBe(true);
        const keyup = new KeyboardEvent('keyup', { code: 'Space', bubbles: true, cancelable: true });
        button.dispatchEvent(keyup);
        expect(keyup.defaultPrevented).toBe(true); // the native keyup activation is cancelled
        press('ArrowUp', button);
        expect(h.onTogglePlay).toHaveBeenCalledTimes(1);
        expect(h.onNudgeBpm).toHaveBeenCalledWith(1);
        button.remove();
    });

    it('respects keys already handled by a component', () => {
        const h = setup();
        const event = new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true });
        event.preventDefault();
        document.body.dispatchEvent(event);
        expect(h.onTogglePlay).not.toHaveBeenCalled();
    });

    it('ignores modified and auto-repeated Space presses', () => {
        const h = setup();
        press('Space', document.body, { ctrlKey: true });
        press('Space', document.body, { repeat: true });
        expect(h.onTogglePlay).not.toHaveBeenCalled();
    });
});
