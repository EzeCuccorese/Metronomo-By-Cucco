/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('AudioContextManager', () => {
    let mockResume: any;
    let mockContextInstance: any;
    let MockAudioContextClass: any;

    beforeEach(() => {
        vi.resetModules();
        mockResume = vi.fn().mockResolvedValue(undefined);
        mockContextInstance = {
            state: 'suspended',
            resume: mockResume,
            destination: {},
            currentTime: 0,
            sampleRate: 44100,
        };

        MockAudioContextClass = vi.fn(function (this: any) {
            return mockContextInstance;
        });

        (globalThis as any).window = (globalThis as any).window || {};
        (globalThis as any).window.AudioContext = MockAudioContextClass;
        delete (globalThis as any).window.webkitAudioContext;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return a singleton instance via getInstance()', async () => {
        const AudioContextManagerModule = await import('./AudioContextManager');
        const AudioContextManager = AudioContextManagerModule.default;

        const instance1 = AudioContextManager.getInstance();
        const instance2 = AudioContextManager.getInstance();

        expect(instance1).toBeDefined();
        expect(instance1).toBe(instance2);
        expect(MockAudioContextClass).toHaveBeenCalledTimes(1);
    });

    it('should return the AudioContext object via getContext()', async () => {
        const AudioContextManagerModule = await import('./AudioContextManager');
        const AudioContextManager = AudioContextManagerModule.default;

        const instance = AudioContextManager.getInstance();
        expect(instance.getContext()).toBe(mockContextInstance);
    });

    it('should resume audio context when suspended', async () => {
        const AudioContextManagerModule = await import('./AudioContextManager');
        const AudioContextManager = AudioContextManagerModule.default;

        const instance = AudioContextManager.getInstance();
        mockContextInstance.state = 'suspended';

        await instance.resume();
        expect(mockResume).toHaveBeenCalledTimes(1);
    });

    it('should not call resume when audio context is already running', async () => {
        const AudioContextManagerModule = await import('./AudioContextManager');
        const AudioContextManager = AudioContextManagerModule.default;

        const instance = AudioContextManager.getInstance();
        mockContextInstance.state = 'running';

        await instance.resume();
        expect(mockResume).not.toHaveBeenCalled();
    });

    it('should throw an error if Web Audio API is not supported', async () => {
        delete (globalThis as any).window.AudioContext;
        delete (globalThis as any).window.webkitAudioContext;

        const AudioContextManagerModule = await import('./AudioContextManager');
        const AudioContextManager = AudioContextManagerModule.default;

        expect(() => AudioContextManager.getInstance()).toThrow('Web Audio API not supported in this browser');
    });
});
