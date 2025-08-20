/**
 * Prompt Library Injector module
 * 
 * Main orchestration class that manages the prompt library integration.
 * Handles icon injection, prompt selector display, and coordinates between
 * all the modular components.
 */

import type { Prompt, InsertionResult } from '../types/index';
import { UIElementFactory } from '../ui/element-factory';
import { EventManager } from '../ui/event-manager';
import { KeyboardNavigationManager } from '../ui/keyboard-navigation';
import { DOMUtils } from '../utils/dom';
import { warn, error, debug, isDebugMode, refreshDebugMode } from '../utils/logger';
import { getPrompts, createPromptListItem, isSiteEnabled, getSettings, type ExtensionSettings, type CustomSite } from '../utils/storage';
import { injectCSS } from '../utils/styles';
import { ThemeManager } from '../utils/theme-manager';

import { PlatformInsertionManager } from './insertion-manager';

export interface InjectorState {
  icon: HTMLElement | null;
  currentTextarea: HTMLElement | null;
  promptSelector: HTMLElement | null;
  isInitialized: boolean;
  isSiteEnabled: boolean;
  detectionTimeout: number | null;
  mutationObserver: MutationObserver | null;
  hostname: string;
  instanceId: string;
  settings: ExtensionSettings | null;
}

export interface CustomSelectorRetry {
  attempts: number;
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  currentDelay: number;
  timeoutId: number | null;
  selector: string | null;
  positioning: string | null;
}

export interface SPAState {
  lastUrl: string;
  navigationDetected: boolean;
  routeChangeTimeout: number | null;
}

export class PromptLibraryInjector {
  private state: InjectorState;
  private eventManager: EventManager;
  private uiFactory: UIElementFactory;
  private keyboardNav: KeyboardNavigationManager | null;
  private platformManager: PlatformInsertionManager;
  private customSelectorRetry: CustomSelectorRetry;
  private spaState: SPAState;
  private selectorCache: Map<string, HTMLElement[]>;
  private lastCacheTime: number;
  private readonly cacheTimeout: number = 2000;

  constructor() {
    this.state = {
      icon: null,
      currentTextarea: null,
      promptSelector: null,
      isInitialized: false,
      isSiteEnabled: false,
      detectionTimeout: null,
      mutationObserver: null,
      hostname: String(window.location.hostname || ''),
      instanceId: `prompt-lib-${window.location.hostname}-${String(Date.now())}-${Math.random().toString(36).substr(2, 9)}`,
      settings: null
    };

    // Initialize specialized components
    this.eventManager = new EventManager();
    this.uiFactory = new UIElementFactory(this.state.instanceId);
    this.keyboardNav = null;

    // Initialize platform manager
    this.platformManager = new PlatformInsertionManager({
      debug: isDebugMode(),
      maxRetries: 3,
      timeout: 5000
    });

    // Enhanced retry system for custom selectors
    this.customSelectorRetry = {
      attempts: 0,
      maxAttempts: 30,
      baseDelay: 250,
      maxDelay: 2000,
      currentDelay: 250,
      timeoutId: null,
      selector: null,
      positioning: null
    };

    // SPA navigation detection
    this.spaState = {
      lastUrl: window.location.href,
      navigationDetected: false,
      routeChangeTimeout: null
    };

    // Performance optimization: caching for DOM queries
    this.selectorCache = new Map();
    this.lastCacheTime = 0;

    // Note: initialize() is now called externally to handle async site enablement checking
  }

  /**
   * Initializes the prompt library injector
   */
  async initialize(): Promise<void> {
    if (this.state.isInitialized) {return;}

    try {
      debug('Initializing my prompt manager for site', { hostname: this.state.hostname });

      // Load settings and check if site is enabled
      this.state.settings = await getSettings();
      this.state.isSiteEnabled = await isSiteEnabled(this.state.hostname);

      debug('Site enablement check completed', { 
        hostname: this.state.hostname,
        isSiteEnabled: this.state.isSiteEnabled,
        enabledSites: this.state.settings.enabledSites
      });

      // ALWAYS setup message listener first - even for disabled sites
      // This ensures we can respond to settings updates when sites are re-enabled
      this.setupMessageListener();

      // If site is disabled, stop here but keep the message listener active
      if (!this.state.isSiteEnabled) {
        debug('Site is disabled, minimal initialization only (message listener active)', { hostname: this.state.hostname });
        this.state.isInitialized = true; // Mark as initialized to prevent re-initialization
        return;
      }

      // Full initialization for enabled sites
      try {
        await this.initializeForEnabledSite();
        debug('Full initialization completed, setting isInitialized = true');
        // Set initialization flag after full setup is complete
        this.state.isInitialized = true;
      } catch (enabledSiteErr) {
        error('Error during full initialization for enabled site', enabledSiteErr as Error);
        // Don't reset isInitialized to false, as we still want message listener active
        throw enabledSiteErr;
      }

    } catch (err) {
      error('Error during initialization', err as Error);
      // Only reset isInitialized to false if we haven't set up the message listener
      if (this.state.isSiteEnabled) {
        this.state.isInitialized = false;
      }
      throw err; // Re-throw the error so tests can catch it if needed
    }
  }

