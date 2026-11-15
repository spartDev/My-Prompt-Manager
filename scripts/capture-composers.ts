/**
 * npm run composers:capture: refreshes tests/fixtures/composers/<platform>.html from the live
 * Platforms (design docs/plans/2026-11-08-icon-placement-resilience-design.md §5), then runs the
 * unit tests of the anchor chains on what it captured, which say which chains still resolve.
 *
 * Claude, Gemini, Mistral and M365 Copilot need sign-in, so it runs in a persistent Chrome profile
 * the maintainer has signed into once with --login. A chore before each release, not a CI job.
 *
 *   npm run composers:capture -- --login                 open each Platform to sign in; close the browser when done
 *   npm run composers:capture                            capture every Platform into tests/fixtures/composers
 *   npm run composers:capture -- --only claude,chatgpt   capture some
 *   npm run composers:capture -- --url claude=http://127.0.0.1:8080/claude.html --out /tmp/fx --headless --channel chromium
 *                                                        capture a stand-in page instead of the live site
 *
 * The sanitizer keeps an allowlist: contenteditable, role and type with a value the web platform
 * defines, and the attributes and class names the Platform's selectors read, written with the
 * selector's value, never the page's; text, links and any other attribute (an ARIA label naming
 * the user's workspace) go.
 * Still review `git diff tests/fixtures/composers` before committing.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { type BrowserContext, chromium, type Page } from 'playwright';

import { type PlatformDefinition, SUPPORTED_PLATFORMS } from '../src/config/platforms';

import { CAPTURED_DIR_ENV, CAPTURED_IDS_ENV } from './composers/fixtures';
import { composerFixture, EDITOR_MARKER, sanitizeComposer, sanitizeRulesOf } from './composers/sanitize';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = path.join(ROOT, 'tests', 'fixtures', 'composers');
const DEFAULT_PROFILE = path.join(homedir(), '.my-prompt-manager', 'composers-profile');
/** A path as the report prints it: from the repository when it is in it */
const shown = (file: string): string => (file.startsWith(`${ROOT}${path.sep}`) ? path.relative(ROOT, file) : file);

const CHAINS_TEST = 'src/content/core/__tests__/icon-placement-chains.test.ts';

/** Where each Platform's composer is, when it is not at the root of its hostname */
const START_PATHS: Partial<Record<string, string>> = {
  claude: '/new',
  m365copilot: '/chat'
};

export interface CaptureOptions {
  only: string[];
  urls: Record<string, string>;
  out: string;
  profile: string;
  channel: string;
  headless: boolean;
  login: boolean;
  runTests: boolean;
  /** How long to wait for an editor, in ms */
  timeout: number;
  /** How long to let the toolbar render after the editor shows, in ms */
  settle: number;
}

export function parseCaptureArgs(argv: readonly string[], env: NodeJS.ProcessEnv = {}): CaptureOptions {
  const options: CaptureOptions = {
    only: [],
    urls: {},
    out: DEFAULT_OUT,
    profile: env.COMPOSERS_PROFILE || DEFAULT_PROFILE,
    channel: 'chrome',
    headless: false,
    login: false,
    runTests: true,
    timeout: 30_000,
    settle: 1_500
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
      case '--url': {
        const [id, ...url] = value(index, flag).split('=');
        if (!id || url.length === 0) {
          throw new Error('--url takes <platform>=<url>');
        }
        options.urls[id] = url.join('=');
        index++;
        break;
      }
      case '--out':
        options.out = path.resolve(value(index, flag));
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
      case '--timeout':
      case '--settle': {
        const ms = Number(value(index, flag));
        if (!Number.isFinite(ms) || ms < 0) {
          throw new Error(`${flag} takes milliseconds`);
        }
        options[flag === '--timeout' ? 'timeout' : 'settle'] = ms;
        index++;
        break;
      }
      case '--headless':
        options.headless = true;
        break;
      case '--login':
        options.login = true;
        break;
      case '--no-test':
        options.runTests = false;
        break;
      default:
        throw new Error(`Unknown option ${flag}`);
    }
  }
  const unknown = [...options.only, ...Object.keys(options.urls)].filter((id) => !(id in SUPPORTED_PLATFORMS));
  if (unknown.length > 0) {
    throw new Error(`Unknown platform ${unknown.join(', ')}; one of ${Object.keys(SUPPORTED_PLATFORMS).join(', ')}`);
  }
  return options;
}

