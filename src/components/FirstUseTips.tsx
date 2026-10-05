import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Snackbar } from '@mui/material';
import { usePersistentState } from '../hooks/usePersistentState';
import { isString } from '../state/storage';

type TipId = 'play' | 'piano' | 'layout';

const TIPS: Record<TipId, string> = {
  play: 'Tip: la barra Espacio inicia y detiene el metrónomo.',
  piano: 'Tip: podés tocar el piano con el teclado de la computadora (A S D F…). Activá "Teclado PC" para usarlo desde cualquier lado.',
  layout: 'Tip: ¿mucho para ver? Ocultá o plegá paneles desde "Vista".',
};

const isSeenList = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString);

/** Mouse and keyboard devices only: on touch screens there is no Space bar and no hover. */
const hasKeyboardPointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const ALL_TIPS: TipId[] = ['play', 'piano', 'layout'];
const LONG_SCROLLS_FOR_LAYOUT_TIP = 3;
const SCROLL_IDLE_MS = 350;

/**
 * Three non-blocking tips, each shown once (and remembered): the Space bar after the first Play with the mouse,
 * the computer keyboard on the first hover over the piano, and the "Vista" menu after the third long scroll.
 * Plain MUI Snackbar: a tour library would weigh more than the three messages.
 *
 * (ES) Tres tips de primer uso, una sola vez cada uno.
 */
export const FirstUseTips: React.FC = () => {
  const [seen, setSeen] = usePersistentState<string[]>('tips.seen', [], isSeenList);
  const [current, setCurrent] = useState<TipId | null>(null);
  const seenRef = useRef(seen);
  const currentRef = useRef(current);
  useEffect(() => {
    seenRef.current = seen;
    currentRef.current = current;
  });

  const show = useCallback((tip: TipId) => {
    // One tip at a time, and never twice; a tip that had to wait is offered again at its next trigger.
    if (currentRef.current !== null || seenRef.current.includes(tip)) return;
    currentRef.current = tip;
    setCurrent(tip);
    setSeen(prev => (prev.includes(tip) ? prev : [...prev, tip]));
  }, [setSeen]);

  // People who have seen every tip (almost everyone, soon) pay for no listeners at all.
  const allSeen = ALL_TIPS.every(tip => seen.includes(tip));

  useEffect(() => {
    if (allSeen) return;
    const onClick = (e: MouseEvent) => {
      // detail 0 is a keyboard activation: whoever used Space already knows it.
      if (e.detail > 0 && hasKeyboardPointer() && (e.target as Element | null)?.closest?.('[data-testid="play-toggle"]')) show('play');
    };
    const onPointerOver = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && hasKeyboardPointer() && (e.target as Element | null)?.closest?.('[data-panel="piano"]')) show('piano');
    };
    // Where the page rested before the current movement (scroll events fire after the position changed).
    let restingY = window.scrollY;
    let longScrolls = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (Math.abs(window.scrollY - restingY) >= window.innerHeight * 0.8) {
          longScrolls += 1;
          if (longScrolls >= LONG_SCROLLS_FOR_LAYOUT_TIP) show('layout');
        }
        restingY = window.scrollY;
      }, SCROLL_IDLE_MS);
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('pointerover', onPointerOver, true);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('pointerover', onPointerOver, true);
      window.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    };
  }, [show, allSeen]);

  const close = (_?: unknown, reason?: string) => {
    if (reason === 'clickaway') return;
    setCurrent(null);
  };

  return (
    <Snackbar
      open={current !== null}
      onClose={close}
      autoHideDuration={12000}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      message={current ? TIPS[current] : ''}
      data-testid="first-use-tip"
      slotProps={{ content: { sx: { bgcolor: '#241d15', color: 'text.primary', border: '1px solid rgba(229, 169, 95, 0.4)', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' } } }}
      // Above the phone transport bar.
      sx={{ bottom: { xs: 'calc(var(--transport-reserve, 0px) + 8px) !important', sm: '24px' } }}
      action={<Button size="small" color="primary" onClick={() => close()} sx={{ minHeight: 44 }}>Entendido</Button>}
    />
  );
};
