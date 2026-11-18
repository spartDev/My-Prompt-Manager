/**
 * The way out of the Welcome (My-Prompt-Manager-ojz.9, architecture A8 of My-Prompt-Manager-ojz):
 * with Packs, the Packs are added, then the Welcome is finished, then the Library shows on All with
 * a Notification of what was added; with none, the Welcome is finished, the Library shows, and the
 * editor opens on a new Prompt 250ms later. A failed add finishes nothing and shows a failure
 * Notification that stays, whose Try again adds the same Packs through the same exit
 * (My-Prompt-Manager-ojz.20). A second press while the first is under way does nothing.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AddPacksResult } from '../../services/storage';
import { MOTION } from '../../theme/motion';
import type { ShowToast } from '../../types/hooks';
import { PACKS } from '../../welcome/packs';
import type { PromptPack } from '../../welcome/types';
import { packsAddedNotice, useWelcomeExit, type WelcomeExitOptions } from '../useWelcomeExit';

const DEFAULTS = PACKS.filter((pack) => pack.defaultSelected);
const DEFAULT_IDS = DEFAULTS.map((pack) => pack.id);
const DEFAULT_COUNT = DEFAULTS.reduce((count, pack) => count + pack.prompts.length, 0);

/** An add the test settles itself */
const deferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

/** The hook over spies that write, in `log`, the order of what it does */
const renderExit = (overrides: Partial<WelcomeExitOptions> = {}) => {
  const log: string[] = [];
  const addPacks = vi.fn<WelcomeExitOptions['addPacks']>(async (packs: readonly PromptPack[]) => {
    log.push(`addPacks ${packs.map((pack) => pack.id).join(',')}`);
    return { added: packs.reduce((count, pack) => count + pack.prompts.length, 0), skipped: 0, packNames: packs.map((pack) => pack.name) };
  });
  const finishWelcome = vi.fn(() => { log.push('finishWelcome'); });
  const showLibrary = vi.fn(() => { log.push('showLibrary'); });
  const focusFirstPrompt = vi.fn(() => { log.push('focusFirstPrompt'); });
  const openNewPrompt = vi.fn(() => { log.push('openNewPrompt'); });
  const showToast = vi.fn<ShowToast>((message) => { log.push(`toast ${message}`); });
  const hideNotification = vi.fn(() => { log.push('hideNotification'); });
  const options: WelcomeExitOptions = { addPacks, finishWelcome, showLibrary, focusFirstPrompt, openNewPrompt, showToast, hideNotification, ...overrides };
  const view = renderHook((props: WelcomeExitOptions) => useWelcomeExit(props), { initialProps: options });
  return { ...view, log, addPacks, finishWelcome, showLibrary, focusFirstPrompt, openNewPrompt, showToast, hideNotification, options };
};

/** Lets the promise callbacks of an add that has settled run */
const flush = (): Promise<void> => act(async () => { await Promise.resolve(); });

