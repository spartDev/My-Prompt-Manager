import { describe, expect, it } from 'vitest';

import { DEFAULT_CATEGORY } from '../../constants';
import type { Prompt } from '../../types';
import type { AdmittedPrompt, StoredPrompt } from '../promptAdmission';
import {
  AdmissionRefusedError,
  admit,
  admitEdit,
  admitNew,
  admitRestored,
  readPrompts,
  recordUse,
  scrubStored,
  scrubStoredCategories
} from '../promptAdmission';

const valid = { title: 'T', content: 'C', category: 'Cat' };

describe('admit', () => {
  it('admits ordinary text exactly as written', () => {
    const text = {
      title: 'Metadata helper',
      content:
        '  Summarize the metadata: use <example>text</example> tags; if count=5 and onboarding = true, return data: JSON\n\n',
      category: 'Work'
    };

    expect(admit(text)).toEqual({ ok: true, text });
  });

  describe('size limits', () => {
    it.each([
      ['title', 100, 'Title cannot exceed 100 characters'],
      ['content', 20_000, 'Content cannot exceed 20,000 characters'],
      ['category', 50, 'Category name cannot exceed 50 characters']
    ] as const)(
      '%s: admitted at %i characters, refused (never shortened) one over',
      (field, max, message) => {
        expect(admit({ ...valid, [field]: 'x'.repeat(max) }).ok).toBe(true);

        expect(admit({ ...valid, [field]: 'x'.repeat(max + 1) })).toEqual({
          ok: false,
          errors: {
            [field]: { field, reason: 'too_long', length: max + 1, max, message }
          }
        });
      }
    );

    it('measures length after trimming, so surrounding spaces cannot cause a refusal', () => {
      expect(admit({ ...valid, title: ` ${'x'.repeat(100)} ` }).ok).toBe(true);
    });
  });

  describe('trimming and required fields', () => {
    it('trims title and category but never content', () => {
      expect(
        admit({ title: '  Hello  ', content: '  keep me \n', category: ' Work ' })
      ).toEqual({
        ok: true,
        text: { title: 'Hello', content: '  keep me \n', category: 'Work' }
      });
    });

    it.each([
      ['title', 'Title is required'],
      ['content', 'Content is required'],
      ['category', 'Category name is required']
    ] as const)('%s: refused as empty when it is only whitespace', (field, message) => {
      expect(admit({ ...valid, [field]: ' \n\t ' })).toMatchObject({
        ok: false,
        errors: { [field]: { field, reason: 'empty', message } }
      });
    });
  });

  it('is idempotent: admitting admitted text changes nothing', () => {
    const pieces = [
      'a', 'b', ' ', '\n', '<x>', '\u200B', '\u200C', '\u200D', '\u202E', '\u2060', '\uFEFF',
      '\u0007', '\u{1F3F4}', '\u{E0067}', '\u{E0062}', '\u{E0065}', '\u{E006E}', '\u{E0073}',
      '\u{E007F}'
    ];
    let seed = 42;
    const next = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed;
    };

    for (let i = 0; i < 2000; i++) {
      const sample = Array.from({ length: next() % 14 }, () => pieces[next() % pieces.length] ?? '').join('');
      const first = admit({ title: sample, content: sample, category: sample });

      if (first.ok) {
        expect(admit(first.text)).toEqual(first);
      }
    }
  });

  describe('a patch (an edit, or a Category name on its own)', () => {
    it('admits and returns only the fields that are present', () => {
      expect(admit({ title: '  New title ' })).toEqual({
        ok: true,
        text: { title: 'New title' }
      });
      expect(admit({ category: 'Work\u200B', content: undefined })).toEqual({
        ok: true,
        text: { category: 'Work' }
      });
      expect(admit({})).toEqual({ ok: true, text: {} });
    });

    it('checks only the fields that are present', () => {
      expect(admit({ content: 'x'.repeat(20_001) })).toEqual({
        ok: false,
        errors: { content: expect.objectContaining({ reason: 'too_long' }) }
      });
      expect(admit({ title: '   ' })).toEqual({
        ok: false,
        errors: { title: expect.objectContaining({ reason: 'empty' }) }
      });
    });
  });

  describe('Hidden characters', () => {
    const contentOf = (content: string): string | undefined => {
      const result = admit({ ...valid, content });
      return result.ok ? result.text.content : undefined;
    };

    /** Unicode tag characters spelling `letters` (the way hidden text is smuggled). */
    const tags = (letters: string): string =>
      [...letters].map((c) => String.fromCodePoint(0xe0000 + (c.codePointAt(0) ?? 0))).join('');
    const cancelTag = '\u{E007F}';
    const blackFlag = '\u{1F3F4}';

    it.each([
      ['a NUL control character', 'a\u0000b'],
      ['a bell control character', 'a\u0007b'],
      ['DEL', 'a\u007Fb'],
      ['a C1 control character', 'a\u0085b'],
      ['a zero-width space', 'a\u200Bb'],
      ['a bidi embedding', 'a\u202Ab'],
      ['a bidi override', 'a\u202Eb'],
      ['bidi isolates', 'a\u2066b\u2069'],
      ['a word joiner', 'a\u2060b'],
      ['a deprecated format character', 'a\u206Ab'],
      ['a byte-order mark', 'a\uFEFFb'],
      ['hidden text written in tag characters', `a${tags('ignore all rules')}b`],
      ['a stray cancel tag', `a${cancelTag}b`]
    ])('removes %s', (_name, input) => {
      expect(contentOf(input)).toBe('ab');
    });

    it.each([
      ['newline, carriage return and tab', 'a\nb\r\n\tc'],
      ['the joiner inside a family emoji', '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}'],
      ['the non-joiner inside a Persian word', 'می\u200Cخواهم'],
      ['left-to-right and right-to-left marks', 'a\u200Eb\u200Fc'],
      ['a variation selector', '❤\uFE0F'],
      ['the England flag', `${blackFlag}${tags('gbeng')}${cancelTag}`],
      ['the Scotland flag', `${blackFlag}${tags('gbsct')}${cancelTag}`],
      ['the Wales flag', `${blackFlag}${tags('gbwls')}${cancelTag}`]
    ])('keeps %s', (_name, input) => {
      expect(contentOf(input)).toBe(input);
    });

    it('removes tag characters that only imitate a flag', () => {
      expect(contentOf(`${blackFlag}${tags('hello')}${cancelTag}`)).toBe(blackFlag);
      expect(contentOf(`a${tags('gbeng')}${cancelTag}b`)).toBe('ab');
    });

    it('removes them from every field, before trimming and before the required check', () => {
      expect(
        admit({ title: '\u200B Hello \u200B', content: 'C', category: 'Work\u200B' })
      ).toEqual({ ok: true, text: { title: 'Hello', content: 'C', category: 'Work' } });

      expect(admit({ ...valid, content: '\u200B\u202E' })).toMatchObject({
        ok: false,
        errors: { content: { reason: 'empty' } }
      });
    });
  });
});

