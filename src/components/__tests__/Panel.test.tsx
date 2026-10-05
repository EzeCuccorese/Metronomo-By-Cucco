import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Panel } from '../Panel';
import { LayoutContext } from '../../state/LayoutContext';
import { useLayout } from '../../hooks/useLayout';
import { STORAGE_PREFIX } from '../../state/storage';
import { LAYOUT_TODO } from '../../state/layout';

function Harness({ withBody = true }: { withBody?: boolean }) {
    const layout = useLayout();
    return (
        <LayoutContext.Provider value={layout}>
            <Panel id="mixer" title="Mezclador" summary="3 canales · sin mutes">
                {withBody && <button type="button">cuerpo</button>}
            </Panel>
        </LayoutContext.Provider>
    );
}

const saved = () => JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}ui.layout.v1`) ?? 'null');

describe('Panel', () => {
    beforeEach(() => localStorage.setItem(`${STORAGE_PREFIX}ui.layout.v1`, JSON.stringify(LAYOUT_TODO)));
    afterEach(() => { cleanup(); localStorage.clear(); });

    it('is a plain open card without an id', () => {
        render(<Panel title="Sin id"><p>hola</p></Panel>);
        expect(screen.getByRole('region', { name: 'Sin id' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Sin id/ })).toBeNull();
        expect(screen.getByText('hola')).toBeVisible();
    });

    it('folds to the title bar with a summary, keeping the body mounted', () => {
        render(<Harness />);
        const toggle = screen.getByRole('button', { name: /^Mezclador/ });
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(screen.queryByTestId('panel-summary')).toBeNull();

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByTestId('panel-summary')).toHaveTextContent('3 canales · sin mutes');
        // Still in the DOM (its effects keep running), just not shown.
        expect(screen.getByText('cuerpo')).toBeInTheDocument();
        expect(saved().panels.mixer).toBe('collapsed');

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(saved().panels.mixer).toBe('open');
    });

    it('links the toggle to the body it controls', () => {
        render(<Harness />);
        const toggle = screen.getByRole('button', { name: /^Mezclador/ });
        const body = document.getElementById(toggle.getAttribute('aria-controls')!);
        expect(body).toContainElement(screen.getByText('cuerpo'));
    });

    it('hides from its menu: nothing is rendered, and the choice is persisted', () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole('button', { name: 'Opciones de Mezclador' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Ocultar panel' }));
        expect(screen.queryByRole('region', { name: 'Mezclador' })).toBeNull();
        expect(screen.queryByText('cuerpo')).toBeNull();
        expect(saved().panels.mixer).toBe('hidden');
    });

    it('starts in the stored state', () => {
        localStorage.setItem(`${STORAGE_PREFIX}ui.layout.v1`, JSON.stringify({ panels: { mixer: 'collapsed' } }));
        render(<Harness />);
        expect(screen.getByRole('button', { name: /^Mezclador/ })).toHaveAttribute('aria-expanded', 'false');
    });

    it('renders nothing when the stored state is hidden', () => {
        localStorage.setItem(`${STORAGE_PREFIX}ui.layout.v1`, JSON.stringify({ panels: { mixer: 'hidden' } }));
        render(<Harness />);
        expect(screen.queryByRole('region')).toBeNull();
    });
});
