import '@testing-library/jest-dom/vitest';

// jsdom does not implement matchMedia; provide an inert default (tests override via vi.stubGlobal).
if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = (query: string): MediaQueryList =>
        ({
            matches: false,
            media: query,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            dispatchEvent: () => false,
        }) as MediaQueryList;
}
