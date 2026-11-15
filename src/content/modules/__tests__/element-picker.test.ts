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
