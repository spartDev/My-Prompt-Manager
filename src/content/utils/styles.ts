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

    /* Legacy class for backward compatibility */
    .prompt-library-icon {
      position: absolute;
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 999999;
      border: 2px solid transparent;
    }

    /* Hover and focus styles for all prompt library icons */
    /* Light mode hover (default) */
    .prompt-library-icon-base:hover,
    .prompt-library-icon:hover {
      background: #e4e4e4;
    }

    /* Dark mode hover */
    .prompt-library-icon-base:hover:is(.dark *):hover,
    .prompt-library-icon:hover:is(.dark *):hover {
      background: #ffffff14;
    }

    .prompt-library-icon-base:focus-visible,
    .prompt-library-icon:focus-visible {
      outline: none;
      border-color: #60a5fa;
      box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.4);
    }

    /* Copilot-specific icon styles */
    /* Matches Microsoft Copilot's native button design with light/dark mode support */
    .prompt-library-icon-copilot {
      width: 40px;
      height: 40px;
      border-radius: 16px; /* rounded-2xl */
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(8px);
    }

    /* Copilot icon - Light mode (default) */
    html[data-theme="light"] .prompt-library-icon-copilot,
    .prompt-library-icon-copilot {
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(0, 0, 0, 0.12);
      color: #000000;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    /* Copilot icon hover - light mode */
    html[data-theme="light"] .prompt-library-icon-copilot:hover,
    .prompt-library-icon-copilot:hover {
      background: rgba(0, 0, 0, 0.06);
      border-color: rgba(0, 0, 0, 0.18);
      color: #000000;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
    }

    /* Copilot icon active - light mode */
    html[data-theme="light"] .prompt-library-icon-copilot:active,
    .prompt-library-icon-copilot:active {
      background: rgba(0, 0, 0, 0.12);
      color: #000000;
      transform: scale(0.97);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    /* Copilot icon - dark mode (using data-theme attribute) */
    html[data-theme="dark"] .prompt-library-icon-copilot {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.12);
      color: #e8e8e8;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }

    html[data-theme="dark"] .prompt-library-icon-copilot:hover {
      background: rgba(255, 255, 255, 0.14);
      border-color: rgba(255, 255, 255, 0.2);
      color: #ffffff;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    html[data-theme="dark"] .prompt-library-icon-copilot:active {
      background: rgba(255, 255, 255, 0.18);
      color: #ffffff;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }

    /* Copilot icon focus state */
    .prompt-library-icon-copilot:focus-visible {
      outline: 2px solid #0078d4;
      outline-offset: 2px;
      border-color: #0078d4;
      box-shadow: 0 0 0 4px rgba(0, 120, 212, 0.1);
    }

    /* Copilot icon SVG sizing */
    .prompt-library-icon-copilot svg {
      width: 20px;
      height: 20px;
    }

    .prompt-library-icon-base svg,
    .prompt-library-icon svg {
      color: currentColor;
      width: 18px;
      height: 18px;
      /* Ensure perfect centering within the 32px container */
      display: block;
      margin: auto;
    }

    /* Prompt Selector Modal */
    .prompt-library-selector {
      position: absolute;
      width: 400px;
      max-height: 500px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1), 0 8px 16px rgba(0, 0, 0, 0.08);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 1000000;
      overflow: hidden;
      backdrop-filter: blur(8px);
      animation: promptSelectorFadeIn 0.2s ease-out;
      transition: top 0.15s ease-out, left 0.15s ease-out;
    }

    .prompt-library-selector:focus-within {
      border-color: #4f46e5;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1), 0 0 0 3px rgba(79, 70, 229, 0.1);
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
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f9fafb;
    }

    .prompt-selector-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #111827;
    }

    .close-selector {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #6b7280;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }

    .close-selector:hover {
      background: #e5e7eb;
      color: #374151;
    }

    .prompt-search {
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
    }

    .search-input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      outline: none;
      box-sizing: border-box;
    }

    .search-input:focus {
      border-color: #4f46e5;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }

    .prompt-list {
      max-height: 350px;
      overflow-y: auto;
    }

    .prompt-item {
      padding: 12px 16px;
      border-bottom: 1px solid #f3f4f6;
      cursor: pointer;
      transition: background-color 0.15s ease;
      border-radius: 4px;
      margin: 2px 8px;
      position: relative;
    }

    .prompt-item:hover,
    .prompt-item:focus-visible {
      background: #f9fafb;
      outline: none;
    }

    .prompt-item:focus-visible {
      box-shadow: 0 0 0 2px #4f46e5;
      background: #f0f0f3;
    }

    .prompt-item.keyboard-selected {
      background: #f0f0f3;
      box-shadow: 0 0 0 2px #4f46e5;
    }

    .prompt-item:last-child {
      border-bottom: none;
    }

    .prompt-title {
      font-weight: 600;
      color: #111827;
      font-size: 14px;
      margin-bottom: 4px;
    }

    .prompt-category {
      font-size: 12px;
      color: #4f46e5;
      background: #eef2ff;
      padding: 2px 8px;
      border-radius: 12px;
      display: inline-block;
      margin-bottom: 6px;
    }

    .prompt-preview {
      font-size: 13px;
      color: #6b7280;
      line-height: 1.4;
    }

    .no-prompts {
      padding: 32px 16px;
      text-align: center;
      color: #6b7280;
      font-style: italic;
    }

    /* Dark theme support */
    .prompt-library-selector.dark-theme {
      background: #1f2937;
      border-color: #374151;
    }

    .prompt-library-selector.dark-theme .prompt-selector-header {
      background: #111827;
      border-color: #374151;
    }

    .prompt-library-selector.dark-theme .prompt-selector-header h3 {
      color: #f9fafb;
    }

    .prompt-library-selector.dark-theme .close-selector {
      color: #9ca3af;
    }

    .prompt-library-selector.dark-theme .close-selector:hover {
      background: #374151;
      color: #f3f4f6;
    }

    .prompt-library-selector.dark-theme .prompt-search {
      border-color: #374151;
    }

    .prompt-library-selector.dark-theme .search-input {
      background: #374151;
      border-color: #4b5563;
      color: #f9fafb;
    }

    .prompt-library-selector.dark-theme .search-input:focus {
      border-color: #6366f1;
    }

    .prompt-library-selector.dark-theme .prompt-item {
      border-color: #374151;
    }

    .prompt-library-selector.dark-theme .prompt-item:hover {
      background: #374151;
    }

    .prompt-library-selector.dark-theme .prompt-item:focus-visible {
      box-shadow: 0 0 0 2px #6366f1;
      background: #374151;
    }

    .prompt-library-selector.dark-theme .prompt-item.keyboard-selected {
      background: #374151;
      box-shadow: 0 0 0 2px #6366f1;
    }

    .prompt-library-selector.dark-theme .prompt-title {
      color: #f9fafb;
    }

    .prompt-library-selector.dark-theme .prompt-category {
      background: #312e81;
      color: #c7d2fe;
    }

    .prompt-library-selector.dark-theme .prompt-preview {
      color: #9ca3af;
    }

    .prompt-library-selector.dark-theme .no-prompts {
      color: #9ca3af;
    }

    /* Light theme support (explicit for clarity) */
    .prompt-library-selector.light-theme {
      background: white;
      border-color: #e5e7eb;
    }

    .prompt-library-selector.light-theme .prompt-selector-header {
      background: #f9fafb;
      border-color: #e5e7eb;
    }

    .prompt-library-selector.light-theme .prompt-selector-header h3 {
      color: #111827;
    }

    .prompt-library-selector.light-theme .close-selector {
      color: #6b7280;
    }

    .prompt-library-selector.light-theme .close-selector:hover {
      background: #e5e7eb;
      color: #374151;
    }

    .prompt-library-selector.light-theme .prompt-search {
      border-color: #e5e7eb;
    }

    .prompt-library-selector.light-theme .search-input {
      background: white;
      border-color: #d1d5db;
      color: #111827;
    }

    .prompt-library-selector.light-theme .search-input:focus {
      border-color: #4f46e5;
    }

    .prompt-library-selector.light-theme .prompt-item {
      border-color: #f3f4f6;
    }

    .prompt-library-selector.light-theme .prompt-item:hover {
      background: #f9fafb;
    }

    .prompt-library-selector.light-theme .prompt-item:focus-visible {
      box-shadow: 0 0 0 2px #4f46e5;
      background: #f0f0f3;
    }

    .prompt-library-selector.light-theme .prompt-item.keyboard-selected {
      background: #f0f0f3;
      box-shadow: 0 0 0 2px #4f46e5;
    }

    .prompt-library-selector.light-theme .prompt-title {
      color: #111827;
    }

    .prompt-library-selector.light-theme .prompt-category {
      background: #eef2ff;
      color: #4f46e5;
    }

    .prompt-library-selector.light-theme .prompt-preview {
      color: #6b7280;
    }

    .prompt-library-selector.light-theme .no-prompts {
      color: #6b7280;
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

    /* Insertion Feedback Styles */
    .insertion-feedback {
      position: absolute;
      top: -40px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      color: white;
      z-index: 1000001;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      backdrop-filter: blur(8px);
    }

    .insertion-feedback.success {
      background: linear-gradient(135deg, #10b981, #059669);
    }

    .insertion-feedback.error {
      background: linear-gradient(135deg, #ef4444, #dc2626);
    }

    .insertion-feedback.show {
      opacity: 1;
    }

    /* Platform-specific insertion debugging styles */
    .insertion-debug {
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 11px;
      z-index: 1000002;
      max-width: 300px;
      backdrop-filter: blur(8px);
    }

    .insertion-debug.success {
      border-left: 4px solid #10b981;
    }

    .insertion-debug.error {
      border-left: 4px solid #ef4444;
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
