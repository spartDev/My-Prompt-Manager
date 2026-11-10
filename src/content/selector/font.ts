/**
 * Schibsted Grotesk for the Prompt selector and the Prompts button, loaded from the extension
 * package (never from a CDN: a Platform's Content Security Policy would refuse it).
 *
 * @font-face cannot be declared inside a shadow root, so the font is registered on the document,
 * under a family name of its own that cannot collide with a font of the Platform. It is read as
 * bytes and handed to the FontFace API, so the Platform's font-src policy has no URL to refuse.
 * When loading fails, the font stack falls back to the system font.
 */

import { debug } from '../utils/logger';

export const SELECTOR_FONT_FAMILY = 'MPM Schibsted Grotesk';

const FONT_PATH = 'fonts/SchibstedGrotesk-latin.woff2';

let loading: Promise<boolean> | null = null;

/** Registers the font once per page. Resolves to whether the font is available; never rejects. */
export function loadSelectorFont(): Promise<boolean> {
  loading ??= (async () => {
    try {
      const response = await fetch(chrome.runtime.getURL(FONT_PATH));
      if (!response.ok) {
        throw new Error(`HTTP ${String(response.status)}`);
      }
      const face = new FontFace(SELECTOR_FONT_FAMILY, await response.arrayBuffer(), { weight: '400 900', style: 'normal' });
      await face.load();
      document.fonts.add(face);
      return true;
    } catch (err) {
      debug('Selector font not loaded, falling back to the system font', {
        error: err instanceof Error ? err.message : String(err)
      });
      return false;
    }
  })();
  return loading;
}
