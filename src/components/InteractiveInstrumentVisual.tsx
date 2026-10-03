import { Box, Typography } from '@mui/material';
import { useEffect, useRef, useCallback, useState } from 'react';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';
import { INSTRUMENT_IMAGES } from '../constants/instrumentAssets';
import { usePlaybackStore } from '../state/PlaybackContext';
import { isHighlighted, markHighlight } from './visuals/highlight';
import type { HighlightMap } from './visuals/highlight';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import {
    CLICK_BOOST,
    advanceAndPrune,
    fitFontSize,
    advanceParticle,
    advanceRipple,
    createParticle,
    createRipple,
    computeLayout,
    contentBox,
    fitImageToPad,
    hitTestInstrument,
    itemByKey,
    padKey,
    LABEL_FONT,
    SCALE_KEYS,
    initialScales,
    initialVelocities,
    reducedScale,
    springStep,
    stepBoost,
    stepTrigger,
    toCanvasCoords,
} from './visuals/instrumentLayout';
import type { ContentBox, InstrumentLayout, LayoutItem, Ripple, SparkParticle, ScaleKey } from './visuals/instrumentLayout';

interface InteractiveInstrumentVisualProps {
    pattern: RhythmPattern;
    isPlaying: boolean;
    onPreviewInstrument: (instrument: string, modifier?: string) => void;
}

/** Keyboard / screen-reader alternative to the clickable canvas. */
const PREVIEW_BUTTONS: { instrument: string; modifier?: string; label: string }[] = [
    { instrument: 'clave', label: 'Claves' },
    { instrument: 'caja', label: 'Caja coplera' },
    { instrument: 'bombo_leguero', label: 'Bombo legüero (parche)' },
    { instrument: 'rim', label: 'Bombo legüero (aro)' },
    { instrument: 'candombe_chico', label: 'Tambor chico' },
    { instrument: 'candombe_repique', label: 'Tambor repique' },
    { instrument: 'candombe_piano', label: 'Tambor piano' },
    { instrument: 'cajon', label: 'Cajón' },
    { instrument: 'palmas', label: 'Palmas' },
    { instrument: 'hihat', label: 'Hi-hat' },
    { instrument: 'snare', label: 'Redoblante' },
    { instrument: 'kick', label: 'Bombo de batería' },
    { instrument: 'shaker', label: 'Shaker' },
];

