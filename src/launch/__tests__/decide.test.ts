import { describe, expect, it } from 'vitest';

import type { WelcomeRecord } from '../../welcome/storage';
import { decideWhatsNew } from '../../whatsNew/decide';
import type { ReleaseNotes } from '../../whatsNew/types';
import { decideLaunch, type LaunchInputs, type LaunchScreen } from '../decide';

const notes = (version: string): ReleaseNotes => ({
  version,
  items: [{ kind: 'feature', title: `New in ${version}`, description: 'Something new.', icon: 'search' }]
});

const V1_9 = notes('1.9.0');
const V2_0 = notes('2.0.0');
/** A Release listed with no items has no Release notes */
const V2_0_1_EMPTY: ReleaseNotes = { version: '2.0.1', items: [] };
const REGISTRY: readonly ReleaseNotes[] = [V1_9, V2_0, V2_0_1_EMPTY];

const NONE: LaunchScreen = { kind: 'none' };
const welcomeAt = (step: 0 | 1 | 2): LaunchScreen => ({ kind: 'welcome', step });
const whatsNewOf = (shown: ReleaseNotes | null): LaunchScreen => (shown === null ? NONE : { kind: 'whats-new', notes: shown });

// The dimensions of the table: every Welcome record, Library, Debug mode, What's new situation and
// whether the Welcome was finished in this opening

const RECORDS: ReadonlyArray<{ name: string; welcome: LaunchInputs['welcome'] }> = [
  { name: 'no record', welcome: 'absent' },
  { name: 'an unreadable record', welcome: 'unreadable' },
  { name: 'pending at step 0', welcome: { status: 'pending', step: 0 } },
  { name: 'pending at step 1', welcome: { status: 'pending', step: 1 } },
  { name: 'pending at step 2', welcome: { status: 'pending', step: 2, packs: ['writing'] } },
  { name: 'done', welcome: { status: 'done' } }
];

const LIBRARIES: ReadonlyArray<{ name: string; libraryHasPrompts: boolean | undefined }> = [
  { name: 'an empty Library', libraryHasPrompts: false },
  { name: 'a Library with Prompts', libraryHasPrompts: true },
  { name: 'a Library not read', libraryHasPrompts: undefined }
];

type WhatsNewSituation = Pick<LaunchInputs, 'currentVersion' | 'lastSeenVersion' | 'isFirstInstall' | 'releaseNotes'>;

/** Each What's new situation, with what What's new shows in normal mode and when Debug mode forces it */
const WHATS_NEW: ReadonlyArray<{ name: string; inputs: WhatsNewSituation; normal: ReleaseNotes | null; forced: ReleaseNotes | null }> = [
  {
    name: 'notes for the installed Release, not seen',
    inputs: { currentVersion: '2.0.0', lastSeenVersion: '1.9.0', isFirstInstall: false, releaseNotes: REGISTRY },
    normal: V2_0,
    forced: V2_0
  },
  {
    name: 'the installed Release already seen',
    inputs: { currentVersion: '2.0.0', lastSeenVersion: '2.0.0', isFirstInstall: false, releaseNotes: REGISTRY },
    normal: null,
    forced: V2_0
  },
  {
    name: 'no notes for the installed Release',
    inputs: { currentVersion: '2.0.1', lastSeenVersion: '2.0.0', isFirstInstall: false, releaseNotes: REGISTRY },
    normal: null,
    // Debug mode shows the newest Release that has notes
    forced: V2_0
  },
  {
    name: 'a first install',
    inputs: { currentVersion: '2.0.0', lastSeenVersion: undefined, isFirstInstall: true, releaseNotes: REGISTRY },
    normal: null,
    forced: V2_0
  }
];

const DEBUG = [false, true] as const;
const FINISHED = [false, true] as const;

const isPending = (welcome: LaunchInputs['welcome']): welcome is Extract<WelcomeRecord, { status: 'pending' }> =>
  typeof welcome === 'object' && welcome.status === 'pending';

/**
 * The screen the spec of record gives (epic My-Prompt-Manager-ojz, "Règles d'affichage", A3):
 * - Debug mode: the Welcome from its first step at every opening, whatever else holds, until it is
 *   finished in this opening; then What's new as Debug mode forces it.
 * - Normal: nothing right after the Welcome; the Welcome only for a pending record over a Library
 *   known to be empty (pending + Prompts is a Welcome finished; a Library not read is a doubt, and in
 *   doubt neither the Welcome nor What's new shows to a user the record says is new); otherwise
 *   What's new by its own rule.
 */