const urlOf = (id: string, platform: PlatformDefinition, options: CaptureOptions): string =>
  options.urls[id] ?? `https://${platform.hostname}${START_PATHS[id] ?? '/'}`;

/**
 * The class selectors the platform strategies find editors by, beyond the config's
 * (claude-strategy, mistral-strategy, gemini-strategy): the editor keeps those class names
 */
const STRATEGY_EDITOR_SELECTORS = ['.ProseMirror[contenteditable="true"]', 'rich-textarea .ql-editor'];

/** What a Platform's fixture keeps: what its editor selectors and its anchor chain read */
export const rulesFor = (platform: PlatformDefinition) => {
  const chain = platform.iconPlacement;
  return sanitizeRulesOf([
    ...platform.selectors,
    ...STRATEGY_EDITOR_SELECTORS,
    ...(chain ? [chain.composer, ...chain.anchors.map(({ find }) => find)] : [])
  ]);
};

/** The address a fixture's header names: a local stand-in file only by its name, not its home path */
export const headerUrl = (url: string): string =>
  (url.startsWith('file:') ? `file://<stand-in>/${url.split(/[/\\]/).pop() ?? ''}` : url);

type CaptureResult =
  | { id: string; outcome: 'captured'; composerFound: boolean; file: string }
  | { id: string; outcome: 'no-editor'; url: string };

/** Tried after a Platform's own selectors, in this order */
const GENERIC_EDITORS = ['[contenteditable="true"][role="textbox"]', '[contenteditable="true"]', 'textarea'];

/** Ancestors of the editor captured when the chain's composer selector finds nothing */
const FALLBACK_DEPTH = 5;

export async function capture(page: Page, id: string, platform: PlatformDefinition, options: CaptureOptions): Promise<CaptureResult> {
  const url = urlOf(id, platform, options);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // The config's selectors first; the strategies find some editors by other means (ChatGPT's and
  // Perplexity's are contenteditable, their selectors name textareas), so then any editable element
  const editorSelectors = [...platform.selectors, ...GENERIC_EDITORS];
  // The first visible editor, by the selectors' order. Any visible match: waitForSelector would wait
  // on the first match only, and a hidden textarea earlier in the page (a search field) would then
  // hide the editor. Visible means rendered, not visibility:hidden, and of nonzero width and height.
  const findEditor = async () => {
    try {
      const handle = await page.waitForFunction(
        (selectors) => {
          for (const selector of selectors) {
            const editor = Array.from(document.querySelectorAll<HTMLElement>(selector))
              .find((candidate) => {
                const box = candidate.getBoundingClientRect();
                return box.width > 0 && box.height > 0 && candidate.checkVisibility({ visibilityProperty: true });
              });
            if (editor) {
              return editor;
            }
          }
          return false;
        },
        editorSelectors,
        { timeout: options.timeout, polling: 250 }
      );
      return handle.asElement();
    } catch {
      return null;
    }
  };
  if (!(await findEditor())) {
    return { id, outcome: 'no-editor', url };
  }
  await page.waitForTimeout(options.settle);
  // Found again once the toolbar has rendered: the page may have replaced the editor meanwhile
  const editorHandle = await findEditor();
  if (!editorHandle) {
    return { id, outcome: 'no-editor', url };
  }

  // In the page: the editor's composer (or an ancestor when the selector finds none), the editor
  // marked so the sanitizer keeps its classes. One flat function: it is sent as source, so it calls
  // nothing of this file.
  const live = await editorHandle.evaluate(
    (editor, { composerSelector, marker, depth }) => {
      let composer = composerSelector ? editor.closest(composerSelector) : null;
      const composerFound = composer !== null;
      if (!composer) {
        composer = editor;
        for (let level = 0; level < depth && composer.parentElement && composer.parentElement !== document.body; level++) {
          composer = composer.parentElement;
        }
      }
      editor.setAttribute(marker, '');
      const html = composer.outerHTML;
      editor.removeAttribute(marker);
      return { html, composerFound };
    },
    { composerSelector: platform.iconPlacement?.composer ?? '', marker: EDITOR_MARKER, depth: FALLBACK_DEPTH }
  );

  const { document } = new JSDOM('<!doctype html><body></body>').window;
  document.body.innerHTML = live.html;
  const root = document.body.firstElementChild;
  if (!root) {
    return { id, outcome: 'no-editor', url };
  }
  sanitizeComposer(root, rulesFor(platform));
  const file = path.join(options.out, `${id}.html`);
  writeFileSync(file, composerFixture(root, {
    platformName: platform.displayName,
    url: headerUrl(url),
    date: new Date().toISOString().slice(0, 10),
    composerFound: live.composerFound
  }));
  return { id, outcome: 'captured', composerFound: live.composerFound, file };
}

