/**
 * The real 2.0 UI the store images show, taken from the build in dist/ loaded into Chromium as the
 * e2e suite loads it (tests/e2e/fixtures/extension.ts): the Prompt selector of the content script
 * and its Insertion confirmation on the Platforms' composer fixtures (composers.ts), the side
 * panel's Library, and the Welcome's Packs step. Each scene is a PNG at twice its CSS size, so it
 * stays sharp when the image enlarges it; around the content-script scenes the page is transparent.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { type BrowserContext, chromium, type Locator, type Page } from 'playwright';

import { createStorageController, type ExtensionStorage, waitForBackgroundTarget, waitForFirstInstallRecords } from '../../tests/e2e/fixtures/extension';
import { insertionPill } from '../../tests/e2e/fixtures/insertion-flow';
import { promptRow, promptSelector, promptsButton } from '../../tests/e2e/fixtures/platform-pages';

import { composerPage, platformUrl } from './composers';
import { type DemoTheme, demoStore, packsStore, VARIABLES_PROMPT } from './demoLibrary';
import { EXTENSION_READY_TIMEOUT, launchReady } from './launch';
import { IMAGE_PLATFORMS, type ImagePlatform } from './platforms';

/** Device pixels per CSS pixel of every scene */
export const SCENE_SCALE = 2;

export interface Scene {
  /** PNG at SCENE_SCALE */
  png: Buffer;
  /** CSS size */
  width: number;
  height: number;
  /** Where the UI is in it, in CSS px: the rest is the room kept for its shadows */
  content: Box;
  /** The words its UI holds, " | " between the texts of its elements: what a check of the images' claims reads */
  text: string;
}

export interface Scenes {
  /** The dark Prompt selector opened by //, over Claude's composer holding "Summarize this thread for //" */
  selectorDark: Scene;
  /** The light Prompt selector opened by //, over Claude's composer holding "//" */
  selectorLight: Scene;
  /** The selector's Variables step for the Weekly status update, its two Variables filled in */
  variables: Scene;
  /** Claude's composer after that Insertion, with the confirmation and its Undo */
  inserted: Scene;
  /** The composer of each Platform of IMAGE_PLATFORMS, in its order, with the Prompts button the content script placed in it */
  platforms: readonly { platform: ImagePlatform; scene: Scene }[];
  /** The side panel's Library */
  library: Scene;
  /** The Welcome's last step, the Packs, in the popup */
  packs: Scene;
}

export interface CaptureOptions {
  root: string;
  dist: string;
  version: string;
  headless: boolean;
  /** Told the name of each scene as it is taken */
  onScene?: (name: string) => void;
}

/** The composer the selector scenes are taken on, and its width */
const SELECTOR_PLATFORM: ImagePlatform = 'claude';
const SELECTOR_COMPOSER_WIDTH = 500;
/** The page the selector scenes are taken in: room above the composer for the whole selector */
const SELECTOR_VIEWPORT = { width: 620, height: 620 };
/** Three of them side by side in screenshot 3 */
const PLATFORM_COMPOSER_WIDTH = 340;
const PLATFORM_VIEWPORT = { width: 460, height: 260 };
/** The side panel at the width Chrome opens it, as high as the image shows it */
const SIDE_PANEL_VIEWPORT = { width: 400, height: 640 };
/** The popup, at the size the Welcome is drawn for */
const POPUP_VIEWPORT = { width: 400, height: 500 };
/** Room kept around a content-script scene for its shadows */
const SHADOW_MARGIN = 36;

const FIELD = '.composer [contenteditable="true"], .composer textarea';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const boxOf = async (locator: Locator): Promise<Box> => {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`Not on screen: ${locator.toString()}`);
  }
  return box;
};

const viewportOf = (page: Page): { width: number; height: number } => {
  const viewport = page.viewportSize();
  if (!viewport) {
    throw new Error('No viewport');
  }
  return viewport;
};

/**
 * Waits for the page's fonts, the end of every finite animation on the document's clock (a
 * scroll-driven one never ends on its own, as the Library filter's edges), then two frames
 */
