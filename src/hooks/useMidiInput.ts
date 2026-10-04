import { useCallback, useEffect, useRef, useState } from 'react';
import { ALL_DEVICES, MidiInputController, detectMidiSupport } from '../audio/midi/midiInput';
import type { MidiDevice, MidiSupport } from '../audio/midi/midiInput';

export type MidiStatus = 'idle' | 'connecting' | 'connected' | 'denied';

interface Options {
    onNoteOn: (midi: number, velocity: number) => void;
    onNoteOff: (midi: number) => void;
    /** MIDI pedal (CC64) state. */
    onSustain: (down: boolean) => void;
}

/**
 * Web MIDI input as a progressive enhancement. It never asks for permission by itself on the
 * first visit (Chrome shows a prompt): `connect()` is called from a button, and it reconnects
 * silently when the permission was already granted.
 *
 * (ES) Entrada MIDI: se conecta con un botón y se reconecta sola si ya había permiso.
 */
export function useMidiInput(options: Options) {
    const ref = useRef(options);
    useEffect(() => { ref.current = options; });

    const [support] = useState<MidiSupport>(() => detectMidiSupport());
    const [status, setStatus] = useState<MidiStatus>('idle');
    const [devices, setDevices] = useState<MidiDevice[]>([]);
    const [selected, setSelected] = useState(ALL_DEVICES);
    const controller = useRef<MidiInputController | null>(null);
    const mounted = useRef(true);
    const connecting = useRef(false); // guards against two overlapping connect() calls

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            controller.current?.dispose();
            controller.current = null;
        };
    }, []);

    const connect = useCallback(async () => {
        if (controller.current || connecting.current || typeof navigator.requestMIDIAccess !== 'function') return;
        connecting.current = true;
        setStatus('connecting');
        try {
            const access = await navigator.requestMIDIAccess({ sysex: false });
            if (!mounted.current) return;
            controller.current = new MidiInputController(access, {
                onNoteOn: (m, v) => ref.current.onNoteOn(m, v),
                onNoteOff: m => ref.current.onNoteOff(m),
                onSustain: d => ref.current.onSustain(d),
                onDevicesChange: list => {
                    setDevices(list);
                    setSelected(prev => (prev !== ALL_DEVICES && !list.some(d => d.id === prev) ? ALL_DEVICES : prev));
                },
            });
            setStatus('connected');
        } catch {
            if (mounted.current) setStatus('denied');
        } finally {
            connecting.current = false;
        }
    }, []);

    // Already allowed before: reconnect without bothering the player.
    useEffect(() => {
        if (support.kind !== 'available') return;
        let cancelled = false;
        navigator.permissions?.query({ name: 'midi' }).then(result => {
            if (!cancelled && result.state === 'granted') void connect();
        }).catch(() => undefined);
        return () => { cancelled = true; };
    }, [support.kind, connect]);

    const select = useCallback((id: string) => {
        setSelected(id);
        controller.current?.select(id);
    }, []);

    return { support, status, devices, selected, select, connect };
}
