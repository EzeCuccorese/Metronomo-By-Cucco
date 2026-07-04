import { Box, Stack, Typography, ToggleButton, ToggleButtonGroup } from '@mui/material';
import CircleIcon from '@mui/icons-material/Circle';
import SpeedIcon from '@mui/icons-material/Speed';
import { useEffect, useRef, useState } from 'react';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';

interface ConductorVisualProps {
    pattern: RhythmPattern;
    currentStepIndex: number;
    trainerActive: boolean;
    currentBarProgress: number;
    totalBarsInterval: number;
    bpm?: number;
}

const getCountingText = (stepIndex: number, subdivision: number, mode: RhythmPattern['countingMode'], timeSignature: [number, number]): string => {
    const beats = timeSignature[0];
    const stepsPerBeat = subdivision / beats;

    const beatNum = Math.floor(stepIndex / stepsPerBeat) + 1; // 1-based Beat
    const subIndex = stepIndex % stepsPerBeat; // 0-based sub index within beat

    if (mode === 'numbers') {
        return subIndex === 0 ? `${beatNum}` : '';
    }

    if (mode === '1&2&') {
        if (subIndex === 0) return `${beatNum}`;
        if (subIndex === 0.5 * stepsPerBeat) return '&';
        return '';
    }

    if (mode === '1e&a') {
        if (subIndex === 0) return `${beatNum}`;
        if (subIndex === 1) return 'e';
        if (subIndex === 2) return '&';
        if (subIndex === 3) return 'a';
    }

    if (mode === 'triplet_1la2la') {
        if (subIndex === 0) return `${beatNum}`;
        if (subIndex === 1) return 'la';
        if (subIndex === 2) return 'le';
    }

    if (mode === 'mnemonics_chacarera') {
        const mapping = ['MA', 'de', 'RA', 'PAR', 'che', 'PAR'];
        return mapping[stepIndex % 6] || '';
    }

    return '';
};

type VisualMode = 'pendulum' | 'orchestra';

