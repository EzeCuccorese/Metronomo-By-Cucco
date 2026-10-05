import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BpmStepButton } from '../components/TransportControls';

describe('BpmStepButton (hold to repeat)', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const press = () => fireEvent.pointerDown(screen.getByRole('button', { name: 'Subir tempo' }), { button: 0 });
    const release = () => fireEvent.pointerUp(screen.getByRole('button', { name: 'Subir tempo' }));

    it('steps once on a tap', () => {
        const onStep = vi.fn();
        render(<BpmStepButton direction={1} onStep={onStep} />);
        press();
        release();
        act(() => { vi.advanceTimersByTime(2000); });
        expect(onStep).toHaveBeenCalledTimes(1);
        expect(onStep).toHaveBeenCalledWith(1);
    });

    it('repeats while held and speeds up to steps of 5', () => {
        const onStep = vi.fn();
        render(<BpmStepButton direction={1} onStep={onStep} />);
        press();
        act(() => { vi.advanceTimersByTime(380 + 130 * 3); });
        expect(onStep.mock.calls.length).toBeGreaterThan(2);
        act(() => { vi.advanceTimersByTime(3000); });
        expect(onStep).toHaveBeenCalledWith(5);
        release();
        const calls = onStep.mock.calls.length;
        act(() => { vi.advanceTimersByTime(2000); });
        expect(onStep.mock.calls.length).toBe(calls);
    });

    it('goes down with the minus direction', () => {
        const onStep = vi.fn();
        render(<BpmStepButton direction={-1} onStep={onStep} />);
        fireEvent.pointerDown(screen.getByRole('button', { name: 'Bajar tempo' }), { button: 0 });
        expect(onStep).toHaveBeenCalledWith(-1);
    });

    it('stops when the pointer leaves, and ignores secondary buttons', () => {
        const onStep = vi.fn();
        render(<BpmStepButton direction={1} onStep={onStep} />);
        fireEvent.pointerDown(screen.getByRole('button', { name: 'Subir tempo' }), { button: 2 });
        expect(onStep).not.toHaveBeenCalled();
        press();
        fireEvent.pointerLeave(screen.getByRole('button', { name: 'Subir tempo' }));
        const calls = onStep.mock.calls.length;
        act(() => { vi.advanceTimersByTime(1500); });
        expect(onStep.mock.calls.length).toBe(calls);
    });

    it('steps once per key press from the keyboard and does not double step on click', () => {
        const onStep = vi.fn();
        render(<BpmStepButton direction={1} onStep={onStep} />);
        const button = screen.getByRole('button', { name: 'Subir tempo' });
        fireEvent.keyDown(button, { key: 'Enter' });
        fireEvent.keyDown(button, { key: ' ', repeat: true });
        fireEvent.keyDown(button, { key: 'a' });
        fireEvent.click(button);
        expect(onStep).toHaveBeenCalledTimes(1);
    });

    it('steps once for a bare click (screen readers send no pointer or key events)', () => {
        const onStep = vi.fn();
        render(<BpmStepButton direction={1} onStep={onStep} />);
        fireEvent.click(screen.getByRole('button', { name: 'Subir tempo' }));
        expect(onStep).toHaveBeenCalledTimes(1);
        // Much later, another bare click is another step.
        act(() => { vi.advanceTimersByTime(2000); });
        fireEvent.click(screen.getByRole('button', { name: 'Subir tempo' }));
        expect(onStep).toHaveBeenCalledTimes(2);
    });

    it('does not let Space scroll the page', () => {
        render(<BpmStepButton direction={1} onStep={vi.fn()} />);
        const notPrevented = fireEvent.keyDown(screen.getByRole('button', { name: 'Subir tempo' }), { key: ' ' });
        expect(notPrevented).toBe(false);
    });

    it('stops repeating when it becomes disabled while held', () => {
        const onStep = vi.fn();
        const { rerender } = render(<BpmStepButton direction={1} onStep={onStep} />);
        press();
        rerender(<BpmStepButton direction={1} onStep={onStep} disabled />);
        const calls = onStep.mock.calls.length;
        act(() => { vi.advanceTimersByTime(2000); });
        expect(onStep.mock.calls.length).toBe(calls);
    });

    it('does nothing while disabled', () => {
        const onStep = vi.fn();
        render(<BpmStepButton direction={1} onStep={onStep} disabled />);
        press();
        expect(onStep).not.toHaveBeenCalled();
    });
});
