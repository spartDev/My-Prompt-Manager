/* eslint-env browser, webextensions */
/* global localStorage, navigator, Node, requestAnimationFrame, cancelAnimationFrame, IntersectionObserver */

// Platform insertion manager - implemented inline due to content script limitations
// Note: ES6 imports don't work in content scripts, so we implement the strategy pattern directly here

/**
 * Content Script for My Prompt Manager Chrome Extension
 * 
 * This script enables seamless integration of the prompt library with AI chat platforms
 * by injecting an accessible icon that allows users to insert saved prompts directly
 * into chat interfaces.
 * 
 * Key Features:
 * - Dynamic icon injection into supported AI platforms
 * - Secure prompt content handling and insertion
 * - Keyboard navigation support for accessibility
 * - Performance optimizations for smooth user experience
 * - Cross-platform compatibility (Claude, ChatGPT, Perplexity)
 * - Custom site support with flexible positioning
 * 
 * For detailed documentation, see: ai/doc/content-script.md
 */

// Inject CSS styles
function injectCSS() {
  if (document.getElementById('prompt-library-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'prompt-library-styles';
  style.textContent = `
    /* Prompt Manager Icon */
    .prompt-library-icon {
      position: absolute;
      width: 50px;
      height: 50px;  
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 999999;
      border: 2px solid transparent;
    }

    .prompt-library-icon:hover {
      background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    }

    .prompt-library-icon:focus-visible {
      outline: none;
      border-color: #60a5fa;
      box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.4);
    }

    .prompt-library-icon svg {
      color: white;
      width: 24px;
      height: 24px;
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

    /* Insertion Feedback Styles */
    .insertion-feedback {
      position: absolute;
      top: -40px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      color: white;
      z-index: 1000001;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      backdrop-filter: blur(8px);
    }

    .insertion-feedback.success {
      background: linear-gradient(135deg, #10b981, #059669);
    }

    .insertion-feedback.error {
      background: linear-gradient(135deg, #ef4444, #dc2626);
    }

    .insertion-feedback.show {
      opacity: 1;
    }

    /* Platform-specific insertion debugging styles */
    .insertion-debug {
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 11px;
      z-index: 1000002;
      max-width: 300px;
      backdrop-filter: blur(8px);
    }

    .insertion-debug.success {
      border-left: 4px solid #10b981;
    }

    .insertion-debug.error {
      border-left: 4px solid #ef4444;
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
    icon.setAttribute('aria-label', 'Open my prompt manager - Access your saved prompts');
    icon.setAttribute('title', 'My Prompt Manager - Access your saved prompts');
    icon.setAttribute('data-instance-id', this.instanceId);
    icon.setAttribute('tabindex', '0');
    
    // Create icon content with SVG and text (like Research button)
    const iconContentDiv = StorageManager.createElement('div', { 
      class: 'flex items-center justify-center',
      style: 'width: 16px; height: 16px;'
    });
    const svg = StorageManager.createSVGElement('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '16',
      height: '16',
      fill: 'currentColor',
      viewBox: '0 0 256 256',
      'aria-hidden': 'true'
    });
    const path = StorageManager.createSVGElement('path', {
      d: 'M224,48H32A16,16,0,0,0,16,64V192a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM208,192H48a8,8,0,0,1-8-8V72H216V184A8,8,0,0,1,208,192ZM64,96a8,8,0,0,1,8-8H184a8,8,0,0,1,0,16H72A8,8,0,0,1,64,96Zm0,32a8,8,0,0,1,8-8H184a8,8,0,0,1,0,16H72A8,8,0,0,1,64,128Zm0,32a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H72A8,8,0,0,1,64,160Z'
    });
    svg.appendChild(path);
    iconContentDiv.appendChild(svg);
    
    // Add text container like Research button
    const textContainer = StorageManager.createElement('div', {
      class: 'min-w-0 flex items-center'
    });
    const textElement = StorageManager.createElement('p', {
      class: 'min-w-0 pl-1 text-xs tracking-tight text-ellipsis whitespace-nowrap break-words overflow-hidden shrink'
    });
    textElement.textContent = 'My Prompts';
    textContainer.appendChild(textElement);
    
    // Append both icon and text to button
    icon.appendChild(iconContentDiv);
    icon.appendChild(textContainer);
    
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
    icon.setAttribute('aria-label', 'Open my prompt manager - Access your saved prompts');
    icon.setAttribute('title', 'My Prompt Manager - Access your saved prompts');
    icon.setAttribute('data-state', 'closed');
    icon.setAttribute('data-instance-id', this.instanceId);
    icon.setAttribute('tabindex', '0');
    
    // Use secure DOM construction
    const outerDiv = StorageManager.createElement('div', { 
      class: 'flex items-center min-w-0 font-medium gap-1.5 justify-center' 
    });
    const innerDiv = StorageManager.createElement('div', { 
      class: 'flex shrink-0 items-center justify-center size-4' 
    });
    const svg = StorageManager.createSVGElement('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '16',
      height: '16',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.8',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true'
    });
    const path = StorageManager.createSVGElement('path', {
      d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'
    });
    const polyline1 = StorageManager.createSVGElement('polyline', {
      points: '14,2 14,8 20,8'
    });
    const line1 = StorageManager.createSVGElement('line', {
      x1: '16', y1: '13', x2: '8', y2: '13'
    });
    const line2 = StorageManager.createSVGElement('line', {
      x1: '16', y1: '17', x2: '8', y2: '17'
    });
    const polyline2 = StorageManager.createSVGElement('polyline', {
      points: '10,9 9,9 8,9'
    });
    
    svg.appendChild(path);
    svg.appendChild(polyline1);
    svg.appendChild(line1);
    svg.appendChild(line2);
    svg.appendChild(polyline2);
    innerDiv.appendChild(svg);
    outerDiv.appendChild(innerDiv);
    icon.appendChild(outerDiv);
    
    return icon;
  }
  
  createChatGPTIcon() {
    const icon = document.createElement('button');
    icon.className = `prompt-library-integrated-icon composer-btn`;
    icon.setAttribute('type', 'button');
    icon.setAttribute('aria-label', 'Open my prompt manager - Access your saved prompts');
    icon.setAttribute('title', 'My Prompt Manager - Access your saved prompts');
    icon.setAttribute('data-dashlane-label', 'true');
    icon.setAttribute('data-instance-id', this.instanceId);
    icon.setAttribute('tabindex', '0');
    
    // Use secure DOM construction
    const svg = StorageManager.createSVGElement('svg', {
      width: '20',
      height: '20',
      viewBox: '0 0 24 24',
      fill: 'currentColor',
      xmlns: 'http://www.w3.org/2000/svg',
      'aria-hidden': 'true',
      class: 'icon',
      'font-size': 'inherit'
    });
    const path = StorageManager.createSVGElement('path', {
      d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'
    });
    const polyline1 = StorageManager.createSVGElement('polyline', {
      points: '14,2 14,8 20,8'
    });
    const line1 = StorageManager.createSVGElement('line', {
      x1: '16', y1: '13', x2: '8', y2: '13'
    });
    const line2 = StorageManager.createSVGElement('line', {
      x1: '16', y1: '17', x2: '8', y2: '17'
    });
    const polyline2 = StorageManager.createSVGElement('polyline', {
      points: '10,9 9,9 8,9'
    });
    
    svg.appendChild(path);
    svg.appendChild(polyline1);
    svg.appendChild(line1);
    svg.appendChild(line2);
    svg.appendChild(polyline2);
    icon.appendChild(svg);
    
    return icon;
  }
  
  
  createFloatingIcon() {
    const icon = document.createElement('button');
    icon.className = `prompt-library-icon`;
    icon.setAttribute('data-instance-id', this.instanceId);
    icon.setAttribute('type', 'button');
    icon.setAttribute('aria-label', 'Open my prompt manager - Access your saved prompts');
    icon.setAttribute('title', 'My Prompt Manager - Access your saved prompts');
    icon.setAttribute('tabindex', '0');
    // Use secure DOM construction
    const svg = StorageManager.createSVGElement('svg', {
      width: '20',
      height: '20',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'aria-hidden': 'true'
    });
    const path = StorageManager.createSVGElement('path', {
      d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'
    });
    const polyline1 = StorageManager.createSVGElement('polyline', {
      points: '14,2 14,8 20,8'
    });
    const line1 = StorageManager.createSVGElement('line', {
      x1: '16', y1: '13', x2: '8', y2: '13'
    });
    const line2 = StorageManager.createSVGElement('line', {
      x1: '16', y1: '17', x2: '8', y2: '17'
    });
    const polyline2 = StorageManager.createSVGElement('polyline', {
      points: '10,9 9,9 8,9'
    });
    
    svg.appendChild(path);
    svg.appendChild(polyline1);
    svg.appendChild(line1);
    svg.appendChild(line2);
    svg.appendChild(polyline2);
    icon.appendChild(svg);
    
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
  // Get prompts with validation and sanitization
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
          
          const rawPrompts = result.prompts || [];
          
          // Validate and sanitize each prompt
          const validatedPrompts = rawPrompts
            .map(prompt => StorageManager.validatePromptData(prompt))
            .filter(prompt => prompt !== null); // Remove invalid prompts
          
          const invalidCount = rawPrompts.length - validatedPrompts.length;
          if (invalidCount > 0) {
            Logger.warn('Filtered out invalid prompts', { 
              originalCount: rawPrompts.length, 
              validCount: validatedPrompts.length,
              invalidCount 
            });
          }
          
          Logger.info('Retrieved and validated prompts from storage', { 
            count: validatedPrompts.length 
          });
          resolve(validatedPrompts);
        });
      } catch (error) {
        Logger.error('Unexpected error accessing chrome storage', error);
        resolve([]); // Graceful fallback
      }
    });
  }
  
  // Escape HTML to ensure user-generated content is displayed safely
  static escapeHtml(text) {
    try {
      if (typeof text !== 'string') {
        Logger.warn('escapeHtml received non-string input', { 
          type: typeof text, 
          value: text 
        });
        return String(text);
      }
      
      // Use explicit character replacement for safety
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    } catch (error) {
      Logger.error('Failed to escape HTML', error, { text });
      return ''; // Safe fallback
    }
  }

  // Helper function to safely create DOM elements with text content
  static createElement(tag, attributes = {}, textContent = '') {
    try {
      const element = document.createElement(tag);
      
      // Set attributes safely
      Object.entries(attributes).forEach(([key, value]) => {
        if (typeof value === 'string' || typeof value === 'number') {
          element.setAttribute(key, String(value));
        }
      });
      
      // Set text content safely (never innerHTML)
      if (textContent) {
        element.textContent = textContent;
      }
      
      return element;
    } catch (error) {
      Logger.error('Failed to create DOM element', error, { tag, attributes, textContent });
      return document.createElement('div'); // Safe fallback
    }
  }

  // Helper function to create SVG elements with proper namespace
  static createSVGElement(tag, attributes = {}) {
    try {
      const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
      
      // Set attributes safely for SVG
      Object.entries(attributes).forEach(([key, value]) => {
        if (typeof value === 'string' || typeof value === 'number') {
          element.setAttribute(key, String(value));
        }
      });
      
      return element;
    } catch (error) {
      Logger.error('Failed to create SVG element', error, { tag, attributes });
      return document.createElementNS('http://www.w3.org/2000/svg', 'g'); // Safe fallback
    }
  }

  // Comprehensive input sanitization for user-generated content
  static sanitizeUserInput(input) {
    try {
      if (typeof input !== 'string') {
        Logger.warn('sanitizeUserInput received non-string input', { 
          type: typeof input, 
          value: input 
        });
        return '';
      }
      
      // Remove null characters and control characters (except \n, \r, \t)
      let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      
      // Remove potentially dangerous Unicode characters
      sanitized = sanitized.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '');
      
      // Remove HTML/XML tags completely (more aggressive than escaping)
      sanitized = sanitized.replace(/<[^>]*>/g, '');
      
      // Remove javascript: and data: URLs
      sanitized = sanitized.replace(/javascript\s*:/gi, '');
      sanitized = sanitized.replace(/data\s*:/gi, '');
      
      // Remove vbscript: URLs
      sanitized = sanitized.replace(/vbscript\s*:/gi, '');
      
      // Remove on* event handlers
      sanitized = sanitized.replace(/\bon\w+\s*=/gi, '');
      
      // Limit length to prevent DoS attacks
      const MAX_INPUT_LENGTH = 50000; // 50KB limit
      if (sanitized.length > MAX_INPUT_LENGTH) {
        Logger.warn('Input truncated due to length limit', { 
          originalLength: sanitized.length, 
          maxLength: MAX_INPUT_LENGTH 
        });
        sanitized = sanitized.substring(0, MAX_INPUT_LENGTH) + '...';
      }
      
      return sanitized;
    } catch (error) {
      Logger.error('Failed to sanitize user input', error, { input });
      return ''; // Safe fallback
    }
  }

  // Validate prompt data structure to ensure expected properties
  static validatePromptData(prompt) {
    try {
      if (!prompt || typeof prompt !== 'object') {
        Logger.warn('Invalid prompt data structure', { prompt });
        return null;
      }
      
      const validatedPrompt = {
        id: StorageManager.sanitizeUserInput(String(prompt.id || '')),
        title: StorageManager.sanitizeUserInput(String(prompt.title || 'Untitled')),
        content: StorageManager.sanitizeUserInput(String(prompt.content || '')),
        category: StorageManager.sanitizeUserInput(String(prompt.category || 'General')),
        createdAt: prompt.createdAt || Date.now()
      };
      
      // Ensure required fields are not empty after sanitization
      if (!validatedPrompt.id || !validatedPrompt.title || !validatedPrompt.content) {
        Logger.warn('Prompt failed validation - empty required fields', { validatedPrompt });
        return null;
      }
      
      return validatedPrompt;
    } catch (error) {
      Logger.error('Failed to validate prompt data', error, { prompt });
      return null;
    }
  }

  // Helper function to safely create prompt list items
  static createPromptListItem(prompt, index, idPrefix = 'prompt-item') {
    try {
      const promptItem = StorageManager.createElement('div', {
        class: 'prompt-item',
        'data-prompt-id': StorageManager.escapeHtml(prompt.id),
        role: 'option',
        'aria-describedby': `${idPrefix}-${index}-desc`,
        tabindex: '-1'
      });
      
      const promptTitle = StorageManager.createElement('div', {
        class: 'prompt-title'
      }, StorageManager.escapeHtml(prompt.title));
      
      const promptCategory = StorageManager.createElement('div', {
        class: 'prompt-category'
      }, StorageManager.escapeHtml(prompt.category));
      
      const promptPreview = StorageManager.createElement('div', {
        class: 'prompt-preview',
        id: `${idPrefix}-${index}-desc`
      }, StorageManager.escapeHtml(prompt.content.substring(0, 100)) + 
         (prompt.content.length > 100 ? '...' : ''));
      
      promptItem.appendChild(promptTitle);
      promptItem.appendChild(promptCategory);
      promptItem.appendChild(promptPreview);
      
      return promptItem;
    } catch (error) {
      Logger.error('Failed to create prompt list item', error, { prompt, index });
      return StorageManager.createElement('div', { class: 'prompt-item-error' }, 'Error loading prompt');
    }
  }
}

// ================================================================================================
// INSERTION RESULT INTERFACE
// ================================================================================================

/**
 * @typedef {Object} InsertionResult
 * @property {boolean} success - Whether the insertion was successful
 * @property {string} [method] - The method used for insertion
 * @property {string} [error] - Error message if insertion failed
 */

// ================================================================================================
// ABSTRACT BASE STRATEGY CLASS
// ================================================================================================

/**
 * Abstract base class defining the contract for platform-specific insertion strategies
 * Each platform must implement all abstract methods to ensure consistent behavior
 */
class PlatformStrategy {
  /**
   * @param {string} name - Platform name (e.g., 'claude', 'chatgpt')
   * @param {number} priority - Priority for strategy selection (higher = preferred)
   * @param {Object} config - Platform-specific configuration
   */
  constructor(name, priority, config = {}) {
    if (this.constructor === PlatformStrategy) {
      throw new Error('PlatformStrategy is abstract and cannot be instantiated');
    }
    
    this.name = name;
    this.priority = priority;
    this.config = config;
    this.hostname = window.location.hostname;
    
    // Validate required methods are implemented
    this._validateImplementation();
  }
  
  /**
   * Validates that all abstract methods are implemented by concrete classes
   * @private
   */
  _validateImplementation() {
    const requiredMethods = ['canHandle', 'insert', 'getSelectors'];
    for (const method of requiredMethods) {
      if (typeof this[method] !== 'function') {
        throw new Error(`Strategy ${this.name} must implement ${method}() method`);
      }
    }
  }
  
  /**
   * Determines if this strategy can handle the given element
   * @param {HTMLElement} element - The target element
   * @returns {boolean} True if this strategy can handle the element
   * @abstract
   */
  canHandle(element) {
    throw new Error(`${this.name} strategy must implement canHandle() method`);
  }
  
  /**
   * Inserts content into the target element using platform-specific logic
   * @param {HTMLElement} element - The target element
   * @param {string} content - The content to insert
   * @returns {Promise<InsertionResult>} Result of the insertion attempt
   * @abstract
   */
  async insert(element, content) {
    throw new Error(`${this.name} strategy must implement insert() method`);
  }
  
  /**
   * Gets the CSS selectors used to find input elements for this platform
   * @returns {string[]} Array of CSS selectors
   * @abstract
   */
  getSelectors() {
    throw new Error(`${this.name} strategy must implement getSelectors() method`);
  }
  
  /**
   * Gets the button container selector for icon placement (optional)
   * @returns {string|null} CSS selector for button container
   */
  getButtonContainerSelector() {
    return this.config.buttonContainerSelector || null;
  }
  
  /**
   * Creates a platform-specific icon (optional override)
   * @param {UIElementFactory} uiFactory - Factory for creating UI elements
   * @returns {HTMLElement|null} Platform-specific icon or null to use default
   */
  createIcon(uiFactory) {
    return null; // Use default icon by default
  }
  
  /**
   * Cleans up any platform-specific resources (optional override)
   */
  cleanup() {
    // Default: no cleanup needed
  }
  
  /**
   * Logs debug information with platform prefix
   * @param {string} message - Debug message
   * @param {Object} context - Additional context
   * @protected
   */
  _debug(message, context = {}) {
    Logger.debug(`[${this.name}] ${message}`, context);
  }
  
  /**
   * Logs warning with platform prefix
   * @param {string} message - Warning message
   * @param {Error|Object} errorOrContext - Error object or context
   * @protected
   */
  _warn(message, errorOrContext = {}) {
    Logger.warn(`[${this.name}] ${message}`, errorOrContext);
  }
  
  /**
   * Logs error with platform prefix
   * @param {string} message - Error message
   * @param {Error} error - Error object
   * @param {Object} context - Additional context
   * @protected
   */
  _error(message, error, context = {}) {
    Logger.error(`[${this.name}] ${message}`, error, context);
  }
}

// ================================================================================================
// CLAUDE STRATEGY IMPLEMENTATION
// ================================================================================================

/**
 * Strategy for handling Claude.ai's ProseMirror editor
 * Supports multiple insertion methods with fallbacks
 */
class ClaudeStrategy extends PlatformStrategy {
  constructor() {
    super('claude', 100, {
      selectors: [
        'div[contenteditable="true"][role="textbox"].ProseMirror'
      ],
      buttonContainerSelector: '.relative.flex-1.flex.items-center.gap-2.shrink.min-w-0'
    });
  }
  
  /**
   * Determines if this strategy can handle the element
   * Always returns true for claude.ai to ensure Claude strategy is used
   */
  canHandle(element) {
    // Only handle elements on Claude
    if (this.hostname !== 'claude.ai') {
      return false;
    }
    
    // For Claude, we want to handle any element that is or is related to ProseMirror
    return true; // Always return true for claude.ai to ensure we use Claude strategy
  }
  
  /**
   * Inserts content using Claude-specific methods
   * Tries ProseMirror transaction API, then execCommand, then DOM manipulation
   */
  async insert(element, content) {
    // Try to find ProseMirror element
    const proseMirrorElement = this._findProseMirrorElement(element);
    
    // Method 1: Try ProseMirror transaction API
    const transactionResult = await this._tryProseMirrorTransaction(proseMirrorElement, content);
    if (transactionResult.success) return transactionResult;
    
    // Method 2: Try execCommand for contentEditable
    const execCommandResult = await this._tryExecCommand(proseMirrorElement, element, content);
    if (execCommandResult.success) return execCommandResult;
    
    // Method 3: Direct DOM manipulation
    return this._tryDOMManipulation(element, content);
  }
  
  /**
   * Gets selectors for finding Claude input elements
   */
  getSelectors() {
    return this.config.selectors;
  }
  
  /**
   * Creates Claude-specific icon using the UI factory
   */
  createIcon(uiFactory) {
    const result = uiFactory.createClaudeIcon();
    // createClaudeIcon returns { container, icon }, we want the container for Claude
    return result.container;
  }
  
  /**
   * Finds the ProseMirror element from the given element
   * @param {HTMLElement} element - Starting element
   * @returns {HTMLElement} ProseMirror element or original element
   * @private
   */
  _findProseMirrorElement(element) {
    // If element is already ProseMirror, use it
    if (element.classList.contains('ProseMirror')) {
      return element;
    }
    
    // First check if ProseMirror is a parent
    const parentProseMirror = element.closest('.ProseMirror');
    if (parentProseMirror) {
      return parentProseMirror;
    }
    
    // Then check if ProseMirror is a child
    const childProseMirror = element.querySelector('.ProseMirror');
    if (childProseMirror) {
      return childProseMirror;
    }
    
    // Last resort: find any ProseMirror element on the page for Claude.ai
    const anyProseMirror = document.querySelector('div[contenteditable="true"][role="textbox"].ProseMirror');
    if (anyProseMirror) {
      return anyProseMirror;
    }
    
    // Return original element as final fallback
    return element;
  }
  
  /**
   * Attempts insertion using ProseMirror transaction API
   * @param {HTMLElement} proseMirrorElement - ProseMirror element
   * @param {string} content - Content to insert
   * @returns {Promise<InsertionResult>} Result of insertion attempt
   * @private
   */
  async _tryProseMirrorTransaction(proseMirrorElement, content) {
    try {
      const view = proseMirrorElement.pmViewDesc?.view || 
                  proseMirrorElement._pmViewDesc?.view ||
                  window.ProseMirror?.view;
      
      if (view && view.state && view.dispatch) {
        const { state } = view;
        const { selection } = state;
        const transaction = state.tr.insertText(content, selection.from, selection.to);
        view.dispatch(transaction);
        
        // Trigger events for Claude
        proseMirrorElement.dispatchEvent(new Event('input', { bubbles: true }));
        proseMirrorElement.dispatchEvent(new Event('compositionend', { bubbles: true }));
        
        return { success: true, method: 'prosemirror-transaction' };
      }
    } catch (error) {
      this._warn('ProseMirror transaction failed', error);
    }
    
    return { success: false };
  }
  
  /**
   * Attempts insertion using execCommand
   * @param {HTMLElement} proseMirrorElement - ProseMirror element
   * @param {HTMLElement} element - Original element
   * @param {string} content - Content to insert
   * @returns {Promise<InsertionResult>} Result of insertion attempt
   * @private
   */
  async _tryExecCommand(proseMirrorElement, element, content) {
    if (proseMirrorElement.contentEditable === 'true' || element.contentEditable === 'true') {
      try {
        const targetEl = proseMirrorElement.contentEditable === 'true' ? proseMirrorElement : element;
        targetEl.focus();
        
        // For Claude, we need to ensure the editor is ready
        targetEl.click();
        
        // Wait a tiny bit for focus
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Clear existing content if it's placeholder text
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(targetEl);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Insert new content using execCommand
        const inserted = document.execCommand('insertText', false, content);
        
        if (inserted) {
          // Trigger Claude-specific events
          const inputEvent = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: content
          });
          targetEl.dispatchEvent(inputEvent);
          targetEl.dispatchEvent(new Event('compositionend', { bubbles: true }));
          
          // For Claude, also trigger these events on the parent contenteditable if different
          if (targetEl !== element) {
            element.dispatchEvent(inputEvent);
            element.dispatchEvent(new Event('compositionend', { bubbles: true }));
          }
          
          return { success: true, method: 'execCommand' };
        }
      } catch (error) {
        this._warn('execCommand failed', error);
      }
    }
    
    return { success: false };
  }
  
  /**
   * Attempts insertion using direct DOM manipulation
   * @param {HTMLElement} element - Target element
   * @param {string} content - Content to insert
   * @returns {InsertionResult} Result of insertion attempt
   * @private
   */
  _tryDOMManipulation(element, content) {
    try {
      element.focus();
      element.textContent = content;
      
      // Create and dispatch a comprehensive set of events
      const inputEvent = new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: content
      });
      element.dispatchEvent(inputEvent);
      
      // Additional events that Claude might listen to
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true }));
      element.dispatchEvent(new Event('focus', { bubbles: true }));
      
      return { success: true, method: 'dom-manipulation' };
    } catch (error) {
      this._error('All insertion methods failed', error);
      return { success: false, error: error.message };
    }
  }
}

// ================================================================================================
// CHATGPT STRATEGY IMPLEMENTATION
// ================================================================================================

/**
 * Strategy for handling ChatGPT's React-based textarea inputs
 * Uses React-specific event triggering for proper state updates
 */
class ChatGPTStrategy extends PlatformStrategy {
  constructor() {
    super('chatgpt', 90, {
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
      buttonContainerSelector: 'div[data-testid="composer-trailing-actions"] .ms-auto.flex.items-center'
    });
  }
  
  /**
   * Determines if this strategy can handle the element
   * Only handles textarea elements on chatgpt.com
   */
  canHandle(element) {
    return this.hostname === 'chatgpt.com' && element.tagName === 'TEXTAREA';
  }
  
  /**
   * Inserts content using React-compatible methods
   * Uses native property setter to trigger React state updates
   */
  async insert(element, content) {
    try {
      element.focus();
      element.value = content;
      
      // Trigger React events for ChatGPT - this is crucial for React state updates
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      ).set;
      nativeInputValueSetter.call(element, content);
      
      // Dispatch events that React expects
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      return { success: true, method: 'chatgpt-react' };
    } catch (error) {
      this._error('React insertion failed', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Gets selectors for finding ChatGPT input elements
   */
  getSelectors() {
    return this.config.selectors;
  }
  
  /**
   * Creates ChatGPT-specific icon using the UI factory
   */
  createIcon(uiFactory) {
    return uiFactory.createChatGPTIcon();
  }
}

// ================================================================================================
// PERPLEXITY STRATEGY IMPLEMENTATION
// ================================================================================================

/**
 * Strategy for handling Perplexity.ai's contenteditable inputs
 * Uses comprehensive event triggering for various input types
 */
class PerplexityStrategy extends PlatformStrategy {
  constructor() {
    super('perplexity', 80, {
      selectors: [
        'div[contenteditable="true"][role="textbox"]#ask-input'
      ],
      buttonContainerSelector: '.bg-background-50.dark\\:bg-offsetDark.flex.items-center.justify-self-end.rounded-full.col-start-3.row-start-2'
    });
  }
  
  /**
   * Determines if this strategy can handle the element
   * Handles any element on www.perplexity.ai
   */
  canHandle(element) {
    return this.hostname === 'www.perplexity.ai';
  }
  
  /**
   * Inserts content using Perplexity-compatible methods
   * Handles both contenteditable divs and textarea elements
   */
  async insert(element, content) {
    try {
      element.focus();
      
      // Handle different element types
      if (element.contentEditable === 'true') {
        element.textContent = content;
      } else if (element.tagName === 'TEXTAREA') {
        element.value = content;
      }
      
      // Trigger comprehensive event set that Perplexity expects
      const events = ['input', 'change', 'keyup', 'paste'];
      events.forEach(eventType => {
        element.dispatchEvent(new Event(eventType, { bubbles: true }));
      });
      
      this._debug('Perplexity insertion successful');
      return { success: true, method: 'perplexity-events' };
    } catch (error) {
      this._error('Perplexity insertion failed', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Gets selectors for finding Perplexity input elements
   */
  getSelectors() {
    return this.config.selectors;
  }
  
  /**
   * Creates Perplexity-specific icon using the UI factory
   */
  createIcon(uiFactory) {
    return uiFactory.createPerplexityIcon();
  }
}

// ================================================================================================
// DEFAULT STRATEGY IMPLEMENTATION
// ================================================================================================

/**
 * Fallback strategy for unknown platforms or generic input elements
 * Provides basic insertion functionality that works with most standard inputs
 */
class DefaultStrategy extends PlatformStrategy {
  constructor() {
    super('default', 0, {
      selectors: [
        'textarea',
        'input[type="text"]',
        'div[contenteditable="true"]',
        '[role="textbox"]'
      ],
      buttonContainerSelector: null // No specific container for default
    });
  }
  
  /**
   * Always returns true as this is the fallback strategy
   */
  canHandle(element) {
    return true; // Always can handle as fallback
  }
  
  /**
   * Inserts content using generic methods
   * Works with standard textarea, input, and contenteditable elements
   */
  async insert(element, content) {
    try {
      element.focus();
      
      // Handle different element types with basic insertion
      if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        element.value = content;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (element.contentEditable === 'true') {
        element.textContent = content;
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      this._debug('Default insertion successful');
      return { success: true, method: 'default' };
    } catch (error) {
      this._error('Default insertion failed', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Gets generic selectors for finding input elements
   */
  getSelectors() {
    return this.config.selectors;
  }
  
  /**
   * Uses default floating icon
   */
  createIcon(uiFactory) {
    return uiFactory.createFloatingIcon();
  }
}

// ================================================================================================
// PLATFORM MANAGER CLASS
// ================================================================================================

/**
 * Manages platform strategies and coordinates insertion attempts
 * Provides isolation between strategies and handles strategy selection logic
 */
class PlatformManager {
  constructor(options = {}) {
    this.options = {
      enableDebugLogging: options.enableDebugLogging || false,
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 5000
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
  _initializeStrategies() {
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
   * Gets all available selectors from loaded strategies
   * @returns {string[]} Combined array of all selectors
   */
  getAllSelectors() {
    const allSelectors = [];
    for (const strategy of this.strategies) {
      allSelectors.push(...strategy.getSelectors());
    }
    return [...new Set(allSelectors)]; // Remove duplicates
  }
  
  /**
   * Gets button container selector for the active platform
   * @returns {string|null} Button container selector or null
   */
  getButtonContainerSelector() {
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
   * @param {UIElementFactory} uiFactory - UI factory instance
   * @returns {HTMLElement} Platform-specific icon
   */
  createIcon(uiFactory) {
    // Use the highest priority strategy to create the icon
    for (const strategy of this.strategies) {
      const icon = strategy.createIcon(uiFactory);
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
   * @param {string} content - Content to insert
   * @param {Object} options - Insertion options
   * @returns {Promise<InsertionResult>} Result of insertion attempt
   */
  async insertContent(content, options = {}) {
    const targetElement = options.targetElement || document.activeElement;
    
    if (!targetElement) {
      return {
        success: false,
        error: 'No target element found'
      };
    }
    
    // Find compatible strategies
    const compatibleStrategies = this.strategies.filter(strategy => {
      try {
        return strategy.canHandle(targetElement);
      } catch (error) {
        Logger.warn(`Strategy ${strategy.name} canHandle() failed`, error);
        return false;
      }
    });
    
    if (compatibleStrategies.length === 0) {
      return {
        success: false,
        error: 'No compatible strategies found for target element'
      };
    }
    
    // Try strategies in priority order
    for (const strategy of compatibleStrategies) {
      try {
        const result = await strategy.insert(targetElement, content);
        
        if (result.success) {
          Logger.info('PlatformManager: Insertion successful', {
            strategy: strategy.name,
            method: result.method
          });
          this.activeStrategy = strategy;
          return result;
        }
      } catch (error) {
        Logger.warn(`PlatformManager: ${strategy.name} strategy threw error`, error);
      }
    }
    
    return {
      success: false,
      error: 'All compatible strategies failed'
    };
  }
  
  /**
   * Gets the currently active strategy
   * @returns {PlatformStrategy|null} Active strategy or null
   */
  getActiveStrategy() {
    return this.activeStrategy;
  }
  
  /**
   * Gets all loaded strategies
   * @returns {PlatformStrategy[]} Array of loaded strategies
   */
  getStrategies() {
    return [...this.strategies];
  }
  
  /**
   * Cleans up all strategies
   */
  cleanup() {
    Logger.info('PlatformManager: Starting cleanup');
    
    for (const strategy of this.strategies) {
      try {
        strategy.cleanup();
      } catch (error) {
        Logger.warn(`Failed to cleanup strategy ${strategy.name}`, error);
      }
    }
    
    this.strategies = [];
    this.activeStrategy = null;
    
    Logger.info('PlatformManager: Cleanup complete');
  }
}

// ================================================================================================
// UPDATED PLATFORM INSERTION MANAGER
// ================================================================================================

/**
 * Updated PlatformInsertionManager that uses the new strategy pattern
 * Maintains backward compatibility while using the improved architecture
 */
class PlatformInsertionManager {
  constructor(options = {}) {
    this.options = {
      enableDebugLogging: options.enableDebugLogging || false,
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 5000
    };
    
    // Use the new PlatformManager
    this.platformManager = new PlatformManager(this.options);
    
    Logger.info('PlatformInsertionManager initialized with strategy pattern');
  }
  
  /**
   * Inserts content using the strategy pattern
   * @param {string} content - Content to insert
   * @param {Object} options - Insertion options
   * @returns {Promise<InsertionResult>} Result of insertion attempt
   */
  async insertContent(content, options = {}) {
    return this.platformManager.insertContent(content, options);
  }
  
  /**
   * Gets all available selectors
   * @returns {string[]} Array of CSS selectors
   */
  getAllSelectors() {
    return this.platformManager.getAllSelectors();
  }
  
  /**
   * Gets button container selector
   * @returns {string|null} Button container selector
   */
  getButtonContainerSelector() {
    return this.platformManager.getButtonContainerSelector();
  }
  
  /**
   * Creates platform-specific icon
   * @param {UIElementFactory} uiFactory - UI factory
   * @returns {HTMLElement} Platform icon
   */
  createIcon(uiFactory) {
    return this.platformManager.createIcon(uiFactory);
  }
  
  /**
   * Gets the active strategy
   * @returns {PlatformStrategy|null} Active strategy
   */
  getActiveStrategy() {
    return this.platformManager.getActiveStrategy();
  }
  
  /**
   * Cleans up resources
   */
  cleanup() {
    if (this.platformManager) {
      this.platformManager.cleanup();
      this.platformManager = null;
    }
  }
}

// Helper function removed - no longer needed since PromptLibraryInjector uses its own platformManager

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
    
    // Initialize platform manager using the new strategy pattern
    this.platformManager = new PlatformInsertionManager({
      enableDebugLogging: Logger.isDebugMode(),
      maxRetries: 3,
      timeout: 5000
    });
    
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
    
    // Platform configurations are now handled by the strategy pattern
    // Each strategy contains its own selectors and platform-specific logic
    
    this.init();
  }
  
  /**
   * Gets all available selectors from the platform manager
   * @returns {string[]} Array of CSS selectors
   */
  getAvailableSelectors() {
    if (!this.platformManager) {
      Logger.warn('Platform manager not initialized');
      return [];
    }
    
    return this.platformManager.getAllSelectors();
  }
  
  /**
   * Gets button container selector for the current platform
   * @returns {string|null} Button container selector or null
   */
  getButtonContainerSelector() {
    if (!this.platformManager) {
      return null;
    }
    
    return this.platformManager.getButtonContainerSelector();
  }
  
  /**
   * Creates platform-specific icon using the platform manager
   * @returns {HTMLElement} Platform-specific icon
   */
  createPlatformIcon() {
    
    if (!this.platformManager) {
      Logger.warn('Platform manager not initialized, using default icon');
      return this.uiFactory.createFloatingIcon();
    }
    
    const icon = this.platformManager.createIcon(this.uiFactory);
    
    if (icon && this.platformManager.getActiveStrategy()) {
      Logger.info('Created platform-specific icon', {
        strategy: this.platformManager.getActiveStrategy().name,
        hostname: this.hostname
      });
    }
    
    return icon;
  }
  
  /**
   * Sets up click handler for the icon element
   * @param {HTMLElement} iconElement - The icon element
   */
  setupIconClickHandler(iconElement) {
    const clickHandler = async (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      Logger.info('Icon clicked', {
        strategy: this.platformManager?.getActiveStrategy()?.name || 'unknown',
        hasTextarea: !!this.currentTextarea
      });
      
      try {
        // For platform-specific icons, use the stored currentTextarea instead of the icon element
        if (this.currentTextarea) {
          await this.showPromptSelector(this.currentTextarea);
        } else {
          Logger.error('No currentTextarea available for prompt selector');
        }
      } catch (error) {
        Logger.error('Failed to show prompt selector', error);
      }
    };
    
    this.eventManager.addTrackedEventListener(iconElement, 'click', clickHandler);
    
    // Add keyboard support
    const keyHandler = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        clickHandler(event);
      }
    };
    
    this.eventManager.addTrackedEventListener(iconElement, 'keydown', keyHandler);
  }
  
  /**
   * Positions icon near textarea as fallback when no container is found
   * @param {HTMLElement} iconElement - The icon element
   * @param {HTMLElement} textarea - The textarea element
   */
  positionIconNearTextarea(iconElement, textarea) {
    // Use the createFloatingIcon approach as fallback
    this.createFloatingIcon(textarea);
  }
  
  /**
   * Inserts icon after Research button with retry logic for Claude.ai
   * @param {HTMLElement} buttonContainer - The button container
   * @param {HTMLElement} iconElement - The icon element to insert
   */
  async insertIconAfterResearchButton(buttonContainer, iconElement) {
    const maxRetries = 10;
    const retryDelay = 300; // 300ms between retries
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const researchButton = this.findResearchButtonContainer(buttonContainer);
      if (researchButton) {
        researchButton.insertAdjacentElement('afterend', iconElement);
        return; // Success!
      }
      
      // If not found and we have more attempts, wait and try again
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    // If we get here, all retries failed
    Logger.warn('Research button not found after all retries, appending to end of container');
    buttonContainer.appendChild(iconElement);
  }

  /**
   * Finds the Research button container in Claude.ai
   * @param {HTMLElement} parentContainer - The parent button container
   * @returns {HTMLElement|null} The Research button container or null
   */
  findResearchButtonContainer(parentContainer) {
    
    // Method 1: Look for Research button by text content
    const allButtons = parentContainer.querySelectorAll('button');
    
    for (const button of allButtons) {
      const textElement = button.querySelector('p');
      if (textElement) {
        const text = textElement.textContent.trim();
        if (text === 'Research') {
          const container = button.closest('div[class*="flex"][class*="shrink"]');
          if (container) {
            return container;
          }
        }
      }
    }
    
    // Method 2: Look for the specific Research button structure
    const flexDivs = parentContainer.querySelectorAll('div.flex.shrink');
    Logger.debug(`Found ${flexDivs.length} flex shrink divs`);
    
    for (const div of flexDivs) {
      // Check if this div has the Research button characteristics
      const hasMinWidthClass = div.classList.contains('min-w-8');
      const hasShrinkClass = div.classList.contains('!shrink-0');
      const hasButton = div.querySelector('button');
      const hasResearchText = div.querySelector('p')?.textContent.trim() === 'Research';
      
      if (hasButton && (hasMinWidthClass || hasShrinkClass || hasResearchText)) {
        Logger.debug('Found Research button container via structure search', {
          hasMinWidthClass,
          hasShrinkClass, 
          hasResearchText
        });
        return div;
      }
    }
    
    // Method 3: Look for the SVG icon that matches Research (search icon)
    const searchSVGs = parentContainer.querySelectorAll('svg[viewBox="0 0 20 20"]');
    for (const svg of searchSVGs) {
      const path = svg.querySelector('path[d*="M8.5 2C12.0899"]');
      if (path) {
        const container = svg.closest('div[class*="flex"][class*="shrink"]');
        if (container) {
          Logger.debug('Found Research button container via SVG search');
          return container;
        }
      }
    }
    
    Logger.debug('Research button not found with any method');
    return null;
  }
  
  /**
   * Removes the current icon if it exists
   */
  removeIcon() {
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
  }
  
  /**
   * Inserts prompt content using the platform manager
   * @param {string} content - Content to insert
   * @param {HTMLElement} targetElement - Target element (optional)
   * @returns {Promise<Object>} Result of insertion attempt
   */
  async insertPromptContent(content, targetElement = null) {
    if (!this.platformManager) {
      Logger.error('Platform manager not available for content insertion');
      return { success: false, error: 'Platform manager not initialized' };
    }
    
    Logger.info('Attempting prompt insertion', {
      contentLength: content.length,
      hasTargetElement: !!targetElement,
      hostname: this.hostname
    });
    
    try {
      // Ensure we have the correct target element for insertion
      let insertTarget = targetElement;
      
      if (!insertTarget) {
        // Use current textarea if available
        insertTarget = this.currentTextarea;
      }
      
      if (!insertTarget && this.hostname === 'claude.ai') {
        // For Claude.ai, find the ProseMirror editor specifically
        insertTarget = document.querySelector('div[contenteditable="true"][role="textbox"].ProseMirror');
        Logger.debug('Found ProseMirror target for Claude.ai', { 
          found: !!insertTarget,
          targetTag: insertTarget?.tagName,
          targetClass: insertTarget?.className
        });
      }
      
      if (!insertTarget) {
        // Last resort: use document.activeElement only if it's a valid input
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.contentEditable === 'true')) {
          insertTarget = activeEl;
        }
      }
      
      if (!insertTarget) {
        Logger.error('No valid target element found for content insertion');
        return { success: false, error: 'No target element found' };
      }
      
      Logger.debug('Using target element for insertion', {
        targetTag: insertTarget.tagName,
        targetId: insertTarget.id,
        targetClass: insertTarget.className.substring(0, 50),
        isContentEditable: insertTarget.contentEditable,
        isProseMirror: insertTarget.classList.contains('ProseMirror')
      });
      
      const result = await this.platformManager.insertContent(content, {
        targetElement: insertTarget
      });
      
      if (result.success) {
        Logger.info('Prompt insertion successful', {
          method: result.method,
          strategy: this.platformManager.getActiveStrategy()?.name || 'unknown'
        });
        
        // Show success feedback
        this.showInsertionFeedback(true, result.method);
      } else {
        Logger.warn('Prompt insertion failed', result);
        this.showInsertionFeedback(false, result.error);
      }
      
      return result;
    } catch (error) {
      Logger.error('Error during prompt insertion', error);
      this.showInsertionFeedback(false, 'Insertion error');
      return { success: false, error: error.message };
    }
  }

  cleanup() {
    Logger.info('Starting cleanup', { instanceId: this.instanceId });
    
    // Clean up platform manager
    if (this.platformManager) {
      try {
        this.platformManager.cleanup();
        this.platformManager = null;
        Logger.info('Platform manager cleaned up successfully');
      } catch (error) {
        Logger.warn('Failed to cleanup platform manager', error);
      }
    }
    
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
    
    Logger.info('Initializing my prompt manager for site', { hostname: this.hostname });
    
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
    
    // Also detect on focus events for input elements
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
    // Use platform manager instead of hardcoded config
    
    // Get site-specific observation targets
    let observeTargets = [
      'main', '[role="main"]', '.chat-container', '.input-container', 
      '[class*="chat"]', '[class*="input"]', '[class*="compose"]'
    ];
    
    // Add site-specific targets based on platform manager
    if (this.platformManager) {
      const buttonContainerSelector = this.platformManager.getButtonContainerSelector();
      if (buttonContainerSelector) {
        // Try to observe near the button container area
        // Remove leading dot and split, then take all but last class
        const selectorWithoutDot = buttonContainerSelector.startsWith('.') 
          ? buttonContainerSelector.substring(1) 
          : buttonContainerSelector;
        const classParts = selectorWithoutDot.split('.');
        
        if (classParts.length > 1) {
          // Take all but the last class to get a broader container
          const containerParent = classParts.slice(0, -1).join('.');
          if (containerParent && containerParent.length > 0) {
            observeTargets.unshift(`.${containerParent}`);
          }
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
      // Ensure hostname is a string
      const normalizedHostname = String(hostname || '');
      
      const result = await chrome.storage.local.get(['promptLibrarySettings']);
      const settings = result.promptLibrarySettings || {};
      const customSites = settings.customSites || [];
      
      const customSite = customSites.find(site => site.hostname === normalizedHostname);
      if (customSite && customSite.enabled && customSite.positioning) {
        Logger.info('Found custom site positioning config', {
          hostname: normalizedHostname,
          mode: customSite.positioning.mode,
          selector: customSite.positioning.selector,
          placement: customSite.positioning.placement
        });
        return customSite.positioning;
      }
    } catch (error) {
      Logger.error('Failed to get custom site config', { 
        error: error.message,
        hostname: String(hostname || '')
      });
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
      
      // Also remove any other prompt library icons that might exist
      const existingIcons = document.querySelectorAll('.prompt-library-icon');
      existingIcons.forEach(icon => {
        try {
          icon.remove();
          Logger.info('Removed duplicate prompt library icon during custom positioning');
        } catch (error) {
          Logger.warn('Failed to remove duplicate icon during custom positioning', { error: error.message });
        }
      });

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

    // For Claude.ai, prioritize the specific ProseMirror selector
    if (this.hostname === 'claude.ai') {
      const proseMirrorSelector = 'div[contenteditable="true"][role="textbox"].ProseMirror';
      const proseMirrorEditor = document.querySelector(proseMirrorSelector);
      if (proseMirrorEditor && this.isValidTextarea(proseMirrorEditor)) {
        return proseMirrorEditor;
      }
    }

    // Use platform manager selectors if available
    const platformSelectors = this.platformManager ? this.platformManager.getAllSelectors() : [];
    
    // Look for textarea in the same container using platform-specific selectors first
    const commonSelectors = [
      ...platformSelectors,
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

    Logger.warn('No valid textarea found in findClosestTextarea', {
      hostname: this.hostname
    });
    
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
        
      } else {
        Logger.error('Icon element is null during positioning');
        return;
      }
      
      // Store current textarea reference for the icon
      // For Claude.ai, preserve the existing currentTextarea if it's valid
      // since it was likely set correctly by detectAndInjectIcon
      if (this.hostname === 'claude.ai' && this.currentTextarea) {
        const isValidProseMirror = this.currentTextarea.classList?.contains('ProseMirror') &&
                                  this.currentTextarea.getAttribute('contenteditable') === 'true' &&
                                  this.currentTextarea.getAttribute('role') === 'textbox';
        
        if (!isValidProseMirror) {
          this.currentTextarea = this.findClosestTextarea(targetElement);
        }
      } else {
        // For other sites or when no existing currentTextarea, find it
        this.currentTextarea = this.findClosestTextarea(targetElement);
      }
      
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
    // Use platform manager to get available selectors
    const selectors = this.getAvailableSelectors();
    
    if (selectors.length === 0) {
      Logger.debug('No selectors available for current platform');
      return;
    }
    
    Logger.debug('Detecting input elements', {
      hostname: this.hostname,
      selectorsCount: selectors.length,
      sampleSelectors: selectors.slice(0, 3)
    });
    
    // Check for existing icons and remove them to prevent duplicates
    const existingIcons = document.querySelectorAll('.prompt-library-icon');
    if (existingIcons.length > 0) {
      Logger.info('Found existing icons, removing them to prevent duplicates', { count: existingIcons.length });
      existingIcons.forEach(icon => {
        try {
          icon.remove();
        } catch (error) {
          Logger.warn('Failed to remove existing icon', { error: error.message });
        }
      });
    }
    
    // Reset icon reference
    this.icon = null;
    
    // First, check for custom site positioning configuration
    const customPositioning = await this.getCustomSiteConfig(this.hostname);
    if (customPositioning && customPositioning.mode === 'custom') {
      Logger.info('Attempting custom positioning for site', { hostname: this.hostname });
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
          Logger.warn('Custom positioning failed, falling back to platform strategy behavior', {
            context: { 
              selector: customPositioning.selector,
              totalAttempts: this.customSelectorRetry.attempts,
              hostname: this.hostname
            }
          });
        }
      }
    }
    
    // Find textarea using optimized search with strategy selectors
    const foundTextarea = this.findTextareaWithCaching(selectors);
    
    if (foundTextarea && this.isValidTextarea(foundTextarea)) {
      if (this.currentTextarea !== foundTextarea) {
        Logger.info('New input element detected', {
          elementTag: foundTextarea.tagName,
          elementId: foundTextarea.id,
          elementClass: foundTextarea.className.substring(0, 50),
          strategy: this.platformManager?.getActiveStrategy()?.name || 'unknown'
        });
        
        // Remove existing icon if different textarea
        this.removeIcon();
        
        this.currentTextarea = foundTextarea;
        await this.injectIcon(foundTextarea);
      } else if (this.currentTextarea && !this.icon) {
        // Current textarea exists but no icon - inject it
        Logger.debug('Current textarea exists but no icon found, re-injecting');
        await this.injectIcon(this.currentTextarea);
      }
    } else if (this.currentTextarea && !document.contains(this.currentTextarea)) {
      // Current textarea no longer exists in DOM
      Logger.info('Current textarea no longer in DOM, cleaning up');
      this.removeIcon();
      this.currentTextarea = null;
    } else {
      Logger.debug('No valid textarea found with platform selectors', {
        hostname: this.hostname,
        selectorsChecked: selectors.length
      });
    }
  }

  async injectIcon(textarea) {
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
      
      // Create platform-specific icon
      const iconElement = this.createPlatformIcon();
      
      if (!iconElement) {
        Logger.warn('Failed to create platform icon');
        return;
      }
      
      // Try to place icon in platform-specific container
      const containerSelector = this.getButtonContainerSelector();
      let buttonContainer = null;
      
      if (containerSelector) {
        try {
          buttonContainer = document.querySelector(containerSelector);
          if (buttonContainer) {
            // Platform-specific container found
          }
        } catch (error) {
          Logger.warn('Platform button container selector failed', {
            selector: containerSelector,
            error: error.message
          });
        }
      }
      
      // Fallback to positioning near textarea if no container found
      if (!buttonContainer) {
        Logger.debug('Using fallback positioning near textarea');
        this.positionIconNearTextarea(iconElement, textarea);
      } else {
        // Check for existing prompt library icons to prevent duplicates
        const existingIcon = buttonContainer.querySelector('.prompt-library-integrated-icon, .prompt-library-icon');
        if (existingIcon) {
          Logger.debug('Icon already exists in container, skipping injection');
          return;
        }
        
        // For Claude.ai, try to insert after the Research button for better positioning
        if (this.hostname === 'claude.ai') {
          await this.insertIconAfterResearchButton(buttonContainer, iconElement);
        } else {
          // For other platforms, append to container
          buttonContainer.appendChild(iconElement);
        }
      }
      
      // Set up icon click handler
      this.setupIconClickHandler(iconElement);
      
      this.icon = iconElement;
      
      Logger.info('Icon injection successful', {
        iconType: iconElement.className.includes('integrated') ? 'integrated' : 'floating',
        hasContainer: !!buttonContainer,
        strategy: this.platformManager?.getActiveStrategy()?.name || 'unknown'
      });
    } catch (mainError) {
      Logger.error('Icon injection failed completely', mainError, {
        hostname: this.hostname,
        textareaTag: textarea?.tagName,
        hasPlatformManager: !!this.platformManager
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
    
    // Also remove any other prompt library icons that might exist
    const existingIcons = document.querySelectorAll('.prompt-library-icon');
    existingIcons.forEach(icon => {
      if (icon !== this.icon) {
        try {
          icon.remove();
          Logger.info('Removed duplicate prompt library icon');
        } catch (error) {
          Logger.warn('Failed to remove duplicate icon', { error: error.message });
        }
      }
    });
    
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
    
    // Use secure DOM construction
    // Create header section
    const header = StorageManager.createElement('div', { class: 'prompt-selector-header' });
    const headerTitle = StorageManager.createElement('h3', { 
      id: 'prompt-selector-title' 
    }, 'Select a Prompt');
    const closeButton = StorageManager.createElement('button', {
      class: 'close-selector',
      type: 'button',
      'aria-label': 'Close prompt selector',
      title: 'Close prompt selector'
    }, '×');
    header.appendChild(headerTitle);
    header.appendChild(closeButton);
    
    // Create search section
    const searchDiv = StorageManager.createElement('div', { class: 'prompt-search' });
    const searchLabel = StorageManager.createElement('label', {
      for: 'prompt-search-input',
      class: 'sr-only'
    }, 'Search prompts');
    const searchInput = StorageManager.createElement('input', {
      type: 'text',
      id: 'prompt-search-input',
      placeholder: 'Search prompts...',
      class: 'search-input',
      'aria-describedby': 'prompt-selector-description',
      autocomplete: 'off'
    });
    searchDiv.appendChild(searchLabel);
    searchDiv.appendChild(searchInput);
    
    // Create description section
    const description = StorageManager.createElement('div', {
      id: 'prompt-selector-description',
      class: 'sr-only'
    }, 'Use arrow keys to navigate, Enter to select, Escape to close');
    
    // Create prompt list section
    const promptList = StorageManager.createElement('div', {
      class: 'prompt-list',
      role: 'listbox',
      'aria-label': 'Available prompts',
      'aria-multiselectable': 'false'
    });
    
    // Add prompt items securely
    if (prompts.length > 0) {
      prompts.forEach((prompt, index) => {
        const promptItem = StorageManager.createPromptListItem(prompt, index, 'prompt-item');
        promptList.appendChild(promptItem);
      });
    } else {
      const noPrompts = StorageManager.createElement('div', {
        class: 'no-prompts',
        role: 'status',
        'aria-live': 'polite'
      }, 'No prompts found. Add some in the extension popup!');
      promptList.appendChild(noPrompts);
    }
    
    // Assemble the complete selector
    this.promptSelector.appendChild(header);
    this.promptSelector.appendChild(searchDiv);
    this.promptSelector.appendChild(description);
    this.promptSelector.appendChild(promptList);
    
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
    
    // Use secure DOM construction
    const promptList = this.promptSelector.querySelector('.prompt-list');
    
    // Clear existing content safely
    while (promptList.firstChild) {
      promptList.removeChild(promptList.firstChild);
    }
    
    // Add filtered prompt items securely
    if (filteredPrompts.length > 0) {
      filteredPrompts.forEach((prompt, index) => {
        const promptItem = StorageManager.createPromptListItem(prompt, index, 'filtered-prompt-item');
        promptList.appendChild(promptItem);
      });
    } else {
      const noPrompts = StorageManager.createElement('div', {
        class: 'no-prompts',
        role: 'status',
        'aria-live': 'polite'
      }, 'No matching prompts found.');
      promptList.appendChild(noPrompts);
    }
    
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
          Logger.info('Prompt selected for insertion', {
            promptId,
            promptTitle: prompt.title?.substring(0, 50)
          });

          // For Claude.ai, double-check we have the correct target
          let targetElement = this.currentTextarea;
          if (this.hostname === 'claude.ai') {
            const proseMirrorEditor = document.querySelector('div[contenteditable="true"][role="textbox"].ProseMirror');
            if (proseMirrorEditor && proseMirrorEditor !== this.currentTextarea) {
              Logger.info('Using fresh ProseMirror target instead of cached currentTextarea');
              targetElement = proseMirrorEditor;
              // Update cached reference
              this.currentTextarea = proseMirrorEditor;
            }
          }

          this.insertPrompt(targetElement, prompt.content);
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

  async insertPrompt(textarea, content) {
    try {
      // Sanitize content before insertion
      const sanitizedContent = StorageManager.sanitizeUserInput(content);
      
      Logger.info('Starting prompt insertion', { 
        hostname: this.hostname,
        targetElement: textarea?.tagName
      });

      // Additional validation for Claude.ai - ensure we're targeting the correct element
      if (this.hostname === 'claude.ai' && textarea) {
        const isProseMirrorEditor = textarea.classList?.contains('ProseMirror') && 
                                   textarea.getAttribute('contenteditable') === 'true' &&
                                   textarea.getAttribute('role') === 'textbox';
        
        if (!isProseMirrorEditor) {
          Logger.warn('Target element is not a valid ProseMirror editor for Claude.ai', {
            classList: Array.from(textarea.classList || []),
            contentEditable: textarea.getAttribute('contenteditable'),
            role: textarea.getAttribute('role')
          });
          
          // Try to find the correct ProseMirror editor
          const correctEditor = document.querySelector('div[contenteditable="true"][role="textbox"].ProseMirror');
          if (correctEditor) {
            Logger.info('Found correct ProseMirror editor, switching target');
            textarea = correctEditor;
          }
        }
      }

      // Use the new insertPromptContent method
      const result = await this.insertPromptContent(sanitizedContent, textarea);

      if (!result.success) {
        // Fallback to legacy insertion method if the new system fails
        Logger.info('Attempting legacy fallback insertion', {
          reason: 'Strategy system failed',
          errorSummary: result.error
        });
        this.legacyInsertPrompt(textarea, sanitizedContent);
      }

    } catch (error) {
      Logger.error('Prompt insertion error', error, {
        platform: this.hostname
      });

      // Fallback to legacy insertion method
      Logger.info('Attempting legacy fallback insertion due to error');
      this.legacyInsertPrompt(textarea, StorageManager.sanitizeUserInput(content));
    }
  }

  /**
   * Shows user feedback for insertion attempts
   */
  showInsertionFeedback(success, details) {
    try {
      // Only show feedback if there's a visible prompt selector
      if (!this.promptSelector || !document.body.contains(this.promptSelector)) {
        return;
      }

      // Create feedback element
      const feedback = document.createElement('div');
      feedback.className = `insertion-feedback ${success ? 'success' : 'error'}`;
      feedback.style.cssText = `
        position: absolute;
        top: -40px;
        left: 50%;
        transform: translateX(-50%);
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        color: white;
        z-index: 1000001;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
        ${success 
          ? 'background: linear-gradient(135deg, #10b981, #059669);' 
          : 'background: linear-gradient(135deg, #ef4444, #dc2626);'
        }
      `;
      
      feedback.textContent = success 
        ? `Inserted successfully${details ? ` (${details})` : ''}` 
        : `Insertion failed${details ? `: ${details}` : ''}`;

      // Add to prompt selector
      this.promptSelector.appendChild(feedback);

      // Animate in
      requestAnimationFrame(() => {
        feedback.style.opacity = '1';
      });

      // Remove after delay
      setTimeout(() => {
        feedback.style.opacity = '0';
        setTimeout(() => {
          if (feedback.parentNode) {
            feedback.parentNode.removeChild(feedback);
          }
        }, 200);
      }, success ? 2000 : 3000);

    } catch (feedbackError) {
      Logger.warn('Failed to show insertion feedback', { error: feedbackError.message });
    }
  }

  /**
   * Legacy insertion method as fallback
   * Maintains compatibility with the original implementation
   */
  legacyInsertPrompt(textarea, sanitizedContent) {
    try {
      const hostname = String(window.location.hostname || '');
      
      Logger.info('Using legacy insertion method', { hostname, targetElement: textarea.tagName });
      
      // Site-specific insertion logic (original implementation)
      if (hostname === 'www.perplexity.ai') {
        // Perplexity specific insertion
        textarea.focus();
        
        if (textarea.contentEditable === 'true') {
          textarea.textContent = sanitizedContent;
        } else if (textarea.tagName === 'TEXTAREA') {
          textarea.value = sanitizedContent;
        }
        
        // Trigger Perplexity events
        const events = ['input', 'change', 'keyup', 'paste'];
        events.forEach(eventType => {
          textarea.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
        
      } else if (hostname === 'claude.ai') {
        // Claude specific insertion with enhanced compatibility
        Logger.debug('Legacy Claude insertion attempt', { 
          isContentEditable: textarea.contentEditable,
          hasTextContent: !!textarea.textContent,
          tagName: textarea.tagName
        });
        
        textarea.focus();
        
        if (textarea.contentEditable === 'true') {
          // For Claude's ProseMirror editor, try multiple approaches
          
          // Method 1: Direct textContent assignment
          try {
            textarea.textContent = sanitizedContent;
            Logger.debug('Legacy Claude: textContent assignment completed');
          } catch (textError) {
            Logger.warn('Legacy Claude: textContent assignment failed', textError);
          }
          
          // Method 2: Selection-based insertion for better compatibility
          try {
            const selection = window.getSelection();
            if (selection) {
              selection.selectAllChildren(textarea);
              selection.deleteFromDocument();
              selection.getRangeAt(0).insertNode(document.createTextNode(sanitizedContent));
              Logger.debug('Legacy Claude: Selection-based insertion completed');
            }
          } catch (selectionError) {
            Logger.warn('Legacy Claude: Selection insertion failed', selectionError);
          }
          
          // Trigger Claude-specific events
          const claudeEvents = ['input', 'change', 'keyup', 'compositionend', 'blur', 'focus'];
          claudeEvents.forEach(eventType => {
            try {
              textarea.dispatchEvent(new Event(eventType, { bubbles: true }));
            } catch (eventError) {
              Logger.warn(`Legacy Claude: Event ${eventType} failed`, eventError);
            }
          });
          
        } else if (textarea.tagName === 'TEXTAREA') {
          // Standard textarea handling for Claude
          textarea.value = sanitizedContent;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
      } else {
        // Default insertion for other sites
        if (textarea.contentEditable === 'true') {
          textarea.focus();
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(sanitizedContent));
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          } else {
            textarea.textContent = sanitizedContent;
          }
        } else {
          textarea.focus();
          const start = textarea.selectionStart || 0;
          const end = textarea.selectionEnd || 0;
          const text = textarea.value || '';
          textarea.value = text.substring(0, start) + sanitizedContent + text.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + sanitizedContent.length;
        }
        
        // Trigger input event
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }

      Logger.info('Legacy insertion completed');
      
    } catch (error) {
      Logger.error('Legacy insertion failed', error, { 
        hostname: this.hostname,
        targetElement: textarea.tagName 
      });
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
      // Use textContent for safety
      testIcon.textContent = '?';
      
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