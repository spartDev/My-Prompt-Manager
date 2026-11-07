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
