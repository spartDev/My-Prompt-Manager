import path from 'node:path';

import type { Page } from 'playwright';
import { describe, expect, it, vi } from 'vitest';

import { SUPPORTED_PLATFORMS } from '../../src/config/platforms';
import {
  afterCase,
  CASES,
  type CaseResult,
  cleanUp,
  cleanUpNote,
  formatReport,
  judgeLateToolbar,
  judgeSlash,
  judgeSteady,
  liveCheckExitCode,
  normalizeFieldText,
  overlayIsFallback,
  parseLiveCheckArgs,
  runCase
} from '../live-check';

const ROOT = path.resolve(__dirname, '../..');

describe('parseLiveCheckArgs', () => {
  it('builds this checkout and checks every Platform in the signed-in Chromium profile by default', () => {
    const options = parseLiveCheckArgs([], {});

    expect(options).toMatchObject({ only: [], build: true, channel: 'chromium', headless: false, login: false, standIn: false });
    expect(options.dist).toBe(path.join(ROOT, 'dist'));
    expect(options.profile).toMatch(/live-check-profile$/);
  });

  it('checks another build without building, and reads the rest', () => {
    const options = parseLiveCheckArgs(
      ['--only', 'copilot,perplexity', '--dist', '/tmp/old/dist', '--headless', '--stand-in', '--timeout', '8000'],
      { LIVE_CHECK_PROFILE: '/tmp/profile' }
    );

    expect(options).toMatchObject({
      only: ['copilot', 'perplexity'],
      dist: '/tmp/old/dist',
      build: false,
      profile: '/tmp/profile',
      headless: true,
      standIn: true,
      timeout: 8000
    });
  });

  it.each([
    [['--only', 'bard'], 'Unknown platform bard'],
    [['--dist'], '--dist needs a value'],
    [['--timeout', '0'], '--timeout takes milliseconds'],
    [['--fast'], 'Unknown option --fast']
  ])('refuses %j', (argv, message) => {
    expect(() => parseLiveCheckArgs(argv, {})).toThrow(message);
  });
});

describe('normalizeFieldText', () => {
  it('reads the field as the user does: no zero-width characters, a no-break space as a space, trimmed', () => {
    expect(normalizeFieldText('​‌\n')).toBe('');
    expect(normalizeFieldText('Hi there​')).toBe('Hi there');
  });
});

describe('judgeSlash', () => {
  it('passes when the Prompt selector is open and the // is gone, the draft kept', () => {
    expect(judgeSlash({ selectorOpen: true, fieldText: 'Hi there​', feedback: null }, 'Hi there'))
      .toEqual({ pass: true, detail: 'selector open, field "Hi there"' });
  });

  it.each([
    ['the selector stayed closed', { selectorOpen: false, fieldText: '//', feedback: null }, 'selector closed, field "//"'],
    ['the editor put the // back', { selectorOpen: true, fieldText: '//', feedback: null }, 'selector open, field "//"'],
    ['the draft was lost', { selectorOpen: true, fieldText: '', feedback: 'Could not insert' }, 'selector open, field "", feedback "Could not insert"']
  ])('fails when %s, and says what it read', (_case, observed, detail) => {
    expect(judgeSlash(observed, observed.fieldText === '' ? 'Hi there' : '')).toEqual({ pass: false, detail });
  });
});

describe('judgeSlash with no field', () => {
  it('fails when the editor cannot be found, even where an empty field is expected', () => {
    expect(judgeSlash({ selectorOpen: true, fieldText: null, feedback: null }, ''))
      .toEqual({ pass: false, detail: 'selector open, no field found' });
  });
});

