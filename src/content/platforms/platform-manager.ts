/**
 * Platform Manager module
 * 
 * Manages platform strategies and coordinates insertion attempts
 * Provides isolation between strategies and handles strategy selection logic
 */

import { getPlatformByHostname, SUPPORTED_PLATFORMS } from '../../config/platforms';
import type { InsertionResult } from '../types/index';
import type { PlatformManagerOptions } from '../types/platform';
import type { UIElementFactory } from '../ui/element-factory';
import { debug, warn } from '../utils/logger';
import { getSettings, type CustomSite } from '../utils/storage';

import type { PlatformStrategy } from './base-strategy';
import { ChatGPTStrategy } from './chatgpt-strategy';
import { ClaudeStrategy } from './claude-strategy';
import { CopilotStrategy } from './copilot-strategy';
import { DefaultStrategy } from './default-strategy';
import { GeminiStrategy } from './gemini-strategy';
import { M365CopilotStrategy } from './m365copilot-strategy';
import { MistralStrategy } from './mistral-strategy';
import { PerplexityStrategy } from './perplexity-strategy';

/**
 * Strategy class name to constructor mapping
 * Maps strategyClass names from platforms.ts to actual constructor functions
 */
const STRATEGY_CONSTRUCTORS: Record<string, new (hostname?: string) => PlatformStrategy> = {
  'ClaudeStrategy': ClaudeStrategy,
  'ChatGPTStrategy': ChatGPTStrategy,
  'CopilotStrategy': CopilotStrategy,
  'GeminiStrategy': GeminiStrategy,
  'M365CopilotStrategy': M365CopilotStrategy,
  'MistralStrategy': MistralStrategy,
  'PerplexityStrategy': PerplexityStrategy,
  'DefaultStrategy': DefaultStrategy
};

/**
 * Build strategy registry from platform configuration
 * Auto-constructs mapping from platform IDs to strategy constructors
 * This eliminates the need to manually sync registry with platforms.ts
 */
function buildStrategyRegistry(): Record<string, new (hostname?: string) => PlatformStrategy> {
  const registry: Record<string, new (hostname?: string) => PlatformStrategy> = {};

  for (const [platformId, platform] of Object.entries(SUPPORTED_PLATFORMS)) {
    const StrategyConstructor = STRATEGY_CONSTRUCTORS[platform.strategyClass];
    // Runtime check needed: platform.strategyClass may reference non-existent strategy
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (StrategyConstructor) {
      registry[platformId] = StrategyConstructor;
    } else {
      // Warn at module load time if configuration references unknown strategy
      warn(`Platform ${platformId} references unknown strategy class: ${platform.strategyClass}`);
    }
  }

  return registry;
}

export class PlatformManager {
  /**
   * Strategy registry mapping platform IDs to constructor functions
   * Auto-generated from SUPPORTED_PLATFORMS configuration
   */
  private static readonly STRATEGY_REGISTRY = buildStrategyRegistry();

  private strategies: PlatformStrategy[];
  private activeStrategy: PlatformStrategy | null;
  private hostname: string;
  private isInitialized: boolean;
  private customSiteConfig: CustomSite | null;
  private initializationLock: Promise<void> | null;
  private cachedSelectors: string[] | null;

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
    this.initializationLock = null;
    this.cachedSelectors = null;

    // Strategies are now loaded lazily via initializeStrategies()
    debug('PlatformManager created (lazy loading mode)', { hostname: this.hostname });
  }

  /**
   * Initializes platform strategies - called only for enabled sites
   * Thread-safe with initialization lock to prevent race conditions
   * @public
   */
  async initializeStrategies(): Promise<void> {
    // Return existing initialization promise if one is in progress
    if (this.initializationLock) {
      return this.initializationLock;
    }

    if (this.isInitialized) {
      debug('Strategies already initialized, skipping');
      return;
    }

    // Create and store initialization promise to prevent concurrent initializations
    this.initializationLock = (async () => {
      try {
        // Load custom site configuration if available
        await this._loadCustomSiteConfig();

        this._initializeStrategies();
        this.isInitialized = true;
        debug('Strategy initialization complete', {
          strategiesLoaded: this.strategies.length,
          hasCustomConfig: !!this.customSiteConfig
        });
      } finally {
        // Clear lock after initialization completes (success or failure)
        this.initializationLock = null;
      }
    })();

    return this.initializationLock;
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
   * Performance: Result is cached after first computation (~95% reduction in repeated calls)
   * @returns Combined array of all selectors, empty if not initialized
   */
  getAllSelectors(): string[] {
    // Return empty array if not initialized (disabled site) or no strategies loaded
    if (!this.isInitialized || this.strategies.length === 0) {
      return [];
    }

    // Return cached result if available
    if (this.cachedSelectors !== null) {
      return this.cachedSelectors;
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

    // Cache the result for future calls
    this.cachedSelectors = [...new Set(allSelectors)]; // Remove duplicates
    return this.cachedSelectors;
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

    const platform = getPlatformByHostname(this.hostname);

    if (platform?.iconMethod) {
      const iconMethodName = platform.iconMethod;
      const iconCreator = uiFactory[iconMethodName as keyof UIElementFactory];

      if (typeof iconCreator === 'function') {
        try {
          const result = (iconCreator as () => HTMLElement | { element: HTMLElement; cleanup: () => void }).call(uiFactory);
          // Handle both old (HTMLElement) and new ({ element, cleanup }) return formats
          const icon = 'element' in result ? result.element : result;
          if (this.strategies.length > 0) {
            this.activeStrategy = this.strategies[0];
          }
          return icon;
        } catch (error) {
          warn('Failed to create icon via configured iconMethod', {
            error,
            hostname: this.hostname,
            platformId: platform.id,
            iconMethod: iconMethodName
          });
        }
      } else {
        warn(`Icon method '${iconMethodName}' not found in UIElementFactory`, {
          hostname: this.hostname,
          platformId: platform.id
        });
      }
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
    this.cachedSelectors = null; // Invalidate selector cache

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
    this.cachedSelectors = null; // Invalidate selector cache

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