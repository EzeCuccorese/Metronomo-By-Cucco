import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Audio probe injected before the app loads.
 * Every connection to the real AudioContext destination is re-routed through a
 * tap (gain -> analyser -> destination), and a sampler records the output peak
 * against the audio clock. Tests can then assert what was actually *heard*.
 */
function installAudioProbe() {
    type Sample = { t: number; peak: number };
    const probe = {
        samples: [] as Sample[],
        ctx: null as AudioContext | null,
        starts: [] as { when: number; at: number; kind: string }[],
    };
    (window as unknown as { __probe: typeof probe }).__probe = probe;

    const originalConnect = AudioNode.prototype.connect as (this: AudioNode, ...args: unknown[]) => unknown;
    AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
        const target = args[0];
        if (target instanceof AudioDestinationNode && target.context instanceof AudioContext) {
            const ctx = target.context as AudioContext & { __tap?: GainNode };
            if (!ctx.__tap) {
                const tap = ctx.createGain();
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 512;
                originalConnect.call(tap, analyser);
                originalConnect.call(tap, target);
                ctx.__tap = tap;
                probe.ctx = ctx;
                const buffer = new Float32Array(analyser.fftSize);
                setInterval(() => {
                    if (ctx.state !== 'running') return;
                    analyser.getFloatTimeDomainData(buffer);
                    let peak = 0;
                    for (let i = 0; i < buffer.length; i++) peak = Math.max(peak, Math.abs(buffer[i]));
                    probe.samples.push({ t: ctx.currentTime, peak });
                    if (probe.samples.length > 20000) probe.samples.splice(0, 10000);
                }, 5);
            }
            args[0] = ctx.__tap;
        }
        return originalConnect.apply(this, args);
    } as typeof AudioNode.prototype.connect;

    const originalStart = AudioScheduledSourceNode.prototype.start;
    AudioScheduledSourceNode.prototype.start = function (this: AudioScheduledSourceNode, when?: number, ...rest: number[]) {
        if (this.context instanceof AudioContext) {
            probe.starts.push({ when: when ?? 0, at: this.context.currentTime, kind: this.constructor.name });
        }
        return (originalStart as (...a: unknown[]) => void).call(this, when, ...rest);
    } as typeof AudioScheduledSourceNode.prototype.start;
}

export class AudioProbe {
    constructor(private page: Page) { }

    /** Current audio clock (seconds). */
    async now(): Promise<number> {
        return this.page.evaluate(() => (window as unknown as { __probe: { ctx: AudioContext | null } }).__probe.ctx?.currentTime ?? 0);
    }

    /** Highest output sample measured between two audio-clock times. */
    async peakBetween(from: number, to: number): Promise<number> {
        return this.page.evaluate(([a, b]) => {
            const samples = (window as unknown as { __probe: { samples: { t: number; peak: number }[] } }).__probe.samples;
            return samples.filter(s => s.t >= a && s.t <= b).reduce((m, s) => Math.max(m, s.peak), 0);
        }, [from, to]);
    }

    /** Waits `seconds` of audio time and returns the peak heard meanwhile. */
    async listen(seconds: number): Promise<number> {
        const start = await this.now();
        await this.page.waitForFunction(
            ([t0, d]) => ((window as unknown as { __probe: { ctx: AudioContext | null } }).__probe.ctx?.currentTime ?? 0) >= t0 + d,
            [start, seconds],
            { timeout: (seconds + 10) * 1000 }
        );
        return this.peakBetween(start, start + seconds);
    }

    /** Peaks per audio-time window, useful to see *when* sound appears. */
    async onsetsAbove(threshold: number, from: number, to: number): Promise<number[]> {
        return this.page.evaluate(([th, a, b]) => {
            const samples = (window as unknown as { __probe: { samples: { t: number; peak: number }[] } }).__probe.samples;
            const onsets: number[] = [];
            let above = false;
            for (const s of samples) {
                if (s.t < a || s.t > b) continue;
                if (s.peak >= th && !above) onsets.push(s.t);
                above = s.peak >= th * 0.5 ? above || s.peak >= th : false;
            }
            return onsets;
        }, [threshold, from, to]);
    }
}

export const AUDIBLE = 0.02;
export const SILENT = 0.003;

export const test = base.extend<{ probe: AudioProbe; consoleErrors: string[] }>({
    consoleErrors: async ({ page }, use) => {
        const errors: string[] = [];
        page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
        page.on('pageerror', err => errors.push(err.message));
        await use(errors);
    },
    probe: async ({ page }, use) => {
        await page.addInitScript(installAudioProbe);
        await use(new AudioProbe(page));
    },
});

export { expect };

/** Opens the app with a clean slate (no persisted settings) unless told otherwise. */
export async function openApp(page: Page, { keepStorage = false } = {}) {
    if (!keepStorage) {
        await page.addInitScript(() => {
            if (!sessionStorage.getItem('__e2e_cleared')) {
                localStorage.clear();
                sessionStorage.setItem('__e2e_cleared', '1');
            }
        });
    }
    await page.goto('/');
    await expect(page.getByTestId('play-toggle')).toBeVisible();
}

export async function selectPreset(page: Page, name: string) {
    await page.getByRole('combobox', { name: 'Ritmo Predefinido' }).click();
    await page.getByRole('option', { name, exact: true }).click();
}

export async function play(page: Page) {
    const button = page.getByTestId('play-toggle');
    await button.click();
    await expect(button).toHaveText(/DETENER/);
}

export async function stop(page: Page) {
    const button = page.getByTestId('play-toggle');
    await button.click();
    await expect(button).toHaveText(/INICIAR/);
}

export async function setBpm(page: Page, bpm: number) {
    const input = page.getByTestId('bpm-input');
    await input.fill(String(bpm));
    await input.press('Enter');
    await expect(input).toHaveValue(String(bpm));
}

/** Mixer mute buttons are toggles: bring a channel to the wanted state. */
export async function setMuted(page: Page, channel: string, muted: boolean) {
    const button = page.getByTestId(`mute-${channel}`);
    if ((await button.getAttribute('aria-pressed')) !== String(muted)) await button.click();
    await expect(button).toHaveAttribute('aria-pressed', String(muted));
}
