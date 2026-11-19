/**
 * Leaving the Welcome for a ready Library (My-Prompt-Manager-ojz.9), in App over the store of an
 * opening: the Packs selected added, the Welcome finished, the Library on All with a Notification
 * (scenario 2); or no Pack, the Library, then the editor on a new Prompt (scenario 3); a refused
 * add keeping the Welcome at its last step, its failure Notification staying with Try again
 * (My-Prompt-Manager-ojz.20) until a Pack is toggled, and its Try again refused again keeping the
 * keyboard (My-Prompt-Manager-5lf); never What's new right after the Welcome out of Debug
 * mode. StorageManager is the real one over the test storage, so the Prompts listed are the ones
 * stored.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../../App';
import { type LaunchStateChange, writeLaunchState } from '../../launch/write';
import { SITE_SETTINGS_KEY } from '../../services/siteSettings';
import { getMockStorageManager } from '../../test/mocks';
import { MOTION } from '../../theme/motion';
import type { Prompt } from '../../types';
import { PACKS } from '../../welcome/packs';
import { WELCOME_KEY, type WelcomeRecord } from '../../welcome/storage';
import { WHATS_NEW_KEY } from '../../whatsNew/storage';

// The real writer, watched: how many times the Welcome is recorded finished
vi.mock('../../launch/write', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../launch/write')>();
  return { ...actual, writeLaunchState: vi.fn(actual.writeLaunchState) };
});

const WHATS_NEW = /what.s new/i;
const LIBRARY_HEADING = /my prompt manager/i;

const DEFAULTS = PACKS.filter((pack) => pack.defaultSelected);
const DEFAULT_PROMPTS = DEFAULTS.flatMap((pack) => pack.prompts);
const ADDED = `${String(DEFAULT_PROMPTS.length)} prompts added`;
/** The Notification's second line after an exit with Packs: the next step, in the AI chat (My-Prompt-Manager-ojz.19) */
const IN_THE_CHAT = 'Open your AI chat and type //';

/** The store of an opening: the Library, the Welcome record, the What's new record, Debug mode */
const openingOver = async ({
  prompts = [],
  welcome,
  installedVersion = '2.0.0',
  lastSeenVersion,
  debugMode = false
}: {
  prompts?: Prompt[];
  welcome: WelcomeRecord;
  installedVersion?: string;
  lastSeenVersion?: string;
  debugMode?: boolean;
}): Promise<void> => {
  await chrome.storage.local.set({
    prompts,
    [WELCOME_KEY]: welcome,
    [WHATS_NEW_KEY]: { installedVersion, ...(lastSeenVersion === undefined ? {} : { lastSeenVersion }) },
    [SITE_SETTINGS_KEY]: { debugMode }
  });
};

const stored = async <T,>(key: string): Promise<T> => (await chrome.storage.local.get(key))[key] as T;

/** Lets a screen that should not come show up */
const settle = (ms = 20): Promise<void> => act(async () => { await new Promise((resolve) => { setTimeout(resolve, ms); }); });

const primary = (): HTMLElement => screen.getByTestId('welcome-primary');

/** Renders the popup and waits for the Welcome at `step` (0 to 2) */
const openWelcome = async (step: number): Promise<void> => {
  render(<App />);
  expect(await screen.findByTestId('welcome')).toHaveAttribute('data-welcome-step', String(step));
};

/**
 * Watches the document for an element that brings one of `texts`, even one gone again before the
 * test looks: the Library's loading state, or its empty state, flashing on the way out of the Welcome
 */
const watchForFlash = (texts: readonly string[]): (() => string[]) => {
  const seen = new Set<string>();
  const note = (records: readonly MutationRecord[]): void => {
    for (const node of records.flatMap((record) => [...record.addedNodes])) {
      for (const text of texts.filter((candidate) => node.textContent?.includes(candidate))) {
        seen.add(text);
      }
    }
  };
  const observer = new MutationObserver(note);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => {
    note(observer.takeRecords());
    observer.disconnect();
    return [...seen];
  };
};

/**
 * Counts the Prompt cards added to the document, even ones gone again before the test looks: the
 * Library shown, for a moment, before both its Prompts and its Categories are read
 */
const watchForCards = (): (() => number) => {
  let added = 0;
  const note = (records: readonly MutationRecord[]): void => {
    for (const node of records.flatMap((record) => [...record.addedNodes])) {
      if (node instanceof Element && (node.matches('[data-testid="prompt-card"]') || node.querySelector('[data-testid="prompt-card"]'))) {
        added += 1;
      }
    }
  };
  const observer = new MutationObserver(note);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => {
    note(observer.takeRecords());
    observer.disconnect();
    return added;
  };
};

/**
 * Makes each read of chrome.storage.local answer in a later task, as the real one does (it crosses
 * to the browser process): a render can then land between a read and its answer, so a Library
 * shown while it is read again would show its loading state
 */
