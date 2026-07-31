import { Box, Typography } from '@mui/material';
import { useEffect, useRef, useCallback } from 'react';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';
import { INSTRUMENT_IMAGES } from '../constants/instrumentAssets';

interface InteractiveInstrumentVisualProps {
    pattern: RhythmPattern;
    currentStepIndex?: number;
    onPreviewInstrument: (instrument: string) => void;
}

interface Ripple {
    x: number;
    y: number;
    color: string;
    radius: number;
    maxRadius: number;
    opacity: number;
    speed: number;
}

interface SparkParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    alpha: number;
    decay: number;
}

export default function InteractiveInstrumentVisual({
    pattern,
    currentStepIndex = -1,
    onPreviewInstrument
}: InteractiveInstrumentVisualProps) {
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
    const scalesRef = useRef<Record<string, number>>({
        bombo_parche: 1.0,
        bombo_aro: 1.0,
        snare: 1.0,
        kick: 1.0,
        hihat: 1.0,
        clave: 1.0,
        shaker: 1.0,
        caja: 1.0,
        cajon: 1.0,
        palmas: 1.0,
        candombe_chico: 1.0,
        candombe_repique: 1.0,
        candombe_piano: 1.0
    });

    const velocitiesRef = useRef<Record<string, number>>({
        bombo_parche: 0,
        bombo_aro: 0,
        snare: 0,
        kick: 0,
        hihat: 0,
        clave: 0,
        shaker: 0,
        caja: 0,
        cajon: 0,
        palmas: 0,
        candombe_chico: 0,
        candombe_repique: 0,
        candombe_piano: 0
    });

    const ripplesRef = useRef<Ripple[]>([]);

    const spawnParticles = useCallback((x: number, y: number, color: string, count: number = 8) => {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.8 + Math.random() * 2.8;
            particlesRef.current.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color,
                size: 1.2 + Math.random() * 2.2,
                alpha: 1.0,
                decay: 0.025 + Math.random() * 0.035
            });
        }
    }, []);

    const triggerRipple = useCallback((x: number, y: number, color: string, maxRad: number = 30) => {
        ripplesRef.current.push({
            x,
            y,
            color,
            radius: 4,
            maxRadius: maxRad,
            opacity: 1.0,
            speed: 1.6
        });
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

    // Dynamic scale trigger on sequencer ticks
    useEffect(() => {
        if (currentStepIndex === lastStepRef.current) return;
        lastStepRef.current = currentStepIndex;

        const activeSteps = pattern.steps.filter(s => s.step === (currentStepIndex + 1));
        
        activeSteps.forEach(s => {
            const inst = s.instrument;
            const velocity = s.velocity || 1.0;
            const boost = 0.35 * velocity;

            if (inst === 'bombo_leguero') {
                if (s.modifier === 'aro') {
                    velocitiesRef.current.bombo_aro += boost;
                    triggerRipple(75, 85, '#ffe082', 38);
                } else {
                    velocitiesRef.current.bombo_parche += boost;
                    triggerRipple(75, 115, '#dfa15b', 45);
                }
            } else if (inst === 'rim') {
                velocitiesRef.current.bombo_aro += boost;
                triggerRipple(75, 85, '#ffe082', 38);
            } else if (inst === 'caja') {
                velocitiesRef.current.caja += boost;
                triggerRipple(105, 40, '#ffe082', 35);
            } else if (inst === 'cajon') {
                velocitiesRef.current.cajon += boost;
                triggerRipple(180, 115, '#dfa15b', 40);
            } else if (inst === 'palmas') {
                velocitiesRef.current.palmas += boost;
                triggerRipple(235, 115, '#ffcc80', 30);
            } else if (inst === 'candombe_chico') {
                velocitiesRef.current.candombe_chico += boost;
                triggerRipple(180, 45, '#80cbc4', 25);
            } else if (inst === 'candombe_repique') {
                velocitiesRef.current.candombe_repique += boost;
                triggerRipple(195, 45, '#80cbc4', 25);
            } else if (inst === 'candombe_piano') {
                velocitiesRef.current.candombe_piano += boost;
                triggerRipple(210, 45, '#80cbc4', 28);
            } else if (inst === 'kick' || inst === 'surdo') {
                velocitiesRef.current.kick += boost;
                triggerRipple(300, 115, '#ff7043', 40);
            } else if (inst === 'snare') {
                velocitiesRef.current.snare += boost;
                triggerRipple(345, 40, '#b0bec5', 35);
            } else if (inst === 'hihat' || inst === 'hihat_foot' || inst === 'ride') {
                velocitiesRef.current.hihat += boost;
                triggerRipple(290, 40, '#ffd54f', 32);
            } else if (inst === 'clave') {
                velocitiesRef.current.clave += boost;
                triggerRipple(45, 40, '#ffb300', 30);
            } else if (inst === 'shaker') {
                velocitiesRef.current.shaker += boost;
                triggerRipple(345, 115, '#cfd8dc', 25);
            }
        });
    }, [currentStepIndex, pattern, triggerRipple]);

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
            const stiffness = 0.20;
            const damping = 0.78;

            Object.keys(scalesRef.current).forEach(key => {
                const force = (1.0 - scalesRef.current[key]) * stiffness;
                velocitiesRef.current[key] += force;
                velocitiesRef.current[key] *= damping;
                scalesRef.current[key] += velocitiesRef.current[key];
            });

            // --- B. RENDERING RIPPLES ---
            ripplesRef.current.forEach((rp, idx) => {
                rp.radius += rp.speed;
                rp.opacity = 1.0 - (rp.radius / rp.maxRadius);

                if (rp.opacity <= 0) {
                    ripplesRef.current.splice(idx, 1);
                    return;
                }

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
            particlesRef.current.forEach((p, idx) => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.045; // Gravity
                p.alpha -= p.decay;

                if (p.alpha <= 0) {
                    particlesRef.current.splice(idx, 1);
                    return;
                }

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
    }, []);

    // Manual canvas click previews
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = 380 / rect.width;
        const scaleY = 175 / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        // --- COLLISION MATRIX ---
        // 1. Claves (x: 45, y: 40)
        if (Math.hypot(clickX - 45, clickY - 40) <= 18) {
            velocitiesRef.current.clave += 0.4;
            triggerRipple(clickX, clickY, '#ffb300', 30);
            onPreviewInstrument('clave');
            return;
        }

        // 2. Caja Coplera (x: 105, y: 40)
        if (Math.hypot(clickX - 105, clickY - 40) <= 18) {
            velocitiesRef.current.caja += 0.4;
            triggerRipple(clickX, clickY, '#ffe082', 30);
            onPreviewInstrument('caja');
            return;
        }

        // 3. Bombo Legüero (x: 75, y: 115)
        const bomboX = 75;
        const bomboYTop = 115 - 52/2; // 89
        const rx = 22;
        const ry = 9;
        
        // Ellipse head click
        const bomboHeadClick = Math.pow(clickX - bomboX, 2) / Math.pow(rx, 2) + Math.pow(clickY - bomboYTop, 2) / Math.pow(ry, 2);
        if (bomboHeadClick <= 1.0) {
            const bomboParcheClick = Math.pow(clickX - bomboX, 2) / Math.pow(rx - 3, 2) + Math.pow(clickY - bomboYTop, 2) / Math.pow(ry - 2, 2);
            if (bomboParcheClick <= 1.0) {
                velocitiesRef.current.bombo_parche += 0.4;
                triggerRipple(clickX, clickY, '#dfa15b', 42);
                onPreviewInstrument('bombo_leguero');
            } else {
                velocitiesRef.current.bombo_aro += 0.4;
                triggerRipple(clickX, clickY, '#ffe082', 36);
                onPreviewInstrument('rim');
            }
            return;
        }
        
        // Body click
        if (Math.abs(clickX - bomboX) < rx && clickY > bomboYTop && clickY < bomboYTop + 52) {
            velocitiesRef.current.bombo_parche += 0.4;
            triggerRipple(clickX, clickY, '#dfa15b', 42);
            onPreviewInstrument('bombo_leguero');
            return;
        }

        // 4. Candombe Chico (x: 179, y: 45)
        if (Math.hypot(clickX - 179, clickY - 45) <= 10) {
            velocitiesRef.current.candombe_chico += 0.4;
            triggerRipple(clickX, clickY, '#80cbc4', 24);
            onPreviewInstrument('candombe_chico');
            return;
        }

        // 5. Candombe Repique (x: 195, y: 45)
        if (Math.hypot(clickX - 195, clickY - 45) <= 10) {
            velocitiesRef.current.candombe_repique += 0.4;
            triggerRipple(clickX, clickY, '#80cbc4', 24);
            onPreviewInstrument('candombe_repique');
            return;
        }

        // 6. Candombe Piano (x: 211, y: 45)
        if (Math.hypot(clickX - 211, clickY - 45) <= 12) {
            velocitiesRef.current.candombe_piano += 0.4;
            triggerRipple(clickX, clickY, '#80cbc4', 26);
            onPreviewInstrument('candombe_piano');
            return;
        }

        // 7. Cajón Peruano (x: 180, y: 115)
        if (Math.abs(clickX - 180) < 11 && Math.abs(clickY - 115) < 19) {
            velocitiesRef.current.cajon += 0.4;
            triggerRipple(clickX, clickY, '#dfa15b', 35);
            onPreviewInstrument('cajon');
            return;
        }

        // 8. Palmas (x: 235, y: 115)
        if (Math.hypot(clickX - 235, clickY - 115) <= 15) {
            velocitiesRef.current.palmas += 0.4;
            triggerRipple(clickX, clickY, '#ffcc80', 25);
            onPreviewInstrument('palmas');
            return;
        }

        // 9. Hihat (x: 290, y: 40)
        if (Math.hypot(clickX - 290, clickY - 40) <= 14) {
            velocitiesRef.current.hihat += 0.4;
            triggerRipple(clickX, clickY, '#ffd54f', 30);
            onPreviewInstrument('hihat');
            return;
        }

        // 10. Snare (x: 345, y: 40)
        if (Math.hypot(clickX - 345, clickY - 40) <= 15) {
            velocitiesRef.current.snare += 0.4;
            triggerRipple(clickX, clickY, '#b0bec5', 30);
            onPreviewInstrument('snare');
            return;
        }

        // 11. Kick Drum (x: 300, y: 115)
        if (Math.hypot(clickX - 300, clickY - 115) <= 24) {
            velocitiesRef.current.kick += 0.4;
            triggerRipple(clickX, clickY, '#ff7043', 35);
            onPreviewInstrument('kick');
            return;
        }

        // 12. Shaker (x: 345, y: 115)
        if (Math.hypot(clickX - 345, clickY - 115) <= 16) {
            velocitiesRef.current.shaker += 0.4;
            triggerRipple(clickX, clickY, '#cfd8dc', 25);
            onPreviewInstrument('shaker');
            return;
        }
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
            <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.62rem', mb: 1, letterSpacing: '0.15em', fontWeight: 'bold' }}>
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
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'block'
                    }}
                />
            </Box>
        </Box>
    );
}
