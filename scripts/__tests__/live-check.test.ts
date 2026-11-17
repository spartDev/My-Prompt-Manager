import path from 'node:path';

import type { Page } from 'playwright';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SUPPORTED_PLATFORMS } from '../../src/config/platforms';
import {
  afterCase,
  CASES,
  type CaseResult,
  cleanUp,
  cleanUpNote,
  formatReport,
  holdsOnlyCaseText,
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
  // What the chain finds on the page: its composer, and none of its anchors in it
  const unresolved = { composerFound: true, anchorFound: false };

  it('holds for a chain that reads English ARIA labels and finds no anchor, on a page in another language', () => {
    expect(overlayIsFallback(SUPPORTED_PLATFORMS.chatgpt, 'fr-FR', unresolved)).toBe(true);
    expect(overlayIsFallback(SUPPORTED_PLATFORMS.mistral, 'de', unresolved)).toBe(true);
    expect(overlayIsFallback(SUPPORTED_PLATFORMS.perplexity, 'fr-FR', unresolved)).toBe(true);
  });

  it.each([
    ['an English page', SUPPORTED_PLATFORMS.chatgpt, 'en-US', unresolved],
    ['a page that names no language', SUPPORTED_PLATFORMS.mistral, '', unresolved],
    ['a chain read by test ids and classes only', SUPPORTED_PLATFORMS.m365copilot, 'fr', unresolved],
    ['a chain read by test ids and classes only', SUPPORTED_PLATFORMS.claude, 'fr', unresolved],
    // ChatGPT's send-button test id on a French page: the chain resolves, so an overlay is a regression
    ['a chain that still finds an anchor on the page', SUPPORTED_PLATFORMS.chatgpt, 'fr-FR', { composerFound: true, anchorFound: true }],
    ['a composer the chain does not find', SUPPORTED_PLATFORMS.chatgpt, 'fr-FR', { composerFound: false, anchorFound: false }]
  ])('does not hold for %s', (_case, platform, lang, chain) => {
    expect(overlayIsFallback(platform, lang, chain)).toBe(false);
  });
});

describe('cleanUp', () => {
  it('reports the field not emptied when its editor cannot be found again', async () => {
    const page = {
      keyboard: { press: vi.fn(() => Promise.resolve()) },
      locator: () => ({ waitFor: () => Promise.resolve() }),
      waitForFunction: () => Promise.reject(new Error('Timeout 2000ms exceeded'))
    } as unknown as Page;

    await expect(cleanUp(page, SUPPORTED_PLATFORMS.claude, '')).resolves.toBe('not emptied');
  });
});

/**
 * A page for the case runner with no browser: an editor found or not, each key recorded, and
 * typing that throws when asked. The field keeps what is typed and Backspace empties it. It holds
 * text from the start, or gets a draft restored by the Platform later: while the script waits for
 * the Prompts button, during a pause, or while the case types (put before the case's text)
 */
function fakePage({ editor, typeThrows = false, text = '', restore }: {
  editor: boolean;
  typeThrows?: boolean;
  text?: string;
  restore?: { draft: string; on: 'icon' | 'pause' | 'type' };
}) {
  const keys: string[] = [];
  let field = text;
  const restoreOn = (when: 'icon' | 'pause') => {
    if (restore?.on === when) {
      field = restore.draft;
    }
    return Promise.resolve();
  };
  const element = { click: () => Promise.resolve(), dispose: () => Promise.resolve(), evaluate: () => Promise.resolve(field) };
  const waitForFunction = vi.fn(() => (editor ? Promise.resolve({ asElement: () => element }) : Promise.reject(new Error('Timeout exceeded'))));
  const page = {
    keyboard: {
      press: vi.fn((key: string) => {
        keys.push(key);
        if (key === 'Backspace') {
          field = '';
        }
        return Promise.resolve();
      }),
      type: vi.fn((typed: string) => {
        if (typeThrows) {
          return Promise.reject(new Error('Target page closed'));
        }
        field = restore?.on === 'type' ? `${restore.draft} ${field}${typed}` : `${field}${typed}`;
        return Promise.resolve();
      })
    },
    locator: () => ({ waitFor: () => Promise.resolve(), first: () => ({ waitFor: () => restoreOn('icon') }) }),
    evaluate: () => Promise.resolve(null),
    waitForTimeout: vi.fn(() => restoreOn('pause')),
    waitForFunction
  } as unknown as Page;
  return { page, keys, waitForFunction, field: () => field };
}