const readsTakeATask = (): void => {
  const read = vi.mocked(chrome.storage.local.get).getMockImplementation() as unknown as (keys: unknown) => Promise<Record<string, unknown>>;
  vi.mocked(chrome.storage.local.get).mockImplementation(async (keys) => {
    await new Promise((resolve) => { setTimeout(resolve, 5); });
    return read(keys);
  });
};

/** The titles of the Prompt cards the Library lists */
const cardTitles = (): string[] =>
  screen.getAllByTestId('prompt-card').map((card) => within(card).getByRole('heading').textContent ?? '');

const welcomeDoneWrites = (): LaunchStateChange[] =>
  vi.mocked(writeLaunchState).mock.calls.map(([change]) => change).filter((change) => change.kind === 'welcome-done');

describe('App: leaving the Welcome for a ready Library', () => {
  beforeEach(async () => {
    window.location.search = '';
    vi.mocked(chrome.runtime.getManifest).mockReturnValue({ version: '2.0.0' } as chrome.runtime.Manifest);
    const actual = await vi.importActual<typeof import('../../launch/write')>('../../launch/write');
    vi.mocked(writeLaunchState).mockReset().mockImplementation(actual.writeLaunchState);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('S2, AC1: with Packs, the Packs added, the Welcome finished, the Library and the Notification', () => {
    it('Skip, then Add 9 prompts: the Library lists the Packs\' Prompts on All, with "9 prompts added" and "Open your AI chat and type //" as its sub, and no loading or empty state on the way', async () => {
      await openingOver({ welcome: { status: 'pending', step: 0 } });
      await openWelcome(0);

      fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
      expect(primary()).toHaveTextContent(`Add ${String(DEFAULT_PROMPTS.length)} prompts`);
      readsTakeATask();
      const flashes = watchForFlash(['Loading your prompts', 'Your library is empty']);
      fireEvent.click(primary());

      await waitFor(() => { expect(screen.queryByTestId('welcome')).not.toBeInTheDocument(); });
      // The Library as it first shows: the cards already there
      expect(screen.getByRole('heading', { name: LIBRARY_HEADING })).toBeInTheDocument();
      expect(cardTitles().sort()).toEqual(DEFAULT_PROMPTS.map((prompt) => prompt.title).sort());
      expect(flashes()).toEqual([]);

      expect(screen.getByRole('radio', { name: /^All/ })).toHaveAttribute('aria-checked', 'true');
      const notification = screen.getByTestId('toast');
      expect(notification).toHaveAttribute('role', 'status');
      expect(notification).toHaveAttribute('data-type', 'success');
      expect(within(notification).getByText(ADDED)).toBeInTheDocument();
      // Read whole on the Library: its second line on a line of its own, never cut (My-Prompt-Manager-ojz.19)
      expect(within(notification).getByText(IN_THE_CHAT)).not.toHaveClass('truncate');
      expect(within(notification).getByTestId('toast-text')).toHaveClass('flex-col');
      expect(notification).toHaveClass('w-max', 'min-h-10');

      // Stored: the Prompts, each in its Pack's Category, and the Welcome finished
      const prompts = await stored<Prompt[]>('prompts');
      expect(prompts.map(({ content, category }) => ({ content, category }))).toEqual(
        DEFAULTS.flatMap((pack) => pack.prompts.map(({ content }) => ({ content, category: pack.name })))
      );
      await waitFor(async () => { expect(await stored(WELCOME_KEY)).toEqual({ status: 'done' }); });
      expect(screen.queryByRole('dialog', { name: WHATS_NEW })).not.toBeInTheDocument();
    });

    it('the Packs written before the Welcome is recorded finished', async () => {
      await openingOver({ welcome: { status: 'pending', step: 2 } });
      await openWelcome(2);
      const order: string[] = [];
      const addPacks = vi.mocked(getMockStorageManager().addPacks);
      const add = addPacks.getMockImplementation();
      addPacks.mockImplementationOnce(async (packs) => {
        const result = await (add as typeof addPacks)(packs);
        order.push('Packs written');
        return result;
      });
      const actual = await vi.importActual<typeof import('../../launch/write')>('../../launch/write');
      vi.mocked(writeLaunchState).mockImplementation((change, options) => {
        order.push(change.kind);
        return actual.writeLaunchState(change, options);
      });

      fireEvent.click(primary());

      await screen.findByRole('heading', { name: LIBRARY_HEADING });
      expect(order).toEqual(['Packs written', 'welcome-done']);
    });

    it('a double click and an Enter on the primary button add the Packs once and finish the Welcome once', async () => {
      await openingOver({ welcome: { status: 'pending', step: 2 } });
      await openWelcome(2);
      // The add takes a while: every press lands before it is done
      const addPacks = vi.mocked(getMockStorageManager().addPacks);
      const add = addPacks.getMockImplementation() as typeof addPacks;
      let release = (): void => undefined;
      const held = new Promise<void>((resolve) => { release = resolve; });
      addPacks.mockImplementation(async (packs) => {
        await held;
        return add(packs);
      });

      fireEvent.click(primary());
      fireEvent.click(primary());
      fireEvent.keyDown(document.body, { key: 'Enter' });
      expect(screen.getByTestId('welcome')).toBeInTheDocument();
      act(() => { release(); });

      await screen.findByRole('heading', { name: LIBRARY_HEADING });
      await settle();
      expect(addPacks).toHaveBeenCalledTimes(1);
      expect(await stored<Prompt[]>('prompts')).toHaveLength(DEFAULT_PROMPTS.length);
      expect(cardTitles()).toHaveLength(DEFAULT_PROMPTS.length);
      expect(welcomeDoneWrites()).toHaveLength(1);
      expect(screen.getAllByTestId('toast')).toHaveLength(1);
    });
  });

  describe('S3, AC2: Start empty, the Library, then the editor on a new Prompt 250ms later', () => {
    it('shows the empty Library at once, and the editor 250ms later, not before', async () => {
      await openingOver({ welcome: { status: 'pending', step: 2, packs: [] } });
      await openWelcome(2);
      expect(primary()).toHaveTextContent('Start empty');
      vi.useFakeTimers();

      fireEvent.click(primary());

      expect(screen.queryByTestId('welcome')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: LIBRARY_HEADING })).toBeInTheDocument();
      expect(screen.getByText('Your library is empty')).toBeInTheDocument();
      expect(screen.queryByTestId('editor-sheet')).not.toBeInTheDocument();

      act(() => { vi.advanceTimersByTime(MOTION.welcomeEditorDelay - 1); });
      expect(screen.queryByTestId('editor-sheet')).not.toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(1); });

      const editor = screen.getByTestId('editor-sheet');
      expect(within(editor).getByLabelText(/title/i)).toHaveValue('');
      expect(within(editor).queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
      vi.useRealTimers();
      await waitFor(async () => { expect(await stored(WELCOME_KEY)).toEqual({ status: 'done' }); });
      expect(getMockStorageManager().addPacks).not.toHaveBeenCalled();
    });

    it('the popup closed before the 250ms: no editor, and no error', async () => {
      await openingOver({ welcome: { status: 'pending', step: 2, packs: [] } });
      const { unmount } = render(<App />);
      await screen.findByTestId('welcome');
      vi.useFakeTimers();
      const errors = vi.spyOn(console, 'error');

      fireEvent.click(primary());
      unmount();
      act(() => { vi.advanceTimersByTime(MOTION.welcomeEditorDelay * 4); });

      expect(screen.queryByTestId('editor-sheet')).not.toBeInTheDocument();
      expect(errors).not.toHaveBeenCalled();
    });
  });

  describe('AC3: the add refused, the Welcome stays at its last step, nothing recorded finished, and the user tries again or starts empty', () => {
    const refuseOnce = () => {
      vi.mocked(getMockStorageManager().addPacks).mockRejectedValueOnce(
        Object.assign(new Error('Storage quota exceeded'), { type: 'STORAGE_QUOTA_EXCEEDED' })
      );
    };

    it('shows a failure Notification over the Welcome at step 3, records nothing, and a second press adds the Packs', async () => {
      await openingOver({ welcome: { status: 'pending', step: 2 } });
      await openWelcome(2);
      refuseOnce();

      fireEvent.click(primary());

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent("Couldn't add the prompts");
      expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
      // The keyboard stays where it was: the failure takes no focus
      expect(alert).not.toContainElement(document.activeElement as HTMLElement | null);
      expect(screen.getByTestId('welcome')).toHaveAttribute('data-welcome-step', '2');
      expect(primary()).toHaveTextContent(`Add ${String(DEFAULT_PROMPTS.length)} prompts`);
      expect(screen.queryByRole('heading', { name: LIBRARY_HEADING })).not.toBeInTheDocument();
      await settle();
      expect(await stored(WELCOME_KEY)).toEqual({ status: 'pending', step: 2 });
      expect(welcomeDoneWrites()).toEqual([]);
      expect(await stored('prompts')).toEqual([]);

      // Tried again
      fireEvent.click(primary());

      await waitFor(() => { expect(screen.queryByTestId('welcome')).not.toBeInTheDocument(); });
      expect(cardTitles()).toHaveLength(DEFAULT_PROMPTS.length);
      expect(screen.getByTestId('toast')).toHaveTextContent(ADDED);
      await waitFor(async () => { expect(await stored(WELCOME_KEY)).toEqual({ status: 'done' }); });
    });

    it('the failure Notification stays until the user acts: still there 10s after it shows, with no input', async () => {
      await openingOver({ welcome: { status: 'pending', step: 2 } });
      await openWelcome(2);
      refuseOnce();
      // Faked before the failure shows, so any time of its own would be on this clock; still running
      // with the real one, so the add and the reads it awaits settle
      vi.useFakeTimers({ shouldAdvanceTime: true });
      fireEvent.click(primary());
      await screen.findByRole('alert');

      // Past the 6s a failure had, and past 10s
      act(() => { vi.advanceTimersByTime(10_001); });

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent("Couldn't add the prompts");
      expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(60_000); });
      expect(screen.getByRole('alert')).toBeInTheDocument();
      vi.useRealTimers();
    });

    it('Try again in the failure Notification adds the same Packs: the Library with each of them once, the Notification of the add, the Welcome done', async () => {
      await openingOver({ welcome: { status: 'pending', step: 2 } });
      await openWelcome(2);
      refuseOnce();
      fireEvent.click(primary());
      const alert = await screen.findByRole('alert');

      fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));

      await waitFor(() => { expect(screen.queryByTestId('welcome')).not.toBeInTheDocument(); });
      const addPacks = vi.mocked(getMockStorageManager().addPacks);
      expect(addPacks).toHaveBeenCalledTimes(2);
      expect(addPacks.mock.calls[1]?.[0]).toEqual(addPacks.mock.calls[0]?.[0]);
      expect(cardTitles().sort()).toEqual(DEFAULT_PROMPTS.map((prompt) => prompt.title).sort());
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByTestId('toast')).toHaveTextContent(ADDED);
      await waitFor(async () => { expect(await stored(WELCOME_KEY)).toEqual({ status: 'done' }); });
      expect(welcomeDoneWrites()).toHaveLength(1);
    });

    it('Try again refused too: the failure Notification again, the Welcome still at its last step, nothing recorded', async () => {
      await openingOver({ welcome: { status: 'pending', step: 2 } });
      await openWelcome(2);
      refuseOnce();
      refuseOnce();
      fireEvent.click(primary());
      fireEvent.click(within(await screen.findByRole('alert')).getByRole('button', { name: 'Try again' }));

      await waitFor(() => { expect(getMockStorageManager().addPacks).toHaveBeenCalledTimes(2); });
      const again = await screen.findByRole('alert');
      expect(again).toHaveTextContent("Couldn't add the prompts");
      expect(within(again).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
      expect(screen.getByTestId('welcome')).toHaveAttribute('data-welcome-step', '2');
      await settle();
      expect(await stored(WELCOME_KEY)).toEqual({ status: 'pending', step: 2 });
      expect(welcomeDoneWrites()).toEqual([]);
    });

    it.each([
      ['Back', () => screen.getByRole('button', { name: 'Back' })],
      ['the first dot', () => screen.getByRole('button', { name: 'Step 1 of 3' })]
    ])('a step change (%s) hides the failure Notification: it belongs to the last step', async (_how, control) => {
      await openingOver({ welcome: { status: 'pending', step: 2 } });
      await openWelcome(2);
      refuseOnce();
      fireEvent.click(primary());
      await screen.findByRole('alert');

      fireEvent.click(control());

      expect(screen.getByTestId('welcome')).not.toHaveAttribute('data-welcome-step', '2');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    // My-Prompt-Manager-5lf: its Try again would add the refused selection, no longer the one on screen
    it('a Pack toggled hides the failure Notification, the keyboard stays on that Pack, and the primary button adds exactly the Packs on screen', async () => {
      const packToggle = (id: string): HTMLElement => {
        const pack = PACKS.find((candidate) => candidate.id === id);
        return screen.getByRole('button', { name: new RegExp(`^${pack?.name ?? id} `) });
      };
      const hiring = PACKS.find((pack) => pack.id === 'hiring');
      await openingOver({ welcome: { status: 'pending', step: 2 } });
      await openWelcome(2);
      refuseOnce();
      fireEvent.click(primary());
      await screen.findByRole('alert');

      packToggle('product').focus();
      fireEvent.click(packToggle('product'));

      expect(packToggle('product')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
      expect(packToggle('product')).toHaveFocus();

      // Writing out and Hiring in: the screen offers Hiring alone, and the primary button adds it
      fireEvent.click(packToggle('writing'));
      fireEvent.click(packToggle('hiring'));
      expect(primary()).toHaveTextContent(`Add ${String(hiring?.prompts.length)} prompts`);
      fireEvent.click(primary());

      await waitFor(() => { expect(screen.queryByTestId('welcome')).not.toBeInTheDocument(); });
      const addPacks = vi.mocked(getMockStorageManager().addPacks);
      expect(addPacks).toHaveBeenCalledTimes(2);
      expect(addPacks.mock.calls[1]?.[0].map((pack) => pack.id)).toEqual(['hiring']);
      expect(cardTitles().sort()).toEqual(hiring?.prompts.map((prompt) => prompt.title).sort());
    });

    // My-Prompt-Manager-5lf, R3 of review round 1: a toggle during the add would bring back a Try again about other Packs
    it('a Pack toggled while the Packs are being added does nothing, so the refusal\'s Try again adds the Packs on screen; once refused, a toggle works again', async () => {
      await openingOver({ welcome: { status: 'pending', step: 2 } });
      await openWelcome(2);
      const addPacks = vi.mocked(getMockStorageManager().addPacks);
      let refuse = (): void => undefined;
      addPacks.mockImplementationOnce(() => new Promise((_resolve, reject) => {
        refuse = () => { reject(Object.assign(new Error('Storage quota exceeded'), { type: 'STORAGE_QUOTA_EXCEEDED' })); };
      }));
      const product = (): HTMLElement => screen.getByRole('button', { name: /^Product / });

      fireEvent.click(primary());
      fireEvent.click(product());

      expect(product()).toHaveAttribute('aria-pressed', 'true');
      expect(primary()).toHaveTextContent(`Add ${String(DEFAULT_PROMPTS.length)} prompts`);
      act(() => { refuse(); });
      const alert = await screen.findByRole('alert');
      expect(product()).toHaveAttribute('aria-pressed', 'true');

      // Its Try again adds what the screen shows: the Packs of the first add
      refuseOnce();
      fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
      await waitFor(() => { expect(addPacks).toHaveBeenCalledTimes(2); });
      expect(addPacks.mock.calls[1]?.[0]).toEqual(addPacks.mock.calls[0]?.[0]);
      await screen.findByRole('alert');

      // The add refused, the Packs answer again, and the toggle hides the failure
      fireEvent.click(product());
      expect(product()).toHaveAttribute('aria-pressed', 'false');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    // My-Prompt-Manager-5lf: the pressed Try again leaves with its Notification, which would drop the keyboard to the body
    it('Try again from the keyboard, refused again: the keyboard is on the Try again of the failure Notification now on screen', async () => {
      await openingOver({ welcome: { status: 'pending', step: 2 } });
      await openWelcome(2);
      refuseOnce();
      refuseOnce();
      fireEvent.click(primary());
      const first = await screen.findByRole('alert');
      const firstTryAgain = within(first).getByRole('button', { name: 'Try again' });
      firstTryAgain.focus();

      fireEvent.click(firstTryAgain);

      await waitFor(() => { expect(getMockStorageManager().addPacks).toHaveBeenCalledTimes(2); });
      await waitFor(() => { expect(screen.getByRole('alert')).not.toBe(first); });
      const again = screen.getByRole('alert');
      expect(again).toHaveTextContent("Couldn't add the prompts");
      await waitFor(() => { expect(within(again).getByRole('button', { name: 'Try again' })).toHaveFocus(); });
      expect(document.activeElement).not.toBe(document.body);
      expect(screen.getByTestId('welcome')).toHaveAttribute('data-welcome-step', '2');
    });

    it('Start empty stays on the step: the Packs unselected, the primary button, now Start empty, leaves for the Library, then the editor, the failure Notification gone with the Welcome', async () => {
      await openingOver({ welcome: { status: 'pending', step: 2 } });
      await openWelcome(2);
      refuseOnce();
      fireEvent.click(primary());
      await screen.findByRole('alert');

      for (const pack of DEFAULTS) {
        fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${pack.name} `) }));
      }
      expect(primary()).toHaveTextContent('Start empty');
      fireEvent.click(primary());

      expect(screen.getByText('Your library is empty')).toBeInTheDocument();
      // Its Try again would do nothing over the Library and the editor: it goes as the exit starts
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
      expect(await screen.findByTestId('editor-sheet')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(getMockStorageManager().addPacks).toHaveBeenCalledTimes(1);
    });

    it("a second press with the Packs hides the failure Notification while that add runs, then shows the add's", async () => {
      await openingOver({ welcome: { status: 'pending', step: 2 } });
      await openWelcome(2);
      refuseOnce();
      fireEvent.click(primary());
      await screen.findByRole('alert');
      // The add tried again takes a while
      const addPacks = vi.mocked(getMockStorageManager().addPacks);
      const add = addPacks.getMockImplementation() as typeof addPacks;
      let release = (): void => undefined;
      const held = new Promise<void>((resolve) => { release = resolve; });
      addPacks.mockImplementationOnce(async (packs) => {
        await held;
        return add(packs);
      });

      fireEvent.click(primary());

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByTestId('welcome')).toBeInTheDocument();
      act(() => { release(); });
      await waitFor(() => { expect(screen.queryByTestId('welcome')).not.toBeInTheDocument(); });
      expect(screen.getByTestId('toast')).toHaveTextContent(ADDED);
    });
  });

  describe('the Packs added, then the Library cannot be read again: Error Loading Data offers Try again (My-Prompt-Manager-ojz.22)', () => {
    const ERROR_TITLE = 'Error Loading Data';

    /** The add stores the Packs as it does for real; then the Library's next reads, named here, fail once each */
    const readsFailOnceAfterTheAdd = (reads: readonly ('getPrompts' | 'getCategories')[]) => {
      const storageManager = getMockStorageManager();
      const addPacks = vi.mocked(storageManager.addPacks);
      const add = addPacks.getMockImplementation() as typeof addPacks;
      addPacks.mockImplementationOnce(async (packs) => {
        const result = await add(packs);
        for (const read of reads) {
          vi.mocked(storageManager[read]).mockRejectedValueOnce(new Error('Storage could not be read'));
        }
        return result;
      });
      return addPacks;
    };

    it('AC1: shows Error Loading Data with Try again under "9 prompts added", never "Couldn\'t add the prompts"; Try again lists the 9 Prompts, the add not tried again and the Welcome still finished', async () => {
      await openingOver({ welcome: { status: 'pending', step: 2 } });
      await openWelcome(2);
      const addPacks = readsFailOnceAfterTheAdd(['getPrompts']);

      fireEvent.click(primary());

      expect(await screen.findByRole('heading', { name: ERROR_TITLE })).toBeInTheDocument();
      const tryAgain = screen.getByRole('button', { name: 'Try again' });
      expect(screen.getByTestId('toast')).toHaveTextContent(ADDED);
      expect(screen.queryByText("Couldn't add the prompts")).not.toBeInTheDocument();
      expect(screen.queryByTestId('welcome')).not.toBeInTheDocument();
      // The Packs are in, and the Welcome is finished: the failed read lost nothing
      expect(await stored<Prompt[]>('prompts')).toHaveLength(DEFAULT_PROMPTS.length);
      await waitFor(async () => { expect(await stored(WELCOME_KEY)).toEqual({ status: 'done' }); });

      fireEvent.click(tryAgain);

      await waitFor(() => { expect(screen.queryByRole('heading', { name: ERROR_TITLE })).not.toBeInTheDocument(); });
      expect(await screen.findAllByTestId('prompt-card')).toHaveLength(DEFAULT_PROMPTS.length);
      expect(cardTitles().sort()).toEqual(DEFAULT_PROMPTS.map((prompt) => prompt.title).sort());
      expect(screen.queryByText("Couldn't add the prompts")).not.toBeInTheDocument();
      expect(screen.queryByTestId('welcome')).not.toBeInTheDocument();
      expect(addPacks).toHaveBeenCalledTimes(1);
      expect(welcomeDoneWrites()).toHaveLength(1);
      expect(await stored(WELCOME_KEY)).toEqual({ status: 'done' });
    });

    it('Try again reads the Categories again too: with both reads failed, the Library filter offers the Packs\' Categories after it', async () => {
      await openingOver({ welcome: { status: 'pending', step: 2 } });
      await openWelcome(2);
      readsFailOnceAfterTheAdd(['getPrompts', 'getCategories']);
      fireEvent.click(primary());
      expect(await screen.findByRole('heading', { name: ERROR_TITLE })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

      expect(await screen.findAllByTestId('prompt-card')).toHaveLength(DEFAULT_PROMPTS.length);
      for (const pack of DEFAULTS) {
        expect(await screen.findByRole('radio', { name: pack.name })).toBeInTheDocument();
      }
    });

    it('Try again whose read fails again: Error Loading Data again, with Try again', async () => {
      await openingOver({ welcome: { status: 'pending', step: 2 } });
      await openWelcome(2);
      readsFailOnceAfterTheAdd(['getPrompts', 'getPrompts']);
      fireEvent.click(primary());
      expect(await screen.findByRole('heading', { name: ERROR_TITLE })).toBeInTheDocument();
      const getPrompts = vi.mocked(getMockStorageManager().getPrompts);
      const readsBefore = getPrompts.mock.calls.length;

      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

      await waitFor(() => { expect(getPrompts.mock.calls.length).toBeGreaterThan(readsBefore); });
      expect(await screen.findByRole('heading', { name: ERROR_TITLE })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
      expect(screen.queryAllByTestId('prompt-card')).toHaveLength(0);
    });

    // CR26 of PR #607: the Categories are part of the Library's read
    it('only the Categories read fails after the add: Error Loading Data with Try again under "9 prompts added", never the Library without its Category filters; Try again lists the 9 Prompts and the Packs\' Categories', async () => {
      await openingOver({ welcome: { status: 'pending', step: 2 } });
      await openWelcome(2);
      const addPacks = readsFailOnceAfterTheAdd(['getCategories']);
      const cardsShown = watchForCards();

      fireEvent.click(primary());

      expect(await screen.findByRole('heading', { name: ERROR_TITLE })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
      expect(screen.getByTestId('toast')).toHaveTextContent(ADDED);
      expect(screen.queryByText("Couldn't add the prompts")).not.toBeInTheDocument();
      expect(cardsShown()).toBe(0);

      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

      expect(await screen.findAllByTestId('prompt-card')).toHaveLength(DEFAULT_PROMPTS.length);
      for (const pack of DEFAULTS) {
        expect(await screen.findByRole('radio', { name: pack.name })).toBeInTheDocument();
        expect(screen.getAllByTitle(`Category: ${pack.name}`)).toHaveLength(pack.prompts.length);
      }
      expect(screen.queryByRole('heading', { name: ERROR_TITLE })).not.toBeInTheDocument();
      expect(addPacks).toHaveBeenCalledTimes(1);
      expect(welcomeDoneWrites()).toHaveLength(1);
    });

    it('Try again that reads the Prompts but not the Categories: Error Loading Data again, with Try again, never the Library without its Category filters; the next Try again lists the Packs\' Categories', async () => {
      await openingOver({ welcome: { status: 'pending', step: 2 } });
      await openWelcome(2);
      // Both reads fail after the add; at the first Try again the Prompts are read and the Categories are not
      readsFailOnceAfterTheAdd(['getPrompts', 'getCategories', 'getCategories']);
      fireEvent.click(primary());
      expect(await screen.findByRole('heading', { name: ERROR_TITLE })).toBeInTheDocument();
      const getCategories = vi.mocked(getMockStorageManager().getCategories);
      const readsBefore = getCategories.mock.calls.length;
      const cardsShown = watchForCards();

      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

      await waitFor(() => { expect(getCategories.mock.calls.length).toBeGreaterThan(readsBefore); });
      expect(await screen.findByRole('heading', { name: ERROR_TITLE })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
      expect(cardsShown()).toBe(0);

      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

      expect(await screen.findAllByTestId('prompt-card')).toHaveLength(DEFAULT_PROMPTS.length);
      for (const pack of DEFAULTS) {
        expect(await screen.findByRole('radio', { name: pack.name })).toBeInTheDocument();
        expect(screen.getAllByTitle(`Category: ${pack.name}`)).toHaveLength(pack.prompts.length);
      }
      expect(screen.queryByRole('heading', { name: ERROR_TITLE })).not.toBeInTheDocument();
    });
  });

  describe('AC4: no What\'s new right after the Welcome out of Debug mode, though its Release has notes not seen', () => {
    // A user who installed 1.9.0, left the Welcome pending, then got 2.0.0: What's new would show without the Welcome
    it.each([
      ['Add 9 prompts', undefined],
      ['Start empty', []]
    ])('%s: the Library, and no What\'s new in that opening', async (label, packs) => {
      await openingOver({
        welcome: { status: 'pending', step: 2, ...(packs === undefined ? {} : { packs }) },
        installedVersion: '1.9.0',
        lastSeenVersion: '1.9.0'
      });
      await openWelcome(2);
      expect(primary()).toHaveTextContent(label);

      fireEvent.click(primary());

      expect(await screen.findByRole('heading', { name: LIBRARY_HEADING })).toBeInTheDocument();
      // Past the editor's 250ms too
      await settle(MOTION.welcomeEditorDelay + 100);
      expect(screen.queryByRole('dialog', { name: WHATS_NEW })).not.toBeInTheDocument();
      // And the Release recorded seen, so no later opening brings it either
      await waitFor(async () => {
        expect(await stored(WHATS_NEW_KEY)).toEqual({ installedVersion: '1.9.0', lastSeenVersion: '2.0.0' });
      });
    });
  });

  // My-Prompt-Manager-ojz.17: as the Welcome hands over, the keyboard lands where the next step is
  describe('where the keyboard lands as the Welcome hands over', () => {
    /** The first card the Library lists: its Prompt's title and its Copy */
    const firstCard = (): { title: string; copy: HTMLElement } => {
      const card = screen.getAllByTestId('prompt-card')[0];
      const title = within(card).getByRole('heading').textContent ?? '';
      return { title, copy: within(card).getByRole('button', { name: `Copy content of ${title} to clipboard` }) };
    };

    it('S2: with Packs, the keyboard is on the first Prompt\'s Copy as the cards show, named after that Prompt, so Enter copies it', async () => {
      await openingOver({ welcome: { status: 'pending', step: 2 } });
      await openWelcome(2);
      primary().focus();

      fireEvent.click(primary());

      await waitFor(() => { expect(screen.queryByTestId('welcome')).not.toBeInTheDocument(); });
      // In the same commit as the cards: no frame shows them with the keyboard nowhere
      const { title, copy } = firstCard();
      expect(document.activeElement).toBe(copy);
      // The Notification says what was added; nothing else is announced
      expect(screen.getByTestId('toast')).toHaveTextContent(ADDED);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      // Enter on a button presses it
      fireEvent.click(copy);
      const content = DEFAULT_PROMPTS.find((prompt) => prompt.title === title)?.content;
      expect(content).toBeDefined();
      await waitFor(() => { expect(navigator.clipboard.writeText).toHaveBeenCalledWith(content); });
    });

    it('S2: leaves the keyboard where the user already put it while the Packs were added', async () => {
      await openingOver({ welcome: { status: 'pending', step: 2 } });
      await openWelcome(2);
      const addPacks = vi.mocked(getMockStorageManager().addPacks);
      const add = addPacks.getMockImplementation() as typeof addPacks;
      let release = (): void => undefined;
      const held = new Promise<void>((resolve) => { release = resolve; });
      addPacks.mockImplementationOnce(async (packs) => {
        await held;
        return add(packs);
      });
      // Something outside the Welcome, which the exit does not take away
      const elsewhere = document.createElement('button');
      elsewhere.textContent = 'Elsewhere';
      document.body.append(elsewhere);

      try {
        fireEvent.click(primary());
        elsewhere.focus();
        act(() => { release(); });

        await waitFor(() => { expect(screen.queryByTestId('welcome')).not.toBeInTheDocument(); });
        expect(screen.getAllByTestId('prompt-card')).toHaveLength(DEFAULT_PROMPTS.length);
        await settle();
        expect(document.activeElement).toBe(elsewhere);
      } finally {
        elsewhere.remove();
      }
    });

    it('S2: moves the keyboard once: the Library shown again later, with the keyboard nowhere, leaves it there', async () => {
      await openingOver({ welcome: { status: 'pending', step: 2 } });
      await openWelcome(2);
      fireEvent.click(primary());
      await waitFor(() => { expect(document.activeElement).toBe(firstCard().copy); });

      // The keyboard on nothing, and kept there: fireEvent.click moves no focus, so the round trip
      // to Categories and back leaves it on body unless the Library takes it again
      act(() => { (document.activeElement as HTMLElement).blur(); });
      fireEvent.click(screen.getByRole('tab', { name: /categories/i }));
      fireEvent.click(await screen.findByRole('tab', { name: /library/i }));
      await screen.findAllByTestId('prompt-card');
      await settle();

      expect(document.activeElement).not.toBe(firstCard().copy);
      expect(document.activeElement).toBe(document.body);
    });

    it('S3: Start empty leaves the keyboard on the editor\'s title field, and nothing takes it to the Library', async () => {
      await openingOver({ welcome: { status: 'pending', step: 2, packs: [] } });
      await openWelcome(2);
      primary().focus();

      fireEvent.click(primary());

      const editor = await screen.findByTestId('editor-sheet');
      const title = within(editor).getByLabelText(/title/i);
      await waitFor(() => { expect(document.activeElement).toBe(title); });
      await settle(MOTION.welcomeEditorDelay);
      expect(document.activeElement).toBe(title);
    });

    it('Debug mode: What\'s new over the Library keeps the keyboard, and gives it back to the first Prompt\'s Copy as it closes', async () => {
      await openingOver({ welcome: { status: 'done' }, installedVersion: '1.9.0', lastSeenVersion: '1.9.0', debugMode: true });
      await openWelcome(0);
      fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

      fireEvent.click(primary());

      const whatsNew = await screen.findByRole('dialog', { name: WHATS_NEW });
      await waitFor(() => { expect(whatsNew).toContainElement(document.activeElement as HTMLElement); });
      const { copy } = firstCard();

      fireEvent.click(within(whatsNew).getByRole('button', { name: /got it/i }));

      await waitFor(() => { expect(document.activeElement).toBe(copy); });
    });
  });

  describe('Debug mode', () => {
    it('the Packs already in the Library from an earlier Debug finish: no duplicate, a Notification that the Library is ready, then What\'s new', async () => {
      const already = DEFAULTS.flatMap((pack) =>
        pack.prompts.map((prompt, index) => ({
          id: `${pack.id}-${String(index)}`,
          title: prompt.title,
          content: prompt.content,
          category: pack.name,
          createdAt: 1,
          updatedAt: 1
        }))
      );
      await openingOver({ prompts: already, welcome: { status: 'done' }, installedVersion: '1.9.0', lastSeenVersion: '1.9.0', debugMode: true });
      await openWelcome(0);

      fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
      fireEvent.click(primary());

      expect(await screen.findByRole('dialog', { name: WHATS_NEW })).toBeInTheDocument();
      const notification = screen.getByTestId('toast');
      expect(notification).toHaveTextContent('Your library is ready');
      expect(notification).toHaveTextContent(IN_THE_CHAT);
      expect(await stored<Prompt[]>('prompts')).toHaveLength(already.length);
      // Nothing recorded in Debug mode
      expect(await stored(WELCOME_KEY)).toEqual({ status: 'done' });
      expect(await stored(WHATS_NEW_KEY)).toEqual({ installedVersion: '1.9.0', lastSeenVersion: '1.9.0' });
    });
  });
});