describe('judgeLateToolbar', () => {
  it('passes when the Prompts button ends on the toolbar', () => {
    expect(judgeLateToolbar({ placement: 'toolbar', anchor: '0', x: 0, y: 0 })).toEqual({ pass: true, detail: 'placement toolbar, anchor 0' });
  });

  it('fails on the Anchored overlay, and with no Prompts button', () => {
    expect(judgeLateToolbar({ placement: 'overlay', anchor: null, x: 0, y: 0 })).toEqual({ pass: false, detail: 'placement overlay, anchor none' });
    expect(judgeLateToolbar(null)).toEqual({ pass: false, detail: 'no Prompts button' });
  });

  it('passes on the Anchored overlay when it is the designed fallback, and says so', () => {
    expect(judgeLateToolbar({ placement: 'overlay', anchor: null, x: 0, y: 0 }, 'fr'))
      .toEqual({ pass: true, detail: 'placement overlay, anchor none (the fallback of a chain read by English labels, page language fr)' });
    expect(judgeLateToolbar(null, 'fr')).toEqual({ pass: false, detail: 'no Prompts button' });
  });
});

describe('overlayIsFallback', () => {
  it('holds for a chain that reads English ARIA labels, on a page in another language', () => {
    expect(overlayIsFallback(SUPPORTED_PLATFORMS.chatgpt, 'fr-FR')).toBe(true);
    expect(overlayIsFallback(SUPPORTED_PLATFORMS.mistral, 'de')).toBe(true);
    expect(overlayIsFallback(SUPPORTED_PLATFORMS.perplexity, 'fr-FR')).toBe(true);
  });

  it.each([
    ['an English page', SUPPORTED_PLATFORMS.chatgpt, 'en-US'],
    ['a page that names no language', SUPPORTED_PLATFORMS.mistral, ''],
    ['a chain read by test ids and classes only', SUPPORTED_PLATFORMS.m365copilot, 'fr'],
    ['a chain read by test ids and classes only', SUPPORTED_PLATFORMS.claude, 'fr']
  ])('does not hold for %s', (_case, platform, lang) => {
    expect(overlayIsFallback(platform, lang)).toBe(false);
  });
});

describe('cleanUp', () => {
  it('reports the field not emptied when its editor cannot be found again', async () => {
    const page = {
      keyboard: { press: vi.fn(() => Promise.resolve()) },
      locator: () => ({ waitFor: () => Promise.resolve() }),
      waitForFunction: () => Promise.reject(new Error('Timeout 2000ms exceeded'))
    } as unknown as Page;

    await expect(cleanUp(page, SUPPORTED_PLATFORMS.claude)).resolves.toBe(false);
  });
});

/**
 * A page for the case runner with no browser: an editor found or not, each key recorded, and
 * typing that throws when asked
 */
function fakePage({ editor, typeThrows = false }: { editor: boolean; typeThrows?: boolean }) {
  const keys: string[] = [];
  const element = { click: () => Promise.resolve(), dispose: () => Promise.resolve(), evaluate: () => Promise.resolve('') };
  const waitForFunction = vi.fn(() => (editor ? Promise.resolve({ asElement: () => element }) : Promise.reject(new Error('Timeout exceeded'))));
  const page = {
    keyboard: {
      press: vi.fn((key: string) => { keys.push(key); return Promise.resolve(); }),
      type: vi.fn(() => (typeThrows ? Promise.reject(new Error('Target page closed')) : Promise.resolve()))
    },
    locator: () => ({ waitFor: () => Promise.resolve(), first: () => ({ waitFor: () => Promise.resolve() }) }),
    waitForFunction
  } as unknown as Page;
  return { page, keys, waitForFunction };
}

describe('runCase progress', () => {
  it('leaves typed false when no field shows, so nothing is cleaned up or warned about', async () => {
    const { page } = fakePage({ editor: false });
    const progress = { typed: false };

    const verdict = await runCase(page, SUPPORTED_PLATFORMS.claude, 'slash-empty', 10, progress);

    expect(verdict).toEqual({ pass: false, detail: 'no field (signed out?)' });
    expect(progress.typed).toBe(false);
  });

  it('sets typed before the first key, so it holds when the case throws while typing', async () => {
    const { page } = fakePage({ editor: true, typeThrows: true });
    const progress = { typed: false };

    await expect(runCase(page, SUPPORTED_PLATFORMS.claude, 'slash-empty', 10, progress)).rejects.toThrow('Target page closed');
    expect(progress.typed).toBe(true);
  });
});

