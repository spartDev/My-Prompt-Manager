/**
 * Styles utility module for the content script
 * Handles CSS injection and style management
 */

import { SELECTOR_FONT_FAMILY } from "../selector/font";
import { DURATION, EASE } from "../selector/motion";

import { debug, error as logError } from "./logger";

const STYLE_ID = "prompt-library-styles";

/**
 * Inject CSS styles into the document head
 * Only injects once per page load
 */
export function injectCSS(): void {
  try {
    // Check if styles are already injected
    if (document.getElementById(STYLE_ID)) {
      debug("CSS styles already injected, skipping");
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = getCSS();

    document.head.appendChild(style);
    debug("CSS styles injected successfully");
  } catch (err) {
    logError("Failed to inject CSS styles", err as Error);
  }
}

/**
 * Get the CSS string for the prompt library
 * @returns The complete CSS string
 */
export function getCSS(): string {
  return `
    /*
      The Prompts button, the only thing the extension styles in the Platform's own page: the Prompt
      selector it opens has its stylesheet inside its shadow root (src/content/selector/selectorStyles.ts).

      Color tokens: the popup's semantic tokens (src/theme/tokens.css) under the same names, declared on
      the button so the Platform's styles cannot reach them. Light values here, dark values on
      .dark-theme (set by ThemeManager from the extension's theme). Every rule below reads them through
      var(): no color is written anywhere else in this file.
    */
    .prompt-library-pill {
      --background-color-accent: #6d28d9;
      --background-color-accent-selected: #ede5ff;
      --background-color-accent-subtle: #f1ebfd;
      --text-color-accent: #5b21b6;
      --text-color-on-accent: #ffffff;
    }

    .prompt-library-pill.dark-theme {
      --background-color-accent: #844bf2;
      --background-color-accent-selected: #38296a;
      --background-color-accent-subtle: #2f2350;
      --text-color-accent: #c4b5fd;
      --text-color-on-accent: #ffffff;
    }

    /*
      A pill of 32px: the extension's badge and the label "Prompts". all: initial drops what the
      Platform's button rules and Chrome's default button look would give it.
    */
    .prompt-library-pill {
      all: initial;
      box-sizing: border-box;
      flex: none;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      height: 32px;
      padding: 0 12px 0 6px;
      border: 0;
      border-radius: 999px;
      background: var(--background-color-accent-subtle);
      color: var(--text-color-accent);
      font-family: '${SELECTOR_FONT_FAMILY}', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
      font-size: 13px;
      font-weight: 700;
      line-height: 1;
      white-space: nowrap;
      vertical-align: middle;
      cursor: pointer;
      user-select: none;
      transition: background ${String(DURATION.button)}ms, color ${String(DURATION.button)}ms, transform 250ms ${EASE.spring};
    }

    .prompt-library-pill:hover {
      background: var(--background-color-accent-selected);
    }

    /* The Prompt selector is open */
    .prompt-library-pill[aria-expanded="true"] {
      background: var(--background-color-accent);
      color: var(--text-color-on-accent);
    }

    .prompt-library-pill:active {
      transform: scale(0.92);
    }

    .prompt-library-pill:focus-visible {
      outline: 2px solid var(--background-color-accent);
      outline-offset: 2px;
    }

    .prompt-library-pill-badge {
      flex: none;
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--background-color-accent);
      color: var(--text-color-on-accent);
    }

    .prompt-library-pill-badge svg {
      display: block;
      width: 12px;
      height: 12px;
      fill: currentColor;
    }

    /*
      The badge alone: when the Platform's bar has no room for the label, and for a button laid over
      the page (custom sites), whose place was chosen for a 32px button
    */
    .prompt-library-pill.prompt-library-pill-compact,
    .prompt-library-pill.prompt-library-icon-absolute {
      gap: 0;
      padding: 0 5px;
    }

    .prompt-library-pill.prompt-library-pill-compact .prompt-library-pill-label,
    .prompt-library-pill.prompt-library-icon-absolute .prompt-library-pill-label {
      display: none;
    }

    /* Absolute positioned button (custom sites, fallback absolute positioning) */
    .prompt-library-pill.prompt-library-icon-absolute {
      position: absolute;
      z-index: 999999;
    }

    /* Relative positioned button (custom sites, inserted in the page) */
    .prompt-library-pill.prompt-library-icon-relative {
      position: relative;
      z-index: 10;
    }

    @media (prefers-reduced-motion: reduce) {
      .prompt-library-pill {
        transition-duration: 1ms;
      }
    }
  `;
}

/**
 * Remove injected styles from the document
 * Useful for cleanup or testing
 */
export function removeCSS(): void {
  try {
    const existingStyle = document.getElementById(STYLE_ID);
    if (existingStyle) {
      existingStyle.remove();
      debug("CSS styles removed successfully");
    }
  } catch (err) {
    logError("Failed to remove CSS styles", err as Error);
  }
}

/**
 * Check if styles are already injected
 * @returns True if styles are already present
 */
export function isInjected(): boolean {
  return document.getElementById(STYLE_ID) !== null;
}
