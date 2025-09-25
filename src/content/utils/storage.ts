/**
 * Storage utility module for the content script
 * Handles Chrome storage operations, data validation, and prompt list item creation
 */

import { getDefaultEnabledPlatforms } from '../../config/platforms';
import type { Prompt } from '../types/index';

import { DOMUtils } from './dom';
import { warn, debug, error as logError } from './logger';

/**
 * Interface for extension settings
 */
export interface ExtensionSettings {
  enabledSites: string[];
  customSites: CustomSite[];
  debugMode: boolean;
  floatingFallback: boolean;
}

/**
 * Interface for custom site configuration
 */
export interface CustomSite {
  hostname: string;
  displayName: string;
  icon?: string;
  enabled: boolean;
  dateAdded: number;
  positioning?: {
    mode: 'custom';
    selector: string;
    placement: 'before' | 'after' | 'inside-start' | 'inside-end';
    offset?: {
      x: number;
      y: number;
    };
    zIndex?: number;
    description?: string;
  };
}

/**
 * Get extension settings with validation and defaults
 */
export async function getSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(['promptLibrarySettings'], (result) => {
        if (chrome.runtime.lastError) {
          const storageError = new Error(`Chrome storage error: ${chrome.runtime.lastError.message ?? 'Unknown error'}`);
          logError('Failed to retrieve settings from storage', storageError);
          resolve(getDefaultSettings()); // Graceful fallback to defaults
          return;
        }

        const rawSettings = result.promptLibrarySettings as unknown;
        const validatedSettings = validateSettingsData(rawSettings);

        debug('Retrieved and validated settings from storage', {
          enabledSitesCount: validatedSettings.enabledSites.length,
          customSitesCount: validatedSettings.customSites.length,
          debugMode: validatedSettings.debugMode
        });

        resolve(validatedSettings);
      });
    } catch (err) {
      logError('Unexpected error accessing chrome storage for settings', err as Error);
      resolve(getDefaultSettings()); // Graceful fallback
    }
  });
}

/**
 * Get default extension settings
 */
export function getDefaultSettings(): ExtensionSettings {
  return {
    enabledSites: getDefaultEnabledPlatforms(),
    customSites: [],
    debugMode: false,
    floatingFallback: true
  };
}

/**
 * Validate settings data structure
 */
export function validateSettingsData(settings: unknown): ExtensionSettings {
  const defaults = getDefaultSettings();
  
  // Handle null, undefined, or non-object values
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    if (settings !== undefined && settings !== null) {
      warn('Invalid settings data structure, using defaults');
    }
    return defaults;
  }
  
  // Cast to record type for property access
  const settingsObj = settings as Record<string, unknown>;

  try {
    const validatedSettings: ExtensionSettings = {
      enabledSites: Array.isArray(settingsObj.enabledSites) ? 
        (settingsObj.enabledSites as unknown[]).filter(site => typeof site === 'string' && site.length > 0) as string[] : 
        defaults.enabledSites,
      customSites: Array.isArray(settingsObj.customSites) ? 
        (settingsObj.customSites as unknown[]).filter(site => validateCustomSite(site)) : 
        defaults.customSites,
      debugMode: typeof settingsObj.debugMode === 'boolean' ? settingsObj.debugMode : defaults.debugMode,
      floatingFallback: typeof settingsObj.floatingFallback === 'boolean' ? settingsObj.floatingFallback : defaults.floatingFallback
    };

    return validatedSettings;
  } catch (err) {
    logError('Failed to validate settings data', err as Error, { settings });
    return defaults;
  }
}

/**
 * Validate custom site data structure
 */
export function validateCustomSite(site: unknown): site is CustomSite {
  if (!site || typeof site !== 'object') {
    return false;
  }

  const siteObj = site as Record<string, unknown>;
  
  return (
    typeof siteObj.hostname === 'string' &&
    typeof siteObj.displayName === 'string' &&
    typeof siteObj.enabled === 'boolean' &&
    typeof siteObj.dateAdded === 'number' &&
    siteObj.hostname.length > 0 &&
    siteObj.displayName.length > 0
  );
}

/**
 * Check if the current site is enabled
 */
export async function isSiteEnabled(hostname: string): Promise<boolean> {
  try {
    const settings = await getSettings();
    
    // Check if site is in enabled sites list
    if (settings.enabledSites.includes(hostname)) {
      return true;
    }
    
    // Check if site is an enabled custom site
    const customSite = settings.customSites.find(site => site.hostname === hostname);
    if (customSite && customSite.enabled) {
      return true;
    }
    
    return false;
  } catch (err) {
    logError('Failed to check if site is enabled', err as Error, { hostname });
    debug('ERROR in isSiteEnabled - defaulting to DISABLED', { hostname, error: err });
    // Default to DISABLED on error to prevent unwanted icon appearance
    // This is safer than defaulting to enabled for security/privacy
    return false;
  }
}

/**
 * Get prompts with validation and sanitization
 */
