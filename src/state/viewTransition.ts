import { flushSync } from 'react-dom';

/**
 * Wraps DOM updates in the native View Transitions API when supported and motion is allowed.
 * Falls back immediately when unsupported, in tests, or under `prefers-reduced-motion: reduce`.
 */
export function runViewTransition(update: () => void): void {
  if (
    typeof document === 'undefined' ||
    typeof document.startViewTransition !== 'function' ||
    (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  ) {
    update();
    return;
  }
  try {
    document.startViewTransition(() => {
      flushSync(update);
    });
  } catch {
    update();
  }
}
