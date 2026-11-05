/**
 * Styles utility module for the content script
 * Handles CSS injection and style management
 */

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
      Color tokens: the popup's semantic tokens (src/theme/tokens.css, epic My-Prompt-Manager-el4) under
      the same names, declared on the selector so the host page's styles cannot reach them. Light values
      here, dark values on .dark-theme (set by ThemeManager from the extension's theme). Every rule below
      reads them through var(): no color is written anywhere else in this file.
    */
    .prompt-library-selector {
      --background-color-card: #ffffff;
      --background-color-subtle: #f4f1fa;
      --background-color-muted: #f1edf8;
      --background-color-accent: #6d28d9;
      --background-color-accent-hover: #5b21b6;
      --background-color-accent-selected: #ede5ff;
      --text-color-primary: #1d1530;
      --text-color-secondary: #5c5370;
      --text-color-tertiary: #6f6787;
      --text-color-on-accent: #ffffff;
      --text-color-accent-strong: #4c1d95;
      --border-color-default: #ece6f5;
      --border-color-divider: #f0ebf8;
      --border-color-strong: #dcd4ea;
      --border-color-input: #8f87a5;
      --border-color-accent: #c4b5fd;
      --shadow-tint-10: rgba(45, 25, 90, 0.1);
      --shadow-xl: 0 20px 25px -5px var(--shadow-tint-10), 0 8px 10px -6px var(--shadow-tint-10);
    }

    .prompt-library-selector.dark-theme {
      --background-color-card: #231c34;
      --background-color-subtle: #2b2340;
      --background-color-muted: #2e2645;
      --background-color-accent: #844bf2;
      --background-color-accent-hover: #7a40e3;
      --background-color-accent-selected: #38296a;
      --text-color-primary: #f1edf9;
      --text-color-secondary: #bcb3d0;
      --text-color-tertiary: #a39abb;
      --text-color-on-accent: #ffffff;
      --text-color-accent-strong: #ddd3fe;
      --border-color-default: #352c4c;
      --border-color-divider: #2f2744;
      --border-color-strong: #41375a;
      --border-color-input: #766c8e;
      --border-color-accent: #6d4fc4;
      --shadow-tint-10: rgba(0, 0, 0, 0.16);
    }

    /*
      The floating icon (custom sites) sits on the host page, not on the selector: it follows the page's
      own dark mode (.dark on an ancestor). Hover is the popup's bg-muted on a light page, a white veil on
      a dark one; the focus ring is the accent of the matching mode.
    */
    .prompt-library-icon-base {
      --prompt-library-icon-hover: #f1edf8;
      --prompt-library-icon-ring: #6d28d9;
    }

    .prompt-library-icon-base:is(.dark *) {
      --prompt-library-icon-hover: rgba(255, 255, 255, 0.08);
      --prompt-library-icon-ring: #844bf2;
    }

    /* Base Prompt Manager Icon Styles */
    .prompt-library-icon-base {
      min-width: 32px;
      min-height: 32px;
      border-radius: .5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    /* Absolute positioned prompt library icon (for fallback absolute positioning) */
    .prompt-library-icon-absolute {
      position: absolute;
      z-index: 999999;
    }

    /* Relative positioned prompt library icon (for DOM-inserted icons) */
    .prompt-library-icon-relative {
      position: relative;
      z-index: 10;
    }

    .prompt-library-icon-base:hover {
      background: var(--prompt-library-icon-hover);
    }

    .prompt-library-icon-base:focus-visible {
      outline: 2px solid var(--prompt-library-icon-ring);
      outline-offset: 2px;
    }

    .prompt-library-icon-base svg {
      color: currentColor;
      width: 18px;
      height: 18px;
      /* Ensure perfect centering within the 32px container */
      display: block;
      margin: auto;
    }

    /* Prompt Selector Modal: one opaque card */
    .prompt-library-selector {
      position: absolute;
      width: 400px;
      max-height: 500px;
      background: var(--background-color-card);
      color: var(--text-color-primary);
      border: 1px solid var(--border-color-default);
      border-radius: 12px;
      box-shadow: var(--shadow-xl);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 1000000;
      overflow: hidden;
      animation: promptSelectorFadeIn 0.2s ease-out;
      transition: top 0.15s ease-out, left 0.15s ease-out;
    }

    @keyframes promptSelectorFadeIn {
      from {
        opacity: 0;
        transform: translateY(-8px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* Positioning classes for adaptive popup placement */
    .prompt-library-selector.positioned-above {
      transform-origin: bottom center;
    }

    .prompt-library-selector.positioned-below {
      transform-origin: top center;
    }

    .prompt-library-selector.positioned-above {
      animation: promptSelectorFadeInAbove 0.2s ease-out;
    }

    @keyframes promptSelectorFadeInAbove {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .prompt-selector-header {
      padding: 16px;
      border-bottom: 1px solid var(--border-color-divider);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .prompt-selector-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-primary);
    }

    .close-selector {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: var(--text-color-tertiary);
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }

    .close-selector:hover {
      background: var(--background-color-muted);
      color: var(--text-color-primary);
    }

    .close-selector:focus-visible {
      outline: 2px solid var(--background-color-accent);
      outline-offset: 2px;
    }

    .prompt-search {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color-divider);
    }

    /* Fields on a card: bg-subtle, border-input; focused: accent border and ring (focus-input) */
    .search-input,
    .prompt-variable-input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--border-color-input);
      border-radius: 6px;
      font-size: 14px;
      outline: none;
      box-sizing: border-box;
      background: var(--background-color-subtle);
      color: var(--text-color-primary);
    }

    .search-input::placeholder,
    .prompt-variable-input::placeholder {
      color: var(--text-color-tertiary);
      opacity: 1;
    }

    .search-input:focus,
    .prompt-variable-input:focus {
      border-color: var(--background-color-accent);
      box-shadow: 0 0 0 2px var(--background-color-accent);
    }

    .prompt-list {
      max-height: 350px;
      overflow-y: auto;
    }

    .prompt-item {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color-divider);
      cursor: pointer;
      transition: background-color 0.15s ease;
      border-radius: 4px;
      margin: 2px 8px;
      position: relative;
    }

    .prompt-item:hover {
      background: var(--background-color-muted);
    }

    .prompt-item:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px var(--background-color-accent);
    }

    /* The keyboard-selected Prompt: a chosen item among several */
    .prompt-item.keyboard-selected {
      background: var(--background-color-accent-selected);
      box-shadow: inset 0 0 0 1px var(--border-color-accent);
    }

    .prompt-item:last-child {
      border-bottom: none;
    }

    .prompt-title {
      font-weight: 600;
      color: var(--text-color-primary);
      font-size: 14px;
      margin-bottom: 4px;
    }

    .prompt-item.keyboard-selected .prompt-title {
      color: var(--text-color-accent-strong);
    }

    /*
      Category chip: the chip rule of the Category's color (getSoftBadgeColors), set on the chip by the
      content script as --prompt-category-bg, --prompt-category-text and --prompt-category-text-dark
    */
    .prompt-category {
      font-size: 12px;
      font-weight: 600;
      color: var(--prompt-category-text, var(--text-color-secondary));
      background: var(--prompt-category-bg, var(--background-color-subtle));
      padding: 2px 8px;
      border-radius: 12px;
      display: inline-block;
      margin-bottom: 6px;
    }

    .prompt-library-selector.dark-theme .prompt-category {
      color: var(--prompt-category-text-dark, var(--text-color-secondary));
    }

    .prompt-preview {
      font-size: 13px;
      color: var(--text-color-tertiary);
      line-height: 1.4;
    }

    .no-prompts {
      padding: 32px 16px;
      text-align: center;
      color: var(--text-color-tertiary);
      font-style: italic;
    }

    /* Variable fill-in form (Prompt with {{name}} Variables) */
    .prompt-variables-form {
      padding: 12px 16px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 350px;
      overflow-y: auto;
      box-sizing: border-box;
    }

    .prompt-variable-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .prompt-variable-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-color-secondary);
      overflow-wrap: anywhere;
    }

    .prompt-variables-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 4px;
    }

    .prompt-variables-skip,
    .prompt-variables-submit {
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
    }

    /* Insert as is: the secondary button */
    .prompt-variables-skip {
      background: var(--background-color-card);
      border-color: var(--border-color-strong);
      color: var(--text-color-secondary);
    }

    .prompt-variables-skip:hover {
      background: var(--background-color-muted);
    }

    /* Insert: the primary button */
    .prompt-variables-submit {
      background: var(--background-color-accent);
      color: var(--text-color-on-accent);
    }

    .prompt-variables-submit:hover {
      background: var(--background-color-accent-hover);
    }

    .prompt-variables-skip:focus-visible,
    .prompt-variables-submit:focus-visible {
      outline: 2px solid var(--background-color-accent);
      outline-offset: 2px;
    }

    /* Responsive design */
    @media (max-width: 480px) {
      .prompt-library-selector {
        width: calc(100vw - 40px);
        right: 20px !important;
      }
    }

    /* Screen reader only content */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
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
