import { afterEach, describe, expect, it, vi } from 'vitest';

import { ElementPicker } from '../element-picker';

vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
}));

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

  it('sends nothing once the picker is closed', () => {
    const picker = newPicker();
    picker.activate();
    picker.deactivate();

    window.dispatchEvent(new Event('pagehide'));

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith({ type: 'PICKER_CANCELLED' });
  });
});
