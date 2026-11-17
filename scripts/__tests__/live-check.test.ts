import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CASES, type CaseResult, formatReport, judgeLateToolbar, judgeSlash, judgeSteady, liveCheckExitCode, normalizeFieldText, parseLiveCheckArgs } from '../live-check';

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

describe('judgeLateToolbar', () => {
  it('passes when the Prompts button ends on the toolbar', () => {
    expect(judgeLateToolbar({ placement: 'toolbar', anchor: '0', x: 0, y: 0 })).toEqual({ pass: true, detail: 'placement toolbar, anchor 0' });
  });

  it('fails on the Anchored overlay, and with no Prompts button', () => {
    expect(judgeLateToolbar({ placement: 'overlay', anchor: null, x: 0, y: 0 })).toEqual({ pass: false, detail: 'placement overlay, anchor none' });
    expect(judgeLateToolbar(null)).toEqual({ pass: false, detail: 'no Prompts button' });
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
