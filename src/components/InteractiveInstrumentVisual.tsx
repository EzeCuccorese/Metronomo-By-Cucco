import { Box, Typography } from '@mui/material';
import { useEffect, useRef, useCallback } from 'react';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';
import { INSTRUMENT_IMAGES } from '../constants/instrumentAssets';
import { usePlaybackStore } from '../state/PlaybackContext';
import { isHighlighted, markHighlight } from './visuals/highlight';
import type { HighlightMap } from './visuals/highlight';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import {
    CLICK_BOOST,
    advanceAndPrune,
    advanceParticle,
    advanceRipple,
    createParticle,
    createRipple,
    hitTestInstrument,
    initialScales,
    initialVelocities,
    reducedScale,
    springStep,
    stepBoost,
    stepTrigger,
    toCanvasCoords,
} from './visuals/instrumentLayout';
import type { Ripple, SparkParticle } from './visuals/instrumentLayout';

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

/** useRef whose initial value is computed once (not on every render). */
function useLazyRef<T>(init: () => T): { current: T } {
    const ref = useRef<T | null>(null);
    if (ref.current === null) ref.current = init();
    return ref as { current: T };
}

export default function InteractiveInstrumentVisual({
    pattern,
    isPlaying,
    onPreviewInstrument
}: InteractiveInstrumentVisualProps) {
    const store = usePlaybackStore();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const canvasSizeRef = useRef<{ width: number; height: number }>({ width: 380, height: 175 });
    const particlesRef = useRef<SparkParticle[]>([]);
    const lastStepRef = useRef<number>(-1);
    const imagesRef = useRef<Record<string, HTMLImageElement>>({});

    // Precargar imágenes reales de instrumentos
    useEffect(() => {
        Object.entries(INSTRUMENT_IMAGES).forEach(([key, src]) => {
            const img = new Image();
            img.src = src;
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

    // Handle high-DPI (Retina) responsive canvas sizing
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleResize = () => {
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvasSizeRef.current = { width: rect.width, height: rect.height };
        };

        const resizeObserver = new ResizeObserver(() => {
            handleResize();
        });
        resizeObserver.observe(canvas.parentElement || canvas);

        handleResize();
        return () => resizeObserver.disconnect();
    }, []);

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
            bump(t.key, stepBoost(s.velocity));
            triggerRipple(t.x, t.y, t.color, t.maxRadius);
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
            if (!ctx || !canvas) return;

            const dpr = window.devicePixelRatio || 1;
            const w = canvas.width / dpr;
            const h = canvas.height / dpr;

            ctx.save();
            ctx.scale(dpr, dpr);

            // Scale target 380x175 coordinates dynamically to the actual container dimensions
            const scaleX = w / 380;
            const scaleY = h / 175;
            ctx.scale(scaleX, scaleY);

            ctx.clearRect(0, 0, 380, 175);

            // --- A. ELASTIC SPRING PHYSICS ---

            const frameNow = performance.now();
            Object.keys(scalesRef.current).forEach(key => {
                if (reduceMotionRef.current) {
                    velocitiesRef.current[key] = 0;
                    scalesRef.current[key] = reducedScale(isHighlighted(highlightUntilRef.current, key, frameNow));
                    return;
                }
                const next = springStep(scalesRef.current[key], velocitiesRef.current[key]);
                velocitiesRef.current[key] = next.velocity;
                scalesRef.current[key] = next.scale;
            });

            // --- B. RENDERING RIPPLES ---
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

            // --- B2. RENDERING SPARKS (PARTICLES) ---
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

            // --- C. PANEL SEPARATORS & TEXT LABELS ---
            ctx.save();
            ctx.strokeStyle = 'rgba(229, 169, 95, 0.08)';
            ctx.lineWidth = 1.2;
            
            // Vertical separators
            ctx.beginPath();
            ctx.moveTo(135, 10);
            ctx.lineTo(135, 165);
            ctx.moveTo(260, 10);
            ctx.lineTo(260, 165);
            ctx.stroke();

            // Section labels
            ctx.fillStyle = '#e5a95f';
            ctx.globalAlpha = 0.55;
            ctx.font = 'bold 8px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('FOLKLORE NORTEÑO', 67, 15);
            ctx.fillText('RITMOS RIOPLATENSES Y LITORAL', 197, 15);
            ctx.fillText('SECCIÓN RÍTMICA MODERNA', 320, 15);
            ctx.restore();

            // --- D. FOLKLORE NORTEÑO PANEL ---
            // 1. CLAVES (x: 45, y: 40)
            const imgClave = imagesRef.current.clave;
            if (imgClave && imgClave.complete) {
                ctx.save();
                const clScale = scalesRef.current.clave;
                ctx.translate(45, 40);
                ctx.scale(clScale * 0.75, clScale * 0.75);
                ctx.globalCompositeOperation = 'screen';
                ctx.drawImage(imgClave, -20, -20, 40, 40);
                ctx.restore();
            } else {
                ctx.save();
                const clScale = scalesRef.current.clave;
                ctx.translate(45, 40);
                ctx.scale(clScale, clScale);
                ctx.rotate(-Math.PI / 8);
                
                // Draw crossed mahogany sticks
                ctx.fillStyle = '#5d4037';
                ctx.beginPath();
                ctx.roundRect(-15, -2.5, 30, 5, 2);
                ctx.fill();
                
                ctx.rotate(Math.PI / 4);
                ctx.fillStyle = '#8d6e63';
                ctx.beginPath();
                ctx.roundRect(-15, -2.5, 30, 5, 2);
                ctx.fill();
                ctx.restore();
            }

            // 2. CAJA COPLERA (x: 105, y: 40)
            const imgCaja = imagesRef.current.caja;
            if (imgCaja && imgCaja.complete) {
                ctx.save();
                const cjScale = scalesRef.current.caja;
                ctx.translate(105, 40);
                ctx.scale(cjScale * 0.75, cjScale * 0.75);
                ctx.globalCompositeOperation = 'screen';
                ctx.drawImage(imgCaja, -20, -20, 40, 40);
                ctx.restore();
            } else {
                ctx.save();
                const cjScale = scalesRef.current.caja;
                ctx.translate(105, 40);
                ctx.scale(cjScale, cjScale);
                
                // Wooden frame rim
                ctx.beginPath();
                ctx.arc(0, 0, 16, 0, Math.PI * 2);
                ctx.fillStyle = '#6d4c41';
                ctx.fill();
                ctx.strokeStyle = '#3e2723';
                ctx.lineWidth = 1.8;
                ctx.stroke();
                
                // Sheepskin head
                ctx.beginPath();
                ctx.arc(0, 0, 14, 0, Math.PI * 2);
                ctx.fillStyle = '#f5f1e6';
                ctx.fill();
                
                // Buzzing string (chirlera)
                ctx.strokeStyle = '#8d6e63';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-14, -3);
                ctx.lineTo(14, 3);
                ctx.stroke();
                ctx.restore();
            }

            // 3. BOMBO LEGÜERO (x: 75, y: 115)
            const bomboX = 75;
            const bomboY = 115;
            const bWidth = 44;
            const bHeight = 52;
            const imgBombo = imagesRef.current.bombo;
            if (imgBombo && imgBombo.complete) {
                ctx.save();
                const bpScale = scalesRef.current.bombo_parche;
                const baScale = scalesRef.current.bombo_aro;
                const currentScale = Math.max(bpScale, baScale);
                ctx.translate(bomboX, bomboY);
                ctx.scale(currentScale * 0.85, currentScale * 0.85);
                ctx.globalCompositeOperation = 'screen';
                ctx.drawImage(imgBombo, -25, -28, 50, 56);
                ctx.restore();
            } else {
                ctx.save();
                ctx.translate(bomboX, bomboY);
                
                const bpScale = scalesRef.current.bombo_parche;
                const baScale = scalesRef.current.bombo_aro;
                ctx.scale(bpScale, bpScale);

                // Wood hollow barrel
                const woodGrad = ctx.createLinearGradient(-bWidth/2, -bHeight/2, bWidth/2, -bHeight/2);
                woodGrad.addColorStop(0, '#3e2723');
                woodGrad.addColorStop(0.5, '#795548');
                woodGrad.addColorStop(1, '#2d1510');
                ctx.fillStyle = woodGrad;
                ctx.beginPath();
                ctx.moveTo(-bWidth/2, -bHeight/2);
                ctx.lineTo(-bWidth/2, bHeight/2 - 4);
                ctx.quadraticCurveTo(0, bHeight/2 + 4, bWidth/2, bHeight/2 - 4);
                ctx.lineTo(bWidth/2, -bHeight/2);
                ctx.closePath();
                ctx.fill();

                // Ropes
                ctx.strokeStyle = '#efe5d9';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(-bWidth/2 + 4, -bHeight/2 + 2);
                ctx.lineTo(-bWidth/3, bHeight/2 - 2);
                ctx.lineTo(-bWidth/8, -bHeight/2 + 2);
                ctx.lineTo(0, bHeight/2 - 2);
                ctx.lineTo(bWidth/8, -bHeight/2 + 2);
                ctx.lineTo(bWidth/3, bHeight/2 - 2);
                ctx.lineTo(bWidth/2 - 4, -bHeight/2 + 2);
                ctx.stroke();
                ctx.restore();

                // Bombo Rim & Leather Ellipse Top
                ctx.save();
                ctx.translate(bomboX, bomboY - bHeight/2);
                ctx.scale(baScale, baScale);
                
                // Rim ring
                ctx.beginPath();
                ctx.ellipse(0, 0, bWidth/2, 9, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#4e342e';
                ctx.fill();
                ctx.strokeStyle = '#27120f';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Patch skin
                ctx.beginPath();
                ctx.ellipse(0, 0, bWidth/2 - 3, 7, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#f8f4e8';
                ctx.fill();
                ctx.restore();
            }

            // --- E. RIOPLATENSE & LITORAL PANEL ---
            // 1. CANDOMBE ENSEMBLE (x: 195, y: 45)
            ctx.save();
            ctx.translate(195, 45);
            
            // Chico Drum (x: -16)
            const imgChico = imagesRef.current.candombe_chico;
            if (imgChico && imgChico.complete) {
                ctx.save();
                ctx.translate(-16, 0);
                const ccScale = scalesRef.current.candombe_chico;
                ctx.scale(ccScale * 0.45, ccScale * 0.45);
                ctx.globalCompositeOperation = 'screen';
                ctx.drawImage(imgChico, -15, -15, 30, 30);
                ctx.restore();
            } else {
                ctx.save();
                ctx.translate(-16, 0);
                const ccScale = scalesRef.current.candombe_chico;
                ctx.scale(ccScale, ccScale);
                ctx.fillStyle = '#795548';
                ctx.beginPath();
                ctx.moveTo(-4, -10);
                ctx.lineTo(-3, 10);
                ctx.quadraticCurveTo(0, 11, 3, 10);
                ctx.lineTo(4, -10);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#efe5d9';
                ctx.beginPath();
                ctx.ellipse(0, -10, 4, 1.8, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.restore();
            }

            // Repique Drum (x: 0)
            const imgRepique = imagesRef.current.candombe_repique;
            if (imgRepique && imgRepique.complete) {
                ctx.save();
                const crScale = scalesRef.current.candombe_repique;
                ctx.scale(crScale * 0.5, crScale * 0.5);
                ctx.globalCompositeOperation = 'screen';
                ctx.drawImage(imgRepique, -15, -15, 30, 30);
                ctx.restore();
            } else {
                ctx.save();
                const crScale = scalesRef.current.candombe_repique;
                ctx.scale(crScale, crScale);
                ctx.fillStyle = '#6d4c41';
                ctx.beginPath();
                ctx.moveTo(-5, -11);
                ctx.lineTo(-4, 11);
                ctx.quadraticCurveTo(0, 12, 4, 11);
                ctx.lineTo(5, -11);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#efe5d9';
                ctx.beginPath();
                ctx.ellipse(0, -11, 5, 2, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.restore();
            }

            // Piano Drum (x: 16)
            const imgPiano = imagesRef.current.candombe_piano;
            if (imgPiano && imgPiano.complete) {
                ctx.save();
                ctx.translate(16, 0);
                const cpScale = scalesRef.current.candombe_piano;
                ctx.scale(cpScale * 0.55, cpScale * 0.55);
                ctx.globalCompositeOperation = 'screen';
                ctx.drawImage(imgPiano, -15, -15, 30, 30);
                ctx.restore();
            } else {
                ctx.save();
                ctx.translate(16, 0);
                const cpScale = scalesRef.current.candombe_piano;
                ctx.scale(cpScale, cpScale);
                ctx.fillStyle = '#4e342e';
                ctx.beginPath();
                ctx.moveTo(-7, -12);
                ctx.lineTo(-5, 12);
                ctx.quadraticCurveTo(0, 13, 5, 12);
                ctx.lineTo(7, -12);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#efe5d9';
                ctx.beginPath();
                ctx.ellipse(0, -12, 7, 2.2, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.restore();
            }
            ctx.restore();

            // 2. CAJÓN PERUANO (x: 180, y: 115)
            const imgCajon = imagesRef.current.cajon;
            if (imgCajon && imgCajon.complete) {
                ctx.save();
                const cjnScale = scalesRef.current.cajon;
                ctx.translate(180, 115);
                ctx.scale(cjnScale * 0.7, cjnScale * 0.7);
                ctx.globalCompositeOperation = 'screen';
                ctx.drawImage(imgCajon, -16, -20, 32, 40);
                ctx.restore();
            } else {
                ctx.save();
                const cjnScale = scalesRef.current.cajon;
                ctx.translate(180, 115);
                ctx.scale(cjnScale, cjnScale);
                
                // Wooden box body
                ctx.fillStyle = '#8d6e63';
                ctx.beginPath();
                ctx.roundRect(-11, -19, 22, 38, 2);
                ctx.fill();
                ctx.strokeStyle = '#5d4037';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                
                // Small screws indicators
                ctx.fillStyle = 'rgba(0,0,0,0.35)';
                ctx.fillRect(-9, -17, 1.2, 1.2);
                ctx.fillRect(8, -17, 1.2, 1.2);
                ctx.fillRect(-9, 15, 1.2, 1.2);
                ctx.fillRect(8, 15, 1.2, 1.2);
                ctx.restore();
            }

            // 3. PALMAS (x: 235, y: 115)
            ctx.save();
            const plScale = scalesRef.current.palmas;
            ctx.translate(235, 115);
            ctx.scale(plScale, plScale);
            const isClapping = plScale > 1.05;
            const palmAngle = isClapping ? 0.08 : 0.25;

            // Left Hand
            ctx.save();
            ctx.rotate(-palmAngle);
            ctx.fillStyle = '#ffcc80';
            ctx.beginPath();
            ctx.ellipse(-5, 0, 6, 8, -0.15, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Right Hand
            ctx.save();
            ctx.rotate(palmAngle);
            ctx.fillStyle = '#ffe0b2';
            ctx.beginPath();
            ctx.ellipse(5, 0, 6, 8, 0.15, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.restore();

            // --- F. MODERN RHYTHM PANEL ---
            // 1. HI-HAT (x: 290, y: 40)
            const imgHihat = imagesRef.current.hihat;
            if (imgHihat && imgHihat.complete) {
                ctx.save();
                const hhScale = scalesRef.current.hihat;
                ctx.translate(290, 40);
                ctx.scale(hhScale * 0.75, hhScale * 0.75);
                ctx.globalCompositeOperation = 'screen';
                ctx.drawImage(imgHihat, -20, -20, 40, 40);
                ctx.restore();
            } else {
                ctx.save();
                const hhScale = scalesRef.current.hihat;
                ctx.translate(290, 40);
                ctx.scale(hhScale, hhScale);
                
                // Gold bronze cymbal
                const hhGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, 14);
                hhGrad.addColorStop(0, '#ffd54f');
                hhGrad.addColorStop(0.7, '#e5a95f');
                hhGrad.addColorStop(1, '#8c602d');
                ctx.fillStyle = hhGrad;
                ctx.beginPath();
                ctx.arc(0, 0, 14, 0, Math.PI*2);
                ctx.fill();
                
                // Center bell
                ctx.fillStyle = '#ffca28';
                ctx.beginPath();
                ctx.arc(0, 0, 3, 0, Math.PI*2);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }

            // 2. SNARE (x: 345, y: 40)
            const imgSnare = imagesRef.current.snare;
            if (imgSnare && imgSnare.complete) {
                ctx.save();
                const snScale = scalesRef.current.snare;
                ctx.translate(345, 40);
                ctx.scale(snScale * 0.75, snScale * 0.75);
                ctx.globalCompositeOperation = 'screen';
                ctx.drawImage(imgSnare, -20, -20, 40, 40);
                ctx.restore();
            } else {
                ctx.save();
                const snScale = scalesRef.current.snare;
                ctx.translate(345, 40);
                ctx.scale(snScale, snScale);
                
                // Silver chrome body
                const snGrad = ctx.createLinearGradient(-15, 0, 15, 0);
                snGrad.addColorStop(0, '#90a4ae');
                snGrad.addColorStop(0.5, '#eceff1');
                snGrad.addColorStop(1, '#455a64');
                ctx.fillStyle = snGrad;
                ctx.beginPath();
                ctx.arc(0, 0, 15, 0, Math.PI*2);
                ctx.fill();
                ctx.strokeStyle = '#37474f';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                
                // White head
                ctx.fillStyle = '#fcfdfe';
                ctx.beginPath();
                ctx.arc(0, 0, 13, 0, Math.PI*2);
                ctx.fill();
                ctx.restore();
            }

            // 3. BASS KICK (x: 300, y: 115)
            const imgKick = imagesRef.current.kick;
            if (imgKick && imgKick.complete) {
                ctx.save();
                const kScale = scalesRef.current.kick;
                ctx.translate(300, 115);
                ctx.scale(kScale * 0.85, kScale * 0.85);
                ctx.globalCompositeOperation = 'screen';
                ctx.drawImage(imgKick, -25, -25, 50, 50);
                ctx.restore();
            } else {
                ctx.save();
                const kScale = scalesRef.current.kick;
                ctx.translate(300, 115);
                ctx.scale(kScale, kScale);
                
                // Copper outer ring
                ctx.fillStyle = '#d84315';
                ctx.beginPath();
                ctx.arc(0, 0, 24, 0, Math.PI*2);
                ctx.fill();
                ctx.strokeStyle = '#ffe082';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                // Dark head
                ctx.fillStyle = '#212121';
                ctx.beginPath();
                ctx.arc(0, 0, 20, 0, Math.PI*2);
                ctx.fill();
                
                // Hole
                ctx.fillStyle = '#050505';
                ctx.beginPath();
                ctx.arc(7, 5, 5, 0, Math.PI*2);
                ctx.fill();
                ctx.restore();
            }

            // 4. SHAKER (x: 345, y: 115)
            const imgShaker = imagesRef.current.shaker;
            if (imgShaker && imgShaker.complete) {
                ctx.save();
                const shScale = scalesRef.current.shaker;
                let shMoveX = 0;
                let shMoveY = 0;
                if (shScale > 1.05) {
                    shMoveX = Math.sin(performance.now() * 0.07) * 5 * (shScale - 1.0);
                    shMoveY = Math.cos(performance.now() * 0.05) * 3 * (shScale - 1.0);
                }
                ctx.translate(345 + shMoveX, 115 + shMoveY);
                ctx.scale(shScale * 0.7, shScale * 0.7);
                ctx.rotate(Math.PI / 10);
                ctx.globalCompositeOperation = 'screen';
                ctx.drawImage(imgShaker, -20, -20, 40, 40);
                ctx.restore();
            } else {
                ctx.save();
                const shScale = scalesRef.current.shaker;
                let shMoveX = 0;
                let shMoveY = 0;
                if (shScale > 1.05) {
                    shMoveX = Math.sin(performance.now() * 0.07) * 5 * (shScale - 1.0);
                    shMoveY = Math.cos(performance.now() * 0.05) * 3 * (shScale - 1.0);
                }
                ctx.translate(345 + shMoveX, 115 + shMoveY);
                ctx.scale(shScale, shScale);
                ctx.rotate(Math.PI / 10);
                
                // Brushed steel cylinder
                const shGrad = ctx.createLinearGradient(-7, 0, 7, 0);
                shGrad.addColorStop(0, '#78909c');
                shGrad.addColorStop(0.5, '#ffffff');
                shGrad.addColorStop(1, '#37474f');
                ctx.fillStyle = shGrad;
                ctx.beginPath();
                ctx.roundRect(-7, -15, 14, 30, 2);
                ctx.fill();
                ctx.strokeStyle = '#455a64';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.restore();
            }

            ctx.restore();

            animationFrameId = requestAnimationFrame(render);
        };

        animationFrameId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animationFrameId);
    }, [scalesRef, velocitiesRef]);

    // Manual canvas click previews
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const { x: clickX, y: clickY } = toCanvasCoords(e.clientX, e.clientY, canvas.getBoundingClientRect());
        const found = hitTestInstrument(clickX, clickY);
        if (!found) return;
        bump(found.key, CLICK_BOOST);
        triggerRipple(clickX, clickY, found.color, found.rippleRadius);
        onPreviewInstrument(found.instrument);
    };

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            p: 1.5,
            bgcolor: 'rgba(0,0,0,0.3)',
            borderRadius: 4,
            border: '1px solid rgba(229, 169, 95, 0.08)',
            boxShadow: 'inset 0 0 25px rgba(0,0,0,0.6)'
        }}>
            <Typography
                variant="overline"
                sx={{
                    color: "text.secondary",
                    fontSize: '0.62rem',
                    mb: 1,
                    letterSpacing: '0.15em',
                    fontWeight: 'bold'
                }}>
                INSTRUMENTOS RÍTMICOS TÁCTILES (HAZ CLIC PARA PROBAR)
            </Typography>

            <Box sx={{
                width: '100%',
                height: 175,
                position: 'relative',
                overflow: 'hidden'
            }}>
                <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    aria-hidden="true"
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'block'
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
