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
  const pill = (): HTMLElement | null => shadow()?.querySelector<HTMLElement>('[role="status"]') ?? null;
  const undoButton = (): HTMLButtonElement | null => pill()?.querySelector('button') ?? null;
  const sweep = (): HTMLElement | null => shadow()?.querySelector<HTMLElement>('.mpm-sweep') ?? null;
  /** Opens the selector, chooses p1 and waits for the confirmation of its Insertion. */
  const inserted = async (): Promise<void> => {
    await controller.open(field, button);
    await opened();
    row('p1')?.click();
    await vi.waitFor(() => { expect(pill()).not.toBeNull(); });
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
    // The test DOM lays nothing out: the input field gets a place in the window
    field.getBoundingClientRect = () => new DOMRect(100, 400, 500, 60);
    button = document.createElement('button');
    document.body.append(field, button);
    callbacks = {
      loadLibrary: vi.fn().mockResolvedValue(library),
      insert: vi.fn().mockResolvedValue(true),
      restore: vi.fn().mockResolvedValue(true),
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
    expect(dialog()?.getAttribute('aria-modal')).toBe('true');
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

  it('takes the button that replaces its trigger: it says open, is not outside, and closes on a second click', async () => {
    await controller.open(field, button);
    await opened();
    const replacement = document.createElement('button');
    document.body.appendChild(replacement);
    button.remove();

    controller.setTrigger(replacement);
    expect(callbacks.onOpenChange).toHaveBeenLastCalledWith(true, replacement);

    // A press on the new button is not a click outside: the selector stays for toggle to close it
    replacement.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    expect(dialog()?.getAttribute('data-closing')).toBe('false');
    controller.toggle(field, replacement);
    await closed();
    expect(callbacks.onOpenChange).toHaveBeenLastCalledWith(false, replacement);
  });

  it('opens with the button that replaced its trigger while it was still loading', async () => {
    const loaded: { resolve?: (value: typeof library) => void } = {};
    callbacks.loadLibrary.mockReturnValueOnce(new Promise((resolve) => { loaded.resolve = resolve; }));
    const replacement = document.createElement('button');
    document.body.appendChild(replacement);

    const opening = controller.open(field, button);
    button.remove();
    controller.setTrigger(replacement);
    loaded.resolve?.(library);
    await opening;
    await opened();

    expect(callbacks.onOpenChange).toHaveBeenLastCalledWith(true, replacement);
    // The new button is the trigger: a press on it is not a click outside
    replacement.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    expect(dialog()?.getAttribute('data-closing')).toBe('false');
  });

  it('inserts nothing when it is destroyed while it closes with an Insertion pending', async () => {
    await controller.open(field, button);
    await opened();
    row('p1')?.click();

    controller.destroy();
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(callbacks.insert).not.toHaveBeenCalled();
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
    // The user is told: the Prompt went nowhere, and there is nothing to undo
    await vi.waitFor(() => { expect(pill()?.textContent).toBe("Couldn't insert “Title p1”"); });
    expect(undoButton()).toBeNull();
    expect(sweep()).toBeNull();
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

  it('an opening destroyed while it loads does not swallow the next click', async () => {
    callbacks.loadLibrary.mockReturnValueOnce(new Promise(() => { /* never resolves */ }));
    controller.toggle(field, button);

    // The site is disabled, then enabled again: the same controller is used
    controller.destroy();
    controller.toggle(field, button);

    await opened();
  });

  it('an opening that fails late leaves a later, healthy selector open', async () => {
    const first: { reject?: (reason: Error) => void } = {};
    callbacks.loadLibrary.mockReturnValueOnce(new Promise((_resolve, reject) => { first.reject = reject; }));

    controller.toggle(field, button);
    controller.toggle(field, button);
    controller.toggle(field, button);
    await opened();

    first.reject?.(new Error('storage down'));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(dialog()?.getAttribute('data-closing')).toBe('false');
    expect(controller.isOpen).toBe(true);
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

  describe('after an Insertion', () => {
    it('confirms it: the pill names the Prompt and offers Undo, the sweep covers the field, the caret is at the end', async () => {
      field.value = 'Draft';
      callbacks.insert.mockImplementation((_prompt: unknown, content: string) => {
        field.value = content;
        return Promise.resolve(true);
      });

      await inserted();

      expect(dialog()).toBeNull();
      expect(pill()?.textContent).toBe('Inserted “Title p1”Undo');
      expect(pill()?.getAttribute('data-kind')).toBe('inserted');
      expect(undoButton()?.textContent).toBe('Undo');
      expect(sweep()?.getAttribute('aria-hidden')).toBe('true');
      expect(sweep()?.style.width).toBe('500px');
      expect(document.activeElement).toBe(field);
      expect(field.selectionStart).toBe('Content p1'.length);
    });

    it('Undo puts back the text the field held before, through the Platform, and the pill goes', async () => {
      field.value = '  Draft, kept exactly\n';
      callbacks.insert.mockImplementation((_prompt: unknown, content: string) => {
        field.value = content;
        return Promise.resolve(true);
      });
      callbacks.restore.mockImplementation((text: string) => {
        field.value = text;
        return Promise.resolve(true);
      });
      await inserted();

      undoButton()?.click();

      await vi.waitFor(() => { expect(pill()).toBeNull(); });
      expect(callbacks.restore).toHaveBeenCalledTimes(1);
      expect(callbacks.restore).toHaveBeenCalledWith('  Draft, kept exactly\n', field);
      expect(callbacks.insert).toHaveBeenCalledTimes(1);
      await vi.waitFor(() => { expect(document.activeElement).toBe(field); });
      expect(field.selectionStart).toBe(field.value.length);
    });

    it('says so when Undo fails: the Prompt is still in the field, and there is no second Undo', async () => {
      callbacks.restore.mockResolvedValue(false);
      await inserted();

      undoButton()?.click();

      await vi.waitFor(() => { expect(pill()?.textContent).toBe("Couldn't undo “Title p1”"); });
      expect(pill()?.getAttribute('data-kind')).toBe('undoFailed');
      expect(undoButton()).toBeNull();
      expect(sweep()).toBeNull();
      expect(document.activeElement).toBe(field);
    });

    it('says so when Undo throws', async () => {
      callbacks.restore.mockRejectedValue(new Error('boom'));
      await inserted();

      undoButton()?.click();

      await vi.waitFor(() => { expect(pill()?.getAttribute('data-kind')).toBe('undoFailed'); });
    });

    it('says so when the Insertion failed: no Undo, no sweep', async () => {
      callbacks.insert.mockResolvedValue(false);

      await inserted();

      expect(pill()?.textContent).toBe("Couldn't insert “Title p1”");
      expect(pill()?.getAttribute('data-kind')).toBe('failed');
      expect(undoButton()).toBeNull();
      expect(sweep()).toBeNull();
    });

    it('says so when the Platform replaces the input field while it takes the text', async () => {
      callbacks.insert.mockImplementation(() => {
        field.remove();
        return Promise.resolve(false);
      });

      await inserted();

      expect(pill()?.textContent).toBe("Couldn't insert “Title p1”");
      expect(undoButton()).toBeNull();
    });

    it('offers no Undo for a field that is gone, even when the Platform reported the text as inserted', async () => {
      callbacks.insert.mockImplementation(() => {
        field.remove();
        return Promise.resolve(true);
      });

      await inserted();

      expect(pill()?.getAttribute('data-kind')).toBe('failed');
      expect(undoButton()).toBeNull();
      expect(sweep()).toBeNull();
    });

    it('says so when the Insertion throws', async () => {
      callbacks.insert.mockRejectedValue(new Error('boom'));

      await inserted();

      expect(pill()?.getAttribute('data-kind')).toBe('failed');
    });

    it('draws no sweep under reduced motion', async () => {
      const matchMedia = vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({ matches: query.includes('reduce') }) as MediaQueryList);

      await inserted();

      expect(pill()?.getAttribute('data-kind')).toBe('inserted');
      expect(sweep()).toBeNull();
      matchMedia.mockRestore();
    });

    it('leaves when the user types in the input field', async () => {
      await inserted();

      field.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: 'a' }));

      await vi.waitFor(() => { expect(pill()).toBeNull(); });
    });

    it('leaves when the user sends the message with Enter', async () => {
      await inserted();

      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));

      await vi.waitFor(() => { expect(pill()).toBeNull(); });
    });

    it('leaves when the field is emptied without a key (the send button was clicked)', async () => {
      callbacks.insert.mockImplementation((_prompt: unknown, content: string) => {
        field.value = content;
        return Promise.resolve(true);
      });
      await inserted();
      // The watch has read the inserted text once
      await new Promise((resolve) => { setTimeout(resolve, 300); });
      expect(pill()).not.toBeNull();

      field.value = '';

      await vi.waitFor(() => { expect(pill()).toBeNull(); });
    });

    it('leaves after 2.8s, but stays while it is hovered or focused', async () => {
      await inserted();
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        // The pointer comes on the pill before the time is up: it stays
        pill()?.dispatchEvent(new MouseEvent('mouseenter'));
        vi.advanceTimersByTime(10_000);
        expect(pill()?.getAttribute('data-leaving')).toBeNull();

        // The pointer leaves, the focus comes on Undo: it still stays
        undoButton()?.focus();
        pill()?.dispatchEvent(new MouseEvent('mouseleave'));
        vi.advanceTimersByTime(10_000);
        expect(pill()?.getAttribute('data-leaving')).toBeNull();

        // Neither: 2.8s later it leaves
        undoButton()?.blur();
        vi.advanceTimersByTime(2799);
        expect(pill()?.getAttribute('data-leaving')).toBeNull();
        vi.advanceTimersByTime(1);
      } finally {
        vi.useRealTimers();
      }
      await vi.waitFor(() => { expect(pill() === null || pill()?.getAttribute('data-leaving') === 'true').toBe(true); });
    });

    it('goes when the selector opens again, and with it its Undo', async () => {
      await inserted();

      await controller.open(field, button);
      await opened();

      expect(pill()).toBeNull();
    });

    it('goes when the controller is destroyed', async () => {
      await inserted();

      controller.destroy();

      expect(document.getElementById(SELECTOR_HOST_ID)).toBeNull();
    });
  });
});
