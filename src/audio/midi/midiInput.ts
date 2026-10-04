/**
 * Native Web MIDI input (progressive enhancement: Chrome/Edge/Android; Safari and every iOS
 * browser do not implement it). Messages are parsed here and routed to callbacks; the piano
 * panel feeds them into its normal noteOn / noteOff / pedal, so the looper records MIDI too.
 *
 * (ES) Entrada MIDI nativa.
 */

export type MidiEvent =
    | { type: 'noteOn'; midi: number; velocity: number }
    | { type: 'noteOff'; midi: number }
    | { type: 'sustain'; down: boolean };

const SUSTAIN_CC = 64;

/** Parses a raw MIDI message. Note On with velocity 0 is a Note Off; CC64 >= 64 is pedal down. */
export function parseMidiMessage(data: ArrayLike<number> | null | undefined): MidiEvent | null {
    if (!data || data.length < 3) return null;
    const status = data[0] & 0xf0;
    const a = data[1] & 0x7f;
    const b = data[2] & 0x7f;
    if (status === 0x90 && b > 0) return { type: 'noteOn', midi: a, velocity: b / 127 };
    if (status === 0x80 || status === 0x90) return { type: 'noteOff', midi: a };
    if (status === 0xb0 && a === SUSTAIN_CC) return { type: 'sustain', down: b >= 64 };
    return null;
}

export interface MidiDevice {
    id: string;
    name: string;
}

export interface MidiCallbacks {
    onNoteOn: (midi: number, velocity: number) => void;
    onNoteOff: (midi: number) => void;
    /** Pedal state of the MIDI source (shared with the Shift / on-screen pedal by the panel). */
    onSustain: (down: boolean) => void;
    onDevicesChange: (devices: MidiDevice[]) => void;
}

export const ALL_DEVICES = 'all';

/** Listens to the connected inputs, tracks what each one holds and releases it on hot-unplug. */
export class MidiInputController {
    private held = new Map<string, Set<number>>();
    private pedal = new Set<string>();
    private selected = ALL_DEVICES;
    private disposed = false;
    private lastDevices = '';

    private access: MIDIAccess;
    private cb: MidiCallbacks;

    constructor(access: MIDIAccess, cb: MidiCallbacks) {
        this.access = access;
        this.cb = cb;
        access.addEventListener('statechange', this.handleStateChange);
        this.refresh();
    }

    public get devices(): MidiDevice[] {
        const list: MidiDevice[] = [];
        this.access.inputs.forEach(input => {
            if (input.state === 'connected') list.push({ id: input.id, name: input.name || 'Teclado MIDI' });
        });
        return list;
    }

    /** Listen to one device, or to all of them. */
    public select(id: string) {
        if (id === this.selected) return;
        this.selected = id;
        this.releaseAll();
    }

    private accepts(id: string) {
        return this.selected === ALL_DEVICES || this.selected === id;
    }

    private refresh() {
        this.access.inputs.forEach(input => {
            input.onmidimessage = input.state === 'connected' ? this.handleMessage : null;
        });
        const devices = this.devices;
        const key = devices.map(d => `${d.id}:${d.name}`).join('|');
        if (key !== this.lastDevices) {
            this.lastDevices = key;
            this.cb.onDevicesChange(devices);
        }
        // The selected device vanished: fall back to listening to all of them.
        if (this.selected !== ALL_DEVICES && !devices.some(d => d.id === this.selected)) this.selected = ALL_DEVICES;
    }

    private handleStateChange = (e: Event) => {
        if (this.disposed) return;
        const port = (e as MIDIConnectionEvent).port;
        if (port && port.type === 'input' && port.state !== 'connected') this.releaseDevice(port.id);
        this.refresh();
    };

    private handleMessage = (e: MIDIMessageEvent) => {
        const id = ((e.currentTarget ?? e.target) as MIDIInput | null)?.id;
        if (this.disposed || id === undefined || !this.accepts(id)) return;
        const event = parseMidiMessage(e.data);
        if (!event) return;
        const held = this.held.get(id) ?? new Set<number>();
        this.held.set(id, held);
        if (event.type === 'noteOn') {
            if (held.has(event.midi)) this.cb.onNoteOff(event.midi); // retrigger without a Note Off
            held.add(event.midi);
            this.cb.onNoteOn(event.midi, event.velocity);
        } else if (event.type === 'noteOff') {
            if (held.delete(event.midi)) this.cb.onNoteOff(event.midi);
        } else {
            this.setPedal(id, event.down);
        }
    };

    private setPedal(id: string, down: boolean) {
        const before = this.pedal.size > 0;
        if (down) this.pedal.add(id); else this.pedal.delete(id);
        const after = this.pedal.size > 0;
        if (before !== after) this.cb.onSustain(after);
    }

    private releaseDevice(id: string) {
        this.held.get(id)?.forEach(midi => this.cb.onNoteOff(midi));
        this.held.delete(id);
        this.setPedal(id, false);
    }

    /** Lets go of every note (and the pedal) a device is holding. */
    public releaseAll() {
        Array.from(this.held.keys()).forEach(id => this.releaseDevice(id));
        Array.from(this.pedal).forEach(id => this.setPedal(id, false));
    }

    public dispose() {
        if (this.disposed) return;
        this.releaseAll();
        this.disposed = true;
        this.access.removeEventListener('statechange', this.handleStateChange);
        this.access.inputs.forEach(input => { input.onmidimessage = null; });
    }
}

// --- Platform support ---

export type MidiSupport =
    | { kind: 'available' }
    | { kind: 'ios' }
    | { kind: 'safari-desktop' }
    | { kind: 'unsupported' };

interface NavigatorLike {
    userAgent: string;
    maxTouchPoints?: number;
    requestMIDIAccess?: unknown;
}

/** Which message to show: iOS browsers all use WebKit (no Web MIDI), desktop Safari has none either. */
export function detectMidiSupport(nav: NavigatorLike = navigator): MidiSupport {
    if (typeof nav.requestMIDIAccess === 'function') return { kind: 'available' };
    const ua = nav.userAgent;
    // iPadOS reports itself as a Mac with a touch screen.
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav.maxTouchPoints ?? 0) > 1);
    if (ios) return { kind: 'ios' };
    if (/Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|OPR\/|Firefox\//.test(ua)) return { kind: 'safari-desktop' };
    return { kind: 'unsupported' };
}

export const MIDI_NOTICE: Record<'ios' | 'safari-desktop' | 'unsupported', string> = {
    ios: 'MIDI no está disponible en iPhone/iPad (ningún navegador de iOS lo soporta). Usá el teclado en pantalla o abrí la app en Chrome en una computadora o Android.',
    'safari-desktop': 'Para conectar un teclado MIDI, abrí la app en Chrome.',
    unsupported: 'Este navegador no permite conectar teclados MIDI. Probá con Chrome en una computadora o Android.',
};
