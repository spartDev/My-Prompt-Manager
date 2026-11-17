/**
 * npm run live:check: builds the extension, loads it in a signed-in Chromium profile, and checks
 * on the live Platforms what a hand check of a change to src/content would: the Prompt selector
 * opening on // (in an empty field, with a pause between the slashes, which opens Copilot's own /
 * menu at copilot.cloud.microsoft, and inside a draft), the Prompts button on the toolbar once a
 * late composer has rendered, and the button staying put while the user types. It reads
 * button.prompt-library-integrated-icon's data-mpm-placement and data-mpm-anchor, the field's text
 * and the insertion feedback, and prints one PASS or FAIL line per case.
 *
 * Most Platforms need sign-in, so it runs in a persistent profile the maintainer signs into once
 * with --login. A maintainer chore like composers:capture, not a CI job. Bundled Chromium by
 * default: branded Chrome no longer loads an unpacked extension from the command line.
 *
 *   npm run live:check -- --login                          open each Platform to sign in; close the browser when done
 *   npm run live:check                                     build, then check every Platform
 *   npm run live:check -- --only copilot,perplexity        check some
 *   npm run live:check -- --dist /tmp/old/dist             check another build (an older commit's), without building
 *   npm run live:check -- --stand-in --headless            check the e2e stand-in pages instead of the live sites
 *
 * It types only its own text in the field, and empties the field after each case (a line says so when it could not).
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { type BrowserContext, chromium, type Page } from 'playwright';

import { type PlatformDefinition, SUPPORTED_PLATFORMS } from '../src/config/platforms';
import { IconPlacementController } from '../src/content/core/icon-placement';
import type { EditorFixture, PlatformFixture } from '../tests/e2e/fixtures/platform-pages';

import { editorSelectorsOf, findEditor, redactUrls, startUrlOf } from './capture-composers';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PROFILE = path.join(homedir(), '.my-prompt-manager', 'live-check-profile');

/** The Prompts button the content script adds to a Platform's composer */
const ICON = 'button.prompt-library-integrated-icon';
/** The Prompt selector: a dialog in the extension's shadow root */
const SELECTOR_DIALOG = '#mpm-prompt-selector [role="dialog"]';
/** The insertion feedback, shown above the field after an Insertion or when one fails */
const FEEDBACK = '#mpm-prompt-selector [role="status"]';

export type CaseId = 'slash-empty' | 'slash-menu' | 'slash-inside' | 'late-toolbar' | 'icon-steady';

export const CASES: readonly { id: CaseId; label: string }[] = [
  { id: 'slash-empty', label: '// in an empty field' },
  { id: 'slash-menu', label: '// with a pause (Copilot\'s / menu open)' },
  { id: 'slash-inside', label: '\'Hi //there\'' },
  { id: 'late-toolbar', label: 'icon on the toolbar after a late composer' },
  { id: 'icon-steady', label: 'icon not moving while typing' }
];

/**
 * The stand-in page of tests/e2e/fixtures/platform-pages.ts each Platform is checked on with
 * --stand-in: the rich text editor where the live composer is one
 */
const STAND_INS: Record<string, PlatformFixture | EditorFixture> = {
  claude: 'claude',
  chatgpt: 'chatgpt-editor',
  mistral: 'mistral-editor',
  gemini: 'gemini',
  perplexity: 'perplexity-editor',
  copilot: 'copilot',
  m365copilot: 'm365copilot-editor'
};

export interface LiveCheckOptions {
  only: string[];
  /** The unpacked extension to load; built from this checkout first unless --dist or --no-build */
  dist: string;
  build: boolean;
  profile: string;
  channel: string;
  headless: boolean;
  login: boolean;
  standIn: boolean;
  /** How long to wait for the field, the Prompts button and the Prompt selector, in ms */
  timeout: number;
}

