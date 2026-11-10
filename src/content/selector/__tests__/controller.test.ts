/**
 * The Prompt selector's controller, with the real components rendered into its shadow root.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PromptSelectorController, SELECTOR_HOST_ID, type SelectorCallbacks } from '../controller';

import { library } from './selector.fixtures';

vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn().mockReturnValue(false)
}));

vi.mock('../font', () => ({
  SELECTOR_FONT_FAMILY: 'MPM Schibsted Grotesk',
  loadSelectorFont: vi.fn().mockResolvedValue(true)
}));

const theme = vi.hoisted(() => ({
  current: 'light' as 'light' | 'dark',
  observers: new Set<(theme: 'light' | 'dark') => void>()
}));

vi.mock('../../utils/theme-manager', () => ({
  ThemeManager: {
    getInstance: () => ({
      getCurrentTheme: () => theme.current,
      addObserver: (observer: (theme: 'light' | 'dark') => void) => { theme.observers.add(observer); },
      removeObserver: (observer: (theme: 'light' | 'dark') => void) => { theme.observers.delete(observer); }
    })
  }
}));

describe('PromptSelectorController', () => {
  let field: HTMLTextAreaElement;
  let button: HTMLButtonElement;
  let callbacks: { [K in keyof Required<SelectorCallbacks>]: ReturnType<typeof vi.fn> };
  let controller: PromptSelectorController;

  const shadow = (): ShadowRoot | null => document.getElementById(SELECTOR_HOST_ID)?.shadowRoot ?? null;
  const dialog = (): HTMLElement | null => shadow()?.querySelector<HTMLElement>('[role="dialog"]') ?? null;
  const row = (id: string): HTMLElement | null => shadow()?.querySelector<HTMLElement>(`[data-prompt-id="${id}"]`) ?? null;
  const press = (key: string, target: Element | null = shadow()?.querySelector('[role="listbox"]') ?? null): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true });
    target?.dispatchEvent(event);
    return event;
  };
  const opened = async (): Promise<void> => {
    await vi.waitFor(() => { expect(dialog()).not.toBeNull(); });
  };
  const closed = async (): Promise<void> => {
    await vi.waitFor(() => { expect(dialog()).toBeNull(); });
  };

  beforeEach(() => {
    theme.current = 'light';
    theme.observers.clear();
    field = document.createElement('textarea');
    button = document.createElement('button');
    document.body.append(field, button);
    callbacks = {
      loadLibrary: vi.fn().mockResolvedValue(library),
      insert: vi.fn().mockResolvedValue(undefined),
      onOpenChange: vi.fn()
    };
    controller = new PromptSelectorController(callbacks as unknown as SelectorCallbacks);
  });

  afterEach(() => {
    controller.destroy();
    document.body.innerHTML = '';
  });

  it('removes a host left in the page by an earlier instance of the content script', () => {
    const stale = document.createElement('div');
    stale.id = SELECTOR_HOST_ID;
    document.body.appendChild(stale);

    const fresh = new PromptSelectorController(callbacks as unknown as SelectorCallbacks);

    expect(document.getElementById(SELECTOR_HOST_ID)).toBeNull();
    fresh.destroy();
  });

  it('renders nothing in the page until it opens', () => {
    expect(document.getElementById(SELECTOR_HOST_ID)).toBeNull();
    expect(controller.isOpen).toBe(false);
  });

  it('opens in a shadow root on body, with its stylesheet inside and none in the page', async () => {
    await controller.open(field, button);
    await opened();

    const host = document.getElementById(SELECTOR_HOST_ID);
    expect(host?.parentElement).toBe(document.body);
    expect(shadow()?.querySelector('style')?.textContent).toContain('.mpm-popover');
    expect(document.head.querySelectorAll('style')).toHaveLength(0);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(controller.isOpen).toBe(true);
    expect(callbacks.onOpenChange).toHaveBeenCalledWith(true, button);
  });

  it('is a dialog with a label, tabs and a listbox that points at its selected row', async () => {
    await controller.open(field, button);
    await opened();

    expect(dialog()?.getAttribute('aria-label')).toBe('Insert a prompt');
    expect(shadow()?.querySelector('[role="tablist"]')).not.toBeNull();
    expect([...(shadow()?.querySelectorAll('[role="tab"]') ?? [])].map((tab) => tab.textContent)).toEqual(['All', 'Pinned', 'Recent', 'Work', 'Home', 'Empty']);
    const listbox = shadow()?.querySelector('[role="listbox"]');
    expect(listbox?.getAttribute('aria-activedescendant')).toBe(row('p2')?.id);
    expect(row('p2')?.getAttribute('aria-selected')).toBe('true');
    expect(row('p3')?.textContent).toContain('2 variables');
  });

  it('keeps the focus in a search field that takes no room until text is typed or composed', async () => {
    await controller.open(field, button);
    await opened();
    const search = shadow()?.querySelector<HTMLInputElement>('input.mpm-search');

    expect(shadow()?.activeElement).toBe(search);
    expect(search?.getAttribute('data-collapsed')).toBe('true');
    expect(search?.getAttribute('aria-activedescendant')).toBe(row('p2')?.id);
    expect(shadow()?.querySelector('h2')?.textContent).toBe('Insert a prompt');

    // An input method starts composing: the field shows before any text is committed
    search?.dispatchEvent(new Event('compositionstart', { bubbles: true }));
    await vi.waitFor(() => { expect(search?.getAttribute('data-collapsed')).toBe('false'); });
    expect(shadow()?.querySelector('h2')).toBeNull();
    // Keys of a composition are the input method's, not the selector's
    const composingKey = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true, isComposing: true });
    search?.dispatchEvent(composingKey);
    expect(composingKey.defaultPrevented).toBe(false);
    expect(dialog()?.getAttribute('data-closing')).toBe('false');
  });

  it('follows the extension theme, when it opens and when the theme changes', async () => {
    theme.current = 'dark';
    await controller.open(field, button);
    await opened();
    const host = document.getElementById(SELECTOR_HOST_ID);

    expect(host?.getAttribute('data-theme')).toBe('dark');
    for (const observer of theme.observers) {
      observer('light');
    }
    expect(host?.getAttribute('data-theme')).toBe('light');
  });

  it('keeps the keys typed in the selector from the page, and handles them', async () => {
    const reachedPage = vi.fn();
    document.addEventListener('keydown', reachedPage);
    await controller.open(field, button);
    await opened();

    const down = press('ArrowDown');
    await vi.waitFor(() => { expect(row('p5')?.getAttribute('aria-selected')).toBe('true'); });
    const enter = press('Enter');

    expect(down.defaultPrevented).toBe(true);
    expect(enter.defaultPrevented).toBe(true);
    expect(reachedPage).not.toHaveBeenCalled();
    document.removeEventListener('keydown', reachedPage);
  });

  it('inserts the chosen Prompt as saved, once the selector has closed', async () => {
    await controller.open(field, button);
    await opened();

    row('p1')?.click();
    expect(callbacks.insert).not.toHaveBeenCalled();
    await vi.waitFor(() => { expect(dialog()?.getAttribute('data-closing')).toBe('true'); });

    await closed();
    expect(callbacks.insert).toHaveBeenCalledWith(library.prompts[0], 'Content p1', field);
    expect(callbacks.onOpenChange).toHaveBeenLastCalledWith(false, button);
    expect(controller.isOpen).toBe(false);
  });

  it('fills the Variables in: an empty one stays as written, one written twice is filled twice', async () => {
    await controller.open(field, button);
    await opened();
    row('p3')?.click();
    await vi.waitFor(() => { expect(shadow()?.querySelector('.mpm-fill')).not.toBeNull(); });

    const inputs = [...(shadow()?.querySelectorAll<HTMLInputElement>('input.mpm-variable') ?? [])];
    expect(inputs.map((input) => input.getAttribute('aria-label'))).toEqual(['name', 'topic', 'name']);
    expect(inputs.map((input) => input.placeholder)).toEqual(['name', 'topic', 'name']);
    expect(dialog()?.getAttribute('aria-label')).toBe('Fill in the variables of Title p3');

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(inputs[0], 'Ada');
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => { expect(inputs[2].value).toBe('Ada'); });
    expect(inputs[0].style.width).toBe('5ch');
    expect(inputs[1].style.width).toBe('6ch');

    press('Enter', inputs[0]);
    await closed();
    expect(callbacks.insert).toHaveBeenCalledWith(library.prompts[2], 'Dear Ada, about {{topic}}. Bye Ada', field);
  });

  it('Escape in the variables step goes back to the list; Escape there closes and gives the focus back', async () => {
    await controller.open(field, button);
    await opened();
    row('p3')?.click();
    await vi.waitFor(() => { expect(shadow()?.querySelector('.mpm-fill')).not.toBeNull(); });

    press('Escape', shadow()?.querySelector('input.mpm-variable') ?? null);
    await vi.waitFor(() => { expect(shadow()?.querySelector('[role="listbox"]')).not.toBeNull(); });
    expect(row('p3')?.getAttribute('aria-selected')).toBe('true');

    press('Escape');
    await closed();
    expect(callbacks.insert).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(field);
  });

  it('toggle closes an open selector: a second click on the Prompts button', async () => {
    controller.toggle(field, button);
    await opened();

    controller.toggle(field, button);
    await closed();
    expect(callbacks.insert).not.toHaveBeenCalled();
  });

  it('closes on a click outside, but not on the Prompts button, and leaves the focus where the user put it', async () => {
    const elsewhere = document.createElement('input');
    document.body.appendChild(elsewhere);
    await controller.open(field, button);
    await opened();

    button.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    dialog()?.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    expect(dialog()?.getAttribute('data-closing')).toBe('false');

    elsewhere.focus();
    elsewhere.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    await closed();
    expect(document.activeElement).toBe(elsewhere);
  });

  it('closes without inserting when the Platform removes the input field', async () => {
    await controller.open(field, button);
    await opened();

    field.remove();
    await closed();
    expect(callbacks.insert).not.toHaveBeenCalled();
    expect(callbacks.onOpenChange).toHaveBeenLastCalledWith(false, button);
  });

  it('does not insert when the input field is removed while the selector closes', async () => {
    await controller.open(field, button);
    await opened();

    row('p1')?.click();
    field.remove();
    await closed();
    expect(callbacks.insert).not.toHaveBeenCalled();
  });

  it('drops an opening that was closed before its Library had loaded', async () => {
    const loaded: { resolve?: (value: typeof library) => void } = {};
    callbacks.loadLibrary.mockReturnValue(new Promise((resolve) => { loaded.resolve = resolve; }));

    const opening = controller.open(field, button);
    controller.close();
    loaded.resolve?.(library);
    await opening;

    expect(dialog()).toBeNull();
    expect(controller.isOpen).toBe(false);
  });

  it('a second click while the first opening is still loading cancels it, and a third opens', async () => {
    const loaded: { resolve?: (value: typeof library) => void } = {};
    callbacks.loadLibrary.mockReturnValueOnce(new Promise((resolve) => { loaded.resolve = resolve; }));

    controller.toggle(field, button);
    controller.toggle(field, button);
    loaded.resolve?.(library);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(dialog()).toBeNull();
    expect(controller.isOpen).toBe(false);
    expect(callbacks.loadLibrary).toHaveBeenCalledTimes(1);

    controller.toggle(field, button);
    await opened();
  });

  it('opens on All again after a tab was shown', async () => {
    await controller.open(field, button);
    await opened();
    press('ArrowRight');
    await vi.waitFor(() => { expect(shadow()?.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Pinned'); });

    controller.close();
    await closed();
    await controller.open(field, button);
    await opened();
    expect(shadow()?.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('All');
  });

  it('reads the Library again at each opening', async () => {
    await controller.open(field, button);
    await opened();
    controller.close();
    await closed();
    await controller.open(field, button);
    await opened();

    expect(callbacks.loadLibrary).toHaveBeenCalledTimes(2);
  });

  it('says so when the Library is empty', async () => {
    callbacks.loadLibrary.mockResolvedValue({ prompts: [], categories: [] });
    await controller.open(field, button);
    await opened();

    expect(dialog()?.textContent).toContain('No prompts yet. Add some in the extension popup!');
  });

  it('destroy removes the host and the theme observer', async () => {
    await controller.open(field, button);
    await opened();

    controller.destroy();

    expect(document.getElementById(SELECTOR_HOST_ID)).toBeNull();
    expect(theme.observers.size).toBe(0);
    expect(controller.isOpen).toBe(false);
  });

  it('survives a Library that fails to load', async () => {
    callbacks.loadLibrary.mockRejectedValue(new Error('storage down'));

    await expect(controller.open(field, button)).resolves.toBeUndefined();
    expect(controller.isOpen).toBe(false);
  });
});