describe('afterCase', () => {
  it('only closes the selector when nothing was typed: no cleanup, no warning', async () => {
    const { page, keys, waitForFunction } = fakePage({ editor: false });

    await expect(afterCase(page, SUPPORTED_PLATFORMS.claude, false)).resolves.toBe('');
    expect(keys).toEqual(['Escape']);
    expect(waitForFunction).not.toHaveBeenCalled();
  });

  it('warns when the case typed and its field is gone after', async () => {
    const { page } = fakePage({ editor: false });

    await expect(afterCase(page, SUPPORTED_PLATFORMS.claude, true)).resolves.toBe('; field NOT emptied after, check for a draft');
  });

  it('says nothing when the case typed and the field was emptied', async () => {
    const { page } = fakePage({ editor: true });

    await expect(afterCase(page, SUPPORTED_PLATFORMS.claude, true)).resolves.toBe('');
  });
});

describe('cleanUpNote', () => {
  it('warns when the case typed into a field it could not empty after, a field gone included', () => {
    expect(cleanUpNote(true, false)).toBe('; field NOT emptied after, check for a draft');
  });

  it.each([
    ['nothing was typed (no field, signed out, or the late-composer case)', false, false],
    ['the field was emptied', true, true]
  ])('says nothing when %s', (_case, typed, emptied) => {
    expect(cleanUpNote(typed, emptied)).toBe('');
  });
});

describe('judgeSteady', () => {
  const at = (x: number, y: number, placement = 'toolbar', anchor = '0') => ({ placement, anchor, x, y });

  it('passes when the Prompts button keeps its place, a subpixel re-layout aside', () => {
    expect(judgeSteady(at(10, 20), at(10.5, 20))).toEqual({ pass: true, detail: 'placement toolbar, anchor 0, moved 0.5px' });
  });

  it.each([
    ['it moved', at(10, 20), at(40, 20), 'placement toolbar, anchor 0, moved 30.0px'],
    ['it changed anchor', at(10, 20), at(10, 20, 'toolbar', '1'), 'placement toolbar, anchor 0 became placement toolbar, anchor 1'],
    ['it went to the overlay', at(10, 20), at(10, 20, 'overlay', 'none'), 'placement toolbar, anchor 0 became placement overlay, anchor none'],
    ['it went away', at(10, 20), null, 'Prompts button gone while typing'],
    ['there was none', null, null, 'no Prompts button before typing']
  ])('fails when %s', (_case, before, after, detail) => {
    expect(judgeSteady(before, after)).toEqual({ pass: false, detail });
  });
});

describe('formatReport', () => {
  it('prints one PASS or FAIL line per case, columns aligned, then the count', () => {
    const results: CaseResult[] = [
      { platform: 'copilot', case: 'slash-menu', pass: false, detail: 'selector closed, field "//"' },
      { platform: 'perplexity', case: 'slash-empty', pass: true, detail: 'selector open, field ""' }
    ];

    const lines = formatReport(results).trimEnd().split('\n');

    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^FAIL {2}copilot {5}\/\/ with a pause \(Copilot's \/ menu open\) +selector closed, field "\/\/"$/);
    expect(lines[1]).toMatch(/^PASS {2}perplexity {2}\/\/ in an empty field +selector open, field ""$/);
    expect(lines[0].indexOf('selector')).toBe(lines[1].indexOf('selector'));
    expect(lines[2]).toBe('1 passed, 1 failed');
  });

  it('names the five cases of the ticket', () => {
    expect(CASES.map(({ id }) => id)).toEqual(['slash-empty', 'slash-menu', 'slash-inside', 'late-toolbar', 'icon-steady']);
  });
});

describe('liveCheckExitCode', () => {
  const result = (pass: boolean): CaseResult => ({ platform: 'claude', case: 'slash-empty', pass, detail: '' });

  it('succeeds only when every case ran and passed', () => {
    expect(liveCheckExitCode([result(true), result(true)])).toBe(0);
    expect(liveCheckExitCode([result(true), result(false)])).toBe(1);
    expect(liveCheckExitCode([])).toBe(1);
  });
});
