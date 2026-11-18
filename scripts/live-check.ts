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

import { type BrowserContext, chromium, type ElementHandle, type JSHandle, type Page } from 'playwright';

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

/** The field's text without the zero-width characters an editor keeps, a no-break space as a space, whitespace kept */
const withoutInvisibles = (text: string): string => text.replace(/[​-‍﻿]/g, '').replace(/ /g, ' ');

/** The field's text as the user reads it: without the zero-width characters an editor keeps, a no-break space as a space, trimmed */
export const normalizeFieldText = (text: string): string => withoutInvisibles(text).trim();

/** Whether a field holds nothing a user wrote: no text but the zero-width characters an editor keeps. Not trimmed: a draft of spaces or line breaks is still a draft */
export const isEmptyField = (text: string): boolean => withoutInvisibles(text) === '';

/**
 * The field's text, line by line as the user sees it, read in the page: a textarea's value, or a
 * rich-text editor walked in document order, every text node kept, its own and its blocks'. A
 * block (<p>, <div>, <li>…) starts and ends a line, and a <br> ends one: so an empty paragraph,
 * its lone <br> the line, is an empty line, and a <br> that ends a line already ended adds none.
 * An empty editor (<p><br></p>) reads "", three empty paragraphs "\n\n", "My draft<div><br></div>"
 * "My draft\n". Read from the DOM, not textContent, which drops the lines, nor innerText, which
 * depends on layout. Sent to the page as it is: no inner function.
 */
export const fieldTextOf = (element: Element): string => {
  if (element instanceof HTMLTextAreaElement) {
    return element.value;
  }
  const blocks = ['P', 'DIV', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'BLOCKQUOTE'];
  const lines: string[] = [];
  let line = '';
  // Whether the current line holds anything yet: a block boundary ends it only then
  let open = false;
  // Each node is visited on the way in, and a block again on the way out
  const stack: { node: Node; leaving: boolean }[] = [{ node: element, leaving: false }];
  while (stack.length > 0) {
    const entry = stack.pop();
    if (!entry) {
      break;
    }
    const { node, leaving } = entry;
    const block = node !== element && blocks.includes(node.nodeName);
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue ?? '';
      if (text !== '') {
        line += text;
        open = true;
      }
    } else if (node.nodeName === 'BR') {
      lines.push(line);
      line = '';
      open = false;
    } else if (block && open) {
      lines.push(line);
      line = '';
      open = false;
    }
    if (!leaving && node.nodeType === Node.ELEMENT_NODE && node.nodeName !== 'BR') {
      if (block) {
        stack.push({ node, leaving: true });
      }
      for (let index = node.childNodes.length - 1; index >= 0; index--) {
        stack.push({ node: node.childNodes[index], leaving: false });
      }
    }
  }
  if (open) {
    lines.push(line);
  }
  return lines.join('\n');
};

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
  /** Where the button is on the page */
  x: number;
  y: number;
  /**
   * Where the button is from the element of the chain it was placed against (data-mpm-anchor): the
   * element held from before typing while the chain's selector still finds it in the button's
   * composer, else the first one the selector finds there now. Null when the button is not on the
   * toolbar or no such element is found
   */
  fromAnchor: { x: number; y: number } | null;
  /**
   * Which element fromAnchor is measured from: the one held from before typing, or a new one when
   * the held one no longer matches the selector (Mistral re-renders its controls). Null with fromAnchor
   */
  anchorElement: 'held' | 'new' | null;
  /**
   * The button stands in its chain's relation to that element: right before it, right after it, or
   * its first or last child. Null with fromAnchor
   */
  beside: boolean | null;
  /**
   * The button is in the composer of the field typed in, found from that field as
   * resolveIconPlacement finds it. Null when the button is not on the toolbar or that composer is not found
   */
  inComposer: boolean | null;
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

/** What the Platform's chain finds from the editor on the page, as the extension resolves it (resolveIconPlacement) */
export interface ChainProbe {
  /** The chain's composer selector matches an ancestor of the editor */
  composerFound: boolean;
  /** One of the chain's anchors is in that composer */
  anchorFound: boolean;
}

