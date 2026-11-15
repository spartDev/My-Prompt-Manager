import type { ExampleSegment, ReleaseNotes } from './types';

/**
 * Every Release that has Release notes, one entry per Release.
 * Adding a Release is adding an entry here.
 */
export const RELEASE_NOTES: readonly ReleaseNotes[] = [
  {
    version: '2.0.0',
    items: [
      {
        kind: 'feature',
        title: 'Fill-in variables',
        description:
          'Mark the parts of a Prompt that change as Variables, then fill them in before you insert it.',
        icon: 'variables',
        destination: 'prompt-editor-new',
        example: 'Write a launch email for {{audience}} in a {{tone}} voice.'
      },
      {
        kind: 'feature',
        title: 'Search with ⌘K',
        description: 'Press ⌘K, or Ctrl+K, from any Section to jump to the search field of the Library.',
        icon: 'search',
        destination: 'library-search'
      },
      {
        kind: 'feature',
        title: 'Type // on a Platform',
        description: 'Type // in the input field of a Platform to pick a Prompt without leaving the keyboard.',
        icon: 'slash'
      },
      {
        kind: 'feature',
        title: 'Pinned prompts',
        description: 'Pin the Prompts you rely on to keep them first in the Library and together under the Pinned filter.',
        icon: 'pin',
        destination: 'library'
      },
      {
        kind: 'feature',
        title: 'This looks familiar',
        description: 'While you write a Prompt, the editor points out the one in your Library that looks alike.',
        icon: 'lookalike',
        destination: 'prompt-editor-new'
      },
      {
        kind: 'feature',
        title: 'Tidy up',
        description: 'Analytics counts your Never used Prompts and Duplicate pairs, and Review opens them in the Library.',
        icon: 'broom',
        destination: 'analytics'
      },
      {
        kind: 'feature',
        title: 'New category while you write',
        description: 'Create a Category from the editor without leaving the Prompt you are writing.',
        icon: 'category',
        destination: 'prompt-editor-new'
      },
      {
        kind: 'feature',
        title: 'Undo a Category deletion',
        description: 'Undo in the Notification brings a deleted Category back with all its Prompts.',
        icon: 'undo',
        destination: 'categories'
      },
      {
        kind: 'feature',
        title: 'Fix the icon yourself',
        description: "When a Platform's toolbar changes, place the Prompts icon again yourself from Settings.",
        icon: 'wrench',
        destination: 'settings'
      },
      {
        kind: 'critical-fix',
        title: 'Prompts arrive as written',
        description: 'A Prompt reaches the Platform exactly as you wrote it, line breaks included, and only once.'
      },
      {
        kind: 'critical-fix',
        title: 'The icon stays put',
        description: 'The Prompts icon comes back when a Platform redraws its toolbar, instead of disappearing.'
      },
      {
        kind: 'critical-fix',
        title: 'Your site settings are safe',
        description: 'A slow or failed load no longer replaces your Site settings with empty or default ones.'
      },
      {
        kind: 'critical-fix',
        title: 'No empty backups',
        description: 'An export never saves an empty Library when your Prompts could not be read.'
      },
      {
        kind: 'critical-fix',
        title: 'Saving always works',
        description: 'Storage limits are measured right, and a failed save tells you why without locking the Library.'
      },
      {
        kind: 'critical-fix',
        title: 'No lost changes',
        description: 'Changes made at the same moment, or during an update, are kept instead of overwriting each other.'
      }
    ]
  }
];

const versionParts = (version: string): number[] =>
  version.split('.').map((part) => {
    const n = Number.parseInt(part, 10);
    return Number.isNaN(n) ? 0 : n;
  });

/** Numeric, part-by-part version order: 1.10.0 is newer than 1.9.0. */
export const compareVersions = (a: string, b: string): number => {
  const left = versionParts(a);
  const right = versionParts(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
};

/** The Release notes of the newest Release that has at least one item, if any. */
export const newestReleaseNotes = (
  registry: readonly ReleaseNotes[] = RELEASE_NOTES
): ReleaseNotes | undefined =>
  registry
    .filter((notes) => notes.items.length > 0)
    .reduce<ReleaseNotes | undefined>(
      (newest, notes) =>
        newest === undefined || compareVersions(notes.version, newest.version) > 0 ? notes : newest,
      undefined
    );

const VARIABLE = /\{\{(\w+)\}\}/g;

/**
 * Splits a hero example into text and variable segments. Each `{{word}}`
 * becomes a variable; anything else, unmatched braces included, stays text.
 */
export const parseExample = (example: string): ExampleSegment[] => {
  const segments: ExampleSegment[] = [];
  let last = 0;
  for (const match of example.matchAll(VARIABLE)) {
    const start = match.index;
    if (start > last) {
      segments.push({ kind: 'text', text: example.slice(last, start) });
    }
    segments.push({ kind: 'variable', name: match[1] });
    last = start + match[0].length;
  }
  if (last < example.length) {
    segments.push({ kind: 'text', text: example.slice(last) });
  }
  return segments;
};
