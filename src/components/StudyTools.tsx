import { useState, useEffect, useRef } from 'react';
import {
    Box, Typography, Button, Stack, Paper, IconButton,
    CircularProgress, List, ListItem, ListItemText,
    TextField, Checkbox, Dialog, DialogTitle,
    DialogContent, DialogActions, Divider,
    Collapse
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

export interface SubTask {
    id: string;
    title: string;
    completed: boolean;
}

export interface Task {
    id: string;
    title: string;
    subtasks: SubTask[];
    estimatedPomodoros: number;
    completedPomodoros: number;
    isCompleted: boolean;
}

const TomatoIcon = ({ filled, size = 16 }: { filled: boolean; size?: number }) => (
    <Box
        component="span"
        sx={{
            width: size,
            height: size,
            display: 'inline-block',
            lineHeight: 0,
            mr: 0.5,
            filter: filled ? 'none' : 'grayscale(100%) opacity(0.2)',
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
    totalBarsPracticed?: number;
}

export default function StudyTools({ onStopRequest, totalBarsPracticed = 0 }: StudyToolsProps) {
    // Timer State
    const [timerType, setTimerType] = useState<'pomodoro' | 'break'>('pomodoro');
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [isActive, setIsActive] = useState(false);

    // Task State
    const [tasks, setTasks] = useState<Task[]>([]);
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskPomodoros, setNewTaskPomodoros] = useState(1);
    const [newTaskSubtasks, setNewTaskSubtasks] = useState<string>('');

    const intervalRef = useRef<number | null>(null);

    // Timer Logic
    useEffect(() => {
        if (isActive) {
            intervalRef.current = window.setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 0) {
                        handleTimerComplete();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isActive, timerType]);

    const handleTimerComplete = () => {
        setIsActive(false);
        // Play sound?

        if (timerType === 'pomodoro') {
            // Deduct/Add progress to active task
            if (activeTaskId) {
                setTasks(prev => prev.map(t => {
                    if (t.id === activeTaskId) {
                        return { ...t, completedPomodoros: t.completedPomodoros + 1 };
                    }
                    return t;
                }));
            }
            alert("¡Pomodoro Completado! Tomate un descanso.");
            if (onStopRequest) onStopRequest(); // Stop Audio
        } else {
            alert("Descanso terminado. ¡A trabajar!");
            if (onStopRequest) onStopRequest();
        }
    };

    const toggleTimer = () => setIsActive(!isActive);
    const resetTimer = () => {
        setIsActive(false);
        setTimeLeft(timerType === 'pomodoro' ? 25 * 60 : 5 * 60);
    };
    const setMode = (mode: 'pomodoro' | 'break') => {
        setIsActive(false);
        setTimerType(mode);
        setTimeLeft(mode === 'pomodoro' ? 25 * 60 : 5 * 60);
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Task Management
    const addTask = () => {
        if (!newTaskTitle.trim()) return;

        const subItems = newTaskSubtasks.split('\n').filter(s => s.trim()).map((s, idx) => ({
            id: Date.now() + '-' + idx,
            title: s.trim(),
            completed: false
        }));

        const newTask: Task = {
            id: Date.now().toString(),
            title: newTaskTitle,
            subtasks: subItems,
            estimatedPomodoros: Math.max(1, newTaskPomodoros),
            completedPomodoros: 0,
            isCompleted: false
        };

        setTasks([...tasks, newTask]);
        setNewTaskTitle('');
        setNewTaskSubtasks('');
        setNewTaskPomodoros(1);
        setIsDialogOpen(false);
    };

    const deleteTask = (id: string) => {
        setTasks(tasks.filter(t => t.id !== id));
        if (activeTaskId === id) setActiveTaskId(null);
    };

    const toggleSubtask = (taskId: string, subId: string) => {
        setTasks(tasks.map(t => {
            if (t.id !== taskId) return t;
            return {
                ...t,
                subtasks: t.subtasks.map(s => s.id === subId ? { ...s, completed: !s.completed } : s)
            };
        }));
    };

    const toggleTaskComplete = (taskId: string) => {
        setTasks(tasks.map(t => {
            if (t.id !== taskId) return t;
            return {
                ...t,
                isCompleted: !t.isCompleted,
                subtasks: t.subtasks.map(s => ({ ...s, completed: !t.isCompleted }))
            };
        }));
    };

    const progress = 100 - (timeLeft / (timerType === 'pomodoro' ? 25 * 60 : 5 * 60)) * 100;

    return (
        <Paper sx={{ p: 2, bgcolor: '#1e1e1e', borderRadius: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>

            {/* TIMER VISUAL */}
            <Box sx={{ textAlign: 'center', mb: 2, position: 'relative', bgcolor: '#121212', p: 3, borderRadius: 3 }}>
                <Stack direction="row" spacing={1} justifyContent="center" mb={2}>
                    <Button size="small" variant={timerType === 'pomodoro' ? "contained" : "text"}
                        onClick={() => setMode('pomodoro')}
                        sx={{ color: timerType === 'pomodoro' ? 'white' : 'text.secondary', bgcolor: timerType === 'pomodoro' ? '#ef5350' : 'transparent', '&:hover': { bgcolor: '#e53935' } }}
                    > Focus </Button>
                    <Button size="small" variant={timerType === 'break' ? "contained" : "text"}
                        onClick={() => setMode('break')}
                        sx={{ color: timerType === 'break' ? 'black' : 'text.secondary', bgcolor: timerType === 'break' ? '#ffca28' : 'transparent', '&:hover': { bgcolor: '#ffc107' } }}
                    > Descanso </Button>
                </Stack>

                <Box sx={{ position: 'relative', display: 'inline-flex', mb: 2 }}>
                    {/* Background Track */}
                    <CircularProgress variant="determinate" value={100} size={140} thickness={1} sx={{ color: '#333', position: 'absolute' }} />
                    <CircularProgress
                        variant="determinate"
                        value={progress}
                        size={140}
                        thickness={4}
                        sx={{
                            color: timerType === 'pomodoro' ? '#ef5350' : '#ffa726',
                            filter: 'drop-shadow(0 0 10px rgba(239, 83, 80, 0.4))',
                            transition: 'all 1s linear',
                            strokeLinecap: 'round'
                        }}
                    />
                    <Box sx={{ top: 0, left: 0, bottom: 0, right: 0, position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                        <TomatoIcon filled={true} size={32} />
                        <Typography variant="h4" fontWeight="bold" sx={{ fontFamily: 'monospace', mt: 1 }}>{formatTime(timeLeft)}</Typography>
                        <Typography variant="caption" color="text.secondary">{isActive ? 'CORRIENDO' : 'PAUSADO'}</Typography>
                    </Box>
                </Box>

                <Stack direction="row" spacing={2} justifyContent="center">
                    <IconButton onClick={toggleTimer} size="large" sx={{
                        bgcolor: isActive ? 'rgba(255,255,255,0.1)' : (timerType === 'pomodoro' ? '#ef5350' : '#ffa726'),
                        color: 'white',
                        '&:hover': { transform: 'scale(1.1)' },
                        transition: 'all 0.2s'
                    }}>
                        {isActive ? <PauseIcon fontSize="large" /> : <PlayArrowIcon fontSize="large" />}
                    </IconButton>
                    <IconButton onClick={resetTimer} sx={{ color: 'text.secondary' }}><RefreshIcon /></IconButton>
                </Stack>
            </Box>

            {/* STATS */}
            <Paper sx={{ p: 1, my: 1, bgcolor: '#1a1a1a', border: '1px solid #333', textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" display="block">COMPASES PRACTICADOS</Typography>
                <Typography variant="h5" color="primary" fontWeight="bold">
                    {totalBarsPracticed}
                </Typography>
            </Paper>

            <Divider sx={{ my: 1, borderColor: '#333' }} />

            {/* TASK LIST HEADER */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1} px={1}>
                <Typography variant="overline" color="text.secondary">MI PLAN DE ESTUDIO</Typography>
                <IconButton size="small" color="primary" onClick={() => setIsDialogOpen(true)}><AddIcon /></IconButton>
            </Stack>

            {/* TASK LIST */}
            <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {tasks.length === 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 4 }}>
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
                                borderColor: isActive ? '#ef5350' : '#333',
                                bgcolor: isActive ? 'rgba(239, 83, 80, 0.08)' : '#1a1a1a',
                                transition: 'all 0.2s',
                                '&:hover': { borderColor: '#555' }
                            }}>
                                <ListItem
                                    secondaryAction={
                                        <IconButton edge="end" size="small" onClick={() => deleteTask(task.id)}>
                                            <DeleteIcon fontSize="small" color="disabled" />
                                        </IconButton>
                                    }
                                    sx={{ opacity: task.isCompleted ? 0.5 : 1 }}
                                >
                                    <IconButton size="small" onClick={() => toggleTaskComplete(task.id)} sx={{ mr: 1, color: task.isCompleted ? 'success.main' : 'text.disabled' }}>
                                        {task.isCompleted ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
                                    </IconButton>

                                    <ListItemText
                                        primary={
                                            <Typography variant="body2" sx={{
                                                textDecoration: task.isCompleted ? 'line-through' : 'none',
                                                cursor: 'pointer',
                                                fontWeight: isActive ? 'bold' : 'normal',
                                                color: isActive ? '#ffcccb' : 'text.primary'
                                            }}
                                                onClick={() => setActiveTaskId(task.id)}
                                            >
                                                {task.title}
                                            </Typography>
                                        }
                                        secondary={
                                            <Stack direction="row" spacing={0} alignItems="center" mt={0.5}>
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    {Array.from({ length: task.estimatedPomodoros }).map((_, i) => (
                                                        <TomatoIcon key={i} filled={i < task.completedPomodoros} size={14} />
                                                    ))}
                                                </Box>
                                                {task.subtasks.length > 0 && (
                                                    <IconButton size="small" onClick={() => setExpandedTaskId(isExpanded ? null : task.id)} sx={{ p: 0, ml: 1 }}>
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
                                                <Stack key={sub.id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.5 }}>
                                                    <Checkbox
                                                        size="small"
                                                        checked={sub.completed}
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

            {/* ADD TASK DIALOG */}
            <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} fullWidth maxWidth="xs">
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
                            inputProps={{ min: 1, max: 10 }}
                            value={newTaskPomodoros}
                            onChange={(e) => setNewTaskPomodoros(Number(e.target.value))}
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
                    <Button onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={addTask} variant="contained" color="secondary">Agregar</Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
}
