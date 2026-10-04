import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const getOutputLatency = vi.fn(() => 0);
vi.mock('../../audio/AudioContextManager', () => ({ default: { getInstance: () => ({ getOutputLatency }) } }));

import { BluetoothNotice } from '../BluetoothNotice';

describe('BluetoothNotice', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('recommends wired headphones and stays dismissed after closing', () => {
        const { unmount } = render(<BluetoothNotice isPlaying={false} />);
        expect(screen.getByRole('note')).toHaveTextContent(/Bluetooth/);
        expect(screen.getByRole('note')).toHaveTextContent(/con cable o el parlante/);

        fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso de Bluetooth' }));
        expect(screen.queryByRole('note')).toBeNull();
        unmount();

        render(<BluetoothNotice isPlaying={true} />);
        expect(screen.queryByRole('note')).toBeNull();
    });

    it('shows the measured output latency only when it is high', () => {
        getOutputLatency.mockReturnValue(0.02);
        const { rerender } = render(<BluetoothNotice isPlaying={true} />);
        act(() => { vi.advanceTimersByTime(500); });
        expect(screen.getByRole('note')).not.toHaveTextContent(/Latencia/);

        getOutputLatency.mockReturnValue(0.18);
        rerender(<BluetoothNotice isPlaying={false} />);
        rerender(<BluetoothNotice isPlaying={true} />);
        act(() => { vi.advanceTimersByTime(500); });
        expect(screen.getByRole('note')).toHaveTextContent('Latencia de salida actual: 180 ms.');
    });
});
