import { vi } from 'vitest';

/** Minimal MIDIAccess for tests: inputs can be plugged, unplugged and fed raw messages. */
export class FakeMidiInput {
    onmidimessage: ((e: MIDIMessageEvent) => void) | null = null;
    state: 'connected' | 'disconnected' = 'connected';
    readonly type = 'input';
    id: string;
    name: string;
    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }
    send(...bytes: number[]) {
        const event = { data: new Uint8Array(bytes), currentTarget: this } as unknown as MIDIMessageEvent;
        this.onmidimessage?.(event);
    }
}

export class FakeMidiAccess extends EventTarget {
    inputs = new Map<string, FakeMidiInput>();
    plug(id: string, name: string) {
        const input = new FakeMidiInput(id, name);
        this.inputs.set(id, input);
        this.fire(input);
        return input;
    }
    unplug(id: string) {
        const input = this.inputs.get(id)!;
        input.state = 'disconnected';
        this.fire(input);
    }
    private fire(port: FakeMidiInput) {
        const event = new Event('statechange') as Event & { port: FakeMidiInput };
        event.port = port;
        this.dispatchEvent(event);
    }
}

export function stubRequestMidiAccess(access: FakeMidiAccess | Error) {
    const fn = vi.fn(async () => {
        if (access instanceof Error) throw access;
        return access as unknown as MIDIAccess;
    });
    Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: fn });
    return fn;
}

export function unstubRequestMidiAccess() {
    delete (navigator as unknown as { requestMIDIAccess?: unknown }).requestMIDIAccess;
}
