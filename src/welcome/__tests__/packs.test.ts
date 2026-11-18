import { describe, expect, it } from 'vitest';

import { DEFAULT_CATEGORY } from '../../constants';
import { findPresetColor, isValidHexColor } from '../../constants/colors';
import { admit, admitNew } from '../../services/promptAdmission';
import { LOOKALIKE_THRESHOLD, lookalikeSimilarity } from '../../services/promptLookalike';
import { extractVariables } from '../../utils/promptVariables';
import { PACKS } from '../packs';

/** Step 3 of the Welcome (epic My-Prompt-Manager-ojz, DESIGN): the Packs, in order, as the mockup shows them */
const STEP_3 = [
  { id: 'product', name: 'Product', count: 5, defaultSelected: true },
  { id: 'engineering', name: 'Engineering', count: 6, defaultSelected: false },
  { id: 'writing', name: 'Writing', count: 4, defaultSelected: true },
  { id: 'hiring', name: 'Hiring', count: 3, defaultSelected: false }
];

/** The mockup's colors; a Pack's color is the mockup's or one of the deviations reported below */
const MOCKUP_COLORS: Readonly<Record<string, string>> = {
  product: '#2563EB',
  engineering: '#15803D',
  writing: '#7C3AED',
  hiring: '#DB2777'
};

/**
 * Reported deviations from the mockup: a Pack's color becomes a Category's color, so it is taken from
 * PRESET_COLORS, which has neither #15803D nor #7C3AED.
 * - Engineering: Lime, the palette color nearest to #15803D (CIELAB distance 23, Teal's is 35).
 * - Writing: Purple, the color of the Writing starter Category (STARTER_CATEGORIES), close to #7C3AED.
 */
const REPORTED_COLOR_DEVIATIONS: Readonly<Record<string, string>> = {
  engineering: '#4D7C0F',
  writing: '#9333EA'
};

const PROMPTS = PACKS.flatMap((pack) => pack.prompts.map((prompt) => ({ pack, ...prompt })));

/** A Variable as the Packs write it: {{snake_case}}, no spaces inside the braces */
const VARIABLE = /\{\{[a-z][a-z_]*\}\}/g;

describe('PACKS', () => {
  it('are the Packs step 3 shows, in order, with their prompt counts and default selection', () => {
    expect(
      PACKS.map((pack) => ({
        id: pack.id,
        name: pack.name,
        count: pack.prompts.length,
        defaultSelected: pack.defaultSelected
      }))
    ).toEqual(STEP_3);
  });

  it('select at least one Pack by default, so the shortest path ends on a filled Library', () => {
    expect(PACKS.some((pack) => pack.defaultSelected)).toBe(true);
  });

  it('have unique ids and unique names ignoring case, none of them the Default Category', () => {
    const ids = PACKS.map((pack) => pack.id);
    const names = PACKS.map((pack) => pack.name.toLowerCase());

    expect(new Set(ids).size).toBe(PACKS.length);
    expect(new Set(names).size).toBe(PACKS.length);
    expect(names).not.toContain(DEFAULT_CATEGORY.toLowerCase());
  });

  it('have names that Admission keeps unchanged as Category names', () => {
    for (const pack of PACKS) {
      expect(admit({ category: pack.name })).toEqual({ ok: true, text: { category: pack.name } });
    }
  });

  it('have colors that are valid hex Category colors of PRESET_COLORS', () => {
    for (const pack of PACKS) {
      expect(isValidHexColor(pack.color), pack.id).toBe(true);
      expect(findPresetColor(pack.color), pack.id).toBeDefined();
    }
  });

  it("have the mockup's colors, or a reported deviation", () => {
    for (const pack of PACKS) {
      expect([MOCKUP_COLORS[pack.id], REPORTED_COLOR_DEVIATIONS[pack.id]], pack.id).toContain(pack.color);
    }
  });
});

describe('Pack Prompts', () => {
  it('come out of admitNew unchanged (Verbatim), in the Category of their Pack', () => {
    for (const { pack, title, content } of PROMPTS) {
      const admission = admitNew({ title, content, category: pack.name }, { id: 'pack-prompt', now: 0 });

      expect(admission.ok, title).toBe(true);
      if (admission.ok) {
        expect(admission.prompt.title).toBe(title);
        expect(admission.prompt.content).toBe(content);
        expect(admission.prompt.category).toBe(pack.name);
      }
    }
  });

  it('have titles of at most 60 characters, unique across all Packs ignoring case', () => {
    const titles = PROMPTS.map(({ title }) => title.toLowerCase());

    expect(new Set(titles).size).toBe(PROMPTS.length);
    for (const { title } of PROMPTS) {
      expect(title.length, title).toBeLessThanOrEqual(60);
    }
  });

  it('have contents unique across all Packs, so adding the Packs skips none of them', () => {
    expect(new Set(PROMPTS.map(({ content }) => content)).size).toBe(PROMPTS.length);
  });

  it('do not look alike: no two of them are a Lookalike, let alone a Duplicate pair', () => {
    for (const [index, a] of PROMPTS.entries()) {
      for (const b of PROMPTS.slice(index + 1)) {
        expect(lookalikeSimilarity(a.content, b.content), `${a.title} / ${b.title}`).toBeLessThan(LOOKALIKE_THRESHOLD);
      }
    }
  });

  it('are plain printable ASCII, with nothing invisible at the ends of a line', () => {
    for (const { title, content } of PROMPTS) {
      expect(title, title).toMatch(/^[\x20-\x7E]+$/);
      expect(content, title).toMatch(/^[\x20-\x7E\n]+$/);
      expect(content.trim(), title).toBe(content);
      for (const line of content.split('\n')) {
        expect(line.trim(), title).toBe(line);
      }
    }
  });

  it('write every Variable as {{snake_case}}, and use braces for nothing else', () => {
    for (const { title, content } of PROMPTS) {
      expect(content.replace(VARIABLE, ''), title).not.toMatch(/[{}]/);
      for (const name of extractVariables(content)) {
        expect(name, title).toMatch(/^[a-z][a-z_]*$/);
      }
    }
  });

  it('mostly have Variables: in each Pack, more Prompts with a Variable than without', () => {
    for (const pack of PACKS) {
      const withVariables = pack.prompts.filter(({ content }) => extractVariables(content).length > 0).length;

      expect(withVariables, pack.id).toBeGreaterThan(pack.prompts.length - withVariables);
    }
  });

  it('stay short enough to read at a glance: 600 characters at most', () => {
    for (const { title, content } of PROMPTS) {
      expect(content.length, title).toBeLessThanOrEqual(600);
    }
  });
});
