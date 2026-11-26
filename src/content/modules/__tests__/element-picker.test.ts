import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import { isDebugMode } from '../../utils/logger';
import { ElementPicker } from '../element-picker';

vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn(() => false)
}));

describe('ElementPicker: its audit in the console follows Debug mode, not the page (My-Prompt-Manager-j3i6)', () => {
  let picker: ElementPicker | undefined;
  let field: HTMLInputElement;
  let consoleLog: MockInstance<typeof console.log>;
  let elementFromPoint: MockInstance<typeof document.elementFromPoint>;

  beforeEach(() => {
    field = document.createElement('input');
    field.type = 'password';
    document.body.appendChild(field);
    elementFromPoint = vi.spyOn(document, 'elementFromPoint').mockReturnValue(field);
    consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    picker?.deactivate();
    field.remove();
    document.getElementById('mpm-security-warning')?.remove();
    elementFromPoint.mockRestore();
    consoleLog.mockRestore();
    vi.mocked(isDebugMode).mockReturnValue(false);
    localStorage.removeItem('prompt-library-debug');
    sessionStorage.removeItem('element-picker-audit');
  });

  /** Points at the password field and clicks it: the picker refuses it and records the refusal in its audit */
  const refusePasswordField = (): void => {
    picker = new ElementPicker();
    picker.activate();
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 1, clientY: 1, bubbles: true }));
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  };

  const auditLines = () => consoleLog.mock.calls.filter(([first]) => String(first).startsWith('[ElementPicker Audit]'));

  it("prints nothing for a page that sets prompt-library-debug in its own localStorage while Debug mode is off", () => {
    localStorage.setItem('prompt-library-debug', 'true');

    refusePasswordField();

    expect(sessionStorage.getItem('element-picker-audit')).toContain('blocked_selection');
    expect(auditLines()).toEqual([]);
  });

  it('prints the refusal, reduced to its categories, in Debug mode', () => {
    vi.mocked(isDebugMode).mockReturnValue(true);

    refusePasswordField();

    expect(auditLines()).toEqual([
      ['[ElementPicker Audit] blocked_selection:', expect.objectContaining({ reasonType: 'password_field' })]
    ]);
  });
});

describe('ElementPicker: the page unloading', () => {
  const pickers: ElementPicker[] = [];
  const newPicker = (): ElementPicker => {
    const picker = new ElementPicker();
    pickers.push(picker);
    return picker;
  };

  afterEach(() => {
    for (const picker of pickers.splice(0)) {
      picker.deactivate();
    }
  });

  it('cancels the pick with the service worker, as Escape does, and closes the picker', () => {
    const picker = newPicker();
    picker.activate();

    window.dispatchEvent(new Event('pagehide'));

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'PICKER_CANCELLED' });
    expect(document.getElementById('mpm-element-picker-overlay')).toBeNull();
  });

  it('names the start whose picker it cancels, on page unload and on Escape', () => {
    const picker = newPicker();
    picker.activate('first');
    window.dispatchEvent(new Event('pagehide'));
    picker.activate('second');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(chrome.runtime.sendMessage).toHaveBeenNthCalledWith(1, { type: 'PICKER_CANCELLED', attempt: 'first' });
    expect(chrome.runtime.sendMessage).toHaveBeenNthCalledWith(2, { type: 'PICKER_CANCELLED', attempt: 'second' });
  });

  it('sends nothing once the picker is closed', () => {
    const picker = newPicker();
    picker.activate();
    picker.deactivate();

    window.dispatchEvent(new Event('pagehide'));

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith({ type: 'PICKER_CANCELLED' });
  });

  it('goes on through an in-page address change', () => {
    const picker = newPicker();
    picker.activate();

    window.history.pushState(null, '', '#/chat/2');
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith({ type: 'PICKER_CANCELLED' });
    expect(document.getElementById('mpm-element-picker-overlay')).not.toBeNull();
  });
});

describe('ElementPicker: a deactivation that names a start', () => {
  const picker = new ElementPicker();
  const overlay = () => document.getElementById('mpm-element-picker-overlay');

  afterEach(() => {
    picker.deactivate();
  });

  it('leaves the picker of a later start active when it names an earlier one', () => {
    picker.activate('earlier');
    picker.activate('later');

    picker.deactivate('earlier');

    expect(overlay()).not.toBeNull();
  });

  it('closes the picker when it names the start that activated it last', () => {
    picker.activate('earlier');
    picker.activate('later');

    picker.deactivate('later');

    expect(overlay()).toBeNull();
  });

  it('closes the picker when it names no start', () => {
    picker.activate('earlier');

    picker.deactivate();

    expect(overlay()).toBeNull();
  });
});

describe('ElementPicker: the activations and deactivations the service worker sends', () => {
  type Listener = (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: () => void) => void;
  const overlay = () => document.getElementById('mpm-element-picker-overlay');

  /** Loads the content script afresh, so its own runtime.onMessage listener is registered again */
  const loadContentScript = async (): Promise<void> => {
    vi.resetModules();
    await import('../element-picker');
  };

  /** Delivers a message to the listeners registered and not removed, in the order they were added, as Chrome does */
  const deliver = (message: { type: string; attempt?: string }): void => {
    const removed = vi.mocked(chrome.runtime.onMessage.removeListener).mock.calls.map(([listener]) => listener);
    const listeners = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls
      .map(([listener]) => listener as unknown as Listener)
      .filter((listener) => !removed.includes(listener as never));
    for (const listener of listeners) {
      listener({ ...message, source: 'background' }, {}, () => undefined);
    }
  };

  afterEach(() => {
    deliver({ type: 'DEACTIVATE_ELEMENT_PICKER' });
  });

  it('closes the picker on the deactivation of the start that activated it', async () => {
    await loadContentScript();
    deliver({ type: 'ACTIVATE_ELEMENT_PICKER', attempt: 'first' });

    deliver({ type: 'DEACTIVATE_ELEMENT_PICKER', attempt: 'first' });

    expect(overlay()).toBeNull();
  });

  it('keeps the picker of a later start on the deactivation of an earlier one', async () => {
    await loadContentScript();
    deliver({ type: 'ACTIVATE_ELEMENT_PICKER', attempt: 'earlier' });
    deliver({ type: 'ACTIVATE_ELEMENT_PICKER', attempt: 'later' });

    deliver({ type: 'DEACTIVATE_ELEMENT_PICKER', attempt: 'earlier' });

    expect(overlay()).not.toBeNull();
  });

  it('closes the picker on the deactivation of the later start', async () => {
    await loadContentScript();
    deliver({ type: 'ACTIVATE_ELEMENT_PICKER', attempt: 'earlier' });
    deliver({ type: 'ACTIVATE_ELEMENT_PICKER', attempt: 'later' });

    deliver({ type: 'DEACTIVATE_ELEMENT_PICKER', attempt: 'later' });

    expect(overlay()).toBeNull();
  });
});
