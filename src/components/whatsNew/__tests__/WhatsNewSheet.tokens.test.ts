// @vitest-environment node
/**
 * The What's new sheet stays on the tokens and on the motion of the mockup: no color literal in
 * the component, its new tokens in light and dark, its animations in step with MOTION, and every
 * one of them near instant under prefers-reduced-motion.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { compile } from '@tailwindcss/node';
import { describe, expect, it } from 'vitest';

import { EASE, MOTION } from '../../../theme/motion';

const SRC = path.resolve(__dirname, '../../..');
const POPUP_CSS = path.join(SRC, 'popup.css');
const read = (file: string): string => readFileSync(path.join(SRC, file), 'utf8');

const tokens = read('theme/tokens.css');
const popupCss = read('popup.css');
const component = read('components/whatsNew/WhatsNewSheet.tsx');

/** The light block (@theme static) and the dark one (.dark), as written */
const lightBlock = tokens.slice(tokens.indexOf('@theme static {'), tokens.indexOf('@media (prefers-reduced-motion: reduce)'));
const darkBlock = tokens.slice(tokens.indexOf('.dark {'));

const buildCss = async (candidates: string[]): Promise<string> => {
  const compiler = await compile(popupCss, { base: SRC, from: POPUP_CSS, onDependency: () => undefined });
  return compiler.build(candidates);
};

describe('WhatsNewSheet tokens', () => {
  describe('AC4: colors come from tokens only', () => {
    it('writes no hex, rgb or hsl color literal, and no raw palette class', () => {
      expect(component.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi) ?? []).toEqual([]);
      expect(component).not.toMatch(/\b(?:bg|text|border|shadow)-(?:white|black|gray|purple|violet|indigo)(?:-\d+)?\b/);
    });

    it('draws the handle with a token that follows the strong border in light and dark', () => {
      expect(lightBlock).toContain('--background-color-handle: var(--border-color-strong);');
    });

    it('casts the upward shadow with a violet tint in light and a stronger black in dark', () => {
      expect(lightBlock).toContain('--shadow-tint-sheet: rgba(45, 25, 90, 0.45);');
      expect(lightBlock).toContain('--shadow-sheet: 0 -20px 50px -20px var(--shadow-tint-sheet);');
      expect(darkBlock).toContain('--shadow-tint-sheet: rgba(0, 0, 0, 0.72);');
    });

    it('rounds the top corners 26px', () => {
      expect(lightBlock).toContain('--radius-sheet: 26px;');
    });

    it('compiles every class the sheet takes from a token', async () => {
      const expectations: Array<[className: string, variable: string]> = [
        ['bg-handle', '--background-color-handle'],
        ['shadow-sheet', '--shadow-tint-sheet'],
        ['rounded-t-sheet', '--radius-sheet'],
        ['bg-backdrop', '--background-color-backdrop'],
        ['bg-card', '--background-color-card'],
        ['bg-accent-selected', '--background-color-accent-selected'],
        ['text-accent', '--text-color-accent'],
        ['border-divider', '--border-color-divider'],
        ['bg-accent', '--background-color-accent'],
        ['hover:bg-accent-hover', '--background-color-accent-hover'],
        ['text-on-accent', '--text-color-on-accent'],
        ['animate-whats-new-sheet-in', '--animate-whats-new-sheet-in'],
        ['animate-whats-new-sheet-out', '--animate-whats-new-sheet-out'],
        ['animate-whats-new-backdrop-in', '--animate-whats-new-backdrop-in'],
        ['animate-whats-new-backdrop-out', '--animate-whats-new-backdrop-out']
      ];
      const css = await buildCss(expectations.map(([className]) => className));

      for (const [className, variable] of expectations) {
        expect(component, `${className} is used`).toContain(className);
        expect(css, `.${className} reads ${variable}`).toContain(`var(${variable})`);
      }
    });
  });

  describe('AC5: the animations of the mockup, through MOTION', () => {
    it('rises in 600ms on cubic-bezier(.32,.72,0,1) over a backdrop that fades in over 300ms', () => {
      expect(MOTION.whatsNewSheetIn).toBe(600);
      expect(MOTION.whatsNewBackdropIn).toBe(300);
      expect(EASE.section).toBe('cubic-bezier(0.32, 0.72, 0, 1)');
      expect(tokens).toContain(`--ease-section: ${EASE.section};`);
    });

    it('leaves with its backdrop, both over the exit the caller waits for', () => {
      expect(MOTION.whatsNewBackdropOut).toBe(MOTION.whatsNewSheetOut);
      expect(MOTION.whatsNewSheetOut).toBeLessThan(MOTION.whatsNewSheetIn);
    });

    it.each([
      ['whats-new-sheet-in', `sheet-in ${MOTION.whatsNewSheetIn}ms var(--ease-section) both`],
      ['whats-new-sheet-out', `sheet-out ${MOTION.whatsNewSheetOut}ms var(--ease-sheet-out) both`],
      ['whats-new-backdrop-in', `backdrop-in ${MOTION.whatsNewBackdropIn}ms ease both`],
      ['whats-new-backdrop-out', `backdrop-out ${MOTION.whatsNewBackdropOut}ms ease both`]
    ])('animate-%s runs for the duration MOTION gives', (name, animation) => {
      expect(tokens).toContain(`--animate-${name}: ${animation};`);
    });

    it('rises from translateY(100%) and fades the backdrop from 0, with the shared keyframes', () => {
      expect(tokens).toMatch(/@keyframes sheet-in \{\s*from \{ transform: translateY\(100%\); \}/);
      expect(tokens).toMatch(/@keyframes backdrop-in \{\s*from \{ opacity: 0; \}/);
    });

    it('presses Got it on the spring of the mockup', () => {
      expect(popupCss).toMatch(/@utility transition-got-it \{\s*transition: background-color 200ms, scale 300ms var\(--ease-spring\);/);
      expect(component).toContain('active:scale-96');
    });

    it('makes the sheet, its backdrop and the press near instant under prefers-reduced-motion', () => {
      const block = popupCss.slice(popupCss.indexOf("/* --- What's new sheet"));
      const reduced = block.slice(block.indexOf('@media (prefers-reduced-motion: reduce)'));
      for (const name of ['whats-new-sheet-in', 'whats-new-sheet-out', 'whats-new-backdrop-in', 'whats-new-backdrop-out']) {
        expect(reduced).toContain(`.animate-${name}`);
      }
      expect(reduced).toMatch(/animation-duration: 1ms;\s*animation-delay: 0ms !important;/);
      expect(reduced).toMatch(/\.transition-got-it \{\s*transition-duration: 1ms;/);
    });
  });
});