const expectedScreen = (
  welcome: LaunchInputs['welcome'],
  libraryHasPrompts: boolean | undefined,
  debugMode: boolean,
  whatsNew: (typeof WHATS_NEW)[number],
  finished: boolean
): LaunchScreen => {
  if (debugMode) {
    return finished ? whatsNewOf(whatsNew.forced) : welcomeAt(0);
  }
  if (finished) {
    return NONE;
  }
  if (isPending(welcome) && libraryHasPrompts === false) {
    return welcomeAt(welcome.step);
  }
  if (isPending(welcome) && libraryHasPrompts === undefined) {
    return NONE;
  }
  return whatsNewOf(whatsNew.normal);
};

const describeScreen = (screen: LaunchScreen): string =>
  screen.kind === 'welcome' ? `the Welcome at step ${String(screen.step)}` : screen.kind === 'whats-new' ? `What's new ${screen.notes.version}` : 'nothing';

const TABLE = RECORDS.flatMap((record) =>
  LIBRARIES.flatMap((library) =>
    DEBUG.flatMap((debugMode) =>
      WHATS_NEW.flatMap((whatsNew) =>
        FINISHED.map((finished) => {
          const inputs: LaunchInputs = {
            welcome: record.welcome,
            libraryHasPrompts: library.libraryHasPrompts,
            ...whatsNew.inputs,
            debugMode,
            welcomeFinishedThisOpening: finished
          };
          const expected = expectedScreen(record.welcome, library.libraryHasPrompts, debugMode, whatsNew, finished);
          const name = `${record.name} · ${library.name} · Debug mode ${debugMode ? 'on' : 'off'} · ${whatsNew.name} · ${
            finished ? 'finished in this opening' : 'not finished in this opening'
          } → ${describeScreen(expected)}`;
          return { name, inputs, expected };
        })
      )
    )
  )
);

/** The base of the named cases below: a Release with notes not seen yet, normal mode */
const base: LaunchInputs = {
  welcome: { status: 'done' },
  libraryHasPrompts: undefined,
  currentVersion: '2.0.0',
  lastSeenVersion: '1.9.0',
  isFirstInstall: false,
  releaseNotes: REGISTRY,
  debugMode: false,
  welcomeFinishedThisOpening: false
};

