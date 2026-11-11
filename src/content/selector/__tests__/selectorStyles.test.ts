// @vitest-environment node
/**
 * The Prompt selector's stylesheet stays on the popup's color tokens (src/theme/tokens.css) and
 * on the motion table of the Atelier 1C mockup.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { DURATION, EASE } from '../motion';
import { getSelectorCSS } from '../selectorStyles';

const TOKENS_CSS = readFileSync(path.resolve(__dirname, '../../../theme/tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const declarationsOf = (block: string): Record<string, string> =>
  Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim().replace(/\s+/g, ' ').toLowerCase()]));

/** The block of the first rule whose selector is exactly `selector` */
const blockOf = (css: string, selector: string): string => {
  let start = css.indexOf(`${selector} {`);
  while (start > 0 && !/[\s}]/.test(css[start - 1])) {
    start = css.indexOf(`${selector} {`, start + 1);
  }
  expect(start, `rule ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
};

const popup = {
  light: declarationsOf(blockOf(TOKENS_CSS, '@theme static')),
  dark: declarationsOf(blockOf(TOKENS_CSS, '.dark'))
};

const css = getSelectorCSS();

describe('Prompt selector stylesheet: color tokens', () => {
  it('declares the popup tokens on :host with their light values, and on the dark theme with their dark values', () => {
    const light = declarationsOf(blockOf(css, ':host'));
    const dark = declarationsOf(blockOf(css, ':host([data-theme="dark"])'));

    expect(Object.keys(light).length).toBeGreaterThan(10);
    for (const [name, value] of Object.entries(light)) {
      expect(popup.light[name], `${name} is a token of tokens.css`).toBeDefined();
      expect(value, `${name} (light)`).toBe(popup.light[name]);
    }
    // Every token is declared again in dark, with the popup's dark value (or its only value)
    for (const [name, value] of Object.entries(light)) {
      expect(dark[name], `${name} (dark)`).toBe(popup.dark[name] ?? value);
    }
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it('writes no color outside the token declarations', () => {
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[\w-]+\s*:[^;]+;/g, '');
    const literals = rules.match(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\(|:\s*(?:white|black)\b/gi) ?? [];

    expect(literals).toEqual([]);
  });

  it('reads only tokens it declares', () => {
    const declared = new Set(Object.keys(declarationsOf(blockOf(css, ':host'))));
    const used = [...css.matchAll(/var\((--(?:background|text|border|scrollbar)-color-[\w-]+|--shadow-[\w-]+)/g)].map(([, name]) => name);

    expect(used.length).toBeGreaterThan(0);
    expect([...new Set(used)].filter((name) => !declared.has(name)), 'tokens read but not declared').toEqual([]);
  });

  it('declares no token it does not read', () => {
    const declared = Object.keys(declarationsOf(blockOf(css, ':host'))).filter((name) => !name.startsWith('--mpm-'));

    expect(declared.filter((name) => !css.includes(`var(${name})`)), 'tokens declared but not read').toEqual([]);
  });
});

describe('Prompt selector stylesheet: motion', () => {
  it('uses the curves and durations of the Atelier 1C motion table', () => {
    expect(EASE).toEqual({ spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)', sheet: 'cubic-bezier(0.32, 0.72, 0, 1)' });
    expect(DURATION).toMatchObject({ open: 420, close: 180, row: 350, step: 400, tab: 250, button: 300 });
  });

  it('opens with a spring from 14px lower and 92% of its size, from its bottom left corner', () => {
    expect(css).toContain(`animation: mpm-pick 420ms ${EASE.spring} both`);
    expect(css).toMatch(/@keyframes mpm-pick \{\s*from \{ opacity: 0; transform: translateY\(var\(--mpm-shift\)\) scale\(0\.92\); \}/);
    expect(css).toContain('--mpm-shift: 14px');
    expect(css).toContain('transform-origin: bottom left');
  });

  it('closes in 180ms, eased, towards 10px lower and 95% of its size', () => {
    expect(css).toContain('animation: mpm-pick-out 180ms ease both');
    expect(css).toMatch(/to \{ opacity: 0; transform: translateY\(var\(--mpm-shift-out\)\) scale\(0\.95\); \}/);
    expect(css).toContain('--mpm-shift-out: 10px');
  });

  it('rows rise 12px with a spring; the variables step slides 26px from the right on the sheet curve', () => {
    expect(css).toContain(`animation: mpm-up 350ms ${EASE.spring} both`);
    expect(css).toContain('from { opacity: 0; transform: translateY(12px); }');
    expect(css).toContain(`animation: mpm-left 400ms ${EASE.sheet} both`);
    expect(css).toContain('from { opacity: 0; transform: translateX(26px); }');
  });

  it('confirms an Insertion with a 450ms spring on the pill and one 1.1s sweep on the sheet curve', () => {
    expect(DURATION).toMatchObject({ inserted: 450, sweep: 1100, insertedStay: 2800 });
    expect(css).toContain(`animation: mpm-inserted 450ms ${EASE.spring} both`);
    expect(css).toContain('from { opacity: 0; transform: translateY(-14px) scale(0.9); }');
    expect(css).toContain(`animation: mpm-sweep 1100ms ${EASE.sheet} both`);
    expect(css).toContain('from { background-position: 120% 0; opacity: 1; }');
    expect(css).toContain('to { background-position: -20% 0; opacity: 0; }');
    // The sweep is drawn over the Platform's input field: it must never take a click meant for it
    expect(blockOf(css, '.mpm-sweep')).toContain('pointer-events: none');
  });

  it('runs every animation and transition for 1ms under reduced motion', () => {
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));

    expect(reduced).toContain('animation-duration: 1ms');
    expect(reduced).toContain('transition-duration: 1ms');
    for (const animated of ['.mpm-popover', '.mpm-row', '.mpm-fill', '.mpm-sweep', '.mpm-inserted']) {
      expect(reduced).toContain(animated);
    }
  });
});

describe('Prompt selector stylesheet: shape', () => {
  it('has balanced braces and no stray value', () => {
    expect((css.match(/{/g) ?? []).length).toBe((css.match(/}/g) ?? []).length);
    expect(css).not.toContain('undefined');
    expect(css).not.toContain('NaN');
  });

  it('gives the popover the radius, border and list height of the mockup', () => {
    const popover = blockOf(css, '.mpm-popover');

    expect(popover).toContain('border-radius: 22px');
    expect(popover).toContain('border: 1px solid var(--border-color-default)');
    expect(popover).toContain('box-shadow: var(--shadow-selector)');
    expect(blockOf(css, '.mpm-list')).toContain('max-height: 230px');
  });
});
