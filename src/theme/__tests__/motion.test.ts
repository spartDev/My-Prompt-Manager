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
    ['toast-mark', `pop ${MOTION.toastIn}ms var(--ease-spring) ${MOTION.toastMarkDelay}ms both`],
    ['category-sheet-in', `sheet-in ${MOTION.categorySheetIn}ms var(--ease-sheet) both`],
    ['category-sheet-out', `sheet-out ${MOTION.categorySheetOut}ms var(--ease-sheet) both`],
    ['backdrop-in', `backdrop-in ${MOTION.backdropIn}ms ease both`],
    ['backdrop-out', `backdrop-out ${MOTION.backdropOut}ms ease both`],
    ['category-pop', `pop ${MOTION.categoryPop}ms var(--ease-spring) both`],
    ['bar-grow', `bar-grow ${MOTION.barGrow}ms var(--ease-spring) both`],
    ['card-rise', `card-rise ${MOTION.cardRise}ms var(--ease-spring) both`],
    ['rank-fill', `fill-grow ${MOTION.rankFill}ms var(--ease-spring) both`],
    ['clear-pop', `pop ${MOTION.clearPop}ms var(--ease-spring) both`],
    ['list-rise', `card-rise ${MOTION.listRise}ms var(--ease-spring) both`],
    ['list-rise-again', `card-rise-again ${MOTION.listRise}ms var(--ease-spring) both`],
    ['empty-rise', `card-rise ${MOTION.emptyRise}ms var(--ease-spring) both`],
    ['float', `float ${MOTION.float}ms ease-in-out infinite`],
    ['badge-pop', `pop ${MOTION.badgePop}ms var(--ease-spring) ${MOTION.badgePopDelay}ms both`],
    ['ghost-grow', `bar-grow ${MOTION.ghostGrow}ms var(--ease-spring) both`]
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
    for (const name of ['sheet-in', 'sheet-out', 'recede-in', 'recede-out', 'scrim-in', 'scrim-out', 'pop', 'toast-in', 'backdrop-in', 'backdrop-out']) {
      expect(tokens).toContain(`@keyframes ${name}`);
    }
  });

  it('lets the sheet rise in 400ms, gently, and leave a little faster', () => {
    expect(MOTION.sheetIn).toBe(400);
    expect(MOTION.sheetOut).toBeLessThan(MOTION.sheetIn);
  });

  it('keeps the timing approved for the Category sheet: in 500ms, out 280ms, backdrop 300/280ms, pop 500ms', () => {
    expect(MOTION.categorySheetIn).toBe(500);
    expect(MOTION.categorySheetOut).toBe(280);
    expect(MOTION.backdropIn).toBe(300);
    expect(MOTION.backdropOut).toBe(280);
    expect(MOTION.categoryPop).toBe(500);
  });

  it('keeps the Analytics timing of the mockup: bars 800ms from 200ms by 60ms, cards 500ms at 100/180ms, fills 1s from 300ms by 90ms', () => {
    expect([MOTION.barGrow, MOTION.barDelay, MOTION.barStagger]).toEqual([800, 200, 60]);
    expect([MOTION.cardRise, MOTION.cardDelay, MOTION.cardDelay + MOTION.cardStagger]).toEqual([500, 100, 180]);
    expect([MOTION.rankFill, MOTION.rankDelay, MOTION.rankStagger]).toEqual([1000, 300, 90]);
    expect(tokens).toContain('@keyframes bar-grow');
    expect(tokens).toContain('@keyframes card-rise');
  });

  it('makes the Analytics animations near instant, with no delay, under reduced motion', () => {
    const popupCss = readFileSync(path.resolve(__dirname, '../../popup.css'), 'utf8');
    const reduced = popupCss.slice(popupCss.indexOf('@media (prefers-reduced-motion: reduce)'));
    for (const name of ['bar-grow', 'card-rise', 'rank-fill']) {
      expect(reduced).toContain(`.animate-${name}`);
    }
    expect(reduced).toMatch(/animation-duration: 1ms;\s*animation-delay: 0ms !important;/);
  });

  it('makes the empty states near instant under reduced motion, and stops the loop', () => {
    const popupCss = readFileSync(path.resolve(__dirname, '../../popup.css'), 'utf8');
    const reduced = popupCss.slice(popupCss.indexOf('@media (prefers-reduced-motion: reduce)'));
    for (const name of ['card-rise', 'badge-pop', 'ghost-grow']) {
      expect(reduced).toContain(`.animate-${name}`);
    }
    expect(reduced).toMatch(/\.animate-float\s*\{\s*animation: none;/);
  });

  it('makes the Save pause the 620ms of the mockup', () => {
    expect(MOTION.savedPause).toBe(620);
  });
});
