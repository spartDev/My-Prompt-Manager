/**
 * The Platform pages the store images are taken on: each Platform's composer fixture
 * (tests/fixtures/composers/<platform>.html, captured from the live site by npm run
 * composers:capture), served on the Platform's own host as the e2e suite does, so the extension's
 * real content script places its Prompts button there by the Platform's anchor chain and opens the
 * real Prompt selector. The fixtures keep the structure only, no text, icon or logo: this page lays
 * them out as a plain composer, in neutral colors, with generic glyphs on the Platform's buttons.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { SUPPORTED_PLATFORMS } from '../../src/config/platforms';

import type { DemoTheme } from './demoLibrary';

/** The Platforms the images name, in the order of the Platforms image */
export const IMAGE_PLATFORMS = ['claude', 'chatgpt', 'gemini', 'mistral', 'perplexity', 'copilot'] as const;
export type ImagePlatform = (typeof IMAGE_PLATFORMS)[number];

/** The name each one goes by in the images: as the listing's copy names them, in text only */
export const PLATFORM_LABELS: Record<ImagePlatform, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  mistral: 'Mistral',
  perplexity: 'Perplexity',
  copilot: 'Copilot'
};

/** Where each Platform's page is served: its own host, where the manifest runs the content script */
export const platformUrl = (platform: ImagePlatform): string => `https://${SUPPORTED_PLATFORMS[platform].hostname}/`;

type Glyph = 'plus' | 'mic' | 'send' | 'tune' | 'wave' | 'hide';

/**
 * What each of the Platform's own controls shows, by selector inside the composer: a generic glyph,
 * or nothing (`hide`) for a control whose look is its text or its brand (a model or mode switch).
 * The controls the anchor chain finds keep their place, so the Prompts button lands where it does
 * on the live site.
 */
const GLYPHS: Record<ImagePlatform, readonly (readonly [string, Glyph])[]> = {
  claude: [
    ['[data-testid="chat-input-attach"]', 'plus'],
    ['[data-testid="composer-dictate"] button:first-child', 'mic'],
    ['[data-testid="composer-dictate"] button:not(:first-child)', 'hide'],
    ['[data-testid="chat-input-send"]', 'send'],
    ['[data-testid="chat-input-send"] ~ button', 'hide'],
    [':scope > div > div:nth-child(2)', 'hide']
  ],
  chatgpt: [
    ['fieldset > div > button', 'plus'],
    ['fieldset > div > div > button:not([aria-label])', 'hide'],
    ['button[aria-label="dictate"]', 'mic'],
    ['button[aria-label="voice"]', 'wave']
  ],
  gemini: [
    ['simplified-input-menu button', 'plus'],
    ['bard-mode-switcher', 'hide'],
    ['speech-dictation-mic-button button', 'mic']
  ],
  mistral: [
    ['button[aria-label="settings"]', 'tune'],
    ['button[type="submit"]', 'hide'],
    ['form > div > div:last-child > button:not([aria-label])', 'plus'],
    ['button[aria-label="voice"]', 'mic']
  ],
  perplexity: [
    ['[contenteditable] + div > button', 'plus'],
    ['[data-testid="ask-input-mode-toggle-indicator"]', 'hide'],
    ['[data-testid="ask-input-mode-toggle-indicator"] ~ button', 'hide'],
    ['button[aria-label="model"]', 'hide'],
    ['button[aria-label="dictation"]', 'mic'],
    ['button[aria-label="dictation"] + button', 'send']
  ],
  copilot: [
    ['textarea + div > button:not([data-testid])', 'plus'],
    ['button[data-testid="audio-call-button"]', 'mic']
  ]
};

/** The glyphs, drawn as masks in the composer's text color: generic shapes, no Platform's icon */
const GLYPH_SVG: Record<Exclude<Glyph, 'hide'>, string> = {
  plus: '<path d="M12 5v14M5 12h14" stroke="#000" stroke-width="2" stroke-linecap="round"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3" fill="#000"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke="#000" stroke-width="2" fill="none" stroke-linecap="round"/>',
  send: '<path d="M12 19V5M6 11l6-6 6 6" stroke="#000" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  tune: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="#000" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="7" r="2.2" stroke="#000" stroke-width="2" fill="none"/><circle cx="10" cy="17" r="2.2" stroke="#000" stroke-width="2" fill="none"/>',
  wave: '<path d="M6 10v4M10 7v10M14 9v6M18 11v2" stroke="#000" stroke-width="2.2" stroke-linecap="round"/>'
};

const maskOf = (glyph: Exclude<Glyph, 'hide'>): string =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${GLYPH_SVG[glyph]}</svg>`)}")`;

const PALETTE: Record<DemoTheme, { card: string; line: string; ink: string; muted: string; solid: string; onSolid: string }> = {
  dark: { card: '#211b2d', line: '#372e4a', ink: '#ece8f5', muted: '#8f86a6', solid: '#ece8f5', onSolid: '#211b2d' },
  light: { card: '#ffffff', line: '#e2dcef', ink: '#1d1530', muted: '#8a82a0', solid: '#1d1530', onSolid: '#ffffff' }
};

/** The composer fixture of `platform`, without its header comment */
export const composerFixture = (root: string, platform: ImagePlatform): string =>
  readFileSync(path.join(root, 'tests', 'fixtures', 'composers', `${platform}.html`), 'utf8').replace(/^\s*<!--[\s\S]*?-->\s*/, '');

export interface ComposerPageOptions {
  theme: DemoTheme;
  /** The composer's width, in CSS px */
  width: number;
  /** Text the field holds when the page opens, if any */
  placeholder?: string;
}

