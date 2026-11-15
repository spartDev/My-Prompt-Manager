// @vitest-environment node
/**
 * Color tokens, read from the CSS the extension ships (src/popup.css compiled by Tailwind),
 * so a token edited later that breaks contrast or loses its dark value fails here.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { compile } from '@tailwindcss/node';
import { describe, expect, it } from 'vitest';

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

/**
 * The compiled rule of a class, its variant included, or undefined when Tailwind generated none.
 * Tailwind 4.3.3 writes a variant into the selector (`.focus-primary:focus {`); earlier versions nested it (`.focus-primary { &:focus {`).
 */
const ruleFor = (css: string, className: string): string | undefined => {
  const selector = `.${className.replace(':', '\\:')}`.replace(/[.\\]/g, '\\$&');
  const start = new RegExp(`${selector}(?=[\\s:{])`).exec(css)?.index;
  return start === undefined ? undefined : css.slice(start, css.indexOf('\n  }\n', start));
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
      ['on-inverse', 'inverse'],
      // A search match is marked under text-primary, in a title and in a preview
      ['primary', 'highlight'],
      // A Platform switched off: its logo square (My-Prompt-Manager-el4.5.3)
      ['tertiary', 'muted'],
      // Empty states and dashed panels
      ['tertiary', 'raised'],
      // The Notification pill: its message, and the glyph on its round
      ['on-inverse-strong', 'inverse'],
      ['on-inverse-mark', 'inverse-mark'],
      ['on-inverse-mark', 'inverse-alert'],
      // The Analytics hero's day labels, and the Tidy up callout
      ['on-inverse-muted', 'inverse'],
      ['callout', 'callout'],
      ['warning', 'card']
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
      ['--background-color-warning', 'card'],
      // The Notification's round, a confirmation's and a failure's
      ['--background-color-inverse-mark', 'inverse'],
      ['--background-color-inverse-alert', 'inverse'],
      // Empty states: the hero's 0 (46px, large text) and the tiles of the Categories illustration
      ['--text-color-on-inverse-dim', 'inverse'],
      ['--text-color-tile-blue', 'app'],
      ['--text-color-tile-pink', 'app'],
      ['--text-color-tile-violet', 'app'],
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
      'bg-accent', 'bg-accent-hover', 'bg-accent-selected', 'bg-accent-subtle', 'bg-highlight',
      'text-accent', 'text-accent-strong', 'border-accent', 'ring-accent', 'outline-accent',
      'bg-success', 'bg-success-subtle', 'text-success',
      'bg-warning', 'bg-warning-subtle', 'border-warning', 'text-warning',
      'bg-danger', 'bg-danger-hover', 'bg-danger-subtle', 'border-danger', 'text-danger',
      'border-focus', 'border-error', 'outline-danger',
      'text-pin', 'text-on-inverse-strong', 'text-on-inverse-mark', 'bg-inverse-mark', 'bg-inverse-alert', 'bg-inverse-action',
      'bg-inverse-bar', 'bg-inverse-bar-hover', 'text-on-inverse-muted', 'bg-callout', 'text-callout',
      'border-ghost', 'border-inverse-ghost', 'text-on-inverse-dim', 'text-tile-blue', 'text-tile-pink', 'text-tile-violet'
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

  it('the brand gradient runs from the light accent to accent-strong, the same in both modes', async () => {
    const css = await buildCss(['bg-brand']);
    const { light, dark } = await readDeclarations();

    expect(ruleFor(css, 'bg-brand')).toContain('background-image: var(--background-image-brand)');
    expect(light['--background-image-brand']).toBe('linear-gradient(135deg, #6d28d9 0%, #4c1d95 100%)');
    expect(dark['--background-image-brand'], 'no dark override').toBeUndefined();
  });

  it('shadows take the violet tint in light and a stronger black in dark', async () => {
    const shadows = ['shadow-2xs', 'shadow-xs', 'shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-2xl', 'shadow-puck', 'shadow-knob'];
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

  it('motion comes from tokens, which reduced motion makes near instant', async () => {
    const css = await buildCss(['ease-spring', 'rounded-group', 'animate-fill-grow', 'duration-(--duration-spring)', 'delay-(--delay-fill)']);
    const { light } = await readTokens();
    const durations = ['--duration-color', '--duration-dim', '--duration-track', '--duration-spring', '--duration-fill'];

    expect(ruleFor(css, 'ease-spring')).toContain('var(--ease-spring)');
    expect(ruleFor(css, 'rounded-group')).toContain('var(--radius-group)');
    expect(ruleFor(css, 'animate-fill-grow')).toContain('var(--animate-fill-grow)');
    expect(light['--ease-spring']).toBe('cubic-bezier(0.34, 1.56, 0.64, 1)');
    for (const token of [...durations, '--delay-fill']) {
      expect(light[token], token).toMatch(/^\d+ms$/);
    }

    const reduced = /@media \(prefers-reduced-motion: reduce\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    for (const token of durations) {
      expect(reduced, `${token} under reduced motion`).toMatch(new RegExp(`${token}:\\s*1ms`));
    }
    expect(reduced).toMatch(/--delay-fill:\s*0ms/);
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

// --- What's new tiles (My-Prompt-Manager-d1g.6) ---
describe("What's new tiles tokens", () => {
  it('the tile radii, the icon square shadow and the rise compile to their classes', async () => {
    const classes = ['rounded-tile', 'rounded-tile-icon', 'shadow-tile-icon', 'animate-tile-rise', 'transition-tile'];
    const css = await buildCss(classes);
    const { light, dark } = await readTokens();

    expect(ruleFor(css, 'rounded-tile')).toContain('var(--radius-tile)');
    expect(ruleFor(css, 'rounded-tile-icon')).toContain('var(--radius-tile-icon)');
    expect(ruleFor(css, 'shadow-tile-icon')).toMatch(/var\(--shadow-tint-40\)/);
    expect(ruleFor(css, 'animate-tile-rise')).toContain('var(--animate-tile-rise)');
    expect(ruleFor(css, 'transition-tile')).toContain('var(--ease-spring)');
    expect([light['--radius-tile'], light['--radius-tile-icon']]).toEqual(['18px', '11px']);
    expect(light['--shadow-tint-40']).toBe('rgba(45, 25, 90, 0.4)');
    expect(dark['--shadow-tint-40'], 'black at alpha x 1.6 in dark').toBe('rgba(0, 0, 0, 0.64)');
  });

  it('a hero variable pill (text-accent on bg-accent-selected) is readable, in light and dark', async () => {
    const { light, dark } = await readTokens();

    for (const mode of [light, dark]) {
      expect(getContrastRatio(mode['--text-color-accent'], mode['--background-color-accent-selected'])).toBeGreaterThanOrEqual(4.5);
    }
  });
});
// --- end What's new tiles ---

// --- What's new in light and dark (My-Prompt-Manager-d1g.9) ---
/** The files that draw What's new: the sheet, the grid, its tiles and their icons */
const WHATS_NEW_FILES = [
  'components/whatsNew/WhatsNewSheet.tsx',
  'components/whatsNew/WhatsNewGrid.tsx',
  'components/whatsNew/WhatsNewTile.tsx',
  'components/icons/WhatsNewIcons.tsx'
].map(file => readFileSync(path.resolve(__dirname, '../..', file), 'utf8'));

/**
 * Every color token What's new reads, with its value in light and in dark. The dark mockup
 * (MPM-C-Atelier-Sombre, block wn) is in the comment where it differs; each gap is kept on purpose,
 * since these tokens are shared with the other screens.
 */
const WHATS_NEW_COLORS: Array<[token: string, light: string, dark: string]> = [
  // The backdrop (mockup rgba(4, 2, 10, 0.53)), the sheet, its handle and its upward shadow
  ['--background-color-backdrop', 'rgba(42, 33, 64, 0.45)', 'rgba(7, 5, 12, 0.7)'],
  ['--background-color-card', '#ffffff', '#231c34'],
  ['--background-color-handle', '#dcd4ea', '#41375a'],
  ['--shadow-tint-sheet', 'rgba(45, 25, 90, 0.45)', 'rgba(0, 0, 0, 0.72)'],
  // The pill "New in {version}"
  ['--background-color-accent-subtle', '#f1ebfd', '#2f2350'],
  ['--text-color-accent', '#5b21b6', '#c4b5fd'],
  // The title, the hero sentence, the tile titles, the ⌘K chip (mockup hero sentence #e4def0)
  ['--text-color-primary', '#1d1530', '#f1edf9'],
  // The descriptions (mockup #b3aac8)
  ['--text-color-secondary', '#5c5370', '#bcb3d0'],
  // The tiles, the ⌘K chip; a hovered Feature tile and the Variable pills (mockup hover #2f2350, pills #3d2d75)
  ['--background-color-subtle', '#f4f1fa', '#2b2340'],
  ['--background-color-accent-selected', '#ede5ff', '#38296a'],
  ['--border-color-strong', '#dcd4ea', '#41375a'],
  ['--shadow-tint-40', 'rgba(45, 25, 90, 0.4)', 'rgba(0, 0, 0, 0.64)'],
  // The Fixed pill of a Critical fix
  ['--background-color-success-subtle', '#e7f8ef', '#0f2d22'],
  ['--text-color-success', '#065f46', '#6ee7b7'],
  // The footer rule (mockup #2e2645), Got it, its hover and the focus outline
  ['--border-color-divider', '#f0ebf8', '#2f2744'],
  ['--background-color-accent', '#6d28d9', '#844bf2'],
  ['--background-color-accent-hover', '#5b21b6', '#7a40e3'],
  ['--text-color-on-accent', '#ffffff', '#ffffff'],
  ['--outline-color-accent', '#6d28d9', '#844bf2']
];

describe("What's new in light and dark", () => {
  it('lists every color class of the What\'s new files', async () => {
    const { light } = await readDeclarations();
    const prefixes: Record<string, string> = { bg: 'background', text: 'text', border: 'border' };
    const used = new Set<string>();
    for (const source of WHATS_NEW_FILES) {
      for (const [, prefix, name] of source.matchAll(/(?<![\w-])(bg|text|border)-([a-z][a-z-]*[a-z])(?![\w-])/g)) {
        const token = `--${prefixes[prefix]}-color-${name}`;
        if (token in light) {used.add(token);}
      }
    }
    // Drawn through a utility rather than a color class: focus-primary, shadow-sheet, shadow-tile-icon
    used.add('--outline-color-accent').add('--shadow-tint-sheet').add('--shadow-tint-40');

    expect(used.size).toBeGreaterThan(10);
    expect([...used].filter(token => !WHATS_NEW_COLORS.some(([listed]) => listed === token)), 'tokens missing from the list').toEqual([]);
  });

  it.each(WHATS_NEW_COLORS)('%s is %s in light and %s in dark', async (token, lightValue, darkValue) => {
    const declared = await readDeclarations();
    const { light, dark } = await readTokens();
    const reference = /^var\((--[\w-]+)\)$/.exec(declared.light[token] ?? '')?.[1];

    expect(token in declared.dark || (reference !== undefined && reference in declared.dark), `${token} has a .dark value`).toBe(true);
    expect(light[token]).toBe(lightValue);
    expect(dark[token]).toBe(darkValue);
  });

  it('its text is readable (4.5:1) and its marks stand out (3:1), in light and dark', async () => {
    const tokens = await readTokens();
    const pairs: Array<[what: string, foreground: string, background: string, minimum: number]> = [
      ['pill "New in"', '--text-color-accent', '--background-color-accent-subtle', 4.5],
      ['title', '--text-color-primary', '--background-color-card', 4.5],
      ['hero sentence, tile title, ⌘K chip', '--text-color-primary', '--background-color-subtle', 4.5],
      ['hovered hero sentence, tile title', '--text-color-primary', '--background-color-accent-selected', 4.5],
      ['description', '--text-color-secondary', '--background-color-subtle', 4.5],
      ['hovered description', '--text-color-secondary', '--background-color-accent-selected', 4.5],
      ['Variable pill', '--text-color-accent', '--background-color-accent-selected', 4.5],
      ['Variable pill on the hovered hero', '--text-color-accent', '--background-color-card', 4.5],
      ['Fixed pill', '--text-color-success', '--background-color-success-subtle', 4.5],
      ['Got it', '--text-color-on-accent', '--background-color-accent', 4.5],
      ['hovered Got it', '--text-color-on-accent', '--background-color-accent-hover', 4.5],
      ['Feature icon (non-text)', '--text-color-accent', '--background-color-card', 3],
      ['focus outline (non-text)', '--outline-color-accent', '--background-color-card', 3]
    ];

    for (const [mode, values] of Object.entries(tokens)) {
      for (const [what, foreground, background, minimum] of pairs) {
        expect(getContrastRatio(values[foreground], values[background]), `${what}, ${mode}`).toBeGreaterThanOrEqual(minimum);
      }
    }
  });
});
// --- end What's new in light and dark ---
