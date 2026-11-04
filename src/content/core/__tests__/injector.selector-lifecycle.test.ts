/**
 * When the injected Prompt selector closes (My-Prompt-Manager-sqi, -9vm).
 *
 * Uses the real event manager so page events behave as on a page; only insertion into the
 * platform, storage, styles and the logger are mocked.
 */
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getChromeMock } from '../../../test/mocks';
import type { Prompt } from '../../types/index';
import { PromptLibraryInjector } from '../injector';

const { insertPromptMock, getPromptsMock } = vi.hoisted(() => ({
  insertPromptMock: vi.fn(),
  getPromptsMock: vi.fn()
}));

vi.mock('../insertion-manager', () => ({
  PlatformInsertionManager: vi.fn(function () {
    return {
      getAllSelectors: vi.fn().mockReturnValue(['textarea']),
      createIcon: vi.fn().mockReturnValue(document.createElement('button')),
      insertPrompt: insertPromptMock,
      initializeStrategies: vi.fn(),
      cleanup: vi.fn()
    };
  })
}));

vi.mock('../../utils/storage', () => ({
  getCategoryColors: vi.fn().mockResolvedValue(new Map()),
  getPrompts: getPromptsMock,
  createPromptListItem: vi.fn().mockImplementation((prompt: Prompt) => {
    const item = document.createElement('div');
    item.className = 'prompt-item';
    item.dataset.promptId = prompt.id;
    item.textContent = prompt.title;
    return item;
  }),
  isSiteEnabled: vi.fn().mockResolvedValue(true),
  getSettings: vi.fn().mockResolvedValue({ enabledSites: [], customSites: [], debugMode: false, floatingFallback: true })
}));

vi.mock('../../utils/styles', () => ({
  injectCSS: vi.fn(),
  isInjected: vi.fn()
}));

vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn().mockReturnValue(false),
  showDebugNotification: vi.fn()
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

const plain: Prompt = { id: 'plain', title: 'Plain', content: 'No variables at all', category: 'Test', createdAt: 0, updatedAt: 0 };

/** A promise the test settles when it chooses. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => { resolve = settle; });
  return { promise, resolve };
};

describe('Prompt selector: when it closes', () => {
  let injector: PromptLibraryInjector;
  let textarea: HTMLTextAreaElement;

  const selector = () => document.querySelector<HTMLElement>('.prompt-library-selector');
  const pick = async (title: string) => {
    const item = Array.from(document.querySelectorAll<HTMLElement>('.prompt-item')).find((el) => el.textContent === title);
    if (!item) {throw new Error(`No prompt item ${title}`);}
    await userEvent.click(item);
  };
  /** Longer than the 16 ms the selector waits before it repositions. */
  const afterReposition = () => new Promise((resolve) => setTimeout(resolve, 50));

  beforeEach(async () => {
    insertPromptMock.mockReset().mockResolvedValue({ success: true, method: 'direct' });
    getPromptsMock.mockReset().mockResolvedValue([plain]);
    textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    injector = new PromptLibraryInjector();
    await injector.showPromptSelector(textarea);
  });

  afterEach(() => {
    injector.cleanup();
    textarea.remove();
    document.querySelectorAll('.prompt-library-selector').forEach((el) => { el.remove(); });
  });

  it.each(['scroll', 'resize'])('stays open when the page fires %s, and is repositioned in place', async (event) => {
    const open = selector();

    window.dispatchEvent(new Event(event));
    await afterReposition();

    expect(open?.isConnected).toBe(true);
    expect(selector()).toBe(open);
  });

  it('leaves one selector when the icon is clicked again while the first is still loading its Prompts', async () => {
    injector.cleanup();
    document.querySelectorAll('.prompt-library-selector').forEach((el) => { el.remove(); });
    const first = deferred<Prompt[]>();
    getPromptsMock.mockReturnValueOnce(first.promise);

    const opening = injector.showPromptSelector(textarea);
    const reopening = injector.showPromptSelector(textarea);
    first.resolve([plain]);
    await Promise.all([opening, reopening]);

    expect(document.querySelectorAll('.prompt-library-selector')).toHaveLength(1);
  });

  it('closes as soon as the Prompt is inserted, before its use is reported', async () => {
    const report = deferred<undefined>();
    vi.mocked(getChromeMock().runtime.sendMessage).mockReturnValue(report.promise as never);

    await pick('Plain');

    await vi.waitFor(() => { expect(getChromeMock().runtime.sendMessage).toHaveBeenCalled(); });
    expect(selector()).toBeNull();
    report.resolve(undefined);
  });

  it('leaves open a selector the user opened while an earlier Insertion was still running', async () => {
    const insertion = deferred<{ success: boolean; method: string }>();
    insertPromptMock.mockReturnValueOnce(insertion.promise);

    await pick('Plain');
    await vi.waitFor(() => { expect(insertPromptMock).toHaveBeenCalledTimes(1); });
    await injector.showPromptSelector(textarea);
    const reopened = selector();
    insertion.resolve({ success: true, method: 'direct' });
    await vi.waitFor(() => { expect(getChromeMock().runtime.sendMessage).toHaveBeenCalled(); });

    expect(reopened?.isConnected).toBe(true);
    expect(selector()).toBe(reopened);
  });

  // The selector listens for an outside click 100 ms after it opens (My-Prompt-Manager-d9j)
  it.each([
    ['its close button is clicked', () => { selector()?.querySelector<HTMLElement>('.close-selector')?.click(); }],
    ['the injector is cleaned up', () => { injector.cleanup(); }]
  ])('listens for no outside click when %s before those 100 ms', async (_when, close) => {
    injector.cleanup();
    vi.useFakeTimers();
    const addListener = vi.spyOn(document, 'addEventListener');
    try {
      await injector.showPromptSelector(textarea);

      close();
      vi.advanceTimersByTime(150);

      expect(selector()).toBeNull();
      expect(addListener.mock.calls.map(([type]) => type)).not.toContain('click');
    } finally {
      addListener.mockRestore();
      vi.useRealTimers();
    }
  });
});
