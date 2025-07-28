/* eslint-env browser, webextensions */
/* global localStorage, navigator, Node, HTMLTextAreaElement, requestAnimationFrame, cancelAnimationFrame, IntersectionObserver */
// Content script for injecting prompt library icon into AI chat platforms

// Inject CSS styles
function injectCSS() {
  if (document.getElementById('prompt-library-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'prompt-library-styles';
  style.textContent = `
    /* Prompt Library Icon */
    .prompt-library-icon {
      position: absolute;
      width: 32px;
      height: 32px;  
      background: #4f46e5;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      z-index: 999999;
      border: 2px solid transparent;
    }

    .prompt-library-icon:hover {
      background: #4338ca;
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .prompt-library-icon:focus-visible {
      outline: none;
      border-color: #60a5fa;
      box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.4);
    }

    .prompt-library-icon svg {
      color: white;
      width: 18px;
      height: 18px;
    }

    /* Prompt Selector Modal */
    .prompt-library-selector {
      position: absolute;
      width: 400px;
      max-height: 500px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1), 0 8px 16px rgba(0, 0, 0, 0.08);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 1000000;
      overflow: hidden;
      backdrop-filter: blur(8px);
      animation: promptSelectorFadeIn 0.2s ease-out;
    }

    .prompt-library-selector:focus-within {
      border-color: #4f46e5;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1), 0 0 0 3px rgba(79, 70, 229, 0.1);
    }

    @keyframes promptSelectorFadeIn {
      from {
        opacity: 0;
        transform: translateY(-8px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .prompt-selector-header {
      padding: 16px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f9fafb;
    }

    .prompt-selector-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #111827;
    }

    .close-selector {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #6b7280;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }

    .close-selector:hover {
      background: #e5e7eb;
      color: #374151;
    }

    .prompt-search {
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
    }

    .search-input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      outline: none;
      box-sizing: border-box;
    }

    .search-input:focus {
      border-color: #4f46e5;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }

    .prompt-list {
      max-height: 350px;
      overflow-y: auto;
    }

    .prompt-item {
      padding: 12px 16px;
      border-bottom: 1px solid #f3f4f6;
      cursor: pointer;
      transition: background-color 0.15s ease;
      border-radius: 4px;
      margin: 2px 8px;
      position: relative;
    }

    .prompt-item:hover,
    .prompt-item:focus-visible {
      background: #f9fafb;
      outline: none;
    }

    .prompt-item:focus-visible {
      box-shadow: 0 0 0 2px #4f46e5;
      background: #f0f0f3;
    }

    .prompt-item.keyboard-selected {
      background: #f0f0f3;
      box-shadow: 0 0 0 2px #4f46e5;
    }

    .prompt-item:last-child {
      border-bottom: none;
    }

    .prompt-title {
      font-weight: 600;
      color: #111827;
      font-size: 14px;
      margin-bottom: 4px;
    }

    .prompt-category {
      font-size: 12px;
      color: #4f46e5;
      background: #eef2ff;
      padding: 2px 8px;
      border-radius: 12px;
      display: inline-block;
      margin-bottom: 6px;
    }

    .prompt-preview {
      font-size: 13px;
      color: #6b7280;
      line-height: 1.4;
    }

    .no-prompts {
      padding: 32px 16px;
      text-align: center;
      color: #6b7280;
      font-style: italic;
    }

    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      .prompt-library-selector {
        background: #1f2937;
        border-color: #374151;
      }
      
      .prompt-selector-header {
        background: #111827;
        border-color: #374151;
      }
      
      .prompt-selector-header h3 {
        color: #f9fafb;
      }
      
      .close-selector {
        color: #9ca3af;
      }
      
      .close-selector:hover {
        background: #374151;
        color: #f3f4f6;
      }
      
      .prompt-search {
        border-color: #374151;
      }
      
      .search-input {
        background: #374151;
        border-color: #4b5563;
        color: #f9fafb;
      }
      
      .search-input:focus {
        border-color: #6366f1;
      }
      
      .prompt-item {
        border-color: #374151;
      }
      
      .prompt-item:hover {
        background: #374151;
      }

      .prompt-item:focus-visible {
        box-shadow: 0 0 0 2px #6366f1;
        background: #374151;
      }

      .prompt-item.keyboard-selected {
        background: #374151;
        box-shadow: 0 0 0 2px #6366f1;
      }
      
      .prompt-title {
        color: #f9fafb;
      }
      
      .prompt-category {
        background: #312e81;
        color: #c7d2fe;
      }
      
      .prompt-preview {
        color: #9ca3af;
      }
      
      .no-prompts {
        color: #9ca3af;
      }
    }

    /* Responsive design */
    @media (max-width: 480px) {
      .prompt-library-selector {
        width: calc(100vw - 40px);
        right: 20px !important;
      }
    }

    /* Screen reader only content */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `;
  
  document.head.appendChild(style);
}

// Specialized classes for better architecture

class Logger {
  static isDebugMode() {
    // Enable debug mode in development or via localStorage flag
    return localStorage.getItem('prompt-library-debug') === 'true' || 
           window.location.hostname === 'localhost';
  }
  
  static error(message, error = null, context = {}) {
    const logData = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      context,
      url: window.location.href,
      userAgent: navigator.userAgent.substring(0, 100) // Truncate for privacy
    };
    
    if (error) {
      logData.error = {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 500) // Truncate stack trace
      };
    }
    
    console.error('[PromptLibrary]', logData);
    
    // In debug mode, also show user-friendly notifications
    if (this.isDebugMode()) {
      this.showDebugNotification('Error: ' + message, 'error');
    }
  }
  
  static warn(message, context = {}) {
    const logData = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message,
      context,
      url: window.location.href
    };
    
    console.warn('[PromptLibrary]', logData);
    
    if (this.isDebugMode()) {
      this.showDebugNotification('Warning: ' + message, 'warn');
    }
  }
  
  static info(message, context = {}) {
    if (this.isDebugMode()) {
      const logData = {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message,
        context,
        url: window.location.href
      };
      
      console.info('[PromptLibrary]', logData);
    }
  }
  
  static showDebugNotification(message, type = 'info') {
    // Only show in debug mode and avoid spam
    if (!this.isDebugMode() || this._lastNotification === message) return;
    this._lastNotification = message;
    
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000000;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      max-width: 300px;
      word-wrap: break-word;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      ${type === 'error' ? 'background: #fee; border-left: 4px solid #f56565; color: #742a2a;' :
        type === 'warn' ? 'background: #fef5e7; border-left: 4px solid #ed8936; color: #744210;' :
        'background: #e6fffa; border-left: 4px solid #38b2ac; color: #234e52;'}
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
    
    // Clear the spam prevention after 10 seconds
    setTimeout(() => {
      if (this._lastNotification === message) {
        this._lastNotification = null;
      }
    }, 10000);
  }
}

class EventManager {
  constructor() {
    this.listeners = new Map();
  }
  
  addTrackedEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    
    if (!this.listeners.has(element)) {
      this.listeners.set(element, []);
    }
    this.listeners.get(element).push({ event, handler });
  }
  
  cleanup() {
    let removedCount = 0;
    let errorCount = 0;
    
    this.listeners.forEach((listeners, element) => {
      listeners.forEach(({ event, handler }) => {
        try {
          element.removeEventListener(event, handler);
          removedCount++;
        } catch (error) {
          errorCount++;
          Logger.warn('Failed to remove event listener', {
            error: error.message,
            event,
            elementTag: element.tagName,
            elementId: element.id,
            elementClass: element.className
          });
        }
      });
    });
    
    this.listeners.clear();
    
    Logger.info('EventManager cleanup completed', {
      removedListeners: removedCount,
      errors: errorCount
    });
  }
}

class UIElementFactory {
  constructor(instanceId) {
    this.instanceId = instanceId;
  }
  
