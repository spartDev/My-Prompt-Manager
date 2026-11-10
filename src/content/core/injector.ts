/**
 * Prompt Library Injector module
 * 
 * Main orchestration class that manages the prompt library integration.
 * Handles icon injection, prompt selector display, and coordinates between
 * all the modular components.
 */

import { getPlatformByHostname } from '../../config/platforms';
import type { ElementFingerprint } from '../../types/index';
import { PromptSelectorController } from '../selector/controller';
import { loadSelectorFont } from '../selector/font';
import type { SelectorLibrary } from '../selector/selectorData';
import type { InsertionResult, Prompt } from '../types/index';
import { BAR_SEARCH_DEPTH, fitPromptsPill, syncPromptsPillTheme, UIElementFactory } from '../ui/element-factory';
import { EventManager } from '../ui/event-manager';
import { DOMUtils } from '../utils/dom';
import { getElementFingerprintGenerator } from '../utils/element-fingerprint';
import { debug, error, info, isDebugMode, refreshDebugMode, warn } from '../utils/logger';
import { type CustomSite, type ExtensionSettings, getCategories, getPrompts, getSettings, isSiteEnabled } from '../utils/storage';
import { injectCSS } from '../utils/styles';
import { ThemeManager } from '../utils/theme-manager';

import { AnchoredOverlay, INSIDE_CORNER_INSET } from './anchored-overlay';
import { IconPlacementController } from './icon-placement';
import { PlatformInsertionManager } from './insertion-manager';

export interface InjectorState {
  icon: HTMLElement | null;
  currentTextarea: HTMLElement | null;
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

/** How many frames a Prompts button is waited for before it is fitted: about five seconds, for a placement that loads a library first. */
const PLACEMENT_FRAMES = 300;

export class PromptLibraryInjector {
  private state: InjectorState;
  private eventManager: EventManager;
  private uiFactory: UIElementFactory;
  private selector: PromptSelectorController;
  private platformManager: PlatformInsertionManager;
  private customSelectorRetry: CustomSelectorRetry;
  private spaState: SPAState;
  private selectorCache: Map<string, HTMLElement[]>;
  private lastCacheTime: number;
  private readonly cacheTimeout: number = 2000;
  /** Places the icon on the editor when the Platform's toolbar is not found, and on a custom site's element */
  private readonly overlay: AnchoredOverlay;
  /** Watches the placed icon and asks for a new placement when the Platform removes it */
  private readonly placement: IconPlacementController;
  private iconCleanups: Map<HTMLElement, () => void>;
  /**
   * Themes the Prompts button when the extension's theme is read or changes. The theme manager
   * finds buttons in the page only, and a button being placed asynchronously is not there yet.
   */
  private readonly onThemeChange = (): void => {
    if (this.state.icon) {
      syncPromptsPillTheme(this.state.icon);
    }
  };

