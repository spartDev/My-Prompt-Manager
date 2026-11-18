import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { changeSiteSettings, parseSiteSettings, SITE_SETTINGS_KEY } from '../../services/siteSettings';
import { type AddPacksResult, STORAGE_KEYS } from '../../services/storage';
import { buildPrompt } from '../../test/builders';
import type { Prompt } from '../../types';
import { PACKS } from '../../welcome/packs';
import { WELCOME_KEY } from '../../welcome/storage';
import type { PromptPack } from '../../welcome/types';
import { WHATS_NEW_KEY } from '../../whatsNew/storage';
import type { ReleaseNotes } from '../../whatsNew/types';
import { useAddPacks } from '../useAddPacks';
import { useCategories } from '../useCategories';
import { useLaunchScreen } from '../useLaunchScreen';
import { usePrompts } from '../usePrompts';

/**
 * The owner's Debug session, end to end at the level of the hooks App holds (scenarios 8, 9 and 10
 * of epic My-Prompt-Manager-ojz): Debug mode turned on and off with the Settings switch's own writer
 * (`changeSiteSettings`), three openings that each go through the Welcome to its end with Packs
 * really added (the user's decision Q1), then What's new as Debug mode forces it, closed. The launch
 * decision, the Library and the add of the Welcome's last step all run on the real storage code over
 * the in-memory chrome.storage.local.
 */

const V2_0: ReleaseNotes = {
  version: '2.0.0',
  items: [{ kind: 'feature', title: 'Search', description: 'Search everything.', icon: 'search' }]
};
const REGISTRY: readonly ReleaseNotes[] = [V2_0];

/** The Packs the Welcome selects by default: the shortest path to a full Library */
const DEFAULT_PACKS: readonly PromptPack[] = PACKS.filter((pack) => pack.defaultSelected);
const DEFAULT_PACK_PROMPTS = DEFAULT_PACKS.reduce((count, pack) => count + pack.prompts.length, 0);

/** The first Prompt of the first default Pack, already in the owner's Library: adding the Pack skips it */
const ALREADY_THERE = DEFAULT_PACKS[0]?.prompts[0];

/** An existing user's Library: their own Prompt, and one whose content a Pack also has */
const ownersLibrary = (): Prompt[] => [
  buildPrompt({ id: 'own', title: 'Draft email', content: 'Write a short email to {{name}}.' }),
  buildPrompt({ id: 'same-as-pack', title: 'Kept as the owner named it', content: ALREADY_THERE?.content ?? '' })
];

/** One opening of the popup, as App holds it: the launch decision, the Library and the add of the Welcome's last step */
async function openExtension() {
  const rendered = renderHook(() => {
    const launch = useLaunchScreen({ releaseNotes: REGISTRY });
    const prompts = usePrompts();
    const categories = useCategories();
    const addPacks = useAddPacks({ refreshPrompts: prompts.refreshPrompts, refreshCategories: categories.refreshCategories });
    return { launch, prompts, categories, addPacks };
  });
  await waitFor(() => {
    expect(rendered.result.current.launch.loading || rendered.result.current.prompts.loading || rendered.result.current.categories.loading).toBe(false);
  });
  return rendered;
}

type Opening = Awaited<ReturnType<typeof openExtension>>;

/**
 * The Welcome to its end, as the owner goes through it: steps 2 and 3 recorded, the Packs added,
 * the end, then What's new closed. Returns what the add did
 */
const goThroughTheWelcome = async ({ result }: Opening, packs: readonly PromptPack[]): Promise<AddPacksResult> => {
  act(() => {
    result.current.launch.saveStep(1);
    result.current.launch.saveStep(2, packs.map((pack) => pack.id));
  });
  let added: AddPacksResult | undefined;
  await act(async () => {
    added = await result.current.addPacks(packs);
  });
  act(() => {
    result.current.launch.finishWelcome();
  });
  // The Welcome first, What's new after, as Debug mode forces it
  expect(result.current.launch.screen).toEqual({ kind: 'whats-new', notes: V2_0 });
  act(() => {
    result.current.launch.closeWhatsNew();
  });
  expect(result.current.launch.screen).toEqual({ kind: 'none' });
  if (added === undefined) {
    throw new Error('The Packs were not added');
  }
  return added;
};

/** Every key of chrome.storage.local but `except`, each as bytes, in key order */
const storageBut = async (except: readonly string[]): Promise<ReadonlyArray<readonly [string, string]>> => {
  const all = await chrome.storage.local.get(null);
  return Object.keys(all)
    .filter((key) => !except.includes(key))
    .sort()
    .map((key) => [key, JSON.stringify(all[key])] as const);
};

