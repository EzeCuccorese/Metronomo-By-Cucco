import { describe, it, expect, vi } from 'vitest';
import { MidiInputController, ALL_DEVICES, detectMidiSupport, MIDI_NOTICE, parseMidiMessage } from './midiInput';
import { FakeMidiAccess } from '../../test/fakeMidi';

describe('parseMidiMessage', () => {
    it('reads note on/off with velocity, any channel', () => {
        expect(parseMidiMessage([0x90, 60, 127])).toEqual({ type: 'noteOn', midi: 60, velocity: 1 });
        expect(parseMidiMessage([0x93, 61, 64])).toEqual({ type: 'noteOn', midi: 61, velocity: 64 / 127 });
        expect(parseMidiMessage([0x80, 60, 0])).toEqual({ type: 'noteOff', midi: 60 });
        expect(parseMidiMessage([0x90, 60, 0])).toEqual({ type: 'noteOff', midi: 60 }); // Note On, velocity 0
    });

    it('reads the sustain pedal (CC64: >= 64 down) and ignores everything else', () => {
        expect(parseMidiMessage([0xb0, 64, 127])).toEqual({ type: 'sustain', down: true });
        expect(parseMidiMessage([0xb0, 64, 63])).toEqual({ type: 'sustain', down: false });
        expect(parseMidiMessage([0xb0, 7, 100])).toBeNull(); // volume
        expect(parseMidiMessage([0xe0, 0, 64])).toBeNull(); // pitch bend
        expect(parseMidiMessage([0xf8])).toBeNull(); // clock
        expect(parseMidiMessage(null)).toBeNull();
    });
});

describe('MidiInputController', () => {
    const setup = () => {
        const access = new FakeMidiAccess();
        const cb = { onNoteOn: vi.fn(), onNoteOff: vi.fn(), onSustain: vi.fn(), onDevicesChange: vi.fn() };
        const piano = access.plug('a', 'Piano A');
        const controller = new MidiInputController(access as unknown as MIDIAccess, cb);
        return { access, cb, piano, controller };
    };

    it('lists the connected devices and routes notes with their velocity', () => {
        const { cb, piano, controller } = setup();
        expect(controller.devices).toEqual([{ id: 'a', name: 'Piano A' }]);
        expect(cb.onDevicesChange).toHaveBeenLastCalledWith([{ id: 'a', name: 'Piano A' }]);
        piano.send(0x90, 60, 100);
        piano.send(0x80, 60, 0);
        expect(cb.onNoteOn).toHaveBeenCalledWith(60, 100 / 127);
        expect(cb.onNoteOff).toHaveBeenCalledWith(60);
    });

    it('ignores a Note Off for a note it never started, and releases before a retrigger', () => {
        const { cb, piano } = setup();
        piano.send(0x80, 62, 0);
        expect(cb.onNoteOff).not.toHaveBeenCalled();
        piano.send(0x90, 62, 90);
        piano.send(0x90, 62, 90);
        expect(cb.onNoteOff).toHaveBeenCalledTimes(1);
        expect(cb.onNoteOn).toHaveBeenCalledTimes(2);
    });

    it('reports the sustain pedal once per change', () => {
        const { cb, piano } = setup();
        piano.send(0xb0, 64, 127);
        piano.send(0xb0, 64, 100);
        piano.send(0xb0, 64, 0);
        expect(cb.onSustain.mock.calls).toEqual([[true], [false]]);
    });

    it('hot-unplug releases the held notes and the pedal of that device', () => {
        const { access, cb, piano } = setup();
        piano.send(0x90, 60, 100);
        piano.send(0x90, 64, 100);
        piano.send(0xb0, 64, 127);
        access.unplug('a');
        expect(cb.onNoteOff.mock.calls.map(c => c[0]).sort((a, b) => a - b)).toEqual([60, 64]);
        expect(cb.onSustain).toHaveBeenLastCalledWith(false);
        expect(cb.onDevicesChange).toHaveBeenLastCalledWith([]);
        piano.send(0x90, 67, 100); // a stale message from an unplugged port is not routed
        expect(cb.onNoteOn).toHaveBeenCalledTimes(2);
    });

    it('picks up a device plugged in later', () => {
        const { access, cb } = setup();
        const second = access.plug('b', 'Piano B');
        expect(cb.onDevicesChange).toHaveBeenLastCalledWith([{ id: 'a', name: 'Piano A' }, { id: 'b', name: 'Piano B' }]);
        second.send(0x90, 72, 80);
        expect(cb.onNoteOn).toHaveBeenCalledWith(72, 80 / 127);
    });

    it('listens to the selected device only, releasing what the others held', () => {
        const { access, cb, piano, controller } = setup();
        const second = access.plug('b', 'Piano B');
        piano.send(0x90, 60, 100);
        controller.select('b');
        expect(cb.onNoteOff).toHaveBeenCalledWith(60);
        piano.send(0x90, 61, 100);
        expect(cb.onNoteOn).toHaveBeenCalledTimes(1);
        second.send(0x90, 62, 100);
        expect(cb.onNoteOn).toHaveBeenCalledTimes(2);
        controller.select(ALL_DEVICES);
        piano.send(0x90, 63, 100);
        expect(cb.onNoteOn).toHaveBeenCalledTimes(3);
    });

    it('dispose releases everything and stops listening', () => {
        const { access, cb, piano, controller } = setup();
        piano.send(0x90, 60, 100);
        controller.dispose();
        expect(cb.onNoteOff).toHaveBeenCalledWith(60);
        piano.send(0x90, 61, 100);
        access.plug('c', 'Late');
        expect(cb.onNoteOn).toHaveBeenCalledTimes(1);
    });
});

describe('detectMidiSupport', () => {
    const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
    const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1';
    const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
    const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

    it('is available whenever requestMIDIAccess exists', () => {
        expect(detectMidiSupport({ userAgent: MAC_CHROME, requestMIDIAccess: () => {} })).toEqual({ kind: 'available' });
    });

    it('explains iPhone/iPad (every iOS browser, and iPadOS posing as a Mac)', () => {
        expect(detectMidiSupport({ userAgent: IPHONE })).toEqual({ kind: 'ios' });
        expect(detectMidiSupport({ userAgent: IPHONE_CHROME })).toEqual({ kind: 'ios' });
        expect(detectMidiSupport({ userAgent: MAC_SAFARI, maxTouchPoints: 5 })).toEqual({ kind: 'ios' });
        expect(MIDI_NOTICE.ios).toBe('MIDI no está disponible en iPhone/iPad (ningún navegador de iOS lo soporta). Usá el teclado en pantalla o abrí la app en Chrome en una computadora o Android.');
    });

    it('explains desktop Safari', () => {
        expect(detectMidiSupport({ userAgent: MAC_SAFARI, maxTouchPoints: 0 })).toEqual({ kind: 'safari-desktop' });
        expect(MIDI_NOTICE['safari-desktop']).toBe('Para conectar un teclado MIDI, abrí la app en Chrome.');
    });

    it('falls back to a generic message elsewhere', () => {
        expect(detectMidiSupport({ userAgent: MAC_CHROME })).toEqual({ kind: 'unsupported' });
    });
});
