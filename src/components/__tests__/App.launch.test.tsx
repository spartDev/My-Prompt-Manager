import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../../App';
import { SITE_SETTINGS_KEY } from '../../services/siteSettings';
import { getMockStorageManager } from '../../test/mocks';
import type { Category, Prompt } from '../../types';
import { WELCOME_KEY, type WelcomeRecord } from '../../welcome/storage';
import { WHATS_NEW_KEY } from '../../whatsNew/storage';

const WHATS_NEW = /what.s new/i;
const LIBRARY_HEADING = /my prompt manager/i;

const categories: Category[] = [{ id: 'default', name: 'Uncategorized', color: '#888888' }];
const library: Prompt[] = [
  { id: 'p1', title: 'Draft email', content: 'Hello', category: 'Uncategorized', createdAt: 1, updatedAt: 1 }
];

/**
 * The store of an opening: the Library, the Welcome record, the What's new record of an install at
 * `installedVersion` (the Last seen Release `lastSeenVersion`), and Debug mode
 */
const openingOver = async ({
  prompts,
  welcome,
  installedVersion = '1.9.0',
  lastSeenVersion,
  debugMode = false
}: {
  prompts: Prompt[];
  welcome: WelcomeRecord | undefined;
  installedVersion?: string;
  lastSeenVersion?: string;
  debugMode?: boolean;
}): Promise<void> => {
  await chrome.storage.local.set({
    prompts: [...prompts],
    [WHATS_NEW_KEY]: { installedVersion, ...(lastSeenVersion === undefined ? {} : { lastSeenVersion }) },
    [SITE_SETTINGS_KEY]: { debugMode }
  });
  if (welcome !== undefined) {
    await chrome.storage.local.set({ [WELCOME_KEY]: welcome });
  }
};

/** Every key of chrome.storage.local but the Library's (the Prompts and the Categories), each as bytes, in key order */
const storageButTheLibrary = async (): Promise<ReadonlyArray<readonly [string, string]>> => {
  const all = await chrome.storage.local.get(null);
  return Object.keys(all)
    .filter((key) => key !== 'prompts' && key !== 'categories')
    .sort()
    .map((key) => [key, JSON.stringify(all[key])] as const);
};

/** Lets a screen that should not come show up */
const settle = (): Promise<void> => act(async () => { await new Promise((resolve) => { setTimeout(resolve, 20); }); });

const expectLibraryAlone = async (): Promise<void> => {
  expect(await screen.findByRole('heading', { name: LIBRARY_HEADING })).toBeInTheDocument();
  expect(await screen.findByText('Draft email')).toBeInTheDocument();
  await settle();
  expect(screen.queryByTestId('welcome')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: WHATS_NEW })).not.toBeInTheDocument();
};

/** The Welcome alone: full-screen, at `step`, with nothing of the Library, its tab bar or What's new */
const expectWelcomeAlone = async (step: number): Promise<void> => {
  const welcome = await screen.findByTestId('welcome');
  expect(welcome).toHaveAttribute('data-welcome-step', String(step));
  expect(screen.getByRole('button', { name: `Step ${String(step + 1)} of 3` })).toHaveAttribute('aria-current', 'step');
  expect(screen.getByTestId('welcome-primary')).toBeInTheDocument();
  await settle();
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: LIBRARY_HEADING })).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: WHATS_NEW })).not.toBeInTheDocument();
};

/**
 * Holds the launch decision's storage read until the returned function is called; every other read
 * (the Prompts, the Categories, the theme, the Notifications) goes on
 */
const holdLaunchRead = (): (() => void) => {
  const read = vi.mocked(chrome.storage.local.get).getMockImplementation() as unknown as (keys: unknown) => Promise<Record<string, unknown>>;
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => { release = resolve; });
  vi.mocked(chrome.storage.local.get).mockImplementation(async (keys) => {
    if (Array.isArray(keys) && (keys as unknown[]).includes(WELCOME_KEY)) {
      await held;
    }
    return read(keys);
  });
  return release;
};