  createClaudeIcon() {
    const iconContainer = document.createElement('div');
    iconContainer.className = 'relative shrink-0';
    
    const innerDiv = document.createElement('div');
    const flexDiv = document.createElement('div');
    flexDiv.className = 'flex items-center';
    
    const shrinkDiv = document.createElement('div');
    shrinkDiv.className = 'flex shrink-0';
    shrinkDiv.setAttribute('data-state', 'closed');
    shrinkDiv.style.opacity = '1';
    shrinkDiv.style.transform = 'none';
    
    const icon = document.createElement('button');
    icon.className = `prompt-library-integrated-icon inline-flex items-center justify-center relative shrink-0 can-focus select-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:drop-shadow-none border-0.5 transition-all h-8 min-w-8 rounded-lg flex items-center px-[7.5px] group !pointer-events-auto !outline-offset-1 text-text-300 border-border-300 active:scale-[0.98] hover:text-text-200/90 hover:bg-bg-100`;
    icon.setAttribute('type', 'button');
    icon.setAttribute('aria-label', 'Open prompt library - Access your saved prompts');
    icon.setAttribute('title', 'Prompt Library - Access your saved prompts');
    icon.setAttribute('data-instance-id', this.instanceId);
    icon.setAttribute('tabindex', '0');
    
    icon.innerHTML = `
      <div class="flex flex-row items-center justify-center gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
          <path d="M224,48H32A16,16,0,0,0,16,64V192a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM208,192H48a8,8,0,0,1-8-8V72H216V184A8,8,0,0,1,208,192ZM64,96a8,8,0,0,1,8-8H184a8,8,0,0,1,0,16H72A8,8,0,0,1,64,96Zm0,32a8,8,0,0,1,8-8H184a8,8,0,0,1,0,16H72A8,8,0,0,1,64,128Zm0,32a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H72A8,8,0,0,1,64,160Z"/>
        </svg>
      </div>
    `;
    
    shrinkDiv.appendChild(icon);
    flexDiv.appendChild(shrinkDiv);
    innerDiv.appendChild(flexDiv);
    iconContainer.appendChild(innerDiv);
    
    return { container: iconContainer, icon };
  }
  
  createPerplexityIcon() {
    const icon = document.createElement('button');
    icon.className = `prompt-library-integrated-icon focus-visible:bg-offsetPlus hover:bg-offsetPlus text-textOff hover:text-textMain dark:hover:bg-offsetPlus dark:hover:text-textMainDark font-sans focus:outline-none outline-none outline-transparent transition duration-300 ease-out font-sans select-none items-center relative group/button justify-center text-center items-center rounded-lg cursor-pointer active:scale-[0.97] active:duration-150 active:ease-outExpo origin-center whitespace-nowrap inline-flex text-sm h-8 aspect-[9/8]`;
    icon.setAttribute('type', 'button');
    icon.setAttribute('aria-label', 'Open prompt library - Access your saved prompts');
    icon.setAttribute('title', 'Prompt Library - Access your saved prompts');
    icon.setAttribute('data-state', 'closed');
    icon.setAttribute('data-instance-id', this.instanceId);
    icon.setAttribute('tabindex', '0');
    
    icon.innerHTML = `
      <div class="flex items-center min-w-0 font-medium gap-1.5 justify-center">
        <div class="flex shrink-0 items-center justify-center size-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10,9 9,9 8,9"/>
          </svg>
        </div>
      </div>
    `;
    
    return icon;
  }
  
  createChatGPTIcon() {
    const icon = document.createElement('button');
    icon.className = `prompt-library-integrated-icon composer-btn`;
    icon.setAttribute('type', 'button');
    icon.setAttribute('aria-label', 'Open prompt library - Access your saved prompts');
    icon.setAttribute('title', 'Prompt Library - Access your saved prompts');
    icon.setAttribute('data-dashlane-label', 'true');
    icon.setAttribute('data-instance-id', this.instanceId);
    icon.setAttribute('tabindex', '0');
    
    icon.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="icon" font-size="inherit">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10,9 9,9 8,9"/>
      </svg>
    `;
    
    return icon;
  }
  
  createSanofiIcon() {
    const icon = document.createElement('button');
    icon.className = `prompt-library-integrated-icon text-pulse-text-subtle hover:bg-elements-neutrals-100 hover:dark:bg-elements-neutrals-700 flex h-8 w-8 flex-col items-center justify-center px-1 hover:rounded-lg cursor-pointer border-0 bg-transparent`;
    icon.setAttribute('type', 'button');
    icon.setAttribute('aria-label', 'Open prompt library - Access your saved prompts');
    icon.setAttribute('title', 'Prompt Library - Access your saved prompts');
    icon.setAttribute('data-instance-id', this.instanceId);
    icon.setAttribute('tabindex', '0');
    icon.innerHTML = `
      <span class="material-icons-round _icon_mqc2e_1" style="font-size: 1.5rem;" aria-hidden="true">
        <span aria-hidden="true">library_books</span>
      </span>
    `;
    
    return icon;
  }
  
  createFloatingIcon() {
    const icon = document.createElement('button');
    icon.className = `prompt-library-icon`;
    icon.setAttribute('data-instance-id', this.instanceId);
    icon.setAttribute('type', 'button');
    icon.setAttribute('aria-label', 'Open prompt library - Access your saved prompts');
    icon.setAttribute('title', 'Prompt Library - Access your saved prompts');
    icon.setAttribute('tabindex', '0');
    icon.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10,9 9,9 8,9"/>
      </svg>
    `;
    
    return icon;
  }
}

class KeyboardNavigationManager {
  constructor(selectorElement, eventManager) {
    this.selector = selectorElement;
    this.eventManager = eventManager;
    this.selectedIndex = -1;
    this.items = [];
    this.isActive = false;
  }
  
  initialize() {
    this.updateItems();
    this.setupKeyboardHandlers();
    this.isActive = true;
    
    // Focus the search input initially
    const searchInput = this.selector.querySelector('.search-input');
    if (searchInput) {
      setTimeout(() => {
        searchInput.focus();
        Logger.info('Focused search input for keyboard navigation');
      }, 100);
    }
  }
  
  updateItems() {
    this.items = Array.from(this.selector.querySelectorAll('.prompt-item'));
    this.selectedIndex = -1;
    this.clearSelection();
  }
  
  setupKeyboardHandlers() {
    const keyboardHandler = (e) => {
      if (!this.isActive) return;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this.selectNext();
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.selectPrevious();
          break;
        case 'Enter':
          e.preventDefault();
          this.activateSelected();
          break;
        case 'Escape':
          e.preventDefault();
          this.close();
          break;
        case 'Tab':
          // Allow natural tab navigation within the modal
          break;
        default: {
          // For other keys, focus the search input if it's not already focused
          const searchInput = this.selector.querySelector('.search-input');
          if (searchInput && document.activeElement !== searchInput && 
              e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            searchInput.focus();
          }
          break;
        }
      }
    };
    
    this.eventManager.addTrackedEventListener(document, 'keydown', keyboardHandler);
    
    Logger.info('Keyboard navigation handlers setup');
  }
  
  selectNext() {
    if (this.items.length === 0) return;
    
    this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
    this.updateSelection();
    this.scrollToSelected();
  }
  
  selectPrevious() {
    if (this.items.length === 0) return;
    
    this.selectedIndex = this.selectedIndex <= 0 ? this.items.length - 1 : this.selectedIndex - 1;
    this.updateSelection();
    this.scrollToSelected();
  }
  
  updateSelection() {
    this.clearSelection();
    
    if (this.selectedIndex >= 0 && this.selectedIndex < this.items.length) {
      const selectedItem = this.items[this.selectedIndex];
      selectedItem.classList.add('keyboard-selected');
      selectedItem.setAttribute('aria-selected', 'true');
      
      Logger.info('Updated keyboard selection', { 
        index: this.selectedIndex, 
        itemId: selectedItem.dataset.promptId 
      });
    }
  }
  
  clearSelection() {
    this.items.forEach(item => {
      item.classList.remove('keyboard-selected');
      item.removeAttribute('aria-selected');
    });
  }
  
  scrollToSelected() {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.items.length) {
      const selectedItem = this.items[this.selectedIndex];
      const container = this.selector.querySelector('.prompt-list');
      
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const itemRect = selectedItem.getBoundingClientRect();
        
        if (itemRect.bottom > containerRect.bottom) {
          selectedItem.scrollIntoView({ block: 'end', behavior: 'smooth' });
        } else if (itemRect.top < containerRect.top) {
          selectedItem.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
      }
    }
  }
  
  activateSelected() {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.items.length) {
      const selectedItem = this.items[this.selectedIndex];
      Logger.info('Activating selected item via keyboard', { 
        index: this.selectedIndex, 
        itemId: selectedItem.dataset.promptId 
      });
      selectedItem.click();
    }
  }
  
  close() {
    const closeButton = this.selector.querySelector('.close-selector');
    if (closeButton) {
      Logger.info('Closing prompt selector via keyboard');
      closeButton.click();
    }
  }
  
  destroy() {
    this.isActive = false;
    this.clearSelection();
    Logger.info('Keyboard navigation manager destroyed');
  }
}

