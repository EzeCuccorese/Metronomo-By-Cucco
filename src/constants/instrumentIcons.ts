import type React from 'react';
import { Drum, CircleDot, Triangle, Music, Zap, Hexagon, Circle, Disc } from 'lucide-react';
import type { InstrumentType } from '../rhythms/RhythmPatterns';

// Map of Icons
export const InstrumentIcons: Record<InstrumentType, React.ComponentType<{ className?: string; size?: number; strokeWidth?: number; color?: string }>> = {
    kick: CircleDot,
    snare: Drum,
    hihat: Triangle,
    ride: Disc,
    tom_high: Circle,
    tom_low: Circle,
    tom_floor: Circle,
    crash: Hexagon,
    bombo_leguero: Drum,
    click: Circle,
    shaker: Zap,
    clave: Music,
    rim: CircleDot,
    surdo: CircleDot,
    hihat_foot: Triangle,
    caja: Drum,
    cajon: Hexagon,
    palmas: CircleDot,
    candombe_chico: Drum,
    candombe_repique: Drum,
    candombe_piano: Drum
};
