import { useState } from 'react';
import { usePomodoro } from '../hooks/usePomodoro';
import type { TimerMode } from '../hooks/usePomodoro';
import { useStudyTasks } from '../hooks/useStudyTasks';

export interface StudySessionState {
    tasksHook: ReturnType<typeof useStudyTasks>;
    pomodoro: ReturnType<typeof usePomodoro>;
    notice: string | null;
    clearNotice: () => void;
}

/** Shared hook so Study / Pomodoro runs continuously whether pinned or popped over from top-left. */
export function useStudySession(onStopRequest?: () => void): StudySessionState {
    const [notice, setNotice] = useState<string | null>(null);
    const tasksHook = useStudyTasks();
    const pomodoro = usePomodoro((mode: TimerMode) => {
        if (mode === 'pomodoro') {
            tasksHook.recordPomodoro();
            setNotice('¡Pomodoro completado! Tomate un descanso.');
        } else {
            setNotice('Descanso terminado. ¡A practicar!');
        }
        onStopRequest?.();
    });
    return { tasksHook, pomodoro, notice, clearNotice: () => setNotice(null) };
}