describe('App: what an opening shows first', () => {
  beforeEach(() => {
    window.location.search = '';
    vi.mocked(chrome.runtime.getManifest).mockReturnValue({ version: '2.0.0' } as chrome.runtime.Manifest);
    getMockStorageManager().getCategories.mockResolvedValue([...categories]);
  });

  afterEach(() => {
    window.location.search = '';
  });

  it('an existing user (done, a Library) at a Release already seen: the Library, no Welcome, no What\'s new', async () => {
    await openingOver({ prompts: library, welcome: { status: 'done' }, lastSeenVersion: '2.0.0' });
    render(<App />);

    await expectLibraryAlone();
  });

  it('an existing user after an update to a Release with notes: What\'s new over the Library, never the Welcome', async () => {
    await openingOver({ prompts: library, welcome: { status: 'done' }, lastSeenVersion: '1.9.0' });
    render(<App />);

    expect(await screen.findByRole('dialog', { name: WHATS_NEW })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: LIBRARY_HEADING })).toBeInTheDocument();
    expect(screen.queryByTestId('welcome')).not.toBeInTheDocument();
  });

  it('nothing of the Library renders before the decision: only the background, then the Library', async () => {
    await openingOver({ prompts: library, welcome: { status: 'done' }, lastSeenVersion: '2.0.0' });
    const release = holdLaunchRead();
    render(<App />);

    // The Library and its Categories are read meanwhile, and still nothing of it shows
    await waitFor(() => { expect(getMockStorageManager().getPrompts).toHaveBeenCalled(); });
    await settle();
    expect(screen.getByTestId('launch-deciding')).toHaveClass('bg-app');
    expect(screen.queryByRole('heading', { name: LIBRARY_HEADING })).not.toBeInTheDocument();
    expect(screen.queryByText('Draft email')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add new prompt/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('welcome')).not.toBeInTheDocument();

    release();

    await expectLibraryAlone();
    expect(screen.queryByTestId('launch-deciding')).not.toBeInTheDocument();
  });

  it('nothing of the Library renders before the Welcome either', async () => {
    await openingOver({ prompts: [], welcome: { status: 'pending', step: 0 }, installedVersion: '2.0.0' });
    const release = holdLaunchRead();
    render(<App />);

    await settle();
    expect(screen.getByTestId('launch-deciding')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: LIBRARY_HEADING })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();

    release();

    await expectWelcomeAlone(0);
  });

  it('a first install (pending at step 0, an empty Library): the Welcome full-screen, without the tab bar or the Library', async () => {
    await openingOver({ prompts: [], welcome: { status: 'pending', step: 0 }, installedVersion: '2.0.0' });
    render(<App />);

    await expectWelcomeAlone(0);
  });

  it('in the side panel too', async () => {
    await openingOver({ prompts: [], welcome: { status: 'pending', step: 0 }, installedVersion: '2.0.0' });
    render(<App context="sidepanel" />);

    await expectWelcomeAlone(0);
  });

  it('an unfinished Welcome resumes at its stored step', async () => {
    await openingOver({ prompts: [], welcome: { status: 'pending', step: 2 }, installedVersion: '2.0.0' });
    render(<App />);

    await expectWelcomeAlone(2);
  });

  it('pending over an empty Library after an update to a Release with notes: the Welcome alone, never with What\'s new', async () => {
    await openingOver({ prompts: [], welcome: { status: 'pending', step: 1 }, lastSeenVersion: '1.9.0' });
    render(<App />);

    await expectWelcomeAlone(1);
  });

  it('pending with Prompts in the Library (the Welcome finished, its done write lost): the Library, and the Welcome recorded done', async () => {
    await openingOver({ prompts: library, welcome: { status: 'pending', step: 0 }, installedVersion: '2.0.0' });
    render(<App />);

    await expectLibraryAlone();
    await waitFor(async () => {
      expect((await chrome.storage.local.get(WELCOME_KEY))[WELCOME_KEY]).toEqual({ status: 'done' });
    });
  });

  it('no record over an empty Library (opened before the install write): the Library, not the Welcome', async () => {
    getMockStorageManager().getPrompts.mockResolvedValue([]);
    render(<App />);

    expect(await screen.findByRole('heading', { name: LIBRARY_HEADING })).toBeInTheDocument();
    await settle();
    expect(screen.queryByTestId('welcome')).not.toBeInTheDocument();
  });

  it('Debug mode: the Welcome from step 0 at an existing user\'s opening', async () => {
    await openingOver({ prompts: library, welcome: { status: 'done' }, lastSeenVersion: '1.9.0', debugMode: true });
    render(<App />);

    await expectWelcomeAlone(0);
  });

  it.each<[string, Prompt[], WelcomeRecord]>([
    ['a done record and a full Library', library, { status: 'done' }],
    ['a pending record at step 2 over an empty Library', [], { status: 'pending', step: 2, packs: ['writing'] }],
    ['a pending record at step 2 over a Library with Prompts', library, { status: 'pending', step: 2 }]
  ])('Debug mode, %s: the Welcome from step 0 at each of three openings, every key but the Library\'s left as it was', async (_label, prompts, welcome) => {
    await openingOver({ prompts, welcome, lastSeenVersion: '1.9.0', debugMode: true });
    const before = await storageButTheLibrary();

    for (let opening = 0; opening < 3; opening++) {
      const { unmount } = render(<App />);
      await expectWelcomeAlone(0);
      unmount();
    }
    await settle();

    expect(await storageButTheLibrary()).toEqual(before);
  });

  it('Cmd/Ctrl+K does nothing while the Welcome shows', async () => {
    await openingOver({ prompts: [], welcome: { status: 'pending', step: 0 }, installedVersion: '2.0.0' });
    render(<App />);
    await expectWelcomeAlone(0);

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    await settle();

    expect(screen.getByTestId('welcome')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('the Welcome\'s frame records each step change through the launch writer, and resumes there at the next opening', async () => {
    await openingOver({ prompts: [], welcome: { status: 'pending', step: 0 }, installedVersion: '2.0.0' });
    const { unmount } = render(<App />);
    await expectWelcomeAlone(0);

    fireEvent.click(screen.getByTestId('welcome-primary'));

    expect(screen.getByTestId('welcome')).toHaveAttribute('data-welcome-step', '1');
    await waitFor(async () => {
      expect((await chrome.storage.local.get(WELCOME_KEY))[WELCOME_KEY]).toEqual({ status: 'pending', step: 1 });
    });

    // The popup closed and opened again
    unmount();
    render(<App />);
    await expectWelcomeAlone(1);
  });

  it('Skip, then the primary button of the last step: the Welcome finished and recorded, the Library shown, in two actions', async () => {
    await openingOver({ prompts: [], welcome: { status: 'pending', step: 0 }, installedVersion: '2.0.0' });
    render(<App />);
    await expectWelcomeAlone(0);

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByTestId('welcome')).toHaveAttribute('data-welcome-step', '2');
    fireEvent.click(screen.getByTestId('welcome-primary'));

    expect(await screen.findByRole('heading', { name: LIBRARY_HEADING })).toBeInTheDocument();
    expect(screen.queryByTestId('welcome')).not.toBeInTheDocument();
    await waitFor(async () => {
      expect((await chrome.storage.local.get(WELCOME_KEY))[WELCOME_KEY]).toEqual({ status: 'done' });
    });
  });

  it('never in the element picker\'s Settings window, even pending over an empty Library or in Debug mode', async () => {
    window.location.search = '?picker=true';
    await openingOver({ prompts: [], welcome: { status: 'pending', step: 0 }, installedVersion: '2.0.0', debugMode: true });
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
    await settle();
    expect(screen.queryByTestId('welcome')).not.toBeInTheDocument();
    expect(screen.queryByTestId('launch-deciding')).not.toBeInTheDocument();
  });
});
