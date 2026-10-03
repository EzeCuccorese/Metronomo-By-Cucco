import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStudyTasks, isTaskList, TASKS_KEY, ACTIVE_TASK_KEY } from './useStudyTasks';
import type { Task } from './useStudyTasks';
import { STORAGE_PREFIX } from '../state/storage';

const sample = (over: Partial<Task> = {}): Task => ({
    id: 't1', title: 'Escalas', estimatedPomodoros: 2, completedPomodoros: 0, isCompleted: false,
    subtasks: [{ id: 's1', title: 'Mayores', completed: false }, { id: 's2', title: 'Menores', completed: false }],
    ...over,
});

describe('useStudyTasks', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
        vi.setSystemTime(1_700_000_000_000);
    });
    afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

    it('starts empty', () => {
        const { result } = renderHook(() => useStudyTasks());
        expect(result.current.tasks).toEqual([]);
        expect(result.current.activeTaskId).toBeNull();
    });

    it('adds a task with parsed subtasks and clamped estimate', () => {
        const { result } = renderHook(() => useStudyTasks());
        let ok = false;
        act(() => { ok = result.current.addTask('Escalas', 0, 'Mayores\n\n  Arpegios  \n   '); });
        expect(ok).toBe(true);
        expect(result.current.tasks).toEqual([{
            id: expect.any(String), title: 'Escalas', estimatedPomodoros: 1, completedPomodoros: 0, isCompleted: false,
            subtasks: [
                { id: expect.any(String), title: 'Mayores', completed: false },
                { id: expect.any(String), title: 'Arpegios', completed: false },
            ],
        }]);
    });

    it('uses unique ids even within the same millisecond', () => {
        const { result } = renderHook(() => useStudyTasks());
        act(() => { result.current.addTask('A', 1, 'x\ny'); result.current.addTask('B', 1, ''); });
        const ids = result.current.tasks.flatMap(t => [t.id, ...t.subtasks.map(s => s.id)]);
        expect(new Set(ids).size).toBe(4);
    });

    it('sanitizes non-finite and fractional estimates', () => {
        const { result } = renderHook(() => useStudyTasks());
        act(() => { result.current.addTask('A', NaN, ''); });
        act(() => { result.current.addTask('B', 2.7, ''); });
        act(() => { result.current.addTask('C', Infinity, ''); });
        expect(result.current.tasks.map(t => t.estimatedPomodoros)).toEqual([1, 2, 1]);
    });

    it('keeps the requested estimate when above 1', () => {
        const { result } = renderHook(() => useStudyTasks());
        act(() => { result.current.addTask('X', 4, ''); });
        expect(result.current.tasks[0].estimatedPomodoros).toBe(4);
        expect(result.current.tasks[0].subtasks).toEqual([]);
    });

    it('stores the title without surrounding whitespace', () => {
        const { result } = renderHook(() => useStudyTasks());
        act(() => { result.current.addTask('  Escalas  ', 1, ''); });
        expect(result.current.tasks[0].title).toBe('Escalas');
    });

    it('rejects empty or whitespace-only titles', () => {
        const { result } = renderHook(() => useStudyTasks());
        let ok = true;
        act(() => { ok = result.current.addTask('   ', 1, 'a'); });
        expect(ok).toBe(false);
        act(() => { ok = result.current.addTask('', 1, ''); });
        expect(ok).toBe(false);
        expect(result.current.tasks).toEqual([]);
    });

    it('deletes a task and clears it when active', () => {
        localStorage.setItem(STORAGE_PREFIX + TASKS_KEY, JSON.stringify([sample(), sample({ id: 't2' })]));
        localStorage.setItem(STORAGE_PREFIX + ACTIVE_TASK_KEY, JSON.stringify('t1'));
        const { result } = renderHook(() => useStudyTasks());
        act(() => result.current.deleteTask('t1'));
        expect(result.current.tasks.map(t => t.id)).toEqual(['t2']);
        expect(result.current.activeTaskId).toBeNull();
    });

    it('keeps the active task when deleting another one', () => {
        localStorage.setItem(STORAGE_PREFIX + TASKS_KEY, JSON.stringify([sample(), sample({ id: 't2' })]));
        localStorage.setItem(STORAGE_PREFIX + ACTIVE_TASK_KEY, JSON.stringify('t1'));
        const { result } = renderHook(() => useStudyTasks());
        act(() => result.current.deleteTask('t2'));
        expect(result.current.activeTaskId).toBe('t1');
    });

    it('toggles a single subtask', () => {
        localStorage.setItem(STORAGE_PREFIX + TASKS_KEY, JSON.stringify([sample(), sample({ id: 't2' })]));
        const { result } = renderHook(() => useStudyTasks());
        act(() => result.current.toggleSubtask('t1', 's1'));
        expect(result.current.tasks[0].subtasks.map(s => s.completed)).toEqual([true, false]);
        expect(result.current.tasks[1].subtasks.map(s => s.completed)).toEqual([false, false]);
        act(() => result.current.toggleSubtask('t1', 's1'));
        expect(result.current.tasks[0].subtasks[0].completed).toBe(false);
    });

    it('completing a task completes all subtasks, and reopening clears them', () => {
        localStorage.setItem(STORAGE_PREFIX + TASKS_KEY, JSON.stringify([sample(), sample({ id: 't2' })]));
        const { result } = renderHook(() => useStudyTasks());
        act(() => result.current.toggleTaskComplete('t1'));
        expect(result.current.tasks[0].isCompleted).toBe(true);
        expect(result.current.tasks[0].subtasks.every(s => s.completed)).toBe(true);
        expect(result.current.tasks[1].isCompleted).toBe(false);
        act(() => result.current.toggleTaskComplete('t1'));
        expect(result.current.tasks[0].isCompleted).toBe(false);
        expect(result.current.tasks[0].subtasks.every(s => !s.completed)).toBe(true);
    });

    it('records a pomodoro only on the active task', () => {
        localStorage.setItem(STORAGE_PREFIX + TASKS_KEY, JSON.stringify([sample(), sample({ id: 't2' })]));
        const { result } = renderHook(() => useStudyTasks());
        act(() => result.current.recordPomodoro());
        expect(result.current.tasks.map(t => t.completedPomodoros)).toEqual([0, 0]);
        act(() => result.current.setActiveTaskId('t2'));
        act(() => result.current.recordPomodoro());
        act(() => result.current.recordPomodoro());
        expect(result.current.tasks.map(t => t.completedPomodoros)).toEqual([0, 2]);
    });

    it('persists tasks and the active task under the same storage keys', () => {
        const { result, unmount } = renderHook(() => useStudyTasks());
        act(() => { result.current.addTask('Escalas', 2, 'a'); });
        const id = result.current.tasks[0].id;
        act(() => result.current.setActiveTaskId(id));
        expect(JSON.parse(localStorage.getItem(STORAGE_PREFIX + TASKS_KEY)!)).toHaveLength(1);
        expect(JSON.parse(localStorage.getItem(STORAGE_PREFIX + ACTIVE_TASK_KEY)!)).toBe(id);
        unmount();

        const again = renderHook(() => useStudyTasks());
        expect(again.result.current.tasks[0].title).toBe('Escalas');
        expect(again.result.current.activeTaskId).toBe(id);
    });

    it('falls back to defaults on corrupt stored data', () => {
        localStorage.setItem(STORAGE_PREFIX + TASKS_KEY, JSON.stringify([{ id: 1 }]));
        localStorage.setItem(STORAGE_PREFIX + ACTIVE_TASK_KEY, JSON.stringify(42));
        const { result } = renderHook(() => useStudyTasks());
        expect(result.current.tasks).toEqual([]);
        expect(result.current.activeTaskId).toBeNull();
    });
});

describe('isTaskList', () => {
    it('validates task shape', () => {
        expect(isTaskList([sample()])).toBe(true);
        expect(isTaskList([])).toBe(true);
        expect(isTaskList('x')).toBe(false);
        expect(isTaskList([{ ...sample(), subtasks: [{ id: 1 }] }])).toBe(false);
        expect(isTaskList([{ ...sample(), isCompleted: 'no' }])).toBe(false);
    });
});
