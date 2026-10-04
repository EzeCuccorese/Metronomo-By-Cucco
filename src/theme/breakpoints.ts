/**
 * Single source of truth for responsive breakpoints.
 *
 *   xs   0 – 599   phone (portrait)
 *   sm 600 – 899   large phone / small tablet (portrait)
 *   md 900 – 1199  tablet landscape, small laptop
 *   lg 1200+       desktop
 *
 * MUI `sx` uses these through `theme.breakpoints` (see darkTheme.ts). Plain CSS cannot read
 * TypeScript, so the same numbers are repeated in `src/adaptive.css` and `piano.css`:
 * keep them in sync (a unit test checks the values below).
 *
 * Phone landscape is not a width breakpoint: a phone on its side is wide but only ~400 px tall, so it
 * is detected by height (see LANDSCAPE_COMPACT_QUERY) and gets a compact practice layout.
 */
export const BREAKPOINT_VALUES = { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 } as const;

/** Phone on its side (844×390, 932×430) or any very short landscape window. */
export const LANDSCAPE_COMPACT_QUERY = '(orientation: landscape) and (max-height: 500px)';

/** Touch screens: fingers need bigger targets than a mouse. */
export const COARSE_POINTER_QUERY = '(pointer: coarse)';

/** Minimum touch target (px), Apple HIG; WCAG 2.5.8 only asks for 24. */
export const TOUCH_TARGET = 44;
