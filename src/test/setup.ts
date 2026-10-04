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

// jsdom lacks ResizeObserver and document.fonts; inert defaults (tests may override via vi.stubGlobal).
if (typeof window !== 'undefined') {
    if (!('ResizeObserver' in globalThis)) {
        globalThis.ResizeObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        };
    }
    if (!document.fonts) {
        Object.defineProperty(document, 'fonts', {
            configurable: true,
            value: { addEventListener: () => {}, removeEventListener: () => {}, ready: Promise.resolve() },
        });
    }
}

// cmdk scrolls the selected item into view.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
}
