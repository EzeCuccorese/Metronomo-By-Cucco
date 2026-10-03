import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePianoComputerKeyboard, COMPUTER_KEY_VELOCITY } from './usePianoComputerKeyboard';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

const key = (type: 'keydown' | 'keyup', code: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) => {
    const event = new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
};

function setup(globalEnabled: boolean, baseMidi = 48) {
    const container = document.createElement('div');
    const inner = document.createElement('button');
    container.appendChild(inner);
    document.body.appendChild(container);
    const onNoteOn = vi.fn();
    const onNoteOff = vi.fn();
    const onOctaveShift = vi.fn();
    const hook = renderHook((props: { globalEnabled: boolean; baseMidi: number }) => usePianoComputerKeyboard({
        ...props, containerRef: { current: container }, onNoteOn, onNoteOff, onOctaveShift,
    }), { initialProps: { globalEnabled, baseMidi } });
    return { ...hook, container, inner, onNoteOn, onNoteOff, onOctaveShift };
}

describe('usePianoComputerKeyboard', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    it('does nothing while disabled and the focus is outside the panel', () => {
        const { onNoteOn } = setup(false);
        const e = key('keydown', 'KeyA');
        expect(onNoteOn).not.toHaveBeenCalled();
        expect(e.defaultPrevented).toBe(false);
    });

    it('plays while the focus is inside the panel', () => {
        const { inner, onNoteOn, onNoteOff } = setup(false);
        inner.focus();
        key('keydown', 'KeyA', {}, inner);
        expect(onNoteOn).toHaveBeenCalledWith(48, COMPUTER_KEY_VELOCITY);
        key('keyup', 'KeyA', {}, inner);
        expect(onNoteOff).toHaveBeenCalledWith(48);
    });

    it('maps the layout from the base note, ignores auto-repeat and releases what it started', () => {
        const { onNoteOn, onNoteOff, rerender } = setup(true, 60);
        key('keydown', 'KeyW');
        key('keydown', 'KeyW', { repeat: true });
        key('keydown', 'KeyK');
        expect(onNoteOn.mock.calls.map(c => c[0])).toEqual([61, 72]);
        // Shifting octave while holding: the held key still releases the note it started.
        rerender({ globalEnabled: true, baseMidi: 72 });
        key('keyup', 'KeyW');
        expect(onNoteOff).toHaveBeenCalledWith(61);
        key('keyup', 'KeyQ'); // never pressed
        expect(onNoteOff).toHaveBeenCalledTimes(1);
    });

    it('Z / X shift the octave', () => {
        const { onOctaveShift } = setup(true);
        const e = key('keydown', 'KeyZ');
        expect(e.defaultPrevented).toBe(true);
        key('keydown', 'KeyX');
        key('keydown', 'KeyX', { repeat: true });
        expect(onOctaveShift.mock.calls).toEqual([[-1], [1]]);
    });

    it('leaves modifiers, unmapped keys, text fields and menus alone', () => {
        const { onNoteOn, container } = setup(true);
        key('keydown', 'KeyA', { ctrlKey: true });
        key('keydown', 'KeyA', { metaKey: true });
        const space = key('keydown', 'Space');
        expect(space.defaultPrevented).toBe(false);
        const input = document.createElement('input');
        document.body.appendChild(input);
        key('keydown', 'KeyA', {}, input);
        const menu = document.createElement('ul');
        menu.setAttribute('role', 'listbox');
        const item = document.createElement('li');
        menu.appendChild(item);
        container.appendChild(menu);
        key('keydown', 'KeyS', {}, item);
        // An SVG icon inside a dialog is an Element but not an HTMLElement.
        const dialog = document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        dialog.appendChild(icon);
        document.body.appendChild(dialog);
        key('keydown', 'KeyD', {}, icon as unknown as HTMLElement);
        expect(onNoteOn).not.toHaveBeenCalled();
    });

    it('takes T away from tap tempo only while it plays the piano (Space still plays/stops)', () => {
        const onTap = vi.fn();
        const onTogglePlay = vi.fn();
        renderHook(() => useKeyboardShortcuts({ onTap, onTogglePlay, onNudgeBpm: vi.fn() }));
        const { onNoteOn, rerender } = setup(true);
        key('keydown', 'KeyT');
        expect(onNoteOn).toHaveBeenCalledWith(54, COMPUTER_KEY_VELOCITY);
        expect(onTap).not.toHaveBeenCalled();
        key('keydown', 'Space');
        expect(onTogglePlay).toHaveBeenCalled();

        rerender({ globalEnabled: false, baseMidi: 48 });
        key('keyup', 'KeyT');
        key('keydown', 'KeyT');
        expect(onTap).toHaveBeenCalledTimes(1);
    });

    it('releases every held note when the window loses focus, the page hides or it unmounts', () => {
        const { onNoteOn, onNoteOff, unmount } = setup(true);
        key('keydown', 'KeyA');
        window.dispatchEvent(new Event('blur'));
        expect(onNoteOff).toHaveBeenCalledWith(48);

        key('keydown', 'KeyS');
        const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
        document.dispatchEvent(new Event('visibilitychange'));
        expect(onNoteOff).toHaveBeenCalledWith(50);
        visibility.mockReturnValue('visible');
        document.dispatchEvent(new Event('visibilitychange'));
        visibility.mockRestore();

        key('keydown', 'KeyD');
        unmount();
        expect(onNoteOff).toHaveBeenCalledWith(52);
        expect(onNoteOn).toHaveBeenCalledTimes(3);
    });

    it('ignores events another handler already consumed', () => {
        const { onNoteOn } = setup(true);
        const e = new KeyboardEvent('keydown', { code: 'KeyA', cancelable: true });
        e.preventDefault();
        window.dispatchEvent(e);
        expect(onNoteOn).not.toHaveBeenCalled();
    });
});
