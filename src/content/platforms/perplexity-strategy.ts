/**
 * Perplexity Platform Strategy module
 *
 * Perplexity's composer is a Lexical editor: the Insertion and Undo of LexicalStrategy.
 */

import { getPlatformById } from '../../config/platforms';
import type { UIElementFactory } from '../ui/element-factory';

import { LexicalStrategy } from './lexical-strategy';

export class PerplexityStrategy extends LexicalStrategy {
  constructor(hostname?: string) {
    super('perplexity', 80, {
      selectors: [
        'div[contenteditable="true"][role="textbox"]#ask-input'
      ],
      priority: 80
    }, hostname);
  }

  /**
   * Determines if this strategy can handle the element
   * Handles any element on www.perplexity.ai
   */
  canHandle(_element: HTMLElement): boolean {
    return this.hostname === getPlatformById('perplexity')?.hostname;
  }

  /**
   * Gets selectors for finding Perplexity input elements
   */
  getSelectors(): string[] {
    return this.config?.selectors || [];
  }

  /**
   * Creates Perplexity-specific icon using the UI factory
   */
  createIcon(uiFactory: UIElementFactory): HTMLElement | null {
    return uiFactory.createPerplexityIcon();
  }
}