export function parseLiveCheckArgs(argv: readonly string[], env: NodeJS.ProcessEnv = {}): LiveCheckOptions {
  const options: LiveCheckOptions = {
    only: [],
    dist: path.join(ROOT, 'dist'),
    build: true,
    profile: env.LIVE_CHECK_PROFILE || DEFAULT_PROFILE,
    channel: 'chromium',
    headless: false,
    login: false,
    standIn: false,
    timeout: 20_000
  };
  const value = (index: number, flag: string): string => {
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
      throw new Error(`${flag} needs a value`);
    }
    return next;
  };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    switch (flag) {
      case '--only':
        options.only = value(index, flag).split(',').map((id) => id.trim()).filter(Boolean);
        index++;
        break;
      case '--dist':
        options.dist = path.resolve(value(index, flag));
        options.build = false;
        index++;
        break;
      case '--profile':
        options.profile = path.resolve(value(index, flag));
        index++;
        break;
      case '--channel':
        options.channel = value(index, flag);
        index++;
        break;
      case '--timeout': {
        const ms = Number(value(index, flag));
        if (!Number.isFinite(ms) || ms <= 0) {
          throw new Error(`${flag} takes milliseconds`);
        }
        options.timeout = ms;
        index++;
        break;
      }
      case '--no-build':
        options.build = false;
        break;
      case '--headless':
        options.headless = true;
        break;
      case '--login':
        options.login = true;
        break;
      case '--stand-in':
        options.standIn = true;
        break;
      default:
        throw new Error(`Unknown option ${flag}`);
    }
  }
  const unknown = options.only.filter((id) => !(id in SUPPORTED_PLATFORMS));
  if (unknown.length > 0) {
    throw new Error(`Unknown platform ${unknown.join(', ')}; one of ${Object.keys(SUPPORTED_PLATFORMS).join(', ')}`);
  }
  return options;
}

/** The field's text as the user reads it: without the zero-width characters an editor keeps, a no-break space as a space, trimmed */
export const normalizeFieldText = (text: string): string => text.replace(/[​-‍﻿]/g, '').replace(/ /g, ' ').trim();

export interface SlashObservation {
  selectorOpen: boolean;
  /** Null when the editor could not be found: never read as an empty field */
  fieldText: string | null;
  /** The insertion feedback's text, when it shows */
  feedback: string | null;
}

export interface IconState {
  placement: string | null;
  anchor: string | null;
  x: number;
  y: number;
}

export interface Verdict {
  pass: boolean;
  detail: string;
}

/** A // case passes when the Prompt selector is open and the field holds what it held before the //, the // gone */
export function judgeSlash(observed: SlashObservation, expectedText: string): Verdict {
  const text = observed.fieldText === null ? null : normalizeFieldText(observed.fieldText);
  const feedback = observed.feedback ? `, feedback "${observed.feedback}"` : '';
  return {
    pass: observed.selectorOpen && text === expectedText,
    detail: `selector ${observed.selectorOpen ? 'open' : 'closed'}, ${text === null ? 'no field found' : `field ${JSON.stringify(text)}`}${feedback}`
  };
}

const describeIcon = (icon: IconState | null): string =>
  (icon ? `placement ${icon.placement ?? 'none'}, anchor ${icon.anchor ?? 'none'}` : 'no Prompts button');

/**
 * Whether the Anchored overlay is the designed end of the Platform's chain on this page: the chain
 * finds an anchor by an English ARIA label (ChatGPT, Mistral, Perplexity), and the page says it is in another
 * language, where src/config/platforms.ts lets the icon fall to the anchor on the editor. Not on a
 * page that names no language: the overlay there may be a chain that drifted.
 */
