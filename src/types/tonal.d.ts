/**
 * Minimal typings for the Tonal.js modules the app uses.
 *
 * The published @tonaljs/* packages declare `types: dist/index.d.ts` but ship
 * `dist/index.d.mts`/`.d.cts`, so TypeScript cannot find their own declarations.
 * Only the functions used in src/theory and src/audio/piano/notes.ts are declared here.
 */
declare module '@tonaljs/note' {
    export interface Note {
        readonly empty: boolean;
        readonly name: string;
        readonly letter: string;
        /** "", "#", "b", "##", "bb". */
        readonly acc: string;
        readonly oct?: number;
        readonly pc: string;
        readonly chroma: number;
        readonly midi: number | null;
    }
    export function get(note: string): Note;
    export function midi(note: string): number | null;
    export function chroma(note: string): number;
    export function pitchClass(note: string): string;
    export function simplify(note: string): string;
    export function fromMidiSharps(midi: number): string;
}

declare module '@tonaljs/scale' {
    export interface Scale {
        readonly empty: boolean;
        readonly name: string;
        readonly notes: string[];
        readonly intervals: string[];
    }
    export function get(name: string): Scale;
}

declare module '@tonaljs/chord' {
    export function detect(notes: readonly string[]): string[];
}
