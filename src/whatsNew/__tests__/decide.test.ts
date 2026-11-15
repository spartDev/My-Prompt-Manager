import { describe, expect, it } from 'vitest';

import { decideWhatsNew, type WhatsNewInputs } from '../decide';
import type { ReleaseNotes } from '../types';

const notes = (version: string): ReleaseNotes => ({
  version,
  items: [{ kind: 'feature', title: `New in ${version}`, description: 'Something new.', icon: 'search' }]
});

const V1_9 = notes('1.9.0');
const V2_0 = notes('2.0.0');
const V2_1 = notes('2.1.0');
/** A Release listed with no items has no Release notes */
const V2_0_1_EMPTY: ReleaseNotes = { version: '2.0.1', items: [] };

const REGISTRY: readonly ReleaseNotes[] = [V1_9, V2_0, V2_0_1_EMPTY];

/** The five situations of the show rule, each with what normal mode shows */
const CASES: ReadonlyArray<{ name: string; inputs: Omit<WhatsNewInputs, 'debugMode'>; normal: ReleaseNotes | null }> = [
  {
    name: 'shows the notes of a new Release that has them',
    inputs: { currentVersion: '2.0.0', lastSeenVersion: '1.9.0', releaseNotes: REGISTRY, isFirstInstall: false },
    normal: V2_0
  },
  {
    name: 'shows nothing for a new Release without notes',
    inputs: { currentVersion: '2.0.1', lastSeenVersion: '2.0.0', releaseNotes: REGISTRY, isFirstInstall: false },
    normal: null
  },
  {
    name: 'shows nothing for the Last seen Release',
    inputs: { currentVersion: '2.0.0', lastSeenVersion: '2.0.0', releaseNotes: REGISTRY, isFirstInstall: false },
    normal: null
  },
  {
    name: 'shows nothing on a first install',
    inputs: { currentVersion: '2.0.0', lastSeenVersion: undefined, releaseNotes: REGISTRY, isFirstInstall: true },
    normal: null
  },
  {
    name: "after skipped Releases shows only the installed Release's notes",
    inputs: {
      currentVersion: '2.1.0',
      lastSeenVersion: '1.9.0',
      releaseNotes: [V1_9, V2_0, V2_1],
      isFirstInstall: false
    },
    normal: V2_1
  }
];

describe('decideWhatsNew: normal mode', () => {
  it.each(CASES)('$name', ({ inputs, normal }) => {
    expect(decideWhatsNew({ ...inputs, debugMode: false })).toBe(normal);
  });

  it('shows nothing for a new Release absent from the registry', () => {
    expect(
      decideWhatsNew({
        currentVersion: '3.0.0',
        lastSeenVersion: '2.0.0',
        releaseNotes: REGISTRY,
        isFirstInstall: false,
        debugMode: false
      })
    ).toBeNull();
  });

  it('shows the notes to a user updated from a Release older than What\'s new (no record at all)', () => {
    expect(
      decideWhatsNew({
        currentVersion: '2.0.0',
        lastSeenVersion: undefined,
        releaseNotes: REGISTRY,
        isFirstInstall: false,
        debugMode: false
      })
    ).toBe(V2_0);
  });

  it('compares versions by equality, not order: a Last seen Release newer than the installed one still shows', () => {
    expect(
      decideWhatsNew({
        currentVersion: '2.0.0',
        lastSeenVersion: '2.1.0',
        releaseNotes: REGISTRY,
        isFirstInstall: false,
        debugMode: false
      })
    ).toBe(V2_0);
  });
});

describe('decideWhatsNew: Debug mode', () => {
  it.each(CASES)('debug: $name', ({ inputs }) => {
    const shown = decideWhatsNew({ ...inputs, debugMode: true });
    expect(shown).not.toBeNull();
    expect(shown?.items.length).toBeGreaterThan(0);
  });

  it('debug: shows the installed Release\'s notes when it has them, whatever the record says', () => {
    for (const { inputs } of CASES.filter(({ inputs }) => inputs.currentVersion !== '2.0.1')) {
      expect(decideWhatsNew({ ...inputs, debugMode: true })?.version).toBe(inputs.currentVersion);
    }
  });

  it('debug: a Release without notes shows the newest Release that has notes', () => {
    expect(
      decideWhatsNew({
        currentVersion: '2.0.1',
        lastSeenVersion: '2.0.1',
        releaseNotes: [V2_0, V1_9, V2_0_1_EMPTY],
        isFirstInstall: true,
        debugMode: true
      })
    ).toBe(V2_0);
    expect(
      decideWhatsNew({
        currentVersion: '1.9.1',
        lastSeenVersion: undefined,
        releaseNotes: REGISTRY,
        isFirstInstall: false,
        debugMode: true
      })
    ).toBe(V2_0);
  });

  it('debug: shows nothing only when no Release has notes', () => {
    expect(
      decideWhatsNew({
        currentVersion: '2.0.1',
        lastSeenVersion: undefined,
        releaseNotes: [V2_0_1_EMPTY],
        isFirstInstall: false,
        debugMode: true
      })
    ).toBeNull();
    expect(
      decideWhatsNew({
        currentVersion: '2.0.0',
        lastSeenVersion: undefined,
        releaseNotes: [],
        isFirstInstall: false,
        debugMode: true
      })
    ).toBeNull();
  });
});