/**
 * Whether the Anchored overlay is the designed end of the Platform's chain on this page: the chain
 * finds an anchor by an English ARIA label (ChatGPT, Mistral, Perplexity), the page says it is in
 * another language, and on the page the chain finds its composer but none of its anchors, where
 * src/config/platforms.ts lets the icon fall to the anchor on the editor. Not on a page that names
 * no language, nor where the chain still resolves (ChatGPT's send-button test id on a French page)
 * or its composer is not found: the overlay there is a regression or a chain that drifted.
 */
export function overlayIsFallback(platform: PlatformDefinition, pageLanguage: string, chain: ChainProbe): boolean {
  const readsLabels = platform.iconPlacement?.anchors.some(({ find }) => /\[aria-label\s*[*^$|~]?=/i.test(find)) ?? false;
  const otherLanguage = pageLanguage.trim() !== '' && !/^en(-|$)/i.test(pageLanguage.trim());
  return readsLabels && otherLanguage && chain.composerFound && !chain.anchorFound;
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

const distance = (from: { x: number; y: number }, to: { x: number; y: number }): number =>
  Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));

/**
 * The typing case passes when the Prompts button keeps its placement, its anchor and its position.
 * On the toolbar, the button must stay in the composer of the field typed in, and still stand
 * against the element it stood against before typing, held across the typing, at the same distance
 * from it (a button against no element of its anchor before typing fails as such). A Platform may move its own controls as the
 * field gets text, and the button with them: Gemini and Mistral show a send button that pushes
 * their right-aligned group, the button included, 42 and 40 px left (live, 2026-11-18). So a move
 * on the page is not a fail; a button beside another element the anchor selector also finds is.
 * Mistral also turns its voice control's div into the send button's and renders a new voice div
 * between it and the Prompts button: the held element no longer matches the selector. The button
 * must then stand against the element the selector finds now, at the same distance, and the line
 * says the anchor was re-rendered. With no anchor found before or after typing, the position on
 * the page, and the line says when it was not found
 */
