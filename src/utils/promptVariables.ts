/**
 * Prompt Variables: named placeholders written {{name}} inside a Prompt's text.
 *
 * Pure functions shared by the popup (variable count on the card) and the content script
 * (fill-in form before insertion). Keep this module free of DOM, chrome and logger imports.
 *
 * Rules: the name is the text between the braces, trimmed; it must be non-empty and on one
 * line, without braces. The same name repeated is one variable. Anything else ({{}}, {name})
 * is plain text.
 */

const VARIABLE_PATTERN = /\{\{([^{}\n]+)\}\}/g;

/** Distinct variable names in order of first appearance. */
export const extractVariables = (text: string): string[] => {
  const names = new Set<string>();
  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    const name = match[1].trim();
    if (name) {
      names.add(name);
    }
  }
  return [...names];
};

/**
 * Replaces each variable with its value. A variable with no value, or an empty one, stays
 * exactly as written. Values are inserted literally.
 */
export const fillVariables = (text: string, values: Readonly<Record<string, string>>): string =>
  text.replace(VARIABLE_PATTERN, (raw: string, rawName: string) => {
    const name = rawName.trim();
    const value = Object.prototype.hasOwnProperty.call(values, name) ? values[name] : '';
    return value ? value : raw;
  });

/** A run of a Prompt's text: plain text, or one Variable as written ({{ name }}), with its name. */
export type TextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'variable'; text: string; name: string };

/**
 * Cuts the text into plain runs and Variables, in order. Joining every segment's `text` gives the
 * text back exactly, so a view built from the segments shows the Prompt as written.
 */
export const splitVariables = (text: string): TextSegment[] => {
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    const name = match[1].trim();
    if (!name) {
      continue;
    }
    const start = match.index;
    if (start > last) {
      segments.push({ kind: 'text', text: text.slice(last, start) });
    }
    segments.push({ kind: 'variable', text: match[0], name });
    last = start + match[0].length;
  }
  if (last < text.length) {
    segments.push({ kind: 'text', text: text.slice(last) });
  }
  return segments;
};
