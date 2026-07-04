// Web Worker for Metronome Clock
// Runs timer in a background thread to avoid main thread blocking (UI jank)

let timerID: number | null = null;
let interval = 25.0; // Default ms

self.onmessage = (e: MessageEvent) => {
    const { action, interval: newInterval } = e.data;

    if (action === 'start') {
        if (typeof newInterval === 'number') {
            interval = newInterval;
        }
        if (timerID !== null) clearInterval(timerID);
        timerID = self.setInterval(() => {
            self.postMessage('tick');
        }, interval);
    }
    else if (action === 'stop') {
        if (timerID !== null) {
            clearInterval(timerID);
            timerID = null;
        }
    }
    else if (action === 'interval') {
        if (typeof newInterval === 'number') {
            interval = newInterval;
            if (timerID !== null) {
                clearInterval(timerID);
                timerID = self.setInterval(() => {
                    self.postMessage('tick');
                }, interval);
            }
        }
    }
};

export { };
