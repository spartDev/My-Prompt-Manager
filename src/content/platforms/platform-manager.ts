/**
 * Platform Manager module
 * 
 * Manages platform strategies and coordinates insertion attempts
 * Provides isolation between strategies and handles strategy selection logic
 */

import { getPlatformByHostname } from '../../config/platforms';
import type { InsertionResult } from '../types/index';
import type { PlatformManagerOptions } from '../types/platform';
import type { UIElementFactory } from '../ui/element-factory';
import { debug, warn } from '../utils/logger';
import { getSettings, type CustomSite } from '../utils/storage';

import type { PlatformStrategy } from './base-strategy';
import { ChatGPTStrategy } from './chatgpt-strategy';
import { ClaudeStrategy } from './claude-strategy';
import { DefaultStrategy } from './default-strategy';
import { GeminiStrategy } from './gemini-strategy';
import { MistralStrategy } from './mistral-strategy';
import { PerplexityStrategy } from './perplexity-strategy';

export class PlatformManager {
  /**
   * Strategy registry mapping platform IDs to constructor functions
   * Type-safe registry ensures all constructors accept optional hostname parameter
   */
  private static readonly STRATEGY_REGISTRY: Record<string, new (hostname?: string) => PlatformStrategy> = {
    'claude': ClaudeStrategy,
    'chatgpt': ChatGPTStrategy,
    'gemini': GeminiStrategy,
    'mistral': MistralStrategy,
    'perplexity': PerplexityStrategy
  };

  private strategies: PlatformStrategy[];
  private activeStrategy: PlatformStrategy | null;
  private hostname: string;
  private isInitialized: boolean;
  private customSiteConfig: CustomSite | null;

  constructor(options: PlatformManagerOptions = {}) {
    // Store options for potential future use
    const _options = {
      enableDebugLogging: options.enableDebugLogging || false,
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 5000,
      ...options
    };
    void _options; // Explicitly mark as intentionally unused for now

    this.strategies = [];
    this.activeStrategy = null;
    this.hostname = window.location.hostname;
    this.isInitialized = false;
    this.customSiteConfig = null;
    
    // Strategies are now loaded lazily via initializeStrategies()
    debug('PlatformManager created (lazy loading mode)', { hostname: this.hostname });
  }

  /**
   * Initializes platform strategies - called only for enabled sites
   * @public
   */
  async initializeStrategies(): Promise<void> {
    if (this.isInitialized) {
      debug('Strategies already initialized, skipping');
      return;
    }
    
    // Load custom site configuration if available
    await this._loadCustomSiteConfig();
    
    this._initializeStrategies();
    this.isInitialized = true;
    debug('Strategy initialization complete', { 
      strategiesLoaded: this.strategies.length,
      hasCustomConfig: !!this.customSiteConfig
    });
  }

  /**
   * Loads custom site configuration for the current hostname
   * @private
   */
  private async _loadCustomSiteConfig(): Promise<void> {
    try {
      const settings = await getSettings();
      const customSite = settings.customSites.find(site => site.hostname === this.hostname);
      
      if (customSite && customSite.enabled) {
        this.customSiteConfig = customSite;
        debug('Custom site configuration loaded', { 
          hostname: this.hostname,
          hasPositioning: !!customSite.positioning,
          mode: customSite.positioning?.mode
        });
      }
    } catch (error) {
      warn('Failed to load custom site configuration', { error, hostname: this.hostname });
    }
  }

  /**
   * Creates strategies for the given hostname using factory pattern
   * @param hostname - Hostname to create strategies for
   * @returns Array of strategies (platform-specific + fallback)
   * @private
   */
  private _createStrategyForHostname(hostname: string): PlatformStrategy[] {
    const strategies: PlatformStrategy[] = [];

    // Look up platform configuration by hostname
    const platform = getPlatformByHostname(hostname);

    if (platform) {
      // Use strategy registry to instantiate platform-specific strategy
      const StrategyConstructor = PlatformManager.STRATEGY_REGISTRY[platform.id];

      // TypeScript knows registry is complete, but we check defensively for runtime safety
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!StrategyConstructor) {
        // Only warn if the platform doesn't explicitly use DefaultStrategy
        if (platform.strategyClass !== 'DefaultStrategy') {
          warn(`No strategy found for platform: ${platform.id}`, { hostname });
        } else {
          debug(`Platform ${platform.id} uses DefaultStrategy (no custom strategy needed)`, { hostname });
        }
      } else {
        try {
          strategies.push(new StrategyConstructor(hostname));
          debug('Loaded platform strategy', {
            platform: platform.displayName,
            id: platform.id,
            priority: platform.priority
          });
        } catch (error) {
          warn(`Failed to instantiate ${platform.id} strategy`, {
            error,
            hostname,
            platformId: platform.id,
            fallbackToDefault: true
          });
          // DefaultStrategy will be added below as fallback
        }
      }
    } else {
      debug(`Unknown hostname: ${hostname} - using DefaultStrategy only`);
    }

