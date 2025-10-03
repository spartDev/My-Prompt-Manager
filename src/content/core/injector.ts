/**
 * Prompt Library Injector module
 * 
 * Main orchestration class that manages the prompt library integration.
 * Handles icon injection, prompt selector display, and coordinates between
 * all the modular components.
 */

import type { ComputePositionReturn } from '@floating-ui/dom';

import type { Prompt, InsertionResult } from '../types/index';
import { UIElementFactory } from '../ui/element-factory';
import { EventManager } from '../ui/event-manager';
import { KeyboardNavigationManager } from '../ui/keyboard-navigation';
import { DOMUtils } from '../utils/dom';
import { getElementFingerprintGenerator } from '../utils/element-fingerprint';
import { warn, error, debug, isDebugMode, refreshDebugMode } from '../utils/logger';
import { getPrompts, createPromptListItem, isSiteEnabled, getSettings, type ExtensionSettings, type CustomSite } from '../utils/storage';
import { injectCSS } from '../utils/styles';
import { ThemeManager } from '../utils/theme-manager';

import { PlatformInsertionManager } from './insertion-manager';

// Floating UI imports for robust positioning fallback

// Element fingerprinting for robust element identification

export interface InjectorState {
  icon: HTMLElement | null;
  currentTextarea: HTMLElement | null;
  promptSelector: HTMLElement | null;
  currentTargetElement: HTMLElement | null;
  isInitialized: boolean;
  isSiteEnabled: boolean;
  detectionTimeout: number | null;
  mutationObserver: MutationObserver | null;
  spaMonitoringInterval: NodeJS.Timeout | null;
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
    const hostname = window.location.hostname || '';

    this.state = {
      icon: null,
      currentTextarea: null,
      promptSelector: null,
      currentTargetElement: null,
      isInitialized: false,
      isSiteEnabled: false,
      detectionTimeout: null,
      mutationObserver: null,
      spaMonitoringInterval: null,
      hostname,
      instanceId: `prompt-lib-${hostname}-${Date.now().toString()}-${Math.random().toString(36).slice(2, 11)}`,
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

    chrome.runtime.onMessage.addListener((message: Record<string, unknown>, _sender, sendResponse) => {
      debug('Received message', { action: message.action });

      if (message.action === 'settingsUpdated' && message.settings) {
        this.handleSettingsUpdate(message.settings as ExtensionSettings).catch((err: unknown) => {
          error('Failed to handle settings update', err as Error);
        });
        sendResponse({ success: true });
      } else if (message.action === 'reinitialize' && message.reason) {
        this.handleReinitialize(message.reason as string).catch((err: unknown) => {
          error('Failed to handle reinitialize', err as Error);
        });
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
          this.initialize().catch((err: unknown) => {
            error('Failed to re-initialize after navigation', err as Error);
          });
        }, 1000);
      }
    };

    // Check for URL changes periodically
    this.state.spaMonitoringInterval = setInterval(checkUrlChange, 1000);

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
          void this.injectIcon(textarea);
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
   * Type guard to check if value is an ElementFingerprint
   */
  private isElementFingerprint(value: unknown): value is ElementFingerprint {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const obj = value as Record<string, unknown>;
    return (
      typeof obj.primary === 'object' &&
      typeof obj.secondary === 'object' &&
      typeof obj.content === 'object' &&
      typeof obj.context === 'object' &&
      typeof obj.attributes === 'object' &&
      typeof obj.meta === 'object'
    );
  }

