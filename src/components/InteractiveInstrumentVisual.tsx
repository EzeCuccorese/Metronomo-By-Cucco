import { Box, Typography } from '@mui/material';
import { useEffect, useRef } from 'react';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';

interface InteractiveInstrumentVisualProps {
    pattern: RhythmPattern;
    currentStepIndex: number;
    onPreviewInstrument: (instrument: string) => void;
}

// Represents a touch ripple wave
interface Ripple {
    x: number;
    y: number;
    color: string;
    radius: number;
    maxRadius: number;
    opacity: number;
    speed: number;
}

// Represents a physical glowing particle spark
interface Particle {
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
    currentStepIndex,
    onPreviewInstrument
}: InteractiveInstrumentVisualProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const particlesRef = useRef<Particle[]>([]);

    // Spring scaling values for organic bounce physics
    const scalesRef = useRef<Record<string, number>>({
        bombo_parche: 1.0,
        bombo_aro: 1.0,
        snare: 1.0,
        kick: 1.0,
        hihat: 1.0,
        clave: 1.0,
        shaker: 1.0,
        conga_high: 1.0,
        conga_low: 1.0
    });

    const velocitiesRef = useRef<Record<string, number>>({
        bombo_parche: 0,
        bombo_aro: 0,
        snare: 0,
        kick: 0,
        hihat: 0,
        clave: 0,
        shaker: 0,
        conga_high: 0,
        conga_low: 0
    });

    const ripplesRef = useRef<Ripple[]>([]);
    const lastStepRef = useRef<number>(-1);

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
                    triggerRipple(70, 84, '#ffe082', 38);
                } else {
                    velocitiesRef.current.bombo_parche += boost;
                    triggerRipple(70, 115, '#dfa15b', 45);
                }
            } else if (inst === 'rim') {
                velocitiesRef.current.bombo_aro += boost;
                triggerRipple(70, 84, '#ffe082', 38);
            } else if (inst === 'kick' || inst === 'surdo') {
                velocitiesRef.current.kick += boost;
                triggerRipple(175, 125, '#d84315', 40);
            } else if (inst === 'snare') {
                velocitiesRef.current.snare += boost;
                triggerRipple(175, 65, '#b0bec5', 35);
            } else if (inst === 'hihat' || inst === 'hihat_foot' || inst === 'ride') {
                velocitiesRef.current.hihat += boost;
                triggerRipple(265, 52, '#ffd54f', 32);
            } else if (inst === 'clave') {
                velocitiesRef.current.clave += boost;
                triggerRipple(70, 42, '#ffb300', 30);
            } else if (inst === 'shaker') {
                velocitiesRef.current.shaker += boost;
                triggerRipple(345, 90, '#cfd8dc', 25);
            } else if (inst === 'tom_high') {
                velocitiesRef.current.conga_high += boost;
                triggerRipple(250, 115, '#ff7043', 30);
            } else if (inst === 'tom_low' || inst === 'tom_floor') {
                velocitiesRef.current.conga_low += boost;
                triggerRipple(295, 120, '#ff7043', 32);
            }
        });
    }, [currentStepIndex, pattern]);

    const triggerRipple = (x: number, y: number, color: string, maxRad: number = 30) => {
        ripplesRef.current.push({
            x,
            y,
            color,
            radius: 4,
            maxRadius: maxRad,
            opacity: 1.0,
            speed: 1.6
        });

        // Spawn a burst of beautiful glowing sparks/particles at the strike point!
        spawnParticles(x, y, color, 8);
    };

    const spawnParticles = (x: number, y: number, color: string, count: number = 8) => {
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
    };

    // Canvas render loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const render = () => {
            if (!ctx || !canvas) return;

            const w = canvas.width;
            const h = canvas.height;

            ctx.clearRect(0, 0, w, h);

            // --- A. ELASTIC SPRING RESOLUTION ---
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
                ctx.lineWidth = 2.0;
                ctx.stroke();
                ctx.restore();
            });

            // --- B2. UPDATING & DRAWING PARTICLES (SPARKS) ---
            particlesRef.current.forEach((p, idx) => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.045; // Slight gravity pull for organic look!
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
                ctx.shadowBlur = 5;
                ctx.fill();
                ctx.restore();
            });

            // --- C. DIBUJAR SEPARADORES DE CATEGORÍA ---
            ctx.save();
            ctx.strokeStyle = 'rgba(215, 204, 200, 0.04)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(122, 10);
            ctx.lineTo(122, h - 10);
            ctx.moveTo(330, 10);
            ctx.lineTo(330, h - 10);
            ctx.stroke();

            // Etiquetas
            ctx.fillStyle = 'rgba(191, 174, 158, 0.25)';
            ctx.font = 'bold 8px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText('TRADICIONAL 🇦🇷', 68, 15);
            ctx.fillText('BATERÍA / CONGAS 🥁', 226, 15);
            ctx.fillText('SHAKER 🌾', 355, 15);
            ctx.restore();

            // --- D. INSTRUMENTO 1: CLAVES (Crossed Sticks) ---
            ctx.save();
            const clScale = scalesRef.current.clave;
            const clX = 68;
            const clY = 42;
            ctx.translate(clX, clY);
            ctx.scale(clScale, clScale);

            const isClaveStriking = clScale > 1.08;
            // Angle sways slightly on strike
            const stickAngle1 = -Math.PI / 8;
            const stickAngle2 = Math.PI / 6 - (isClaveStriking ? Math.PI / 10 : 0);

            // Wood stick 1 (Mahogany/Redwood)
            ctx.save();
            ctx.rotate(stickAngle1);
            const rGrad1 = ctx.createLinearGradient(-18, -3, 18, 3);
            rGrad1.addColorStop(0, '#5d4037');
            rGrad1.addColorStop(0.5, '#8d6e63');
            rGrad1.addColorStop(1, '#3e2723');
            ctx.fillStyle = rGrad1;
            ctx.beginPath();
            ctx.roundRect(-20, -3.5, 40, 7, 3);
            ctx.fill();
            ctx.restore();

            // Wood stick 2 (Crossing)
            ctx.save();
            ctx.rotate(stickAngle2);
            const rGrad2 = ctx.createLinearGradient(-18, -3, 18, 3);
            rGrad2.addColorStop(0, '#4e342e');
            rGrad2.addColorStop(0.5, '#795548');
            rGrad2.addColorStop(1, '#2d1510');
            ctx.fillStyle = rGrad2;
            ctx.beginPath();
            ctx.roundRect(-20, -3.5, 40, 7, 3);
            ctx.fill();
            ctx.restore();

            // Draw impact flash spark if hitting
            if (isClaveStriking) {
                const flashRad = 10 * (clScale - 1.0);
                const flashGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, flashRad);
                flashGrad.addColorStop(0, '#ffffff');
                flashGrad.addColorStop(0.4, '#ffe082');
                flashGrad.addColorStop(1, 'rgba(255,224,130,0)');
                ctx.fillStyle = flashGrad;
                ctx.beginPath();
                ctx.arc(0, 0, flashRad, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            // --- E. INSTRUMENTO 2: BOMBO LEGÜERO ---
            const bomboX = 70;
            const bomboY = 118;
            const bWidth = 48;
            const bHeight = 58;

            ctx.save();
            ctx.translate(bomboX, bomboY);
            
            // Cuerpo elástico
            const bpScale = scalesRef.current.bombo_parche;
            const baScale = scalesRef.current.bombo_aro;
            ctx.scale(bpScale, bpScale);

            // Wood shell barrel gradient
            const woodGrad = ctx.createLinearGradient(-bWidth/2, -bHeight/2, bWidth/2, -bHeight/2);
            woodGrad.addColorStop(0, '#2d1a12');
            woodGrad.addColorStop(0.3, '#5d4037');
            woodGrad.addColorStop(0.5, '#795548');
            woodGrad.addColorStop(0.7, '#5d4037');
            woodGrad.addColorStop(1, '#1b0c06');

            ctx.beginPath();
            ctx.moveTo(-bWidth/2, -bHeight/2);
            ctx.lineTo(-bWidth/2, bHeight/2 - 5);
            ctx.quadraticCurveTo(0, bHeight/2 + 5, bWidth/2, bHeight/2 - 5);
            ctx.lineTo(bWidth/2, -bHeight/2);
            ctx.closePath();
            ctx.fillStyle = woodGrad;
            ctx.fill();

            // Subtle vertical wood grains
            ctx.strokeStyle = 'rgba(27, 16, 12, 0.25)';
            ctx.lineWidth = 1.2;
            for (let ox = -bWidth/2.5; ox <= bWidth/2.5; ox += 10) {
                ctx.beginPath();
                ctx.moveTo(ox, -bHeight/2);
                ctx.quadraticCurveTo(ox * 0.85, 0, ox, bHeight/2);
                ctx.stroke();
            }

            // Rustic ropes in zig-zag with dynamic physical vibration when struck
            const isVibrating = bpScale > 1.02 || baScale > 1.02;
            const vib = isVibrating ? Math.sin(performance.now() * 0.09) * 1.5 * (bpScale - 1.0) : 0;

            ctx.strokeStyle = '#e0dcd9';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(-bWidth/2 + 4 + vib, -bHeight/2 + 2);
            ctx.lineTo(-bWidth/3 - vib, bHeight/2 - 2);
            ctx.lineTo(-bWidth/8 + vib, -bHeight/2 + 2);
            ctx.lineTo(0 - vib, bHeight/2 - 2);
            ctx.lineTo(bWidth/8 + vib, -bHeight/2 + 2);
            ctx.lineTo(bWidth/3 - vib, bHeight/2 - 2);
            ctx.lineTo(bWidth/2 - 4 + vib, -bHeight/2 + 2);
            ctx.stroke();

            // Leather tensioners
            ctx.fillStyle = '#8d6e63';
            ctx.beginPath();
            ctx.arc(-bWidth/3.2, bHeight/5, 3, 0, Math.PI * 2);
            ctx.arc(bWidth/3.2, -bHeight/8, 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();

            // Aro de Madera and Rawhide Skin Head (perspective ellipse on top)
            ctx.save();
            ctx.translate(bomboX, bomboY - bHeight/2);
            ctx.scale(baScale, baScale);

            const rX = bWidth / 2;
            const rY = 12;

            // Wood Rim
            ctx.beginPath();
            ctx.ellipse(0, 0, rX, rY, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#4e342e';
            ctx.fill();
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#27120f';
            ctx.stroke();

            // Leather patch
            ctx.beginPath();
            ctx.ellipse(0, 0, rX - 3.5, rY - 2.8, 0, 0, Math.PI * 2);
            const leatherGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, rX);
            leatherGrad.addColorStop(0, '#fbf9f4');
            leatherGrad.addColorStop(0.7, '#f3ebd9');
            leatherGrad.addColorStop(1, '#d5cbb5');
            ctx.fillStyle = leatherGrad;
            ctx.fill();

            // Leather spots
            ctx.fillStyle = 'rgba(109, 76, 65, 0.16)';
            ctx.beginPath();
            ctx.ellipse(-11, -1, 7, 3, Math.PI/6, 0, Math.PI * 2);
            ctx.ellipse(9, 2, 5, 2, -Math.PI/4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // --- F. INSTRUMENTO 3: SNARE (Redoblante Metal) ---
            const snareX = 175;
            const snareY = 65;
            const sSize = 21;

            ctx.save();
            ctx.translate(snareX, snareY);
            const sScale = scalesRef.current.snare;
            ctx.scale(sScale, sScale);

            // Chrome metal gradient shell
            const snareGrad = ctx.createLinearGradient(-sSize, 0, sSize, 0);
            snareGrad.addColorStop(0, '#90a4ae');
            snareGrad.addColorStop(0.5, '#eceff1');
            snareGrad.addColorStop(1, '#455a64');

            ctx.beginPath();
            ctx.arc(0, 0, sSize, 0, Math.PI * 2);
            ctx.fillStyle = snareGrad;
            ctx.fill();
            ctx.strokeStyle = '#37474f';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Sand-blasted white skin head
            ctx.beginPath();
            ctx.arc(0, 0, sSize - 2.2, 0, Math.PI * 2);
            ctx.fillStyle = '#f8fafd';
            ctx.fill();

            // Snare wires underneath shadow
            ctx.strokeStyle = 'rgba(0,0,0,0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-sSize + 5, -2); ctx.lineTo(sSize - 5, -2);
            ctx.moveTo(-sSize + 4, 0);  ctx.lineTo(sSize - 4, 0);
            ctx.moveTo(-sSize + 5, 2);  ctx.lineTo(sSize - 5, 2);
            ctx.stroke();
            ctx.restore();

            // --- G. INSTRUMENTO 4: KICK / SURDO (Bass Drum) ---
            const kickX = 175;
            const kickY = 125;
            const kSize = 34;

            ctx.save();
            ctx.translate(kickX, kickY);
            const kScale = scalesRef.current.kick;
            ctx.scale(kScale, kScale);

            // Copper brass shell
            const kickGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, kSize);
            kickGrad.addColorStop(0, '#ff7043');
            kickGrad.addColorStop(0.65, '#d84315');
            kickGrad.addColorStop(1, '#4e1505');

            ctx.beginPath();
            ctx.arc(0, 0, kSize, 0, Math.PI * 2);
            ctx.fillStyle = kickGrad;
            ctx.fill();
            ctx.strokeStyle = '#cfd8dc';
            ctx.lineWidth = 3.2;
            ctx.stroke();

            // Premium charcoal head
            ctx.beginPath();
            ctx.arc(0, 0, kSize - 5, 0, Math.PI * 2);
            ctx.fillStyle = '#1c2224';
            ctx.fill();

            // Sound resonance hole
            ctx.fillStyle = '#090a0b';
            ctx.beginPath();
            ctx.arc(10, 8, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // --- H. INSTRUMENTO 5: HI-HAT (Gold Brass Cymbal) ---
            const hhX = 265;
            const hhY = 52;
            const hhSize = 18;

            ctx.save();
            ctx.translate(hhX, hhY);
            const hhScale = scalesRef.current.hihat;
            ctx.scale(hhScale, hhScale);

            // Concentric shiny gold cymbal
            const cymbalGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, hhSize);
            cymbalGrad.addColorStop(0, '#ffe082');
            cymbalGrad.addColorStop(0.5, '#e5a95f');
            cymbalGrad.addColorStop(1, '#744f23');

            ctx.beginPath();
            ctx.arc(0, 0, hhSize, 0, Math.PI * 2);
            ctx.fillStyle = cymbalGrad;
            ctx.fill();
            ctx.strokeStyle = '#8c602d';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Lathed concentric ridges
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
            for (let r = 5; r < hhSize - 1; r += 4) {
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Polished raised center bell
            ctx.fillStyle = '#ffca28';
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            // --- I. INSTRUMENTO 6: CONGAS (Afro-Cuban Drums) ---
            // 1. Quinto (Conga High)
            const qX = 250;
            const qY = 115;
            const qW = 20;
            const qH = 46;

            ctx.save();
            ctx.translate(qX, qY);
            const qScale = scalesRef.current.conga_high;
            ctx.scale(qScale, qScale);

            // Wood stave gradient
            const qGrad = ctx.createLinearGradient(-qW/2, -qH/2, qW/2, -qH/2);
            qGrad.addColorStop(0, '#5d4037');
            qGrad.addColorStop(0.5, '#a1887f');
            qGrad.addColorStop(1, '#3e2723');

            ctx.beginPath();
            ctx.moveTo(-qW/2, -qH/2);
            ctx.lineTo(-qW/2 * 0.8, qH/2);
            ctx.quadraticCurveTo(0, qH/2 + 3, qW/2 * 0.8, qH/2);
            ctx.lineTo(qW/2, -qH/2);
            ctx.closePath();
            ctx.fillStyle = qGrad;
            ctx.fill();

            // Golden steel rings
            ctx.strokeStyle = '#ffe082';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-qW/2 + 1, -qH/6); ctx.lineTo(qW/2 - 1, -qH/6);
            ctx.moveTo(-qW/2 + 2, qH/4);  ctx.lineTo(qW/2 - 2, qH/4);
            ctx.stroke();

            // Conga head
            ctx.save();
            ctx.translate(0, -qH/2);
            ctx.beginPath();
            ctx.ellipse(0, 0, qW/2, 4, 0, 0, Math.PI*2);
            ctx.fillStyle = '#ffe082'; // Gold rim
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(0, 0, qW/2 - 1.5, 3, 0, 0, Math.PI*2);
            ctx.fillStyle = '#efe5d9'; // Thick cowhide
            ctx.fill();
            ctx.restore();

            ctx.restore();

            // 2. Tumbadora (Conga Low)
            const tX = 292;
            const tY = 118;
            const tW = 24;
            const tH = 50;

            ctx.save();
            ctx.translate(tX, tY);
            const tScale = scalesRef.current.conga_low;
            ctx.scale(tScale, tScale);

            // Deep mahogany wood stave gradient
            const tGrad = ctx.createLinearGradient(-tW/2, -tH/2, tW/2, -tH/2);
            tGrad.addColorStop(0, '#3e2723');
            tGrad.addColorStop(0.5, '#795548');
            tGrad.addColorStop(1, '#1b0c06');

            ctx.beginPath();
            ctx.moveTo(-tW/2, -tH/2);
            ctx.lineTo(-tW/2 * 0.8, tH/2);
            ctx.quadraticCurveTo(0, tH/2 + 3, tW/2 * 0.8, tH/2);
            ctx.lineTo(tW/2, -tH/2);
            ctx.closePath();
            ctx.fillStyle = tGrad;
            ctx.fill();

            // Steel rings
            ctx.strokeStyle = '#cfd8dc';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-tW/2 + 1, -tH/6); ctx.lineTo(tW/2 - 1, -tH/6);
            ctx.moveTo(-tW/2 + 2, tH/4);  ctx.lineTo(tW/2 - 2, tH/4);
            ctx.stroke();

            // Conga head
            ctx.save();
            ctx.translate(0, -tH/2);
            ctx.beginPath();
            ctx.ellipse(0, 0, tW/2, 4.5, 0, 0, Math.PI*2);
            ctx.fillStyle = '#b0bec5'; // Chrome rim
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(0, 0, tW/2 - 1.5, 3.2, 0, 0, Math.PI*2);
            ctx.fillStyle = '#e5dbcd'; // Rawhide skin
            ctx.fill();
            ctx.restore();

            ctx.restore();

            // --- J. INSTRUMENTO 7: SHAKER / GUACHE (Metallic Cylinder) ---
            ctx.save();
            const shScale = scalesRef.current.shaker;
            const shX = 355;
            const shY = 90;
            
            // Organic back-and-forth shake movement on hit
            let shakeX = 0;
            let shakeY = 0;
            if (shScale > 1.05) {
                shakeX = Math.sin(performance.now() * 0.065) * 7.5 * (shScale - 1.0);
                shakeY = Math.cos(performance.now() * 0.05) * 4.0 * (shScale - 1.0);
            }
            
            ctx.translate(shX + shakeX, shY + shakeY);
            ctx.scale(shScale, shScale);
            ctx.rotate(Math.PI / 12); // Slightly tilted

            const shW = 15;
            const shH = 34;

            // Aluminum brushed metal gradient
            const alumGrad = ctx.createLinearGradient(-shW/2, 0, shW/2, 0);
            alumGrad.addColorStop(0, '#78909c');
            alumGrad.addColorStop(0.3, '#cfd8dc');
            alumGrad.addColorStop(0.5, '#ffffff');
            alumGrad.addColorStop(0.8, '#b0bec5');
            alumGrad.addColorStop(1, '#37474f');

            ctx.beginPath();
            ctx.roundRect(-shW/2, -shH/2, shW, shH, 1.5);
            ctx.fillStyle = alumGrad;
            ctx.fill();
            ctx.strokeStyle = '#546e7a';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Lathed aluminum grooves (horizontal stripes)
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
            ctx.lineWidth = 0.8;
            for (let sy = -shH/2.5; sy <= shH/2.5; sy += 5) {
                ctx.beginPath();
                ctx.moveTo(-shW/2 + 0.5, sy);
                ctx.lineTo(shW/2 - 0.5, sy);
                ctx.stroke();
            }

            // Shiny chrome caps on top and bottom
            ctx.fillStyle = '#b0bec5';
            ctx.fillRect(-shW/2, -shH/2, shW, 1.8);
            ctx.fillRect(-shW/2, shH/2 - 1.8, shW, 1.8);

            ctx.restore();

            animationFrameId = requestAnimationFrame(render);
        };

        animationFrameId = requestAnimationFrame(render);

        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    // Interactive mouse clicks manual preview
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        // --- HIERARCHICAL GEOMETRIC COLLISION DETECTOR ---

        // 1. Claves (x: 68, y: 42, radius ~24)
        if (Math.hypot(clickX - 68, clickY - 42) <= 24) {
            velocitiesRef.current.clave += 0.45;
            triggerRipple(clickX, clickY, '#ffe082', 30);
            onPreviewInstrument('clave');
            return;
        }

        // 2. Bombo Legüero
        const bomboX = 70;
        const bomboYTop = 118 - 58/2; // 89
        const rx = 24;
        const ry = 12;

        // Top head ellipse equation
        const bomboHeadEq = Math.pow(clickX - bomboX, 2) / Math.pow(rx, 2) + Math.pow(clickY - bomboYTop, 2) / Math.pow(ry, 2);
        if (bomboHeadEq <= 1.0) {
            const bomboParcheEq = Math.pow(clickX - bomboX, 2) / Math.pow(rx - 3.5, 2) + Math.pow(clickY - bomboYTop, 2) / Math.pow(ry - 2.8, 2);
            if (bomboParcheEq <= 1.0) {
                // Parche
                velocitiesRef.current.bombo_parche += 0.45;
                triggerRipple(clickX, clickY, '#dfa15b', 45);
                onPreviewInstrument('bombo_leguero');
            } else {
                // Aro
                velocitiesRef.current.bombo_aro += 0.45;
                triggerRipple(clickX, clickY, '#ffe082', 38);
                onPreviewInstrument('rim');
            }
            return;
        }

        // Bombo Legüero Shell
        if (Math.abs(clickX - bomboX) < rx && clickY > bomboYTop && clickY < bomboYTop + 58) {
            velocitiesRef.current.bombo_parche += 0.45;
            triggerRipple(clickX, clickY, '#dfa15b', 45);
            onPreviewInstrument('bombo_leguero');
            return;
        }

        // 3. Snare (x: 175, y: 65, radius ~21)
        if (Math.hypot(clickX - 175, clickY - 65) <= 21) {
            velocitiesRef.current.snare += 0.45;
            triggerRipple(clickX, clickY, '#b0bec5', 35);
            onPreviewInstrument('snare');
            return;
        }

        // 4. Kick Drum (x: 175, y: 125, radius ~34)
        if (Math.hypot(clickX - 175, clickY - 125) <= 34) {
            velocitiesRef.current.kick += 0.45;
            triggerRipple(clickX, clickY, '#d84315', 40);
            onPreviewInstrument('kick');
            return;
        }

        // 5. Hihat (x: 265, y: 52, radius ~18)
        if (Math.hypot(clickX - 265, clickY - 52) <= 18) {
            velocitiesRef.current.hihat += 0.45;
            triggerRipple(clickX, clickY, '#ffd54f', 32);
            onPreviewInstrument('hihat');
            return;
        }

        // 6. Quinto Conga High (x: 250, y: 115)
        if (Math.abs(clickX - 250) < 11 && Math.abs(clickY - 115) < 23) {
            velocitiesRef.current.conga_high += 0.45;
            triggerRipple(clickX, clickY, '#ff7043', 30);
            onPreviewInstrument('tom_high');
            return;
        }

        // 7. Tumbadora Conga Low (x: 292, y: 118)
        if (Math.abs(clickX - 292) < 13 && Math.abs(clickY - 118) < 25) {
            velocitiesRef.current.conga_low += 0.45;
            triggerRipple(clickX, clickY, '#ff7043', 32);
            onPreviewInstrument('tom_low');
            return;
        }

        // 8. Shaker (x: 355, y: 90, radius ~15)
        if (Math.hypot(clickX - 355, clickY - 90) <= 20) {
            velocitiesRef.current.shaker += 0.45;
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
            bgcolor: 'rgba(0,0,0,0.25)',
            borderRadius: 4,
            border: '1px solid rgba(215, 204, 200, 0.05)',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
        }}>
            <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.65rem', mb: 1, letterSpacing: '0.15em', fontWeight: 'bold' }}>
                INSTRUMENTOS TÁCTILES PRO (HAZ CLIC PARA PROBAR)
            </Typography>

            <Box sx={{
                width: '100%',
                height: 175,
                position: 'relative',
                cursor: 'pointer'
            }}>
                <canvas
                    ref={canvasRef}
                    width={380}
                    height={175}
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
