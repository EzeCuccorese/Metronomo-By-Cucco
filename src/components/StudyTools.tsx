import { useState } from 'react';
import {
    Box, Typography, Button, ButtonBase, Stack, Paper, IconButton,
    CircularProgress, Chip, List, ListItem, ListItemText,
    TextField, Checkbox, Dialog, DialogTitle,
    DialogContent, DialogActions,
    Collapse, Snackbar, Tooltip
} from '@mui/material';
import { formatTime } from '../hooks/usePomodoro';
import { useStudySession } from '../hooks/useStudySession';
import type { StudySessionState } from '../hooks/useStudySession';
import { usePlayback } from '../state/PlaybackContext';
import { Panel } from './Panel';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';

export type { SubTask, Task } from '../hooks/useStudyTasks';

export const TomatoIcon = ({ filled, size = 16 }: { filled: boolean; size?: number }) => (
    <Box
         component="span"
         sx={{
             width: size,
             height: size,
             display: 'inline-block',
             lineHeight: 0,
             mr: 0.5,
             filter: filled ? 'none' : 'grayscale(100%) opacity(0.45)',
             transform: filled ? 'scale(1)' : 'scale(0.9)',
             transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
         }}
    >
        <svg viewBox="0 0 24 24" fill={filled ? "#ef5350" : "#666"} xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8H9C9 6.34 10.34 5 12 5Z" />
            {/* Leaf accent */}
            <path d="M12 2C12 2 13 4 15 4" stroke="#81c784" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 2C12 2 11 4 9 4" stroke="#81c784" strokeWidth="2" strokeLinecap="round" />
        </svg>
    </Box>
);

interface StudyToolsProps {
    onStopRequest?: () => void;
    /** Optional externally managed session so timer keeps running across pop-up / pin toggles. */
    session?: StudySessionState;
    /** Whether Study is currently pinned into the main workspace. */
    pinned?: boolean;
    /** Pin / unpin handler for top-left pop-up vs docked panel. */
    onTogglePin?: () => void;
    /** When true, renders the inner content directly (for the top-left Popover). */
    bare?: boolean;
}

function useStudyPanelProps({ onStopRequest, session, pinned, onTogglePin }: Omit<StudyToolsProps, 'bare'>) {
    const totalBarsPracticed = usePlayback(s => s.totalBars);
    const localSession = useStudySession(onStopRequest);
    const activeSession = session ?? localSession;
    const {
        tasksHook: { tasks, activeTaskId, setActiveTaskId, addTask, deleteTask, toggleSubtask, toggleTaskComplete },
        pomodoro: { mode: timerType, timeLeft, isActive, progress, toggle: toggleTimer, reset: resetTimer, setMode },
        notice,
        clearNotice,
    } = activeSession;
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskPomodoros, setNewTaskPomodoros] = useState('1');
    const [newTaskSubtasks, setNewTaskSubtasks] = useState<string>('');

    const handleAddTask = () => {
        const parsedPomodoros = Math.max(1, Math.min(10, Number(newTaskPomodoros) || 1));
        if (!addTask(newTaskTitle, parsedPomodoros, newTaskSubtasks)) return;
        setNewTaskTitle('');
        setNewTaskSubtasks('');
        setNewTaskPomodoros('1');
        setIsDialogOpen(false);
    };

    const pinButton = onTogglePin ? (
        <Tooltip title={pinned ? 'Desfijar estudio al acceso superior' : 'Fijar estudio arriba a la izquierda'}>
            <IconButton
                size="small"
                onClick={onTogglePin}
                aria-label={pinned ? 'Desfijar estudio' : 'Fijar estudio'}
                aria-pressed={pinned}
                data-testid="study-pin-toggle"
                sx={{ color: pinned ? 'primary.main' : 'text.secondary' }}
            >
                {pinned ? <PushPinIcon fontSize="small" /> : <PushPinOutlinedIcon fontSize="small" />}
            </IconButton>
        </Tooltip>
    ) : null;

    return { totalBarsPracticed, tasks, activeTaskId, setActiveTaskId, deleteTask, toggleSubtask, toggleTaskComplete, expandedTaskId, setExpandedTaskId, timerType, timeLeft, isActive, progress, toggleTimer, resetTimer, setMode, isDialogOpen, setIsDialogOpen, newTaskTitle, setNewTaskTitle, newTaskPomodoros, setNewTaskPomodoros, newTaskSubtasks, setNewTaskSubtasks, handleAddTask, notice, clearNotice, pinButton };
}

