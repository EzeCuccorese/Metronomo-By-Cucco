import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadSamples, trimBuffer } from './sampleLibrary';

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

    it('skips a sample whose download fails instead of decoding an error page', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
            ok: !url.endsWith('/audio/kick.ogg'),
            status: 404,
            arrayBuffer: async () => new ArrayBuffer(8),
        })));
        const ctx = makeContext();
        const buffers = await loadSamples(ctx);
        expect(buffers.has('kick')).toBe(false); // the synthesizer uses its synthesized voice
        expect(buffers.has('snare')).toBe(true);
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(ctx.decodeAudioData).toHaveBeenCalledTimes(18);
        vi.unstubAllGlobals();
    });

    it('skips a sample whose decoding fails', async () => {
        const fetchMock = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
        vi.stubGlobal('fetch', fetchMock);
        const ctx = makeContext();
        ctx.decodeAudioData.mockRejectedValueOnce(new Error('EncodingError'));
        const buffers = await loadSamples(ctx);
        expect(buffers.size).toBeGreaterThanOrEqual(18);
        expect(fetchMock).toHaveBeenCalledTimes(19);
        expect(console.error).toHaveBeenCalledTimes(1);
        vi.unstubAllGlobals();
    });

    it('only requests .ogg files', async () => {
        const urls: string[] = [];
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            urls.push(url);
            return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
        }));
        await loadSamples(makeContext());
        expect(urls.length).toBe(19);
        expect(urls.every(u => u.endsWith('.ogg'))).toBe(true);
        vi.unstubAllGlobals();
    });

    it('trims to the attack and limits the duration', () => {
        const source = makeBuffer(2000, 0);
        source.getChannelData(0).fill(0.9, 100);
        const trimmed = trimBuffer(makeContext(), source, 0.5, 0.5);
        expect(trimmed.length).toBe(500);
        expect(trimmed.getChannelData(0)[0]).toBeCloseTo(0.9);
    });
});