function openContext(options: CaptureOptions): Promise<BrowserContext> {
  mkdirSync(options.profile, { recursive: true });
  return chromium.launchPersistentContext(options.profile, {
    headless: options.headless,
    ...(options.channel === 'chromium' ? {} : { channel: options.channel }),
    viewport: { width: 1280, height: 900 }
  });
}

async function main(): Promise<number> {
  const options = parseCaptureArgs(process.argv.slice(2), process.env);
  const ids = options.only.length > 0 ? options.only : Object.keys(SUPPORTED_PLATFORMS);
  const context = await openContext(options);

  if (options.login) {
    for (const id of ids) {
      const page = await context.newPage();
      await page.goto(urlOf(id, SUPPORTED_PLATFORMS[id], options)).catch(() => undefined);
    }
    process.stdout.write(`Sign in to each Platform in the browser, then close it. Profile: ${options.profile}\n`);
    await new Promise<void>((done) => { context.on('close', () => { done(); }); });
    return 0;
  }

  mkdirSync(options.out, { recursive: true });
  const results: CaptureResult[] = [];
  try {
    const page = await context.newPage();
    for (const id of ids) {
      results.push(await capture(page, id, SUPPORTED_PLATFORMS[id], options));
    }
  } finally {
    await context.close();
  }

  for (const result of results) {
    if (result.outcome === 'no-editor') {
      process.stdout.write(`  ${result.id}: no editor at ${result.url} (signed out?), fixture kept as it was\n`);
    } else if (!result.composerFound) {
      process.stdout.write(`  ${result.id}: CHAIN COMPOSER NOT FOUND, an ancestor of the editor written to ${shown(result.file)}\n`);
    } else {
      process.stdout.write(`  ${result.id}: written to ${shown(result.file)}\n`);
    }
  }
  process.stdout.write('Review the diff for anything that names you (an ARIA label can) before committing.\n');

  const captured = results.filter((result) => result.outcome === 'captured').map((result) => result.id);
  if (!options.runTests || captured.length === 0) {
    return captured.length > 0 ? 0 : 1;
  }
  // The chains, run on what was just captured: a test that fails names the Platform whose chain no longer resolves
  const tests = spawnSync('npx', ['vitest', 'run', CHAINS_TEST], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, [CAPTURED_DIR_ENV]: options.out, [CAPTURED_IDS_ENV]: captured.join(',') }
  });
  return tests.status ?? 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; }, (err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 2;
  });
}