  /**
   * Removes all existing prompt library icons from the DOM
   * This prevents duplicate icons after extension reloads
   */
  private removeAllExistingIcons(): void {
    try {
      // Remove icons by cleanup class selector (covers all instances)
      const existingIcons = document.querySelectorAll('.prompt-library-cleanup-target');
      existingIcons.forEach(icon => {
        try {
          icon.remove();
        } catch (error) {
          // Expected errors: InvalidStateError (already removed), NotFoundError (parent changed)
          if (error instanceof DOMException && 
              (error.name === 'InvalidStateError' || error.name === 'NotFoundError')) {
            // Element was already removed or parent structure changed - continue silently
          } else {
            warn('Unexpected error removing existing icon', { error: String(error) });
          }
        }
      });

      // Remove icons by data attribute (additional safety)
      const dataIcons = document.querySelectorAll('[data-prompt-library-icon]');
      dataIcons.forEach(icon => {
        try {
          icon.remove();
        } catch (error) {
          // Expected errors: InvalidStateError (already removed), NotFoundError (parent changed)
          if (error instanceof DOMException && 
              (error.name === 'InvalidStateError' || error.name === 'NotFoundError')) {
            // Element was already removed or parent structure changed - continue silently
          } else {
            warn('Unexpected error removing data icon', { error: String(error) });
          }
        }
      });

      // Remove any floating icons (absolute positioned ones)
      const floatingIcons = document.querySelectorAll('[data-prompt-library-floating]');
      floatingIcons.forEach(icon => {
        try {
          icon.remove();
        } catch (error) {
          // Expected errors: InvalidStateError (already removed), NotFoundError (parent changed)
          if (error instanceof DOMException && 
              (error.name === 'InvalidStateError' || error.name === 'NotFoundError')) {
            // Element was already removed or parent structure changed - continue silently
          } else {
            warn('Unexpected error removing floating icon', { error: String(error) });
          }
        }
      });

      // Clean up CSS Anchor elements and anchor attributes
      const cssAnchorIcons = document.querySelectorAll('[data-positioning-method="css-anchor"]');
      let cssAnchorCleanedUp = 0;
      cssAnchorIcons.forEach(icon => {
        try {
          // Clean up anchor attributes from reference elements
          const anchors = document.querySelectorAll('[data-mpm-anchor-name]');
          anchors.forEach(anchor => {
            try {
              const anchorName = anchor.getAttribute('data-mpm-anchor-name');
              if (anchorName) {
                // Remove CSS anchor styles
                (anchor as HTMLElement).style.anchorName = '';
                anchor.removeAttribute('data-mpm-anchor-name');
              }
              cssAnchorCleanedUp++;
            } catch (anchorErr) {
              // Silently continue if anchor cleanup fails
              debug('Failed to clean up anchor attributes', { error: String(anchorErr) });
            }
          });
          icon.remove();
        } catch (error) {
          // Expected errors: InvalidStateError (already removed), NotFoundError (parent changed)
          if (error instanceof DOMException &&
              (error.name === 'InvalidStateError' || error.name === 'NotFoundError')) {
            // Element was already removed or parent structure changed - continue silently
          } else {
            warn('Unexpected error removing CSS Anchor icon', { error: String(error) });
          }
        }
      });

      // Clean up Floating UI elements and subscriptions
      const floatingUIIcons = document.querySelectorAll('[data-positioning-method="floating-ui"]');
      let floatingUICleanedUp = 0;
      floatingUIIcons.forEach(icon => {
        try {
          // Call cleanup function if it exists (stops autoUpdate subscription)
          interface IconWithCleanup extends HTMLElement {
            _floatingUICleanup?: () => void;
          }
          const iconWithCleanup = icon as IconWithCleanup;
          if (iconWithCleanup._floatingUICleanup && typeof iconWithCleanup._floatingUICleanup === 'function') {
            iconWithCleanup._floatingUICleanup();
            floatingUICleanedUp++;
          }
          icon.remove();
        } catch (error) {
          // Expected errors: InvalidStateError (already removed), NotFoundError (parent changed)
          if (error instanceof DOMException &&
              (error.name === 'InvalidStateError' || error.name === 'NotFoundError')) {
            // Element was already removed or parent structure changed - continue silently
          } else {
            warn('Unexpected error removing Floating UI icon', { error: String(error) });
          }
        }
      });

      // Also remove any prompt selectors that might be open
      const existingSelectors = document.querySelectorAll('.prompt-library-selector');
      existingSelectors.forEach(selector => {
        try {
          selector.remove();
        } catch (error) {
          // Expected errors: InvalidStateError (already removed), NotFoundError (parent changed)
          if (error instanceof DOMException && 
              (error.name === 'InvalidStateError' || error.name === 'NotFoundError')) {
            // Element was already removed or parent structure changed - continue silently
          } else {
            warn('Unexpected error removing selector', { error: String(error) });
          }
        }
      });

      debug('Removed all existing extension elements from DOM', {
        iconsRemoved: existingIcons.length,
        dataIconsRemoved: dataIcons.length,
        floatingIconsRemoved: floatingIcons.length,
        cssAnchorIconsRemoved: cssAnchorIcons.length,
        cssAnchorCleanedUp,
        floatingUIIconsRemoved: floatingUIIcons.length,
        floatingUICleanedUp,
        selectorsRemoved: existingSelectors.length
      });
    } catch (error) {
      warn('Error during global icon cleanup', { error: String(error) });
    }
  }

