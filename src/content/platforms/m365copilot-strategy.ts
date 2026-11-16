/**
 * Microsoft 365 Copilot Platform Strategy module
 *
 * Microsoft 365 Copilot, at m365.cloud.microsoft and at copilot.cloud.microsoft where a work account
 * lands. Its composer is a Lexical editor: the Insertion and Undo of LexicalStrategy, a paste that
 * is never written a second time. A textarea, if the composer ever has one, takes the text through
 * its native value setter.
 */

import { getPlatformByHostname, getPlatformById } from '../../config/platforms';
import type { UIElementFactory } from '../ui/element-factory';

import { LexicalStrategy } from './lexical-strategy';

export class M365CopilotStrategy extends LexicalStrategy {
  constructor(hostname?: string) {
    const platform = getPlatformById('m365copilot');

    super('m365copilot', 80, {
      selectors: platform?.selectors || [
        'span[id="m365-chat-editor-target-element"]',
        '[data-lexical-editor][contenteditable="true"][role="textbox"]',
        'span[data-lexical-editor="true"][contenteditable="true"]',
        'span[role="combobox"][contenteditable="true"]',
        'div[contenteditable="true"]',
        'textarea[placeholder*="Message"]'
      ],
      priority: 80
    }, hostname);
  }

  /**
   * Determines if this strategy can handle the element
   * Handles both textarea and contenteditable elements on every host of Microsoft 365 Copilot
   */
  canHandle(element: HTMLElement): boolean {
    const isCorrectHostname = getPlatformByHostname(this.hostname)?.id === 'm365copilot';
    const isTextarea = element.tagName === 'TEXTAREA';
    const isContentEditable = element.getAttribute('contenteditable') === 'true';

    return isCorrectHostname && (isTextarea || isContentEditable);
  }

  /**
   * Gets selectors for finding M365 Copilot input elements
   */
  getSelectors(): string[] {
    return this.config?.selectors || [];
  }

  /**
   * Creates M365 Copilot-specific icon using the UI factory
   * Reuses the Copilot icon as they share the same branding
   */
  createIcon(uiFactory: UIElementFactory): HTMLElement | null {
    const { element, cleanup } = uiFactory.createCopilotIcon();
    // Store cleanup function on element for later retrieval by injector
    (element as HTMLElement & { __cleanup?: () => void }).__cleanup = cleanup;
    return element;
  }
}
