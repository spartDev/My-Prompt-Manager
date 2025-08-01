/**
 * Base Platform Strategy module
 * 
 * Abstract base class that defines the contract for platform-specific insertion strategies.
 * Each platform must implement all abstract methods to ensure consistent behavior.
 */

import type { PlatformStrategyInterface, PlatformConfig, InsertionResult } from '../types/index';
import type { UIElementFactory } from '../ui/element-factory';
import { debug, warn , error as logError } from '../utils/logger';

export abstract class PlatformStrategy implements PlatformStrategyInterface {
  public readonly name: string;
  public readonly priority: number;
  protected config?: PlatformConfig;
  protected hostname: string;

  constructor(name: string, priority: number, config?: PlatformConfig) {
    if (this.constructor === PlatformStrategy) {
      throw new Error('PlatformStrategy is abstract and cannot be instantiated');
    }
    
    this.name = name;
    this.priority = priority;
    this.config = config;
    this.hostname = window.location.hostname;
    
    // Validate required methods are implemented
    this._validateImplementation();
  }

  /**
   * Validates that all abstract methods are implemented by concrete classes
   * @private
   */
  private _validateImplementation(): void {
    const requiredMethods = ['canHandle', 'insert', 'getSelectors'];
    for (const method of requiredMethods) {
      if (typeof (this as Record<string, unknown>)[method] !== 'function') {
        throw new Error(`Strategy ${this.name} must implement ${method}() method`);
      }
    }
  }

  /**
   * Determines if this strategy can handle the given element
   * @param element - The target element
   * @returns True if this strategy can handle the element
   * @abstract
   */
  abstract canHandle(element: HTMLElement): boolean;

  /**
   * Inserts content into the target element using platform-specific logic
   * @param element - The target element
   * @param content - The content to insert
   * @returns Result of the insertion attempt
   * @abstract
   */
  abstract insert(element: HTMLElement, content: string): Promise<InsertionResult>;

  /**
   * Gets the CSS selectors used to find input elements for this platform
   * @returns Array of CSS selectors
   * @abstract
   */
  abstract getSelectors(): string[];

  /**
   * Gets the button container selector for icon placement (optional)
   * @returns CSS selector for button container
   */
  getButtonContainerSelector(): string | null {
    return this.config?.buttonContainerSelector || null;
  }

  /**
   * Creates a platform-specific icon (optional override)
   * @param uiFactory - Factory for creating UI elements
   * @returns Platform-specific icon or null to use default
   */
  createIcon?(_uiFactory: UIElementFactory): HTMLElement | null {
    return null; // Use default icon by default
  }

  /**
   * Cleans up any platform-specific resources (optional override)
   */
  cleanup?(): void {
    // Default: no cleanup needed
  }

  /**
   * Logs debug information with platform prefix
   * @param message - Debug message
   * @param context - Additional context
   * @protected
   */
  protected _debug(message: string, context: Record<string, unknown> = {}): void {
    debug(`[${this.name}] ${message}`, context);
  }

  /**
   * Logs warning with platform prefix
   * @param message - Warning message
   * @param errorOrContext - Error object or context
   * @protected
   */
  protected _warn(message: string, errorOrContext: Record<string, unknown> | Error = {}): void {
    warn(`[${this.name}] ${message}`, errorOrContext);
  }

  /**
   * Logs error with platform prefix
   * @param message - Error message
   * @param error - Error object
   * @param context - Additional context
   * @protected
   */
  protected _error(message: string, errorObj: Error, context: Record<string, unknown> = {}): void {
    logError(`[${this.name}] ${message}`, errorObj, context);
  }
}