import { COMPUTER_LAYOUTS, fallbackKeyLabel, spanishNoteName } from '../audio/piano/notes';
import type { PianoLayout } from '../audio/piano/notes';
import { getPianoLayout } from './pianoLayout';

/**
 * Single declaration of every keyboard shortcut. The dispatcher, the cheat sheet (`?`),
 * the tooltips and (later) the command palette all read from here, so they cannot drift.
 *
 * Scopes: `piano` shortcuts are live only while the PC keyboard plays the piano (global mode on,
 * or focus inside the piano panel) and win over `global` ones that share a key. Every such
 * overlap is exposed by `shadowedBy` so the UI can say it out loud (T = tap vs Fa♯).
 *
 * (ES) Registro único de atajos de teclado.
 */
export type ShortcutScope = 'global' | 'piano';
export type ShortcutGroup = 'Transporte' | 'Vista' | 'Piano' | 'Ayuda';

export type ShortcutId =
    | 'piano.notes' | 'piano.octave-down' | 'piano.octave-up' | 'piano.velocity-down' | 'piano.velocity-up' | 'piano.sustain' | 'piano.exit'
    | 'transport.play' | 'transport.tap' | 'transport.bpm-up' | 'transport.bpm-down' | 'transport.prev-rhythm' | 'transport.next-rhythm'
    | 'view.stage' | 'help.shortcuts' | 'palette.open';

export interface ShortcutDef {
    id: ShortcutId;
    label: string;
    group: ShortcutGroup;
    scope: ShortcutScope;
    /** Physical keys (`KeyboardEvent.code`), so Spanish/AZERTY layouts keep the same positions. */
    codes?: readonly string[];
    /** Character keys (`KeyboardEvent.key`), for symbols like `?` that move around between layouts. */
    chars?: readonly string[];
    /** What to print in tooltips and the cheat sheet. */
    display: string;
    /** Needs Ctrl or Cmd held (and nothing else); every other shortcut ignores Ctrl/Cmd combos. */
    mod?: boolean;
    /** Print each space-separated token of `display` as its own keycap (the note row). */
    separateKeys?: boolean;
    /** Cancel the browser default (page scroll, button activation…). */
    preventDefault: boolean;
    /** Deliver auto-repeat keydowns too (held arrows keep nudging the tempo). */
    allowRepeat?: boolean;
    /** Cancel the keyup too, so a focused button is not "clicked" by Space. */
    swallowKeyup?: boolean;
}

/** The piano's keys follow the active layout (Ableton / Tracker); the getters are read on every keypress. */
const layout = () => COMPUTER_LAYOUTS[getPianoLayout()];
const notesDisplay = () => Object.keys(layout().notes).map(c => fallbackKeyLabel(c)).join(' ');

