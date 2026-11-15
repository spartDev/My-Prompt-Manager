import { describe, expect, it } from 'vitest';

import { compareVersions, newestReleaseNotes, parseExample, RELEASE_NOTES } from '../releaseNotes';
import type { ReleaseNotes } from '../types';

const feature = {
  kind: 'feature',
  title: 'A Feature',
  description: 'Something new.',
  icon: 'wrench'
} as const;

const release = (version: string, items: ReleaseNotes['items'] = [feature]): ReleaseNotes => ({
  version,
  items
});

describe('compareVersions', () => {
  it('orders versions by number, part by part', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.9.0', '1.10.0')).toBeLessThan(0);
    expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0);
    expect(compareVersions('2.0', '2.0.0')).toBe(0);
  });
});

describe('newestReleaseNotes', () => {
  it('returns the Release with the highest version', () => {
    const registry = [release('1.2.0'), release('2.0.0'), release('1.9.0')];
    expect(newestReleaseNotes(registry)?.version).toBe('2.0.0');
  });

  it('orders versions as semver: 1.10.0 is newer than 1.9.0', () => {
    const registry = [release('1.9.0'), release('1.10.0'), release('1.2.0')];
    expect(newestReleaseNotes(registry)?.version).toBe('1.10.0');
  });

  it('skips a Release whose notes have no item', () => {
    const registry = [release('1.9.0'), release('2.0.0', [])];
    expect(newestReleaseNotes(registry)?.version).toBe('1.9.0');
  });

  it('returns undefined when no Release has an item', () => {
    expect(newestReleaseNotes([])).toBeUndefined();
    expect(newestReleaseNotes([release('2.0.0', [])])).toBeUndefined();
  });

  it('reads RELEASE_NOTES by default', () => {
    expect(newestReleaseNotes()).toEqual(newestReleaseNotes(RELEASE_NOTES));
  });
});

describe('parseExample', () => {
  it('splits a sentence into text and variable segments', () => {
    expect(parseExample('Write for {{audience}} in a {{tone}} voice.')).toEqual([
      { kind: 'text', text: 'Write for ' },
      { kind: 'variable', name: 'audience' },
      { kind: 'text', text: ' in a ' },
      { kind: 'variable', name: 'tone' },
      { kind: 'text', text: ' voice.' }
    ]);
  });

  it('keeps a string without braces as one text segment', () => {
    expect(parseExample('Insert a Prompt in one click.')).toEqual([
      { kind: 'text', text: 'Insert a Prompt in one click.' }
    ]);
  });

  it('keeps unmatched braces as text', () => {
    expect(parseExample('Write for {{audience} now')).toEqual([
      { kind: 'text', text: 'Write for {{audience} now' }
    ]);
    expect(parseExample('Write for audience}} or {{ now')).toEqual([
      { kind: 'text', text: 'Write for audience}} or {{ now' }
    ]);
    expect(parseExample('{{a}} and {{b')).toEqual([
      { kind: 'variable', name: 'a' },
      { kind: 'text', text: ' and {{b' }
    ]);
  });

  it('handles a variable at the start and at the end', () => {
    expect(parseExample('{{tone}}')).toEqual([{ kind: 'variable', name: 'tone' }]);
  });
});