const settled = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.timeline instanceof DocumentTimeline && animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined))
    );
    for (let frame = 0; frame < 2; frame++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });

/**
 * The texts of `root` and of the elements under it, their shadow roots included, each element
 * rendered (not display: none, hidden or transparent), and the values of its fields. Text scrolled
 * out of view counts too, so that no word an image shows is missed. Runs in the page: no named
 * function inside, which the transpiler would wrap in a helper the page does not have.
 */
const wordsIn = (root: Element): string => {
  const words: string[] = [];
  const stack: Node[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined || node instanceof HTMLStyleElement || node instanceof HTMLScriptElement) {
      continue;
    }
    const text = node.nodeType === Node.TEXT_NODE ? (node.textContent ?? '').replace(/\s+/g, ' ').trim() : '';
    if (text && node.parentElement?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
      words.push(text);
    }
    if ((node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement) && node.value.trim() && node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
      words.push(node.value.replace(/\s+/g, ' ').trim());
    }
    const children = [...(node instanceof Element && node.shadowRoot ? node.shadowRoot.childNodes : []), ...node.childNodes];
    for (let index = children.length - 1; index >= 0; index--) {
      stack.push(children[index]);
    }
  }
  return words.join(' | ');
};

/** The whole viewport, opaque: an extension page */
const shootPage = async (page: Page): Promise<Scene> => {
  await settled(page);
  const { width, height } = viewportOf(page);
  const png = await page.screenshot({ caret: 'hide', animations: 'disabled', scale: 'device' });
  const text = await page.locator('body').evaluate(wordsIn);
  return { png, width, height, content: { x: 0, y: 0, width, height }, text };
};

/**
 * The smallest part of the page that holds `parts`, with SHADOW_MARGIN more on every side (inside
 * the viewport), the page transparent around them: the content script's UI over its composer.
 * Measured once the page has settled: the selector grows upward as its list renders.
 */
const shootAround = async (page: Page, parts: readonly Locator[]): Promise<Scene> => {
  await settled(page);
  const boxes = await Promise.all(parts.map(boxOf));
  const viewport = viewportOf(page);
  const ui = {
    left: Math.min(...boxes.map((box) => box.x)),
    top: Math.min(...boxes.map((box) => box.y)),
    right: Math.max(...boxes.map((box) => box.x + box.width)),
    bottom: Math.max(...boxes.map((box) => box.y + box.height))
  };
  const left = Math.max(0, Math.floor(ui.left - SHADOW_MARGIN));
  const top = Math.max(0, Math.floor(ui.top - SHADOW_MARGIN));
  const clip = {
    x: left,
    y: top,
    width: Math.min(viewport.width, Math.ceil(ui.right + SHADOW_MARGIN)) - left,
    height: Math.min(viewport.height, Math.ceil(ui.bottom + SHADOW_MARGIN)) - top
  };
  const png = await page.screenshot({ clip, omitBackground: true, caret: 'hide', animations: 'disabled', scale: 'device' });
  const text = (await Promise.all(parts.map((part) => part.evaluate(wordsIn)))).join(' | ');
  return { png, width: clip.width, height: clip.height, content: { x: ui.left - left, y: ui.top - top, width: ui.right - ui.left, height: ui.bottom - ui.top }, text };
};

class Session {
  private constructor(
    readonly context: BrowserContext,
    readonly storage: ExtensionStorage,
    readonly extensionId: string,
    private readonly profile: string,
    private readonly options: CaptureOptions
  ) {}