export async function getPrompts(): Promise<Prompt[]> {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['prompts'], (result) => {
          if (chrome.runtime.lastError) {
            const storageError = new Error(`Chrome storage error: ${chrome.runtime.lastError.message ?? 'Unknown error'}`);
            logError('Failed to retrieve prompts from storage', storageError);
            resolve([]); // Graceful fallback to empty array
            return;
          }

          const rawPrompts = Array.isArray(result.prompts) ? result.prompts : [];

          // Validate and sanitize each prompt
          const validatedPrompts = rawPrompts
            .map((prompt: unknown) => validatePromptData(prompt))
            .filter((prompt: Prompt | null): prompt is Prompt => prompt !== null); // Remove invalid prompts

          const invalidCount = rawPrompts.length - validatedPrompts.length;
          if (invalidCount > 0) {
            warn('Filtered out invalid prompts', {
              originalCount: rawPrompts.length,
              validCount: validatedPrompts.length,
              invalidCount
            });
          }

          debug('Retrieved and validated prompts from storage', {
            count: validatedPrompts.length
          });
          resolve(validatedPrompts);
        });
      } catch (err) {
        logError('Unexpected error accessing chrome storage', err as Error);
        resolve([]); // Graceful fallback
      }
    });
  }

/**
 * Escape HTML to ensure user-generated content is displayed safely
 * @deprecated Use DOMUtils.escapeHtml instead
 */
export function escapeHtml(text: string): string {
  return DOMUtils.escapeHtml(text);
}

/**
 * Helper function to safely create DOM elements with text content
 * @deprecated Use DOMUtils.createElement instead
 */
export function createElement(
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
export function createSVGElement(tag: string, attributes: Record<string, string | number> = {}): SVGElement {
  return DOMUtils.createSVGElement(tag, attributes);
}

/**
 * Comprehensive input sanitization for user-generated content
 */
export function sanitizeUserInput(input: string): string {
    try {
      if (typeof input !== 'string') {
        warn('sanitizeUserInput received non-string input', {
          type: typeof input,
          value: input
        });
        return '';
      }

      // Remove null characters and control characters (except \n, \r, \t)
      // eslint-disable-next-line no-control-regex
      let sanitized = input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

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
        warn('Input truncated due to length limit', {
          originalLength: sanitized.length,
          maxLength: MAX_INPUT_LENGTH
        });
        sanitized = sanitized.substring(0, MAX_INPUT_LENGTH) + '...';
      }

      return sanitized;
    } catch (err) {
      logError('Failed to sanitize user input', err as Error, { input });
      return ''; // Safe fallback
    }
  }

/**
 * Validate prompt data structure to ensure expected properties
 */
export function validatePromptData(prompt: unknown): Prompt | null {
    try {
      if (!prompt || typeof prompt !== 'object') {
        warn('Invalid prompt data structure', { prompt });
        return null;
      }

      const promptObj = prompt as Record<string, unknown>;
      
      const safeString = (value: unknown, fallback: string): string => {
        if (typeof value === 'string') {
          return value;
        }
        if (value === null || value === undefined) {
          return fallback;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
          return String(value);
        }
        return fallback;
      };
      
      const validatedPrompt: Prompt = {
        id: sanitizeUserInput(safeString(promptObj.id, '')),
        title: sanitizeUserInput(safeString(promptObj.title, 'Untitled')),
        content: sanitizeUserInput(safeString(promptObj.content, '')),
        category: sanitizeUserInput(safeString(promptObj.category, 'General')),
        createdAt: typeof promptObj.createdAt === 'number' ? promptObj.createdAt : Date.now()
      };

      // Ensure required fields are not empty after sanitization
      if (!validatedPrompt.id || !validatedPrompt.title || !validatedPrompt.content) {
        warn('Prompt failed validation - empty required fields', { validatedPrompt });
        return null;
      }

      return validatedPrompt;
    } catch (err) {
      logError('Failed to validate prompt data', err as Error, { prompt });
      return null;
    }
  }

/**
 * Helper function to safely create prompt list items
 */
export function createPromptListItem(prompt: Prompt, index: number, idPrefix: string = 'prompt-item'): HTMLElement {
    try {
      const promptItem = DOMUtils.createElement('div', {
        class: 'prompt-item',
        'data-prompt-id': DOMUtils.escapeHtml(prompt.id),
        role: 'option',
        'aria-describedby': `${idPrefix}-${String(index)}-desc`,
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
        id: `${idPrefix}-${String(index)}-desc`
      }, DOMUtils.escapeHtml(prompt.content.substring(0, 100)) +
         (prompt.content.length > 100 ? '...' : ''));

      DOMUtils.appendChild(promptItem, promptTitle);
      DOMUtils.appendChild(promptItem, promptCategory);
      DOMUtils.appendChild(promptItem, promptPreview);

      return promptItem;
    } catch (err) {
      logError('Failed to create prompt list item', err as Error, { prompt, index });
      return DOMUtils.createElement('div', { class: 'prompt-item-error' }, 'Error loading prompt');
    }
}