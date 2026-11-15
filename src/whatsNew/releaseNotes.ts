import type { ExampleSegment, ReleaseNotes } from './types';

/**
 * Every Release that has Release notes, one entry per Release.
 * Adding a Release is adding an entry here.
 */
export const RELEASE_NOTES: readonly ReleaseNotes[] = [];

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
