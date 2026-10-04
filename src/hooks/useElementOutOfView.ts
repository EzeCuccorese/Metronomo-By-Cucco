import { useEffect, useState } from 'react';

/** True while `element` is completely scrolled out of the viewport (false until it is known). */
export function useElementOutOfView(element: Element | null): boolean {
    const [out, setOut] = useState(false);
    useEffect(() => {
        if (!element || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(([entry]) => setOut(!entry.isIntersecting));
        observer.observe(element);
        return () => observer.disconnect();
    }, [element]);
    return out;
}
