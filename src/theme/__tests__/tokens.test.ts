// @vitest-environment node
/**
 * Color tokens, read from the CSS the extension ships (src/popup.css compiled by Tailwind),
 * so a token edited later that breaks contrast or loses its dark value fails here.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { compile } from '@tailwindcss/node';
import { describe, it, expect } from 'vitest';

import { getContrastRatio } from '../../constants/colors';

const POPUP_CSS = path.resolve(__dirname, '../../popup.css');

const buildCss = async (candidates: string[] = []): Promise<string> => {
  const compiler = await compile(readFileSync(POPUP_CSS, 'utf8'), {
    base: path.dirname(POPUP_CSS),
    from: POPUP_CSS,
    onDependency: () => undefined
  });
  return compiler.build(candidates);
};

const declarationsOf = (block: string): Record<string, string> =>
  Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));

/** The compiled rule of a class (nested variants included), or undefined when Tailwind generated none */
const ruleFor = (css: string, className: string): string | undefined => {
  const start = css.indexOf(`.${className.replace(':', '\\:')} {`);
  return start < 0 ? undefined : css.slice(start, css.indexOf('\n  }\n', start));
};

/** A token written as var(--other) takes the other token's value in the same mode */
const resolveReferences = (own: Record<string, string>, fallback: Record<string, string>): Record<string, string> => {
  const merged = { ...fallback, ...own };
  const resolve = (value: string, depth = 0): string => {
    const reference = /^var\((--[\w-]+)\)$/.exec(value);
    return reference && depth < 10 ? resolve(merged[reference[1]] ?? value, depth + 1) : value;
  };
  return Object.fromEntries(Object.entries(merged).map(([name, value]) => [name, resolve(value)]));
};

/** Literal declarations per mode: light from the theme layer's :root, dark from the .dark override */
const readDeclarations = async (): Promise<{ light: Record<string, string>; dark: Record<string, string> }> => {
  const css = await buildCss();
  const light = /:root,\s*:host\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  const dark = /(?:^|[\s}])\.dark\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  return { light: declarationsOf(light), dark: declarationsOf(dark) };
};

/** The value every token takes in each mode */
const readTokens = async (): Promise<{ light: Record<string, string>; dark: Record<string, string> }> => {
  const { light, dark } = await readDeclarations();
  return { light: resolveReferences(light, {}), dark: resolveReferences(dark, light) };
};

