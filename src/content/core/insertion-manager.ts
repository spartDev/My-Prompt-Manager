/**
 * Platform Insertion Manager module
 * 
 * Provides a backward compatibility layer for the platform insertion system.
 * This class wraps the PlatformManager and provides the interface expected
 * by the legacy code while using the improved modular architecture.
 */

import { PlatformManager } from '../platforms/platform-manager';
import type { InsertionResult } from '../types/index';
import type { UIElementFactory } from '../ui/element-factory';
import { warn, info } from '../utils/logger';

export class PlatformInsertionManager {
  private options: Required<Record<string, unknown>>;
  private platformManager: PlatformManager;

  constructor(options: Record<string, unknown> = {}) {
    const debug = typeof options.debug === 'boolean' ? options.debug : false;
    const timeout = typeof options.timeout === 'number' ? options.timeout : 5000;
    const retries = typeof options.retries === 'number' ? options.retries : 3;
    
    this.options = {
      debug,
      timeout,
      retries,
      ...options
    };
    
    // Initialize the platform manager with compatible options
    this.platformManager = new PlatformManager({
      enableDebugLogging: this.options.debug,
      maxRetries: this.options.retries,
      timeout: this.options.timeout
    });
    
    info('PlatformInsertionManager initialized with strategy pattern');
  }

  /**
   * Inserts content using the strategy pattern
   * @param content - Content to insert
   * @param options - Insertion options (legacy parameter for backward compatibility)
   * @returns Promise<InsertionResult> Result of insertion attempt
   */
  async insertContent(content: string, options: { element?: HTMLElement } = {}): Promise<InsertionResult> {
    if (!options.element) {
      return {
        success: false,
        error: 'No target element provided'
      };
    }

    return this.platformManager.insertContent(options.element, content);
  }

  /**
   * Inserts prompt content into the specified element
   * @param element - Target element for insertion
   * @param content - Content to insert
   * @returns Promise<InsertionResult> Result of insertion attempt
   */
  async insertPrompt(element: HTMLElement, content: string): Promise<InsertionResult> {
    return this.platformManager.insertContent(element, content);
  }

  /**
   * Gets all available selectors from the platform manager
   * @returns string[] Array of CSS selectors
   */
  getAllSelectors(): string[] {
    return this.platformManager.getAllSelectors();
  }

  /**
   * Gets button container selector for the current platform
   * @returns string|null Button container selector
   */
  getButtonContainerSelector(): string | null {
    return this.platformManager.getButtonContainerSelector();
  }

  /**
   * Creates platform-specific icon using the platform manager
   * @param uiFactory - UI factory instance
   * @returns HTMLElement Platform icon
   */
  createIcon(uiFactory: UIElementFactory): HTMLElement | null {
    return this.platformManager.createIcon(uiFactory);
  }

  /**
   * Gets the active strategy from the platform manager
   * @returns PlatformStrategy|null Active strategy
   */
  getActiveStrategy() {
    return this.platformManager.getActiveStrategy();
  }

  /**
   * Cleans up resources and platform manager
   */
  cleanup(): void {
    try {
      this.platformManager.cleanup();
    } catch (error) {
      warn('Error during platform manager cleanup', { error });
    }
    
    info('PlatformInsertionManager cleanup completed');
  }
}