  /**
   * Injects the icon near the textarea
   */
  private async injectIcon(textarea: HTMLElement): Promise<void> {
    try {
      debug('Starting icon injection', { textareaTag: textarea.tagName });

      // Remove ALL existing icons from the DOM (not just current instance)
      // This prevents duplicates after extension reloads
      this.removeAllExistingIcons();

      // Clear current instance icon reference
      this.state.icon = null;

      // Create platform-specific icon
      const icon = this.platformManager.createIcon(this.uiFactory);
      if (!icon) {
        warn('Failed to create platform icon');
        return;
      }

      this.state.icon = icon;
      debug('Icon created successfully');

      // Mark icon with identifying attributes for cleanup (using non-conflicting class)
      icon.classList.add('prompt-library-cleanup-target');
      icon.setAttribute('data-prompt-library-icon', 'true');
      icon.setAttribute('data-instance-id', this.state.instanceId);

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
            if (!textElement) {
              continue;
            }

            const textContent = textElement.textContent;
            if (textContent && textContent.trim() === 'Research') {
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
          // Use the strategy's button container selector
          const toolbarContainer = document.querySelector(containerSelector);
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
        
        // For Mistral, find the ms-auto div and insert our button before it
        if (this.state.hostname === 'chat.mistral.ai' && !injected) {
          const container = document.querySelector(containerSelector);
          if (container) {
            // Find the ms-auto div within the container
            const msAutoDiv = container.querySelector('.flex.ms-auto');
            if (msAutoDiv) {
              // Insert our button before the ms-auto div
              container.insertBefore(icon, msAutoDiv);
              injected = true;
              debug('Icon injected before ms-auto div in Mistral toolbar');
            } else {
              // Fallback: insert as last child before any potential ms-auto elements
              container.appendChild(icon);
              injected = true;
              debug('Icon injected into Mistral container (ms-auto not found)');
            }
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

        if (customConfig?.positioning) {
          try {
            let referenceElement: HTMLElement | null = null;
            
            // PRIORITY 1: Try fingerprint matching (most robust)
            if (customConfig.positioning.fingerprint) {
              const fingerprintGenerator = getElementFingerprintGenerator();
              // Type guard to validate fingerprint structure
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              const rawFingerprint = customConfig.positioning.fingerprint;
              if (this.isElementFingerprint(rawFingerprint)) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                referenceElement = fingerprintGenerator.findElement(rawFingerprint);
                
                if (referenceElement) {
                  debug('Found element using fingerprint matching', {
                    tag: referenceElement.tagName,
                    id: referenceElement.id,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    confidence: rawFingerprint.meta.confidence
                  });
                } else {
                  debug('Fingerprint matching failed, trying fallback selector');
                }
              } else {
                debug('Invalid fingerprint structure, skipping fingerprint matching');
              }
            }
            
            // PRIORITY 2: Try legacy selector as fallback
            if (!referenceElement && customConfig.positioning.selector) {
              const customSelector = customConfig.positioning.selector;
              
              if (textarea.matches(customSelector)) {
                // Use custom positioning for the textarea itself
                referenceElement = textarea;
                debug('Using textarea as custom positioning reference element (selector fallback)');
              } else {
                // Try to find the custom reference element
                const foundElement = document.querySelector(customSelector);
                if (foundElement) {
                  referenceElement = foundElement as HTMLElement;
                  debug('Found custom positioning reference element using selector', { 
                    selector: customSelector,
                    tag: referenceElement.tagName,
                    id: referenceElement.id
                  });
                } else {
                  debug('Custom reference element not found with selector', { selector: customSelector });
                }
              }
            }
            
            // If we have a reference element, try 4-tier fallback positioning (hybrid approach)
            if (referenceElement) {
              // TIER 0: Try CSS Anchor Positioning (best - native browser API, 71% support)
              // Native CSS positioning for Chrome 125+, Edge 125+, Safari 26+, Opera 111+
              // Zero JavaScript overhead, GPU-accelerated, best performance
              if (DOMUtils.supportsCSSAnchorPositioning()) {
                customPositioned = this.positionIconWithCSSAnchor(icon, referenceElement, customConfig);
                if (customPositioned) {
                  debug('Icon positioned successfully with CSS Anchor (Tier 0 - Native)');
                  return; // Exit here - positioning is complete
                } else {
                  debug('CSS Anchor positioning failed, trying Floating UI');
                }
              }

              // TIER 1: Try Floating UI positioning (fallback for older browsers)
              // Production-grade JS positioning for browsers without CSS Anchor support
              // Works on Chrome 114+, Firefox, older Safari
              try {
                customPositioned = await this.positionIconWithFloatingUI(icon, referenceElement, customConfig);
                if (customPositioned) {
                  debug('Icon positioned successfully with Floating UI (Tier 1)');
                  return; // Exit here - positioning is complete
                }
              } catch (floatingErr) {
                debug('Floating UI positioning failed, trying DOM insertion', { error: String(floatingErr) });
              }

              // TIER 2: Try DOM insertion (fallback for Floating UI failures)
              if (!customPositioned) {
                customPositioned = this.positionCustomIcon(icon, referenceElement, customConfig);
                if (customPositioned) {
                  debug('Icon positioned successfully with DOM insertion (Tier 2)');
                  return; // Exit here - positioning is complete
                } else {
                  debug('DOM insertion failed, will try absolute positioning (Tier 3)');
                }
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
        // Mark floating icons for easier cleanup
        icon.setAttribute('data-prompt-library-floating', 'true');
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
   * Position icon using CSS Anchor Positioning API (Tier 0 - Native browser API)
   * Native CSS positioning for modern browsers (Chrome 125+, Edge 125+, Safari 26+, Opera 111+)
   * Zero JavaScript, GPU-accelerated, best performance for 71%+ of users
   * @param icon - The icon element to position
   * @param referenceElement - The element to position relative to
   * @param customConfig - Custom site configuration with positioning details
   * @returns boolean - true if positioning was successful, false otherwise
   */
  private positionIconWithCSSAnchor(
    icon: HTMLElement,
    referenceElement: HTMLElement,
    customConfig: CustomSite
  ): boolean {
    try {
      // Check if CSS Anchor Positioning is supported
      if (!DOMUtils.supportsCSSAnchorPositioning()) {
        debug('CSS Anchor Positioning not supported, falling back to other methods');
        return false;
      }

      if (!customConfig.positioning) {
        return false;
      }

      const { placement, offset = { x: 0, y: 0 }, zIndex = 999999, anchorId } = customConfig.positioning;

      // Use existing data-mpm-anchor if present, otherwise use config anchorId or generate new
      const existingAnchorId: string | null = referenceElement.getAttribute('data-mpm-anchor');
      const fallbackAnchorId = `mpm-${String(Date.now())}-${Math.random().toString(36).substring(2, 9)}`;
      // ESLint is confused about the type here, but TypeScript knows anchorId is string | undefined
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const trackingAnchorId: string = existingAnchorId ?? anchorId ?? fallbackAnchorId;

      // Generate a unique CSS anchor name for this element
      const cssAnchorName = `--mpm-anchor-${String(Date.now())}-${Math.random().toString(36).substring(2, 9)}`;

      // Set the reference element as the CSS anchor
      referenceElement.style.anchorName = cssAnchorName;

      // Add data-mpm-anchor for fast recovery lookup (only if not already present)
      if (!existingAnchorId) {
        referenceElement.setAttribute('data-mpm-anchor', trackingAnchorId);
      }

      // Store the CSS anchor name for cleanup
      referenceElement.setAttribute('data-mpm-anchor-name', cssAnchorName);

      // Configure icon for CSS Anchor Positioning
      icon.style.position = 'fixed'; // Required for anchor positioning
      icon.style.positionAnchor = cssAnchorName;
      icon.style.zIndex = String(zIndex);

      // Map placement to position-area values
      // position-area uses a 9-cell grid around the anchor
      const positionAreaMap: Record<string, string> = {
        'before': 'left', // Left side of anchor
        'after': 'right', // Right side of anchor
        'inside-start': 'top', // Top of anchor
        'inside-end': 'bottom' // Bottom of anchor
      };

      const positionArea = positionAreaMap[placement];
      if (!positionArea) {
        warn('Invalid placement for CSS Anchor positioning', { placement });
        return false;
      }

      icon.style.positionArea = positionArea;

      // Apply offsets using margin (CSS Anchor doesn't have built-in offset)
      if (offset.x !== 0 || offset.y !== 0) {
        icon.style.marginLeft = `${String(offset.x)}px`;
        icon.style.marginTop = `${String(offset.y)}px`;
      }

      // Append to body (required for fixed positioning)
      if (!icon.parentNode) {
        document.body.appendChild(icon);
      }

      // Mark icon with positioning method for cleanup
      icon.setAttribute('data-positioning-method', 'css-anchor');

      debug('CSS Anchor positioning applied successfully (Tier 0)', {
        placement,
        positionArea,
        offset,
        zIndex,
        anchorId: trackingAnchorId,
        cssAnchorName,
        referenceElement: {
          tag: referenceElement.tagName,
          id: referenceElement.id,
          class: referenceElement.className
        }
      });

      return true;
    } catch (err) {
      // Better error handling for non-Error objects
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;

      error('Failed to apply CSS Anchor positioning', err instanceof Error ? err : null, {
        errorMessage,
        errorStack,
        errorType: typeof err,
        referenceElement: {
          tag: referenceElement.tagName,
          id: referenceElement.id,
          exists: true
        },
        icon: {
          exists: true,
          isConnected: icon.isConnected
        }
      });
      return false;
    }
  }

  /**
   * Position icon using Floating UI library (Tier 1 fallback)
   * Provides production-grade positioning with collision detection, viewport boundaries,
   * and automatic repositioning on scroll/resize
   * @param icon - The icon element to position
   * @param referenceElement - The element to position relative to
   * @param customConfig - Custom site configuration with positioning details
   * @returns Promise<boolean> - true if positioning was successful, false otherwise
   */
  private async positionIconWithFloatingUI(
    icon: HTMLElement, 
    referenceElement: HTMLElement, 
    customConfig: CustomSite
  ): Promise<boolean> {
    try {
      // Dynamic import to enable code splitting and reduce initial bundle size
      const { computePosition, flip, shift, offset: floatingOffset, hide, autoUpdate } = 
        await import('@floating-ui/dom');

      if (!customConfig.positioning) {
        return false;
      }

      const { placement, offset = { x: 0, y: 0 }, zIndex = 999999 } = customConfig.positioning;

      // Map our placement conventions to Floating UI's placement format
      const placementMap: Record<string, string> = {
        'before': 'left',
        'after': 'right',
        'inside-start': 'top-start',
        'inside-end': 'bottom-end'
      };

      const floatingPlacement = placementMap[placement] || 'right';

      // Elements are guaranteed to be non-null by function signature, but add runtime check
      // Note: This condition is always falsy per signature but kept for runtime safety

      // Append icon to body BEFORE positioning (required for computePosition)
      // Note: We append early so Floating UI can measure the element
      if (!icon.parentNode) {
        document.body.appendChild(icon);
      }

      // Validate reference element is in the DOM and has dimensions
      if (!document.body.contains(referenceElement)) {
        warn('Reference element not in DOM', {
          tag: referenceElement.tagName,
          id: referenceElement.id
        });
        return false;
      }

      const refRect = referenceElement.getBoundingClientRect();
      if (refRect.width === 0 && refRect.height === 0) {
        warn('Reference element has no dimensions', {
          tag: referenceElement.tagName,
          id: referenceElement.id,
          rect: { width: refRect.width, height: refRect.height }
        });
        return false;
      }

      // Define positioning update function
      const updatePosition = async (): Promise<void> => {
        try {
          const result: ComputePositionReturn = await computePosition(referenceElement, icon, {
            placement: floatingPlacement as 'left' | 'right' | 'top-start' | 'bottom-end',
            middleware: [
              // Apply user-defined offsets
              floatingOffset({ 
                mainAxis: offset.y,
                crossAxis: offset.x
              }),
              // Smart collision detection - flips to opposite side if no room
              flip({
                fallbackPlacements: ['top', 'bottom', 'left', 'right'],
                padding: 8 // Keep 8px away from viewport edges
              }),
              // Shifts element to stay within viewport
              shift({ 
                padding: 8
              }),
              // Detects when reference element is hidden/scrolled out of view
              hide({
                strategy: 'referenceHidden'
              })
            ]
          });

          const { x, y, middlewareData } = result;

          // Apply computed position
          Object.assign(icon.style, {
            position: 'fixed',
            left: `${String(x)}px`,
            top: `${String(y)}px`,
            zIndex: String(zIndex)
          });

          // Handle visibility based on hide middleware
          if (middlewareData.hide?.referenceHidden) {
            icon.style.visibility = 'hidden';
          } else {
            icon.style.visibility = 'visible';
          }

          debug('Floating UI position updated', {
            x,
            y,
            finalPlacement: result.placement,
            isHidden: middlewareData.hide?.referenceHidden
          });
        } catch (updateErr) {
          const errorMessage = updateErr instanceof Error ? updateErr.message : String(updateErr);
          const errorStack = updateErr instanceof Error ? updateErr.stack : undefined;
          
          warn('Failed to update Floating UI position', { 
            errorMessage,
            errorStack,
            errorType: typeof updateErr,
            referenceElementExists: !!referenceElement,
            iconExists: !!icon
          });
        }
      };

      // Initial positioning
      await updatePosition();

      // Setup auto-update to reposition on scroll, resize, or DOM changes
      const cleanup = autoUpdate(
        referenceElement,
        icon,
        () => void updatePosition(),
        {
          // Optimize performance with RAF
          animationFrame: true
        }
      );

      // Store cleanup function for later removal
      interface IconWithCleanup extends HTMLElement {
        _floatingUICleanup?: () => void;
      }
      (icon as IconWithCleanup)._floatingUICleanup = cleanup;
      icon.setAttribute('data-positioning-method', 'floating-ui');

      debug('Floating UI positioning applied successfully (Tier 1)', {
        placement: floatingPlacement,
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
      // Better error handling for non-Error objects
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;
      
      error('Failed to apply Floating UI positioning', err instanceof Error ? err : null, {
        errorMessage,
        errorStack,
        errorType: typeof err,
        referenceElement: {
          tag: referenceElement.tagName,
          id: referenceElement.id,
          exists: true
        },
        icon: {
          exists: true,
          isConnected: icon.isConnected
        }
      });
      return false;
    }
  }

  /**
   * Positions icon using custom positioning configuration with DOM insertion (Tier 2 fallback)
   * Inserts icon directly into DOM based on placement (before, after, inside-start, inside-end)
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

      // Store target element for use in filterPrompts
      this.state.currentTargetElement = targetElement;

      // Get prompts from storage
      const prompts = await getPrompts();
      debug('Retrieved prompts for selector', { count: prompts.length });

      // Create selector UI
      this.state.promptSelector = this.createPromptSelectorUI(prompts);
      
      // Position selector
      this.positionPromptSelector(this.state.promptSelector, targetElement);

      // Add to DOM first
      document.body.appendChild(this.state.promptSelector);
      debug('[CONTENT] Prompt selector added to DOM, setting up events', {
        selectorInDOM: document.contains(this.state.promptSelector)
      });

      // IMPORTANT: Add event listeners AFTER DOM insertion to ensure querySelector works properly
      try {
        this.setupPromptSelectorEvents(this.state.promptSelector, prompts, targetElement);
        debug('[CONTENT] setupPromptSelectorEvents completed successfully');
      } catch (err) {
        error('[CONTENT] Failed to setup prompt selector events', err as Error);
      }

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
   * Positions the prompt selector with adaptive positioning
   */
  private positionPromptSelector(selector: HTMLElement, targetElement: HTMLElement): void {
    const rect = targetElement.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    // Temporarily add selector to DOM to measure its dimensions
    selector.style.visibility = 'hidden';
    selector.style.position = 'absolute';
    selector.style.zIndex = '1000000';
    document.body.appendChild(selector);
    
    const selectorRect = selector.getBoundingClientRect();
    const selectorHeight = selectorRect.height;
    const selectorWidth = selectorRect.width;
    
    // Remove from DOM temporarily
    document.body.removeChild(selector);
    selector.style.visibility = 'visible';
    
    // Calculate available space
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // Handle small viewports - adjust selector size if needed
    const isMobile = viewportWidth <= 480;
    if (isMobile) {
      selector.style.width = `${String(Math.min(400, viewportWidth - 40))}px`;
      selector.style.maxHeight = `${String(Math.min(500, viewportHeight * 0.7))}px`;
    }
    
    // Determine vertical position
    let top: number;
    const verticalOffset = 5;
    
    if (spaceBelow >= selectorHeight + verticalOffset || spaceBelow > spaceAbove) {
      // Position below if there's enough space or more space than above
      top = rect.bottom + scrollTop + verticalOffset;
      selector.classList.remove('positioned-above');
      selector.classList.add('positioned-below');
    } else {
      // Position above if not enough space below
      top = rect.top + scrollTop - selectorHeight - verticalOffset;
      selector.classList.remove('positioned-below');
      selector.classList.add('positioned-above');
    }
    
    // Determine horizontal position
    let left = rect.left + scrollLeft;
    
    // Adjust if selector would overflow right edge
    if (left + selectorWidth > viewportWidth + scrollLeft) {
      // Align with right edge of viewport or textarea, whichever is smaller
      const rightAlignLeft = Math.min(
        viewportWidth + scrollLeft - selectorWidth - 10,
        rect.right + scrollLeft - selectorWidth
      );
      left = Math.max(scrollLeft + 10, rightAlignLeft); // Ensure minimum padding from left
    }
    
    // Ensure selector doesn't go below viewport bottom when positioned below
    if (top + selectorHeight - scrollTop > viewportHeight && spaceAbove > spaceBelow) {
      // Recalculate to position above if it would overflow
      top = rect.top + scrollTop - selectorHeight - verticalOffset;
      selector.classList.remove('positioned-below');
      selector.classList.add('positioned-above');
    }
    
    // Apply final positioning
    selector.style.position = 'absolute';
    selector.style.top = `${String(Math.max(scrollTop + 10, top))}px`; // Ensure minimum padding from top
    selector.style.left = `${String(left)}px`;
    selector.style.zIndex = '1000000';
    
    debug('Prompt selector positioned adaptively', {
      targetRect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
      selectorSize: { width: selectorWidth, height: selectorHeight },
      viewport: { width: viewportWidth, height: viewportHeight },
      position: { top, left },
      placement: selector.classList.contains('positioned-above') ? 'above' : 'below'
    });
  }

  /**
   * Sets up click event listeners on prompt items
   */
  private setupPromptItemEventListeners(promptItems: NodeListOf<HTMLElement> | HTMLElement[], prompts: Prompt[], targetElement: HTMLElement): void {
    promptItems.forEach(item => {
      debug('[CONTENT] Adding click listener to prompt item', {
        promptId: item.dataset.promptId,
        hasDataset: !!item.dataset.promptId
      });

      this.eventManager.addTrackedEventListener(item, 'click', () => {
        debug('[CONTENT] Prompt item clicked', { promptId: item.dataset.promptId });
        const promptId = item.dataset.promptId;
        const prompt = prompts.find(p => p.id === promptId);
        if (prompt) {
          debug('[CONTENT] Inserting prompt content', { promptId, contentLength: prompt.content.length });
          void this.insertPrompt(targetElement, prompt.content);
          this.closePromptSelector();
        } else {
          debug('[CONTENT] Prompt not found for ID', { promptId });
        }
      });
    });
  }

  /**
   * Sets up event listeners for the prompt selector
   */
  private setupPromptSelectorEvents(selector: HTMLElement, prompts: Prompt[], targetElement: HTMLElement): void {
    // Close button
    const closeButton = selector.querySelector<HTMLElement>('.close-selector');
    if (closeButton) {
      this.eventManager.addTrackedEventListener(closeButton, 'click', () => {
        this.closePromptSelector();
      });
    }

    // Prompt item clicks
    const promptItems = selector.querySelectorAll<HTMLElement>('.prompt-item');
    debug('[CONTENT] Setting up prompt item click handlers', {
      promptItemsFound: promptItems.length,
      selectorInDOM: document.contains(selector)
    });

    this.setupPromptItemEventListeners(promptItems, prompts, targetElement);

    // Search functionality
    const searchInput = selector.querySelector<HTMLInputElement>('.search-input');
    if (searchInput) {
      this.eventManager.addTrackedEventListener(searchInput, 'input', (e: Event) => {
        const target = e.target;
        if (target instanceof HTMLInputElement) {
          this.filterPrompts(target.value, prompts, selector);
        }
      });
    }

    // Outside click to close
    setTimeout(() => {
      const outsideClickHandler = (e: Event) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        if (this.state.promptSelector &&
            !this.state.promptSelector.contains(target) &&
            this.state.icon &&
            !this.state.icon.contains(target)) {
          this.closePromptSelector();
        }
      };
      this.eventManager.addTrackedEventListener(document, 'click', outsideClickHandler);
    }, 100);
    
    // Add scroll and resize handlers for dynamic repositioning
    const repositionHandler = () => {
      if (this.state.promptSelector) {
        this.positionPromptSelector(this.state.promptSelector, targetElement);
      }
    };
    
    // Throttle repositioning for performance
    let repositionTimeout: number | null = null;
    const throttledReposition = () => {
      if (repositionTimeout !== null) {
        return;
      }
      repositionTimeout = window.setTimeout(() => {
        repositionHandler();
        repositionTimeout = null;
      }, 16); // ~60fps
    };
    
    this.eventManager.addTrackedEventListener(window, 'scroll', throttledReposition);
    this.eventManager.addTrackedEventListener(window, 'resize', throttledReposition);
  }

  /**
   * Filters prompts based on search term
   */
  private filterPrompts(searchTerm: string, prompts: Prompt[], selector: HTMLElement): void {
    debug('[CONTENT] filterPrompts called', {
      searchTerm,
      promptsCount: prompts.length,
      stackTrace: new Error().stack
    });
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
      const newPromptItems: HTMLElement[] = [];
      filteredPrompts.forEach((prompt, index) => {
        const promptItem = createPromptListItem(prompt, index, 'filtered-prompt-item');
        promptList.appendChild(promptItem);
        newPromptItems.push(promptItem);
      });

      // Setup event listeners on the newly created prompt items
      if (this.state.currentTargetElement) {
        debug('[CONTENT] Setting up event listeners on filtered prompt items', {
          itemCount: newPromptItems.length
        });
        this.setupPromptItemEventListeners(newPromptItems, filteredPrompts, this.state.currentTargetElement);
      }
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
    } catch (err) {
      error('Error inserting prompt', err instanceof Error ? err : new Error(String(err)));
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
    // Clear the stored target element
    this.state.currentTargetElement = null;
  }

  /**
   * Partial cleanup - removes UI elements but preserves message listener for re-enabling
   */
  private partialCleanup(): void {
    debug('Starting partial cleanup (preserving message listener)', { instanceId: this.state.instanceId });

    // Clear timeouts and intervals
    if (this.state.detectionTimeout) {
      clearTimeout(this.state.detectionTimeout);
      this.state.detectionTimeout = null;
    }

    if (this.state.spaMonitoringInterval) {
      clearInterval(this.state.spaMonitoringInterval as unknown as NodeJS.Timeout);
      this.state.spaMonitoringInterval = null;
    }

    if (this.customSelectorRetry.timeoutId) {
      clearTimeout(this.customSelectorRetry.timeoutId as unknown as NodeJS.Timeout);
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

    // Clear timeouts and intervals
    if (this.state.detectionTimeout) {
      clearTimeout(this.state.detectionTimeout);
      this.state.detectionTimeout = null;
    }

    if (this.state.spaMonitoringInterval) {
      clearInterval(this.state.spaMonitoringInterval as unknown as NodeJS.Timeout);
      this.state.spaMonitoringInterval = null;
    }

    if (this.customSelectorRetry.timeoutId) {
      clearTimeout(this.customSelectorRetry.timeoutId as unknown as NodeJS.Timeout);
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
