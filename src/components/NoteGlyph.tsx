import React from 'react';

export type NoteGlyphKind =
  | 'quarter'
  | 'eighth'
  | 'triplet'
  | 'sixteenth'
  | 'sextuplet'
  | 'thirtysecond'
  | 'rim'
  | 'open';

interface NoteGlyphProps {
  kind: NoteGlyphKind;
  size?: number;
}

const FLAG_PATHS: Partial<Record<NoteGlyphKind, string[]>> = {
  eighth: ['M14 4c2.8 1.4 4.2 3.4 4 6.2-.5-2-2.1-3.2-4-3.7Z'],
  triplet: ['M14 4c2.8 1.4 4.2 3.4 4 6.2-.5-2-2.1-3.2-4-3.7Z'],
  sixteenth: [
    'M14 4c2.8 1.3 4.2 3.1 4 5.7-.5-1.8-2.1-2.9-4-3.4Z',
    'M14 8.2c2.8 1.3 4.2 3.1 4 5.7-.5-1.8-2.1-2.9-4-3.4Z',
  ],
  sextuplet: [
    'M14 4c2.8 1.3 4.2 3.1 4 5.7-.5-1.8-2.1-2.9-4-3.4Z',
    'M14 8.2c2.8 1.3 4.2 3.1 4 5.7-.5-1.8-2.1-2.9-4-3.4Z',
  ],
  thirtysecond: [
    'M14 3.5c2.8 1.1 4.1 2.7 3.9 4.9-.5-1.6-2-2.6-3.9-3Z',
    'M14 7c2.8 1.1 4.1 2.7 3.9 4.9-.5-1.6-2-2.6-3.9-3Z',
    'M14 10.5c2.8 1.1 4.1 2.7 3.9 4.9-.5-1.6-2-2.6-3.9-3Z',
  ],
};

/**
 * Custom inline SVG musical glyphs (system-font independent: zero broken Unicode SMP boxes).
 */
export const NoteGlyph: React.FC<NoteGlyphProps> = ({ kind, size = 18 }) => {
  if (kind === 'rim') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
        <path
          d="M6.5 6.5L17.5 17.5M17.5 6.5L6.5 17.5"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (kind === 'open') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
        <circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
      </svg>
    );
  }

  const flags = FLAG_PATHS[kind] ?? [];
  const tupleNum = kind === 'triplet' ? '3' : kind === 'sextuplet' ? '6' : null;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <ellipse cx="9.2" cy="17.8" rx="4.2" ry="3.1" transform="rotate(-20 9.2 17.8)" fill="currentColor" />
      <rect x="12.3" y="4" width="1.9" height="13.5" rx="0.9" fill="currentColor" />
      {flags.map((d, i) => (
        <path key={i} d={d} fill="currentColor" />
      ))}
      {tupleNum && (
        <text
          x="18.2"
          y="20.2"
          textAnchor="middle"
          fontSize="8.5"
          fontWeight="800"
          fontFamily="Outfit, sans-serif"
          fill="currentColor"
        >
          {tupleNum}
        </text>
      )}
    </svg>
  );
};
