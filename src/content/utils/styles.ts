/**
 * Styles utility module for the content script
 * Handles CSS injection and style management
 */

import { debug, info, error as logError } from './logger';

const STYLE_ID = 'prompt-library-styles';

/**
 * Inject CSS styles into the document head
 * Only injects once per page load
 */
export function injectCSS(): void {
    try {
      // Check if styles are already injected
      if (document.getElementById(STYLE_ID)) {
        debug('CSS styles already injected, skipping');
        return;
      }

      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = getCSS();

      document.head.appendChild(style);
      info('CSS styles injected successfully');
    } catch (err) {
      logError('Failed to inject CSS styles', err as Error);
    }
  }

/**
 * Get the CSS string for the prompt library
 * @returns The complete CSS string
 */
export function getCSS(): string {
    return `
    /* Prompt Manager Icon */
    .prompt-library-icon {
      position: absolute;
      width: 50px;
      height: 50px;  
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 999999;
      border: 2px solid transparent;
    }

    .prompt-library-icon:hover {
      background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    }

    .prompt-library-icon:focus-visible {
      outline: none;
      border-color: #60a5fa;
      box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.4);
    }

    .prompt-library-icon svg {
      color: white;
      width: 24px;
      height: 24px;
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

    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      .prompt-library-selector {
        background: #1f2937;
        border-color: #374151;
      }
      
      .prompt-selector-header {
        background: #111827;
        border-color: #374151;
      }
      
      .prompt-selector-header h3 {
        color: #f9fafb;
      }
      
      .close-selector {
        color: #9ca3af;
      }
      
      .close-selector:hover {
        background: #374151;
        color: #f3f4f6;
      }
      
      .prompt-search {
        border-color: #374151;
      }
      
      .search-input {
        background: #374151;
        border-color: #4b5563;
        color: #f9fafb;
      }
      
      .search-input:focus {
        border-color: #6366f1;
      }
      
      .prompt-item {
        border-color: #374151;
      }
      
      .prompt-item:hover {
        background: #374151;
      }

      .prompt-item:focus-visible {
        box-shadow: 0 0 0 2px #6366f1;
        background: #374151;
      }

      .prompt-item.keyboard-selected {
        background: #374151;
        box-shadow: 0 0 0 2px #6366f1;
      }
      
      .prompt-title {
        color: #f9fafb;
      }
      
      .prompt-category {
        background: #312e81;
        color: #c7d2fe;
      }
      
      .prompt-preview {
        color: #9ca3af;
      }
      
      .no-prompts {
        color: #9ca3af;
      }
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
      info('CSS styles removed successfully');
    }
  } catch (err) {
    logError('Failed to remove CSS styles', err as Error);
  }
}

/**
 * Check if styles are already injected
 * @returns True if styles are already present
 */
export function isInjected(): boolean {
  return document.getElementById(STYLE_ID) !== null;
}