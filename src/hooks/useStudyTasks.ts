import { useCallback } from 'react';
import { usePersistentState } from './usePersistentState';
import { isBoolean, isNumber, isPlainObject, isString } from '../state/storage';

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

export const TASKS_KEY = 'study.tasks';
export const ACTIVE_TASK_KEY = 'study.activeTask';

const isSubTask = (v: unknown): v is SubTask =>
    isPlainObject(v) && isString(v.id) && isString(v.title) && isBoolean(v.completed);
const isTask = (v: unknown): v is Task =>
    isPlainObject(v) && isString(v.id) && isString(v.title) && Array.isArray(v.subtasks) && v.subtasks.every(isSubTask) &&
    isNumber(v.estimatedPomodoros) && isNumber(v.completedPomodoros) && isBoolean(v.isCompleted);
export const isTaskList = (v: unknown): v is Task[] => Array.isArray(v) && v.every(isTask);
const isNullableString = (v: unknown): v is string | null => v === null || isString(v);

/**
 * Persistent study plan: task list + the task that earns pomodoros.
 * (ES) Plan de estudio persistente.
 */
export function useStudyTasks() {
    const [tasks, setTasks] = usePersistentState<Task[]>(TASKS_KEY, [], isTaskList);
    const [activeTaskId, setActiveTaskId] = usePersistentState<string | null>(ACTIVE_TASK_KEY, null, isNullableString);

    /** Adds a task; returns false (and changes nothing) when the title is blank. */
    const addTask = useCallback((title: string, pomodoros: number, subtasksText: string): boolean => {
        if (!title.trim()) return false;
        const now = Date.now();
        const subtasks = subtasksText.split('\n').filter(s => s.trim()).map((s, idx) => ({
            id: now + '-' + idx,
            title: s.trim(),
            completed: false,
        }));
        const task: Task = {
            id: now.toString(),
            title: title.trim(),
            subtasks,
            estimatedPomodoros: Math.max(1, pomodoros),
            completedPomodoros: 0,
            isCompleted: false,
        };
        setTasks(prev => [...prev, task]);
        return true;
    }, [setTasks]);

    const deleteTask = useCallback((id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id));
        setActiveTaskId(current => (current === id ? null : current));
    }, [setTasks, setActiveTaskId]);

    const toggleSubtask = useCallback((taskId: string, subId: string) => {
        setTasks(prev => prev.map(t => t.id !== taskId ? t : {
            ...t,
            subtasks: t.subtasks.map(s => s.id === subId ? { ...s, completed: !s.completed } : s),
        }));
    }, [setTasks]);

    const toggleTaskComplete = useCallback((taskId: string) => {
        setTasks(prev => prev.map(t => t.id !== taskId ? t : {
            ...t,
            isCompleted: !t.isCompleted,
            subtasks: t.subtasks.map(s => ({ ...s, completed: !t.isCompleted })),
        }));
    }, [setTasks]);

    /** Credits one finished pomodoro to the active task (no-op without one). */
    const recordPomodoro = useCallback(() => {
        if (!activeTaskId) return;
        setTasks(prev => prev.map(t => t.id === activeTaskId ? { ...t, completedPomodoros: t.completedPomodoros + 1 } : t));
    }, [activeTaskId, setTasks]);

    return { tasks, activeTaskId, setActiveTaskId, addTask, deleteTask, toggleSubtask, toggleTaskComplete, recordPomodoro };
}