export function overlayIsFallback(platform: PlatformDefinition, pageLanguage: string): boolean {
  const readsLabels = platform.iconPlacement?.anchors.some(({ find }) => /\[aria-label\s*[*^$|~]?=/i.test(find)) ?? false;
  return readsLabels && pageLanguage.trim() !== '' && !/^en(-|$)/i.test(pageLanguage.trim());
}

/**
 * The late-composer case passes when the Prompts button ends on the toolbar, or on the Anchored
 * overlay when that is the chain's designed fallback on this page (overlayIsFallback)
 *
 * @param fallbackLanguage - The page's language, given only when the overlay is the fallback there
 */
export function judgeLateToolbar(icon: IconState | null, fallbackLanguage?: string): Verdict {
  if (icon?.placement === 'overlay' && fallbackLanguage !== undefined) {
    return { pass: true, detail: `${describeIcon(icon)} (the fallback of a chain read by English labels, page language ${fallbackLanguage})` };
  }
  return { pass: icon?.placement === 'toolbar', detail: describeIcon(icon) };
}

/** How far the Prompts button may shift while the user types, in px: a subpixel re-layout is not a move */
const STEADY_TOLERANCE = 1;

/** The typing case passes when the Prompts button keeps its placement, its anchor and its position */
export function judgeSteady(before: IconState | null, after: IconState | null): Verdict {
  if (!before || !after) {
    return { pass: false, detail: `${before ? 'Prompts button gone while typing' : 'no Prompts button before typing'}` };
  }
  const moved = Math.max(Math.abs(after.x - before.x), Math.abs(after.y - before.y));
  const same = before.placement === after.placement && before.anchor === after.anchor;
  return {
    pass: same && moved <= STEADY_TOLERANCE,
    detail: same
      ? `${describeIcon(after)}, moved ${moved.toFixed(1)}px`
      : `${describeIcon(before)} became ${describeIcon(after)}`
  };
}

export interface CaseResult extends Verdict {
  platform: string;
  case: CaseId;
}

/** The report: one PASS or FAIL line per case, columns aligned, then the count */
export function formatReport(results: readonly CaseResult[]): string {
  const labels = new Map(CASES.map(({ id, label }) => [id, label]));
  const platformWidth = Math.max(0, ...results.map(({ platform }) => platform.length));
  const labelWidth = Math.max(0, ...CASES.map(({ label }) => label.length));
  const lines = results.map((result) =>
    `${result.pass ? 'PASS' : 'FAIL'}  ${result.platform.padEnd(platformWidth)}  ${(labels.get(result.case) ?? result.case).padEnd(labelWidth)}  ${result.detail}`);
  const failed = results.filter(({ pass }) => !pass).length;
  return [...lines, `${results.length - failed} passed, ${failed} failed`, ''].join('\n');
}

/** 0 when every case ran and passed */
export const liveCheckExitCode = (results: readonly CaseResult[]): number =>
  (results.length > 0 && results.every(({ pass }) => pass) ? 0 : 1);

// ---- In the browser ----

const readIcon = (page: Page): Promise<IconState | null> =>
  page.evaluate((selector) => {
    const icon = document.querySelector(selector);
    if (!icon) {
      return null;
    }
    const box = icon.getBoundingClientRect();
    return { placement: icon.getAttribute('data-mpm-placement'), anchor: icon.getAttribute('data-mpm-anchor'), x: box.x, y: box.y };
  }, ICON);

/** The editor's text, found again each time: a Platform may replace its editor. Null when there is none */
async function readField(page: Page, platform: PlatformDefinition): Promise<string | null> {
  const editor = await findEditor(page, editorSelectorsOf(platform), 1_000);
  if (!editor) {
    return null;
  }
  const text = await editor.evaluate((element) => (element instanceof HTMLTextAreaElement ? element.value : (element.textContent ?? '')));
  await editor.dispose();
  return text;
}

async function observeSlash(page: Page, platform: PlatformDefinition): Promise<SlashObservation> {
  const feedback = page.locator(FEEDBACK);
  return {
    selectorOpen: await page.locator(SELECTOR_DIALOG).isVisible(),
    fieldText: await readField(page, platform),
    feedback: (await feedback.isVisible()) ? (await feedback.innerText()).trim() : null
  };
}

/** Puts the caret in the empty field, once the Prompts button shows (the content script is ready); false when there is no field */
async function focusEmptyField(page: Page, platform: PlatformDefinition, timeout: number): Promise<boolean> {
  const editor = await findEditor(page, editorSelectorsOf(platform), timeout);
  if (!editor) {
    return false;
  }
  await page.locator(ICON).first().waitFor({ state: 'attached', timeout });
  await editor.click();
  await editor.dispose();
  await emptyField(page);
  return true;
}

async function emptyField(page: Page): Promise<void> {
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
}

/** Waits until the // case reads as it should, or the timeout; the caller judges what it reads then */
async function settleSlash(page: Page, platform: PlatformDefinition, expectedText: string, timeout: number): Promise<SlashObservation> {
  const deadline = Date.now() + timeout;
  let observed = await observeSlash(page, platform);
  while (!judgeSlash(observed, expectedText).pass && Date.now() < deadline) {
    await page.waitForTimeout(250);
    observed = await observeSlash(page, platform);
  }
  return observed;
}

/**
 * Waits for the Prompts button's settled placement: on the toolbar, or still on the Anchored
 * overlay once the timeout, longer than the extension's grace for a late toolbar
 * (IconPlacementController.TOOLBAR_GRACE_MS, 5 s), has passed. A toolbar later still (44 s was
 * seen on copilot.cloud.microsoft) shows in the report as the overlay
 */
async function settlePlacement(page: Page, timeout: number): Promise<void> {
  const wait = Math.max(timeout, IconPlacementController.TOOLBAR_GRACE_MS + 1_000);
  await page.waitForFunction((selector) => document.querySelector(selector)?.getAttribute('data-mpm-placement') === 'toolbar', ICON, { timeout: wait, polling: 250 })
    .catch(() => undefined);
}

/**
 * Leaves nothing behind, since a Platform may keep a draft: closes the Prompt selector, waits for
 * it to go (until then the keys reach its search box, not the field), puts the caret back in the
 * field and empties it. True when the field reads empty after.
 */
export async function cleanUp(page: Page, platform: PlatformDefinition): Promise<boolean> {
  await page.keyboard.press('Escape');
  await page.locator(SELECTOR_DIALOG).waitFor({ state: 'hidden', timeout: 2_000 }).catch(() => undefined);
  const editor = await findEditor(page, editorSelectorsOf(platform), 2_000);
  if (!editor) {
    // Replaced or removed: the keys would go nowhere, and a draft may be kept
    return false;
  }
  await editor.click();
  await editor.dispose();
  await emptyField(page);
  const left = await readField(page, platform);
  return left !== null && normalizeFieldText(left) === '';
}

/**
 * What a case's line adds about its cleanup: a warning only when the case typed into a field and
 * that field could not be emptied after, a field gone since included; nothing when no key was
 * typed (no field, signed out, the late-composer case)
 */
export const cleanUpNote = (typed: boolean, emptied: boolean): string =>
  (typed && !emptied ? '; field NOT emptied after, check for a draft' : '');

/**
 * What follows a case: the field emptied when the case typed into it, the Prompt selector only
 * closed when it did not. Returns what the case's line adds (cleanUpNote): said, not hidden, since
 * the maintainer's account may keep the draft
 */
export async function afterCase(page: Page, platform: PlatformDefinition, typed: boolean): Promise<string> {
  if (!typed) {
    await page.keyboard.press('Escape').catch(() => undefined);
    return '';
  }
  return cleanUpNote(true, await cleanUp(page, platform).catch(() => false));
}

/**
 * Runs one case on its page
 *
 * @param progress - Set to typed once the caret is in the field, before the first key: read by the
 *   cleanup even when the case throws
 */
export async function runCase(page: Page, platform: PlatformDefinition, id: CaseId, timeout: number, progress = { typed: false }): Promise<Verdict> {
  if (id === 'late-toolbar') {
    await settlePlacement(page, timeout);
    const pageLanguage = await page.evaluate(() => document.documentElement.lang);
    return judgeLateToolbar(await readIcon(page), overlayIsFallback(platform, pageLanguage) ? pageLanguage : undefined);
  }
  if (!(await focusEmptyField(page, platform, timeout))) {
    return { pass: false, detail: 'no field (signed out?)' };
  }
  progress.typed = true;
  switch (id) {
    case 'slash-empty':
      await page.keyboard.type('//');
      return judgeSlash(await settleSlash(page, platform, '', timeout), '');
    case 'slash-menu':
      // The first slash opens Copilot's menu, which then takes the keys typed: the second comes on its own
      await page.keyboard.type('/');
      await page.waitForTimeout(600);
      await page.keyboard.type('/');
      return judgeSlash(await settleSlash(page, platform, '', timeout), '');
    case 'slash-inside':
      await page.keyboard.type('Hi there');
      // The caret before "there"
      for (let step = 0; step < 'there'.length; step++) {
        await page.keyboard.press('ArrowLeft');
      }
      await page.keyboard.type('//');
      return judgeSlash(await settleSlash(page, platform, 'Hi there', timeout), 'Hi there');
    case 'icon-steady': {
      // Settled first, as the late-composer case waits for it: the case is about typing, not about
      // when a late toolbar arrives. Then a second for the toolbar's own re-renders
      await settlePlacement(page, timeout);
      await page.waitForTimeout(1_000);
      const before = await readIcon(page);
      await page.keyboard.type('Hello world', { delay: 50 });
      await page.waitForTimeout(500);
      return judgeSteady(before, await readIcon(page));
    }
  }
}

/** Opens the Platform in a new tab: the live page, or its stand-in served on the Platform's own hostname */
async function openPage(context: BrowserContext, id: string, platform: PlatformDefinition, options: LiveCheckOptions): Promise<Page> {
  let url = startUrlOf(id, platform);
  if (options.standIn) {
    // Loaded only for a self-check: the stand-ins are the e2e tests' pages
    const { routePlatform } = await import('../tests/e2e/fixtures/platform-pages');
    url = await routePlatform(context, STAND_INS[id]);
  }
  const page = await context.newPage();
  // A Platform may ask before leaving a page with a draft
  page.on('dialog', (dialog) => { void dialog.accept(); });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return page;
}

/** Each case on a page of its own, freshly loaded, so a case never sees what the one before left */
async function checkPlatform(context: BrowserContext, id: string, options: LiveCheckOptions): Promise<CaseResult[]> {
  const platform = SUPPORTED_PLATFORMS[id];
  const results: CaseResult[] = [];
  for (const { id: caseId } of CASES) {
    let page: Page | undefined;
    const progress = { typed: false };
    try {
      page = await openPage(context, id, platform, options);
      results.push({ platform: id, case: caseId, ...(await runCase(page, platform, caseId, options.timeout, progress)) });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message.split('\n')[0] : String(err);
      results.push({ platform: id, case: caseId, pass: false, detail: `error: ${redactUrls(message, startUrlOf(id, platform))}` });
    } finally {
      if (page) {
        results[results.length - 1].detail += await afterCase(page, platform, progress.typed);
        await page.close().catch(() => undefined);
      }
    }
  }
  return results;
}

function openContext(options: LiveCheckOptions): Promise<BrowserContext> {
  mkdirSync(options.profile, { recursive: true });
  return chromium.launchPersistentContext(options.profile, {
    headless: options.headless,
    // Named even when it is chromium: headless, only the full browser loads an extension, not the headless shell
    channel: options.channel,
    args: [`--disable-extensions-except=${options.dist}`, `--load-extension=${options.dist}`],
    viewport: { width: 1280, height: 900 }
  });
}

async function main(): Promise<number> {
  const options = parseLiveCheckArgs(process.argv.slice(2), process.env);
  const ids = options.only.length > 0 ? options.only : Object.keys(SUPPORTED_PLATFORMS);

  if (options.build && !options.login) {
    const build = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
    if (build.status !== 0) {
      process.stderr.write('The build failed: nothing checked.\n');
      return build.status ?? 1;
    }
  }

  const context = await openContext(options);
  if (options.login) {
    for (const id of ids) {
      const page = await context.newPage();
      await page.goto(startUrlOf(id, SUPPORTED_PLATFORMS[id])).catch(() => undefined);
    }
    process.stdout.write(`Sign in to each Platform in the browser, then close it. Profile: ${options.profile}\n`);
    await new Promise<void>((done) => { context.on('close', () => { done(); }); });
    return 0;
  }

  const results: CaseResult[] = [];
  try {
    for (const id of ids) {
      results.push(...(await checkPlatform(context, id, options)));
    }
  } finally {
    await context.close();
  }
  process.stdout.write(formatReport(results));
  return liveCheckExitCode(results);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; }, (err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 2;
  });
}
