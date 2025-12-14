import { Box, Stack, Typography } from '@mui/material';
import CircleIcon from '@mui/icons-material/Circle';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';

interface ConductorVisualProps {
    pattern: RhythmPattern;
    currentStepIndex: number;
    trainerActive: boolean;
    currentBarProgress: number;
    totalBarsInterval: number;
}

const getCountingText = (stepIndex: number, subdivision: number, mode: RhythmPattern['countingMode'], timeSignature: [number, number]): string => {
    // Basic calculation of beat and sub-beat
    // e.g. 16 steps, 4/4. 4 steps per beat.
    const beats = timeSignature[0];
    const stepsPerBeat = subdivision / beats;

    const beatNum = Math.floor(stepIndex / stepsPerBeat) + 1; // 1-based Beat
    const subIndex = stepIndex % stepsPerBeat; // 0-based sub index within beat

    if (mode === 'numbers') {
        // Just counts 1, 2, 3, 4 on the beat. Subdivisions empty? Or "and"? 
        // Let's return Beat number on beat, "and" on half? 
        // User asked for "numbers". Simple matching.
        return subIndex === 0 ? `${beatNum}` : '';
    }

    if (mode === '1&2&') {
        if (subIndex === 0) return `${beatNum}`;
        // Assuming 8th notes (2 steps per beat)
        if (subIndex === 0.5 * stepsPerBeat) return '&';
        return '';
    }

    if (mode === '1e&a') {
        // 16th notes (4 steps per beat)
        // 0 -> 1
        // 1 -> e
        // 2 -> &
        // 3 -> a
        // We need to map 'subIndex' relative to stepsPerBeat (which should be 4)
        // If sub=16, stepsPerBeat=4.
        if (subIndex === 0) return `${beatNum}`;
        if (subIndex === 1) return 'e';
        if (subIndex === 2) return '&';
        if (subIndex === 3) return 'a';
    }

    if (mode === 'triplet_1la2la') {
        // Triplets: 1 la le (or 1 trip let)
        // stepsPerBeat should be 3.
        if (subIndex === 0) return `${beatNum}`;
        if (subIndex === 1) return 'la'; // or 'trip'
        if (subIndex === 2) return 'le'; // or 'let'
    }

    if (mode === 'mnemonics_chacarera') {
        // MA de RA PAR che PAR
        // 6/8. Steps 0-5.
        // But Chacarera is 3/4 visually? [3,4]
        // stepsPerBeat = 6 / 3 = 2.
        // Wait, Chacarera subdivision is 6. TimeSig [3,4]. Beats=3.
        // Steps per beat = 2.
        // 0 (Beat 1) -> MA
        // 1          -> de
        // 2 (Beat 2) -> RA
        // 3          -> PAR
        // 4 (Beat 3) -> che
        // 5          -> PAR

        // Map global step index (0-5) directly?
        const mapping = ['MA', 'de', 'RA', 'PAR', 'che', 'PAR'];
        return mapping[stepIndex % 6] || '';
    }

    return '';
};

export default function ConductorVisual({
    pattern,
    currentStepIndex,
    trainerActive,
    currentBarProgress,
    totalBarsInterval
}: ConductorVisualProps) {

    const { subdivision, timeSignature, countingMode } = pattern;

    // Calculate current beat (1-based)
    const beats = timeSignature[0];
    const stepsPerBeat = subdivision / beats;
    const currentBeatIndex = Math.floor(currentStepIndex / stepsPerBeat); // 0-based beat index

    // Check for Accent (High Velocity on ANY instrument at current step)
    const currentStepData = pattern.steps.filter(s => s.step === (currentStepIndex + 1));
    const maxVelocity = currentStepData.reduce((acc, s) => Math.max(acc, s.velocity), 0);
    const isAccent = maxVelocity > 0.8;

    // Current Counting Text
    const countText = getCountingText(currentStepIndex, subdivision, countingMode, timeSignature);

    // Beat Dots Generation
    // Using fixed width container to prevent jitter
    const beatDots = Array.from({ length: beats }).map((_, idx) => {
        const isActiveBeat = idx === currentBeatIndex;

        return (
            <Box key={idx} sx={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: 60, // Wider for text
                height: 80,
                justifyContent: 'center'
            }}>
                <CircleIcon sx={{
                    fontSize: 24,
                    color: isActiveBeat ? 'secondary.main' : 'text.disabled',
                    transform: isActiveBeat ? (isAccent ? 'scale(1.8)' : 'scale(1.4)') : 'scale(1)',
                    transition: 'transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    filter: isActiveBeat ? (isAccent ? 'drop-shadow(0 0 15px #f50057)' : 'drop-shadow(0 0 10px #f48fb1)') : 'none'
                }} />

                <Typography variant="h6" sx={{
                    color: isActiveBeat ? 'white' : 'transparent',
                    fontWeight: 'bold',
                    mt: 1,
                    fontSize: '1.2rem',
                    textShadow: '0 0 5px rgba(0,0,0,0.5)'
                }}>
                    {isActiveBeat ? countText : (idx + 1)}
                </Typography>
            </Box>
        );
    });

    // Bar Progress Indicators (Only if Trainer Active)
    // Wrap indicators to multiple lines if many bars
    const barIndicators = trainerActive && totalBarsInterval > 1 ? (
        <Stack spacing={1} alignItems="center" sx={{ mt: 2, width: '100%' }}>
            <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                PROGRESO ({currentBarProgress + 1} / {totalBarsInterval})
            </Typography>
            <Box sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.5,
                justifyContent: 'center',
                width: '100%',
                maxHeight: 100, // Limit height
                overflowY: 'auto', // Scroll if REALLY massive
                px: 2
            }}>
                {Array.from({ length: totalBarsInterval }).map((_, idx) => {
                    const isCompleted = idx < currentBarProgress;
                    const isCurrent = idx === currentBarProgress;

                    return (
                        <Box key={idx} sx={{
                            width: 12, height: 6,
                            borderRadius: 4,
                            bgcolor: isCompleted ? 'secondary.main' : (isCurrent ? 'primary.main' : 'rgba(255,255,255,0.1)'),
                            boxShadow: isCurrent ? '0 0 8px #90caf9' : 'none',
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
            p: 2,
            bgcolor: '#1a1a1a',
            borderRadius: 4,
            border: '1px solid #333',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 160,
            width: '100%'
        }}>
            {/* Beat Counter */}
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                {beatDots}
            </Stack>

            {/* Bar Counter */}
            {barIndicators}
        </Box>
    );
}
