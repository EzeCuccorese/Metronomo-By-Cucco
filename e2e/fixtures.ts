import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Audio probe & speaker silencer injected before the app loads.
 * Every connection to AudioDestinationNode is routed through a unity-gain tap (`ctx.__tap`)
 * and then a zero-gain silencer (`ctx.__silencer`) before reaching the physical speakers,
 * so Web Audio renders at full amplitude into AnalyserNode while local tests stay 100% silent
 * on both Chromium and WebKit.
 */
function installAudioProbe() {
    type Sample = { t: number; peak: number };
    type GlobalWithAudioHook = typeof window & {
        __probe?: { samples: Sample[]; ctx: AudioContext | null; starts: { when: number; at: number; kind: string }[] };
        __audioSilencerInstalled?: boolean;
    };
    const w = window as GlobalWithAudioHook;
    if (!w.__probe) {
        w.__probe = { samples: [], ctx: null, starts: [] };
    }
    const probe = w.__probe;
    if (w.__audioSilencerInstalled) return;
    w.__audioSilencerInstalled = true;

    const originalConnect = AudioNode.prototype.connect as (this: AudioNode, ...args: unknown[]) => unknown;
    AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
        const target = args[0];
        if (target instanceof AudioDestinationNode) {
            const ctx = target.context as AudioContext & { __tap?: GainNode; __silencer?: GainNode };
            if (!ctx.__tap) {
                const tap = ctx.createGain();
                const silencer = ctx.createGain();
                silencer.gain.value = 0;
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 512;
                originalConnect.call(tap, analyser);
                originalConnect.call(tap, silencer);
                originalConnect.call(silencer, target);
                ctx.__tap = tap;
                ctx.__silencer = silencer;
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
        if (this.context) {
            probe.starts.push({ when: when ?? 0, at: this.context.currentTime, kind: this.constructor.name });
        }
        return (originalStart as (...a: unknown[]) => void).call(this, when, ...rest);
    };

    // AudioBufferSourceNode overrides start(), so the hook above never sees sampled voices.
    const originalBufferStart = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, when?: number, ...rest: number[]) {
        if (this.context) {
            probe.starts.push({ when: when ?? 0, at: this.context.currentTime, kind: this.constructor.name });
        }
        return (originalBufferStart as (...a: unknown[]) => void).call(this, when, ...rest);
    };
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

    /** Distinct scheduled start times (audio clock) of sources of a given node type. */
    async startTimes(kind: string, from: number, to: number): Promise<number[]> {
        return this.page.evaluate(([k, a, b]) => {
            const starts = (window as unknown as { __probe: { starts: { when: number; kind: string }[] } }).__probe.starts;
            const times = starts.filter(s => s.kind === k && s.when >= a && s.when <= b).map(s => s.when);
            return [...new Set(times.map(t => Math.round(t * 1e6) / 1e6))].sort((x, y) => x - y);
        }, [kind, from, to] as const);
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
    // Always silence speaker output for every E2E test (even specs that don't use `probe`, across Chromium & WebKit).
    page: async ({ page }, use) => {
        await page.addInitScript(installAudioProbe);
        await use(page);
    },
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
/** Panels as they were before the "Vista" presets existed (every panel shown): what existing users get. */
const LAYOUT_TODO = JSON.stringify({ preset: 'todo', panels: { pulse: 'open', instruments: 'open', sequencer: 'open', mixer: 'open', practice: 'collapsed', harmony: 'open', study: 'open', piano: 'open' } });

/**
 * Opens the app with clean storage. The specs written before the view presets exist expect every panel,
 * so by default the layout is seeded with "Todo"; pass `newUser: true` for the real first-run layout and `tips: true` to see the first-use tips.
 */
export async function openApp(page: Page, { keepStorage = false, newUser = false, tips = false } = {}) {
    if (!keepStorage) {
        await page.addInitScript(([todo, fresh, showTips]) => {
            if (!sessionStorage.getItem('__e2e_cleared')) {
                localStorage.clear();
                if (!fresh) localStorage.setItem('metronomo:v1:ui.layout.v1', todo);
                // The first-use tips float over the page: off unless a test is about them.
                if (!showTips) localStorage.setItem('metronomo:v1:tips.seen', '["play","piano","layout"]');
                sessionStorage.setItem('__e2e_cleared', '1');
            }
        }, [LAYOUT_TODO, newUser, tips] as const);
    }
    await page.goto('/');
    await expect(page.getByTestId('play-toggle')).toBeVisible();
}

export async function openTab(page: Page, name: string) {
    const tab = page.getByRole('tab', { name });
    await tab.scrollIntoViewIfNeeded();
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
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
    const previousTab = await page.locator('[role="tab"][aria-selected="true"]').textContent();
    const button = page.getByTestId(`mute-${channel}`);
    if ((await button.count()) === 0) await openTab(page, 'Mezclador');
    if ((await button.getAttribute('aria-pressed')) !== String(muted)) await button.click();
    await expect(button).toHaveAttribute('aria-pressed', String(muted));
    if (previousTab && previousTab.trim() !== 'Mezclador') {
        await openTab(page, previousTab.trim());
    }
}