  /** Chromium on a new profile with the build loaded, once the extension has recorded its first install */
  static async open(options: CaptureOptions): Promise<Session> {
    const profile = mkdtempSync(path.join(tmpdir(), 'mpm-store-images-'));
    // A failure here closes Chromium and deletes the profile (launch.ts): the command then exits
    const { context, ready } = await launchReady({
      profile,
      launch: (directory) =>
        chromium.launchPersistentContext(directory, {
          channel: 'chromium',
          headless: options.headless,
          deviceScaleFactor: SCENE_SCALE,
          // No motion: every scene is taken at rest, the same at each run
          reducedMotion: 'reduce',
          args: [`--disable-extensions-except=${options.dist}`, `--load-extension=${options.dist}`, '--no-first-run', '--no-default-browser-check']
        }),
      ready: async (launched) => {
        for (const page of launched.pages()) {
          await page.close();
        }
        const background = await waitForBackgroundTarget(launched);
        const storage = createStorageController(background);
        await waitForFirstInstallRecords(storage);
        return { storage, extensionId: new URL(background.url()).host };
      },
      timeoutMs: EXTENSION_READY_TIMEOUT
    });
    return new Session(context, ready.storage, ready.extensionId, profile, options);
  }

  async close(): Promise<void> {
    try {
      await this.context.close();
    } finally {
      rmSync(this.profile, { recursive: true, force: true });
    }
  }

  async seed(store: Record<string, unknown>): Promise<void> {
    await this.storage.reset();
    await this.storage.seed(store);
  }

  /** A new page at `viewport` on the Platform's host, serving its composer page and nothing else */
  async openComposer(platform: ImagePlatform, theme: DemoTheme, width: number, viewport: { width: number; height: number }): Promise<Page> {
    const url = platformUrl(platform);
    const html = composerPage(this.options.root, platform, { theme, width });
    await this.context.unrouteAll();
    await this.context.route(`${url}**`, async (route) => {
      if (route.request().resourceType() === 'document') {
        await route.fulfill({ status: 200, contentType: 'text/html', body: html });
      } else {
        await route.abort();
      }
    });
    const page = await this.context.newPage();
    await page.setViewportSize(viewport);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    // The content script places the Prompts button with the Platform's anchor chain, on its Toolbar
    const button = promptsButton(page);
    await button.waitFor({ timeout: 30_000 });
    const placement = await page.locator('[data-mpm-placement]').getAttribute('data-mpm-placement', { timeout: 10_000 });
    if (placement !== 'toolbar') {
      throw new Error(`${platform}: the Prompts button is on its ${placement ?? 'unknown'} placement, not on the Toolbar`);
    }
    return page;
  }

  extensionPage(file: string): string {
    return `chrome-extension://${this.extensionId}/src/${file}`;
  }
}

/** Opens the selector by typing `lead` then `//`, as a user does, and waits for it */
const openByTyping = async (page: Page, lead: string): Promise<void> => {
  await page.locator(FIELD).click();
  await page.keyboard.type(`${lead}//`);
  await promptSelector(page).waitFor({ timeout: 30_000 });
  // The Library read and listed
  await promptSelector(page).getByRole('option').first().waitFor();
};

/**
 * Writes the `//` the user typed back at the end of the field, where it was: the selector removes
 * it as it opens, and the image shows the keys that opened it. Written in the page's DOM, with no
 * input event, so the open selector stays as it is.
 */
const showTypedTrigger = (page: Page): Promise<void> =>
  page.locator(FIELD).evaluate((field) => {
    const paragraph = field.querySelector('p') ?? field;
    const text = [...paragraph.childNodes].filter((node): node is Text => node.nodeType === Node.TEXT_NODE).at(-1);
    if (text) {
      text.data += '//';
    } else {
      paragraph.prepend('//');
    }
  });

const selectorScene = async (session: Session, theme: DemoTheme, lead: string): Promise<Scene> => {
  const page = await session.openComposer(SELECTOR_PLATFORM, theme, SELECTOR_COMPOSER_WIDTH, SELECTOR_VIEWPORT);
  await openByTyping(page, lead);
  await showTypedTrigger(page);
  const scene = await shootAround(page, [promptSelector(page), page.locator('.composer')]);
  await page.close();
  return scene;
};