const LIBRARY_KEYS = [STORAGE_KEYS.PROMPTS, STORAGE_KEYS.CATEGORIES];

const storedPrompts = async (): Promise<Prompt[]> => ((await chrome.storage.local.get(STORAGE_KEYS.PROMPTS))[STORAGE_KEYS.PROMPTS] ?? []) as Prompt[];

/** Lets a write that should not happen land */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));

describe('a Debug session of the owner (scenarios 8, 9 and 10)', () => {
  beforeEach(async () => {
    vi.mocked(chrome.runtime.getManifest).mockReturnValue({ version: '2.0.0' } as chrome.runtime.Manifest);
    // An existing user after the update from 1.9.0 to 2.0.0, whose What's new is still to show
    await chrome.storage.local.set({
      [WELCOME_KEY]: { status: 'done' },
      [WHATS_NEW_KEY]: { installedVersion: '1.9.0', lastSeenVersion: '1.9.0' },
      [STORAGE_KEYS.PROMPTS]: ownersLibrary(),
      [STORAGE_KEYS.SETTINGS]: { theme: 'dark', notificationsEnabled: false }
    });
  });

  it('the default Packs hold Prompts, one of them already in the Library', () => {
    expect(DEFAULT_PACKS.length).toBeGreaterThan(0);
    expect(ALREADY_THERE).toBeDefined();
  });

  it.each([
    ['Site settings the owner changed before', true],
    ['no Site settings stored yet', false]
  ])('%s: every key but the Prompts and the Categories is as it was once Debug mode is off, and the next opening shows what it showed before', async (_label, settingsStored) => {
    if (settingsStored) {
      await changeSiteSettings({ type: 'setPlatformEnabled', hostname: 'claude.ai', enabled: false });
    }
    // What a normal opening shows before the tests, closed without an action
    const beforeTests = await openExtension();
    const shownBefore = beforeTests.result.current.launch.screen;
    beforeTests.unmount();
    await settle();
    expect(shownBefore).toEqual({ kind: 'whats-new', notes: V2_0 });
    const siteSettingsBefore = (await chrome.storage.local.get(SITE_SETTINGS_KEY))[SITE_SETTINGS_KEY];
    const before = await storageBut([...LIBRARY_KEYS, SITE_SETTINGS_KEY]);
    const promptsBefore = (await storedPrompts()).length;

    await changeSiteSettings({ type: 'setDebugMode', enabled: true });
    const results: AddPacksResult[] = [];
    for (let opening = 0; opening < 3; opening++) {
      const rendered = await openExtension();
      // Scenario 8: the Welcome at each opening, from its first step
      expect(rendered.result.current.launch.screen).toEqual({ kind: 'welcome', step: 0 });
      results.push(await goThroughTheWelcome(rendered, DEFAULT_PACKS));
      rendered.unmount();
    }
    await settle();
    await changeSiteSettings({ type: 'setDebugMode', enabled: false });

    // Scenario 9: the Packs really added once, then nothing more, and no Prompt twice
    expect(results).toEqual([
      { added: DEFAULT_PACK_PROMPTS - 1, skipped: 1, packNames: DEFAULT_PACKS.map((pack) => pack.name) },
      { added: 0, skipped: DEFAULT_PACK_PROMPTS, packNames: [] },
      { added: 0, skipped: DEFAULT_PACK_PROMPTS, packNames: [] }
    ]);
    const prompts = await storedPrompts();
    expect(prompts).toHaveLength(promptsBefore + DEFAULT_PACK_PROMPTS - 1);
    expect(new Set(prompts.map((prompt) => prompt.content.trim())).size).toBe(prompts.length);

    // Scenario 10: the Welcome record, the What's new record, the settings and every other key as before
    expect(await storageBut([...LIBRARY_KEYS, SITE_SETTINGS_KEY])).toEqual(before);
    const siteSettingsAfter = (await chrome.storage.local.get(SITE_SETTINGS_KEY))[SITE_SETTINGS_KEY];
    if (settingsStored) {
      expect(JSON.stringify(siteSettingsAfter)).toBe(JSON.stringify(siteSettingsBefore));
    } else {
      // The switch itself stores the Site settings it changes: the defaults, read the same as none
      expect(siteSettingsBefore).toBeUndefined();
      expect(parseSiteSettings(siteSettingsAfter)).toEqual(parseSiteSettings(undefined));
    }
    const afterTests = await openExtension();
    expect(afterTests.result.current.launch.screen).toEqual(shownBefore);
  });
});
