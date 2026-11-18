/**
 * Leaving the Welcome for a ready Library (My-Prompt-Manager-ojz.9), in App over the store of an
 * opening: the Packs selected added, the Welcome finished, the Library on All with a Notification
 * (scenario 2); or no Pack, the Library, then the editor on a new Prompt (scenario 3); a refused
 * add keeping the Welcome at its last step; never What's new right after the Welcome out of Debug
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
const DEFAULT_NAMES = DEFAULTS.map((pack) => pack.name).join(', ');

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
    it('Skip, then Add 9 prompts: the Library lists the Packs\' Prompts on All, with "9 prompts added" and the Packs as its sub, and no loading or empty state on the way', async () => {
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
      expect(within(notification).getByText(DEFAULT_NAMES)).toBeInTheDocument();

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
      expect(within(alert).getByRole('button', { name: 'Start empty' })).toBeInTheDocument();
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

    it('Start empty in the failure Notification leaves for the Library, then the editor', async () => {
      await openingOver({ welcome: { status: 'pending', step: 2 } });
      await openWelcome(2);
      refuseOnce();
      fireEvent.click(primary());
      const alert = await screen.findByRole('alert');

      fireEvent.click(within(alert).getByRole('button', { name: 'Start empty' }));

      expect(screen.queryByTestId('welcome')).not.toBeInTheDocument();
      expect(screen.getByText('Your library is empty')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(await screen.findByTestId('editor-sheet')).toBeInTheDocument();
      expect(getMockStorageManager().addPacks).toHaveBeenCalledTimes(1);
      await waitFor(async () => { expect(await stored(WELCOME_KEY)).toEqual({ status: 'done' }); });
    });

    it('or the Packs unselected, the primary button, now Start empty, leaves for the Library, then the editor', async () => {
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
      expect(await screen.findByTestId('editor-sheet')).toBeInTheDocument();
      expect(getMockStorageManager().addPacks).toHaveBeenCalledTimes(1);
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
      expect(notification).toHaveTextContent('Every prompt was already in it');
      expect(await stored<Prompt[]>('prompts')).toHaveLength(already.length);
      // Nothing recorded in Debug mode
      expect(await stored(WELCOME_KEY)).toEqual({ status: 'done' });
      expect(await stored(WHATS_NEW_KEY)).toEqual({ installedVersion: '1.9.0', lastSeenVersion: '1.9.0' });
    });
  });
});
