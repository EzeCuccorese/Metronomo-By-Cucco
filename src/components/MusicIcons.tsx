import { SvgIcon } from '@mui/material';
import type { SvgIconProps } from '@mui/material';

export function QuarterNoteIcon(props: SvgIconProps) {
    return (
        <SvgIcon {...props} viewBox="0 0 24 24">
            {/* Filled Head + Stem */}
            <path d="M12 13v-8.5h2v8.5c0 1.5-1.5 3-3.5 3s-3.5-1.5-3.5-3 1.5-3 3.5-3c.5 0 1 .1 1.5.3z" transform="rotate(-10 12 16)" />
        </SvgIcon>
    );
}

export function EighthNoteIcon(props: SvgIconProps) {
    return (
        <SvgIcon {...props} viewBox="0 0 24 24">
            {/* Head, Stem, Single Flag */}
            <path d="M12 13v-8.5h2v8.5c0 1.5-1.5 3-3.5 3s-3.5-1.5-3.5-3 1.5-3 3.5-3c.5 0 1 .1 1.5.3z" transform="rotate(-10 12 16)" />
            <path d="M14 4.5l3 2v-1.5l-3-2z" />
            {/* Better Flag */}
            <path d="M14 4.5c0 0 2 0 4 3s1 4 0 5" fill="none" stroke="currentColor" strokeWidth="2" />
        </SvgIcon>
    );
}

export function SixteenthNoteIcon(props: SvgIconProps) {
    return (
        <SvgIcon {...props} viewBox="0 0 24 24">
            {/* Head, Stem, Double Flag */}
            <path d="M12 13v-8.5h2v8.5c0 1.5-1.5 3-3.5 3s-3.5-1.5-3.5-3 1.5-3 3.5-3c.5 0 1 .1 1.5.3z" transform="rotate(-10 12 16)" />
            {/* Two Flags */}
            <path d="M14 4.5c0 0 2 0 4 2.5s1 3 0 4" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M14 8.5c0 0 2 0 4 2.5s1 3 0 4" fill="none" stroke="currentColor" strokeWidth="2" />
        </SvgIcon>
    );
}

export function TripletIcon(props: SvgIconProps) {
    return (
        <SvgIcon {...props} viewBox="0 0 24 24">
            <text x="8" y="8" fontSize="10" fill="currentColor" fontWeight="bold">3</text>
            <path d="M12 13v-8.5h2v8.5c0 1.5-1.5 3-3.5 3s-3.5-1.5-3.5-3 1.5-3 3.5-3c.5 0 1 .1 1.5.3z" transform="rotate(-10 12 16) translate(0, 3)" />
        </SvgIcon>
    )
}
