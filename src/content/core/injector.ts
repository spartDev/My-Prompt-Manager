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
import { warn, info, isDebugMode } from '../utils/logger';
import { getPrompts, createPromptListItem } from '../utils/storage';
import { injectCSS } from '../utils/styles';

import { PlatformInsertionManager } from './insertion-manager';

export interface InjectorState {
  icon: HTMLElement | null;
  currentTextarea: HTMLElement | null;
  promptSelector: HTMLElement | null;
  isInitialized: boolean;
  detectionTimeout: number | null;
  mutationObserver: MutationObserver | null;
  hostname: string;
  instanceId: string;
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
      detectionTimeout: null,
      mutationObserver: null,
      hostname: String(window.location.hostname || ''),
      instanceId: `prompt-lib-${window.location.hostname}-${String(Date.now())}-${Math.random().toString(36).substr(2, 9)}`
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

    this.initialize();
  }

  /**
   * Initializes the prompt library injector
   */
  initialize(): void {
    if (this.state.isInitialized) {return;}

    try {
      info('Initializing my prompt manager for site', { hostname: this.state.hostname });

      this.state.isInitialized = true;

      // Inject CSS styles
      injectCSS();

      // Setup SPA monitoring for dynamic navigation detection
      this.setupSPAMonitoring();

      // Wait for page to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { this.startDetection(); });
      } else {
        this.startDetection();
      }
    } catch (error) {
      error('Error during initialization', error as Error);
      this.state.isInitialized = false;
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
          this.initialize();
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
      const selectors = this.platformManager.getAllSelectors();
      const textarea = this.findTextareaWithCaching(selectors);

      if (textarea && textarea !== this.state.currentTextarea) {
        this.state.currentTextarea = textarea;
        this.injectIcon(textarea);
      }
    } catch (error) {
      error('Error during icon detection and injection', error as Error);
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
        elements.push(...found);
      } catch (error) {
        warn(`Invalid selector: ${selector}`, { error });
      }
    }

    this.selectorCache.set(cacheKey, elements);
    this.lastCacheTime = now;

    // Return the first visible element
    for (const element of elements) {
      if (this.isElementVisible(element)) {
        return element;
      }
    }

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

      // Add click handler
      this.eventManager.addTrackedEventListener(icon, 'click', (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        void this.showPromptSelector(textarea);
      });

      // Position and inject the icon
      this.positionIcon(icon, textarea);
      document.body.appendChild(icon);

      info('Icon injected successfully', {
        textareaTag: textarea.tagName,
        iconType: 'platform-specific'
      });
    } catch (error) {
      error('Failed to inject icon', error as Error);
    }
  }

  /**
   * Positions the icon relative to the textarea
   */
  private positionIcon(icon: HTMLElement, textarea: HTMLElement): void {
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
   * Shows the prompt selector modal
   */
  async showPromptSelector(targetElement: HTMLElement): Promise<void> {
    try {
      info('Showing prompt selector', {
        textareaTag: targetElement.tagName,
        hasExistingSelector: !!this.state.promptSelector
      });

      // Remove existing selector
      this.closePromptSelector();

      // Get prompts from storage
      const prompts = await getPrompts();
      info('Retrieved prompts for selector', { count: prompts.length });

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

      info('Prompt selector created and keyboard navigation initialized', {
        promptCount: prompts.length
      });

    } catch (error) {
      error('Failed to show prompt selector', error as Error);
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
        info('Prompt inserted successfully', {
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
   * Cleans up all resources
   */
  cleanup(): void {
    info('Starting cleanup', { instanceId: this.state.instanceId });

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

    info('Cleanup completed', { instanceId: this.state.instanceId });
  }
}