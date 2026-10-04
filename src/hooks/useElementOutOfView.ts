import { useEffect, useState } from 'react';

/** True while the element matching `selector` is completely scrolled out of the viewport. */
export function useElementOutOfView(selector: string): boolean {
    const [out, setOut] = useState(false);
    useEffect(() => {
        const el = document.querySelector(selector);
        if (!el || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(([entry]) => setOut(!entry.isIntersecting));
        observer.observe(el);
        return () => observer.disconnect();
    }, [selector]);
    return out;
}