describe('useWelcomeExit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('with Packs: the Packs added, then the Welcome finished, then the Library and the Notification', () => {
    it('adds the Packs selected, finishes the Welcome only once they are in, then shows the Library on All with the keyboard asked to its first Prompt, and the Notification', async () => {
      const { result, log, showToast } = renderExit();

      act(() => { result.current(DEFAULT_IDS); });
      expect(log).toEqual(['hideNotification', `addPacks ${DEFAULT_IDS.join(',')}`]);

      await flush();

      expect(log).toEqual(['hideNotification', `addPacks ${DEFAULT_IDS.join(',')}`, 'finishWelcome', 'showLibrary', 'focusFirstPrompt', `toast ${String(DEFAULT_COUNT)} prompts added`]);
      expect(showToast).toHaveBeenCalledWith(`${String(DEFAULT_COUNT)} prompts added`, 'success', { sub: 'Product, Writing' });
    });

    it('finishes nothing while the add is under way', async () => {
      const add = deferred<AddPacksResult>();
      const { result, finishWelcome, showLibrary, showToast } = renderExit({ addPacks: vi.fn(() => add.promise) });

      act(() => { result.current(DEFAULT_IDS); });
      await flush();

      expect(finishWelcome).not.toHaveBeenCalled();
      expect(showLibrary).not.toHaveBeenCalled();
      expect(showToast).not.toHaveBeenCalled();

      add.resolve({ added: DEFAULT_COUNT, skipped: 0, packNames: ['Product', 'Writing'] });
      await flush();
      expect(finishWelcome).toHaveBeenCalledTimes(1);
    });

    it('adds the Packs in the order the last step offers them, whatever the order they were selected in, and no id that is no Pack', async () => {
      const { result, addPacks } = renderExit();

      act(() => { result.current(['hiring', 'not-a-pack', 'product']); });
      await flush();

      expect(addPacks).toHaveBeenCalledTimes(1);
      expect(addPacks.mock.calls[0]?.[0].map((pack) => pack.id)).toEqual(['product', 'hiring']);
    });

    it('opens no editor: the Library has its Prompts to copy', async () => {
      const { result, openNewPrompt } = renderExit();

      act(() => { result.current(DEFAULT_IDS); });
      await flush();
      act(() => { vi.advanceTimersByTime(5_000); });

      expect(openNewPrompt).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('the Notification once the Packs are in', () => {
    it('says how many Prompts were really added, the Packs that added some as its sub', () => {
      expect(packsAddedNotice({ added: 9, skipped: 0, packNames: ['Product', 'Writing'] })).toEqual({ message: '9 prompts added', sub: 'Product, Writing' });
      // Some were already there: only those added are counted, only the Packs that added some named
      expect(packsAddedNotice({ added: 4, skipped: 5, packNames: ['Writing'] })).toEqual({ message: '4 prompts added', sub: 'Writing' });
      expect(packsAddedNotice({ added: 1, skipped: 3, packNames: ['Hiring'] })).toEqual({ message: '1 prompt added', sub: 'Hiring' });
    });

    it('says the Library is ready when every Prompt was already there (added 0, no Pack named)', () => {
      expect(packsAddedNotice({ added: 0, skipped: 9, packNames: [] })).toEqual({ message: 'Your library is ready', sub: 'Every prompt was already in it' });
    });

    it('shows that one when the add adds nothing, and still finishes the Welcome', async () => {
      const { result, finishWelcome, showToast } = renderExit({
        addPacks: vi.fn(async () => ({ added: 0, skipped: DEFAULT_COUNT, packNames: [] }))
      });

      act(() => { result.current(DEFAULT_IDS); });
      await flush();

      expect(finishWelcome).toHaveBeenCalledTimes(1);
      expect(showToast).toHaveBeenCalledWith('Your library is ready', 'success', { sub: 'Every prompt was already in it' });
    });
  });

  describe('the add refused: the Welcome stays, nothing is finished, and the user can try again or start empty', () => {
    const refused = () => vi.fn<WelcomeExitOptions['addPacks']>().mockRejectedValueOnce(new Error('Storage quota exceeded'));
    /** The Try again of the failure Notification the hook showed last */
    const tryAgainOf = (showToast: ReturnType<typeof renderExit>['showToast']): (() => void) => {
      const action = showToast.mock.lastCall?.[2]?.action;
      expect(action?.label).toBe('Try again');
      return action?.onClick ?? (() => undefined);
    };

    it('finishes nothing and shows a failure Notification that stays until the user acts, with Try again', async () => {
      const addPacks = refused();
      const { result, finishWelcome, showLibrary, focusFirstPrompt, openNewPrompt, showToast } = renderExit({ addPacks });

      act(() => { result.current(DEFAULT_IDS); });
      await flush();

      expect(finishWelcome).not.toHaveBeenCalled();
      expect(showLibrary).not.toHaveBeenCalled();
      // The keyboard stays in the Welcome, on the primary button that tries again
      expect(focusFirstPrompt).not.toHaveBeenCalled();
      expect(openNewPrompt).not.toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledTimes(1);
      // duration 0: no time of its own, it stays until the user acts (useToast)
      expect(showToast).toHaveBeenCalledWith("Couldn't add the prompts", 'error', { duration: 0, action: { label: 'Try again', onClick: expect.any(Function) } });
    });

    it('Try again adds the same Packs again, through the same exit as the primary button: the Notification hidden, then the Packs, the finish and the Notification of the add', async () => {
      const { result, log, addPacks, showToast, finishWelcome, focusFirstPrompt } = renderExit();
      addPacks.mockRejectedValueOnce(new Error('Storage quota exceeded'));
      const chosen = PACKS.filter((pack) => pack.id === 'product' || pack.id === 'hiring');
      const count = chosen.reduce((sum, pack) => sum + pack.prompts.length, 0);
      act(() => { result.current(['hiring', 'product']); });
      await flush();
      log.length = 0;

      act(() => { tryAgainOf(showToast)(); });
      await flush();

      expect(addPacks).toHaveBeenCalledTimes(2);
      // The same Packs, in the order the last step offers them, as the first add
      expect(addPacks.mock.calls[1]?.[0]).toEqual(addPacks.mock.calls[0]?.[0]);
      expect(addPacks.mock.calls[1]?.[0].map((pack) => pack.id)).toEqual(['product', 'hiring']);
      expect(log).toEqual(['hideNotification', 'addPacks product,hiring', 'finishWelcome', 'showLibrary', 'focusFirstPrompt', `toast ${String(count)} prompts added`]);
      expect(finishWelcome).toHaveBeenCalledTimes(1);
      expect(focusFirstPrompt).toHaveBeenCalledTimes(1);
      expect(showToast).toHaveBeenLastCalledWith(`${String(count)} prompts added`, 'success', { sub: chosen.map((pack) => pack.name).join(', ') });
    });

    it('Try again refused too: the failure Notification again, with its Try again, and nothing finished; a third try adds the Packs', async () => {
      const addPacks = vi.fn<WelcomeExitOptions['addPacks']>()
        .mockRejectedValueOnce(new Error('Storage quota exceeded'))
        .mockRejectedValueOnce(new Error('Storage quota exceeded'))
        .mockResolvedValueOnce({ added: DEFAULT_COUNT, skipped: 0, packNames: ['Product', 'Writing'] });
      const { result, showToast, finishWelcome } = renderExit({ addPacks });
      act(() => { result.current(DEFAULT_IDS); });
      await flush();

      act(() => { tryAgainOf(showToast)(); });
      await flush();

      expect(addPacks).toHaveBeenCalledTimes(2);
      expect(finishWelcome).not.toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledTimes(2);
      expect(showToast).toHaveBeenLastCalledWith("Couldn't add the prompts", 'error', { duration: 0, action: { label: 'Try again', onClick: expect.any(Function) } });

      act(() => { tryAgainOf(showToast)(); });
      await flush();

      expect(addPacks).toHaveBeenCalledTimes(3);
      expect(finishWelcome).toHaveBeenCalledTimes(1);
      expect(showToast).toHaveBeenLastCalledWith(`${String(DEFAULT_COUNT)} prompts added`, 'success', { sub: 'Product, Writing' });
    });

    it('a second press of the primary button tries again too, and finishes once the Packs are in', async () => {
      const addPacks = refused().mockResolvedValueOnce({ added: DEFAULT_COUNT, skipped: 0, packNames: ['Product', 'Writing'] });
      const { result, finishWelcome, showToast } = renderExit({ addPacks });

      act(() => { result.current(DEFAULT_IDS); });
      await flush();
      act(() => { result.current(DEFAULT_IDS); });
      await flush();

      expect(addPacks).toHaveBeenCalledTimes(2);
      expect(finishWelcome).toHaveBeenCalledTimes(1);
      expect(showToast).toHaveBeenLastCalledWith(`${String(DEFAULT_COUNT)} prompts added`, 'success', { sub: 'Product, Writing' });
    });

    // Start empty stays on the step: every Pack unselected, the primary button reads it
    it('Start empty from the step, the primary button pressed with no Pack, hides the failure Notification as it leaves, then the editor opens 250ms later', async () => {
      const { result, log, hideNotification, finishWelcome, openNewPrompt } = renderExit({ addPacks: refused() });
      act(() => { result.current(DEFAULT_IDS); });
      await flush();
      hideNotification.mockClear();

      act(() => { result.current([]); });

      expect(hideNotification).toHaveBeenCalledTimes(1);
      expect(log.slice(log.indexOf("toast Couldn't add the prompts") + 1)).toEqual(['hideNotification', 'finishWelcome', 'showLibrary']);
      expect(finishWelcome).toHaveBeenCalledTimes(1);
      act(() => { vi.advanceTimersByTime(MOTION.welcomeEditorDelay); });
      expect(openNewPrompt).toHaveBeenCalledTimes(1);
    });

    it('the primary button pressed again with Packs hides the failure Notification while that add runs, so its Try again is never on screen beside an add under way', async () => {
      const add = deferred<AddPacksResult>();
      const addPacks = refused().mockImplementationOnce(() => add.promise);
      const { result, hideNotification, showToast } = renderExit({ addPacks });
      act(() => { result.current(DEFAULT_IDS); });
      await flush();
      hideNotification.mockClear();

      act(() => { result.current(DEFAULT_IDS); });

      expect(hideNotification).toHaveBeenCalledTimes(1);
      add.resolve({ added: DEFAULT_COUNT, skipped: 0, packNames: ['Product', 'Writing'] });
      await flush();
      expect(showToast).toHaveBeenLastCalledWith(`${String(DEFAULT_COUNT)} prompts added`, 'success', { sub: 'Product, Writing' });
    });

    it('Try again does nothing once another exit is under way', async () => {
      const add = deferred<AddPacksResult>();
      const addPacks = refused().mockImplementationOnce(() => add.promise);
      const { result, finishWelcome, showToast } = renderExit({ addPacks });
      act(() => { result.current(DEFAULT_IDS); });
      await flush();
      const tryAgain = tryAgainOf(showToast);
      // Tried again from the primary button: that add is under way when the old Notification's Try again is pressed
      act(() => { result.current(DEFAULT_IDS); });

      act(() => { tryAgain(); });
      add.resolve({ added: DEFAULT_COUNT, skipped: 0, packNames: ['Product', 'Writing'] });
      await flush();
      act(() => { vi.advanceTimersByTime(1_000); });

      expect(addPacks).toHaveBeenCalledTimes(2);
      expect(finishWelcome).toHaveBeenCalledTimes(1);
      expect(showToast).toHaveBeenLastCalledWith(`${String(DEFAULT_COUNT)} prompts added`, 'success', { sub: 'Product, Writing' });
    });

    it('Try again that lands after the unmount (the popup closed) finishes nothing and shows nothing', async () => {
      const addPacks = refused();
      const { result, unmount, showToast, finishWelcome } = renderExit({ addPacks });
      act(() => { result.current(DEFAULT_IDS); });
      await flush();
      const tryAgain = tryAgainOf(showToast);

      unmount();
      act(() => { tryAgain(); });
      await flush();

      // The same exit as the primary button's: once the Welcome is gone, nothing is finished or shown
      expect(finishWelcome).not.toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledTimes(1);
    });
  });

  describe('Start empty: the Welcome finished, the Library, then the editor on a new Prompt', () => {
    it('finishes the Welcome and shows the Library at once, and opens the editor 250ms later, not before; the keyboard is left to the editor\'s title', () => {
      const { result, log, addPacks, focusFirstPrompt, openNewPrompt, showToast } = renderExit();

      act(() => { result.current([]); });

      expect(log).toEqual(['hideNotification', 'finishWelcome', 'showLibrary']);
      expect(addPacks).not.toHaveBeenCalled();
      expect(showToast).not.toHaveBeenCalled();

      act(() => { vi.advanceTimersByTime(MOTION.welcomeEditorDelay - 1); });
      expect(openNewPrompt).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(1); });
      expect(openNewPrompt).toHaveBeenCalledTimes(1);
      expect(log).toEqual(['hideNotification', 'finishWelcome', 'showLibrary', 'openNewPrompt']);
      expect(focusFirstPrompt).not.toHaveBeenCalled();
    });

    it('waits 250ms, within the 50ms the ticket allows, under reduced motion too: it is a pause to see the Library, no animation', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }));
      expect(MOTION.welcomeEditorDelay).toBe(250);
      const { result, openNewPrompt } = renderExit();

      act(() => { result.current([]); });
      act(() => { vi.advanceTimersByTime(200); });
      expect(openNewPrompt).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(100); });
      expect(openNewPrompt).toHaveBeenCalledTimes(1);
    });

    it('treats Packs that hold no Prompt, or ids that are no Pack, as no Pack', () => {
      const empty: PromptPack = { id: 'empty', name: 'Empty', color: '#2563EB', defaultSelected: false, prompts: [] };
      const { result, addPacks, finishWelcome } = renderExit({ packs: [empty] });

      act(() => { result.current(['empty', 'not-a-pack']); });

      expect(addPacks).not.toHaveBeenCalled();
      expect(finishWelcome).toHaveBeenCalledTimes(1);
    });

    it('unmounted before the 250ms, opens no editor and leaves no timer', () => {
      const { result, unmount, openNewPrompt } = renderExit();

      act(() => { result.current([]); });
      expect(vi.getTimerCount()).toBe(1);
      unmount();

      expect(vi.getTimerCount()).toBe(0);
      act(() => { vi.advanceTimersByTime(1_000); });
      expect(openNewPrompt).not.toHaveBeenCalled();
    });
  });

  describe('a second press while the first is under way (a double click, Enter then a click) does nothing', () => {
    it('with Packs: one add, one finish, one Notification', async () => {
      const add = deferred<AddPacksResult>();
      const addPacks = vi.fn(() => add.promise);
      const { result, finishWelcome, showToast } = renderExit({ addPacks });

      act(() => {
        result.current(DEFAULT_IDS);
        result.current(DEFAULT_IDS);
      });
      act(() => { result.current(DEFAULT_IDS); });
      add.resolve({ added: DEFAULT_COUNT, skipped: 0, packNames: ['Product', 'Writing'] });
      await flush();
      // And after it: the Welcome has been left
      act(() => { result.current(DEFAULT_IDS); });
      await flush();

      expect(addPacks).toHaveBeenCalledTimes(1);
      expect(finishWelcome).toHaveBeenCalledTimes(1);
      expect(showToast).toHaveBeenCalledTimes(1);
    });

    it('Start empty: one finish, one editor', () => {
      const { result, finishWelcome, openNewPrompt } = renderExit();

      act(() => {
        result.current([]);
        result.current([]);
      });
      act(() => { vi.advanceTimersByTime(1_000); });

      expect(finishWelcome).toHaveBeenCalledTimes(1);
      expect(openNewPrompt).toHaveBeenCalledTimes(1);
    });
  });

  it('unmounted while the add is under way (the popup closed), finishes nothing and shows nothing once it lands', async () => {
    const add = deferred<AddPacksResult>();
    const { result, unmount, finishWelcome, showToast, showLibrary, focusFirstPrompt } = renderExit({ addPacks: vi.fn(() => add.promise) });

    act(() => { result.current(DEFAULT_IDS); });
    unmount();
    add.resolve({ added: DEFAULT_COUNT, skipped: 0, packNames: ['Product', 'Writing'] });
    await flush();

    expect(finishWelcome).not.toHaveBeenCalled();
    expect(showLibrary).not.toHaveBeenCalled();
    expect(focusFirstPrompt).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('uses the latest callbacks it was given when the editor opens', () => {
    const { result, rerender, options, openNewPrompt } = renderExit();
    const later = vi.fn();

    act(() => { result.current([]); });
    // App renders again, with new handlers, before the 250ms are up
    rerender({ ...options, openNewPrompt: later });
    act(() => { vi.advanceTimersByTime(MOTION.welcomeEditorDelay); });

    expect(later).toHaveBeenCalledTimes(1);
    expect(openNewPrompt).not.toHaveBeenCalled();
  });
});
