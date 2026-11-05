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
