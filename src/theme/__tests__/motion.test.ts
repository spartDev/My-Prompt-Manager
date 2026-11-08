// @vitest-environment node
/**
 * The motion tokens of the Atelier 1C design live once in tokens.css; the timers of the components
 * read their durations from motion.ts. This keeps the two in step.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { EASE, MOTION } from '../motion';

const tokens = readFileSync(path.resolve(__dirname, '../tokens.css'), 'utf8');

describe('motion tokens', () => {
  it('defines the easings of the design', () => {
    expect(tokens).toContain(`--ease-sheet: ${EASE.sheet};`);
    expect(tokens).toContain(`--ease-sheet-out: ${EASE.sheetOut};`);
    expect(tokens).toContain(`--ease-spring: ${EASE.spring};`);
  });

  it.each([
    ['sheet-in', `sheet-in ${MOTION.sheetIn}ms var(--ease-sheet) both`],
    ['sheet-out', `sheet-out ${MOTION.sheetOut}ms var(--ease-sheet-out) both`],
    ['recede-in', `recede-in ${MOTION.sheetIn}ms var(--ease-sheet) both`],
    ['recede-out', `recede-out ${MOTION.sheetOut}ms var(--ease-sheet-out) both`],
    ['scrim-in', `scrim-in ${MOTION.sheetIn}ms var(--ease-sheet) both`],
    ['scrim-out', `scrim-out ${MOTION.sheetOut}ms var(--ease-sheet-out) both`],
    ['pop', `pop ${MOTION.pop}ms var(--ease-spring) both`],
    ['pop-check', `pop ${MOTION.popCheck}ms var(--ease-spring) both`],
    ['toast-in', `toast-in ${MOTION.toastIn}ms var(--ease-spring) both`],
    ['toast-mark', `pop ${MOTION.toastIn}ms var(--ease-spring) ${MOTION.toastMarkDelay}ms both`]
  ])('animate-%s runs for the duration motion.ts gives', (name, animation) => {
    expect(tokens).toContain(`--animate-${name}: ${animation};`);
  });

  it.each([
    ['forward', 'section-from-right'],
    ['back', 'section-from-left']
  ])('animate-section-%s slides the Section in on the Section curve, from the duration tokens', (name, keyframes) => {
    expect(tokens).toContain(`--ease-section: ${EASE.section};`);
    expect(tokens).toContain(`--duration-section: ${MOTION.sectionIn}ms;`);
    expect(tokens).toContain(`--animate-section-${name}: ${keyframes} var(--duration-section) var(--ease-section) backwards;`);
  });

  it('slides a Section 26px over the 450ms of the mockup, near instant under reduced motion', () => {
    expect(MOTION.sectionIn).toBe(450);
    expect(EASE.section).toBe('cubic-bezier(0.32, 0.72, 0, 1)');
    // Offset with left, not transform: a transformed Section would hold the fixed dialogs inside it
    expect(tokens).toMatch(/@keyframes section-from-right \{\s*from \{ opacity: 0; position: relative; left: 26px; \}\s*to \{ position: relative; left: 0; \}/);
    expect(tokens).toMatch(/@keyframes section-from-left \{\s*from \{ opacity: 0; position: relative; left: -26px; \}\s*to \{ position: relative; left: 0; \}/);
    const reduced = tokens.slice(tokens.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toContain('--duration-section: 1ms;');
  });

  it('keeps the keyframes of the mockup', () => {
    for (const name of ['sheet-in', 'sheet-out', 'recede-in', 'recede-out', 'scrim-in', 'scrim-out', 'pop', 'toast-in']) {
      expect(tokens).toContain(`@keyframes ${name}`);
    }
  });

  it('lets the sheet rise in 400ms, gently, and leave a little faster', () => {
    expect(MOTION.sheetIn).toBe(400);
    expect(MOTION.sheetOut).toBeLessThan(MOTION.sheetIn);
  });

  it('makes the Save pause the 620ms of the mockup', () => {
    expect(MOTION.savedPause).toBe(620);
  });
});