  /**
   * Performs full initialization for enabled sites
   */
  private async initializeForEnabledSite(): Promise<void> {
    try {
      debug('Performing full initialization for enabled site', { hostname: this.state.hostname });

      // Inject CSS styles
      injectCSS();

      // Initialize platform strategies for enabled sites only
      debug('Initializing platform strategies for enabled site');
      await this.platformManager.initializeStrategies();

      // Setup SPA monitoring for dynamic navigation detection
      this.setupSPAMonitoring();

      // Wait for page to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { this.startDetection(); });
      } else {
        this.startDetection();
      }

      debug('Full initialization completed for enabled site', { hostname: this.state.hostname });

    } catch (err) {
      error('Error during full initialization', err as Error);
      throw err;
    }
  }

  /**
   * Starts the detection process for text areas and icon injection
   */
  private startDetection(): void {
    // Initial detection
    this.detectAndInjectIcon();

    // For dynamic content loading, retry detection periodically
    let retryCount = 0;
    const maxRetries = 20;
    const retryInterval = setInterval(() => {
      if (retryCount >= maxRetries || this.state.currentTextarea) {
        clearInterval(retryInterval);
        return;
      }
      this.detectAndInjectIcon();
      retryCount++;
    }, 500);

    // Create mutation observer for dynamic content
    this.state.mutationObserver = new MutationObserver((mutations) => {
      let shouldRedetect = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldRedetect = true;
          break;
        }
      }
      if (shouldRedetect) {
        setTimeout(() => {
          this.detectAndInjectIcon();
        }, 100);
      }
    });

    // Start observing
    this.state.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also detect on focus events for input elements
    const focusHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.matches('textarea, div[contenteditable="true"]')) {
        setTimeout(() => {
          this.detectAndInjectIcon();
        }, 100);
      }
    };
    this.eventManager.addTrackedEventListener(document, 'focusin', focusHandler);
  }

  /**
   * Sets up message listener for settings updates from popup
   */
  private setupMessageListener(): void {
    debug('Setting up message listener', { hostname: this.state.hostname });

    chrome.runtime.onMessage.addListener((message: Record<string, unknown>, sender, sendResponse) => {
      debug('Received message', { action: message.action });

      if (message.action === 'settingsUpdated' && message.settings) {
        void this.handleSettingsUpdate(message.settings as ExtensionSettings);
        sendResponse({ success: true });
      } else if (message.action === 'reinitialize' && message.reason) {
        void this.handleReinitialize(message.reason as string);
        sendResponse({ success: true });
      } else if (message.action === 'testSelector') {
        const result = this.handleSelectorTest(message as { selector: string; placement: string; offset: { x: number; y: number }; zIndex: number });
        sendResponse(result);
      } else {
        debug('Ignoring unrecognized message', { action: message.action });
        sendResponse({ success: false, error: 'Unknown message action' });
      }
      return true; // Keep message channel open for async response
    });

    debug('Message listener setup completed');
  }

  /**
   * Handle settings update from popup
   */
  private async handleSettingsUpdate(newSettings: ExtensionSettings): Promise<void> {
    try {
      debug('Received settings update', { hostname: this.state.hostname });

      // Refresh debug mode cache when settings are updated
      refreshDebugMode();

      this.state.settings = newSettings;
      const wasSiteEnabled = this.state.isSiteEnabled;
      this.state.isSiteEnabled = await isSiteEnabled(this.state.hostname);

      debug('Site enablement status changed', {
        hostname: this.state.hostname,
        enabled: this.state.isSiteEnabled
      });

      if (wasSiteEnabled && !this.state.isSiteEnabled) {
        // Site was disabled - partial cleanup but keep message listener
        debug('Site disabled, performing partial cleanup', { hostname: this.state.hostname });
        this.partialCleanup();
      } else if (!wasSiteEnabled && this.state.isSiteEnabled) {
        // Site was enabled - perform full initialization
        debug('Site re-enabled, performing full initialization', { hostname: this.state.hostname });
        
        // Clear the cache to ensure fresh detection
        this.selectorCache.clear();
        this.lastCacheTime = 0;
        
        // Perform full initialization for the newly enabled site (includes strategy initialization)
        await this.initializeForEnabledSite();
        
        // Force immediate detection after a short delay to ensure DOM is ready
        setTimeout(() => {
          this.detectAndInjectIcon();
        }, 100);
        
        // Also try after a longer delay as fallback
        setTimeout(() => {
          if (!this.state.icon) {
            this.detectAndInjectIcon();
          }
        }, 500);
      } else {
        debug('No site enablement change, updating settings only');
      }
    } catch (err) {
      error('Error handling settings update', err as Error);
    }
  }

  /**
   * Handle reinitialize request
   */
  private async handleReinitialize(reason: string): Promise<void> {
    try {
      debug('Received reinitialize request', { reason, hostname: this.state.hostname });
      this.cleanup();
      await this.initialize();
    } catch (err) {
      error('Error handling reinitialize request', err as Error);
    }
  }

  /**
   * Handle selector test request
   */
  private handleSelectorTest(message: { selector: string; placement: string; offset: { x: number; y: number }; zIndex: number }): { success: boolean; error?: string; elementCount?: number } {
    try {
      debug('Testing selector', { selector: message.selector, placement: message.placement });

      // Find all matching elements
      const elements = document.querySelectorAll(message.selector);
      if (elements.length === 0) {
        const errorMsg = `No elements found matching selector "${message.selector}"`;
        warn('Selector test failed - no elements found', { selector: message.selector });
        return { success: false, error: errorMsg };
      }

      // Use the first matching element for positioning test
      const element = elements[0] as HTMLElement;
      const rect = element.getBoundingClientRect();

      // Check if element is visible
      if (rect.width === 0 && rect.height === 0) {
        const errorMsg = `Element found but has zero dimensions (may be hidden)`;
        warn('Selector test - element has zero dimensions', { selector: message.selector });
        return { success: false, error: errorMsg };
      }

      // Create temporary test element to show positioning
      const testElement = document.createElement('div');
      testElement.textContent = `🎯 Test (${String(elements.length)} found)`;
      testElement.style.cssText = `
        position: absolute;
        background: #10b981;
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        z-index: ${String(message.zIndex)};
        pointer-events: none;
        border: 2px solid #059669;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        white-space: nowrap;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      `;

      // Add the element to DOM first to get proper dimensions
      document.body.appendChild(testElement);

      // Calculate position after element is in DOM
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      const testElementRect = testElement.getBoundingClientRect();

      switch (message.placement) {
        case 'before':
          testElement.style.top = `${String(rect.top + scrollTop + message.offset.y)}px`;
          testElement.style.left = `${String(rect.left + scrollLeft - testElementRect.width + message.offset.x)}px`;
          break;
        case 'after':
          testElement.style.top = `${String(rect.top + scrollTop + message.offset.y)}px`;
          testElement.style.left = `${String(rect.right + scrollLeft + message.offset.x)}px`;
          break;
        case 'inside-start':
          testElement.style.top = `${String(rect.top + scrollTop + message.offset.y)}px`;
          testElement.style.left = `${String(rect.left + scrollLeft + message.offset.x)}px`;
          break;
        case 'inside-end':
          testElement.style.top = `${String(rect.top + scrollTop + message.offset.y)}px`;
          testElement.style.left = `${String(rect.right + scrollLeft - testElementRect.width + message.offset.x)}px`;
          break;
        default:
          testElement.style.top = `${String(rect.top + scrollTop + message.offset.y)}px`;
          testElement.style.left = `${String(rect.right + scrollLeft + message.offset.x)}px`;
          break;
      }

      // Highlight the target element temporarily
      const originalOutline = element.style.outline;
      const originalTransition = element.style.transition;
      element.style.transition = 'outline 0.2s ease';
      element.style.outline = '3px solid #10b981';

      // Remove highlights after 3 seconds
      setTimeout(() => {
        if (testElement.parentNode) {
          testElement.parentNode.removeChild(testElement);
        }
        // Restore original outline
        element.style.outline = originalOutline;
        element.style.transition = originalTransition;
      }, 3000);

      debug('Selector test successful', { 
        selector: message.selector, 
        elementCount: elements.length,
        placement: message.placement 
      });

      return { 
        success: true, 
        elementCount: elements.length 
      };

    } catch (err) {
      const errorMsg = `Selector test failed: ${err instanceof Error ? err.message : String(err)}`;
      error('Selector test failed', err as Error, { selector: message.selector });
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Sets up SPA monitoring for navigation detection
   */
  private setupSPAMonitoring(): void {
    // Monitor URL changes for SPA navigation
    const checkUrlChange = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== this.spaState.lastUrl) {
        this.spaState.lastUrl = currentUrl;
        this.spaState.navigationDetected = true;
        
        // Re-initialize after navigation
        setTimeout(() => {
          this.cleanup();
          void this.initialize();
        }, 1000);
      }
    };

    // Check for URL changes periodically
    setInterval(checkUrlChange, 1000);

    // Also listen for popstate events
    this.eventManager.addTrackedEventListener(window, 'popstate', checkUrlChange);
  }

  /**
   * Detects text areas and injects icons
   */
  private detectAndInjectIcon(): void {
    try {
      if (!this.state.isSiteEnabled) {
        return;
      }

      debug('Starting icon detection');

      const selectors = this.platformManager.getAllSelectors();
      debug('Using selectors for detection', { totalSelectors: selectors.length });

      const textarea = this.findTextareaWithCaching(selectors);

      if (textarea) {
        debug('Textarea found', { tagName: textarea.tagName, id: textarea.id });

        if (textarea !== this.state.currentTextarea) {
          this.state.currentTextarea = textarea;
          this.injectIcon(textarea);
        }
      } else {
        debug('No textarea found', { selectorsChecked: selectors.length });
      }
    } catch (err) {
      error('Error during icon detection and injection', err as Error);
    }
  }

  /**
   * Finds textarea with caching for performance
   */
  private findTextareaWithCaching(selectors: string[]): HTMLElement | null {
    const now = Date.now();
    const cacheKey = selectors.join(',');

    // Use cache if it's still valid
    if (now - this.lastCacheTime < this.cacheTimeout && this.selectorCache.has(cacheKey)) {
      const cached = this.selectorCache.get(cacheKey);
      if (cached && cached.length > 0) {
        // Return the first visible element
        for (const element of cached) {
          if (this.isElementVisible(element)) {
            return element;
          }
        }
      }
    }

    // Find elements and cache them
    const elements: HTMLElement[] = [];
    for (const selector of selectors) {
      try {
        const found = Array.from(document.querySelectorAll(selector));
        // Elements found, continuing search
        elements.push(...(found as HTMLElement[]));
      } catch (error) {
        warn(`Invalid selector: ${selector}`, { error });
      }
    }

    debug('DOM search completed', {
      selectorsChecked: selectors.length,
      elementsFound: elements.length
    });

    this.selectorCache.set(cacheKey, elements);
    this.lastCacheTime = now;

    // Return the first visible element
    for (const element of elements) {
      if (this.isElementVisible(element)) {
        debug('Found visible textarea element', { tagName: element.tagName });
        return element;
      }
    }

    debug('No visible textarea elements found', { totalElementsFound: elements.length });

    return null;
  }

  /**
   * Checks if an element is visible
   */
  private isElementVisible(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && 
           window.getComputedStyle(element).display !== 'none';
  }

  /**
   * Injects the icon near the textarea
   */
  private injectIcon(textarea: HTMLElement): void {
    try {
      debug('Starting icon injection', { textareaTag: textarea.tagName });

      // Remove existing icon
      if (this.state.icon) {
        this.state.icon.remove();
        this.state.icon = null;
      }

      // Create platform-specific icon
      const icon = this.platformManager.createIcon(this.uiFactory);
      if (!icon) {
        warn('Failed to create platform icon');
        return;
      }

      this.state.icon = icon;
      debug('Icon created successfully');

      // Add click handler
      this.eventManager.addTrackedEventListener(icon, 'click', (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        void this.showPromptSelector(textarea);
      });

      // Try to inject into platform-specific container first
      const containerSelector = this.platformManager.getButtonContainerSelector();
      let injected = false;

      if (containerSelector) {
        // For Claude, find the Research button and inject after it
        if (this.state.hostname === 'claude.ai') {
          // Look for Research button by its text content
          const buttons = document.querySelectorAll('button');
          let researchButtonContainer = null;
          
          for (const button of buttons) {
            const textElement = button.querySelector('p');
            if (textElement && textElement.textContent?.trim() === 'Research') {
              // Found the Research button, get its parent container
              researchButtonContainer = button.closest('div.flex.shrink.min-w-8');
              break;
            }
          }
          
          if (researchButtonContainer && researchButtonContainer.parentElement) {
            // Create a similar wrapper div structure for our button
            const buttonWrapper = document.createElement('div');
            buttonWrapper.className = 'flex shrink min-w-8 !shrink-0';
            buttonWrapper.setAttribute('data-state', 'closed');
            buttonWrapper.style.opacity = '1';
            buttonWrapper.style.transform = 'none';
            buttonWrapper.appendChild(icon);
            
            // Insert after the Research button container
            researchButtonContainer.parentElement.insertBefore(buttonWrapper, researchButtonContainer.nextSibling);
            injected = true;
            debug('Icon injected after Research button in Claude toolbar');
          }
        }
        
        // For Perplexity, find the toolbar container and inject as first child
        if (this.state.hostname === 'www.perplexity.ai' && !injected) {
          // Look for the toolbar container with class pattern matching
          const toolbarContainer = document.querySelector('div.bg-raised[class*="flex"][class*="items-center"][class*="rounded-full"]');
          if (toolbarContainer) {
            // Insert as the first child in the container
            toolbarContainer.insertBefore(icon, toolbarContainer.firstChild);
            injected = true;
            debug('Icon injected as first button in Perplexity toolbar');
          }
        }
        
        // For ChatGPT, find the container and inject as first child
        if (this.state.hostname === 'chatgpt.com' && !injected) {
          const container = document.querySelector(containerSelector);
          if (container) {
            // Insert as the first child in the container
            container.insertBefore(icon, container.firstChild);
            injected = true;
            debug('Icon injected as first button in ChatGPT toolbar');
          }
        }
        
        // Fallback to generic container selector
        if (!injected) {
          const container = document.querySelector(containerSelector);
          if (container) {
            container.appendChild(icon);
            injected = true;
            debug('Icon injected into platform container');
          }
        }
      }

      // Check if we have custom positioning configuration (declare outside if block for scope)
      const customConfig = this.platformManager.getCustomSiteConfig();

      // If not injected into container, handle custom positioning or fallback to floating
      if (!injected) {
        let customPositioned = false;

        if (customConfig?.positioning && customConfig.positioning.selector) {
          // Check if the current textarea matches the custom selector
          const customSelector = customConfig.positioning.selector;
          try {
            let referenceElement: HTMLElement | null = null;
            
            if (textarea.matches(customSelector)) {
              // Use custom positioning for the textarea itself
              referenceElement = textarea;
              debug('Using textarea as custom positioning reference element');
            } else {
              // Try to find the custom reference element
              const foundElement = document.querySelector(customSelector);
              if (foundElement) {
                referenceElement = foundElement as HTMLElement;
                debug('Found custom positioning reference element', { 
                  selector: customSelector,
                  tag: referenceElement.tagName,
                  id: referenceElement.id
                });
              } else {
                debug('Custom reference element not found', { selector: customSelector });
              }
            }
            
            // If we have a reference element, try custom DOM positioning
            if (referenceElement) {
              customPositioned = this.positionCustomIcon(icon, referenceElement, customConfig);
              if (customPositioned) {
                debug('Icon positioned successfully with custom DOM insertion');
                return; // Exit here - positioning is complete
              } else {
                debug('Custom DOM positioning failed, will try absolute positioning fallback');
              }
            }
          } catch (selectorError) {
            warn('Invalid custom selector', { selector: customSelector, error: selectorError });
          }
        }

        // If custom positioning failed or wasn't used, try absolute positioning fallback for custom configs
        if (customConfig?.positioning && customConfig.positioning.selector && !customPositioned) {
          warn('DOM insertion failed, using absolute positioning fallback', { 
            placement: customConfig.positioning.placement,
            selector: customConfig.positioning.selector
          });
          
          // Try to find the reference element again for absolute positioning fallback
          const fallbackSelector = customConfig.positioning.selector;
          try {
            const referenceElement = textarea.matches(fallbackSelector) ? 
              textarea : document.querySelector(fallbackSelector);
            
            if (referenceElement) {
              this.positionIconAbsolute(icon, referenceElement as HTMLElement, customConfig);
              document.body.appendChild(icon);
              debug('Icon positioned with absolute fallback');
              return; // Exit here - positioning is complete
            }
          } catch (fallbackError) {
            warn('Absolute positioning fallback also failed', { error: fallbackError });
          }
        }

        // Ultimate fallback: default floating positioning
        this.positionIcon(icon, textarea);
        document.body.appendChild(icon);
        debug('Icon positioned with default floating position (final fallback)');
      }

      debug('Icon injection completed', { 
        injected, 
        hasCustomConfig: !!(customConfig?.positioning)
      });

    } catch (err) {
      error('Failed to inject icon', err as Error);
    }
  }

  /**
   * Positions the icon relative to the textarea
   */
  private positionIcon(icon: HTMLElement, textarea: HTMLElement): void {
    // Convert icon to use absolute positioning for default fallback
    UIElementFactory.convertToAbsolutePositioning(icon);
    
    const rect = textarea.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    // Position icon to the right of the textarea
    icon.style.position = 'absolute';
    icon.style.top = `${String(rect.top + scrollTop + 10)}px`;
    icon.style.left = `${String(rect.right + scrollLeft + 10)}px`;
    icon.style.zIndex = '999999';
  }

  /**
   * Positions icon using absolute positioning as fallback for custom configs
   */
  private positionIconAbsolute(icon: HTMLElement, referenceElement: HTMLElement, customConfig: CustomSite): void {
    try {
      if (!customConfig.positioning) {
        return;
      }
      
      const { placement, offset = { x: 0, y: 0 }, zIndex = 999999 } = customConfig.positioning;
      
      // Convert icon to use absolute positioning for fallback
      UIElementFactory.convertToAbsolutePositioning(icon);
      
      const rect = referenceElement.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      icon.style.position = 'absolute';
      icon.style.zIndex = String(zIndex);

      // Calculate position based on placement (original absolute positioning logic)
      let top = rect.top + scrollTop + offset.y;
      let left = rect.left + scrollLeft + offset.x;

      switch (placement) {
        case 'before':
          // Position before (left of) the reference element
          left = rect.left + scrollLeft - icon.offsetWidth + offset.x;
          top = rect.top + scrollTop + offset.y;
          break;
        case 'after':
          // Position after (right of) the reference element
          left = rect.right + scrollLeft + offset.x;
          top = rect.top + scrollTop + offset.y;
          break;
        case 'inside-start':
          // Position at the start (left side) inside the reference element
          left = rect.left + scrollLeft + offset.x;
          top = rect.top + scrollTop + offset.y;
          break;
        case 'inside-end':
          // Position at the end (right side) inside the reference element
          left = rect.right + scrollLeft - icon.offsetWidth + offset.x;
          top = rect.top + scrollTop + offset.y;
          break;
        default:
          warn('Invalid placement value for absolute positioning fallback', { placement });
          return;
      }

      icon.style.top = `${String(top)}px`;
      icon.style.left = `${String(left)}px`;

      debug('Absolute positioning fallback applied', { 
        placement, 
        offset, 
        zIndex,
        calculatedPosition: { top, left }
      });

    } catch (err) {
      error('Failed to apply absolute positioning fallback', err as Error);
    }
  }

  /**
   * Positions icon using custom positioning configuration
   */
  private positionCustomIcon(icon: HTMLElement, referenceElement: HTMLElement, customConfig: CustomSite): boolean {
    try {
      if (!customConfig.positioning) {
        return false;
      }
      
      const { placement, offset = { x: 0, y: 0 }, zIndex = 999999 } = customConfig.positioning;
      
      // Convert icon to use relative positioning for DOM insertion
      UIElementFactory.convertToRelativePositioning(icon);
      
      // Apply z-index if needed for layering
      icon.style.zIndex = String(zIndex);
      
      // Apply offset styles if specified
      if (offset.x !== 0 || offset.y !== 0) {
        // Add margin-based offset for DOM-inserted elements
        const marginLeft = offset.x !== 0 ? `${String(offset.x)}px` : '';
        const marginTop = offset.y !== 0 ? `${String(offset.y)}px` : '';
        
        if (marginLeft) {
          icon.style.marginLeft = marginLeft;
        }
        if (marginTop) {
          icon.style.marginTop = marginTop;
        }
      }

      // Insert the icon into the DOM based on placement
      let inserted = false;
      
      switch (placement) {
        case 'before':
          // Insert element before the reference element in the DOM
          inserted = DOMUtils.insertBefore(icon, referenceElement);
          break;
          
        case 'after':
          // Insert element after the reference element in the DOM
          inserted = DOMUtils.insertAfter(icon, referenceElement);
          break;
          
        case 'inside-start':
          // Insert element inside the reference element at the beginning
          inserted = DOMUtils.prependChild(referenceElement, icon);
          break;
          
        case 'inside-end':
          // Insert element inside the reference element at the end
          inserted = DOMUtils.appendChild(referenceElement, icon);
          break;
          
        default:
          warn('Invalid placement value for DOM insertion', { placement });
          return false;
      }

      if (!inserted) {
        warn('Failed to insert icon into DOM with custom positioning', { 
          placement, 
          referenceTag: referenceElement.tagName,
          referenceId: referenceElement.id,
          referenceClass: referenceElement.className
        });
        return false;
      }

      debug('Custom DOM insertion completed successfully', { 
        placement, 
        offset, 
        zIndex,
        referenceElement: {
          tag: referenceElement.tagName,
          id: referenceElement.id,
          class: referenceElement.className
        }
      });

      return true;
    } catch (err) {
      error('Failed to apply custom DOM insertion', err as Error);
      return false;
    }
  }

  /**
   * Shows the prompt selector modal
   */
  async showPromptSelector(targetElement: HTMLElement): Promise<void> {
    try {
      debug('Showing prompt selector', {
        textareaTag: targetElement.tagName,
        hasExistingSelector: !!this.state.promptSelector
      });

      // Remove existing selector
      this.closePromptSelector();

      // Get prompts from storage
      const prompts = await getPrompts();
      debug('Retrieved prompts for selector', { count: prompts.length });

      // Create selector UI
      this.state.promptSelector = this.createPromptSelectorUI(prompts);
      
      // Position selector
      this.positionPromptSelector(this.state.promptSelector, targetElement);

      // Add event listeners
      this.setupPromptSelectorEvents(this.state.promptSelector, prompts, targetElement);

      // Add to DOM
      document.body.appendChild(this.state.promptSelector);

      // Initialize keyboard navigation
      this.keyboardNav = new KeyboardNavigationManager(this.state.promptSelector, this.eventManager);
      this.keyboardNav.initialize();

      debug('Prompt selector created and keyboard navigation initialized', {
        promptCount: prompts.length
      });

    } catch (err) {
      error('Failed to show prompt selector', err as Error);
      this.closePromptSelector();
    }
  }

  /**
   * Creates the prompt selector UI
   */
  private createPromptSelectorUI(prompts: Prompt[]): HTMLElement {
    const selector = document.createElement('div');
    selector.className = 'prompt-library-selector';
    selector.setAttribute('role', 'dialog');
    selector.setAttribute('aria-modal', 'true');
    selector.setAttribute('aria-labelledby', 'prompt-selector-title');

    // Apply current theme
    const themeManager = ThemeManager.getInstance();
    const currentTheme = themeManager.getCurrentTheme();
    selector.classList.add(`${currentTheme}-theme`);

    // Create header
    const header = document.createElement('div');
    header.className = 'prompt-selector-header';
    
    const title = document.createElement('h3');
    title.id = 'prompt-selector-title';
    title.textContent = 'Select a Prompt';
    
    const closeButton = document.createElement('button');
    closeButton.className = 'close-selector';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Close prompt selector');
    closeButton.textContent = '×';
    
    header.appendChild(title);
    header.appendChild(closeButton);

    // Create search section
    const searchDiv = document.createElement('div');
    searchDiv.className = 'prompt-search';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'search-input';
    searchInput.placeholder = 'Search prompts...';
    searchInput.setAttribute('autocomplete', 'off');
    
    searchDiv.appendChild(searchInput);

    // Create prompt list
    const promptList = document.createElement('div');
    promptList.className = 'prompt-list';
    promptList.setAttribute('role', 'listbox');

    // Add prompt items
    if (prompts.length > 0) {
      prompts.forEach((prompt, index) => {
        const promptItem = createPromptListItem(prompt, index, 'prompt-item');
        promptList.appendChild(promptItem);
      });
    } else {
      const noPrompts = document.createElement('div');
      noPrompts.className = 'no-prompts';
      noPrompts.textContent = 'No prompts found. Add some in the extension popup!';
      promptList.appendChild(noPrompts);
    }

    // Assemble selector
    selector.appendChild(header);
    selector.appendChild(searchDiv);
    selector.appendChild(promptList);

    return selector;
  }

  /**
   * Positions the prompt selector
   */
  private positionPromptSelector(selector: HTMLElement, targetElement: HTMLElement): void {
    const rect = targetElement.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    selector.style.position = 'absolute';
    selector.style.top = `${String(rect.bottom + scrollTop + 5)}px`;
    selector.style.left = `${String(rect.left + scrollLeft)}px`;
    selector.style.zIndex = '1000000';
  }

  /**
   * Sets up event listeners for the prompt selector
   */
  private setupPromptSelectorEvents(selector: HTMLElement, prompts: Prompt[], targetElement: HTMLElement): void {
    // Close button
    const closeButton = selector.querySelector('.close-selector');
    if (closeButton) {
      this.eventManager.addTrackedEventListener(closeButton as HTMLElement, 'click', () => {
        this.closePromptSelector();
      });
    }

    // Prompt item clicks
    const promptItems = selector.querySelectorAll('.prompt-item');
    promptItems.forEach(item => {
      this.eventManager.addTrackedEventListener(item as HTMLElement, 'click', () => {
        const promptId = (item as HTMLElement).dataset.promptId;
        const prompt = prompts.find(p => p.id === promptId);
        if (prompt) {
          void this.insertPrompt(targetElement, prompt.content);
          this.closePromptSelector();
        }
      });
    });

    // Search functionality
    const searchInput = selector.querySelector('.search-input');
    if (searchInput) {
      this.eventManager.addTrackedEventListener(searchInput as HTMLInputElement, 'input', (e: Event) => {
        const target = e.target as HTMLInputElement;
        this.filterPrompts(target.value, prompts, selector);
      });
    }

    // Outside click to close
    setTimeout(() => {
      const outsideClickHandler = (e: Event) => {
        const target = e.target as HTMLElement;
        if (this.state.promptSelector && 
            !this.state.promptSelector.contains(target) && 
            this.state.icon && 
            !this.state.icon.contains(target)) {
          this.closePromptSelector();
        }
      };
      this.eventManager.addTrackedEventListener(document, 'click', outsideClickHandler);
    }, 100);
  }

  /**
   * Filters prompts based on search term
   */
  private filterPrompts(searchTerm: string, prompts: Prompt[], selector: HTMLElement): void {
    const filteredPrompts = prompts.filter(prompt => 
      prompt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prompt.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prompt.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const promptList = selector.querySelector('.prompt-list');
    if (!promptList) {return;}

    // Clear existing content
    while (promptList.firstChild) {
      promptList.removeChild(promptList.firstChild);
    }

    // Add filtered items
    if (filteredPrompts.length > 0) {
      filteredPrompts.forEach((prompt, index) => {
        const promptItem = createPromptListItem(prompt, index, 'filtered-prompt-item');
        promptList.appendChild(promptItem);
      });
    } else {
      const noPrompts = document.createElement('div');
      noPrompts.className = 'no-prompts';
      noPrompts.textContent = 'No matching prompts found.';
      promptList.appendChild(noPrompts);
    }

    // Update keyboard navigation
    if (this.keyboardNav) {
      this.keyboardNav.updateItems();
    }
  }

  /**
   * Inserts a prompt into the target element
   */
  private async insertPrompt(element: HTMLElement, content: string): Promise<InsertionResult> {
    try {
      const result = await this.platformManager.insertPrompt(element, content);
      
      if (result.success) {
        debug('Prompt inserted successfully', {
          method: result.method,
          contentLength: content.length
        });
      } else {
        warn('Prompt insertion failed', { error: result.error });
      }
      
      return result;
    } catch (error) {
      error('Error inserting prompt', error as Error);
      return {
        success: false,
        error: 'Insertion failed due to error'
      };
    }
  }

  /**
   * Closes the prompt selector
   */
  private closePromptSelector(): void {
    if (this.state.promptSelector) {
      this.state.promptSelector.remove();
      this.state.promptSelector = null;
    }

    if (this.keyboardNav) {
      this.keyboardNav.destroy();
      this.keyboardNav = null;
    }
  }

  /**
   * Partial cleanup - removes UI elements but preserves message listener for re-enabling
   */
  private partialCleanup(): void {
    debug('Starting partial cleanup (preserving message listener)', { instanceId: this.state.instanceId });

    // Clear timeouts
    if (this.state.detectionTimeout) {
      clearTimeout(this.state.detectionTimeout);
      this.state.detectionTimeout = null;
    }

    if (this.customSelectorRetry.timeoutId) {
      clearTimeout(this.customSelectorRetry.timeoutId);
      this.customSelectorRetry.timeoutId = null;
    }

    if (this.spaState.routeChangeTimeout) {
      clearTimeout(this.spaState.routeChangeTimeout);
      this.spaState.routeChangeTimeout = null;
    }

    // Disconnect mutation observer
    if (this.state.mutationObserver) {
      this.state.mutationObserver.disconnect();
      this.state.mutationObserver = null;
    }

    // Clean up UI elements
    if (this.state.icon) {
      this.state.icon.remove();
      this.state.icon = null;
    }

    this.closePromptSelector();

    // Clean up managers (but not message listeners)
    this.eventManager.cleanup();
    this.platformManager.cleanup();

    // Clear caches
    this.selectorCache.clear();

    // Reset state but keep isInitialized true to maintain message listener
    this.state.currentTextarea = null;

    debug('Partial cleanup completed (message listener preserved)', { instanceId: this.state.instanceId });
  }

  /**
   * Cleans up all resources
   */
  cleanup(): void {
    debug('Starting full cleanup', { instanceId: this.state.instanceId });

    // Clear timeouts
    if (this.state.detectionTimeout) {
      clearTimeout(this.state.detectionTimeout);
      this.state.detectionTimeout = null;
    }

    if (this.customSelectorRetry.timeoutId) {
      clearTimeout(this.customSelectorRetry.timeoutId);
      this.customSelectorRetry.timeoutId = null;
    }

    if (this.spaState.routeChangeTimeout) {
      clearTimeout(this.spaState.routeChangeTimeout);
      this.spaState.routeChangeTimeout = null;
    }

    // Disconnect mutation observer
    if (this.state.mutationObserver) {
      this.state.mutationObserver.disconnect();
      this.state.mutationObserver = null;
    }

    // Clean up UI elements
    if (this.state.icon) {
      this.state.icon.remove();
      this.state.icon = null;
    }

    this.closePromptSelector();

    // Clean up managers
    this.eventManager.cleanup();
    this.platformManager.cleanup();

    // Clear caches
    this.selectorCache.clear();

    // Reset state
    this.state.isInitialized = false;
    this.state.currentTextarea = null;

    debug('Full cleanup completed', { instanceId: this.state.instanceId });
  }
}