class StorageManager {
  static async getPrompts() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['prompts'], (result) => {
          if (chrome.runtime.lastError) {
            const error = new Error(`Chrome storage error: ${chrome.runtime.lastError.message}`);
            Logger.error('Failed to retrieve prompts from storage', error);
            resolve([]); // Graceful fallback to empty array
            return;
          }
          
          const prompts = result.prompts || [];
          Logger.info('Retrieved prompts from storage', { count: prompts.length });
          resolve(prompts);
        });
      } catch (error) {
        Logger.error('Unexpected error accessing chrome storage', error);
        resolve([]); // Graceful fallback
      }
    });
  }
  
  static escapeHtml(text) {
    try {
      if (typeof text !== 'string') {
        Logger.warn('escapeHtml received non-string input', { 
          type: typeof text, 
          value: text 
        });
        return String(text);
      }
      
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    } catch (error) {
      Logger.error('Failed to escape HTML', error, { text });
      return ''; // Safe fallback
    }
  }
}

class PromptLibraryInjector {
  constructor() {
    this.icon = null;
    this.currentTextarea = null;
    this.promptSelector = null;
    this.isInitialized = false;
    this.detectionTimeout = null;
    this.mutationObserver = null;
    this.hostname = window.location.hostname;
    
    // Add unique identifier to prevent cross-tab interference
    this.instanceId = `prompt-lib-${this.hostname}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize specialized components
    this.eventManager = new EventManager();
    this.uiFactory = new UIElementFactory(this.instanceId);
    this.keyboardNav = null;
    
    // Performance optimization: caching for DOM queries
    this.selectorCache = new Map();
    this.lastCacheTime = 0;
    this.cacheTimeout = 2000; // Cache results for 2 seconds
    
    // Mutation observer performance optimization
    this.mutationStats = {
      totalMutations: 0,
      relevantMutations: 0,
      throttledCalls: 0,
      lastResetTime: Date.now()
    };
    this.mutationThrottleDelay = 100; // Base throttle delay
    this.maxThrottleDelay = 2000; // Maximum throttle delay under load
    this.mutationBurst = [];
    this.isObserverThrottled = false;
    
    // Floating icon performance optimization
    this.iconPositionCache = {
      lastTop: null,
      lastLeft: null,
      isVisible: false,
      animationFrameId: null,
      updatePending: false
    };
    this.intersectionObserver = null;
    
    // Site-specific selectors for text input areas
    this.siteConfigs = {
      'concierge.sanofi.com': {
        selectors: [
          'textarea',
          'div[contenteditable="true"]',
          'input[type="text"]',
          '[role="textbox"]'
        ],
        buttonContainerSelector: '.absolute.bottom-2.right-2\\.5.flex.gap-2.self-end',
        name: 'Sanofi Concierge'
      },
      'www.perplexity.ai': {
        selectors: [
          'textarea[placeholder*="Ask"]',
          'textarea[placeholder*="follow"]',
          'textarea[data-testid="searchbox"]',
          'textarea[class*="search"]',
          'textarea',
          'div[contenteditable="true"]',
          '[role="textbox"]',
          'input[type="text"]',
          '[data-testid*="input"]',
          '[class*="input"]',
          '[placeholder*="Ask"]',
          '[placeholder*="follow"]'
        ],
        buttonContainerSelector: '.bg-background-50.dark\\:bg-offsetDark.flex.items-center.justify-self-end.rounded-full.col-start-3.row-start-2',
        name: 'Perplexity'
      },
      'claude.ai': {
        selectors: [
          'div[contenteditable="true"]',
          'textarea',
          '[role="textbox"]',
          'input[type="text"]',
          '[data-testid*="input"]',
          '[class*="input"]',
          'div[data-value]'
        ],
        buttonContainerSelector: '.relative.flex-1.flex.items-center.gap-2.shrink.min-w-0',
        name: 'Claude'
      },
      'chatgpt.com': {
        selectors: [
          'textarea[data-testid="chat-input"]',
          'textarea[placeholder*="Message"]',
          'textarea',
          'div[contenteditable="true"]',
          '[role="textbox"]',
          'input[type="text"]',
          '[data-testid*="input"]',
          '[class*="input"]'
        ],
        buttonContainerSelector: 'div[data-testid="composer-trailing-actions"] .ms-auto.flex.items-center',
        name: 'ChatGPT'
      }
    };
    
    this.init();
  }
  
  cleanup() {
    Logger.info('Starting cleanup', { instanceId: this.instanceId });
    
    // Remove current icon reference first (more efficient)
    if (this.icon) {
      try {
        this.icon.remove();
        Logger.info('Successfully removed current icon');
      } catch (error) {
        Logger.warn('Failed to remove current icon', {
          error: error.message,
          iconTag: this.icon.tagName,
          iconClass: this.icon.className
        });
      }
      this.icon = null;
    }
    
    // Fallback: Remove any remaining instances using data attributes
    const existingIcons = document.querySelectorAll(`[data-instance-id="${this.instanceId}"]`);
    let removedIcons = 0;
    let iconErrors = 0;
    
    existingIcons.forEach(icon => {
      try {
        icon.remove();
        removedIcons++;
      } catch (error) {
        iconErrors++;
        Logger.warn('Failed to remove icon during cleanup', {
          error: error.message,
          iconTag: icon.tagName,
          iconId: icon.id,
          iconClass: icon.className
        });
      }
    });
    
    if (removedIcons > 0 || iconErrors > 0) {
      Logger.info('Icon cleanup completed', { 
        removed: removedIcons, 
        errors: iconErrors 
      });
    }
    
    // Remove prompt selector if it exists
    this.closePromptSelector();
    
    // Remove any existing prompt selectors from this instance
    const existingSelectors = document.querySelectorAll('.prompt-library-selector');
    let removedSelectors = 0;
    let selectorErrors = 0;
    
    existingSelectors.forEach(selector => {
      try {
        selector.remove();
        removedSelectors++;
      } catch (error) {
        selectorErrors++;
        Logger.warn('Failed to remove prompt selector during cleanup', {
          error: error.message
        });
      }
    });
    
    if (removedSelectors > 0 || selectorErrors > 0) {
      Logger.info('Selector cleanup completed', { 
        removed: removedSelectors, 
        errors: selectorErrors 
      });
    }
    
    // Clear timeouts and intervals
    if (this.detectionTimeout) {
      try {
        clearTimeout(this.detectionTimeout);
        Logger.info('Detection timeout cleared');
      } catch (error) {
        Logger.warn('Failed to clear detection timeout', { error: error.message });
      }
    }
    
    // Remove any mutation observers
    if (this.mutationObserver) {
      try {
        this.mutationObserver.disconnect();
        Logger.info('Mutation observer disconnected');
      } catch (error) {
        Logger.warn('Failed to disconnect mutation observer', { error: error.message });
      }
    }
    
    // Clean up keyboard navigation
    if (this.keyboardNav) {
      this.keyboardNav.destroy();
      this.keyboardNav = null;
    }
    
    // Clean up all tracked event listeners using event manager
    this.eventManager.cleanup();
    
    // Clear selector cache for performance optimization
    if (this.selectorCache) {
      this.selectorCache.clear();
      Logger.info('Selector cache cleared', { 
        previousCacheSize: this.selectorCache.size 
      });
    }
    
    // Clear mutation observer performance tracking
    if (this.mutationStats) {
      Logger.info('Final mutation observer stats', this.mutationStats);
      this.mutationStats = {
        totalMutations: 0,
        relevantMutations: 0,
        throttledCalls: 0,
        lastResetTime: Date.now()
      };
    }
    
    // Clear mutation throttling state
    this.mutationBurst = [];
    this.isObserverThrottled = false;
    
    // Clean up floating icon performance optimization resources
    if (this.iconPositionCache) {
      // Cancel any pending animation frames
      if (this.iconPositionCache.animationFrameId) {
        cancelAnimationFrame(this.iconPositionCache.animationFrameId);
        Logger.info('Cancelled pending animation frame');
      }
      
      // Reset position cache
      this.iconPositionCache = {
        lastTop: null,
        lastLeft: null,
        isVisible: false,
        animationFrameId: null,
        updatePending: false
      };
    }
    
    // Clean up intersection observer
    if (this.intersectionObserver) {
      try {
        this.intersectionObserver.disconnect();
        Logger.info('Intersection observer disconnected');
      } catch (error) {
        Logger.warn('Failed to disconnect intersection observer', { error: error.message });
      }
      this.intersectionObserver = null;
    }
    
    // Reset state
    this.icon = null;
    this.currentTextarea = null;
    this.promptSelector = null;
    this.isInitialized = false;
    this.mutationObserver = null;
    this.lastCacheTime = 0;
  }

  init() {
    if (this.isInitialized) return;
    
    // Only initialize if we have a config for this site
    const config = this.siteConfigs[this.hostname];
    if (!config) {
      return;
    }
    
    this.isInitialized = true;
    
    // Inject CSS styles
    injectCSS();
    
    // Wait for page to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.startDetection());
    } else {
      this.startDetection();
    }
  }

  startDetection() {
    // Initial detection
    this.detectAndInjectIcon();
    
    // For dynamic content loading, retry detection periodically
    let retryCount = 0;
    const maxRetries = 20;
    const retryInterval = setInterval(() => {
      if (retryCount >= maxRetries || this.currentTextarea) {
        clearInterval(retryInterval);
        return;
      }
      this.detectAndInjectIcon();
      retryCount++;
    }, 500);
    
    // Create optimized mutation observer with advanced throttling
    this.mutationObserver = this.createOptimizedMutationObserver();
    
    // Set up optimized observation with multiple targeted scopes
    this.setupOptimizedObservation();
    
    // Also detect on focus events for Sanofi Concierge input elements
    const focusHandler = (e) => {
      if (e.target.matches('textarea, div[contenteditable="true"]')) {
        setTimeout(() => this.detectAndInjectIcon(), 100);
      }
    };
    this.eventManager.addTrackedEventListener(document, 'focusin', focusHandler);
  }

  // Optimized DOM query method with caching and efficient visibility checking
  findTextareaWithCaching(selectors, useCache = true) {
    const now = Date.now();
    const cacheKey = selectors.join('|');
    
    // Check cache if enabled and not expired
    if (useCache && this.selectorCache.has(cacheKey) && 
        (now - this.lastCacheTime) < this.cacheTimeout) {
      const cachedResult = this.selectorCache.get(cacheKey);
      
      // Verify cached element is still valid and visible
      if (cachedResult && this.isElementVisible(cachedResult)) {
        Logger.info('Using cached textarea element', { 
          selector: cacheKey.substring(0, 50) + '...',
          elementTag: cachedResult.tagName 
        });
        return cachedResult;
      } else {
        // Remove invalid cache entry
        this.selectorCache.delete(cacheKey);
      }
    }
    
    // Perform optimized DOM search
    const foundElement = this.performOptimizedSearch(selectors);
    
    // Cache the result if found
    if (foundElement && useCache) {
      this.selectorCache.set(cacheKey, foundElement);
      this.lastCacheTime = now;
      
      // Prevent cache from growing too large
      if (this.selectorCache.size > 10) {
        const oldestKey = this.selectorCache.keys().next().value;
        this.selectorCache.delete(oldestKey);
      }
    }
    
    return foundElement;
  }
  
  // Optimized search implementation
  performOptimizedSearch(selectors) {
    // Combine all selectors into a single query for better performance
    const combinedSelector = selectors.join(', ');
    
    try {
      // Single DOM query instead of multiple loops
      const allElements = document.querySelectorAll(combinedSelector);
      
      if (allElements.length === 0) return null;
      
      // Fast visibility check - only check elements that might be visible
      let bestElement = null;
      let bestScore = -1;
      
      for (const element of allElements) {
        // Quick visibility pre-check before expensive operations
        if (element.offsetHeight === 0 || element.offsetWidth === 0) continue;
        if (element.disabled || element.readOnly) continue;
        
        // Only do expensive getComputedStyle if element passes basic checks
        if (!this.isElementVisible(element)) continue;
        
        // Score elements based on preference (later selectors have higher priority)
        const selectorIndex = selectors.findIndex(sel => {
          try {
            return element.matches(sel);
          } catch {
            return false;
          }
        });
        
        if (selectorIndex > bestScore) {
          bestScore = selectorIndex;
          bestElement = element;
        }
      }
      
      return bestElement;
      
    } catch (error) {
      Logger.warn('Combined selector query failed, falling back to individual queries', {
        error: error.message,
        combinedSelector: combinedSelector.substring(0, 100) + '...'
      });
      
      // Fallback to individual queries if combined query fails
      return this.fallbackIndividualSearch(selectors);
    }
  }
  
  // Fallback method for individual selector queries
  fallbackIndividualSearch(selectors) {
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        
        for (const element of elements) {
          if (this.isElementVisible(element)) {
            return element;
          }
        }
      } catch (error) {
        Logger.warn('Individual selector query failed', {
          selector,
          error: error.message
        });
        continue;
      }
    }
    
    return null;
  }
  
  // Optimized visibility check with minimal getComputedStyle calls
  isElementVisible(element) {
    // Quick checks first
    if (!element || element.offsetHeight === 0 || element.offsetWidth === 0) {
      return false;
    }
    
    if (element.disabled || element.readOnly) {
      return false;
    }
    
    // Only call getComputedStyle once and cache the result
    try {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    } catch (error) {
      Logger.warn('Failed to get computed style', { 
        error: error.message,
        elementTag: element.tagName 
      });
      return false;
    }
  }

  // Create optimized mutation observer with intelligent throttling and filtering
  createOptimizedMutationObserver() {
    return new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });
  }
  
  // Advanced mutation handling with performance optimization
  handleMutations(mutations) {
    const now = Date.now();
    this.mutationStats.totalMutations += mutations.length;
    
    // Reset stats every 30 seconds for monitoring
    if (now - this.mutationStats.lastResetTime > 30000) {
      Logger.info('Mutation observer performance stats', {
        totalMutations: this.mutationStats.totalMutations,
        relevantMutations: this.mutationStats.relevantMutations,
        throttledCalls: this.mutationStats.throttledCalls,
        efficiency: this.mutationStats.totalMutations > 0 
          ? (this.mutationStats.relevantMutations / this.mutationStats.totalMutations * 100).toFixed(1) + '%'
          : '0%'
      });
      
      this.mutationStats = {
        totalMutations: 0,
        relevantMutations: 0,
        throttledCalls: 0,
        lastResetTime: now
      };
    }
    
    // Quick exit if already throttled
    if (this.isObserverThrottled) {
      this.mutationStats.throttledCalls++;
      return;
    }
    
    // Intelligent mutation filtering
    const relevantMutation = this.filterRelevantMutations(mutations);
    
    if (relevantMutation) {
      this.mutationStats.relevantMutations++;
      this.scheduleThrottledDetection();
    }
  }
  
  // Intelligent filtering to only process relevant mutations
  filterRelevantMutations(mutations) {
    for (const mutation of mutations) {
      // Quick type check
      if (mutation.type === 'childList') {
        // Check for added input-related nodes
        if (this.hasRelevantChildListChanges(mutation)) {
          return mutation;
        }
      } else if (mutation.type === 'attributes') {
        // Check for attribute changes on input elements
        if (this.hasRelevantAttributeChanges(mutation)) {
          return mutation;
        }
      }
    }
    return null;
  }
  
  // Check if childList mutations contain relevant input elements
  hasRelevantChildListChanges(mutation) {
    // Early exit for mutations without added nodes
    if (!mutation.addedNodes || mutation.addedNodes.length === 0) {
      return false;
    }
    
    // Check added nodes efficiently
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      
      try {
        // Direct match check first (most common case)
        if (node.matches && node.matches('textarea, [contenteditable], [role="textbox"]')) {
          return true;
        }
        
        // Only do expensive querySelector if node could contain input elements
        if (this.couldContainInputElements(node)) {
          if (node.querySelector && node.querySelector('textarea, [contenteditable="true"], [role="textbox"]')) {
            return true;
          }
        }
      } catch (error) {
        // Log but don't break on selector errors
        Logger.warn('Error checking mutation node', { 
          error: error.message,
          nodeTag: node.tagName 
        });
        continue;
      }
    }
    
    return false;
  }
  
  // Quick heuristic to avoid expensive querySelector calls
  couldContainInputElements(node) {
    if (!node.tagName) return false;
    
    // Common containers that might have input elements
    const potentialContainers = ['DIV', 'FORM', 'SECTION', 'MAIN', 'ARTICLE', 'ASIDE'];
    return potentialContainers.includes(node.tagName);
  }
  
  // Check if attribute mutations are on relevant elements
  hasRelevantAttributeChanges(mutation) {
    try {
      const target = mutation.target;
      if (!target || !target.matches) return false;
      
      return target.matches('textarea, [contenteditable], [role="textbox"]');
    } catch (error) {
      Logger.warn('Error checking attribute mutation', { 
        error: error.message,
        targetTag: mutation.target?.tagName 
      });
      return false;
    }
  }
  
  // Advanced throttling system that adapts to mutation load
  scheduleThrottledDetection() {
    // Clear any existing timeout
    clearTimeout(this.detectionTimeout);
    
    // Track mutation burst for adaptive throttling
    const now = Date.now();
    this.mutationBurst.push(now);
    
    // Keep only recent mutations (last 2 seconds)
    this.mutationBurst = this.mutationBurst.filter(time => now - time < 2000);
    
    // Calculate adaptive throttle delay based on mutation frequency
    let throttleDelay = this.mutationThrottleDelay;
    
    if (this.mutationBurst.length > 10) {
      // High mutation rate - increase throttling
      throttleDelay = Math.min(this.maxThrottleDelay, this.mutationThrottleDelay * 2);
      Logger.info('High mutation rate detected, increasing throttle delay', {
        burstSize: this.mutationBurst.length,
        newDelay: throttleDelay
      });
    } else if (this.mutationBurst.length > 20) {
      // Extreme mutation rate - temporarily disable observer
      this.isObserverThrottled = true;
      Logger.warn('Extreme mutation rate, temporarily throttling observer', {
        burstSize: this.mutationBurst.length
      });
      
      // Re-enable after cooldown period
      setTimeout(() => {
        this.isObserverThrottled = false;
        this.mutationBurst = [];
        Logger.info('Mutation observer throttling released');
      }, 5000);
      
      return;
    }
    
    // Schedule detection with adaptive delay
    this.detectionTimeout = setTimeout(() => {
      this.detectAndInjectIcon();
    }, throttleDelay);
  }
  
  // Set up optimized observation with site-specific targeting
  setupOptimizedObservation() {
    const hostname = window.location.hostname;
    const config = this.siteConfigs[hostname];
    
    // Get site-specific observation targets
    let observeTargets = [
      'main', '[role="main"]', '.chat-container', '.input-container', 
      '[class*="chat"]', '[class*="input"]', '[class*="compose"]'
    ];
    
    // Add site-specific targets based on configuration
    if (config && config.buttonContainerSelector) {
      // Try to observe near the button container area
      // Remove leading dot and split, then take all but last class
      const selectorWithoutDot = config.buttonContainerSelector.startsWith('.') 
        ? config.buttonContainerSelector.substring(1) 
        : config.buttonContainerSelector;
      const classParts = selectorWithoutDot.split('.');
      
      if (classParts.length > 1) {
        // Take all but the last class to get a broader container
        const containerParent = classParts.slice(0, -1).join('.');
        if (containerParent && containerParent.length > 0) {
          observeTargets.unshift(`.${containerParent}`);
        }
      }
    }
    
    // Find the most specific target available
    let observeTarget = document.body; // Ultimate fallback
    let targetSpecificity = 0;
    
    for (let i = 0; i < observeTargets.length; i++) {
      const selector = observeTargets[i];
      try {
        const target = document.querySelector(selector);
        if (target && target !== document.body) {
          // Prefer more specific targets (later in array = more specific)
          observeTarget = target;
          targetSpecificity = i;
        }
      } catch (error) {
        Logger.warn('Invalid observation target selector', { selector, error: error.message });
        continue;
      }
    }
    
    Logger.info('Setting up mutation observer', {
      target: observeTarget.tagName,
      targetId: observeTarget.id || 'none',
      targetClass: observeTarget.className?.substring(0, 50) || 'none',
      specificity: targetSpecificity,
      hostname
    });
    
    // Use optimized observation configuration
    const observerConfig = {
      childList: true,
      // Only use subtree if we're observing a large container
      subtree: targetSpecificity < 2, // More specific targets don't need subtree
      attributes: true,
      // Minimal attribute filter for better performance
      attributeFilter: ['contenteditable', 'role', 'placeholder']
    };
    
    Logger.info('Mutation observer configuration', observerConfig);
    
    try {
      this.mutationObserver.observe(observeTarget, observerConfig);
      Logger.info('Mutation observer started successfully');
    } catch (error) {
      Logger.error('Failed to start mutation observer', error);
      
      // Fallback to document.body with minimal config
      try {
        this.mutationObserver.observe(document.body, {
          childList: true,
          subtree: false, // Reduced scope for fallback
          attributes: false // Disable attributes for fallback
        });
        Logger.info('Fallback mutation observer started on document.body');
      } catch (fallbackError) {
        Logger.error('Failed to start fallback mutation observer', fallbackError);
      }
    }
  }

  detectAndInjectIcon() {
    const hostname = window.location.hostname;
    const config = this.siteConfigs[hostname];
    
    if (!config) return;
    
    Logger.info('Starting optimized textarea detection', { 
      hostname,
      selectorCount: config.selectors.length 
    });
    
    // Use optimized cached search for primary selectors
    let textarea = this.findTextareaWithCaching(config.selectors);
    
    if (!textarea) {
      // Fallback: try to find any input-like element (without caching to avoid stale results)
      const fallbackSelectors = [
        'textarea',
        'div[contenteditable="true"]',
        'input[type="text"]',
        '[role="textbox"]',
        '[contenteditable]',
        '[data-testid*="input"]',
        '[class*="input"]'
      ];
      
      Logger.info('Primary selectors failed, trying fallback selectors');
      textarea = this.findTextareaWithCaching(fallbackSelectors, false); // No caching for fallbacks
      
      if (!textarea) {
        Logger.info('No suitable textarea found');
        return;
      }
    }
    
    if (textarea === this.currentTextarea) {
      Logger.info('Textarea unchanged, skipping injection');
      return;
    }
    
    Logger.info('Found new textarea, proceeding with injection', {
      elementTag: textarea.tagName,
      elementId: textarea.id,
      elementClass: textarea.className?.substring(0, 50) + '...'
    });
    
    this.currentTextarea = textarea;
    this.injectIcon(textarea);
  }

  injectIcon(textarea) {
    try {
      Logger.info('Starting icon injection', { 
        hostname: this.hostname,
        textareaTag: textarea.tagName,
        textareaId: textarea.id,
        textareaClass: textarea.className 
      });
      
      // Remove existing icon if any
      if (this.icon) {
        try {
          this.icon.remove();
          Logger.info('Removed existing icon before injection');
        } catch (removeError) {
          Logger.warn('Failed to remove existing icon', { error: removeError.message });
        }
      }
      
      const hostname = window.location.hostname;
      const config = this.siteConfigs[hostname];
      
      if (!config) {
        Logger.warn('No site configuration found for hostname', { hostname });
        return;
      }
    
    // For supported sites, try integrated button approach
    if (hostname === 'concierge.sanofi.com' || hostname === 'claude.ai' || hostname === 'www.perplexity.ai' || hostname === 'chatgpt.com') {
      // Find the button container using configured selector or fallback selectors
      let buttonContainer = null;
      
      if (config.buttonContainerSelector) {
        try {
          buttonContainer = document.querySelector(config.buttonContainerSelector);
          if (buttonContainer) {
            Logger.info('Found button container using primary selector', {
              selector: config.buttonContainerSelector
            });
          }
        } catch (error) {
          Logger.warn('Primary button container selector failed', {
            selector: config.buttonContainerSelector,
            error: error.message
          });
        }
      }
      
      // Try fallback selectors if primary one fails
      if (!buttonContainer) {
        let fallbackSelectors = [];
        
        if (hostname === 'www.perplexity.ai') {
          // Perplexity-specific fallbacks for different page types
          fallbackSelectors = [
            // Original selector for main page
            '.bg-background-50.dark\\:bg-offsetDark.flex.items-center.justify-self-end.rounded-full.col-start-3.row-start-2',
            // Alternative selectors for search pages and different layouts
            '.bg-background-50[class*="flex"][class*="items-center"][class*="rounded-full"]',
            'div[class*="bg-background-50"][class*="flex"][class*="items-center"]',
            '.flex.items-center.justify-self-end.rounded-full',
            '[class*="col-start-3"][class*="row-start-2"]',
            // Generic button container fallbacks
            'div[class*="flex"][class*="items-center"]:has(button[aria-label*="Attach"])',
            'div[class*="flex"][class*="items-center"]:has(button[type="button"])',
            '.flex.items-center:has(button)',
            // Last resort - find any container with multiple buttons
            'div:has(button):has(button + button)',
            'div[class*="flex"]:has(button[aria-label])'
          ];
        } else if (hostname === 'chatgpt.com') {
          // ChatGPT-specific fallbacks
          fallbackSelectors = [
            // Primary structure-based selectors
            'div[data-testid="composer-trailing-actions"] .ms-auto.flex.items-center',
            'div[data-testid="composer-trailing-actions"] div.ms-auto',
            'div[data-testid="composer-trailing-actions"] .ms-auto',
            '[data-testid="composer-trailing-actions"] div[class*="ms-auto"]',
            // Alternative selectors
            '.ms-auto.flex.items-center',
            'div[class*="ms-auto"][class*="flex"][class*="items-center"]',
            // Generic button container fallbacks
            'div[class*="flex"][class*="items-center"]:has(button[data-testid*="speech"])',
            'div[class*="flex"][class*="items-center"]:has(button[aria-label*="Dictate"])',
            'div[class*="flex"][class*="items-center"]:has(button.composer-btn)',
            '.flex.items-center:has(button)',
            // Last resort
            'div:has(button):has(button + button)',
            'div[class*="flex"]:has(button[aria-label])'
          ];
        } else {
          // Default fallbacks for other sites
          fallbackSelectors = [
            '[class*="bottom-2"][class*="right-2"][class*="flex"]',
            '[class*="absolute"][class*="bottom"][class*="right"][class*="flex"]',
            '.flex.gap-2.self-end',
            '[class*="gap-2"][class*="self-end"]'
          ];
        }
        
        for (const selector of fallbackSelectors) {
          try {
            buttonContainer = document.querySelector(selector);
            if (buttonContainer) {
              Logger.info('Found button container using fallback selector', { selector });
              break;
            }
          } catch (error) {
            Logger.warn('Fallback selector failed', {
              selector,
              error: error.message
            });
          }
        }
        
        if (!buttonContainer) {
          Logger.warn('No button container found with any selector', {
            hostname,
            primarySelector: config.buttonContainerSelector,
            fallbackCount: fallbackSelectors.length
          });
        }
      }
      
      
      if (buttonContainer && !buttonContainer.querySelector(`[data-instance-id="${this.instanceId}"]`)) {
        if (hostname === 'claude.ai') {
          try {
            // Claude.ai specific - create wrapped container like other buttons
            const result = this.uiFactory.createClaudeIcon();
            const iconContainer = result.container;
            this.icon = result.icon;
            
            // Find the research button container and insert before it
            let insertionPoint = null;
            const insertionSelectors = [
              'div.flex.shrink.min-w-8',                    // Research button container
              '[class*="flex"][class*="shrink"][class*="min-w"]', // Alternative research container
              'div:has(button[aria-label*="Research"])',     // Container with research button
              'div.flex:last-child',                        // Last flex container
              ':last-child'                                 // Last child as final fallback
            ];
            
            for (const selector of insertionSelectors) {
              try {
                insertionPoint = buttonContainer.querySelector(selector);
                if (insertionPoint) {
                  break;
                }
              } catch {
                // Continue with next selector
              }
            }
            
            // Insert the icon
            if (insertionPoint) {
              buttonContainer.insertBefore(iconContainer, insertionPoint);
            } else {
              buttonContainer.appendChild(iconContainer);
            }
            
          } catch (claudeError) {
            Logger.error('Failed to create Claude.ai integrated icon', claudeError, {
              hostname: 'claude.ai',
              containerFound: !!buttonContainer
            });
            // Fall back to floating icon
            this.createFloatingIcon(textarea);
            return;
          }
          
        } else if (hostname === 'www.perplexity.ai') {
          // Perplexity specific styling
          this.icon = this.uiFactory.createPerplexityIcon();
          
          // Insert before the voice mode button or at appropriate position
          let insertPosition = null;
          
          // Try multiple selectors to find a good insertion point
          const insertionSelectors = [
            'button.bg-super',           // Voice mode button
            '.ml-2',                     // Voice button container
            'button[aria-label*="Voice"]', // Voice button by aria-label
            'button[aria-label*="Dictation"]', // Dictation button
            'button:last-child'          // Last button as fallback
          ];
          
          for (const selector of insertionSelectors) {
            try {
              insertPosition = buttonContainer.querySelector(selector);
              if (insertPosition) {
                break;
              }
            } catch {
              // Continue with next selector
            }
          }
          
          if (insertPosition) {
            try {
              buttonContainer.insertBefore(this.icon, insertPosition);
            } catch {
              buttonContainer.appendChild(this.icon);
            }
          } else {
            // Fallback: insert at the end
            buttonContainer.appendChild(this.icon);
          }
          
        } else if (hostname === 'chatgpt.com') {
          // ChatGPT specific styling
          this.icon = this.uiFactory.createChatGPTIcon();
          
          // Insert before the voice mode button (last button in container)
          const voiceButton = buttonContainer.querySelector('button[data-testid="composer-speech-button"]') ||
                             buttonContainer.querySelector('button[aria-label*="voice"]') ||
                             buttonContainer.querySelector('button:last-child');
          
          if (voiceButton && voiceButton.parentElement) {
            // Create span wrapper like other buttons
            const spanWrapper = document.createElement('span');
            spanWrapper.className = '';
            spanWrapper.setAttribute('data-state', 'closed');
            spanWrapper.appendChild(this.icon);
            
            try {
              buttonContainer.insertBefore(spanWrapper, voiceButton.parentElement);
            } catch {
              buttonContainer.appendChild(spanWrapper);
            }
          } else {
            // Fallback: create span wrapper and append
            const spanWrapper = document.createElement('span');
            spanWrapper.className = '';
            spanWrapper.setAttribute('data-state', 'closed');
            spanWrapper.appendChild(this.icon);
            
            buttonContainer.appendChild(spanWrapper);
          }
          
        } else {
          // Sanofi Concierge styling
          this.icon = this.uiFactory.createSanofiIcon();
          
          const sendButton = buttonContainer.lastElementChild;
          buttonContainer.insertBefore(this.icon, sendButton);
        }
        
        // Add click handler
        this.icon.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showPromptSelector(textarea);
        });
        
        return;
      }
    }
    
    // For all other sites or if integrated approach fails, use floating icon
    this.createFloatingIcon(textarea);
    } catch (mainError) {
      Logger.error('Icon injection failed completely', mainError, {
        hostname: this.hostname,
        textareaTag: textarea?.tagName,
        hasConfig: !!this.siteConfigs[this.hostname]
      });
      
      // Last resort: try creating a simple floating icon
      try {
        Logger.info('Attempting fallback to floating icon');
        this.createFloatingIcon(textarea);
      } catch (fallbackError) {
        Logger.error('Fallback floating icon creation failed', fallbackError);
        // Complete failure - no icon will be shown
      }
    }
  }

  createFloatingIcon(textarea) {
    // Create icon element using UI factory
    this.icon = this.uiFactory.createFloatingIcon();
    
    // Position icon relative to textarea
    this.positionIcon(textarea);
    
    // Add click handler
    this.icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showPromptSelector(textarea);
    });
    
    // Add to DOM
    document.body.appendChild(this.icon);
  }

  // Optimized icon positioning with performance enhancements
  positionIcon(textarea) {
    // Set initial position
    this.updateIconPosition(textarea, true);
    
    // Set up optimized position tracking
    this.setupIconPositionTracking(textarea);
  }
  
  // Initial position setup and caching
  updateIconPosition(textarea, isInitial = false) {
    if (!textarea || !this.icon) return;
    
    const rect = textarea.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    // Calculate new position
    const newTop = rect.top + scrollTop + 8;
    const newLeft = rect.right + scrollLeft - 52; // 32px icon + 20px margin
    
    // Check if position actually changed (avoid unnecessary DOM updates)
    if (!isInitial && 
        Math.abs(newTop - this.iconPositionCache.lastTop) < 1 &&
        Math.abs(newLeft - this.iconPositionCache.lastLeft) < 1) {
      return; // Skip update if position hasn't changed significantly
    }
    
    // Cache the new position
    this.iconPositionCache.lastTop = newTop;
    this.iconPositionCache.lastLeft = newLeft;
    
    // Apply styles efficiently
    const iconStyle = this.icon.style;
    iconStyle.position = 'absolute';
    iconStyle.top = newTop + 'px';
    iconStyle.left = newLeft + 'px';
    iconStyle.zIndex = '999999';
    
    if (isInitial) {
      Logger.info('Initial floating icon positioned', {
        top: newTop,
        left: newLeft,
        textareaTag: textarea.tagName
      });
    }
  }
  
  // Set up optimized position tracking with modern performance techniques
  setupIconPositionTracking(textarea) {
    // Create throttled update function using requestAnimationFrame
    const throttledUpdatePosition = this.createThrottledPositionUpdate(textarea);
    
    // Set up intersection observer for visibility detection
    this.setupIconVisibilityTracking();
    
    // Add optimized event listeners
    this.eventManager.addTrackedEventListener(window, 'scroll', throttledUpdatePosition, { passive: true });
    this.eventManager.addTrackedEventListener(window, 'resize', throttledUpdatePosition, { passive: true });
    
    Logger.info('Optimized icon position tracking enabled');
  }
  
  // Create throttled position update using requestAnimationFrame
  createThrottledPositionUpdate(textarea) {
    return () => {
      // Skip if update already pending or icon not visible
      if (this.iconPositionCache.updatePending || !this.iconPositionCache.isVisible) {
        return;
      }
      
      this.iconPositionCache.updatePending = true;
      
      // Cancel any existing animation frame
      if (this.iconPositionCache.animationFrameId) {
        cancelAnimationFrame(this.iconPositionCache.animationFrameId);
      }
      
      // Schedule update for next frame
      this.iconPositionCache.animationFrameId = requestAnimationFrame(() => {
        this.updateIconPosition(textarea);
        this.iconPositionCache.updatePending = false;
        this.iconPositionCache.animationFrameId = null;
      });
    };
  }
  
  // Set up intersection observer for efficient visibility tracking
  setupIconVisibilityTracking() {
    if (!this.icon) return;
    
    // Clean up existing observer
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    
    try {
      // Create intersection observer with optimized settings
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          const wasVisible = this.iconPositionCache.isVisible;
          this.iconPositionCache.isVisible = entry.isIntersecting;
          
          // Log visibility changes for debugging
          if (wasVisible !== this.iconPositionCache.isVisible) {
            Logger.info('Icon visibility changed', {
              isVisible: this.iconPositionCache.isVisible,
              intersectionRatio: entry.intersectionRatio
            });
          }
        },
        {
          // Use viewport as root for better performance
          root: null,
          // Small margin to start updates slightly before icon becomes visible
          rootMargin: '50px',
          // Single threshold - we only care about visibility, not specific ratios
          threshold: 0
        }
      );
      
      // Start observing the icon
      this.intersectionObserver.observe(this.icon);
      
      // Initially assume visible (will be corrected by observer)
      this.iconPositionCache.isVisible = true;
      
      Logger.info('Icon intersection observer initialized');
      
    } catch (error) {
      Logger.warn('Failed to create intersection observer, falling back to always-update mode', {
        error: error.message
      });
      
      // Fallback: assume always visible
      this.iconPositionCache.isVisible = true;
    }
  }

  async showPromptSelector(textarea) {
    let prompts = [];
    
    try {
      Logger.info('Showing prompt selector', {
        textareaTag: textarea.tagName,
        hasExistingSelector: !!this.promptSelector
      });
      
      // Remove existing selector
      this.closePromptSelector();
      
      // Get prompts from storage
      prompts = await StorageManager.getPrompts();
      Logger.info('Retrieved prompts for selector', { count: prompts.length });
    
    // Create selector UI with accessibility attributes
    this.promptSelector = document.createElement('div');
    this.promptSelector.className = 'prompt-library-selector';
    this.promptSelector.setAttribute('role', 'dialog');
    this.promptSelector.setAttribute('aria-modal', 'true');
    this.promptSelector.setAttribute('aria-labelledby', 'prompt-selector-title');
    this.promptSelector.setAttribute('aria-describedby', 'prompt-selector-description');
    
    const promptsHtml = prompts.map((prompt, index) => {
      return '<div class="prompt-item" ' +
             'data-prompt-id="' + StorageManager.escapeHtml(prompt.id) + '" ' +
             'role="option" ' +
             'aria-describedby="prompt-item-' + index + '-desc" ' +
             'tabindex="-1">' +
        '<div class="prompt-title">' + StorageManager.escapeHtml(prompt.title) + '</div>' +
        '<div class="prompt-category">' + StorageManager.escapeHtml(prompt.category) + '</div>' +
        '<div class="prompt-preview" id="prompt-item-' + index + '-desc">' + 
        StorageManager.escapeHtml(prompt.content.substring(0, 100)) + 
        (prompt.content.length > 100 ? '...' : '') + '</div>' +
      '</div>';
    }).join('');
    
    this.promptSelector.innerHTML = 
      '<div class="prompt-selector-header">' +
        '<h3 id="prompt-selector-title">Select a Prompt</h3>' +
        '<button class="close-selector" ' +
                'type="button" ' +
                'aria-label="Close prompt selector" ' +
                'title="Close prompt selector">×</button>' +
      '</div>' +
      '<div class="prompt-search">' +
        '<label for="prompt-search-input" class="sr-only">Search prompts</label>' +
        '<input type="text" ' +
               'id="prompt-search-input" ' +
               'placeholder="Search prompts..." ' +
               'class="search-input" ' +
               'aria-describedby="prompt-selector-description" ' +
               'autocomplete="off">' +
      '</div>' +
      '<div id="prompt-selector-description" class="sr-only">' +
        'Use arrow keys to navigate, Enter to select, Escape to close' +
      '</div>' +
      '<div class="prompt-list" ' +
           'role="listbox" ' +
           'aria-label="Available prompts" ' +
           'aria-multiselectable="false">' +
        (promptsHtml || '<div class="no-prompts" role="status" aria-live="polite">No prompts found. Add some in the extension popup!</div>') +
      '</div>';
    
    // Position selector relative to the icon if it exists, otherwise relative to textarea
    let rect, scrollTop;
    
    if (this.icon) {
      // Position relative to the actual icon button
      rect = this.icon.getBoundingClientRect();
      scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      
      const selectorWidth = 400;
      const selectorHeight = 500;
      const margin = 8;
      
      // Calculate optimal position
      let top = rect.top + scrollTop - selectorHeight - margin;
      let left = rect.right + scrollLeft - selectorWidth;
      
      // Adjust if popup would go off-screen
      if (top < scrollTop + margin) {
        // Not enough space above, position below
        top = rect.bottom + scrollTop + margin;
      }
      
      if (left < scrollLeft + margin) {
        // Not enough space on the right, align to left edge of button
        left = rect.left + scrollLeft;
      }
      
      if (left + selectorWidth > window.innerWidth + scrollLeft - margin) {
        // Would go off right edge, align right edge to screen
        left = window.innerWidth + scrollLeft - selectorWidth - margin;
      }
      
      this.promptSelector.style.position = 'absolute';
      this.promptSelector.style.top = top + 'px';
      this.promptSelector.style.left = left + 'px';
      this.promptSelector.style.zIndex = '1000000';
    } else {
      // Fallback to textarea positioning
      rect = textarea.getBoundingClientRect();
      scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      this.promptSelector.style.position = 'absolute';
      this.promptSelector.style.top = (rect.bottom + scrollTop + 5) + 'px';
      this.promptSelector.style.right = '20px';
      this.promptSelector.style.zIndex = '1000000';
    }
    
    // Add event listeners
    this.promptSelector.querySelector('.close-selector').addEventListener('click', () => {
      this.closePromptSelector();
    });
    
    this.promptSelector.querySelectorAll('.prompt-item').forEach(item => {
      item.addEventListener('click', () => {
        const promptId = item.dataset.promptId;
        const prompt = prompts.find(p => p.id === promptId);
        if (prompt) {
          this.insertPrompt(textarea, prompt.content);
          this.closePromptSelector();
        }
      });
    });
    
    // Add search functionality
    const searchInput = this.promptSelector.querySelector('.search-input');
    searchInput.addEventListener('input', (e) => {
      this.filterPrompts(e.target.value, prompts);
    });
    
    document.body.appendChild(this.promptSelector);
    
    // Initialize keyboard navigation
    this.keyboardNav = new KeyboardNavigationManager(this.promptSelector, this.eventManager);
    this.keyboardNav.initialize();
    
    Logger.info('Prompt selector created and keyboard navigation initialized', {
      promptCount: prompts.length
    });
    
    // Close on outside click - using EventManager for proper cleanup
    setTimeout(() => {
      const outsideClickHandler = (e) => {
        if (this.promptSelector && 
            !this.promptSelector.contains(e.target) && 
            this.icon && 
            !this.icon.contains(e.target)) {
          this.closePromptSelector();
        }
      };
      this.eventManager.addTrackedEventListener(document, 'click', outsideClickHandler);
    }, 100);
    
    } catch (error) {
      Logger.error('Failed to show prompt selector', error, {
        textareaTag: textarea?.tagName,
        promptCount: prompts?.length || 0
      });
      
      // Clean up any partially created selector
      this.closePromptSelector();
    }
  }

  filterPrompts(searchTerm, prompts) {
    const filteredPrompts = prompts.filter(prompt => 
      prompt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prompt.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prompt.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    Logger.info('Filtered prompts', { 
      searchTerm, 
      originalCount: prompts.length, 
      filteredCount: filteredPrompts.length 
    });
    
    const promptsHtml = filteredPrompts.map((prompt, index) => {
      return '<div class="prompt-item" ' +
             'data-prompt-id="' + StorageManager.escapeHtml(prompt.id) + '" ' +
             'role="option" ' +
             'aria-describedby="filtered-prompt-item-' + index + '-desc" ' +
             'tabindex="-1">' +
        '<div class="prompt-title">' + StorageManager.escapeHtml(prompt.title) + '</div>' +
        '<div class="prompt-category">' + StorageManager.escapeHtml(prompt.category) + '</div>' +
        '<div class="prompt-preview" id="filtered-prompt-item-' + index + '-desc">' + 
        StorageManager.escapeHtml(prompt.content.substring(0, 100)) + 
        (prompt.content.length > 100 ? '...' : '') + '</div>' +
      '</div>';
    }).join('');
    
    this.promptSelector.querySelector('.prompt-list').innerHTML = 
      promptsHtml || '<div class="no-prompts" role="status" aria-live="polite">No matching prompts found.</div>';
    
    // Update keyboard navigation with new items
    if (this.keyboardNav) {
      this.keyboardNav.updateItems();
    }
    
    // Re-add click listeners
    this.promptSelector.querySelectorAll('.prompt-item').forEach(item => {
      item.addEventListener('click', () => {
        const promptId = item.dataset.promptId;
        const prompt = filteredPrompts.find(p => p.id === promptId);
        if (prompt) {
          this.insertPrompt(this.currentTextarea, prompt.content);
          this.closePromptSelector();
        }
      });
    });
  }

  closePromptSelector() {
    if (this.promptSelector) {
      try {
        this.promptSelector.remove();
        Logger.info('Prompt selector closed and removed from DOM');
      } catch (error) {
        Logger.warn('Failed to remove prompt selector', { error: error.message });
      }
      this.promptSelector = null;
    }
    
    // Cleanup keyboard navigation
    if (this.keyboardNav) {
      this.keyboardNav.destroy();
      this.keyboardNav = null;
    }
    
    // Note: EventManager.cleanup() will handle all tracked event listeners
    // including the outside click handler when the component is destroyed
  }

  insertPrompt(textarea, content) {
    const hostname = window.location.hostname;
    
    // Site-specific insertion logic
    if (hostname === 'www.perplexity.ai') {
      // Perplexity specific insertion
      textarea.focus();
      
      // Try multiple approaches for Perplexity
      if (textarea.contentEditable === 'true') {
        // Method 1: Direct content insertion
        textarea.textContent = content;
        
        // Method 2: Try innerHTML if textContent doesn't work
        if (!textarea.textContent) {
          textarea.innerHTML = content;
        }
        
        // Method 3: Try using selection API
        if (!textarea.textContent && !textarea.innerHTML) {
          textarea.focus();
          const selection = window.getSelection();
          selection.selectAllChildren(textarea);
          selection.deleteFromDocument();
          selection.getRangeAt(0).insertNode(document.createTextNode(content));
        }
      } else if (textarea.tagName === 'TEXTAREA') {
        textarea.value = content;
      }
      
      // Trigger multiple events for Perplexity
      const events = ['input', 'change', 'keyup', 'paste'];
      events.forEach(eventType => {
        textarea.dispatchEvent(new Event(eventType, { bubbles: true }));
      });
      
      // Try React-style updates
      const reactKeys = Object.keys(textarea).find(key => key.startsWith('__reactInternalInstance') || key.startsWith('__reactFiber'));
      if (reactKeys) {
        const reactInstance = textarea[reactKeys];
        if (reactInstance && reactInstance.memoizedProps && reactInstance.memoizedProps.onChange) {
          reactInstance.memoizedProps.onChange({ target: { value: content } });
        }
      }
      
      // Try setting React input value directly - secure approach
      if (textarea.tagName === 'TEXTAREA' && textarea instanceof HTMLTextAreaElement) {
        try {
          // Use the native property setter safely
          const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
          if (originalDescriptor && typeof originalDescriptor.set === 'function') {
            // Validate that we're calling the original native setter
            const nativeSetterString = originalDescriptor.set.toString();
            if (nativeSetterString.includes('[native code]')) {
              originalDescriptor.set.call(textarea, content);
              textarea.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
              Logger.warn('Suspicious value setter detected, falling back to direct assignment');
              textarea.value = content;
              textarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
          } else {
            // Fallback to direct assignment if descriptor is unavailable
            textarea.value = content;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
          }
        } catch (error) {
          Logger.warn('Failed to use property descriptor, using direct assignment', { error: error.message });
          textarea.value = content;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      
      // Try manual typing simulation using modern approach
      setTimeout(() => {
        textarea.focus();
        
        // Modern replacement for execCommand
        if (textarea.tagName === 'TEXTAREA') {
          textarea.select(); // Select all content
          textarea.setRangeText(content, 0, textarea.value.length, 'end');
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          // For contenteditable elements
          const selection = window.getSelection();
          selection.selectAllChildren(textarea);
          selection.deleteFromDocument();
          selection.getRangeAt(0).insertNode(document.createTextNode(content));
        }
      }, 100);
      
      // Perplexity insertion complete
      
    } else {
      // Default insertion for other sites
      if (textarea.contentEditable === 'true') {
        // For contenteditable divs
        textarea.focus();
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(content));
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        // For textarea elements
        textarea.focus();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        textarea.value = text.substring(0, start) + content + text.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + content.length;
      }
      
      // Trigger input event
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

}

// Enhanced cross-tab interference prevention
let promptLibraryInstance = null;

// Initialize with proper cleanup and cross-tab prevention
function initializePromptLibrary() {
  // Cleanup any existing instance first
  if (promptLibraryInstance) {
    promptLibraryInstance.cleanup();
    promptLibraryInstance = null;
  }
  
  // Create new instance
  promptLibraryInstance = new PromptLibraryInjector();
}

// Initialize on load
initializePromptLibrary();

// Cleanup on page unload to prevent cross-tab interference
window.addEventListener('beforeunload', () => {
  if (promptLibraryInstance) {
    promptLibraryInstance.cleanup();
    promptLibraryInstance = null;
  }
});

// Enhanced visibility change handling
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Page is hidden (tab switched away) - cleanup UI elements
    if (promptLibraryInstance) {
      if (promptLibraryInstance.promptSelector) {
        try {
          promptLibraryInstance.promptSelector.remove();
          promptLibraryInstance.promptSelector = null;
        } catch {
          // Silent cleanup
        }
      }
    }
  } else {
    // Page is visible again - reinitialize if needed
    setTimeout(() => {
      if (!promptLibraryInstance || !promptLibraryInstance.isInitialized) {
        initializePromptLibrary();
      } else {
        // Just re-detect and inject if needed
        promptLibraryInstance.detectAndInjectIcon();
      }
    }, 100);
  }
});

// Additional focus/blur handling for better cross-tab prevention
window.addEventListener('focus', () => {
  // Window regained focus - ensure we have a working instance
  setTimeout(() => {
    if (!promptLibraryInstance || !promptLibraryInstance.isInitialized) {
      initializePromptLibrary();
    } else {
      // Re-detect in case DOM changed while we were away
      promptLibraryInstance.detectAndInjectIcon();
    }
  }, 200);
});

window.addEventListener('blur', () => {
  // Window lost focus - cleanup UI elements to prevent interference
  if (promptLibraryInstance && promptLibraryInstance.promptSelector) {
    try {
      promptLibraryInstance.promptSelector.remove();
      promptLibraryInstance.promptSelector = null;
    } catch {
      // Silent cleanup
    }
  }
});