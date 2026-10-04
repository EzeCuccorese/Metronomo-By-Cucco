const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date', 'time']);

/** Places where typing must never trigger shortcuts. */
export const isTextEditing = (el: Element): boolean => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
    return el instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(el.type);
};

/** Widgets that use Space and/or arrows themselves (sliders, menus, checkboxes, open dialogs…). */
export const ownsKeys = (el: Element): boolean => {
    if (el instanceof HTMLInputElement) return true; // checkbox, radio, range, switch
    return !!el.closest('[role="slider"], [role="spinbutton"], [role="combobox"], [role="listbox"], [role="option"], [role="menu"], [role="menuitem"], [role="radio"], [role="tab"], [role="dialog"]');
};

/** Widgets whose own keys must never become piano notes. */
export const ownsLetters = (el: Element): boolean =>
    !!el.closest('[role="dialog"], [role="listbox"], [role="menu"], [role="combobox"], [role="option"]');
