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
    
    console.error('[PromptLibrary]', message, logData);
    
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
    
    console.warn('[PromptLibrary]', message, logData);
    
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
      
      console.info('[PromptLibrary]', message, logData);
    }
  }
  
  static debug(message, context = {}) {
    if (this.isDebugMode()) {
      const logData = {
        timestamp: new Date().toISOString(),
        level: 'DEBUG',
        message,
        context,
        url: window.location.href
      };
      
      console.debug('[PromptLibrary]', message, logData);
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
    this.hostname = String(window.location.hostname || '');
    
    // Add unique identifier to prevent cross-tab interference
    this.instanceId = `prompt-lib-${this.hostname}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize specialized components
    this.eventManager = new EventManager();
    this.uiFactory = new UIElementFactory(this.instanceId);
    this.keyboardNav = null;
    
    // Enhanced retry system for custom selectors
    this.customSelectorRetry = {
      attempts: 0,
      maxAttempts: 30, // Increased for SPAs
      baseDelay: 250,  // Start with shorter delay
      maxDelay: 2000,  // Cap at 2 seconds
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
    
    // Clear custom selector retry timeout
    if (this.customSelectorRetry.timeoutId) {
      clearTimeout(this.customSelectorRetry.timeoutId);
      this.customSelectorRetry.timeoutId = null;
    }
    
    // Clear SPA route change timeout
    if (this.spaState.routeChangeTimeout) {
      clearTimeout(this.spaState.routeChangeTimeout);
      this.spaState.routeChangeTimeout = null;
    }
    
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
      Logger.info('Final mutation observer stats', {
        totalMutations: this.mutationStats.totalMutations,
        relevantMutations: this.mutationStats.relevantMutations,
        throttledCalls: this.mutationStats.throttledCalls,
        lastResetTime: this.mutationStats.lastResetTime
      });
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

  async init() {
    if (this.isInitialized) return;
    
    Logger.info('Initializing prompt library for site', { hostname: this.hostname });
    
    this.isInitialized = true;
    
    // Inject CSS styles
    injectCSS();
    
    // Setup SPA monitoring for dynamic navigation detection
    this.setupSPAMonitoring();
    
    // Wait for page to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.startDetection());
    } else {
      this.startDetection();
    }
  }
  

  startDetection() {
    // Initial detection
    void this.detectAndInjectIcon();
    
    // For dynamic content loading, retry detection periodically
    let retryCount = 0;
    const maxRetries = 20;
    const retryInterval = setInterval(() => {
      if (retryCount >= maxRetries || this.currentTextarea) {
        clearInterval(retryInterval);
        return;
      }
      void this.detectAndInjectIcon();
      retryCount++;
    }, 500);
    
    // Create optimized mutation observer with advanced throttling
    this.mutationObserver = this.createOptimizedMutationObserver();
    
    // Set up optimized observation with multiple targeted scopes
    this.setupOptimizedObservation();
    
    // Also detect on focus events for Sanofi Concierge input elements
    const focusHandler = (e) => {
      if (e.target.matches('textarea, div[contenteditable="true"]')) {
        setTimeout(() => void this.detectAndInjectIcon(), 100);
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

  isValidTextarea(element) {
    // Basic element validation
    if (!element) {
      return false;
    }

    // Check if element is visible and interactive
    if (!this.isElementVisible(element)) {
      return false;
    }

    // Check for common textarea types
    const tagName = element.tagName.toLowerCase();
    
    // Accept actual textareas
    if (tagName === 'textarea') {
      return true;
    }

    // Accept contenteditable divs
    if (tagName === 'div' && element.contentEditable === 'true') {
      return true;
    }

    // Accept text inputs
    if (tagName === 'input' && element.type === 'text') {
      return true;
    }

    // Accept elements with textbox role
    if (element.getAttribute('role') === 'textbox') {
      return true;
    }

    // Additional checks for custom implementations
    const placeholder = element.getAttribute('placeholder');
    
    // Check for common input-related classes or attributes
    if (placeholder && (
      placeholder.toLowerCase().includes('type') ||
      placeholder.toLowerCase().includes('ask') ||
      placeholder.toLowerCase().includes('message') ||
      placeholder.toLowerCase().includes('chat') ||
      placeholder.toLowerCase().includes('search')
    )) {
      return true;
    }

    // Check for data attributes that suggest it's an input
    const dataTestId = element.getAttribute('data-testid');
    if (dataTestId && (
      dataTestId.includes('input') ||
      dataTestId.includes('textbox') ||
      dataTestId.includes('chat') ||
      dataTestId.includes('search')
    )) {
      return true;
    }

    return false;
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
      // Reset custom selector retry if mutation triggered new detection
      // This allows custom selectors to retry if DOM changes
      if (this.customSelectorRetry.selector && !this.icon) {
        Logger.debug('Mutation detected, resetting custom selector retry for DOM changes');
        this.customSelectorRetry.attempts = Math.max(0, this.customSelectorRetry.attempts - 2); // Reduce attempts slightly
      }
      void this.detectAndInjectIcon();
    }, throttleDelay);
  }
  
  // Set up optimized observation with site-specific targeting
  setupOptimizedObservation() {
    const hostname = String(window.location.hostname || '');
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

  // Get custom site positioning configuration from settings
  async getCustomSiteConfig(hostname) {
    try {
      const result = await chrome.storage.local.get(['promptLibrarySettings']);
      const settings = result.promptLibrarySettings || {};
      const customSites = settings.customSites || [];
      
      const customSite = customSites.find(site => site.hostname === hostname);
      if (customSite && customSite.enabled && customSite.positioning) {
        Logger.info('Found custom site positioning config', {
          hostname,
          mode: customSite.positioning.mode,
          selector: customSite.positioning.selector,
          placement: customSite.positioning.placement
        });
        return customSite.positioning;
      }
    } catch (error) {
      Logger.error('Failed to get custom site config', error);
    }
    return null;
  }

  // Create icon with custom positioning
  async createCustomPositionedIcon(positioning) {
    if (!positioning || positioning.mode !== 'custom' || !positioning.selector) {
      return false;
    }

    try {
      // Find target elements using the custom selector
      const targetElements = document.querySelectorAll(positioning.selector);
      
      if (targetElements.length === 0) {
        Logger.warn('Custom selector found no elements', { 
          context: { selector: positioning.selector }
        });
        return false;
      }

      // Use the first matching element
      const targetElement = targetElements[0];
      
      // Enhanced validation for target element
      if (!document.body.contains(targetElement)) {
        Logger.warn('Target element is not in DOM', { 
          context: { selector: positioning.selector }
        });
        return false;
      }

      // Use enhanced visibility checking
      if (!this.isElementTrulyVisible(targetElement)) {
        Logger.warn('Target element is not truly visible', { 
          context: { 
            selector: positioning.selector,
            rect: targetElement.getBoundingClientRect(),
            style: {
              display: getComputedStyle(targetElement).display,
              visibility: getComputedStyle(targetElement).visibility,
              opacity: getComputedStyle(targetElement).opacity
            }
          }
        });
        return false;
      }

      // Remove any existing icon
      if (this.icon) {
        this.icon.remove();
        this.icon = null;
      }

      // Create the icon
      this.icon = this.uiFactory.createFloatingIcon();
      
      // Apply custom styling
      if (positioning.zIndex) {
        this.icon.style.zIndex = positioning.zIndex.toString();
      }

      // Add click handler
      this.icon.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // For custom positioned icons, we still need to find the closest textarea for the prompt selector
        const textarea = this.findClosestTextarea(targetElement) || targetElement;
        this.showPromptSelector(textarea);
      });

      // Position the icon based on placement mode
      this.positionCustomIcon(targetElement, positioning);
      
      // Add to DOM
      document.body.appendChild(this.icon);
      
      Logger.info('Custom positioned icon created successfully', {
        selector: positioning.selector,
        placement: positioning.placement,
        targetElement: targetElement.tagName
      });
      
      return true;
    } catch (error) {
      Logger.error('Failed to create custom positioned icon', error, {
        selector: positioning.selector,
        error: error.message
      });
      return false;
    }
  }

  // Find the closest textarea to a target element for prompt insertion
  findClosestTextarea(targetElement) {
    // First, check if the target element itself is a textarea
    if (targetElement.matches('textarea, div[contenteditable="true"], [role="textbox"]')) {
      return targetElement;
    }

    // Look for textarea in the same container
    const commonSelectors = [
      'textarea',
      'div[contenteditable="true"]',
      '[role="textbox"]',
      'input[type="text"]'
    ];

    // Search within the parent containers
    let currentElement = targetElement;
    for (let i = 0; i < 5; i++) { // Limit traversal depth
      if (!currentElement || !currentElement.parentElement) break;
      
      const parent = currentElement.parentElement;
      for (const selector of commonSelectors) {
        const textarea = parent.querySelector(selector);
        if (textarea && this.isValidTextarea(textarea)) {
          return textarea;
        }
      }
      currentElement = parent;
    }

    // Fallback: search the entire document
    for (const selector of commonSelectors) {
      const textareas = document.querySelectorAll(selector);
      for (const textarea of textareas) {
        if (this.isValidTextarea(textarea)) {
          return textarea;
        }
      }
    }

    return null;
  }

  // Position icon based on custom positioning configuration
  positionCustomIcon(targetElement, positioning) {
    try {
      // Validate inputs
      if (!targetElement || !positioning) {
        Logger.error('Invalid parameters for positionCustomIcon', {
          hasTargetElement: !!targetElement,
          hasPositioning: !!positioning
        });
        return;
      }

      const rect = targetElement.getBoundingClientRect();
      
      // Check if element has valid dimensions
      if (rect.width === 0 && rect.height === 0) {
        Logger.warn('Target element has zero dimensions', {
          selector: positioning.selector,
          rect: rect
        });
      }

      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      let top, left;
      
      const offsetX = positioning.offset?.x || 0;
      const offsetY = positioning.offset?.y || 0;

      // Validate offsets
      if (Math.abs(offsetX) > 1000 || Math.abs(offsetY) > 1000) {
        Logger.warn('Large offset values detected, may cause positioning issues', {
          offsetX,
          offsetY
        });
      }

    switch (positioning.placement) {
      case 'before':
        top = rect.top + scrollTop + offsetY;
        left = rect.left + scrollLeft - 40 + offsetX; // Icon width + margin
        break;
      case 'after':
        top = rect.top + scrollTop + offsetY;
        left = rect.right + scrollLeft + 8 + offsetX;
        break;
      case 'inside-start':
        top = rect.top + scrollTop + 8 + offsetY;
        left = rect.left + scrollLeft + 8 + offsetX;
        break;
      case 'inside-end':
        top = rect.top + scrollTop + 8 + offsetY;
        left = rect.right + scrollLeft - 40 + offsetX; // Icon width + margin
        break;
      default:
        // Default to 'after'
        top = rect.top + scrollTop + offsetY;
        left = rect.right + scrollLeft + 8 + offsetX;
    }

      // Validate calculated positions
      if (isNaN(top) || isNaN(left)) {
        Logger.error('Invalid position calculated', {
          top,
          left,
          placement: positioning.placement,
          rect: rect
        });
        return;
      }

      // Check if position is within reasonable viewport bounds
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      
      if (left < -100 || left > viewportWidth + 100 || top < -100 || top > viewportHeight + scrollTop + 100) {
        Logger.warn('Icon positioned outside reasonable viewport bounds', {
          position: { top, left },
          viewport: { width: viewportWidth, height: viewportHeight },
          placement: positioning.placement
        });
      }

      // Apply position with error handling
      if (this.icon) {
        this.icon.style.position = 'absolute';
        this.icon.style.top = Math.round(top) + 'px';
        this.icon.style.left = Math.round(left) + 'px';
        
        Logger.debug('Custom icon positioned', {
          position: { top: Math.round(top), left: Math.round(left) },
          placement: positioning.placement,
          selector: positioning.selector
        });
      } else {
        Logger.error('Icon element is null during positioning');
        return;
      }
      
      // Store current textarea reference for the icon
      this.currentTextarea = this.findClosestTextarea(targetElement);
      
      // Set up position tracking for responsive updates
      this.setupCustomIconPositionTracking(targetElement, positioning);
      
    } catch (error) {
      Logger.error('Error in positionCustomIcon', error, {
        selector: positioning.selector,
        placement: positioning.placement,
        hasIcon: !!this.icon,
        error: error.message
      });
    }
  }

  // Set up position tracking for custom positioned icons
  setupCustomIconPositionTracking(targetElement, positioning) {
    // Create throttled update function that doesn't re-setup event listeners
    const throttledUpdate = () => {
      if (this.iconPositionCache.updatePending) return;
      
      this.iconPositionCache.updatePending = true;
      
      requestAnimationFrame(() => {
        if (this.icon && targetElement) {
          this.updateCustomIconPosition(targetElement, positioning);
        }
        this.iconPositionCache.updatePending = false;
      });
    };

    // Add optimized event listeners
    this.eventManager.addTrackedEventListener(window, 'scroll', throttledUpdate, { passive: true });
    this.eventManager.addTrackedEventListener(window, 'resize', throttledUpdate, { passive: true });
  }

  // Update icon position without setting up new event listeners
  updateCustomIconPosition(targetElement, positioning) {
    try {
      // Validate inputs
      if (!targetElement || !positioning) {
        return;
      }
      
      const rect = targetElement.getBoundingClientRect();
      
      // Check if element has valid dimensions
      if (rect.width === 0 && rect.height === 0) {
        return;
      }
      
      // Calculate position based on placement mode
      let top, left;
      const iconWidth = 30;
      const iconHeight = 30;
      const offset = positioning.offset || { x: 0, y: 0 };
      
      switch (positioning.placement) {
        case 'before':
          top = rect.top + window.scrollY + (rect.height - iconHeight) / 2;
          left = rect.left + window.scrollX - iconWidth - 8;
          break;
        case 'after':
          top = rect.top + window.scrollY + (rect.height - iconHeight) / 2;
          left = rect.right + window.scrollX + 8;
          break;
        case 'inside-start':
          top = rect.top + window.scrollY + 8;
          left = rect.left + window.scrollX + 8;
          break;
        case 'inside-end':
          top = rect.top + window.scrollY + 8;
          left = rect.right + window.scrollX - iconWidth - 8;
          break;
        default:
          // Default to 'after' placement
          top = rect.top + window.scrollY + (rect.height - iconHeight) / 2;
          left = rect.right + window.scrollX + 8;
      }
      
      // Apply user offsets
      top += offset.y;
      left += offset.x;
      
      // Ensure icon stays within viewport bounds
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const scrollTop = window.scrollY;
      const scrollLeft = window.scrollX;
      
      // Constrain to viewport
      left = Math.max(scrollLeft + 10, Math.min(left, scrollLeft + viewportWidth - iconWidth - 10));
      top = Math.max(scrollTop + 10, Math.min(top, scrollTop + viewportHeight - iconHeight - 10));
      
      // Apply positioning to icon
      if (this.icon) {
        this.icon.style.position = 'absolute';
        this.icon.style.zIndex = positioning.zIndex || '10000000';
        this.icon.style.top = Math.round(top) + 'px';
        this.icon.style.left = Math.round(left) + 'px';
        
        Logger.debug('Custom icon position updated', {
          position: { top: Math.round(top), left: Math.round(left) },
          placement: positioning.placement,
          selector: positioning.selector
        });
      }
    } catch (error) {
      Logger.error('Error updating custom icon position', error, {
        selector: positioning.selector,
        placement: positioning.placement
      });
    }
  }

  // Enhanced custom selector retry with SPA awareness
  async retryCustomSelector(positioning) {
    // Reset retry state if this is a new selector
    if (this.customSelectorRetry.selector !== positioning.selector) {
      this.customSelectorRetry.attempts = 0;
      this.customSelectorRetry.currentDelay = this.customSelectorRetry.baseDelay;
      this.customSelectorRetry.selector = positioning.selector;
      this.customSelectorRetry.positioning = positioning;
    }
    
    // Clear any existing timeout
    if (this.customSelectorRetry.timeoutId) {
      clearTimeout(this.customSelectorRetry.timeoutId);
      this.customSelectorRetry.timeoutId = null;
    }
    
    // Check if we've exceeded max attempts
    if (this.customSelectorRetry.attempts >= this.customSelectorRetry.maxAttempts) {
      Logger.warn('Custom selector retry exhausted', {
        selector: positioning.selector,
        attempts: this.customSelectorRetry.attempts,
        totalTime: (this.customSelectorRetry.attempts * this.customSelectorRetry.baseDelay) / 1000 + 's'
      });
      return false;
    }
    
    this.customSelectorRetry.attempts++;
    
    // Exponential backoff with jitter
    const backoffMultiplier = Math.min(2, 1 + (this.customSelectorRetry.attempts * 0.1));
    const jitter = Math.random() * 0.3 + 0.85; // 0.85 to 1.15
    this.customSelectorRetry.currentDelay = Math.min(
      this.customSelectorRetry.maxDelay,
      this.customSelectorRetry.baseDelay * backoffMultiplier * jitter
    );
    
    Logger.debug('Retrying custom selector', {
      selector: positioning.selector,
      attempt: this.customSelectorRetry.attempts,
      delay: Math.round(this.customSelectorRetry.currentDelay),
      nextBackoff: Math.round(this.customSelectorRetry.currentDelay * backoffMultiplier)
    });
    
    return new Promise((resolve) => {
      this.customSelectorRetry.timeoutId = setTimeout(async () => {
        const success = await this.createCustomPositionedIcon(positioning);
        if (success) {
          Logger.info('Custom selector retry succeeded', {
            selector: positioning.selector,
            attempt: this.customSelectorRetry.attempts,
            totalTime: (this.customSelectorRetry.attempts * this.customSelectorRetry.baseDelay) / 1000 + 's'
          });
          resolve(true);
        } else {
          // Continue retrying
          const nextAttempt = await this.retryCustomSelector(positioning);
          resolve(nextAttempt);
        }
      }, this.customSelectorRetry.currentDelay);
    });
  }

  // Enhanced visibility check for elements
  isElementTrulyVisible(element) {
    if (!element || !document.body.contains(element)) {
      return false;
    }
    
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    
    // Check basic visibility conditions
    if (rect.width === 0 || rect.height === 0 ||
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0') {
      return false;
    }
    
    // Check if element is in viewport (at least partially visible)
    const isInViewport = rect.top < window.innerHeight && 
                        rect.bottom > 0 && 
                        rect.left < window.innerWidth && 
                        rect.right > 0;
    
    if (!isInViewport) {
      return false;
    }
    
    // Check if element is not covered by other elements (sample center point)
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const elementAtPoint = document.elementFromPoint(centerX, centerY);
    
    // Element is visible if it's the element at the point or contains it
    return elementAtPoint === element || element.contains(elementAtPoint);
  }

  // SPA navigation detection and handling
  detectSPANavigation() {
    const currentUrl = window.location.href;
    if (this.spaState.lastUrl !== currentUrl) {
      Logger.info('SPA navigation detected', {
        from: this.spaState.lastUrl,
        to: currentUrl
      });
      
      this.spaState.lastUrl = currentUrl;
      this.spaState.navigationDetected = true;
      
      // Reset retry state on navigation
      this.customSelectorRetry.attempts = 0;
      this.customSelectorRetry.currentDelay = this.customSelectorRetry.baseDelay;
      
      // Debounce re-injection after route change
      if (this.spaState.routeChangeTimeout) {
        clearTimeout(this.spaState.routeChangeTimeout);
      }
      
      this.spaState.routeChangeTimeout = setTimeout(() => {
        Logger.info('Re-detecting after SPA navigation');
        void this.detectAndInjectIcon();
        this.spaState.navigationDetected = false;
      }, 300); // Give the SPA time to render new content
      
      return true;
    }
    return false;
  }

  // Setup SPA monitoring
  setupSPAMonitoring() {
    let originalPushState = null;
    let originalReplaceState = null;
    
    // Monitor for pushState/replaceState changes
    if (typeof window !== 'undefined' && window.history) {
      originalPushState = window.history.pushState;
      originalReplaceState = window.history.replaceState;
      
      window.history.pushState = (...args) => {
        originalPushState.apply(window.history, args);
        this.detectSPANavigation();
      };
      
      window.history.replaceState = (...args) => {
        originalReplaceState.apply(window.history, args);
        this.detectSPANavigation();
      };
    }
    
    // Monitor for popstate events (back/forward navigation)
    this.eventManager.addTrackedEventListener(window, 'popstate', () => {
      setTimeout(() => this.detectSPANavigation(), 50);
    });
    
    // Periodically check for URL changes (fallback for some SPAs)
    const urlCheckInterval = setInterval(() => {
      this.detectSPANavigation();
    }, 1000);
    
    // Clean up interval on cleanup
    const originalCleanup = this.cleanup.bind(this);
    this.cleanup = () => {
      clearInterval(urlCheckInterval);
      // Restore original history methods
      if (typeof window !== 'undefined' && window.history) {
        if (originalPushState) window.history.pushState = originalPushState;
        if (originalReplaceState) window.history.replaceState = originalReplaceState;
      }
      originalCleanup();
    };
    
    Logger.info('SPA monitoring enabled');
  }

  async detectAndInjectIcon() {
    const hostname = String(window.location.hostname || '');
    const config = this.siteConfigs[hostname];
    
    // First, check for custom site positioning configuration
    const customPositioning = await this.getCustomSiteConfig(hostname);
    if (customPositioning && customPositioning.mode === 'custom') {
      Logger.info('Attempting custom positioning for site', { hostname });
      const success = await this.createCustomPositionedIcon(customPositioning);
      if (success) {
        Logger.info('Custom positioning successful, skipping default injection');
        return;
      } else {
        // Use enhanced retry system for custom selectors
        Logger.info('Custom positioning failed, starting enhanced retry', {
          selector: customPositioning.selector,
          attempts: this.customSelectorRetry.attempts
        });
        
        const retrySuccess = await this.retryCustomSelector(customPositioning);
        if (retrySuccess) {
          Logger.info('Custom positioning retry successful, skipping default injection');
          return;
        } else {
          Logger.warn('Custom positioning failed, falling back to default behavior', {
          context: { 
            selector: customPositioning.selector,
            totalAttempts: this.customSelectorRetry.attempts,
            hostname: hostname
          }
        });
        }
      }
    }
    
    // Define fallback selectors for custom sites
    const fallbackSelectors = [
      'textarea',
      'div[contenteditable="true"]',
      'input[type="text"]',
      '[role="textbox"]',
      '[data-testid*="input"]',
      '[class*="input"]',
      '[placeholder*="message"]',
      '[placeholder*="chat"]',
      '[placeholder*="ask"]',
      '[placeholder*="type"]',
      '[placeholder*="enter"]'
    ];
    
    if (!config) {
      
      Logger.info('No predefined config, using fallback selectors for custom site', { 
        hostname,
        fallbackSelectorCount: fallbackSelectors.length 
      });
      
      // For custom sites, use fallback selectors without caching
      let textarea = null;
      const foundElements = [];
      
      for (const selector of fallbackSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          foundElements.push({ selector, count: elements.length });
          
          if (elements.length > 0) {
            for (const element of elements) {
              if (this.isValidTextarea(element)) {
                textarea = element;
                break;
              }
            }
            if (textarea) break;
          }
        } catch (error) {
          console.error('[PromptLibrary] Error with selector:', selector, error);
        }
      }
      
      
      if (textarea) {
        // Check if we already have an icon for this textarea to prevent duplicates
        if (textarea === this.currentTextarea && this.icon) {
          return;
        }
        
        this.currentTextarea = textarea;
        this.createFloatingIcon(textarea);
      } else {
        Logger.info('No valid textarea found with fallback selectors', { hostname });
      }
      return;
    }
    
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
      // Ensure hostname is always a string
      const hostnameStr = String(this.hostname || '');
      
      Logger.info('Starting icon injection', { 
        hostname: hostnameStr,
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
      
      const hostname = String(window.location.hostname || '');
      const config = this.siteConfigs[hostname];
      
      if (!config) {
        Logger.warn('No site configuration found for hostname', { hostname: hostnameStr });
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
    // Remove any existing icon first to prevent duplicates
    if (this.icon) {
      try {
        this.icon.remove();
        Logger.info('Removed existing floating icon before creating new one');
      } catch (error) {
        Logger.warn('Failed to remove existing floating icon', { error: error.message });
      }
    }
    
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
    const hostname = String(window.location.hostname || '');
    
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

// Expose to global scope for dynamic injection
window.promptLibraryInstance = promptLibraryInstance;

// Initialize with proper cleanup and cross-tab prevention
async function initializePromptLibrary() {
  // Cleanup any existing instance first
  if (promptLibraryInstance) {
    promptLibraryInstance.cleanup();
    promptLibraryInstance = null;
  }
  
  // Check if this site should be activated
  const shouldActivate = await checkIfSiteIsEnabled();
  
  if (!shouldActivate) {
    Logger.info('Site not enabled, skipping initialization', { 
      hostname: String(window.location.hostname || '') 
    });
    return;
  }
  
  
  // Create new instance
  promptLibraryInstance = new PromptLibraryInjector();
  
  // Update global reference
  window.promptLibraryInstance = promptLibraryInstance;
  
}

// Universal site activation check
async function checkIfSiteIsEnabled() {
  const hostname = String(window.location.hostname || '');
  
  return new Promise((resolve) => {
    try {
      // Skip for local/internal pages
      if (!hostname || hostname === 'localhost' || hostname.startsWith('127.0.0.1') || 
          hostname === 'chrome-extension' || hostname === 'moz-extension') {
        resolve(false);
        return;
      }
      
      // Check Chrome APIs availability
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.runtime) {
        Logger.info('Chrome extension APIs not available, skipping', { 
          hostname,
          hasChrome: typeof chrome !== 'undefined',
          hasStorage: !!(chrome && chrome.storage),
          hasRuntime: !!(chrome && chrome.runtime)
        });
        resolve(false);
        return;
      }
      
      // Additional check for extension context
      try {
        chrome.runtime.id; // This will throw if not in proper extension context
      } catch {
        Logger.info('Not in extension context, skipping', { hostname });
        resolve(false);
        return;
      }

      try {
        chrome.storage.local.get(['promptLibrarySettings'], (result) => {
          if (chrome.runtime.lastError) {
            Logger.warn('Failed to retrieve settings for activation check', {
              error: chrome.runtime.lastError.message,
              hostname
            });
            resolve(false);
            return;
          }
        
        const settings = result.promptLibrarySettings || {};
        const enabledSites = settings.enabledSites || [];
        const customSites = settings.customSites || [];
        
        // Check if enabled in built-in sites
        const isBuiltInEnabled = enabledSites.includes(hostname);
        
        // Check if enabled in custom sites
        const customSite = customSites.find(site => site.hostname === hostname);
        const isCustomEnabled = customSite ? customSite.enabled : false;
        
        const shouldActivate = isBuiltInEnabled || isCustomEnabled;
        
        
        Logger.info('Site activation check completed', {
          hostname,
          isBuiltInEnabled,
          isCustomEnabled,
          shouldActivate
        });
        
        resolve(shouldActivate);
        });
      } catch (storageError) {
        Logger.error('Unexpected error accessing chrome storage', storageError, {
          hostname,
          errorMessage: storageError.message,
          errorName: storageError.name
        });
        resolve(false);
      }
    } catch (error) {
      Logger.error('Error in site activation check', error, {
        hostname,
        errorMessage: error.message
      });
      resolve(false);
    }
  });
}

// Expose function to global scope
window.initializePromptLibrary = initializePromptLibrary;

// Initialize on load
void initializePromptLibrary();

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
        void promptLibraryInstance.detectAndInjectIcon();
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
      void promptLibraryInstance.detectAndInjectIcon();
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

// Listen for settings updates from the settings page
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'cleanup') {
    // Handle cleanup request from settings when custom site is disabled
    if (promptLibraryInstance) {
      promptLibraryInstance.cleanup();
      promptLibraryInstance = null;
    }
    sendResponse({ success: true });
    return;
  }
  
  if (message.action === 'reinitialize') {
    // Handle reinitialize request (e.g., when custom site is added/toggled)
    Logger.info('Received reinitialize request', { 
      reason: message.reason,
      hostname: String(window.location.hostname || '') 
    });
    void initializePromptLibrary();
    sendResponse({ success: true });
    return;
  }
  
  if (message.action === 'settingsUpdated') {
    Logger.info('Settings updated, reinitializing', {
      hostname: String(window.location.hostname || '')
    });
    
    // Simply reinitialize - the activation check will handle enabling/disabling
    void initializePromptLibrary();
    
    // Update debug mode in localStorage if changed
    if (message.settings.debugMode !== undefined) {
      if (message.settings.debugMode) {
        localStorage.setItem('prompt-library-debug', 'true');
      } else {
        localStorage.removeItem('prompt-library-debug');
      }
    }
    
    sendResponse({ success: true });
  }
  
  if (message.action === 'testSelector') {
    // Handle selector testing for position preview
    Logger.info('Testing selector for position preview', { 
      selector: message.selector,
      placement: message.placement
    });
    
    try {
      // Remove any existing test icon
      const existingTestIcon = document.querySelector('.prompt-library-test-icon');
      if (existingTestIcon) {
        existingTestIcon.remove();
      }
      
      // Find elements using the test selector
      const targetElements = document.querySelectorAll(message.selector);
      
      if (targetElements.length === 0) {
        sendResponse({ 
          success: false, 
          error: `No elements found for selector: ${message.selector}` 
        });
        return;
      }
      
      // Use the first matching element
      const targetElement = targetElements[0];
      
      // Create a test icon
      const testIcon = document.createElement('div');
      testIcon.className = 'prompt-library-test-icon';
      testIcon.style.cssText = `
        position: absolute;
        width: 32px;
        height: 32px;
        background: #ff6b35;
        border: 3px solid #fff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: ${message.zIndex || 999999};
        box-shadow: 0 4px 12px rgba(255, 107, 53, 0.4);
        animation: testIconPulse 1s ease-in-out infinite alternate;
        color: white;
        font-weight: bold;
        font-size: 14px;
      `;
      testIcon.innerHTML = '?';
      
      // Add pulse animation
      if (!document.querySelector('#test-icon-animation')) {
        const style = document.createElement('style');
        style.id = 'test-icon-animation';
        style.textContent = `
          @keyframes testIconPulse {
            from { transform: scale(1); opacity: 0.8; }
            to { transform: scale(1.1); opacity: 1; }
          }
        `;
        document.head.appendChild(style);
      }
      
      // Position the test icon
      const rect = targetElement.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      
      const offsetX = message.offset?.x || 0;
      const offsetY = message.offset?.y || 0;
      
      let top, left;
      
      switch (message.placement) {
        case 'before':
          top = rect.top + scrollTop + offsetY;
          left = rect.left + scrollLeft - 40 + offsetX;
          break;
        case 'after':
          top = rect.top + scrollTop + offsetY;
          left = rect.right + scrollLeft + 8 + offsetX;
          break;
        case 'inside-start':
          top = rect.top + scrollTop + 8 + offsetY;
          left = rect.left + scrollLeft + 8 + offsetX;
          break;
        case 'inside-end':
          top = rect.top + scrollTop + 8 + offsetY;
          left = rect.right + scrollLeft - 40 + offsetX;
          break;
        default:
          top = rect.top + scrollTop + offsetY;
          left = rect.right + scrollLeft + 8 + offsetX;
      }
      
      testIcon.style.top = top + 'px';
      testIcon.style.left = left + 'px';
      
      // Add to DOM
      document.body.appendChild(testIcon);
      
      // Highlight the target element temporarily
      const originalStyle = targetElement.style.cssText;
      targetElement.style.cssText += `
        outline: 2px dashed #ff6b35 !important;
        outline-offset: 2px !important;
      `;
      
      // Remove test icon and highlight after 3 seconds
      setTimeout(() => {
        if (testIcon) {
          testIcon.remove();
        }
        targetElement.style.cssText = originalStyle;
      }, 3000);
      
      sendResponse({ 
        success: true, 
        elementsFound: targetElements.length,
        targetElement: targetElement.tagName,
        message: `Found ${targetElements.length} element(s). Test icon will disappear in 3 seconds.`
      });
      
    } catch (error) {
      sendResponse({ 
        success: false, 
        error: `Selector test failed: ${error.message}` 
      });
    }
    return;
  }
});