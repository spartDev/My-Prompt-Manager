/**
 * Platform Manager module
 * 
 * Manages platform strategies and coordinates insertion attempts
 * Provides isolation between strategies and handles strategy selection logic
 */

import type { InsertionResult } from '../types/index';
import type { PlatformManagerOptions } from '../types/platform';
import type { UIElementFactory } from '../ui/element-factory';
import { debug, warn } from '../utils/logger';

import type { PlatformStrategy } from './base-strategy';
import { ChatGPTStrategy } from './chatgpt-strategy';
import { ClaudeStrategy } from './claude-strategy';
import { DefaultStrategy } from './default-strategy';
import { PerplexityStrategy } from './perplexity-strategy';

export class PlatformManager {
  private strategies: PlatformStrategy[];
  private activeStrategy: PlatformStrategy | null;
  private hostname: string;
  private _options: Required<PlatformManagerOptions>;
  private isInitialized: boolean;

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
    this.isInitialized = false;
    
    // Strategies are now loaded lazily via initializeStrategies()
    debug('PlatformManager created (lazy loading mode)', { hostname: this.hostname });
  }

  /**
   * Initializes platform strategies - called only for enabled sites
   * @public
   */
  initializeStrategies(): void {
    if (this.isInitialized) {
      debug('Strategies already initialized, skipping');
      return;
    }
    
    this._initializeStrategies();
    this.isInitialized = true;
    debug('Strategy initialization complete', { strategiesLoaded: this.strategies.length });
  }

  /**
   * Initializes platform strategies based on current hostname
   * Loads specialized strategies for known AI platforms, DefaultStrategy for others
   * @private
   */
  private _initializeStrategies(): void {
    debug('Initializing platform strategies', { hostname: this.hostname });
    
    // Add specialized strategies for known AI platforms, DefaultStrategy for others
    switch (this.hostname) {
      case 'claude.ai':
        this.strategies.push(new ClaudeStrategy());
        this.strategies.push(new DefaultStrategy()); // Fallback for Claude
        break;
        
      case 'chatgpt.com':
        this.strategies.push(new ChatGPTStrategy());
        this.strategies.push(new DefaultStrategy()); // Fallback for ChatGPT
        break;
        
      case 'www.perplexity.ai':
        this.strategies.push(new PerplexityStrategy());
        this.strategies.push(new DefaultStrategy()); // Fallback for Perplexity
        break;
        
      default:
        debug(`Unknown hostname: ${this.hostname} - loading DefaultStrategy`);
        this.strategies.push(new DefaultStrategy());
        break;
    }
    
    // Sort strategies by priority (highest first)
    this.strategies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Registers a new strategy
   * @param strategy - The strategy to register
   */
  registerStrategy(strategy: PlatformStrategy): void {
    this.strategies.push(strategy);
    // Re-sort strategies by priority
    this.strategies.sort((a, b) => b.priority - a.priority);
    
    debug('Registered new strategy', { name: strategy.name });
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
        warn(`Strategy ${strategy.name} canHandle() failed`, { error });
        return false;
      }
    });

    if (compatibleStrategies.length === 0) {
      warn('No compatible strategies found for element', {
        tagName: element.tagName || 'unknown',
        className: element.className || '',
        id: element.id || ''
      });
      return null;
    }

    // Return the highest priority compatible strategy
    const bestStrategy = compatibleStrategies[0];
    debug('Found best strategy', { 
      strategy: bestStrategy.name, 
      priority: bestStrategy.priority 
    });
    
    return bestStrategy;
  }

  /**
   * Gets all available selectors from loaded strategies
   * @returns Combined array of all selectors, empty if not initialized
   */
  getAllSelectors(): string[] {
    // Return empty array if not initialized (disabled site) or no strategies loaded
    if (!this.isInitialized || this.strategies.length === 0) {
      return [];
    }
    
    const allSelectors: string[] = [];
    for (const strategy of this.strategies) {
      // Safety check for strategy methods - helps with test mocking issues
      if (typeof strategy.getSelectors === 'function') {
        allSelectors.push(...strategy.getSelectors());
      } else {
        debug('Strategy missing getSelectors method', { 
          strategy: strategy.name || 'unnamed',
          type: typeof strategy,
          methods: Object.keys(strategy)
        });
      }
    }
    return [...new Set(allSelectors)]; // Remove duplicates
  }

  /**
   * Gets button container selector for the active platform
   * @returns Button container selector or null
   */
  getButtonContainerSelector(): string | null {
    // Return null if not initialized (disabled site) or no strategies loaded
    if (!this.isInitialized || this.strategies.length === 0) {
      return null;
    }
    
    // Use the highest priority strategy that has a button container selector
    for (const strategy of this.strategies) {
      // Safety check for strategy methods - helps with test mocking issues
      if (typeof strategy.getButtonContainerSelector === 'function') {
        const selector = strategy.getButtonContainerSelector();
        if (selector) {
          return selector;
        }
      } else {
        debug('Strategy missing getButtonContainerSelector method', { 
          strategy: strategy.name || 'unnamed',
          type: typeof strategy,
          methods: Object.keys(strategy)
        });
      }
    }
    
    return null;
  }

  /**
   * Creates platform-specific icon
   * @param uiFactory - UI factory instance
   * @returns Platform-specific icon or null if not initialized
   */
  createIcon(uiFactory: UIElementFactory): HTMLElement | null {
    // Return null if not initialized (disabled site)
    if (!this.isInitialized) {
      return null;
    }
    
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
  async insertContent(element: HTMLElement | null, content: string): Promise<InsertionResult> {
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
        debug('Insertion successful', { strategy: bestStrategy.name });
        this.activeStrategy = bestStrategy;
        return result;
      } else {
        warn('Strategy failed', { strategy: bestStrategy.name, error: result.error });
      }
    } catch (error) {
      warn(`${bestStrategy.name} strategy threw error`, { error });
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
   * Re-initializes strategies (useful after cleanup when re-enabling a site)
   */
  reinitialize(): void {
    debug('Re-initializing strategies', { hostname: this.hostname });
    
    // Clear existing strategies and reset initialization flag
    this.strategies = [];
    this.activeStrategy = null;
    this.isInitialized = false;
    
    // Re-initialize with current hostname
    this.initializeStrategies();
  }

  /**
   * Cleans up all strategies
   */
  cleanup(): void {
    debug('Starting cleanup');
    
    for (const strategy of this.strategies) {
      try {
        strategy.cleanup?.();
      } catch (error) {
        warn(`Failed to cleanup strategy ${strategy.name}`, { error });
      }
    }
    
    this.strategies = [];
    this.activeStrategy = null;
    this.isInitialized = false;
    
    debug('Cleanup complete');
  }
}