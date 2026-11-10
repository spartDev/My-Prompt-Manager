/**
 * Stylesheet of the Prompt selector. It lives inside the selector's shadow root (ADR-002), so no
 * rule here reaches the Platform and none of the Platform's reaches the selector.
 *
 * Color tokens: the popup's semantic tokens (src/theme/tokens.css) under the same names, light on
 * :host and dark on :host([data-theme="dark"]), set from the extension's theme. Every rule reads
 * them through var(): no color is written anywhere else in this file. A Category's own color is
 * user data, set inline on its dot.
 */

import { SELECTOR_FONT_FAMILY } from './font';
import { DURATION, EASE } from './motion';

/** The stylesheet put in the selector's shadow root. */
export function getSelectorCSS(): string {
  return `
    :host {
      --background-color-card: #ffffff;
      --background-color-subtle: #f4f1fa;
      --background-color-muted: #f1edf8;
      --background-color-inverse: #1d1530;
      --background-color-accent: #6d28d9;
      --background-color-accent-hover: #5b21b6;
      --background-color-accent-selected: #ede5ff;
      --background-color-accent-subtle: #f1ebfd;
      --text-color-primary: #1d1530;
      --text-color-secondary: #5c5370;
      --text-color-tertiary: #6f6787;
      --text-color-on-accent: #ffffff;
      --text-color-accent: #5b21b6;
      --text-color-accent-strong: #4c1d95;
      --text-color-pin: #d97706;
      --border-color-default: #ece6f5;
      --border-color-divider: #f0ebf8;
      --border-color-accent: #c4b5fd;
      --scrollbar-color-thumb: #8b5cf6;
      --shadow-selector: 0 30px 60px -24px rgba(45, 25, 90, 0.5);
      --text-color-on-inverse-strong: #ffffff;
      --background-color-inverse-mark: #a78bfa;
      --background-color-inverse-action: rgba(255, 255, 255, 0.14);
      --background-color-inverse-bar: rgba(255, 255, 255, 0.22);
      --shadow-toast: 0 14px 30px -12px rgba(29, 21, 48, 0.6);
    }

    :host([data-theme="dark"]) {
      --background-color-card: #231c34;
      --background-color-subtle: #2b2340;
      --background-color-muted: #2e2645;
      --background-color-inverse: #4a3d6b;
      --background-color-accent: #844bf2;
      --background-color-accent-hover: #7a40e3;
      --background-color-accent-selected: #38296a;
      --background-color-accent-subtle: #2f2350;
      --text-color-primary: #f1edf9;
      --text-color-secondary: #bcb3d0;
      --text-color-tertiary: #a39abb;
      --text-color-on-accent: #ffffff;
      --text-color-accent: #c4b5fd;
      --text-color-accent-strong: #ddd3fe;
      --text-color-pin: #fbbf24;
      --border-color-default: #352c4c;
      --border-color-divider: #2f2744;
      --border-color-accent: #6d4fc4;
      --scrollbar-color-thumb: #8b5cf6;
      --shadow-selector: 0 30px 60px -24px rgba(4, 2, 10, 0.85);
      --text-color-on-inverse-strong: #ffffff;
      --background-color-inverse-mark: #a78bfa;
      --background-color-inverse-action: rgba(255, 255, 255, 0.14);
      --background-color-inverse-bar: rgba(255, 255, 255, 0.22);
      --shadow-toast: 0 14px 30px -12px rgba(0, 0, 0, 0.6);
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    button {
      margin: 0;
      border: 0;
      font: inherit;
      cursor: pointer;
    }

    button:focus-visible {
      outline: 2px solid var(--background-color-accent);
      outline-offset: 2px;
    }

    /* The popover: one opaque card above (or below) the input field */
    .mpm-popover {
      --mpm-shift: 14px;
      --mpm-shift-out: 10px;
      position: fixed;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      pointer-events: auto;
      outline: none;
      border: 1px solid var(--border-color-default);
      border-radius: 22px;
      background: var(--background-color-card);
      box-shadow: var(--shadow-selector);
      color: var(--text-color-primary);
      font-family: '${SELECTOR_FONT_FAMILY}', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
      font-size: 13.5px;
      font-weight: 400;
      line-height: 1.3;
      text-align: left;
      transform-origin: bottom left;
      animation: mpm-pick ${String(DURATION.open)}ms ${EASE.spring} both;
    }

    .mpm-popover[data-side="below"] {
      --mpm-shift: -14px;
      --mpm-shift-out: -10px;
      transform-origin: top left;
    }

    .mpm-popover[data-closing="true"] {
      animation: mpm-pick-out ${String(DURATION.close)}ms ease both;
    }

    @keyframes mpm-pick {
      from { opacity: 0; transform: translateY(var(--mpm-shift)) scale(0.92); }
      to { opacity: 1; transform: none; }
    }

    @keyframes mpm-pick-out {
      from { opacity: 1; transform: none; }
      to { opacity: 0; transform: translateY(var(--mpm-shift-out)) scale(0.95); }
    }

    @keyframes mpm-up {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: none; }
    }

    /* Header: the title, or the search field once the user types, and the close button */
    .mpm-header {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 52px;
      padding: 14px 12px 10px 16px;
    }

    .mpm-title {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
    }

    .mpm-search {
      flex: 1;
      min-width: 0;
      height: 28px;
      padding: 0;
      border: 0;
      outline: none;
      background: transparent;
      color: var(--text-color-primary);
      font: inherit;
      font-size: 15px;
      font-weight: 700;
      caret-color: var(--background-color-accent);
    }

    /* Not searching: the field keeps the focus but takes no room, and the title shows */
    .mpm-search[data-collapsed="true"] {
      position: absolute;
      width: 0;
      height: 0;
      opacity: 0;
    }

    .mpm-close {
      flex: none;
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border-radius: 50%;
      background: var(--background-color-subtle);
      color: var(--text-color-secondary);
    }

    .mpm-close:hover {
      background: var(--background-color-muted);
      color: var(--text-color-primary);
    }

    .mpm-close svg {
      width: 12px;
      height: 12px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.8;
      stroke-linecap: round;
    }

    /* Tabs: All, Pinned, Recent, then every Category; the row scrolls sideways */
    .mpm-tabs {
      flex: none;
      display: flex;
      gap: 6px;
      padding: 0 14px 10px;
      overflow-x: auto;
      scrollbar-width: none;
      transition: opacity ${String(DURATION.tab)}ms;
    }

    .mpm-tabs::-webkit-scrollbar {
      display: none;
    }

    /* While searching, the list is no longer that of a tab */
    .mpm-tabs[data-dimmed="true"] {
      opacity: 0.55;
    }

    .mpm-tab {
      flex: none;
      display: flex;
      align-items: center;
      gap: 6px;
      max-width: 180px;
      height: 30px;
      padding: 0 12px 0 10px;
      border-radius: 999px;
      background: var(--background-color-subtle);
      color: var(--text-color-secondary);
      font-size: 12.5px;
      font-weight: 700;
      white-space: nowrap;
      transition: background ${String(DURATION.tab)}ms, color ${String(DURATION.tab)}ms;
    }

    .mpm-tab[aria-selected="true"] {
      background: var(--background-color-inverse);
      color: var(--text-color-on-accent);
    }

    .mpm-tab-label {
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mpm-dot {
      flex: none;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-color-tertiary);
    }

    .mpm-dot[data-dot="pinned"] {
      background: var(--text-color-pin);
    }

    .mpm-dot[data-dot="recent"] {
      background: var(--background-color-accent);
    }

    /* The list of Prompts */
    .mpm-list {
      flex: 0 1 auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-height: 0;
      max-height: 230px;
      padding: 0 10px 10px;
      overflow-y: auto;
      outline: none;
      scrollbar-width: thin;
      scrollbar-color: var(--scrollbar-color-thumb) transparent;
    }

    .mpm-row {
      flex: none;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px;
      border: 1.5px solid var(--border-color-divider);
      border-radius: 14px;
      background: var(--background-color-card);
      cursor: pointer;
      transition: background 150ms, border-color 150ms;
      animation: mpm-up ${String(DURATION.row)}ms ${EASE.spring} both;
    }

    .mpm-row[aria-selected="true"] {
      border-color: var(--border-color-accent);
      background: var(--background-color-accent-subtle);
    }

    .mpm-row-title {
      overflow: hidden;
      font-size: 13.5px;
      font-weight: 700;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .mpm-row-meta {
      display: flex;
      align-items: center;
      gap: 5px;
      min-width: 0;
      font-size: 11.5px;
    }

    .mpm-row-category {
      overflow: hidden;
      color: var(--text-color-tertiary);
      font-weight: 600;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .mpm-row-variables {
      flex: none;
      margin-left: 2px;
      color: var(--text-color-accent);
      font-weight: 700;
    }

    .mpm-empty {
      padding: 16px;
      color: var(--text-color-tertiary);
      font-size: 13px;
      text-align: center;
    }

    /* Footer: the keyboard hint */
    .mpm-footer {
      flex: none;
      padding: 8px 16px 12px;
      border-top: 1px solid var(--border-color-divider);
      color: var(--text-color-tertiary);
      font-size: 11.5px;
    }

    /* The variables step: the Prompt's text with a field in place of each Variable */
    .mpm-fill {
      display: flex;
      flex-direction: column;
      min-height: 0;
      animation: mpm-left ${String(DURATION.step)}ms ${EASE.sheet} both;
    }

    @keyframes mpm-left {
      from { opacity: 0; transform: translateX(26px); }
      to { opacity: 1; transform: none; }
    }

    .mpm-fill-header {
      flex: none;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 12px 14px 4px 8px;
    }

    .mpm-back {
      flex: none;
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      padding: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--text-color-secondary);
    }

    .mpm-back:hover {
      background: var(--background-color-subtle);
    }

    .mpm-back svg {
      width: 17px;
      height: 17px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .mpm-fill-title {
      flex: 1;
      min-width: 0;
      margin: 0;
      overflow: hidden;
      font-size: 14px;
      font-weight: 800;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .mpm-fill-text {
      flex: 0 1 auto;
      min-height: 0;
      max-height: 220px;
      margin: 0;
      padding: 6px 16px 4px;
      overflow-y: auto;
      font-size: 13.5px;
      line-height: 2;
      white-space: pre-wrap;
      word-break: break-word;
      scrollbar-width: thin;
      scrollbar-color: var(--scrollbar-color-thumb) transparent;
    }

    /* A Variable left empty: dashed underline. Filled in: solid accent underline, deeper ground */
    .mpm-variable {
      display: inline-block;
      box-sizing: content-box;
      max-width: calc(100% - 16px);
      height: 25px;
      margin: 0 2px;
      padding: 0 6px;
      border: 0;
      border-bottom: 2px dashed var(--border-color-accent);
      border-radius: 7px 7px 3px 3px;
      outline: none;
      background: var(--background-color-accent-subtle);
      color: var(--text-color-accent-strong);
      font: inherit;
      font-size: 13px;
      font-weight: 700;
      vertical-align: baseline;
      transition: background ${String(DURATION.tab)}ms, border-color ${String(DURATION.tab)}ms, width 200ms;
    }

    .mpm-variable::placeholder {
      color: var(--text-color-tertiary);
      opacity: 1;
    }

    .mpm-variable[data-filled="true"] {
      border-bottom-style: solid;
      border-bottom-color: var(--background-color-accent);
      background: var(--background-color-accent-selected);
    }

    .mpm-variable:focus {
      border-bottom-style: solid;
      border-bottom-color: var(--background-color-accent);
      background: var(--background-color-accent-selected);
    }

    .mpm-fill-actions {
      flex: none;
      padding: 10px 14px 14px;
    }

    .mpm-insert {
      width: 100%;
      height: 44px;
      padding: 0;
      border-radius: 999px;
      background: var(--background-color-accent);
      color: var(--text-color-on-accent);
      font-size: 14px;
      font-weight: 700;
      transition: background 150ms, transform 250ms ${EASE.spring};
    }

    .mpm-insert:hover {
      background: var(--background-color-accent-hover);
    }

    .mpm-insert:active {
      transform: scale(0.96);
    }

    /* After an Insertion: a violet sweep over the input field, once, and a pill above it on the right */
    .mpm-sweep {
      position: fixed;
      pointer-events: none;
      background: linear-gradient(
        100deg,
        transparent 35%,
        color-mix(in srgb, var(--background-color-inverse-mark) 32%, transparent) 50%,
        transparent 65%
      );
      background-size: 260% 100%;
      animation: mpm-sweep ${String(DURATION.sweep)}ms ${EASE.sheet} both;
    }

    @keyframes mpm-sweep {
      from { background-position: 120% 0; opacity: 1; }
      to { background-position: -20% 0; opacity: 0; }
    }

    .mpm-inserted {
      position: fixed;
      display: flex;
      align-items: center;
      gap: 8px;
      box-sizing: border-box;
      height: 34px;
      max-width: min(420px, calc(100vw - 16px));
      padding: 0 13px;
      pointer-events: auto;
      border-radius: 999px;
      background: var(--background-color-inverse);
      box-shadow: var(--shadow-toast);
      color: var(--text-color-on-inverse-strong);
      font-family: '${SELECTOR_FONT_FAMILY}', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
      font-size: 12.5px;
      font-weight: 600;
      line-height: 1.3;
      text-align: left;
      animation: mpm-inserted ${String(DURATION.inserted)}ms ${EASE.spring} both;
    }

    .mpm-inserted[data-undo="true"] {
      padding-right: 5px;
    }

    .mpm-inserted[data-leaving="true"] {
      animation: mpm-inserted-out ${String(DURATION.close)}ms ease-in both;
    }

    @keyframes mpm-inserted {
      from { opacity: 0; transform: translateY(-14px) scale(0.9); }
      to { opacity: 1; transform: none; }
    }

    @keyframes mpm-inserted-out {
      from { opacity: 1; }
      to { opacity: 0; }
    }

    .mpm-inserted-text {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .mpm-inserted-undo {
      flex: none;
      height: 26px;
      padding: 0 10px;
      border-radius: 999px;
      background: var(--background-color-inverse-action);
      color: var(--text-color-on-inverse-strong);
      font-size: 12px;
      font-weight: 700;
      transition: background 150ms;
    }

    .mpm-inserted-undo:hover {
      background: var(--background-color-inverse-bar);
    }

    .mpm-inserted-undo:focus-visible {
      outline-color: var(--text-color-on-inverse-strong);
    }

    @media (prefers-reduced-motion: reduce) {
      .mpm-popover,
      .mpm-popover[data-closing="true"],
      .mpm-row,
      .mpm-fill,
      .mpm-sweep,
      .mpm-inserted,
      .mpm-inserted[data-leaving="true"] {
        animation-duration: 1ms;
      }

      .mpm-tabs,
      .mpm-tab,
      .mpm-row,
      .mpm-variable,
      .mpm-insert,
      .mpm-inserted-undo {
        transition-duration: 1ms;
      }
    }
  `;
}
