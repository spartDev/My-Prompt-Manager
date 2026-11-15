import { describe, expect, it } from 'vitest';

import { parseExample, RELEASE_NOTES } from '../releaseNotes';
import type { ReleaseNotes } from '../types';

const notes2 = (): ReleaseNotes => {
  const notes = RELEASE_NOTES.find((entry) => entry.version === '2.0.0');
  if (notes === undefined) {
    throw new Error('RELEASE_NOTES has no 2.0.0 entry');
  }
  return notes;
};

describe('Release notes 2.0.0', () => {
  it('2.0.0 lists the validated Release notes', () => {
    expect(
      notes2().items.map((item) => ({
        kind: item.kind,
        title: item.title,
        destination: item.destination
      }))
    ).toEqual([
      { kind: 'feature', title: 'Fill-in variables', destination: 'prompt-editor-new' },
      { kind: 'feature', title: 'Search with ⌘K', destination: 'library-search' },
      { kind: 'feature', title: 'Type // on a Platform', destination: undefined },
      { kind: 'feature', title: 'Pinned prompts', destination: 'library' },
      { kind: 'feature', title: 'This looks familiar', destination: 'prompt-editor-new' },
      { kind: 'feature', title: 'Tidy up', destination: 'analytics' },
      { kind: 'feature', title: 'New category while you write', destination: 'prompt-editor-new' },
      { kind: 'feature', title: 'Undo a Category deletion', destination: 'categories' },
      { kind: 'feature', title: 'Fix the icon yourself', destination: 'settings' },
      { kind: 'critical-fix', title: 'Prompts arrive as written', destination: undefined },
      { kind: 'critical-fix', title: 'The icon stays put', destination: undefined },
      { kind: 'critical-fix', title: 'Your site settings are safe', destination: undefined },
      { kind: 'critical-fix', title: 'No empty backups', destination: undefined },
      { kind: 'critical-fix', title: 'Saving always works', destination: undefined },
      { kind: 'critical-fix', title: 'No lost changes', destination: undefined }
    ]);
  });

  it('every description is one sentence of at most 110 characters', () => {
    for (const item of notes2().items) {
      expect(item.description.length, item.title).toBeLessThanOrEqual(110);
      // One sentence: a single final stop, none inside
      expect(item.description, item.title).toMatch(/^[^.!?]+[.!?]$/);
    }
  });

  it('the hero example shows {{audience}} and {{tone}} as Variables', () => {
    const [hero] = notes2().items;
    const example = hero.kind === 'feature' ? hero.example : undefined;
    expect(example).toBe('Write a launch email for {{audience}} in a {{tone}} voice.');
    expect(parseExample(example ?? '').filter((segment) => segment.kind === 'variable')).toEqual([
      { kind: 'variable', name: 'audience' },
      { kind: 'variable', name: 'tone' }
    ]);
  });
});