/**
 * The page served at the Platform's host: its composer fixture, at the bottom left of a
 * transparent page, laid out by a script that runs before the content script (which runs at
 * document_idle). Screenshots of it keep the transparency, so the image's ground shows around the
 * composer and under the shadows.
 */
export function composerPage(root: string, platform: ImagePlatform, options: ComposerPageOptions): string {
  const colors = PALETTE[options.theme];
  const glyphs = GLYPHS[platform];
  const placeholder = options.placeholder ?? 'Ask anything';
  return /* html */ `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${PLATFORM_LABELS[platform]}</title>
    <style>
      html, body { margin: 0; background: transparent; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; color: ${colors.ink}; }
      .stage { position: absolute; left: 40px; bottom: 40px; width: ${String(options.width)}px; }
      .composer {
        box-sizing: border-box; background: ${colors.card}; border: 1px solid ${colors.line}; border-radius: 24px;
        padding: 0 12px 12px; box-shadow: 0 22px 44px -22px rgba(0, 0, 0, ${options.theme === 'dark' ? '.8' : '.28'}), 0 2px 6px rgba(0, 0, 0, .08);
      }
      :where(.composer :is(div, span, form, fieldset, p:not([contenteditable] p), input-area-v2, simplified-input-menu, gem-icon-button, rich-textarea,
        bard-mode-switcher, speech-dictation-mic-button, toolbox-drawer, at-mentions-menu-v2):not([data-prompt-library-icon], [data-prompt-library-icon] *)) {
        display: flex; align-items: center; gap: 8px; min-width: 0; margin: 0; padding: 0; border: 0;
      }
      :where(.composer .mpm-row) { flex-wrap: wrap; width: 100%; }
      :where(.composer .mpm-row > .mpm-branch) { order: -1; flex: 1 0 100%; }
      :where(.composer .mpm-bar) { flex: 1 1 100%; }
      /* A single control row: its first control at the start, the others at the end */
      .composer .mpm-bar > :first-child { order: -2; }
      .composer .mpm-bar::before { content: ''; order: -1; flex: 1 1 auto; }
      /* Over the buttons' own reset below: these place them */
      .composer .mpm-end { margin-left: auto; }
      :where(.composer [contenteditable], .composer textarea) {
        all: unset; display: block; position: relative; box-sizing: border-box; width: 100%; min-height: 64px; padding: 18px 8px 8px;
        font: inherit; font-size: 17px; line-height: 1.45; color: ${colors.ink}; white-space: pre-wrap; outline: none; resize: none;
      }
      :where(.composer textarea) { height: 64px; }
      :where(.composer [contenteditable] p) { margin: 0; }
      .composer [contenteditable][data-empty]::before { content: '${placeholder}'; position: absolute; left: 8px; top: 18px; color: ${colors.muted}; pointer-events: none; }
      .composer textarea::placeholder { color: ${colors.muted}; }
      :where(.composer button:not([data-prompt-library-icon])) {
        all: unset; box-sizing: border-box; flex: none; width: 34px; height: 34px; border-radius: 999px; border: 1px solid ${colors.line};
        background: transparent; position: relative;
      }
      .composer [data-glyph]::after { content: ''; position: absolute; inset: 7px; background: ${colors.ink}; -webkit-mask: var(--glyph) center / contain no-repeat; }
      .composer [data-glyph="send"] { background: ${colors.solid}; border-color: ${colors.solid}; }
      .composer [data-glyph="send"]::after, .composer [data-glyph="wave"]::after { background: ${colors.onSolid}; }
      .composer [data-glyph="wave"] { background: ${colors.solid}; border-color: ${colors.solid}; }
      ${(['plus', 'mic', 'send', 'tune', 'wave'] as const).map((glyph) => `.composer [data-glyph="${glyph}"] { --glyph: ${maskOf(glyph)}; }`).join('\n      ')}
      .composer [data-glyph="hide"], .composer span[role="status"]:empty, .composer toolbox-drawer:empty, .composer at-mentions-menu-v2:empty { display: none; }
    </style>
  </head>
  <body>
    <div class="stage"><div class="composer">${composerFixture(root, platform)}</div></div>
    <script>
      (() => {
        const composer = document.querySelector('.composer');
        const field = composer.querySelector('[contenteditable="true"], textarea');
        if (field instanceof HTMLTextAreaElement) {
          field.placeholder = ${JSON.stringify(placeholder)};
        } else {
          // The placeholder shows while the field holds no text, however the text got there
          const mark = () => { field.toggleAttribute('data-empty', (field.textContent ?? '') === ''); };
          new MutationObserver(mark).observe(field, { childList: true, characterData: true, subtree: true });
          mark();
        }
        // The field's branch on the first row of each container it is in; what follows it wraps below:
        // one control row spans the width, several sit at the start and the end
        for (let node = field; node && node !== composer; node = node.parentElement) {
          node.classList.add('mpm-branch');
          const row = node.parentElement;
          if (!row || row === composer) { break; }
          row.classList.add('mpm-row');
          const others = [...row.children].filter((child) => child !== node);
          if (others.length === 1) { others[0].classList.add('mpm-bar'); }
          if (others.length > 1) { others[others.length - 1].classList.add('mpm-end'); }
        }
        const glyphs = ${JSON.stringify(glyphs)};
        for (const [selector, glyph] of glyphs) {
          for (const element of composer.firstElementChild.parentElement.querySelectorAll(selector)) {
            element.setAttribute('data-glyph', glyph);
          }
        }
      })();
    </script>
  </body>
</html>`;
}