export function judgeSteady(before: IconState | null, after: IconState | null): Verdict {
  if (!before || !after) {
    return { pass: false, detail: `${before ? 'Prompts button gone while typing' : 'no Prompts button before typing'}` };
  }
  if (before.placement !== after.placement || before.anchor !== after.anchor) {
    return { pass: false, detail: `${describeIcon(before)} became ${describeIcon(after)}` };
  }
  const onPage = distance(before, after);
  if (after.inComposer === false) {
    return { pass: false, detail: `${describeIcon(after)}, outside the composer of the field typed in (${onPage.toFixed(1)}px on the page)` };
  }
  // Whatever is found after typing: the baseline itself is off
  if (before.fromAnchor && before.beside === false) {
    return { pass: false, detail: `${describeIcon(after)}, not beside its anchor before typing (${onPage.toFixed(1)}px on the page)` };
  }
  if (before.fromAnchor && after.fromAnchor) {
    const reRendered = after.anchorElement === 'new' ? ', its anchor re-rendered' : '';
    if (!after.beside) {
      return { pass: false, detail: `${describeIcon(after)}, no longer beside its anchor${reRendered} (${onPage.toFixed(1)}px on the page)` };
    }
    const moved = distance(before.fromAnchor, after.fromAnchor);
    return {
      pass: moved <= STEADY_TOLERANCE,
      detail: `${describeIcon(after)}, moved ${moved.toFixed(1)}px from its anchor${reRendered} (${onPage.toFixed(1)}px on the page)`
    };
  }
  // A button that kept its place on the page did not move, whatever anchor shows after typing
  const missing = before.fromAnchor ? ' after typing' : after.fromAnchor ? ' before typing' : '';
  const notFound = after.placement === 'toolbar' ? `, anchor not found${missing}, measured on the page` : '';
  return { pass: onPage <= STEADY_TOLERANCE, detail: `${describeIcon(after)}, moved ${onPage.toFixed(1)}px${notFound}` };
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

/** What the page needs to find the Prompts button and the element of its chain it stands against */
const iconLookup = (platform: PlatformDefinition) => ({
  selector: ICON,
  chain: platform.iconPlacement
    ? { composer: platform.iconPlacement.composer, anchors: platform.iconPlacement.anchors.map(({ find, relation }) => ({ find, relation })) }
    : null
});

/**
 * The element of the chain the Prompts button stands against, held so that the same element is read
 * after typing: in the composer of the field typed in, as resolveIconPlacement finds it, the match
 * the button stands against, else the first. The extension places the button against the first
 * match and leaves it there: one that shows earlier in the form afterwards is not its anchor. A
 * handle to null when the button is not on the toolbar or no match is found. Sent to the page as
 * it is: no inner function
 */
const holdAnchor = (page: Page, platform: PlatformDefinition, editor: ElementHandle<HTMLElement> | null): Promise<JSHandle<Element | null>> =>
  page.evaluateHandle(({ selector, chain, editor: field }) => {
    const icon = document.querySelector(selector);
    const anchor = icon?.getAttribute('data-mpm-anchor') ?? null;
    const link = chain && icon?.getAttribute('data-mpm-placement') === 'toolbar' && anchor !== null ? chain.anchors[Number(anchor)] : undefined;
    const composer = chain && link ? (field ?? icon)?.closest(chain.composer) : null;
    if (!icon || !link || !composer) {
      return null;
    }
    const against = link.relation === 'before' ? icon.nextElementSibling : link.relation === 'after' ? icon.previousElementSibling : icon.parentElement;
    return against && composer.contains(against) && against.matches(link.find) ? against : composer.querySelector(link.find);
  }, { ...iconLookup(platform), editor });

/**
 * The Prompts button, and where it is from the element of its chain it stands against: the held
 * element while the chain's selector still finds it in the composer of the field typed in (of the
 * button, with no field given), else (or with none held) the first one the selector finds there
 * now. Sent to the page as it is: no inner function
 */
const readIcon = (page: Page, platform: PlatformDefinition, held?: JSHandle<Element | null>, editor?: ElementHandle<HTMLElement> | null): Promise<IconState | null> =>
  page.evaluate(({ selector, chain, held: heldElement, editor: field }) => {
    const icon = document.querySelector(selector);
    if (!icon) {
      return null;
    }
    const box = icon.getBoundingClientRect();
    const placement = icon.getAttribute('data-mpm-placement');
    const anchor = icon.getAttribute('data-mpm-anchor');
    const link = chain && placement === 'toolbar' && anchor !== null ? chain.anchors[Number(anchor)] : undefined;
    const composer = chain && link ? (field ?? icon).closest(chain.composer) : null;
    const kept = Boolean(link && composer && heldElement?.isConnected && composer.contains(heldElement) && heldElement.matches(link.find));
    const element = kept ? heldElement : (link ? composer?.querySelector(link.find) : null) ?? null;
    const anchorBox = element?.getBoundingClientRect();
    const relation = link?.relation;
    return {
      placement,
      anchor,
      x: box.x,
      y: box.y,
      fromAnchor: anchorBox ? { x: box.x - anchorBox.x, y: box.y - anchorBox.y } : null,
      anchorElement: element ? (kept ? 'held' as const : 'new' as const) : null,
      beside: element
        ? (relation === 'before' && icon.nextElementSibling === element)
          || (relation === 'after' && element.nextElementSibling === icon)
          || (relation === 'inside-start' && element.firstElementChild === icon)
          || (relation === 'inside-end' && element.lastElementChild === icon)
        : null,
      inComposer: composer ? composer.contains(icon) : null
    };
  }, { ...iconLookup(platform), held: held ?? null, editor: editor ?? null });

/** The editor's text, found again each time: a Platform may replace its editor. Null when there is none */
async function readField(page: Page, platform: PlatformDefinition): Promise<string | null> {
  const editor = await findEditor(page, editorSelectorsOf(platform), 1_000);
  if (!editor) {
    return null;
  }
  const text = await editor.evaluate(fieldTextOf);
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

/** How many editors clickField finds and clicks before it gives up on a Platform that keeps replacing its editor */
export const FIELD_CLICK_ATTEMPTS = 3;

/**
 * Finds the field and clicks it, found again when the Platform replaced it between the lookup and
 * the click: Gemini mounts its editor, then replaces it with a new one some 200 ms later, which a
 * lookup in between finds (seen on 2026-11-18). The click then throws as the element is detached,
 * before any key. Null when no field shows; throws the click's error once FIELD_CLICK_ATTEMPTS
 * editors were replaced, or on any other error.
 */
async function clickField(page: Page, platform: PlatformDefinition, timeout: number): Promise<ElementHandle<HTMLElement> | null> {
  for (let attempt = 1; ; attempt++) {
    const editor = await findEditor(page, editorSelectorsOf(platform), timeout);
    if (!editor) {
      return null;
    }
    try {
      await editor.click();
      return editor;
    } catch (err: unknown) {
      await editor.dispose();
      if (attempt >= FIELD_CLICK_ATTEMPTS || !(err instanceof Error && err.message.includes('not attached to the DOM'))) {
        throw err;
      }
    }
  }
}

/**
 * Puts the caret in the field, once the Prompts button shows (the content script is ready). The
 * field is never emptied: a Platform may restore a saved draft, which a case would otherwise
 * delete, and it may do so after the field first shows. So the field is read last, after every
 * wait, just before the case's first key. 'no-field' when there is none, 'draft' when it holds
 * text, left as it was.
 */
async function focusEmptyField(page: Page, platform: PlatformDefinition, timeout: number): Promise<'ready' | 'no-field' | 'draft'> {
  const shown = await findEditor(page, editorSelectorsOf(platform), timeout);
  if (!shown) {
    return 'no-field';
  }
  await shown.dispose();
  await page.locator(ICON).first().waitFor({ state: 'attached', timeout });
  // Found again after the wait, and again when it was replaced before the click
  const editor = await clickField(page, platform, timeout);
  if (!editor) {
    return 'no-field';
  }
  const text = await editor.evaluate(fieldTextOf);
  await editor.dispose();
  return isEmptyField(text) ? 'ready' : 'draft';
}

/** The chain as the extension resolves it from the editor (resolveIconPlacement), read in the page */
async function probeChain(page: Page, platform: PlatformDefinition): Promise<ChainProbe> {
  const chain = platform.iconPlacement;
  const editor = chain ? await findEditor(page, editorSelectorsOf(platform), 1_000) : null;
  if (!chain || !editor) {
    return { composerFound: false, anchorFound: false };
  }
  const probe = await editor.evaluate((element, { composer, anchors }) => {
    const found = element.closest(composer);
    return { composerFound: found !== null, anchorFound: found !== null && anchors.some((find) => found.querySelector(find) !== null) };
  }, { composer: chain.composer, anchors: chain.anchors.map(({ find }) => find) });
  await editor.dispose();
  return probe;
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
 * Whether the field holds only what the case typed: nothing, or exactly one of the texts the case
 * can leave (CaseProgress.owned). Anything else, a draft the Platform restored during the case,
 * spaces, line breaks or slashes included, is not the script's to delete.
 */
export const ownsField = (fieldText: string, owned: readonly string[]): boolean =>
  isEmptyField(fieldText) || owned.includes(withoutInvisibles(fieldText));

/** How a cleanup ended: the field emptied, not emptied (or gone), or left alone as it held text the case did not type */
export type CleanUpResult = 'emptied' | 'not emptied' | 'not ours';

/**
 * Leaves nothing behind, since a Platform may keep a draft: closes the Prompt selector, waits for
 * it to go (until then the keys reach its search box, not the field), puts the caret back in the
 * field and empties it, only when it holds nothing but what the case typed (ownsField). The field is
 * read after the click and again after Select All, just before the Backspace that deletes. Still
 * lost with no note: a draft restored in the one round trip between that last read and the
 * Backspace, and a draft that is exactly a text the case owns (a lone / during the / menu case).
 */
export async function cleanUp(page: Page, platform: PlatformDefinition, owned: readonly string[]): Promise<CleanUpResult> {
  await page.keyboard.press('Escape');
  await page.locator(SELECTOR_DIALOG).waitFor({ state: 'hidden', timeout: 2_000 }).catch(() => undefined);
  const editor = await clickField(page, platform, 2_000);
  if (!editor) {
    // Removed: the keys would go nowhere, and a draft may be kept
    return 'not emptied';
  }
  if (!ownsField(await editor.evaluate(fieldTextOf), owned)) {
    await editor.dispose();
    return 'not ours';
  }
  await page.keyboard.press('ControlOrMeta+A');
  // Nothing between this read and the Backspace but its own round trip: the handle goes after
  if (!ownsField(await editor.evaluate(fieldTextOf), owned)) {
    await editor.dispose();
    return 'not ours';
  }
  await page.keyboard.press('Backspace');
  await editor.dispose();
  const left = await readField(page, platform);
  // Not trimmed: spaces or line breaks left behind are still in the field
  return left !== null && isEmptyField(left) ? 'emptied' : 'not emptied';
}

/**
 * What a case's line adds about its cleanup: a warning when the case typed into a field and that
 * field could not be emptied after (a field gone since included), or held text the case did not
 * type, left as it was; nothing when no key was typed (no field, signed out, the late-composer case)
 */
export const cleanUpNote = (typed: boolean, result: CleanUpResult): string => {
  if (!typed || result === 'emptied') {
    return '';
  }
  return result === 'not ours'
    ? '; field holds text the case did not type, left as it was: check for a draft'
    : '; field NOT emptied after, check for a draft';
};

/** What a case did to its field, read by the cleanup even when the case throws */
export interface CaseProgress {
  /** Set once the caret is in the field, before the first key */
  typed: boolean;
  /** The texts the case can have left in the field so far (CASE_FIELDS): the only ones the cleanup may delete */
  owned: readonly string[];
}

/**
 * What follows a case: the field emptied when the case typed into it and it holds only the case's
 * text, the Prompt selector only closed when nothing was typed. Returns what the case's line adds
 * (cleanUpNote): said, not hidden, since the maintainer's account may keep the draft
 */
export async function afterCase(page: Page, platform: PlatformDefinition, progress: CaseProgress): Promise<string> {
  if (!progress.typed) {
    await page.keyboard.press('Escape').catch(() => undefined);
    return '';
  }
  return cleanUpNote(true, await cleanUp(page, platform, progress.owned).catch((): CleanUpResult => 'not emptied'));
}

/** Every start of a text but the whole: what typing it leaves when cut short */
const startsOf = (text: string): string[] => Array.from({ length: text.length - 1 }, (_, end) => text.slice(0, end + 1));

/**
 * The texts each typing case can leave in its field, the extension's taking out of the // aside
 * (an empty field is always the case's): once its keys are all typed, and while typing (cut short
 * when the case throws). Copilot's / menu may take a slash, so slash-menu can leave one.
 */
export const CASE_FIELDS: Record<Exclude<CaseId, 'late-toolbar'>, { typed: readonly string[]; typing: readonly string[] }> = {
  'slash-empty': { typed: ['//'], typing: ['/'] },
  'slash-menu': { typed: ['/', '//'], typing: [] },
  'slash-inside': { typed: ['Hi there', 'Hi //there'], typing: [...startsOf('Hi there'), 'Hi /there'] },
  'icon-steady': { typed: ['Hello world'], typing: startsOf('Hello world') }
};

/** A case not run: the field holds a draft, never typed into */
const DRAFT_NOT_RUN: Verdict = { pass: false, detail: 'the field holds a draft: case not run, field left as it was' };

/**
 * Runs one case on its page
 *
 * @param progress - Set to typed, with the case's text, once the caret is in the field, before the
 *   first key: read by the cleanup even when the case throws
 */
export async function runCase(page: Page, platform: PlatformDefinition, id: CaseId, timeout: number, progress: CaseProgress = { typed: false, owned: [] }): Promise<Verdict> {
  if (id === 'late-toolbar') {
    await settlePlacement(page, timeout);
    const pageLanguage = await page.evaluate(() => document.documentElement.lang);
    const fallback = overlayIsFallback(platform, pageLanguage, await probeChain(page, platform));
    return judgeLateToolbar(await readIcon(page, platform), fallback ? pageLanguage : undefined);
  }
  if (id === 'icon-steady') {
    // Settled first, as the late-composer case waits for it: the case is about typing, not about
    // when a late toolbar arrives. Then a second for the toolbar's own re-renders. Before the field
    // is read, so no wait comes between that read and the first key
    await settlePlacement(page, timeout);
    await page.waitForTimeout(1_000);
  }
  const field = await focusEmptyField(page, platform, timeout);
  if (field === 'no-field') {
    return { pass: false, detail: 'no field (signed out?)' };
  }
  if (field === 'draft') {
    return DRAFT_NOT_RUN;
  }
  if (id === 'icon-steady') {
    return runSteady(page, platform, progress);
  }
  const fields = CASE_FIELDS[id];
  progress.owned = [...fields.typed, ...fields.typing];
  progress.typed = true;
  // Once every key is typed, a field cut short is not the case's any more
  const allTyped = (): void => {
    progress.owned = fields.typed;
  };
  switch (id) {
    case 'slash-empty':
      await page.keyboard.type('//');
      allTyped();
      return judgeSlash(await settleSlash(page, platform, '', timeout), '');
    case 'slash-menu':
      // The first slash opens Copilot's menu, which then takes the keys typed: the second comes on its own
      await page.keyboard.type('/');
      await page.waitForTimeout(600);
      await page.keyboard.type('/');
      allTyped();
      return judgeSlash(await settleSlash(page, platform, '', timeout), '');
    case 'slash-inside':
      await page.keyboard.type('Hi there');
      // The caret before "there"
      for (let step = 0; step < 'there'.length; step++) {
        await page.keyboard.press('ArrowLeft');
      }
      await page.keyboard.type('//');
      allTyped();
      return judgeSlash(await settleSlash(page, platform, 'Hi there', timeout), 'Hi there');
  }
}

/**
 * icon-steady, once the caret is in the empty field. The element the button stands against is
 * held across the typing: a button then beside another element the anchor selector also finds has
 * moved. The composer is the field's: the one typed in while it is on the page (another editor may
 * show earlier meanwhile), else the one found again (a Platform may replace its editor)
 */
async function runSteady(page: Page, platform: PlatformDefinition, progress: CaseProgress): Promise<Verdict> {
  const editor = await findEditor(page, editorSelectorsOf(platform), 1_000);
  if (!editor) {
    return { pass: false, detail: 'no field (signed out?)' };
  }
  const held = await holdAnchor(page, platform, editor);
  let found: ElementHandle<HTMLElement> | null = null;
  try {
    const before = await readIcon(page, platform, held, editor);
    // The reads above come after the field was found empty: a draft restored meanwhile is not typed into
    if (!isEmptyField(await editor.evaluate(fieldTextOf))) {
      return DRAFT_NOT_RUN;
    }
    const { typed, typing } = CASE_FIELDS['icon-steady'];
    progress.owned = [...typed, ...typing];
    progress.typed = true;
    await page.keyboard.type('Hello world', { delay: 50 });
    // Once every key is typed, a field cut short is not the case's any more
    progress.owned = typed;
    await page.waitForTimeout(500);
    const kept = await editor.evaluate((element) => element.isConnected);
    found = kept ? null : await findEditor(page, editorSelectorsOf(platform), 1_000);
    return judgeSteady(before, await readIcon(page, platform, held, kept ? editor : found));
  } finally {
    await held.dispose();
    await editor.dispose();
    await found?.dispose();
  }
}

/**
 * Sends the page's requests to the network, past any service worker the profile holds for the
 * Platform: a worker answers a navigation before the context's routes see it, so the stand-in
 * would never load. chat.mistral.ai registers one for a signed-in user (its sw.js answers fetches),
 * and a live-check profile signed in there got Mistral's own page instead of the stand-in: no
 * field, no Prompts button (My-Prompt-Manager-h6o). Playwright's `serviceWorkers: 'block'` only
 * stops new registrations, not a worker already installed in the profile. Chromium only, as the script.
 */
export async function bypassServiceWorkers(context: BrowserContext, page: Page): Promise<void> {
  const session = await context.newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.setBypassServiceWorker', { bypass: true });
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
  if (options.standIn) {
    await bypassServiceWorkers(context, page);
  }
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
    const progress: CaseProgress = { typed: false, owned: [] };
    try {
      page = await openPage(context, id, platform, options);
      results.push({ platform: id, case: caseId, ...(await runCase(page, platform, caseId, options.timeout, progress)) });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message.split('\n')[0] : String(err);
      results.push({ platform: id, case: caseId, pass: false, detail: `error: ${redactUrls(message, startUrlOf(id, platform))}` });
    } finally {
      if (page) {
        results[results.length - 1].detail += await afterCase(page, platform, progress);
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
