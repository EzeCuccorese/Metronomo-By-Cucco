import { Box, Stack, Typography } from '@mui/material';
import CircleIcon from '@mui/icons-material/Circle';

interface ConductorVisualProps {
    subdivision: number;
    timeSignature: [number, number];
    currentStepIndex: number;
    trainerActive: boolean;
    currentBarProgress: number;
    totalBarsInterval: number;
}

export default function ConductorVisual({
    subdivision,
    timeSignature,
    currentStepIndex,
    trainerActive,
    currentBarProgress,
    totalBarsInterval
}: ConductorVisualProps) {

    // Calculate current beat (1-based)
    const beats = timeSignature[0];
    const stepsPerBeat = subdivision / beats;
    const currentBeatIndex = Math.floor(currentStepIndex / stepsPerBeat); // 0-based beat index

    // Beat Dots Generation
    // Using fixed width container to prevent jitter
    const beatDots = Array.from({ length: beats }).map((_, idx) => {
        const isActive = idx === currentBeatIndex;
        return (
            <Box key={idx} sx={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: 48, // Fixed width
                height: 60, // Fixed height
                justifyContent: 'center'
            }}>
                <CircleIcon sx={{
                    fontSize: 24,
                    color: isActive ? 'secondary.main' : 'text.disabled',
                    transform: isActive ? 'scale(1.4)' : 'scale(1)',
                    transition: 'transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    filter: isActive ? 'drop-shadow(0 0 10px #f48fb1)' : 'none'
                }} />
                <Typography variant="caption" sx={{
                    color: isActive ? 'white' : 'text.disabled',
                    fontWeight: 'bold',
                    mt: 1,
                    position: 'absolute',
                    bottom: 0
                }}>
                    {idx + 1}
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
            minHeight: 140,
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
