import { expect } from 'vitest';

/**
 * Hostile-looking text, for proving that Prompt text stays text.
 *
 * Prompts are Verbatim (see CONTEXT.md and ADR-001): the extension does not strip or escape
 * text that merely looks dangerous. What keeps it safe is that every place Prompt text goes
 * (the prompt selector, each Platform's Insertion) sets it as text and never as markup.
 * Run these strings through such a place, check the text arrives exactly as given, and call
 * `expectNoMarkupIn` on the element that received it.
 */
export const HOSTILE_TEXTS: readonly string[] = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  'javascript:alert(1)',
  'data:text/html,<b>x</b>',
  '"><svg onload=alert(1)>',
  "'><iframe src=javascript:alert(1)>",
  'onerror=alert(1)',
  '&lt;b&gt;',
  '</textarea><script>alert(1)</script>'
];

/**
 * Asserts that nothing under `root` was made from Prompt text: every descendant element is
 * one of `allowedTags` (the structure the code under test builds itself, none by default),
 * and no element carries an inline event handler (an `on*` attribute).
 */
export function expectNoMarkupIn(root: ParentNode, allowedTags: readonly string[] = []): void {
  const elements = Array.from(root.querySelectorAll('*'));

  const unexpectedTags = elements
    .map((element) => element.tagName.toLowerCase())
    .filter((tag) => !allowedTags.includes(tag));
  expect(unexpectedTags).toEqual([]);

  const handlers = elements.flatMap((element) =>
    element.getAttributeNames().filter((name) => name.toLowerCase().startsWith('on'))
  );
  expect(handlers).toEqual([]);
}