export default function ConductorVisual({
    pattern,
    currentStepIndex,
    trainerActive,
    currentBarProgress,
    totalBarsInterval,
    bpm = 120
}: ConductorVisualProps) {
    const { subdivision, timeSignature, countingMode } = pattern;
    const beats = timeSignature[0];
    const stepsPerBeat = subdivision / beats;
    const currentBeatIndex = Math.floor(currentStepIndex / stepsPerBeat);

    const [visualMode, setVisualMode] = useState<VisualMode>('pendulum');
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // Animation values
    const angleRef = useRef<number>(0);
    const targetAngleRef = useRef<number>(0);
    const pulseIntensityRef = useRef<number>(0);

    // Conductor path particles
    const trailRef = useRef<{ x: number; y: number; alpha: number }[]>([]);
    const trail3Ref = useRef<{ x: number; y: number; alpha: number }[]>([]);
    const trail2Ref = useRef<{ x: number; y: number; alpha: number }[]>([]);

    const lastStepTimeRef = useRef<number>(0);
    const prevStepIndexRef = useRef<number>(-1);

    useEffect(() => {
        if (lastStepTimeRef.current === 0) {
            lastStepTimeRef.current = performance.now();
        }
        if (currentStepIndex !== prevStepIndexRef.current) {
            prevStepIndexRef.current = currentStepIndex;
            lastStepTimeRef.current = performance.now();
        }
    }, [currentStepIndex]);

    // Handle incoming beats to trigger pulses & target angles
    useEffect(() => {
        // Swing target angle calculation: alternate left/right extremes on beats
        const maxAngle = 0.45; // Radians (~25 degrees)
        
        // Calculate a smooth continuous wave based on step progress
        // A full bar has "beats" oscillations
        const isOddBeat = Math.floor(currentStepIndex / stepsPerBeat) % 2 === 1;
        
        // Target angle swings left on even beats, right on odd beats
        const interpolationFactor = (currentStepIndex % stepsPerBeat) / stepsPerBeat;
        const direction = isOddBeat ? 1 : -1;
        
        // Smooth sine wave target for natural pendulum gravity swing
        targetAngleRef.current = maxAngle * direction * Math.cos(interpolationFactor * Math.PI);

        // Flash background light on beat start
        if (currentStepIndex % stepsPerBeat === 0) {
            pulseIntensityRef.current = 1.0;
        }
    }, [currentStepIndex, subdivision, stepsPerBeat]);

    // Canvas animation loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const render = () => {
            if (!ctx || !canvas) return;

            // Handle High DPI displays
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }

            ctx.clearRect(0, 0, width, height);

            // 1. Draw glowing background beat pulse
            if (pulseIntensityRef.current > 0) {
                const gradient = ctx.createRadialGradient(
                    width / 2, height / 2, 10,
                    width / 2, height / 2, Math.max(width, height) / 1.5
                );
                // Warm Amber glow
                gradient.addColorStop(0, `rgba(229, 169, 95, ${pulseIntensityRef.current * 0.15})`);
                gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, width, height);
                pulseIntensityRef.current -= 0.05; // Decay pulse
            }

            // Lerp pendulum angle for super smooth movement
            angleRef.current = angleRef.current * 0.82 + targetAngleRef.current * 0.18;

            if (visualMode === 'pendulum') {
                drawPendulum(ctx, width, height, angleRef.current);
            } else {
                drawOrchestraConductor(ctx, width, height);
            }

            animationFrameId = requestAnimationFrame(render);
        };

        const drawPendulum = (ctx: CanvasRenderingContext2D, w: number, h: number, angle: number) => {
            const centerX = w / 2;
            const centerY = h - 25;
            const baseWidth = w * 0.45;
            const topWidth = w * 0.12;
            const bodyHeight = h * 0.75;
            const apexY = centerY - bodyHeight;

            // --- A. Draw Metronome Wooden Body ---
            // Outer Shadow / Ambient shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 15;
            ctx.shadowOffsetY = 5;

            // Gradient for warm mahogany/cedar wood
            const woodGrad = ctx.createLinearGradient(centerX - baseWidth/2, centerY, centerX + baseWidth/2, centerY);
            woodGrad.addColorStop(0, '#2d1a10'); // Dark left
            woodGrad.addColorStop(0.3, '#4e2f1d'); // Rich wood warm
            woodGrad.addColorStop(0.5, '#5c3924'); // Lighter center
            woodGrad.addColorStop(0.7, '#4e2f1d'); // Rich wood warm
            woodGrad.addColorStop(1, '#25150d'); // Very dark right

            ctx.beginPath();
            ctx.moveTo(centerX - baseWidth / 2, centerY);
            ctx.lineTo(centerX - topWidth / 2, apexY);
            ctx.lineTo(centerX + topWidth / 2, apexY);
            ctx.lineTo(centerX + baseWidth / 2, centerY);
            ctx.closePath();
            ctx.fillStyle = woodGrad;
            ctx.fill();

            // Sutil wood outline
            ctx.shadowBlur = 0; // Reset shadow
            ctx.shadowOffsetY = 0;
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(229, 169, 95, 0.12)';
            ctx.stroke();

            // --- B. Draw Inside Metal Plate Face (Scale Ticks) ---
            const faceWidthBase = baseWidth * 0.65;
            const faceWidthTop = topWidth * 0.65;
            const faceHeight = bodyHeight * 0.85;
            const faceY = centerY - faceHeight - 5;

            const faceGrad = ctx.createLinearGradient(centerX - faceWidthBase/2, centerY, centerX + faceWidthBase/2, centerY);
            faceGrad.addColorStop(0, '#110f0e');
            faceGrad.addColorStop(0.5, '#201c18');
            faceGrad.addColorStop(1, '#110f0e');

            ctx.beginPath();
            ctx.moveTo(centerX - faceWidthBase / 2, centerY - 5);
            ctx.lineTo(centerX - faceWidthTop / 2, faceY);
            ctx.lineTo(centerX + faceWidthTop / 2, faceY);
            ctx.lineTo(centerX + faceWidthBase / 2, centerY - 5);
            ctx.closePath();
            ctx.fillStyle = faceGrad;
            ctx.fill();

            // Draw center alignment line and graduation scale ticks
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(229, 169, 95, 0.2)';
            ctx.beginPath();
            ctx.moveTo(centerX, faceY + 10);
            ctx.lineTo(centerX, centerY - 15);
            ctx.stroke();

            // Scale tick arcs
            ctx.strokeStyle = 'rgba(229, 169, 95, 0.12)';
            for (let offset = 20; offset < faceHeight - 20; offset += 20) {
                const tickY = faceY + offset;
                const tickLen = 6;
                ctx.beginPath();
                ctx.moveTo(centerX - tickLen, tickY);
                ctx.lineTo(centerX + tickLen, tickY);
                ctx.stroke();
            }

            // --- C. Draw Metronome Rod & Weight (Swinging part) ---
            const rodLength = bodyHeight * 0.95;
            const rodAngle = angle; // Radians

            // Calculate current end point of rod
            const rodEndX = centerX + Math.sin(rodAngle) * rodLength;
            const rodEndY = centerY - Math.cos(rodAngle) * rodLength;

            // Pivot point is near the bottom
            const pivotX = centerX;
            const pivotY = centerY - 10;

            // Draw Steel Rod
            ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetY = 2;

            ctx.lineWidth = 3;
            ctx.strokeStyle = '#cfd8dc'; // Brushed silver
            ctx.beginPath();
            ctx.moveTo(pivotX, pivotY);
            ctx.lineTo(rodEndX, rodEndY);
            ctx.stroke();

            // Draw Brass Weight sliding on the rod
            // Weight height adjusts with BPM (higher up for slower BPM, like physical metronome!)
            const minBpm = 40;
            const maxBpm = 240;
            const normalizedBpm = Math.max(0, Math.min(1, (bpm - minBpm) / (maxBpm - minBpm)));
            // Higher BPM = weight lower down the rod
            const weightPercent = 0.35 + (1 - normalizedBpm) * 0.45; 
            const weightX = pivotX + Math.sin(rodAngle) * (rodLength * weightPercent);
            const weightY = pivotY - Math.cos(rodAngle) * (rodLength * weightPercent);

            // Draw trapezoidal weight
            ctx.save();
            ctx.translate(weightX, weightY);
            ctx.rotate(rodAngle);

            const wWidth = 14;
            const wHeight = 16;

            const brassGrad = ctx.createLinearGradient(-wWidth/2, -wHeight/2, wWidth/2, wHeight/2);
            brassGrad.addColorStop(0, '#ffe082'); // Shiny gold
            brassGrad.addColorStop(0.5, '#e5a95f'); // Amber gold
            brassGrad.addColorStop(1, '#ffb300'); // Brass

            ctx.fillStyle = brassGrad;
            ctx.beginPath();
            ctx.moveTo(-wWidth/2, wHeight/2);
            ctx.lineTo(-wWidth*0.7/2, -wHeight/2);
            ctx.lineTo(wWidth*0.7/2, -wHeight/2);
            ctx.lineTo(wWidth/2, wHeight/2);
            ctx.closePath();
            ctx.fill();

            // Outline for weight
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#b5832e';
            ctx.stroke();

            // Center slot/screw details
            ctx.fillStyle = '#263238';
            ctx.fillRect(-1.5, -4, 3, 8);

            ctx.restore();
            ctx.shadowBlur = 0; // Reset

            // --- D. Front Pivot Caps ---
            ctx.beginPath();
            ctx.arc(pivotX, pivotY, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#ffb300';
            ctx.fill();
            ctx.stroke();
        };

        const drawOrchestraConductor = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
            const padding = 45;
            const bottomY = h - padding;
            const topY = padding;
            const leftX = padding;
            const rightX = w - padding;
            const centerX = w / 2;
            const centerY = h / 2;

            // Interpolate smooth step position using elapsed time at current BPM
            const ts = pattern.timeSignature;
            const sub = pattern.subdivision;
            const timePerBar = (60.0 / bpm) * (4.0 / ts[1]) * ts[0];
            const stepDurationMs = (timePerBar / sub) * 1000;
            const elapsedMs = performance.now() - lastStepTimeRef.current;
            const smoothProgress = Math.min(0.99, elapsedMs / stepDurationMs);
            const smoothStep = currentStepIndex + smoothProgress;

            if (pattern.grooveType === 'chacarera_poliritmica') {
                // --- CHACARERA POLIRITMICA DOUBLE-SPARK VISUALIZER (HEMIOLA) ---

                // 1. 3/4 feel triangle path
                const points3 = [
                    { x: centerX, y: bottomY },
                    { x: rightX - 20, y: centerY + 15 },
                    { x: centerX, y: topY }
                ];

                ctx.strokeStyle = 'rgba(229, 169, 95, 0.14)';
                ctx.lineWidth = 2.0;
                ctx.setLineDash([4, 6]);
                ctx.beginPath();
                points3.forEach((p, idx) => {
                    if (idx === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                });
                ctx.closePath();
                ctx.stroke();

                // 2. 6/8 feel ellipse path
                const radiusX = w * 0.32;
                const radiusY = h * 0.22;
                ctx.strokeStyle = 'rgba(255, 109, 0, 0.16)';
                ctx.setLineDash([3, 5]);
                ctx.beginPath();
                ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]); // Reset

                // Label paths
                ctx.fillStyle = 'rgba(229, 169, 95, 0.4)';
                ctx.font = 'bold 9px Outfit';
                ctx.fillText('3/4', centerX - 12, bottomY - 12);

                ctx.fillStyle = 'rgba(255, 109, 0, 0.4)';
                ctx.fillText('6/8', centerX + radiusX - 25, centerY - 8);

                // Compute Particle 3/4 Position (3 beats per bar, 4 steps per beat)
                const smoothBeat3 = smoothStep / 4;
                const currentBeat3 = Math.floor(smoothBeat3);
                const stepFraction3 = smoothBeat3 % 1;
                const easedT3 = 0.5 - 0.5 * Math.cos(stepFraction3 * Math.PI);
                const pt3_1 = points3[currentBeat3 % 3];
                const pt3_2 = points3[(currentBeat3 + 1) % 3];
                const p3X = pt3_1.x + (pt3_2.x - pt3_1.x) * easedT3;
                const p3Y = pt3_1.y + (pt3_2.y - pt3_1.y) * easedT3;

                // Compute Particle 6/8 Position (Ellipse rotation)
                const angle = -Math.PI / 2 + (Math.PI * 2) * (smoothStep / 12);
                const p2X = centerX + Math.cos(angle) * radiusX;
                const p2Y = centerY + Math.sin(angle) * radiusY;

                // Update Trails
                trail3Ref.current.push({ x: p3X, y: p3Y, alpha: 1.0 });
                if (trail3Ref.current.length > 25) trail3Ref.current.shift();

                trail2Ref.current.push({ x: p2X, y: p2Y, alpha: 1.0 });
                if (trail2Ref.current.length > 25) trail2Ref.current.shift();

                // Draw Trails
                trail3Ref.current.forEach((t, idx) => {
                    t.alpha = idx / trail3Ref.current.length;
                    ctx.beginPath();
                    ctx.arc(t.x, t.y, 1.5 + t.alpha * 5.0, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(229, 169, 95, ${t.alpha * 0.45})`;
                    ctx.fill();
                });

                trail2Ref.current.forEach((t, idx) => {
                    t.alpha = idx / trail2Ref.current.length;
                    ctx.beginPath();
                    ctx.arc(t.x, t.y, 1.5 + t.alpha * 5.0, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255, 109, 0, ${t.alpha * 0.45})`;
                    ctx.fill();
                });

                // Draw Particle 3/4 (Gold Spark)
                ctx.shadowColor = '#e5a95f';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(p3X, p3Y, 7, 0, Math.PI * 2);
                ctx.fillStyle = '#f4f1ed';
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.beginPath();
                ctx.arc(p3X, p3Y, 3.5, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();

                // Draw Particle 6/8 (Amber Spark)
                ctx.shadowColor = '#ff6d00';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(p2X, p2Y, 7, 0, Math.PI * 2);
                ctx.fillStyle = '#f4f1ed';
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.beginPath();
                ctx.arc(p2X, p2Y, 3.5, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();

            } else {
                // --- STANDARD SINGLE-SPARK GEOMETRIC CONDUCTOR PATH ---
                let points: { x: number; y: number }[] = [];

                if (beats === 3) {
                    // 3/4 Pattern: 1 (Down), 2 (Right), 3 (Up-Left return)
                    points = [
                        { x: centerX, y: bottomY }, // 1. Down
                        { x: rightX, y: bottomY - (h - 2*padding) * 0.15 }, // 2. Right
                        { x: centerX, y: topY } // 3. Up / Return
                    ];
                } else if (beats === 2 || beats === 6) {
                    // 2/4 or 6/8 Pattern: 1 (Down), 2 (Up-Arc return)
                    points = [
                        { x: centerX - w * 0.15, y: bottomY }, // 1. Down
                        { x: centerX + w * 0.15, y: topY }  // 2. Up
                    ];
                } else {
                    // Default 4/4: 1 (Down), 2 (Left), 3 (Right), 4 (Up-Arc return)
                    points = [
                        { x: centerX, y: bottomY },       // 1. Down
                        { x: leftX, y: bottomY - (h - 2*padding) * 0.3 },  // 2. Left
                        { x: rightX, y: bottomY - (h - 2*padding) * 0.3 }, // 3. Right
                        { x: centerX, y: topY }           // 4. Up / Return
                    ];
                }

                // Draw full background geometric path (faint guide lines)
                ctx.strokeStyle = 'rgba(229, 169, 95, 0.08)';
                ctx.lineWidth = 2.5;
                ctx.setLineDash([4, 6]);
                ctx.beginPath();
                points.forEach((p, idx) => {
                    if (idx === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                });
                ctx.closePath();
                ctx.stroke();
                ctx.setLineDash([]); // Reset dash

                const stepsPerBeat = sub / beats;
                const smoothBeatIndex = smoothStep / stepsPerBeat;
                const currentBeatIndex = Math.floor(smoothBeatIndex);
                const stepFraction = smoothBeatIndex % 1;
                const easedT = 0.5 - 0.5 * Math.cos(stepFraction * Math.PI);

                const currentPoint = points[currentBeatIndex % points.length];
                const nextPoint = points[(currentBeatIndex + 1) % points.length];

                const particleX = currentPoint.x + (nextPoint.x - currentPoint.x) * easedT;
                const particleY = currentPoint.y + (nextPoint.y - currentPoint.y) * easedT;

                // Add particle to trail
                trailRef.current.push({ x: particleX, y: particleY, alpha: 1.0 });
                if (trailRef.current.length > 25) {
                    trailRef.current.shift();
                }

                // Draw smooth glowing light trail (gradient ribbon)
                ctx.shadowBlur = 0;
                trailRef.current.forEach((t, idx) => {
                    t.alpha = idx / trailRef.current.length;
                    const size = 1.5 + (idx / trailRef.current.length) * 5.5;

                    ctx.beginPath();
                    ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(229, 169, 95, ${t.alpha * 0.4})`;
                    ctx.fill();
                });

                // Draw Active Spark Orb
                ctx.shadowColor = '#e5a95f';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(particleX, particleY, 7, 0, Math.PI * 2);
                ctx.fillStyle = '#f4f1ed';
                ctx.fill();

                // Inner core glow
                ctx.shadowBlur = 0;
                ctx.beginPath();
                ctx.arc(particleX, particleY, 3, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
            }
        };

        // Start animation frame loop
        animationFrameId = requestAnimationFrame(render);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [currentStepIndex, visualMode, beats, stepsPerBeat, bpm, pattern.grooveType, pattern.subdivision, pattern.timeSignature]);

    // Beat Dots visual feedback (Underneath the Canvas)
    const countText = getCountingText(currentStepIndex, subdivision, countingMode, timeSignature);

    const beatDots = Array.from({ length: beats }).map((_, idx) => {
        const isActiveBeat = idx === currentBeatIndex;
        const isAccent = pattern.steps.filter(s => s.step === (currentStepIndex + 1))
                        .reduce((acc, s) => Math.max(acc, s.velocity), 0) > 0.8;

        return (
            <Box key={idx} sx={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: 50,
                height: 60,
                justifyContent: 'center'
            }}>
                <CircleIcon sx={{
                    fontSize: 18,
                    color: isActiveBeat ? 'primary.main' : 'text.disabled',
                    transform: isActiveBeat ? (isAccent ? 'scale(1.7)' : 'scale(1.35)') : 'scale(1)',
                    transition: 'transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    filter: isActiveBeat ? (isAccent ? 'drop-shadow(0 0 10px #ff6d00)' : 'drop-shadow(0 0 8px #e5a95f)') : 'none'
                }} />

                <Typography variant="body2" sx={{
                    color: isActiveBeat ? 'primary.main' : 'text.secondary',
                    fontWeight: 'bold',
                    mt: 0.5,
                    fontSize: '0.9rem',
                    textShadow: isActiveBeat ? '0 0 8px rgba(229,169,95,0.4)' : 'none',
                    fontFamily: '"Outfit", sans-serif'
                }}>
                    {isActiveBeat && countText ? countText : (idx + 1)}
                </Typography>
            </Box>
        );
    });

    // Speed Trainer progress bars
    const barIndicators = trainerActive && totalBarsInterval > 1 ? (
        <Stack spacing={1} alignItems="center" sx={{ mt: 1.5, width: '100%' }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
                <SpeedIcon sx={{ fontSize: '0.9rem', color: 'secondary.main' }} />
                <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.65rem', letterSpacing: '0.1em' }}>
                    PROGRESO DEL ENTRENADOR ({currentBarProgress + 1} / {totalBarsInterval})
                </Typography>
            </Stack>
            <Box sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.5,
                justifyContent: 'center',
                width: '100%',
                px: 2
            }}>
                {Array.from({ length: totalBarsInterval }).map((_, idx) => {
                    const isCompleted = idx < currentBarProgress;
                    const isCurrent = idx === currentBarProgress;

                    return (
                        <Box key={idx} sx={{
                            width: 10, height: 5,
                            borderRadius: 1,
                            bgcolor: isCompleted ? 'secondary.main' : (isCurrent ? 'primary.main' : 'rgba(215, 204, 200, 0.08)'),
                            boxShadow: isCurrent ? '0 0 6px #ffe082' : 'none',
                            transition: 'all 0.2s',
                            flexShrink: 0
                        }} />
                    );
                })}
            </Box>
        </Stack>
    ) : null;

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%'
        }}>
            {/* Header: Toggle view mode with glassmorphic look */}
            <ToggleButtonGroup
                value={visualMode}
                exclusive
                onChange={(_, value) => value && setVisualMode(value)}
                size="small"
                sx={{
                    mb: 1.5,
                    border: '1px solid rgba(215, 204, 200, 0.08)',
                    bgcolor: 'rgba(0,0,0,0.2)',
                    borderRadius: 4,
                    '& .MuiToggleButton-root': {
                        border: 'none',
                        px: 2,
                        py: 0.5,
                        borderRadius: 3,
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        color: 'text.secondary',
                        fontFamily: '"Outfit", sans-serif',
                        '&.Mui-selected': {
                            bgcolor: 'rgba(229, 169, 95, 0.15)',
                            color: 'primary.main',
                            '&:hover': { bgcolor: 'rgba(229, 169, 95, 0.25)' }
                        }
                    }
                }}
            >
                <ToggleButton value="pendulum">PÉNDULO</ToggleButton>
                <ToggleButton value="orchestra">COMPÁS</ToggleButton>
            </ToggleButtonGroup>

            {/* Canvas Main Screen */}
            <Box sx={{
                width: '100%',
                height: 180,
                borderRadius: 4,
                bgcolor: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(215, 204, 200, 0.04)',
                position: 'relative',
                overflow: 'hidden',
                mb: 1.5
            }}>
                <canvas
                    ref={canvasRef}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'block'
                    }}
                />
            </Box>

            {/* Beat indicators bar */}
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center" sx={{ width: '100%' }}>
                {beatDots}
            </Stack>

            {/* Speed Trainer indicators */}
            {barIndicators}
        </Box>
    );
}