export default function StudyTools({ onStopRequest, session, pinned, onTogglePin, bare = false }: StudyToolsProps) {
    const s = useStudyPanelProps({ onStopRequest, session, pinned, onTogglePin });
    const {
        totalBarsPracticed, tasks, activeTaskId, setActiveTaskId, deleteTask, toggleSubtask, toggleTaskComplete,
        expandedTaskId, setExpandedTaskId, timerType, timeLeft, isActive, progress, toggleTimer, resetTimer, setMode,
        isDialogOpen, setIsDialogOpen, newTaskTitle, setNewTaskTitle, newTaskPomodoros, setNewTaskPomodoros,
        newTaskSubtasks, setNewTaskSubtasks, handleAddTask, notice, clearNotice, pinButton,
    } = s;

    const body = (
        <>
        <Box sx={{
            display: 'grid', gap: { xs: 1.5, md: 2 }, alignContent: 'start', flex: 1, minHeight: 0,
            // Stacked on phones; timer | plan from tablets up.
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1.4fr)' },
            gridTemplateAreas: {
                xs: '"timer" "head" "list"',
                md: '"timer head" "timer list"',
            },
            gridTemplateRows: { md: 'auto minmax(0, 1fr)' },
        }}>

            {/* TIMER VISUAL */}
            <Box 
                className="retro-monospaced-screen" 
                sx={{ 
                    textAlign: 'center', 
                    gridArea: 'timer',
                    position: 'relative', 
                    p: 3, 
                    borderRadius: 3,
                    border: '2px solid rgba(var(--skin-accent-rgb), 0.3) !important',
                    boxShadow: 'inset 0 0 15px rgba(0,0,0,0.9), 0 0 10px rgba(var(--skin-accent-rgb), 0.15) !important'
                }}
            >
                <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', mb: 2 }}>
                    <Button size="small" variant={timerType === 'pomodoro' ? "contained" : "text"}
                        onClick={() => setMode('pomodoro')}
                        sx={{ 
                            color: timerType === 'pomodoro' ? 'var(--skin-accent-text)' : 'rgba(var(--skin-accent-rgb), 0.72)', 
                            bgcolor: timerType === 'pomodoro' ? 'var(--skin-accent)' : 'transparent', 
                            fontWeight: 'bold',
                            fontFamily: '"Outfit", sans-serif',
                            '&:hover': { bgcolor: timerType === 'pomodoro' ? 'var(--skin-accent-strong)' : 'rgba(var(--skin-accent-rgb), 0.1)' } 
                        }}
                    > Foco </Button>
                    <Button size="small" variant={timerType === 'break' ? "contained" : "text"}
                        onClick={() => setMode('break')}
                        sx={{ 
                            color: timerType === 'break' ? 'var(--skin-accent-text)' : 'rgba(var(--skin-accent-rgb), 0.72)', 
                            bgcolor: timerType === 'break' ? '#f97316' : 'transparent', 
                            fontWeight: 'bold',
                            fontFamily: '"Outfit", sans-serif',
                            '&:hover': { bgcolor: timerType === 'break' ? '#fb923c' : 'rgba(var(--skin-accent-rgb), 0.1)' } 
                        }}
                    > Descanso </Button>
                </Stack>

                <Box sx={{ position: 'relative', display: 'inline-flex', mb: 2 }}>
                    {/* Background Track */}
                    <CircularProgress variant="determinate" value={100} size={140} thickness={1.2} aria-hidden sx={{ color: '#1e2636', position: 'absolute' }} />
                    <CircularProgress
                        aria-label="Progreso del temporizador"
                        variant="determinate"
                        value={progress}
                        size={140}
                        thickness={4.5}
                        sx={{
                            color: timerType === 'pomodoro' ? 'var(--skin-accent)' : '#ff6d00',
                            filter: `drop-shadow(0 0 8px ${timerType === 'pomodoro' ? 'rgba(var(--skin-accent-rgb), 0.5)' : 'rgba(255, 109, 0, 0.5)'})`,
                            transition: 'all 1s linear',
                            strokeLinecap: 'round'
                        }}
                    />
                    <Box sx={{ top: 0, left: 0, bottom: 0, right: 0, position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                        <TomatoIcon filled={true} size={28} />
                        <Typography variant="h4" sx={{ fontWeight: 'bold', fontFamily: '"Share Tech Mono", monospace', mt: 1, color: 'var(--skin-accent)', textShadow: '0 0 6px rgba(var(--skin-accent-rgb), 0.6)' }}>
                            {formatTime(timeLeft)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(var(--skin-accent-rgb), 0.5)', fontWeight: 'bold', letterSpacing: '0.08em', fontSize: '0.65rem' }}>
                            {isActive ? 'CORRIENDO' : 'PAUSADO'}
                        </Typography>
                    </Box>
                </Box>

                {/* Outlined, tomato-coloured and labelled: it must not read as a second Play of the metronome. */}
                <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'center', alignItems: 'center' }}>
                    <Button
                        onClick={toggleTimer}
                        aria-label={isActive ? 'Pausar temporizador' : 'Iniciar temporizador'}
                        variant="outlined"
                        startIcon={<TomatoIcon filled={true} size={18} />}
                        sx={{
                            minWidth: 132, minHeight: 44, borderRadius: 2, fontWeight: 800, textTransform: 'none',
                            color: isActive ? 'text.primary' : '#ff8a80', borderColor: isActive ? 'rgba(255,255,255,0.3)' : '#ff8a80', borderWidth: 2,
                            '&:hover': { borderWidth: 2, bgcolor: 'rgba(239, 83, 80, 0.12)' },
                        }}
                    >
                        {isActive ? 'Pausar' : 'Iniciar'}
                    </Button>
                    <IconButton onClick={resetTimer} aria-label="Reiniciar temporizador" sx={{ color: 'text.secondary' }}><RefreshIcon /></IconButton>
                </Stack>
                <Chip
                    size="small"
                    variant="outlined"
                    sx={{ mt: 2, color: 'primary.main', borderColor: 'rgba(var(--skin-accent-rgb), 0.4)' }}
                    label={<><span data-testid="bars-practiced">{totalBarsPracticed}</span> {totalBarsPracticed === 1 ? 'compás practicado' : 'compases practicados'}</>}
                />
            </Box>

            {/* TASK LIST HEADER */}
            <Stack direction="row" sx={{ gridArea: 'head', justifyContent: 'space-between', alignItems: 'center', px: 1 }}>
                <Typography variant="overline" sx={{ color: 'text.secondary' }}>MI PLAN DE ESTUDIO</Typography>
                <IconButton size="small" color="primary" aria-label="Agregar tarea" onClick={() => setIsDialogOpen(true)}><AddIcon /></IconButton>
            </Stack>

            {/* TASK LIST */}
            <Box sx={{ gridArea: 'list', overflowY: 'auto', minHeight: 0, maxHeight: { lg: 320 } }}>
                {tasks.length === 0 && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textAlign: 'center', mt: 4 }}>
                        Agrega tareas (ej: "Escalas") y asígnales 🍅
                    </Typography>
                )}

                <List dense>
                    {tasks.map(task => {
                        const isExpanded = expandedTaskId === task.id;
                        const isActive = activeTaskId === task.id;

                        return (
                            <Paper key={task.id} variant="outlined" sx={{
                                mb: 1,
                                borderColor: isActive ? '#ef5350' : '#273244',
                                bgcolor: isActive ? 'rgba(239, 83, 80, 0.08)' : '#161c28',
                                transition: 'all 0.2s',
                                '&:hover': { borderColor: '#475569' }
                            }}>
                                <ListItem
                                    secondaryAction={
                                        <IconButton edge="end" size="small" aria-label={`Eliminar ${task.title}`} onClick={() => deleteTask(task.id)}>
                                            <DeleteIcon fontSize="small" color="disabled" />
                                        </IconButton>
                                    }
                                    sx={{ opacity: task.isCompleted ? 0.5 : 1 }}
                                >
                                    <IconButton size="small" aria-label={task.isCompleted ? `Reabrir ${task.title}` : `Completar ${task.title}`} onClick={() => toggleTaskComplete(task.id)} sx={{ mr: 1, color: task.isCompleted ? 'success.main' : 'text.disabled' }}>
                                        {task.isCompleted ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
                                    </IconButton>

                                    <ListItemText
                                        slotProps={{ secondary: { component: 'div' } }}
                                        primary={
                                            <ButtonBase
                                                onClick={() => setActiveTaskId(task.id)}
                                                sx={{
                                                    textAlign: 'left',
                                                    borderRadius: 0.5,
                                                    fontSize: '0.875rem',
                                                    lineHeight: 1.43,
                                                    textDecoration: task.isCompleted ? 'line-through' : 'none',
                                                    fontWeight: isActive ? 'bold' : 'normal',
                                                    color: isActive ? '#ffcccb' : 'text.primary',
                                                    '&:focus-visible': { outline: '2px solid #ffd54f', outlineOffset: 2 },
                                                }}
                                            >
                                                {task.title}
                                            </ButtonBase>
                                        }
                                        secondary={
                                            <Stack direction="row" spacing={0} sx={{ alignItems: 'center', mt: 0.5 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    {Array.from({ length: task.estimatedPomodoros }).map((_, i) => (
                                                        <TomatoIcon key={i} filled={i < task.completedPomodoros} size={14} />
                                                    ))}
                                                </Box>
                                                {task.subtasks.length > 0 && (
                                                    <IconButton size="small" aria-label={isExpanded ? 'Ocultar subtareas' : 'Ver subtareas'} aria-expanded={isExpanded} onClick={() => setExpandedTaskId(isExpanded ? null : task.id)} sx={{ p: 0, ml: 1 }}>
                                                        {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                                                    </IconButton>
                                                )}
                                            </Stack>
                                        }
                                    />
                                </ListItem>
                                {task.subtasks.length > 0 && (
                                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                        <List component="div" disablePadding sx={{ pl: 6, pr: 2, pb: 1 }}>
                                            {task.subtasks.map(sub => (
                                                <Stack key={sub.id} direction="row" spacing={1} sx={{ alignItems: 'center', py: 0.5 }}>
                                                    <Checkbox
                                                        size="small"
                                                        checked={sub.completed}
                                                        slotProps={{ input: { 'aria-label': sub.title } }}
                                                        onChange={() => toggleSubtask(task.id, sub.id)}
                                                        sx={{ p: 0.5, color: 'text.disabled', '&.Mui-checked': { color: '#ef5350' } }}
                                                    />
                                                    <Typography variant="caption" color={sub.completed ? 'text.disabled' : 'text.secondary'} sx={{ textDecoration: sub.completed ? 'line-through' : 'none' }}>
                                                        {sub.title}
                                                    </Typography>
                                                </Stack>
                                            ))}
                                        </List>
                                    </Collapse>
                                )}
                            </Paper>
                        );
                    })}
                </List>
            </Box>

        </Box>
            {/* ADD TASK DIALOG */}
            <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} fullWidth maxWidth="xs">
                <Box component="form" onSubmit={(e) => { e.preventDefault(); handleAddTask(); }}>
                    <DialogTitle>Nueva Tarea</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <TextField
                                autoFocus
                                label="Título de la tarea"
                                fullWidth
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                            />
                            <TextField
                                label="Estimación (Pomodoros)"
                                type="number"
                                fullWidth
                                slotProps={{ htmlInput: { min: 1, max: 10 } }}
                                value={newTaskPomodoros}
                                onChange={(e) => setNewTaskPomodoros(e.target.value)}
                            />
                            <TextField
                                label="Subtareas (una por línea)"
                                multiline
                                rows={3}
                                fullWidth
                                placeholder="- Escalas Mayores&#10;- Arpegios"
                                value={newTaskSubtasks}
                                onChange={(e) => setNewTaskSubtasks(e.target.value)}
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button type="button" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button type="submit" variant="contained" color="secondary">Agregar</Button>
                    </DialogActions>
                </Box>
            </Dialog>
            <Snackbar
                open={notice !== null}
                autoHideDuration={6000}
                onClose={clearNotice}
                message={notice}
            />
        </>
    );

    if (bare) {
        return (
            <Box sx={{ p: 2, width: { xs: 'min(92vw, 460px)', sm: 480 }, maxHeight: '78dvh', overflowY: 'auto' }}>
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                    <Typography variant="overline" sx={{ color: 'text.secondary', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box component="span" aria-hidden sx={{ width: 4, height: 14, borderRadius: 1, bgcolor: 'primary.main', opacity: 0.8 }} />
                        Estudio y Pomodoro
                    </Typography>
                    {pinButton}
                </Stack>
                {body}
            </Box>
        );
    }

    return (
        <Panel
            id="study"
            title="Estudio"
            actions={pinButton}
            summary={`${formatTime(timeLeft)} · ${isActive ? 'corriendo' : 'en pausa'} · ${tasks.length === 1 ? '1 tarea' : `${tasks.length} tareas`}`}
        >
            {body}
        </Panel>
    );
}
