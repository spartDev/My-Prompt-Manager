import { describe, expectTypeOf, it } from 'vitest';

import type { CriticalFixItem, FeatureItem, ReleaseNoteItem } from '../types';

// These checks are compile-time: `npm run typecheck` fails if an
// `@ts-expect-error` below stops being an error.
describe('ReleaseNoteItem type', () => {
  it('accepts a Feature and a Critical fix', () => {
    const feature: ReleaseNoteItem = {
      kind: 'feature',
      title: 'Variables',
      description: 'Fill in a Prompt before inserting it.',
      icon: 'variables',
      destination: 'library',
      example: 'Write for {{audience}}.'
    };
    const fix: ReleaseNoteItem = {
      kind: 'critical-fix',
      title: 'Prompts kept on import',
      description: 'An import no longer loses Prompts.'
    };
    expectTypeOf(feature).toExtend<ReleaseNoteItem>();
    expectTypeOf(fix).toExtend<ReleaseNoteItem>();
    expectTypeOf<ReleaseNoteItem['kind']>().toEqualTypeOf<'feature' | 'critical-fix'>();
  });

  it('rejects an item of another kind', () => {
    const other: ReleaseNoteItem = {
      // @ts-expect-error 'improvement' is not a kind of Release note item
      kind: 'improvement',
      title: 'Faster search',
      description: 'Search is faster.'
    };
    expectTypeOf(other).toExtend<ReleaseNoteItem>();
  });

  it('a Critical fix has no destination', () => {
    const fix: CriticalFixItem = {
      kind: 'critical-fix',
      title: 'Prompts kept on import',
      description: 'An import no longer loses Prompts.',
      // @ts-expect-error a Critical fix opens nothing
      destination: 'library'
    };
    const asItem: ReleaseNoteItem = {
      kind: 'critical-fix',
      title: 'Prompts kept on import',
      description: 'An import no longer loses Prompts.',
      // @ts-expect-error a Critical fix opens nothing, even typed as a Release note item
      destination: 'library'
    };
    expectTypeOf(fix).toExtend<ReleaseNoteItem>();
    expectTypeOf(asItem).toExtend<ReleaseNoteItem>();
  });

  it('a Feature icon is a key of the closed icon set', () => {
    const feature: FeatureItem = {
      kind: 'feature',
      title: 'Variables',
      description: 'Fill in a Prompt before inserting it.',
      // @ts-expect-error 'rocket' is not in the icon set
      icon: 'rocket'
    };
    expectTypeOf(feature).toExtend<FeatureItem>();
  });
});