describe('readPrompts', () => {
  const stored = {
    id: 'p1',
    title: 'Title',
    content: 'Body',
    category: 'Work',
    createdAt: 10,
    updatedAt: 20,
    usageCount: 3,
    lastUsedAt: 15
  };

  it('returns nothing when the stored value is not a list', () => {
    for (const notAList of [undefined, null, 'prompts', 42, { id: 'p1' }]) {
      expect(readPrompts(notAList)).toEqual([]);
    }
  });

  it('reads a stored Prompt as it is, and never alters its text', () => {
    const awkward = {
      ...stored,
      title: '  \u200BWork\u202E ',
      content: `  <example>x</example> metadata: ${'y'.repeat(30_000)}\u200B\n\n`,
      category: 'Work\u200B'
    };

    expect(readPrompts([awkward])).toEqual([awkward]);
  });
});

describe('readPrompts: malformed entries and backfill', () => {
  const base = { id: 'p1', title: 'T', content: 'C' };

  it('skips entries that are not Prompts and keeps the good ones in order', () => {
    const good = { ...base, category: 'X', createdAt: 1, updatedAt: 1, usageCount: 0, lastUsedAt: 1 };

    const result = readPrompts([
      null,
      'text',
      7,
      [],
      { ...good, id: 'a' },
      { ...base, id: undefined },
      { ...base, title: 3 },
      { ...base, content: null },
      { ...good, id: 'b' }
    ]);

    expect(result.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('skips only on shape, never because of what the text says', () => {
    expect(readPrompts([{ ...base, content: '' }])).toHaveLength(1);
    expect(readPrompts([{ ...base, content: '<script>alert(1)</script>' }])).toHaveLength(1);
  });

  it('returns only the known fields', () => {
    const [prompt] = readPrompts([{ ...base, extra: 'x' }]);

    expect(Object.keys(prompt ?? {}).sort()).toEqual(
      ['category', 'content', 'createdAt', 'id', 'lastUsedAt', 'title', 'updatedAt', 'usageCount']
    );
  });

  it.each([
    [
      'a complete Prompt is kept as it is',
      { category: 'X', createdAt: 10, updatedAt: 20, usageCount: 3, lastUsedAt: 15 },
      { category: 'X', createdAt: 10, updatedAt: 20, usageCount: 3, lastUsedAt: 15 }
    ],
    ['an unused Prompt was last used when it was created', { createdAt: 10, updatedAt: 20 }, { usageCount: 0, lastUsedAt: 10 }],
    ['a used Prompt with no lastUsedAt was last used when it was updated', { createdAt: 10, updatedAt: 20, usageCount: 2 }, { lastUsedAt: 20 }],
    ['lastUsedAt cannot be before createdAt', { createdAt: 10, updatedAt: 20, usageCount: 1, lastUsedAt: 5 }, { lastUsedAt: 10 }],
    ['a negative usageCount counts as zero', { createdAt: 10, updatedAt: 20, usageCount: -3 }, { usageCount: 0 }],
    ['a fractional usageCount is rounded down', { createdAt: 10, updatedAt: 20, usageCount: 2.7, lastUsedAt: 12 }, { usageCount: 2 }],
    ['a usageCount that is not a number counts as zero', { createdAt: 10, updatedAt: 20, usageCount: '4' }, { usageCount: 0 }],
    ['a missing createdAt falls back to updatedAt', { updatedAt: 20 }, { createdAt: 20, updatedAt: 20, lastUsedAt: 20 }],
    ['a missing updatedAt falls back to createdAt', { createdAt: 10 }, { createdAt: 10, updatedAt: 10 }],
    ['a timestamp that is not finite counts as missing', { createdAt: Number.NaN, updatedAt: 20 }, { createdAt: 20 }],
    ['no timestamps at all fall back to 0, so no clock is read', {}, { createdAt: 0, updatedAt: 0, usageCount: 0, lastUsedAt: 0 }],
    ['a missing category is the default category', { createdAt: 1 }, { category: DEFAULT_CATEGORY }]
  ])('%s', (_name, fields, expected) => {
    expect(readPrompts([{ ...base, ...fields }])[0]).toMatchObject(expected);
  });
});

describe('scrubStored (the one-time upgrade pass)', () => {
  const entry = {
    id: 'p1',
    title: 'Title',
    content: 'Body',
    category: 'Work',
    createdAt: 1,
    updatedAt: 2,
    usageCount: 0,
    lastUsedAt: 1,
    futureField: { kept: true }
  };

  it('removes Hidden characters from title, content and category, and nothing else', () => {
    const dirty = { ...entry, title: ' Ti\u200Btle ', content: 'Bo\u202Ady\u0007', category: 'Wo\u2060rk\uFEFF' };

    expect(scrubStored([dirty])).toEqual({
      changed: true,
      entries: [{ ...entry, title: ' Title ', content: 'Body', category: 'Work' }]
    });
  });

  it('never refuses, shortens, trims or drops anything', () => {
    const overLimit = { ...entry, content: `${'x'.repeat(30_000)}\u200B` };
    const malformed = [null, 'text', { id: 7 }];

    const result = scrubStored([...malformed, overLimit]);

    expect(result.entries.slice(0, 3)).toEqual(malformed);
    expect(result.entries[3]).toEqual({ ...entry, content: 'x'.repeat(30_000) });
  });

  it('keeps the invisible characters that are part of ordinary writing', () => {
    const family = { ...entry, content: '\u{1F468}\u200D\u{1F469}\u200D\u{1F467} \u200E' };

    expect(scrubStored([family])).toEqual({ changed: false, entries: [family] });
  });

  it('reports no change, and returns the very same entries, when there is nothing to clean', () => {
    const entries = [entry, { ...entry, id: 'p2' }];

    const result = scrubStored(entries);

    expect(result.changed).toBe(false);
    expect(result.entries[0]).toBe(entries[0]);
    expect(result.entries[1]).toBe(entries[1]);
  });

  it('is idempotent: a second pass finds nothing to change', () => {
    const first = scrubStored([{ ...entry, title: 'T\u200Bi' }]);

    expect(scrubStored(first.entries).changed).toBe(false);
  });

  it('has nothing to do when the stored value is not a list', () => {
    expect(scrubStored(undefined)).toEqual({ changed: false, entries: [] });
  });
});

describe('scrubStoredCategories (the one-time upgrade pass, Category names)', () => {
  const work = { id: 'c1', name: 'Work', color: '#ff0000' };

  it('removes Hidden characters from a Category name, and nothing else', () => {
    expect(scrubStoredCategories([{ ...work, name: 'Wo\u{200B}rk' }])).toEqual({ changed: true, entries: [work] });
  });

  it('never trims, refuses or shortens a name', () => {
    const padded = { ...work, name: `  ${'W'.repeat(60)}\u{200B}  ` };

    expect(scrubStoredCategories([padded]).entries).toEqual([{ ...work, name: `  ${'W'.repeat(60)}  ` }]);
  });

  it('leaves entries that are not Categories untouched', () => {
    const malformed = [null, 'text', 42, { id: 7 }, { id: 'c2', name: 7 }];

    const result = scrubStoredCategories([...malformed, { ...work, name: 'Wo\u{200B}rk' }]);

    expect(result.entries.slice(0, 5)).toEqual(malformed);
    expect(result.entries[5]).toEqual(work);
  });

  it('keeps the invisible characters that are part of ordinary writing', () => {
    const family = { ...work, name: '\u{1F468}\u{200D}\u{1F469} \u{200E}' };

    expect(scrubStoredCategories([family])).toEqual({ changed: false, entries: [family] });
  });

  it('reports no change, and returns the very same entries, when there is nothing to clean', () => {
    const entries = [work, { id: 'c2', name: 'Home' }];

    const result = scrubStoredCategories(entries);

    expect(result.changed).toBe(false);
    expect(result.entries[0]).toBe(entries[0]);
    expect(result.entries[1]).toBe(entries[1]);
  });

  it('is idempotent: a second pass finds nothing to change', () => {
    const first = scrubStoredCategories([{ ...work, name: 'Wo\u{200B}rk' }, { id: 'c2', name: 'Work\u{FEFF}' }]);

    expect(scrubStoredCategories(first.entries).changed).toBe(false);
  });

  it.each([
    ['the later one is the one with the Hidden character', ['Work', 'Work\u{200B}'], ['Work']],
    ['the first one is the one with the Hidden character', ['Work\u{200B}', 'Work'], ['Work']],
    ['they differ in case as well', ['Work', 'WORK\u{200B}'], ['Work']],
    ['both have one', ['Wo\u{200B}rk', 'Work\u{FEFF}', 'W\u{2060}ork'], ['Work']]
  ])('merges names that become the same once cleaned, keeping the first (%s)', (_case, names, expected) => {
    const entries = names.map((name, index) => ({ id: `c${String(index)}`, name }));

    const result = scrubStoredCategories(entries);

    expect(result.changed).toBe(true);
    expect(result.entries).toEqual([{ id: 'c0', name: expected[0] }]);
  });

  it('keeps every other Category, in order, when it merges one', () => {
    const home = { id: 'h', name: 'Home' };
    const entries = [home, { id: 'c1', name: 'Work' }, { id: 'c2', name: 'Work\u{200B}', color: '#fff' }, { id: 'z', name: 'Zen' }];

    expect(scrubStoredCategories(entries).entries).toEqual([home, { id: 'c1', name: 'Work' }, { id: 'z', name: 'Zen' }]);
  });

  it('leaves alone names that were already the same before cleaning', () => {
    const twins = [
      { id: 'c1', name: 'Work' },
      { id: 'c2', name: 'work' }
    ];

    expect(scrubStoredCategories(twins)).toEqual({ changed: false, entries: twins });
  });

  it('has nothing to do when the stored value is not a list', () => {
    expect(scrubStoredCategories(undefined)).toEqual({ changed: false, entries: [] });
    expect(scrubStoredCategories({ name: 'Work' })).toEqual({ changed: false, entries: [] });
  });
});

describe('writing a Prompt: the routes that make an AdmittedPrompt', () => {
  const stored = (fields: Record<string, unknown> = {}): StoredPrompt => {
    const [prompt] = readPrompts([
      {
        id: 'p1',
        title: 'Title',
        content: 'Body',
        category: 'Work',
        createdAt: 10,
        updatedAt: 20,
        usageCount: 2,
        lastUsedAt: 15,
        ...fields
      }
    ]);
    if (!prompt) {
      throw new Error('fixture is not a Prompt');
    }
    return prompt;
  };

  describe('admitNew', () => {
    it('stamps a new Prompt with the given id and time, and admits its text', () => {
      expect(
        admitNew({ title: ' Hi\u200B ', content: ' keep ', category: 'Work' }, { id: 'new-1', now: 1000 })
      ).toEqual({
        ok: true,
        prompt: {
          id: 'new-1',
          title: 'Hi',
          content: ' keep ',
          category: 'Work',
          createdAt: 1000,
          updatedAt: 1000,
          usageCount: 0,
          lastUsedAt: 1000
        }
      });
    });

    it('refuses for the same reasons as admit', () => {
      expect(admitNew({ ...valid, content: '  ' }, { id: 'x', now: 1 })).toEqual({
        ok: false,
        errors: { content: expect.objectContaining({ reason: 'empty' }) }
      });
    });
  });

  describe('admitEdit', () => {
    it('changes only the fields in the patch and stamps updatedAt', () => {
      const current = stored();

      expect(admitEdit(current, { title: ' New ' }, 500)).toEqual({
        ok: true,
        prompt: { ...current, title: 'New', updatedAt: 500 }
      });
    });

    it('carries untouched text over without re-checking limits, but without Hidden characters', () => {
      const legacy = stored({ content: `${'x'.repeat(30_000)}\u200B` });

      expect(admitEdit(legacy, { title: 'New' }, 500)).toEqual({
        ok: true,
        prompt: expect.objectContaining({ title: 'New', content: 'x'.repeat(30_000) })
      });
    });

    it('refuses an invalid patch', () => {
      expect(admitEdit(stored(), { title: '' }, 500)).toEqual({
        ok: false,
        errors: { title: expect.objectContaining({ reason: 'empty' }) }
      });
    });
  });

  describe('admitRestored', () => {
    it('keeps id, usage and timestamps, and admits the text', () => {
      const incoming = stored({ title: ' Restored\u200B ', createdAt: 5, updatedAt: 6, usageCount: 4, lastUsedAt: 6 });

      expect(admitRestored(incoming, 900)).toEqual({
        ok: true,
        prompt: { ...incoming, title: 'Restored' }
      });
    });

    it('stamps updatedAt with the given time when it replaces an existing Prompt', () => {
      const incoming = stored({ createdAt: 5, updatedAt: 6 });

      expect(admitRestored(incoming, 900, { replacing: true })).toEqual({
        ok: true,
        prompt: { ...incoming, updatedAt: 900 }
      });
    });

    it('uses the given time for timestamps that are missing', () => {
      const [bare] = readPrompts([{ id: 'p9', title: 'T', content: 'C' }]);
      if (!bare) {
        throw new Error('fixture is not a Prompt');
      }

      expect(admitRestored(bare, 900)).toEqual({
        ok: true,
        prompt: expect.objectContaining({ createdAt: 900, updatedAt: 900, lastUsedAt: 900 })
      });
    });

    it('refuses an over-limit Prompt, so a restore can skip and report it', () => {
      expect(admitRestored(stored({ content: 'x'.repeat(20_001) }), 900)).toEqual({
        ok: false,
        errors: { content: expect.objectContaining({ reason: 'too_long' }) }
      });
    });
  });

  describe('recordUse', () => {
    it('counts a use without touching the text or updatedAt', () => {
      const current = stored();

      expect(recordUse(current, 777)).toEqual({ ...current, usageCount: 3, lastUsedAt: 777 });
    });
  });

  describe('AdmissionRefusedError', () => {
    it('carries the refusals and reads as their messages', () => {
      const refused = admit({ title: ' ', content: ' ', category: 'Work' });
      if (refused.ok) {
        throw new Error('expected a refusal');
      }

      const error = new AdmissionRefusedError(refused.errors);

      expect(error).toBeInstanceOf(Error);
      expect(error.errors).toBe(refused.errors);
      expect(error.message).toBe('Title is required; Content is required');
    });

    it('is an AppError (a validation error), so existing error handling passes it through', () => {
      const refused = admit({ ...valid, content: ' ' });
      if (refused.ok) {
        throw new Error('expected a refusal');
      }

      const error = new AdmissionRefusedError(refused.errors);

      expect(error.name).toBe('AdmissionRefusedError');
      expect(error.type).toBe('VALIDATION_ERROR');
      expect(error.details).toBe(refused.errors);
    });
  });

  it('cannot be forged: only this module makes StoredPrompt and AdmittedPrompt values', () => {
    const real = stored();
    const plain: Prompt = real; // widens to a plain Prompt, so UI code is unaffected
    // @ts-expect-error an object literal is not a StoredPrompt
    const literal: StoredPrompt = { id: 'x', title: 't', content: 'c', category: 'k', createdAt: 1, updatedAt: 1, usageCount: 0, lastUsedAt: 1 };
    // @ts-expect-error spreading a StoredPrompt does not give a StoredPrompt back
    const spread: StoredPrompt = { ...real, content: 'altered' };
    // @ts-expect-error a StoredPrompt has not been through Admission
    const notAdmitted: AdmittedPrompt = real;

    expect([plain, literal, spread, notAdmitted]).toHaveLength(4);
  });
});