describe('Color tokens', () => {
  it('primary, secondary and tertiary text are readable (4.5:1) on every surface, in light and dark', async () => {
    const tokens = await readTokens();

    for (const mode of [tokens.light, tokens.dark]) {
      for (const level of ['primary', 'secondary', 'tertiary']) {
        for (const surface of ['app', 'card', 'subtle']) {
          const text = mode[`--text-color-${level}`];
          const background = mode[`--background-color-${surface}`];
          expect(text, `text/${level}`).toBeDefined();
          expect(background, `bg/${surface}`).toBeDefined();
          expect(getContrastRatio(text, background), `text/${level} on bg/${surface}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('text on colored fills and tints is readable (4.5:1), in light and dark', async () => {
    const tokens = await readTokens();
    const pairs: Array<[text: string, background: string]> = [
      ['on-accent', 'accent'],
      ['on-accent', 'accent-hover'],
      ['on-accent', 'danger'],
      ['on-accent', 'danger-hover'],
      ['accent-strong', 'accent-selected'],
      ['accent', 'accent-subtle'],
      ['success', 'success-subtle'],
      ['warning', 'warning-subtle'],
      ['danger', 'danger-subtle'],
      ['on-inverse', 'inverse']
    ];

    for (const mode of [tokens.light, tokens.dark]) {
      for (const [textName, backgroundName] of pairs) {
        const text = mode[`--text-color-${textName}`];
        const background = mode[`--background-color-${backgroundName}`];
        expect(text, `text-${textName}`).toBeDefined();
        expect(background, `bg-${backgroundName}`).toBeDefined();
        expect(getContrastRatio(text, background), `text-${textName} on bg-${backgroundName}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('what identifies a control stands out (3:1) from the surface behind it, in light and dark', async () => {
    const tokens = await readTokens();
    const pairs: Array<[mark: string, background: string]> = [
      ['--border-color-input', 'app'],
      ['--border-color-input', 'subtle'],
      ['--border-color-input', 'card'],
      ['--background-color-accent', 'card'],
      ['--ring-color-accent', 'card'],
      ['--ring-color-accent', 'app'],
      ['--outline-color-accent', 'card'],
      ['--text-color-pin', 'card'],
      ['--text-color-inverse-success', 'inverse'],
      ['--text-color-inverse-danger', 'inverse'],
      ['--text-color-inverse-warning', 'inverse'],
      ['--text-color-inverse-info', 'inverse'],
      ['--scrollbar-color-thumb', 'app'],
      ['--scrollbar-color-thumb', 'card'],
      ['--scrollbar-color-thumb', 'subtle'],
      ['--scrollbar-color-thumb', 'raised'],
      ['--scrollbar-color-thumb', 'muted']
    ];

    for (const mode of [tokens.light, tokens.dark]) {
      for (const [markName, backgroundName] of pairs) {
        const mark = mode[markName];
        const background = mode[`--background-color-${backgroundName}`];
        expect(mark, markName).toBeDefined();
        expect(getContrastRatio(mark, background), `${markName} on bg-${backgroundName}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('every color token states its dark value, so none keeps its light value by omission', async () => {
    const { light, dark } = await readDeclarations();
    const literalColorTokens = Object.entries(light)
      .filter(([name, value]) => /^--(background|text|border|ring|outline|scrollbar)-color-/.test(name) && !value.startsWith('var('))
      .map(([name]) => name);

    expect(literalColorTokens.length).toBeGreaterThan(0);
    expect(literalColorTokens.filter(name => !(name in dark)), 'tokens with no .dark value').toEqual([]);
  });

  it('every token class of the palette exists and reads its token', async () => {
    const classes = [
      'bg-app', 'bg-card', 'bg-subtle', 'bg-raised', 'bg-muted', 'bg-inverse', 'bg-backdrop',
      'border-default', 'border-divider', 'border-strong', 'border-input',
      'text-primary', 'text-secondary', 'text-tertiary', 'text-faint', 'text-on-inverse', 'text-on-accent',
      'placeholder:text-tertiary',
      'bg-accent', 'bg-accent-hover', 'bg-accent-selected', 'bg-accent-subtle',
      'text-accent', 'text-accent-strong', 'border-accent', 'ring-accent', 'outline-accent',
      'bg-success', 'bg-success-subtle', 'text-success',
      'bg-warning-subtle', 'border-warning', 'text-warning',
      'bg-danger', 'bg-danger-hover', 'bg-danger-subtle', 'border-danger', 'text-danger',
      'border-focus', 'border-error', 'outline-danger',
      'text-pin', 'text-inverse-success', 'text-inverse-danger', 'text-inverse-warning', 'text-inverse-info'
    ];
    const css = await buildCss(classes);

    for (const className of classes) {
      expect(ruleFor(css, className), `.${className}`).toMatch(/var\(--[\w-]+-color-[\w-]+\)/);
    }
  });

  it('the page itself (body, scrollbars, default border) is colored by tokens only', () => {
    const ownRules = readFileSync(POPUP_CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const literalColors = ownRules.match(/#[0-9a-f]{3,8}\b|rgba?\(|--color-[a-z]+-\d+/gi) ?? [];

    expect(literalColors, 'colors written in popup.css instead of tokens').toEqual([]);
    expect(ownRules).toMatch(/body\s*\{[^}]*background:\s*var\(--background-color-app\)/);

    // Every idle scrollbar thumb takes the thumb token, the one checked at 3:1 above
    const thumbs = [
      ...ownRules.matchAll(/scrollbar-color:\s*([^;]+);/g),
      ...ownRules.matchAll(/scrollbar-thumb\s*\{[^}]*background:\s*([^;]+);/g)
    ].map(([, value]) => value.trim());
    expect(thumbs.length).toBeGreaterThan(0);
    for (const thumb of thumbs) {
      expect(thumb, 'scrollbar thumb').toMatch(/^var\(--scrollbar-color-thumb\)/);
    }
  });

  it('shadows take the violet tint in light and a stronger black in dark', async () => {
    const shadows = ['shadow-2xs', 'shadow-xs', 'shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-2xl'];
    const css = await buildCss(shadows);
    const { light, dark } = await readTokens();

    for (const className of shadows) {
      const rule = ruleFor(css, className);
      expect(rule, `.${className}`).toMatch(/var\(--shadow-tint-\d+\)/);
      expect(rule, `.${className} uses no black`).not.toContain('rgb(0 0 0');
    }
    for (const tint of ['--shadow-tint-5', '--shadow-tint-10', '--shadow-tint-25']) {
      expect(light[tint], `${tint} light`).toMatch(/^rgba\(45, 25, 90, /);
      expect(dark[tint], `${tint} dark`).toMatch(/^rgba\(0, 0, 0, /);
    }
  });

  it('the focus utilities draw their ring from the tokens', async () => {
    const expectations: Array<[className: string, token: string]> = [
      ['focus-primary', '--outline-color-accent'],
      ['focus-secondary', '--outline-color-accent'],
      ['focus-interactive', '--outline-color-accent'],
      ['focus-danger', '--outline-color-danger'],
      ['focus-input', '--ring-color-accent']
    ];
    const css = await buildCss(expectations.map(([className]) => className));

    for (const [className, token] of expectations) {
      const rule = ruleFor(css, className);
      expect(rule, `.${className}`).toContain(`var(${token})`);
      expect(rule, `.${className} uses no raw palette color`).not.toMatch(/--color-(purple|red|white|gray)-/);
    }
  });

});
