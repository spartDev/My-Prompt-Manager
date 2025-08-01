/**
 * Storage utility module for the content script
 * Handles Chrome storage operations, data validation, and prompt list item creation
 */

import type { Prompt } from '../types/index';
import { Logger } from './logger';
import { DOMUtils } from './dom';

export class StorageManager {
  /**
   * Get prompts with validation and sanitization
   */
  static async getPrompts(): Promise<Prompt[]> {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['prompts'], (result) => {
          if (chrome.runtime.lastError) {
            const error = new Error(`Chrome storage error: ${chrome.runtime.lastError.message}`);
            Logger.error('Failed to retrieve prompts from storage', error);
            resolve([]); // Graceful fallback to empty array
            return;
          }

          const rawPrompts = result.prompts || [];

          // Validate and sanitize each prompt
          const validatedPrompts = rawPrompts
            .map((prompt: any) => StorageManager.validatePromptData(prompt))
            .filter((prompt: Prompt | null): prompt is Prompt => prompt !== null); // Remove invalid prompts

          const invalidCount = rawPrompts.length - validatedPrompts.length;
          if (invalidCount > 0) {
            Logger.warn('Filtered out invalid prompts', {
              originalCount: rawPrompts.length,
              validCount: validatedPrompts.length,
              invalidCount
            });
          }

          Logger.info('Retrieved and validated prompts from storage', {
            count: validatedPrompts.length
          });
          resolve(validatedPrompts);
        });
      } catch (error) {
        Logger.error('Unexpected error accessing chrome storage', error as Error);
        resolve([]); // Graceful fallback
      }
    });
  }

  /**
   * Escape HTML to ensure user-generated content is displayed safely
   * @deprecated Use DOMUtils.escapeHtml instead
   */
  static escapeHtml(text: string): string {
    return DOMUtils.escapeHtml(text);
  }

  /**
   * Helper function to safely create DOM elements with text content
   * @deprecated Use DOMUtils.createElement instead
   */
  static createElement(
    tag: string, 
    attributes: Record<string, string | number> = {}, 
    textContent: string = ''
  ): HTMLElement {
    return DOMUtils.createElement(tag, attributes, textContent);
  }

  /**
   * Helper function to create SVG elements with proper namespace
   * @deprecated Use DOMUtils.createSVGElement instead
   */
  static createSVGElement(tag: string, attributes: Record<string, string | number> = {}): SVGElement {
    return DOMUtils.createSVGElement(tag, attributes);
  }

  /**
   * Comprehensive input sanitization for user-generated content
   */
  static sanitizeUserInput(input: string): string {
    try {
      if (typeof input !== 'string') {
        Logger.warn('sanitizeUserInput received non-string input', {
          type: typeof input,
          value: input
        });
        return '';
      }

      // Remove null characters and control characters (except \n, \r, \t)
      let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

      // Remove potentially dangerous Unicode characters
      sanitized = sanitized.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '');

      // Remove HTML/XML tags completely (more aggressive than escaping)
      sanitized = sanitized.replace(/<[^>]*>/g, '');

      // Remove javascript: and data: URLs
      sanitized = sanitized.replace(/javascript\s*:/gi, '');
      sanitized = sanitized.replace(/data\s*:/gi, '');

      // Remove vbscript: URLs
      sanitized = sanitized.replace(/vbscript\s*:/gi, '');

      // Remove on* event handlers
      sanitized = sanitized.replace(/\bon\w+\s*=/gi, '');

      // Limit length to prevent DoS attacks
      const MAX_INPUT_LENGTH = 50000; // 50KB limit
      if (sanitized.length > MAX_INPUT_LENGTH) {
        Logger.warn('Input truncated due to length limit', {
          originalLength: sanitized.length,
          maxLength: MAX_INPUT_LENGTH
        });
        sanitized = sanitized.substring(0, MAX_INPUT_LENGTH) + '...';
      }

      return sanitized;
    } catch (error) {
      Logger.error('Failed to sanitize user input', error as Error, { input });
      return ''; // Safe fallback
    }
  }

  /**
   * Validate prompt data structure to ensure expected properties
   */
  static validatePromptData(prompt: unknown): Prompt | null {
    try {
      if (!prompt || typeof prompt !== 'object') {
        Logger.warn('Invalid prompt data structure', { prompt });
        return null;
      }

      const promptObj = prompt as Record<string, unknown>;
      const validatedPrompt: Prompt = {
        id: StorageManager.sanitizeUserInput(String(promptObj.id || '')),
        title: StorageManager.sanitizeUserInput(String(promptObj.title || 'Untitled')),
        content: StorageManager.sanitizeUserInput(String(promptObj.content || '')),
        category: StorageManager.sanitizeUserInput(String(promptObj.category || 'General')),
        createdAt: promptObj.createdAt || Date.now()
      };

      // Ensure required fields are not empty after sanitization
      if (!validatedPrompt.id || !validatedPrompt.title || !validatedPrompt.content) {
        Logger.warn('Prompt failed validation - empty required fields', { validatedPrompt });
        return null;
      }

      return validatedPrompt;
    } catch (error) {
      Logger.error('Failed to validate prompt data', error as Error, { prompt });
      return null;
    }
  }

  /**
   * Helper function to safely create prompt list items
   */
  static createPromptListItem(prompt: Prompt, index: number, idPrefix: string = 'prompt-item'): HTMLElement {
    try {
      const promptItem = DOMUtils.createElement('div', {
        class: 'prompt-item',
        'data-prompt-id': DOMUtils.escapeHtml(prompt.id),
        role: 'option',
        'aria-describedby': `${idPrefix}-${index}-desc`,
        tabindex: '-1'
      });

      const promptTitle = DOMUtils.createElement('div', {
        class: 'prompt-title'
      }, DOMUtils.escapeHtml(prompt.title));

      const promptCategory = DOMUtils.createElement('div', {
        class: 'prompt-category'
      }, DOMUtils.escapeHtml(prompt.category));

      const promptPreview = DOMUtils.createElement('div', {
        class: 'prompt-preview',
        id: `${idPrefix}-${index}-desc`
      }, DOMUtils.escapeHtml(prompt.content.substring(0, 100)) +
         (prompt.content.length > 100 ? '...' : ''));

      DOMUtils.appendChild(promptItem, promptTitle);
      DOMUtils.appendChild(promptItem, promptCategory);
      DOMUtils.appendChild(promptItem, promptPreview);

      return promptItem;
    } catch (error) {
      Logger.error('Failed to create prompt list item', error as Error, { prompt, index });
      return DOMUtils.createElement('div', { class: 'prompt-item-error' }, 'Error loading prompt');
    }
  }
}