/** Content bounding box of an image (downsampled), so every photo can be fitted by what it shows. */
function measureContent(img: HTMLImageElement): ContentBox {
    const full = { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
    if (!img.naturalWidth || !img.naturalHeight) return full;
    try {
        const n = 64;
        const c = document.createElement('canvas');
        c.width = n;
        c.height = n;
        const cx = c.getContext('2d', { willReadFrequently: true });
        if (!cx) return full;
        cx.drawImage(img, 0, 0, n, n);
        const box = contentBox(cx.getImageData(0, 0, n, n).data, n, n);
        const kx = img.naturalWidth / n;
        const ky = img.naturalHeight / n;
        return { x: box.x * kx, y: box.y * ky, w: box.w * kx, h: box.h * ky };
    } catch {
        return full;
    }
}

/** Which preloaded photo (INSTRUMENT_IMAGES key) represents each instrument; the rest are drawn procedurally. */
const PHOTO_KEY: Partial<Record<ScaleKey, string>> = {
    clave: 'clave',
    caja: 'caja',
    bombo_parche: 'bombo',
    hihat: 'hihat',
    snare: 'snare',
    kick: 'kick',
    shaker: 'shaker',
};

const PAD_BG = '#0e0b08';

/** Candombe drums: [height, top width, bottom width] as multiples of the pad radius. */
const CANDOMBE_DRUMS: Partial<Record<ScaleKey, [number, number, number]>> = {
    candombe_chico: [1.05, 0.5, 0.42],
    candombe_repique: [1.3, 0.58, 0.48],
    candombe_piano: [1.55, 0.7, 0.56],
};

function drawDrum(ctx: CanvasRenderingContext2D, r: number, [h, wt, wb]: [number, number, number]) {
    const hh = (h * r) / 2;
    const top = (wt * r) / 2;
    const bot = (wb * r) / 2;
    const wood = ctx.createLinearGradient(-top, 0, top, 0);
    wood.addColorStop(0, '#3e2412');
    wood.addColorStop(0.45, '#9a6338');
    wood.addColorStop(1, '#3a2010');
    ctx.fillStyle = wood;
    ctx.beginPath();
    ctx.moveTo(-top, -hh);
    ctx.lineTo(-bot, hh);
    ctx.quadraticCurveTo(0, hh + r * 0.14, bot, hh);
    ctx.lineTo(top, -hh);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(239, 229, 217, 0.55)';
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
        const t = i / 4;
        ctx.moveTo(-top + 2 * top * t, -hh + r * 0.06);
        ctx.lineTo(-bot + 2 * bot * (t + 0.25), hh - r * 0.04);
    }
    ctx.stroke();
    ctx.fillStyle = '#efe5d9';
    ctx.beginPath();
    ctx.ellipse(0, -hh, top, r * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5d3a1e';
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.stroke();
}

function drawCajon(ctx: CanvasRenderingContext2D, r: number) {
    const w = r * 0.95;
    const h = r * 1.3;
    const wood = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    wood.addColorStop(0, '#a9774f');
    wood.addColorStop(0.5, '#c9946a');
    wood.addColorStop(1, '#85583a');
    ctx.fillStyle = wood;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, r * 0.06);
    ctx.fill();
    ctx.strokeStyle = '#4a2c18';
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.stroke();
    // tapa (top strip) and sound hole
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(-w / 2, -h / 2, w, r * 0.16);
    ctx.fillStyle = '#1a0e07';
    ctx.beginPath();
    ctx.arc(0, h * 0.12, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
}

function drawPalmas(ctx: CanvasRenderingContext2D, r: number, scale: number) {
    const angle = scale > 1.05 ? 0.08 : 0.3;
    const hand = (sign: number, color: string) => {
        ctx.save();
        ctx.rotate(sign * angle);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(sign * r * 0.3, 0, r * 0.3, r * 0.44, sign * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    };
    hand(-1, '#ffcc80');
    hand(1, '#ffe0b2');
}

/** Draws one instrument: pad backdrop, normalised photo (or procedural art) and play glow. */
function drawItem(
    ctx: CanvasRenderingContext2D,
    it: LayoutItem,
    scales: Record<string, number>,
    images: Record<string, HTMLImageElement>,
    boxes: Record<string, ContentBox>,
    now: number,
) {
    const scale = it.key === 'bombo_parche' ? Math.max(scales.bombo_parche, scales.bombo_aro) : scales[it.key];
    const glow = Math.min(1, Math.max(0, scale - 1) * 2.5);
    const r = it.r;

    ctx.save();
    ctx.translate(it.cx, it.cy);
    ctx.scale(scale, scale);

    // Pad backdrop
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = PAD_BG;
    if (glow > 0) {
        ctx.shadowColor = it.color;
        ctx.shadowBlur = 16 * glow;
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    // Content, clipped to the pad
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 0.5, 0, Math.PI * 2);
    ctx.clip();
    const inner = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    inner.addColorStop(0, '#2a1f15');
    inner.addColorStop(1, PAD_BG);
    ctx.fillStyle = inner;
    ctx.fillRect(-r, -r, 2 * r, 2 * r);

    const photoKey = PHOTO_KEY[it.key];
    const img = photoKey ? images[photoKey] : undefined;
    const drum = CANDOMBE_DRUMS[it.key];
    if (img && img.complete && img.naturalWidth) {
        const box = boxes[photoKey as string] ?? { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
        const fit = fitImageToPad(img.naturalWidth, img.naturalHeight, box, r, 0.84);
        let sx = 0;
        let sy = 0;
        if (it.key === 'shaker' && scale > 1.05) {
            sx = Math.sin(now * 0.07) * r * 0.1 * (scale - 1);
            sy = Math.cos(now * 0.05) * r * 0.06 * (scale - 1);
        }
        ctx.drawImage(img, fit.dx + sx, fit.dy + sy, fit.dw, fit.dh);
        // Vignette hides the photo edges so differing backgrounds blend into the pad
        const vig = ctx.createRadialGradient(0, 0, r * 0.62, 0, 0, r);
        vig.addColorStop(0, 'rgba(14, 11, 8, 0)');
        vig.addColorStop(1, PAD_BG);
        ctx.fillStyle = vig;
        ctx.fillRect(-r, -r, 2 * r, 2 * r);
    } else if (drum) {
        drawDrum(ctx, r, drum);
    } else if (it.key === 'cajon') {
        drawCajon(ctx, r);
    } else if (it.key === 'palmas') {
        drawPalmas(ctx, r, scale);
    }
    ctx.restore();

    // Rim ring (brightens while playing)
    ctx.beginPath();
    ctx.arc(0, 0, r - 0.5, 0, Math.PI * 2);
    ctx.lineWidth = 1.2 + glow * 1.2;
    ctx.strokeStyle = glow > 0 ? it.color : 'rgba(229, 169, 95, 0.28)';
    ctx.globalAlpha = glow > 0 ? 0.55 + 0.45 * glow : 1;
    ctx.stroke();

    // Bombo aro flash
    if (it.key === 'bombo_parche' && scales.bombo_aro > 1.03) {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffe082';
        ctx.lineWidth = 2;
        ctx.globalAlpha = Math.min(1, (scales.bombo_aro - 1) * 2.5);
        ctx.stroke();
    }
    ctx.restore();
}

/** useRef whose initial value is computed once (not on every render). */
function useLazyRef<T extends object>(init: () => T): React.MutableRefObject<T> {
    const ref = useRef<T | null>(null);
    if (ref.current === null) ref.current = init();
    return ref as React.MutableRefObject<T>;
}

export default function InteractiveInstrumentVisual({
    pattern,
    isPlaying,
    onPreviewInstrument
}: InteractiveInstrumentVisualProps) {
    const store = usePlaybackStore();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const layoutRef = useRef<InstrumentLayout>(computeLayout(380));
    const nameFontsRef = useRef<{ layout: InstrumentLayout | null; sizes: Map<string, number> }>({ layout: null, sizes: new Map() });
    const [canvasHeight, setCanvasHeight] = useState(() => computeLayout(380).height);
    const contentBoxesRef = useRef<Record<string, ContentBox>>({});
    const particlesRef = useRef<SparkParticle[]>([]);
    const lastStepRef = useRef<number>(-1);
    const imagesRef = useRef<Record<string, HTMLImageElement>>({});

    // Precargar imágenes reales de instrumentos
    useEffect(() => {
        Object.entries(INSTRUMENT_IMAGES).forEach(([key, src]) => {
            const img = new Image();
            img.onload = () => {
                // Skip when the synchronous cached-image path below already measured it.
                if (!contentBoxesRef.current[key]) contentBoxesRef.current[key] = measureContent(img);
            };
            img.src = src;
            // Cached images may already be decoded (onload can be skipped or delayed).
            if (img.complete && img.naturalWidth) contentBoxesRef.current[key] = measureContent(img);
            imagesRef.current[key] = img;
        });
    }, []);

    // Spring scaling values for organic bounce physics
    const scalesRef = useLazyRef(initialScales);
    const velocitiesRef = useLazyRef(initialVelocities);

    const ripplesRef = useRef<Ripple[]>([]);

    const reduceMotion = usePrefersReducedMotion();
    const reduceMotionRef = useRef(reduceMotion);
    useEffect(() => {
        reduceMotionRef.current = reduceMotion;
    }, [reduceMotion]);
    // Reduced motion: instruments are highlighted discretely (static enlarged state) instead of springing.
    const highlightUntilRef = useRef<HighlightMap>({});

    const bump = useCallback((key: string, amount: number) => {
        if (reduceMotionRef.current) {
            markHighlight(highlightUntilRef.current, key, performance.now());
        } else {
            velocitiesRef.current[key] += amount;
        }
    }, [velocitiesRef]);

    const spawnParticles = useCallback((x: number, y: number, color: string, count: number = 8) => {
        for (let i = 0; i < count; i++) {
            particlesRef.current.push(createParticle(x, y, color));
        }
    }, []);

    const triggerRipple = useCallback((x: number, y: number, color: string, maxRad: number = 30) => {
        if (reduceMotionRef.current) return;
        ripplesRef.current.push(createRipple(x, y, color, maxRad));
        spawnParticles(x, y, color, 8);
    }, [spawnParticles]);

    // Layout is computed from the real container width (CSS px); backing store = CSS size x dpr.
    const lastDprRef = useRef(0);
    const applySize = useCallback(() => {
        const canvas = canvasRef.current;
        const wrap = wrapRef.current;
        if (!canvas || !wrap) return;
        const width = wrap.clientWidth;
        if (!width) return;
        const dpr = window.devicePixelRatio || 1;
        const prev = layoutRef.current;
        if (prev.width === width && lastDprRef.current === dpr) return;
        lastDprRef.current = dpr;
        const layout = computeLayout(width, dpr);
        layoutRef.current = layout;
        canvas.width = Math.round(layout.width * dpr);
        canvas.height = Math.round(layout.height * dpr);
        setCanvasHeight(layout.height);
    }, []);

    useEffect(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const resizeObserver = new ResizeObserver(applySize);
        resizeObserver.observe(wrap);
        applySize();
        // Web fonts change text metrics: drop cached name sizes once they finish loading.
        const fonts = document.fonts;
        const invalidateNames = () => {
            nameFontsRef.current = { layout: null, sizes: new Map() };
        };
        fonts.addEventListener('loadingdone', invalidateNames);
        return () => {
            resizeObserver.disconnect();
            fonts.removeEventListener('loadingdone', invalidateNames);
        };
    }, [applySize]);

    // Dynamic scale trigger on sequencer ticks (subscribed to the store: no React re-render per step)
    const patternRef = useRef(pattern);
    useEffect(() => {
        patternRef.current = pattern;
    });

    const animateStep = useCallback((currentStepIndex: number) => {
        if (currentStepIndex === lastStepRef.current) return;
        lastStepRef.current = currentStepIndex;

        const activeSteps = patternRef.current.steps.filter(s => s.step === (currentStepIndex + 1));

        activeSteps.forEach(s => {
            const t = stepTrigger(s.instrument, s.modifier);
            if (!t) return;
            const it = itemByKey(layoutRef.current, padKey(t.key));
            if (!it) return;
            bump(t.key, stepBoost(s.velocity));
            triggerRipple(it.cx, it.cy - (t.rim ? it.r * 0.9 : 0), t.color, it.r * t.radiusFactor);
        });
    }, [triggerRipple, bump]);

    useEffect(() => {
        if (!isPlaying) {
            lastStepRef.current = -1;
            return;
        }
        animateStep(store.getSnapshot().step);
        return store.subscribe(() => animateStep(store.getSnapshot().step));
    }, [store, isPlaying, animateStep]);

    // Canvas render loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const render = () => {
            // ResizeObserver handles width changes; only a DPR change (zoom, other display) needs a re-measure.
            if ((window.devicePixelRatio || 1) !== lastDprRef.current) applySize();
            const layout = layoutRef.current;
            const dpr = window.devicePixelRatio || 1;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, layout.width, layout.height);

            // --- A. ELASTIC SPRING PHYSICS ---
            const frameNow = performance.now();
            for (const key of SCALE_KEYS) {
                if (reduceMotionRef.current) {
                    velocitiesRef.current[key] = 0;
                    scalesRef.current[key] = reducedScale(isHighlighted(highlightUntilRef.current, key, frameNow));
                    continue;
                }
                const next = springStep(scalesRef.current[key], velocitiesRef.current[key]);
                velocitiesRef.current[key] = next.velocity;
                scalesRef.current[key] = next.scale;
            }

            // --- B. SECTIONS (card + non-overlapping label) ---
            layout.sections.forEach(sec => {
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(sec.rect.x + 0.5, sec.rect.y + 0.5, sec.rect.w - 1, sec.rect.h - 1, 14);
                ctx.fillStyle = 'rgba(255, 232, 196, 0.03)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(229, 169, 95, 0.14)';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.fillStyle = '#e5a95f';
                ctx.globalAlpha = 0.85;
                ctx.font = `700 ${LABEL_FONT}px Outfit, sans-serif`;
                ctx.letterSpacing = '1.2px';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(sec.label, sec.rect.x + sec.rect.w / 2, sec.labelRect.y + sec.labelRect.h / 2, sec.rect.w - 12);
                ctx.restore();
            });

            // --- C. INSTRUMENT PADS ---
            layout.items.forEach(it => drawItem(ctx, it, scalesRef.current, imagesRef.current, contentBoxesRef.current, frameNow));

            // --- D. INSTRUMENT NAMES ---
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = 'rgba(240, 222, 196, 0.82)';
            // Name font sizes depend only on the layout (and loaded fonts): measure once, not every frame.
            if (nameFontsRef.current.layout !== layout) nameFontsRef.current = { layout, sizes: new Map() };
            const nameFonts = nameFontsRef.current.sizes;
            const baseFs = layout.mode === 'stack' ? 12 : 11;
            layout.items.forEach(it => {
                let fs = nameFonts.get(it.key);
                if (fs === undefined) {
                    fs = fitFontSize(size => {
                        ctx.font = `small-caps 600 ${size}px Outfit, sans-serif`;
                        return ctx.measureText(it.name).width;
                    }, baseFs, it.nameMaxW);
                    nameFonts.set(it.key, fs);
                }
                ctx.font = `small-caps 600 ${fs}px Outfit, sans-serif`;
                ctx.fillText(it.name, it.nameX, it.nameY);
            });
            ctx.restore();

            // --- E. RIPPLES ---
            advanceAndPrune(ripplesRef.current, advanceRipple).forEach(rp => {
                ctx.save();
                ctx.beginPath();
                ctx.arc(rp.x, rp.y, rp.radius, 0, Math.PI * 2);
                ctx.strokeStyle = rp.color;
                ctx.globalAlpha = rp.opacity * 0.7;
                ctx.lineWidth = 1.8;
                ctx.stroke();
                ctx.restore();
            });

            // --- F. SPARKS (PARTICLES) ---
            advanceAndPrune(particlesRef.current, advanceParticle).forEach(p => {
                ctx.save();
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.alpha;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 4;
                ctx.fill();
                ctx.restore();
            });

            animationFrameId = requestAnimationFrame(render);
        };

        animationFrameId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animationFrameId);
    }, [scalesRef, velocitiesRef, applySize]);

    const pointerToLayout = (e: { clientX: number; clientY: number }) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const layout = layoutRef.current;
        const p = toCanvasCoords(e.clientX, e.clientY, canvas.getBoundingClientRect(), layout);
        return { layout, ...p };
    };

    // Manual canvas click previews
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const pt = pointerToLayout(e);
        if (!pt) return;
        const found = hitTestInstrument(pt.layout, pt.x, pt.y);
        if (!found) return;
        bump(found.key, CLICK_BOOST);
        triggerRipple(pt.x, pt.y, found.color, found.rippleRadius);
        onPreviewInstrument(found.instrument);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const pt = pointerToLayout(e);
        if (!pt || !canvasRef.current) return;
        const nextCursor = hitTestInstrument(pt.layout, pt.x, pt.y) ? 'pointer' : 'default';
        if (canvasRef.current.style.cursor !== nextCursor) canvasRef.current.style.cursor = nextCursor;
    };

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            p: 1.5,
            pb: 2,
            bgcolor: 'rgba(0,0,0,0.3)',
            borderRadius: 4,
            border: '1px solid rgba(229, 169, 95, 0.08)',
            boxShadow: 'inset 0 0 25px rgba(0,0,0,0.6)'
        }}>
            <Typography
                variant="overline"
                sx={{
                    color: "text.secondary",
                    fontSize: { xs: '0.56rem', sm: '0.62rem' },
                    lineHeight: 1.5,
                    textAlign: 'center',
                    mb: 1,
                    letterSpacing: { xs: '0.1em', sm: '0.15em' },
                    fontWeight: 'bold'
                }}>
                INSTRUMENTOS RÍTMICOS TÁCTILES (TOCA PARA PROBAR)
            </Typography>

            <Box ref={wrapRef} sx={{ width: '100%', height: canvasHeight, position: 'relative' }}>
                <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    onPointerMove={handlePointerMove}
                    onPointerLeave={() => {
                        if (canvasRef.current) canvasRef.current.style.cursor = 'default';
                    }}
                    aria-hidden="true"
                    style={{
                        width: '100%',
                        height: canvasHeight,
                        display: 'block',
                        touchAction: 'manipulation'
                    }}
                />
            </Box>
            <Box component="ul" className="visually-hidden-focusable" aria-label="Probar instrumentos" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, listStyle: 'none', p: 0, m: 0, mt: 1 }}>
                {PREVIEW_BUTTONS.map(b => (
                    <li key={`${b.instrument}-${b.label}`}>
                        <button
                            type="button"
                            className="instrument-preview-button"
                            aria-label={`Tocar ${b.label.toLowerCase()}`}
                            onClick={() => onPreviewInstrument(b.instrument, b.modifier)}
                        >
                            {b.label}
                        </button>
                    </li>
                ))}
            </Box>
        </Box>
    );
}