describe('runCase progress', () => {
  it('leaves typed false when no field shows, so nothing is cleaned up or warned about', async () => {
    const { page } = fakePage({ editor: false });
    const progress = { typed: false, text: '' };

    const verdict = await runCase(page, SUPPORTED_PLATFORMS.claude, 'slash-empty', 10, progress);

    expect(verdict).toEqual({ pass: false, detail: 'no field (signed out?)' });
    expect(progress.typed).toBe(false);
  });

  it('sets typed before the first key, so it holds when the case throws while typing', async () => {
    const { page } = fakePage({ editor: true, typeThrows: true });
    const progress = { typed: false, text: '' };

    await expect(runCase(page, SUPPORTED_PLATFORMS.claude, 'slash-empty', 10, progress)).rejects.toThrow('Target page closed');
    expect(progress.typed).toBe(true);
  });

  it.each(CASES.filter(({ id }) => id !== 'late-toolbar').map(({ id }) => id))(
    'does not run %s on a field that holds a draft, and leaves the field as it was',
    async (caseId) => {
      const { page, keys } = fakePage({ editor: true, text: 'My saved draft​' });
      const progress = { typed: false, text: '' };

      const verdict = await runCase(page, SUPPORTED_PLATFORMS.chatgpt, caseId, 10, progress);

      expect(verdict).toEqual({ pass: false, detail: 'the field holds a draft: case not run, field left as it was' });
      expect(progress.typed).toBe(false);
      expect(keys).toEqual([]);
      expect(page.keyboard.type).not.toHaveBeenCalled();
    }
  );

  const typingCases = CASES.filter(({ id }) => id !== 'late-toolbar').map(({ id }) => id);
  it.each([
    ...typingCases.map((caseId) => [caseId, 'icon'] as const),
    ['icon-steady', 'pause'] as const
  ])(
    'does not run %s when the Platform restores a draft after the field shows (while waiting for the %s)',
    async (caseId, on) => {
      const { page, keys } = fakePage({ editor: true, restore: { draft: 'Mon brouillon', on } });
      const progress = { typed: false, text: '' };

      const verdict = await runCase(page, SUPPORTED_PLATFORMS.chatgpt, caseId, 10, progress);

      expect(verdict).toEqual({ pass: false, detail: 'the field holds a draft: case not run, field left as it was' });
      expect(progress.typed).toBe(false);
      expect(keys).toEqual([]);
      expect(page.keyboard.type).not.toHaveBeenCalled();
    }
  );
});

/**
 * A page for the case runner backed by the test's own DOM: the page evaluates against `document`,
 * the editor handle against the editor element, so the chain is read as the browser would read it
 */
function domPage(html: string, lang: string) {
  document.documentElement.lang = lang;
  document.body.innerHTML = html;
  const editor = document.querySelector<HTMLElement>('textarea, [contenteditable="true"]');
  const handle = {
    click: () => Promise.resolve(),
    dispose: () => Promise.resolve(),
    evaluate: (fn: (element: HTMLElement, arg: unknown) => unknown, arg: unknown) => Promise.resolve(fn(editor as HTMLElement, arg))
  };
  return {
    evaluate: (fn: (arg: unknown) => unknown, arg: unknown) => Promise.resolve(fn(arg)),
    waitForFunction: () => (editor ? Promise.resolve({ asElement: () => handle }) : Promise.reject(new Error('Timeout exceeded'))),
    keyboard: { press: () => Promise.resolve(), type: () => Promise.resolve() },
    locator: () => ({ waitFor: () => Promise.resolve(), first: () => ({ waitFor: () => Promise.resolve() }) }),
    waitForTimeout: () => Promise.resolve()
  } as unknown as Page;
}

describe('runCase late-toolbar reads the chain in the page', () => {
  const overlayIcon = '<button class="prompt-library-integrated-icon" data-mpm-placement="overlay">P</button>';

  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.lang = '';
  });

  it('fails on the overlay of a French page whose form still holds the send button, an anchor of the chain', async () => {
    const page = domPage(`<form><textarea data-testid="chat-input"></textarea><button data-testid="send-button">Envoyer</button></form>${overlayIcon}`, 'fr');

    const verdict = await runCase(page, SUPPORTED_PLATFORMS.chatgpt, 'late-toolbar', 10);

    expect(verdict.pass).toBe(false);
  });

  it('passes on the overlay of a French page whose form holds none of the anchors: the designed fallback', async () => {
    const page = domPage(`<form><textarea data-testid="chat-input"></textarea><button aria-label="Dicter">m</button></form>${overlayIcon}`, 'fr');

    const verdict = await runCase(page, SUPPORTED_PLATFORMS.chatgpt, 'late-toolbar', 10);

    expect(verdict.pass).toBe(true);
    expect(verdict.detail).toContain('the fallback of a chain read by English labels, page language fr');
  });

  it('fails on the overlay of a French page whose editor is in no form or fieldset: the composer drifted', async () => {
    const page = domPage(`<div><textarea data-testid="chat-input"></textarea><button aria-label="Dicter">m</button></div>${overlayIcon}`, 'fr');

    const verdict = await runCase(page, SUPPORTED_PLATFORMS.chatgpt, 'late-toolbar', 10);

    expect(verdict.pass).toBe(false);
  });
});

