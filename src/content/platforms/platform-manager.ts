/**
 * Platform Manager module
 * 
 * Manages platform strategies and coordinates insertion attempts
 * Provides isolation between strategies and handles strategy selection logic
 */

import type { PlatformStrategy } from './base-strategy';
import type { PlatformManagerOptions } from '../types/platform';
import type { InsertionResult } from '../types/index';
import type { UIElementFactory } from '../ui/element-factory';
import { Logger } from '../utils/logger';
import { ClaudeStrategy } from './claude-strategy';
import { ChatGPTStrategy } from './chatgpt-strategy';
import { PerplexityStrategy } from './perplexity-strategy';
import { DefaultStrategy } from './default-strategy';

export class PlatformManager {
  private strategies: PlatformStrategy[];
  private activeStrategy: PlatformStrategy | null;
  private hostname: string;
  private _options: Required<PlatformManagerOptions>;

  constructor(options: PlatformManagerOptions = {}) {
    this._options = {
      enableDebugLogging: options.enableDebugLogging || false,
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 5000,
      ...options
    };
    
    this.strategies = [];
    this.activeStrategy = null;
    this.hostname = window.location.hostname;
    
    this._initializeStrategies();
  }

  /**
   * Initializes platform strategies based on current hostname
   * Only loads strategies relevant to the current platform for performance
   * @private
   */
  private _initializeStrategies(): void {
    Logger.info('Initializing platform strategies', { hostname: this.hostname });
    
    // Always add default strategy as fallback
    this.strategies.push(new DefaultStrategy());
    
    // Add platform-specific strategies based on hostname
    switch (this.hostname) {
      case 'claude.ai':
        this.strategies.push(new ClaudeStrategy());
        Logger.info('Loaded Claude strategy for claude.ai');
        break;
        
      case 'chatgpt.com':
        this.strategies.push(new ChatGPTStrategy());
        Logger.info('Loaded ChatGPT strategy for chatgpt.com');
        break;
        
      case 'www.perplexity.ai':
        this.strategies.push(new PerplexityStrategy());
        Logger.info('Loaded Perplexity strategy for www.perplexity.ai');
        break;
        
      default:
        Logger.info(`Using default strategy for unknown hostname: ${this.hostname}`);
    }
    
    // Sort strategies by priority (highest first)
    this.strategies.sort((a, b) => b.priority - a.priority);
    
    Logger.info('Strategy initialization complete', {
      strategiesLoaded: this.strategies.length
    });
  }

  /**
   * Registers a new strategy
   * @param strategy - The strategy to register
   */
  registerStrategy(strategy: PlatformStrategy): void {
    this.strategies.push(strategy);
    // Re-sort strategies by priority
    this.strategies.sort((a, b) => b.priority - a.priority);
    
    Logger.info('Registered new strategy', { 
      name: strategy.name, 
      priority: strategy.priority 
    });
  }

  /**
   * Finds the best strategy for the given element
   * @param element - The target element
   * @returns The best strategy or null if none found
   */
  findBestStrategy(element: HTMLElement): PlatformStrategy | null {
    // Find compatible strategies
    const compatibleStrategies = this.strategies.filter(strategy => {
      try {
        return strategy.canHandle(element);
      } catch (error) {
        Logger.warn(`Strategy ${strategy.name} canHandle() failed`, { error });
        return false;
      }
    });

    if (compatibleStrategies.length === 0) {
      Logger.warn('No compatible strategies found for element', {
        tagName: element.tagName,
        className: element.className,
        id: element.id
      });
      return null;
    }

    // Return the highest priority compatible strategy
    const bestStrategy = compatibleStrategies[0];
    Logger.debug('Found best strategy', { 
      strategy: bestStrategy.name, 
      priority: bestStrategy.priority 
    });
    
    return bestStrategy;
  }

  /**
   * Gets all available selectors from loaded strategies
   * @returns Combined array of all selectors
   */
  getAllSelectors(): string[] {
    const allSelectors: string[] = [];
    for (const strategy of this.strategies) {
      allSelectors.push(...strategy.getSelectors());
    }
    return [...new Set(allSelectors)]; // Remove duplicates
  }

  /**
   * Gets button container selector for the active platform
   * @returns Button container selector or null
   */
  getButtonContainerSelector(): string | null {
    // Use the highest priority strategy that has a button container selector
    for (const strategy of this.strategies) {
      const selector = strategy.getButtonContainerSelector();
      if (selector) {
        return selector;
      }
    }
    return null;
  }

  /**
   * Creates platform-specific icon
   * @param uiFactory - UI factory instance
   * @returns Platform-specific icon
   */
  createIcon(uiFactory: UIElementFactory): HTMLElement | null {
    // Use the highest priority strategy to create the icon
    for (const strategy of this.strategies) {
      const icon = strategy.createIcon?.(uiFactory);
      if (icon) {
        this.activeStrategy = strategy;
        return icon;
      }
    }
    
    // Fallback to default floating icon
    return uiFactory.createFloatingIcon();
  }

  /**
   * Attempts to insert content using appropriate strategy
   * @param element - Target element
   * @param content - Content to insert
   * @returns Result of insertion attempt
   */
  async insertContent(element: HTMLElement, content: string): Promise<InsertionResult> {
    if (!element) {
      return {
        success: false,
        error: 'No target element provided'
      };
    }

    const bestStrategy = this.findBestStrategy(element);
    if (!bestStrategy) {
      return {
        success: false,
        error: 'No compatible strategies found for target element'
      };
    }

    // Try the best strategy
    try {
      const result = await bestStrategy.insert(element, content);
      
      if (result.success) {
        Logger.info('PlatformManager: Insertion successful', {
          strategy: bestStrategy.name,
          method: result.method
        });
        this.activeStrategy = bestStrategy;
        return result;
      } else {
        Logger.warn('PlatformManager: Strategy failed', {
          strategy: bestStrategy.name,
          error: result.error
        });
      }
    } catch (error) {
      Logger.warn(`PlatformManager: ${bestStrategy.name} strategy threw error`, { error });
    }

    return {
      success: false,
      error: 'Strategy insertion failed'
    };
  }

  /**
   * Gets the currently active strategy
   * @returns Active strategy or null
   */
  getActiveStrategy(): PlatformStrategy | null {
    return this.activeStrategy;
  }

  /**
   * Gets all loaded strategies
   * @returns Array of loaded strategies
   */
  getStrategies(): PlatformStrategy[] {
    return [...this.strategies];
  }

  /**
   * Cleans up all strategies
   */
  cleanup(): void {
    Logger.info('PlatformManager: Starting cleanup');
    
    for (const strategy of this.strategies) {
      try {
        strategy.cleanup?.();
      } catch (error) {
        Logger.warn(`Failed to cleanup strategy ${strategy.name}`, { error });
      }
    }
    
    this.strategies = [];
    this.activeStrategy = null;
    
    Logger.info('PlatformManager: Cleanup complete');
  }
}