    // Always add fallback strategy (with its own error handling)
    try {
      strategies.push(new DefaultStrategy(hostname));
    } catch (error) {
      warn('Failed to instantiate DefaultStrategy', {
        error,
        hostname,
        critical: true
      });
      // If even DefaultStrategy fails, return empty array
      // This is a critical failure but won't crash the extension
    }

    return strategies;
  }

  /**
   * Initializes platform strategies based on current hostname
   * Uses data-driven approach via strategy registry
   * @private
   */
  private _initializeStrategies(): void {
    debug('Initializing platform strategies', { hostname: this.hostname });

    // Create strategies using factory method
    this.strategies = this._createStrategyForHostname(this.hostname);

    // Sort strategies by priority (highest first)
    this.strategies.sort((a, b) => b.priority - a.priority);

    debug('Strategies initialized', {
      count: this.strategies.length,
      names: this.strategies.map(s => s.name)
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
   * Gets all available selectors from loaded strategies, including custom selectors
   * @returns Combined array of all selectors, empty if not initialized
   */
  getAllSelectors(): string[] {
    // Return empty array if not initialized (disabled site) or no strategies loaded
    if (!this.isInitialized || this.strategies.length === 0) {
      return [];
    }
    
    const allSelectors: string[] = [];
    
    // Add selectors from strategies
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
    
    // Add custom selectors from custom site configuration
    if (this.customSiteConfig?.positioning && this.customSiteConfig.positioning.selector) {
      allSelectors.push(this.customSiteConfig.positioning.selector);
      debug('Added custom selector to detection list', { 
        selector: this.customSiteConfig.positioning.selector 
      });
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

    // Special handling for platforms that use DefaultStrategy but need custom icons
    // Copilot uses DefaultStrategy for insertion but needs custom icon styling
    if (this.hostname === 'copilot.microsoft.com') {
      return uiFactory.createCopilotIcon();
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
   * Gets the custom site configuration for the current hostname
   * @returns Custom site configuration or null if not found
   */
  getCustomSiteConfig(): CustomSite | null {
    return this.customSiteConfig;
  }

  /**
   * Re-initializes strategies (useful after cleanup when re-enabling a site)
   */
  async reinitialize(): Promise<void> {
    debug('Re-initializing strategies', { hostname: this.hostname });
    
    // Clear existing strategies and reset initialization flag
    this.strategies = [];
    this.activeStrategy = null;
    this.customSiteConfig = null;
    this.isInitialized = false;
    
    // Re-initialize with current hostname
    await this.initializeStrategies();
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
    this.customSiteConfig = null;
    this.isInitialized = false;

    debug('Cleanup complete');
  }

  /**
   * Debug-only method to switch strategy for testing/debugging
   * Only works when debug mode is enabled
   * @param hostname - Hostname to switch to
   */
  public debugSwitchStrategy(hostname: string): void {
    if (window.__promptLibraryDebug) {
      debug('Debug mode: Switching strategy', {
        from: this.hostname,
        to: hostname
      });

      this.hostname = hostname;
      this.strategies = [];
      this.activeStrategy = null;
      this._initializeStrategies();

      debug('Debug mode: Strategy switch complete', {
        hostname: this.hostname,
        strategies: this.strategies.map(s => s.name)
      });
    } else {
      warn('debugSwitchStrategy called but debug API not available');
    }
  }

  /**
   * Test-only method to set strategies directly
   * For use in automated tests only
   * @param strategies - Strategies to set
   */
  public setStrategiesForTesting(strategies: PlatformStrategy[]): void {
    this.strategies = strategies;
    this.isInitialized = true;
  }
}