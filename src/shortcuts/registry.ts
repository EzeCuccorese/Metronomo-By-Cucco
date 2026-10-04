import { COMPUTER_KEY_SEMITONES, OCTAVE_KEYS, computerKeyLabel, spanishNoteName } from '../audio/piano/notes';

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
export type ShortcutGroup = 'Transporte' | 'Piano' | 'Ayuda';

export type ShortcutId =
    | 'piano.notes' | 'piano.octave-down' | 'piano.octave-up'
    | 'transport.play' | 'transport.tap' | 'transport.bpm-up' | 'transport.bpm-down' | 'transport.prev-rhythm' | 'transport.next-rhythm'
    | 'help.shortcuts';

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
    /** Cancel the browser default (page scroll, button activation…). */
    preventDefault: boolean;
    /** Deliver auto-repeat keydowns too (held arrows keep nudging the tempo). */
    allowRepeat?: boolean;
    /** Cancel the keyup too, so a focused button is not "clicked" by Space. */
    swallowKeyup?: boolean;
}

const PIANO_NOTE_CODES = Object.keys(COMPUTER_KEY_SEMITONES);

/** Order matters: the dispatcher tries them in this order (piano before global). */
export const SHORTCUTS: readonly ShortcutDef[] = [
    { id: 'piano.notes', label: 'Tocar notas', group: 'Piano', scope: 'piano', codes: PIANO_NOTE_CODES, display: PIANO_NOTE_CODES.map(c => computerKeyLabel(COMPUTER_KEY_SEMITONES[c]) ?? c).join(' '), preventDefault: true },
    { id: 'piano.octave-down', label: 'Bajar octava', group: 'Piano', scope: 'piano', codes: [Object.keys(OCTAVE_KEYS)[0]], display: 'Z', preventDefault: true },
    { id: 'piano.octave-up', label: 'Subir octava', group: 'Piano', scope: 'piano', codes: [Object.keys(OCTAVE_KEYS)[1]], display: 'X', preventDefault: true },
    { id: 'transport.play', label: 'Iniciar / detener', group: 'Transporte', scope: 'global', codes: ['Space'], display: 'Espacio', preventDefault: true, swallowKeyup: true },
    { id: 'transport.tap', label: 'Tap tempo', group: 'Transporte', scope: 'global', codes: ['KeyT'], display: 'T', preventDefault: false },
    { id: 'transport.bpm-up', label: 'Subir tempo (Shift: ±5)', group: 'Transporte', scope: 'global', codes: ['ArrowUp'], display: '↑', preventDefault: true, allowRepeat: true },
    { id: 'transport.bpm-down', label: 'Bajar tempo (Shift: ±5)', group: 'Transporte', scope: 'global', codes: ['ArrowDown'], display: '↓', preventDefault: true, allowRepeat: true },
    { id: 'transport.prev-rhythm', label: 'Ritmo anterior', group: 'Transporte', scope: 'global', codes: ['Comma'], display: ',', preventDefault: false },
    { id: 'transport.next-rhythm', label: 'Ritmo siguiente', group: 'Transporte', scope: 'global', codes: ['Period'], display: '.', preventDefault: false },
    { id: 'help.shortcuts', label: 'Mostrar esta ayuda', group: 'Ayuda', scope: 'global', chars: ['?'], display: '?', preventDefault: true },
];

const BY_ID = new Map<ShortcutId, ShortcutDef>(SHORTCUTS.map(s => [s.id, s]));

export const shortcutById = (id: ShortcutId): ShortcutDef => BY_ID.get(id)!;

/** Does this keyboard event trigger the shortcut? (Alt/Ctrl/Meta combos never do.) */
export function matchesEvent(def: ShortcutDef, e: Pick<KeyboardEvent, 'code' | 'key' | 'altKey' | 'ctrlKey' | 'metaKey'>): boolean {
    if (e.altKey || e.ctrlKey || e.metaKey) return false;
    return !!def.codes?.includes(e.code) || !!def.chars?.includes(e.key);
}

/** Piano shortcuts that take this global shortcut's key away while the piano plays. */
export function shadowedBy(def: ShortcutDef): ShortcutDef[] {
    if (def.scope !== 'global' || !def.codes) return [];
    return SHORTCUTS.filter(s => s.scope === 'piano' && s.codes?.some(c => def.codes!.includes(c)));
}

/** "Iniciar" -> "Iniciar (Espacio)". */
export const withShortcut = (text: string, id: ShortcutId): string => `${text} (${shortcutById(id).display})`;

/** Spanish name of the note a global shortcut's key plays in piano mode ("Fa♯" for T), if any. */
export function shadowNote(def: ShortcutDef): string | null {
    const code = def.codes?.find(c => COMPUTER_KEY_SEMITONES[c] !== undefined);
    return code ? spanishNoteName(60 + COMPUTER_KEY_SEMITONES[code]) : null;
}

const GROUP_ORDER: ShortcutGroup[] = ['Transporte', 'Piano', 'Ayuda'];

export function groupedShortcuts(): { group: ShortcutGroup; items: ShortcutDef[] }[] {
    return GROUP_ORDER.map(group => ({ group, items: SHORTCUTS.filter(s => s.group === group) }));
}
