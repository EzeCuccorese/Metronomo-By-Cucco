import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadSamples, trimBuffer, stripLeadingSilence } from './sampleLibrary';

const makeBuffer = (length: number, fill = 0.5) => {
    const data = new Float32Array(length).fill(fill);
    return { numberOfChannels: 1, length, sampleRate: 1000, getChannelData: () => data } as unknown as AudioBuffer;
};

const makeContext = () => ({
    decodeAudioData: vi.fn(async () => makeBuffer(2000)),
    createBuffer: vi.fn((channels: number, length: number, sampleRate: number) => {
        const data = new Float32Array(length);
        return { numberOfChannels: channels, length, sampleRate, getChannelData: () => data };
    }),
}) as unknown as BaseAudioContext & { decodeAudioData: ReturnType<typeof vi.fn> };

describe('sampleLibrary', () => {
    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => vi.restoreAllMocks());

    it('downloads and decodes each sample once per audio context', async () => {
        const fetchMock = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
        vi.stubGlobal('fetch', fetchMock);
        const ctx = makeContext();

        const [a, b] = await Promise.all([loadSamples(ctx), loadSamples(ctx)]);
        expect(a).toBe(b);
        expect(fetchMock).toHaveBeenCalledTimes(19);
        expect(ctx.decodeAudioData).toHaveBeenCalledTimes(19);
        expect(a.has('kick')).toBe(true);
        expect(a.has('bombo_parche')).toBe(true); // trimmed version is derived once too

        await loadSamples(makeContext());
        expect(fetchMock).toHaveBeenCalledTimes(38); // a different context gets its own buffers
        vi.unstubAllGlobals();
    });

    it('skips samples whose download fails instead of decoding an error page', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
            ok: !url.endsWith('/audio/kick.ogg'),
            status: 404,
            arrayBuffer: async () => new ArrayBuffer(8),
        })));
        const ctx = makeContext();
        const buffers = await loadSamples(ctx);
        expect(buffers.has('kick')).toBe(true); // recovered through the m4a fallback
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.error).not.toHaveBeenCalled();
        expect(ctx.decodeAudioData).toHaveBeenCalledTimes(19);
        vi.unstubAllGlobals();
    });

    it('gives up on a sample only when both formats fail', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
            ok: !/\/audio\/kick\./.test(url),
            status: 404,
            arrayBuffer: async () => new ArrayBuffer(8),
        })));
        const ctx = makeContext();
        const buffers = await loadSamples(ctx);
        expect(buffers.has('kick')).toBe(false);
        expect(buffers.has('snare')).toBe(true);
        expect(ctx.decodeAudioData).toHaveBeenCalledTimes(18);
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledTimes(1);
        vi.unstubAllGlobals();
    });

    it('falls back to the other format when decoding fails', async () => {
        const fetchMock = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
        vi.stubGlobal('fetch', fetchMock);
        const ctx = makeContext();
        ctx.decodeAudioData.mockRejectedValueOnce(new Error('EncodingError'));
        const buffers = await loadSamples(ctx);
        expect(buffers.size).toBeGreaterThanOrEqual(19);
        expect(fetchMock).toHaveBeenCalledTimes(20);
        vi.unstubAllGlobals();
    });

    describe('format selection', () => {
        const urlsFor = async (canPlay: (type: string) => string) => {
            vi.stubGlobal('Audio', class { canPlayType = canPlay; });
            const fetchMock = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
            vi.stubGlobal('fetch', fetchMock);
            await loadSamples(makeContext());
            return (fetchMock.mock.calls as unknown as string[][]).map(c => c[0]);
        };
        afterEach(() => vi.unstubAllGlobals());

        it('prefers Opus/Ogg when the browser plays it', async () => {
            const urls = await urlsFor(t => (t.includes('opus') ? 'probably' : ''));
            expect(urls).toHaveLength(19);
            expect(urls.every(u => u.endsWith('.ogg'))).toBe(true);
        });

        it('uses AAC/m4a when Ogg is unsupported (old iOS Safari)', async () => {
            const urls = await urlsFor(t => (t.includes('mp4a') ? 'maybe' : ''));
            expect(urls.every(u => u.endsWith('.m4a'))).toBe(true);
        });

        it('defaults to ogg when canPlayType answers nothing or throws', async () => {
            expect((await urlsFor(() => '')).every(u => u.endsWith('.ogg'))).toBe(true);
            expect((await urlsFor(() => { throw new Error('boom'); })).every(u => u.endsWith('.ogg'))).toBe(true);
        });
    });

    describe('stripLeadingSilence', () => {
        it('removes leading near-silence', () => {
            const src = makeBuffer(1000, 0);
            src.getChannelData(0).fill(0.5, 30);
            const out = stripLeadingSilence(makeContext(), src);
            expect(out.length).toBe(970);
            expect(out.getChannelData(0)[0]).toBeCloseTo(0.5);
        });

        it('caps the amount removed at 50 ms', () => {
            const out = stripLeadingSilence(makeContext(), makeBuffer(1000, 0));
            expect(out.length).toBe(950); // sampleRate 1000 -> 50 samples
        });

        it('returns the same buffer when the attack is immediate', () => {
            const src = makeBuffer(100, 0.5);
            expect(stripLeadingSilence(makeContext(), src)).toBe(src);
        });
    });

    it('trims to the attack and limits the duration', () => {
        const source = makeBuffer(2000, 0);
        source.getChannelData(0).fill(0.9, 100);
        const trimmed = trimBuffer(makeContext(), source, 0.5, 0.5);
        expect(trimmed.length).toBe(500);
        expect(trimmed.getChannelData(0)[0]).toBeCloseTo(0.9);
    });
});
