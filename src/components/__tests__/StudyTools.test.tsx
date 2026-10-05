import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within, waitFor } from '@testing-library/react';
import StudyTools from '../StudyTools';
import { STORAGE_PREFIX as P } from '../../state/storage';

const seed = [{
    id: 't1', title: 'Escalas', estimatedPomodoros: 2, completedPomodoros: 0, isCompleted: false,
    subtasks: [{ id: 's1', title: 'Mayores', completed: false }],
}];

describe('StudyTools', () => {
    beforeEach(() => { localStorage.clear(); });
    afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); });

    it('shows the empty state and an idle timer', () => {
        render(<StudyTools />);
        expect(screen.getByText(/Agrega tareas/)).toBeInTheDocument();
        expect(screen.getByText('25:00')).toBeInTheDocument();
        expect(screen.getByText('PAUSADO')).toBeInTheDocument();
    });

    it('toggles, resets and switches mode', () => {
        vi.useFakeTimers();
        render(<StudyTools />);
        fireEvent.click(screen.getByLabelText('Iniciar temporizador'));
        expect(screen.getByText('CORRIENDO')).toBeInTheDocument();
        act(() => { vi.advanceTimersByTime(5_000); });
        expect(screen.getByText('24:55')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Reiniciar temporizador'));
        expect(screen.getByText('25:00')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Descanso'));
        expect(screen.getByText('05:00')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Foco'));
        expect(screen.getByText('25:00')).toBeInTheDocument();
    });

    it('credits the active task, notifies and requests stop when focus ends', () => {
        vi.useFakeTimers();
        localStorage.setItem(P + 'study.tasks', JSON.stringify(seed));
        localStorage.setItem(P + 'study.activeTask', JSON.stringify('t1'));
        const onStop = vi.fn();
        render(<StudyTools onStopRequest={onStop} />);
        fireEvent.click(screen.getByLabelText('Iniciar temporizador'));
        act(() => { vi.advanceTimersByTime(1500_000); });
        expect(onStop).toHaveBeenCalledTimes(1);
        expect(screen.getByText('¡Pomodoro completado! Tomate un descanso.')).toBeInTheDocument();
        expect(JSON.parse(localStorage.getItem(P + 'study.tasks')!)[0].completedPomodoros).toBe(1);
    });

    it('announces the end of a break without crediting tasks', () => {
        vi.useFakeTimers();
        localStorage.setItem(P + 'study.tasks', JSON.stringify(seed));
        localStorage.setItem(P + 'study.activeTask', JSON.stringify('t1'));
        const onStop = vi.fn();
        render(<StudyTools onStopRequest={onStop} />);
        fireEvent.click(screen.getByText('Descanso'));
        fireEvent.click(screen.getByLabelText('Iniciar temporizador'));
        act(() => { vi.advanceTimersByTime(300_000); });
        expect(screen.getByText('Descanso terminado. ¡A practicar!')).toBeInTheDocument();
        expect(onStop).toHaveBeenCalledTimes(1);
        expect(JSON.parse(localStorage.getItem(P + 'study.tasks')!)).toEqual(seed);
    });

    it('adds a task through the dialog and ignores an empty title', () => {
        render(<StudyTools />);
        fireEvent.click(screen.getByLabelText('Agregar tarea'));
        fireEvent.click(screen.getByText('Agregar'));
        expect(screen.getByText('Nueva Tarea')).toBeInTheDocument();
        expect(screen.queryByLabelText(/Eliminar/)).toBeNull();

        const dialog = within(screen.getByRole('dialog'));
        fireEvent.change(dialog.getByLabelText('Título de la tarea'), { target: { value: 'Arpegios' } });
        fireEvent.change(dialog.getByLabelText('Estimación (Pomodoros)'), { target: { value: '3' } });
        fireEvent.change(dialog.getByLabelText('Subtareas (una por línea)'), { target: { value: 'Uno\nDos' } });
        fireEvent.click(dialog.getByText('Agregar'));
        expect(screen.getByText('Arpegios')).toBeInTheDocument();
        expect(screen.getByLabelText('Eliminar Arpegios')).toBeInTheDocument();
        expect(JSON.parse(localStorage.getItem(P + 'study.tasks')!)[0].subtasks).toHaveLength(2);
    });

    it('cancels the dialog', async () => {
        render(<StudyTools />);
        fireEvent.click(screen.getByLabelText('Agregar tarea'));
        fireEvent.click(screen.getByText('Cancelar'));
        await waitFor(() => expect(screen.queryByText('Nueva Tarea')).toBeNull());
    });

    it('selects, completes, expands subtasks and deletes', () => {
        localStorage.setItem(P + 'study.tasks', JSON.stringify(seed));
        render(<StudyTools />);
        fireEvent.click(screen.getByText('Escalas'));
        expect(localStorage.getItem(P + 'study.activeTask')).toBe('"t1"');

        fireEvent.click(screen.getByLabelText('Ver subtareas'));
        const box = screen.getByRole('checkbox');
        fireEvent.click(box);
        expect(box).toBeChecked();
        fireEvent.click(screen.getByLabelText('Ocultar subtareas'));

        fireEvent.click(screen.getByLabelText('Completar Escalas'));
        expect(screen.getByLabelText('Reabrir Escalas')).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Eliminar Escalas'));
        expect(screen.queryByText('Escalas')).toBeNull();
        expect(localStorage.getItem(P + 'study.activeTask')).toBe('null');
    });
});