describe('decideLaunch', () => {
  it('the table covers every combination: 6 records x 3 Libraries x 2 Debug modes x 4 What\'s new situations x 2 finishes = 288', () => {
    expect(TABLE).toHaveLength(6 * 3 * 2 * 4 * 2);
    expect(TABLE).toHaveLength(288);
  });

  describe('table', () => {
    it.each(TABLE)('$name', ({ inputs, expected }) => {
      const screen = decideLaunch(inputs);
      expect(screen).toEqual(expected);
      // Never both: one kind, with only the fields of that kind
      const fields = { welcome: ['kind', 'step'], 'whats-new': ['kind', 'notes'], none: ['kind'] }[screen.kind];
      expect(Object.keys(screen).sort()).toEqual([...fields].sort());
    });
  });

  describe('the Welcome', () => {
    it.each([0, 1, 2] as const)('pending at step %i over an empty Library: the Welcome at that step', (step) => {
      expect(decideLaunch({ ...base, welcome: { status: 'pending', step }, libraryHasPrompts: false, isFirstInstall: true })).toEqual(welcomeAt(step));
    });

    it.each([0, 1, 2] as const)('pending at step %i with Prompts in the Library: not the Welcome (a Welcome finished whose done write was lost)', (step) => {
      expect(decideLaunch({ ...base, welcome: { status: 'pending', step }, libraryHasPrompts: true }).kind).not.toBe('welcome');
    });

    it('the store a harness relaunch leaves (a Library, no record, then \'install\' wrote pending at step 0): the Library, no Welcome, no What\'s new', () => {
      // Chromium fires 'install' at every launch of an extension loaded from the command line; the
      // record was absent, so the service worker wrote pending; the What's new record is a first install
      expect(
        decideLaunch({
          ...base,
          welcome: { status: 'pending', step: 0 },
          libraryHasPrompts: true,
          currentVersion: '2.0.0',
          lastSeenVersion: undefined,
          isFirstInstall: true
        })
      ).toEqual(NONE);
    });

    it('no record over an empty Library: not the Welcome (a popup opened before the install write, or an update before its write)', () => {
      expect(decideLaunch({ ...base, welcome: 'absent', libraryHasPrompts: false, isFirstInstall: true })).toEqual(NONE);
      expect(decideLaunch({ ...base, welcome: 'absent', libraryHasPrompts: false }).kind).not.toBe('welcome');
    });

    it('an unreadable record over an empty Library: not the Welcome', () => {
      expect(decideLaunch({ ...base, welcome: 'unreadable', libraryHasPrompts: false }).kind).not.toBe('welcome');
    });

    it('pending over a Library not read: neither the Welcome nor What\'s new', () => {
      expect(decideLaunch({ ...base, welcome: { status: 'pending', step: 1 }, libraryHasPrompts: undefined })).toEqual(NONE);
    });

    it('done, the Welcome finished at an earlier opening or an existing user updated: never the Welcome in normal mode', () => {
      for (const libraryHasPrompts of [false, true, undefined]) {
        for (const whatsNew of WHATS_NEW) {
          expect(decideLaunch({ ...base, ...whatsNew.inputs, welcome: { status: 'done' }, libraryHasPrompts }).kind).not.toBe('welcome');
        }
      }
    });
  });

  describe('Debug mode', () => {
    it.each(RECORDS)('$name: the Welcome from its first step, whatever the Library and What\'s new', ({ welcome }) => {
      for (const library of LIBRARIES) {
        for (const whatsNew of WHATS_NEW) {
          expect(
            decideLaunch({ ...base, ...whatsNew.inputs, welcome, libraryHasPrompts: library.libraryHasPrompts, debugMode: true })
          ).toEqual(welcomeAt(0));
        }
      }
    });

    it('the Welcome finished in this opening: What\'s new as Debug mode forces it (the Welcome first, What\'s new after)', () => {
      expect(
        decideLaunch({ ...base, lastSeenVersion: '2.0.0', debugMode: true, welcomeFinishedThisOpening: true })
      ).toEqual({ kind: 'whats-new', notes: V2_0 });
    });

    it('the Welcome finished in this opening, and no Release has notes: nothing', () => {
      expect(
        decideLaunch({ ...base, releaseNotes: [V2_0_1_EMPTY], currentVersion: '2.0.1', debugMode: true, welcomeFinishedThisOpening: true })
      ).toEqual(NONE);
    });
  });

  describe("What's new", () => {
    it('the Welcome finished in this opening, normal mode: nothing, even for a Release with notes not seen (never What\'s new right after the Welcome)', () => {
      expect(decideLaunch({ ...base, welcome: { status: 'pending', step: 2 }, libraryHasPrompts: false, welcomeFinishedThisOpening: true })).toEqual(NONE);
      expect(decideLaunch({ ...base, welcomeFinishedThisOpening: true })).toEqual(NONE);
    });

    it('an existing user after an update to a Release with notes: What\'s new', () => {
      expect(decideLaunch({ ...base, welcome: { status: 'done' } })).toEqual({ kind: 'whats-new', notes: V2_0 });
    });

    it('wherever the Welcome does not show in normal mode, follows decideWhatsNew unchanged', () => {
      for (const welcome of ['absent', 'unreadable', { status: 'done' }] as const) {
        for (const whatsNew of WHATS_NEW) {
          const shown = decideWhatsNew({ ...whatsNew.inputs, debugMode: false });
          expect(decideLaunch({ ...base, ...whatsNew.inputs, welcome })).toEqual(whatsNewOf(shown));
        }
      }
    });
  });

  it('is pure: the same inputs give the same screen, and the inputs are left as they were', () => {
    const inputs: LaunchInputs = { ...base, welcome: { status: 'pending', step: 2, packs: ['writing'] }, libraryHasPrompts: false };
    const snapshot = JSON.stringify(inputs);
    expect(decideLaunch(inputs)).toEqual(decideLaunch(inputs));
    expect(JSON.stringify(inputs)).toBe(snapshot);
  });
});