describe('afterCase', () => {
  const NOT_OURS = '; field holds text the case did not type, left as it was: check for a draft';

  it('only closes the selector when nothing was typed: no cleanup, no warning', async () => {
    const { page, keys, waitForFunction } = fakePage({ editor: false });

    await expect(afterCase(page, SUPPORTED_PLATFORMS.claude, { typed: false, text: '' })).resolves.toBe('');
    expect(keys).toEqual(['Escape']);
    expect(waitForFunction).not.toHaveBeenCalled();
  });

  it('warns when the case typed and its field is gone after', async () => {
    const { page } = fakePage({ editor: false });

    await expect(afterCase(page, SUPPORTED_PLATFORMS.claude, { typed: true, text: '' })).resolves.toBe('; field NOT emptied after, check for a draft');
  });

  it('says nothing when the case typed and the field was emptied', async () => {
    const { page } = fakePage({ editor: true });

    await expect(afterCase(page, SUPPORTED_PLATFORMS.claude, { typed: true, text: '' })).resolves.toBe('');
  });

  it('empties a field that holds only what the case typed, its // included', async () => {
    const { page, keys, field } = fakePage({ editor: true, text: 'Hi //there​' });

    await expect(afterCase(page, SUPPORTED_PLATFORMS.claude, { typed: true, text: 'Hi there' })).resolves.toBe('');
    expect(keys).toContain('Backspace');
    expect(field()).toBe('');
  });

  it('leaves a field that holds text the case did not type, and says so', async () => {
    const { page, keys, field } = fakePage({ editor: true, text: 'Mon brouillon Hi //there' });

    await expect(afterCase(page, SUPPORTED_PLATFORMS.claude, { typed: true, text: 'Hi there' })).resolves.toBe(NOT_OURS);
    expect(keys).toEqual(['Escape']);
    expect(field()).toBe('Mon brouillon Hi //there');
  });

  it('keeps a draft the Platform restores while the case types: the case runs, the draft stays', async () => {
    const { page, keys, field } = fakePage({ editor: true, restore: { draft: 'Mon brouillon', on: 'type' } });
    const progress = { typed: false, text: '' };

    await runCase(page, SUPPORTED_PLATFORMS.chatgpt, 'icon-steady', 10, progress);

    expect(progress).toEqual({ typed: true, text: 'Hello world' });
    await expect(afterCase(page, SUPPORTED_PLATFORMS.chatgpt, progress)).resolves.toBe(NOT_OURS);
    expect(keys).toEqual(['Escape']);
    expect(field()).toBe('Mon brouillon Hello world');
  });
});

describe('holdsOnlyCaseText', () => {
  it.each([
    ['an empty field', '', ''],
    ['the // left behind', '//', ''],
    ['the case text with the // inside it', 'Hi // there', 'Hi there'],
    ['the case text with the // at its end, and a zero-width space', 'Hi there//​', 'Hi there'],
    ['the case text and the Platform\'s non-breaking space', 'Hello world', 'Hello world']
  ])('is true for %s', (_case, fieldText, caseText) => {
    expect(holdsOnlyCaseText(fieldText, caseText)).toBe(true);
  });

  it.each([
    ['a draft and nothing typed', 'Mon brouillon', ''],
    ['a draft before the case text', 'Mon brouillon Hello world', 'Hello world'],
    ['the case text cut short', 'Hello', 'Hello world']
  ])('is false for %s', (_case, fieldText, caseText) => {
    expect(holdsOnlyCaseText(fieldText, caseText)).toBe(false);
  });
});

describe('cleanUpNote', () => {
  it('warns when the case typed into a field it could not empty after, a field gone included', () => {
    expect(cleanUpNote(true, 'not emptied')).toBe('; field NOT emptied after, check for a draft');
  });

  it('warns when the field held text the case did not type, left as it was', () => {
    expect(cleanUpNote(true, 'not ours')).toBe('; field holds text the case did not type, left as it was: check for a draft');
  });

  it.each([
    ['nothing was typed (no field, signed out, or the late-composer case)', false, 'not emptied'],
    ['the field was emptied', true, 'emptied']
  ] as const)('says nothing when %s', (_case, typed, result) => {
    expect(cleanUpNote(typed, result)).toBe('');
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