export const SHORTCUTS: readonly ShortcutDef[] = [
    { id: 'piano.notes', label: 'Tocar notas', group: 'Piano', scope: 'piano', get codes() { return Object.keys(layout().notes); }, get display() { return notesDisplay(); }, separateKeys: true, preventDefault: true },
    { id: 'piano.octave-down', label: 'Bajar octava', group: 'Piano', scope: 'piano', get codes() { return [layout().octave.down]; }, get display() { return fallbackKeyLabel(layout().octave.down); }, preventDefault: true },
    { id: 'piano.octave-up', label: 'Subir octava', group: 'Piano', scope: 'piano', get codes() { return [layout().octave.up]; }, get display() { return fallbackKeyLabel(layout().octave.up); }, preventDefault: true },
    { id: 'piano.velocity-down', label: 'Menos velocidad (más suave)', group: 'Piano', scope: 'piano', get codes() { return [layout().velocity.down]; }, get display() { return fallbackKeyLabel(layout().velocity.down); }, preventDefault: true },
    { id: 'piano.velocity-up', label: 'Más velocidad (más fuerte)', group: 'Piano', scope: 'piano', get codes() { return [layout().velocity.up]; }, get display() { return fallbackKeyLabel(layout().velocity.up); }, preventDefault: true },
    { id: 'piano.sustain', label: 'Pedal de sustain (mantener)', group: 'Piano', scope: 'piano', codes: ['ShiftLeft', 'ShiftRight'], display: 'Shift', preventDefault: false },
    { id: 'piano.exit', label: 'Salir del Teclado PC', group: 'Piano', scope: 'piano', codes: ['Escape'], display: 'Esc', preventDefault: false },
    { id: 'transport.play', label: 'Iniciar / detener', group: 'Transporte', scope: 'global', codes: ['Space'], display: 'Espacio', preventDefault: true, swallowKeyup: true },
    { id: 'transport.tap', label: 'Tap tempo', group: 'Transporte', scope: 'global', codes: ['KeyT'], display: 'T', preventDefault: false },
    { id: 'transport.bpm-up', label: 'Subir tempo (Shift: ±5)', group: 'Transporte', scope: 'global', codes: ['ArrowUp'], display: '↑', preventDefault: true, allowRepeat: true },
    { id: 'transport.bpm-down', label: 'Bajar tempo (Shift: ±5)', group: 'Transporte', scope: 'global', codes: ['ArrowDown'], display: '↓', preventDefault: true, allowRepeat: true },
    { id: 'transport.prev-rhythm', label: 'Ritmo anterior', group: 'Transporte', scope: 'global', codes: ['Comma'], display: ',', preventDefault: false },
    { id: 'transport.next-rhythm', label: 'Ritmo siguiente', group: 'Transporte', scope: 'global', codes: ['Period'], display: '.', preventDefault: false },
    { id: 'view.stage', label: 'Modo escenario (atril)', group: 'Vista', scope: 'global', codes: ['KeyF'], display: 'F', preventDefault: false },
    { id: 'palette.open', label: 'Paleta de comandos', group: 'Ayuda', scope: 'global', codes: ['KeyK'], display: '⌘K / Ctrl+K', mod: true, preventDefault: true },
    { id: 'help.shortcuts', label: 'Mostrar esta ayuda', group: 'Ayuda', scope: 'global', chars: ['?'], display: '?', preventDefault: true },
];

const BY_ID = new Map<ShortcutId, ShortcutDef>(SHORTCUTS.map(s => [s.id, s]));

export const shortcutById = (id: ShortcutId): ShortcutDef => BY_ID.get(id)!;

/** Does this keyboard event trigger the shortcut? (Alt combos never do; Ctrl/Cmd only for `mod` shortcuts.) */
export function matchesEvent(def: ShortcutDef, e: Pick<KeyboardEvent, 'code' | 'key' | 'altKey' | 'ctrlKey' | 'metaKey'>): boolean {
    if (e.altKey || (e.ctrlKey || e.metaKey) !== !!def.mod) return false;
    return !!def.codes?.includes(e.code) || !!def.chars?.includes(e.key);
}

/** Piano shortcuts that take this global shortcut's key away while the piano plays. */
export function shadowedBy(def: ShortcutDef): ShortcutDef[] {
    if (def.scope !== 'global' || !def.codes) return [];
    return SHORTCUTS.filter(s => s.scope === 'piano' && s.codes?.some(c => def.codes!.includes(c)));
}

/** Printable keys of a shortcut using real key labels (see `useKeyLabels`): "A W S E…", "Z", "Espacio". */
export function displayFor(def: ShortcutDef, labelOf: (code: string) => string): string {
    if (def.scope !== 'piano' || !def.codes || def.id === 'piano.sustain' || def.id === 'piano.exit') return def.display;
    return def.codes.map(labelOf).join(' ');
}

/** "Iniciar" -> "Iniciar (Espacio)". */
export const withShortcut = (text: string, id: ShortcutId): string => `${text} (${shortcutById(id).display})`;

/** Spanish name of the note a global shortcut's key plays in piano mode ("Fa♯" for T in the Ableton layout), if any. */
export function shadowNote(def: ShortcutDef, pianoLayout: PianoLayout = getPianoLayout()): string | null {
    const notes = COMPUTER_LAYOUTS[pianoLayout].notes;
    const code = def.codes?.find(c => notes[c] !== undefined);
    return code ? spanishNoteName(60 + notes[code]) : null;
}

const GROUP_ORDER: ShortcutGroup[] = ['Transporte', 'Vista', 'Piano', 'Ayuda'];

export function groupedShortcuts(): { group: ShortcutGroup; items: ShortcutDef[] }[] {
    return GROUP_ORDER.map(group => ({ group, items: SHORTCUTS.filter(s => s.group === group) }));
}