  constructor() {
    const hostname = window.location.hostname || '';

    this.state = {
      icon: null,
      currentTextarea: null,
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
    this.selector = new PromptSelectorController({
      loadLibrary: () => this.loadSelectorLibrary(),
      insert: (prompt, content, target) => this.insertSelectedPrompt(prompt, content, target),
      onOpenChange: (open, trigger) => { this.markIconOpen(open, trigger); }
    });

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

    this.overlay = new AnchoredOverlay();
    this.placement = new IconPlacementController((editor) => {
      this.handleIconLost(editor);
    });

    // Icon cleanup tracking (prevents MutationObserver memory leaks)
    this.iconCleanups = new Map();

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
      ThemeManager.getInstance().addObserver(this.onThemeChange);
      // The Prompts button is set in the extension's font; without it the system font shows
      void loadSelectorFont();

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

        // A new editor, or the same editor whose icon the Platform removed when it re-rendered its
        // composer; while the controller already waits to place it again, this pass stands down
        const needsIcon = textarea !== this.state.currentTextarea || this.placement.isLost(textarea);
        if (needsIcon && !this.placement.isReplacementPending()) {
          this.state.currentTextarea = textarea;
          this.injectIcon(textarea).catch((err: unknown) => {
            error('Icon injection failed', err instanceof Error ? err : new Error(String(err)), {
              component: 'PromptLibraryInjector',
              textareaId: textarea.id,
              textareaTag: textarea.tagName
            });
          });
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
   * Removes all existing prompt library icons from the DOM
   * This prevents duplicate icons after extension reloads
   */
  /** Runs what each icon registered to release (its resize observer), whether or not the icon is still in the page. */
  private runIconCleanups(): void {
    for (const cleanup of this.iconCleanups.values()) {
      try {
        cleanup();
      } catch (err) {
        warn('Icon cleanup failed', { error: err instanceof Error ? err.message : String(err) });
      }
    }
    this.iconCleanups.clear();
  }

  private removeAllExistingIcons(): void {
    try {
      this.runIconCleanups();
      // Remove icons by cleanup class selector (covers all instances). Every icon carries this class,
      // so an icon Floating UI follows is released here, before it leaves the DOM: a later pass would not
      // find it any more and its autoUpdate would keep running on a detached node
      let floatingUICleanedUp = 0;
      const existingIcons = document.querySelectorAll('.prompt-library-cleanup-target');
      existingIcons.forEach(icon => {
        try {
          if (this.overlay.release(icon as HTMLElement)) {
            floatingUICleanedUp++;
          }
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

      // Clean up Copilot icon MutationObservers
      const copilotIcons = document.querySelectorAll('.prompt-library-copilot-icon');
      let copilotIconsCleanedUp = 0;
      copilotIcons.forEach(icon => {
        try {
          // Call cleanup function if it exists (disconnects MutationObserver)
          const cleanup = this.iconCleanups.get(icon as HTMLElement);
          if (cleanup && typeof cleanup === 'function') {
            cleanup();
            this.iconCleanups.delete(icon as HTMLElement);
            copilotIconsCleanedUp++;
          }
        } catch (error) {
          // Log unexpected errors during cleanup
          debug('Failed to clean up Copilot icon observer', { error: String(error) });
        }
      });

      // Clean up Floating UI elements and subscriptions (icons without the cleanup class)
      const floatingUIIcons = document.querySelectorAll('[data-positioning-method="floating-ui"]');
      floatingUIIcons.forEach(icon => {
        try {
          // Stop the autoUpdate subscription before the icon goes
          if (this.overlay.release(icon as HTMLElement)) {
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
        copilotIconsCleanedUp,
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

      // Forget the icon being replaced before it leaves the DOM, so its removal is not taken for a loss
      this.placement.reset();

      // The icon being replaced may already be out of the DOM (the Platform removed it), where the
      // queries below cannot find it: dispose of it first, with its observer and click listener
      if (this.state.icon) {
        this.disposeIcon(this.state.icon);
      }

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

      // Store cleanup function if present (for Copilot icons with MutationObserver)
      const iconWithCleanup = icon as HTMLElement & { __cleanup?: () => void };
      if (iconWithCleanup.__cleanup) {
        this.iconCleanups.set(icon, iconWithCleanup.__cleanup);
        delete iconWithCleanup.__cleanup; // Clean up the property reference
      }

      // Mark icon with identifying attributes for cleanup (using non-conflicting class)
      icon.classList.add('prompt-library-cleanup-target');
      icon.setAttribute('data-prompt-library-icon', 'true');
      icon.setAttribute('data-instance-id', this.state.instanceId);

      // Once it is in the page: the label goes when the Platform's bar has no room for it
      this.fitIconWhenPlaced(icon);

      // Add click handler
      this.eventManager.addTrackedEventListener(icon, 'click', (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        this.showPromptSelector(textarea);
      });

      // Try to inject into platform-specific container first
      const containerSelector = this.platformManager.getButtonContainerSelector();
      let injected = false;

      debug(`Current hostname: ${this.state.hostname}, containerSelector: ${containerSelector ?? 'none'}`);

      // For Copilot, find the microphone button and insert our icon before it
      // Run this FIRST before checking containerSelector
      if (this.state.hostname === 'copilot.microsoft.com') {
        debug('Attempting Copilot-specific icon injection');

        // Find the "Talk to Copilot" microphone button
        const micButton = document.querySelector('button[data-testid="audio-call-button"]') ||
                         document.querySelector('button[aria-label*="Talk to Copilot"]');

        debug(`Microphone button found: ${micButton ? 'yes' : 'no'}`);

        if (micButton) {
          // Find the parent .relative wrapper first
          const micWrapper = micButton.closest('div.relative');
          debug(`Microphone wrapper found: ${micWrapper ? 'yes' : 'no'}`);

          if (micWrapper) {
            // Get the grandparent flex container
            const micButtonContainer = micWrapper.parentElement;
            debug(`Microphone button container found: ${micButtonContainer ? 'yes' : 'no'}, classes: ${micButtonContainer?.className ?? 'none'}`);

            // If we found the container, insert our icon wrapper before the mic button wrapper
            if (micButtonContainer) {
              // Ensure the icon doesn't have absolute positioning class
              icon.classList.remove('prompt-library-icon-absolute');

              // Create a wrapper div for our icon to match Copilot's structure
              const iconWrapper = document.createElement('div');
              iconWrapper.className = 'relative';
              iconWrapper.appendChild(icon);

              // Insert our icon before the microphone button wrapper
              micButtonContainer.insertBefore(iconWrapper, micWrapper);
              injected = true;
              debug('Icon injected before "Talk to Copilot" microphone button');
            }
          }
        } else {
          debug('Microphone button not found, will use fallback positioning');
        }
      }

      if (containerSelector) {
        // For Claude, find the clock/history button and inject after it
        if (this.state.hostname === 'claude.ai') {
          // Look for the toolbar container first
          const toolbarContainer = document.querySelector(containerSelector);
          let clockButtonContainer = null;

          if (toolbarContainer) {
            // Find all button containers within the toolbar
            const buttonContainers = toolbarContainer.querySelectorAll('div.flex.shrink');

            // The clock button is typically the last button before the empty flex spacer
            // It contains an SVG with a specific clock icon path
            for (const container of buttonContainers) {
              const button = container.querySelector('button');
              if (!button) {
                continue;
              }

              // Check if this button has an SVG with the clock icon path
              const svg = button.querySelector('svg');
              if (svg) {
                const path = svg.querySelector('path');
                if (path) {
                  const pathData = path.getAttribute('d');
                  // Check for clock icon signature (path starts with coordinates around 10.38 or similar circle/clock pattern)
                  if (pathData && (pathData.includes('M10.3857') || pathData.includes('M10 5.5'))) {
                    clockButtonContainer = container;
                    break;
                  }
                }
              }
            }

            // Fallback: if we couldn't find by SVG path, use the last button container before flex-row
            if (!clockButtonContainer && buttonContainers.length > 0) {
              clockButtonContainer = buttonContainers[buttonContainers.length - 1];
            }
          }

          if (clockButtonContainer && clockButtonContainer.parentElement) {
            // Create a similar wrapper div structure for our button
            const buttonWrapper = document.createElement('div');
            buttonWrapper.className = 'flex min-w-8 !shrink-0';
            buttonWrapper.setAttribute('data-state', 'closed');
            buttonWrapper.style.opacity = '1';
            buttonWrapper.style.transform = 'none';
            buttonWrapper.appendChild(icon);

            // Insert after the clock button container
            clockButtonContainer.parentElement.insertBefore(buttonWrapper, clockButtonContainer.nextSibling);
            injected = true;
            debug('Icon injected after clock/history button in Claude toolbar');
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

      if (injected) {
        this.placement.track(icon, textarea, 'toolbar');
      }

      // Check if we have custom positioning configuration (declare outside if block for scope)
      const customConfig = this.platformManager.getCustomSiteConfig();

      // If not injected into container, handle custom positioning or fallback to floating
      if (!injected) {
        let customPositioned = false;

        const positioning = customConfig?.positioning as (NonNullable<typeof customConfig>['positioning'] & { fingerprint?: ElementFingerprint; anchorId?: string }) | undefined;
        if (positioning) {
          try {
            let referenceElement: HTMLElement | null = null;

            // PRIORITY 1: Try fingerprint matching (most robust)
            if (positioning.fingerprint &&
                typeof positioning.fingerprint === 'object' &&
                'meta' in positioning.fingerprint) {
               
              const fpData = positioning.fingerprint;
              const fingerprintGenerator = getElementFingerprintGenerator();
               
              referenceElement = fingerprintGenerator.findElement(fpData);

              if (referenceElement) {
                debug('Found element using fingerprint matching', {
                  tag: referenceElement.tagName,
                  id: referenceElement.id,
                   
                  confidence: fpData.meta.confidence
                });
              } else {
                debug('Fingerprint matching failed, trying fallback selector');
              }
            }
            
            // PRIORITY 2: Try legacy selector as fallback
            if (!referenceElement && positioning.selector) {
              const customSelector = positioning.selector;
              
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
              const supportsCSSAnchor = DOMUtils.supportsCSSAnchorPositioning();

              if (supportsCSSAnchor) {
                customPositioned = this.overlay.placeWithCSSAnchor(icon, referenceElement, positioning);
                if (customPositioned) {
                  debug('Icon positioned successfully with CSS Anchor (Tier 0 - Native)', {
                    browser: 'chrome-125+',
                    bundleSaved: '14KB (Floating UI not loaded)'
                  });
                  this.placement.track(icon, textarea, 'custom');
                  return; // Exit here - positioning is complete
                } else {
                  debug('CSS Anchor positioning failed, trying Floating UI');
                  // Telemetry: Track fallback from CSS Anchor to Floating UI
                   
                  info('[Telemetry] Positioning fallback', {
                    from: 'css-anchor',
                    fromTier: 0,
                    to: 'floating-ui',
                    toTier: 1,
                    reason: 'css-anchor-failed',
                    url: window.location.hostname
                  });
                }
              }

              // TIER 1: Try Floating UI positioning (fallback for older browsers)
              // Production-grade JS positioning for browsers without CSS Anchor support
              // Works on Chrome 114+, Firefox, older Safari
              // OPTIMIZATION: Only load Floating UI (14KB) when CSS Anchor API is unavailable
              try {
                customPositioned = await this.overlay.placeWithFloatingUI(icon, referenceElement, positioning);
                if (this.dropIfStale(icon, textarea)) {
                  return;
                }
                if (customPositioned) {
                  debug('Icon positioned successfully with Floating UI (Tier 1)', {
                    browser: 'chrome-114-124 or firefox/safari',
                    bundleLoaded: '14KB (Floating UI lazy loaded)'
                  });
                  this.placement.track(icon, textarea, 'custom');
                  return; // Exit here - positioning is complete
                }
              } catch (floatingErr) {
                debug('Floating UI positioning failed, trying DOM insertion', { error: String(floatingErr) });
              }

              // TIER 2: Try DOM insertion (fallback for Floating UI failures)
              if (!customPositioned) {
                // Telemetry: Track fallback from Floating UI to DOM insertion
                 
                info('[Telemetry] Positioning fallback', {
                  from: 'floating-ui',
                  fromTier: 1,
                  to: 'dom-insertion',
                  toTier: 2,
                  reason: 'floating-ui-failed',
                  url: window.location.hostname
                });

                customPositioned = customConfig ? this.positionCustomIcon(icon, referenceElement, customConfig) : false;
                if (customPositioned) {
                  debug('Icon positioned successfully with DOM insertion (Tier 2)');
                  this.placement.track(icon, textarea, 'custom');
                  return; // Exit here - positioning is complete
                } else {
                  debug('DOM insertion failed, will try absolute positioning (Tier 3)');
                  // Telemetry: Track fallback from DOM insertion to absolute positioning
                   
                  info('[Telemetry] Positioning fallback', {
                    from: 'dom-insertion',
                    fromTier: 2,
                    to: 'absolute',
                    toTier: 3,
                    reason: 'dom-insertion-failed',
                    url: window.location.hostname
                  });
                }
              }
            }
          } catch (selectorError) {
            warn('Invalid custom selector', { selector: positioning.selector, error: selectorError });
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
              this.placement.track(icon, textarea, 'custom');
              return; // Exit here - positioning is complete
            }
          } catch (fallbackError) {
            warn('Absolute positioning fallback also failed', { error: fallbackError });
          }
        }

        // No toolbar and no custom positioning: the icon is anchored on the editor itself
        await this.placeOnEditor(icon, textarea, containerSelector);
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
   * Places the icon on the editor when the Platform's toolbar was not found: anchored inside its
   * bottom-end corner, following scroll and resize. On a built-in Platform, a toolbar selector that
   * matched nothing is the sign its UI changed, so it is logged as a warning.
   */
  private async placeOnEditor(icon: HTMLElement, textarea: HTMLElement, containerSelector: string | null): Promise<void> {
    if (containerSelector) {
      warn('Toolbar not found on this Platform, the icon is anchored on the editor instead', {
        hostname: this.state.hostname,
        containerSelector
      });
    } else {
      debug('No toolbar selector for this site, the icon is anchored on the editor');
    }

    // Alone on the editor, the Prompts button is its badge only (the stylesheet reads
    // data-prompt-library-floating): a corner of the editor has no room for the label
    UIElementFactory.convertToAbsolutePositioning(icon);
    const button = icon.matches('button') ? icon : icon.querySelector('button');
    button?.classList.add('prompt-library-icon-base');
    icon.setAttribute('data-prompt-library-floating', 'true');

    const method = await this.overlay.place(icon, textarea, { placement: 'inside-bottom-end' });
    if (this.dropIfStale(icon, textarea)) {
      return;
    }
    if (!method) {
      this.placeStatically(icon, textarea);
    }
    this.placement.track(icon, textarea, 'overlay');
    debug('Icon anchored on the editor', { method: method ?? 'static' });
  }

  /**
   * After an await in a placement: the site was disabled, the icon replaced or the editor changed
   * while Floating UI loaded. The stale icon is then disposed of instead of tracked, and true is
   * returned so the caller stops.
   */
  private dropIfStale(icon: HTMLElement, textarea: HTMLElement): boolean {
    const stale = !this.state.isSiteEnabled
      || this.state.icon !== icon
      || this.state.currentTextarea !== textarea;
    if (stale) {
      debug('Placement outdated while it awaited, the icon is dropped');
      this.disposeIcon(icon);
      if (this.state.icon === icon) {
        this.state.icon = null;
      }
    }
    return stale;
  }

  /**
   * Throws one icon away whether or not it is still in the DOM: its Copilot observer, its
   * Anchored overlay, its click listener, then the element itself.
   */
  private disposeIcon(icon: HTMLElement): void {
    const cleanup = this.iconCleanups.get(icon);
    if (cleanup) {
      try {
        cleanup();
      } catch (err) {
        warn('Icon cleanup failed', { error: err instanceof Error ? err.message : String(err) });
      }
      this.iconCleanups.delete(icon);
    }
    this.overlay.release(icon);
    this.eventManager.removeTrackedListeners(icon);
    icon.remove();
  }

  /**
   * Last resort when neither overlay tier could run: the icon is put once at the editor's
   * bottom-end corner and does not follow it afterwards.
   */
  private placeStatically(icon: HTMLElement, textarea: HTMLElement): void {
    warn('Anchored overlay unavailable, the icon is placed once at the editor corner', {
      hostname: this.state.hostname
    });
    if (!icon.parentNode) {
      document.body.appendChild(icon);
    }
    const rect = textarea.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    icon.style.position = 'absolute';
    icon.style.top = `${String(rect.bottom + scrollTop - icon.offsetHeight - INSIDE_CORNER_INSET)}px`;
    icon.style.left = `${String(rect.right + scrollLeft - icon.offsetWidth - INSIDE_CORNER_INSET)}px`;
    icon.style.zIndex = '999999';
  }

  /**
   * The Platform removed the icon placed for this editor (its composer re-rendered): place it
   * again on the same editor, or look for the editor anew when it went with the icon.
   */
  private handleIconLost(editor: HTMLElement): void {
    if (!this.state.isSiteEnabled) {
      return;
    }
    if (editor.isConnected) {
      this.state.currentTextarea = editor;
      this.injectIcon(editor).catch((err: unknown) => {
        error('Icon re-placement failed', err instanceof Error ? err : new Error(String(err)));
      });
      return;
    }
    this.state.currentTextarea = null;
    this.selectorCache.clear();
    this.lastCacheTime = 0;
    this.detectAndInjectIcon();
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

      // Telemetry: Track positioning method usage
       
      info('[Telemetry] Positioning method used', {
        method: 'absolute',
        tier: 3,
        success: true,
        placement,
        hasOffset: offset.x !== 0 || offset.y !== 0,
        referenceType: referenceElement.tagName.toLowerCase(),
        url: window.location.hostname
      });

    } catch (err) {
      error('Failed to apply absolute positioning fallback', err as Error);

      // Telemetry: Track absolute positioning failure
       
      info('[Telemetry] Positioning method used', {
        method: 'absolute',
        tier: 3,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        url: window.location.hostname
      });
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

      // Telemetry: Track positioning method usage
       
      info('[Telemetry] Positioning method used', {
        method: 'dom-insertion',
        tier: 2,
        success: true,
        placement,
        hasOffset: offset.x !== 0 || offset.y !== 0,
        referenceType: referenceElement.tagName.toLowerCase(),
        url: window.location.hostname
      });

      return true;
    } catch (err) {
      error('Failed to apply custom DOM insertion', err as Error);
      return false;
    }
  }

  /** Waits for the Prompts button to be in the page (some placements are asynchronous), then themes and fits it. */
  private fitIconWhenPlaced(icon: HTMLElement, attempts = PLACEMENT_FRAMES): void {
    window.requestAnimationFrame(() => {
      if (icon.isConnected) {
        syncPromptsPillTheme(icon);
        fitPromptsPill(icon);
        this.refitIconOnResize(icon);
      } else if (attempts > 0 && this.state.icon === icon) {
        this.fitIconWhenPlaced(icon, attempts - 1);
      }
    });
  }

  /**
   * Fits the Prompts button again when the bar it sits in changes size (the window is resized, a
   * sidebar opens): the label goes when the bar narrows and comes back when there is room again.
   * Fitting ends in the same state for the same bar, so its own class change starts no loop.
   */
  private refitIconOnResize(icon: HTMLElement): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    let frame: number | null = null;
    const observer = new ResizeObserver(() => {
      frame ??= window.requestAnimationFrame(() => {
        frame = null;
        if (icon.isConnected) {
          fitPromptsPill(icon);
        }
      });
    });
    // The bar is one of the button's nearest ancestors (fitPromptsPill looks at the same ones)
    let ancestor = icon.parentElement;
    for (let level = 0; ancestor && ancestor !== document.body && level < BAR_SEARCH_DEPTH; level++) {
      observer.observe(ancestor);
      ancestor = ancestor.parentElement;
    }

    const earlier = this.iconCleanups.get(icon);
    this.iconCleanups.set(icon, () => {
      earlier?.();
      observer.disconnect();
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    });
  }

  /**
   * Opens the Prompt selector over the input field, or closes it when it is open (a second click
   * on the Prompts button).
   */
  showPromptSelector(targetElement: HTMLElement): void {
    debug('Toggling prompt selector', { textareaTag: targetElement.tagName, isOpen: this.selector.isOpen });
    this.selector.toggle(targetElement, this.state.icon);
  }

  /** What the Prompt selector lists: the Prompts and the Categories, read each time it opens. */
  private async loadSelectorLibrary(): Promise<SelectorLibrary> {
    const [prompts, categories] = await Promise.all([getPrompts(), getCategories()]);
    debug('Retrieved prompts for selector', { count: prompts.length });
    return { prompts, categories };
  }

  /** The Prompts button shows whether the selector it opens is open. */
  private markIconOpen(open: boolean, icon: HTMLElement | null): void {
    const button = icon?.matches('button') ? icon : icon?.querySelector('button');
    button?.setAttribute('aria-expanded', String(open));
  }

  /**
   * Inserts the Prompt the user chose, once the selector has closed, and reports the use.
   */
  private async insertSelectedPrompt(prompt: Prompt, content: string, targetElement: HTMLElement): Promise<void> {
    try {
      const result = await this.insertPrompt(targetElement, content);

      if (result.success) {
        try {
          // Get platform name from hostname lookup for accurate analytics
          // Falls back to hostname for custom sites to enable per-site analytics
          const platform = getPlatformByHostname(window.location.hostname)?.id ?? window.location.hostname;

          await chrome.runtime.sendMessage({
            type: 'PROMPT_USAGE_INCREMENT',
            data: {
              promptId: prompt.id,
              platform,
              categoryId: prompt.category || null
            }
          });
        } catch (sendMessageError) {
          debug('[CONTENT] Failed to report prompt usage', {
            promptId: prompt.id,
            error: sendMessageError instanceof Error ? sendMessageError.message : String(sendMessageError)
          });
        }
      } else {
        warn('[CONTENT] Prompt insertion reported failure', { promptId: prompt.id, error: result.error });
      }
    } catch (err) {
      error('[CONTENT] Error handling prompt selection', err instanceof Error ? err : new Error(String(err)), {
        promptId: prompt.id
      });
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
    this.placement.reset();
    this.runIconCleanups();
    ThemeManager.getInstance().removeObserver(this.onThemeChange);
    if (this.state.icon) {
      this.overlay.release(this.state.icon);
      this.state.icon.remove();
      this.state.icon = null;
    }

    this.selector.destroy();

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

    // Clean up UI elements (including all Floating UI icons with cleanup functions)
    this.placement.reset();
    this.removeAllExistingIcons();

    this.runIconCleanups();
    ThemeManager.getInstance().removeObserver(this.onThemeChange);
    if (this.state.icon) {
      this.overlay.release(this.state.icon);
      this.state.icon.remove();
      this.state.icon = null;
    }

    this.selector.destroy();

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