/** The Variables step, then the Insertion it makes, on one page */
const variablesScenes = async (session: Session): Promise<{ variables: Scene; inserted: Scene }> => {
  const page = await session.openComposer(SELECTOR_PLATFORM, 'dark', SELECTOR_COMPOSER_WIDTH, SELECTOR_VIEWPORT);
  await openByTyping(page, '');
  await promptRow(page, VARIABLES_PROMPT.id).click();
  const selector = promptSelector(page);
  const [first, second] = Object.entries(VARIABLES_PROMPT.values);
  await selector.getByRole('textbox', { name: first[0], exact: true }).fill(first[1]);
  await selector.getByRole('textbox', { name: second[0], exact: true }).fill(second[1]);
  // The Variables step alone: the composer it opened over is hidden for this one
  const hidden = await page.addStyleTag({ content: '.stage { visibility: hidden; }' });
  const variables = await shootAround(page, [selector]);
  await hidden.evaluate((style) => { style.parentNode?.removeChild(style); });

  await selector.getByRole('button', { name: /Insert into the chat/ }).click();
  await selector.waitFor({ state: 'hidden' });
  const pill = insertionPill(page);
  await pill.waitFor();
  // The pointer on the confirmation's text holds it on screen
  const text = await boxOf(pill.locator('.mpm-inserted-text'));
  await page.mouse.move(text.x + 8, text.y + text.height / 2);
  const inserted = await shootAround(page, [page.locator('.composer'), pill]);
  await page.close();
  return { variables, inserted };
};

const platformScene = async (session: Session, platform: ImagePlatform): Promise<Scene> => {
  const page = await session.openComposer(platform, 'dark', PLATFORM_COMPOSER_WIDTH, PLATFORM_VIEWPORT);
  await page.mouse.move(1, 1);
  const scene = await shootAround(page, [page.locator('.composer')]);
  await page.close();
  return scene;
};

const libraryScene = async (session: Session): Promise<Scene> => {
  const page = await session.context.newPage();
  await page.setViewportSize(SIDE_PANEL_VIEWPORT);
  await page.goto(session.extensionPage('sidepanel.html'));
  await page.getByTestId('prompt-card').first().waitFor();
  // The pointer off every control, on the header's middle
  await page.mouse.move(SIDE_PANEL_VIEWPORT.width / 2, 4);
  const scene = await shootPage(page);
  await page.close();
  return scene;
};

const packsScene = async (session: Session): Promise<Scene> => {
  const page = await session.context.newPage();
  await page.setViewportSize(POPUP_VIEWPORT);
  await page.goto(session.extensionPage('popup.html'));
  await page.locator('[data-testid="welcome"][data-welcome-step="2"]').waitFor();
  await page.mouse.move(POPUP_VIEWPORT.width / 2, 4);
  const scene = await shootPage(page);
  await page.close();
  return scene;
};

/** Takes every scene, from one browser on a fresh profile, which it deletes after */
export async function captureScenes(options: CaptureOptions, now: number): Promise<Scenes> {
  const session = await Session.open(options);
  const take = <T>(name: string, scene: () => Promise<T>): Promise<T> => {
    options.onScene?.(name);
    return scene();
  };
  try {
    await session.seed(demoStore(now, 'dark', options.version));
    const selectorDark = await take('the Prompt selector opened by //, dark', () => selectorScene(session, 'dark', 'Summarize this thread for '));
    const { variables, inserted } = await take('the Variables step and the Insertion with Undo', () => variablesScenes(session));
    const platforms: { platform: ImagePlatform; scene: Scene }[] = [];
    for (const platform of IMAGE_PLATFORMS) {
      platforms.push({ platform, scene: await take(`the Prompts button on ${platform}`, () => platformScene(session, platform)) });
    }
    // Seeded again: the Insertion above counted a use
    await session.seed(demoStore(now, 'dark', options.version));
    const library = await take('the side panel Library', () => libraryScene(session));

    await session.seed(demoStore(now, 'light', options.version));
    const selectorLight = await take('the Prompt selector opened by //, light', () => selectorScene(session, 'light', ''));

    await session.seed(packsStore('dark', options.version));
    const packs = await take("the Welcome's Packs step", () => packsScene(session));
    return { selectorDark, selectorLight, variables, inserted, platforms, library, packs };
  } finally {
    await session.close();
  }
}
