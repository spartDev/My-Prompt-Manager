/* eslint-env browser, webextensions */
// Content script for injecting prompt library icon into LLM websites

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
    }

    .prompt-library-icon:hover {
      background: #4338ca;
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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
    }

    .prompt-item:hover {
      background: #f9fafb;
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
  `;
  
  document.head.appendChild(style);
}

class PromptLibraryInjector {
  constructor() {
    this.icon = null;
    this.currentTextarea = null;
    this.promptSelector = null;
    this.isInitialized = false;
    
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
      }
    };
    
    this.init();
  }

  init() {
    if (this.isInitialized) return;
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
    
    // For ChatGPT and other dynamic sites, retry detection periodically
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
    
    // Watch for dynamic content changes
    const observer = new MutationObserver(() => {
      // Debounce the detection to avoid excessive calls
      clearTimeout(this.detectionTimeout);
      this.detectionTimeout = setTimeout(() => {
        this.detectAndInjectIcon();
      }, 100);
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'id', 'placeholder']
    });
    
    // Also detect on focus events for input elements
    document.addEventListener('focusin', (e) => {
      if (e.target.matches('textarea, div[contenteditable="true"]')) {
        setTimeout(() => this.detectAndInjectIcon(), 100);
      }
    });
  }

  detectAndInjectIcon() {
    const hostname = window.location.hostname;
    const config = this.siteConfigs[hostname];
    
    if (!config) return;
    
    // Find text input element
    let textarea = null;
    
    for (const selector of config.selectors) {
      const elements = document.querySelectorAll(selector);
      
      if (elements.length > 0) {
        // Get visible, enabled elements
        const visibleElements = Array.from(elements).filter(el => {
          return el.offsetHeight > 0 && 
            el.offsetWidth > 0 && 
            !el.disabled &&
            !el.readOnly &&
            getComputedStyle(el).display !== 'none' &&
            getComputedStyle(el).visibility !== 'hidden';
        });
        
        if (visibleElements.length > 0) {
          // Prefer the last (most recent) visible element
          textarea = visibleElements[visibleElements.length - 1];
          break;
        }
      }
    }
    
    if (!textarea) {
      // Fallback: try to find any input-like element
      const fallbackSelectors = [
        'textarea',
        'div[contenteditable="true"]',
        'input[type="text"]',
        '[role="textbox"]',
        '[contenteditable]'
      ];
      
      for (const fallbackSelector of fallbackSelectors) {
        const elements = document.querySelectorAll(fallbackSelector);
        if (elements.length > 0) {
          const visibleEl = Array.from(elements).find(el => el.offsetHeight > 0 && el.offsetWidth > 0);
          if (visibleEl) {
            textarea = visibleEl;
            break;
          }
        }
      }
      
      if (!textarea) return;
    }
    
    if (textarea === this.currentTextarea) return;
    
    this.currentTextarea = textarea;
    this.injectIcon(textarea);
  }

  injectIcon(textarea) {
    // Remove existing icon if any
    if (this.icon) {
      this.icon.remove();
    }
    
    const hostname = window.location.hostname;
    const config = this.siteConfigs[hostname];
    
    // Find the button container using configured selector or fallback selectors
    let buttonContainer = null;
    
    if (config.buttonContainerSelector) {
      buttonContainer = document.querySelector(config.buttonContainerSelector);
    }
    
    // Try fallback selectors if primary one fails
    if (!buttonContainer) {
      const fallbackSelectors = [
        '[class*="bottom-2"][class*="right-2"][class*="flex"]',
        '[class*="absolute"][class*="bottom"][class*="right"][class*="flex"]',
        '.flex.gap-2.self-end',
        '[class*="gap-2"][class*="self-end"]'
      ];
      
      for (const selector of fallbackSelectors) {
        buttonContainer = document.querySelector(selector);
        if (buttonContainer) break;
      }
    }
    
    if (buttonContainer && !buttonContainer.querySelector('.prompt-library-integrated-icon')) {
      // Create icon element styled to match existing buttons
      this.icon = document.createElement('div');
      this.icon.className = 'prompt-library-integrated-icon text-pulse-text-subtle hover:bg-elements-neutrals-100 hover:dark:bg-elements-neutrals-700 flex h-8 w-8 flex-col items-center justify-center px-1 hover:rounded-lg cursor-pointer';
      this.icon.setAttribute('title', 'Prompt Library - Access your saved prompts');
      this.icon.innerHTML = `
        <span class="material-icons-round _icon_mqc2e_1" style="font-size: 1.5rem;">
          <span aria-hidden="true">library_books</span>
        </span>
      `;
      
      // Insert before the send button (last element)
      const sendButton = buttonContainer.lastElementChild;
      buttonContainer.insertBefore(this.icon, sendButton);
      
      // Add click handler
      this.icon.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showPromptSelector(textarea);
      });
    } else {
      // Fallback to original positioning if container not found
      this.createFloatingIcon(textarea);
    }
  }

  createFloatingIcon(textarea) {
    // Create icon element
    this.icon = document.createElement('div');
    this.icon.className = 'prompt-library-icon';
    this.icon.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10,9 9,9 8,9"/>
      </svg>
    `;
    
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

  positionIcon(textarea) {
    const rect = textarea.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    this.icon.style.position = 'absolute';
    this.icon.style.top = (rect.top + scrollTop + 8) + 'px';
    this.icon.style.right = '20px';
    this.icon.style.zIndex = '999999';
    
    // Update position on scroll/resize
    const updatePosition = () => {
      if (!textarea || !this.icon) return;
      const newRect = textarea.getBoundingClientRect();
      const newScrollTop = window.pageYOffset || document.documentElement.scrollTop;
      this.icon.style.top = (newRect.top + newScrollTop + 8) + 'px';
    };
    
    window.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);
  }

  async showPromptSelector(textarea) {
    // Remove existing selector
    if (this.promptSelector) {
      this.promptSelector.remove();
    }
    
    // Get prompts from storage
    const prompts = await this.getPrompts();
    
    // Create selector UI
    this.promptSelector = document.createElement('div');
    this.promptSelector.className = 'prompt-library-selector';
    
    const promptsHtml = prompts.map(prompt => `
      <div class="prompt-item" data-prompt-id="${prompt.id}">
        <div class="prompt-title">${this.escapeHtml(prompt.title)}</div>
        <div class="prompt-category">${this.escapeHtml(prompt.category)}</div>
        <div class="prompt-preview">${this.escapeHtml(prompt.content.substring(0, 100))}${prompt.content.length > 100 ? '...' : ''}</div>
      </div>
    `).join('');
    
    this.promptSelector.innerHTML = `
      <div class="prompt-selector-header">
        <h3>Select a Prompt</h3>
        <button class="close-selector">×</button>
      </div>
      <div class="prompt-search">
        <input type="text" placeholder="Search prompts..." class="search-input">
      </div>
      <div class="prompt-list">
        ${promptsHtml || '<div class="no-prompts">No prompts found. Add some in the extension popup!</div>'}
      </div>
    `;
    
    // Position selector relative to the icon if it's integrated, otherwise relative to textarea
    let rect, scrollTop;
    
    if (this.icon && this.icon.classList.contains('prompt-library-integrated-icon')) {
      // Position relative to the integrated icon button
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
      this.promptSelector.remove();
    });
    
    this.promptSelector.querySelectorAll('.prompt-item').forEach(item => {
      item.addEventListener('click', () => {
        const promptId = item.dataset.promptId;
        const prompt = prompts.find(p => p.id === promptId);
        if (prompt) {
          this.insertPrompt(textarea, prompt.content);
          this.promptSelector.remove();
        }
      });
    });
    
    // Add search functionality
    const searchInput = this.promptSelector.querySelector('.search-input');
    searchInput.addEventListener('input', (e) => {
      this.filterPrompts(e.target.value, prompts);
    });
    
    document.body.appendChild(this.promptSelector);
    
    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', (e) => {
        if (!this.promptSelector.contains(e.target) && !this.icon.contains(e.target)) {
          this.promptSelector.remove();
        }
      }, { once: true });
    }, 100);
  }

  filterPrompts(searchTerm, prompts) {
    const filteredPrompts = prompts.filter(prompt => 
      prompt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prompt.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prompt.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const promptsHtml = filteredPrompts.map(prompt => `
      <div class="prompt-item" data-prompt-id="${prompt.id}">
        <div class="prompt-title">${this.escapeHtml(prompt.title)}</div>
        <div class="prompt-category">${this.escapeHtml(prompt.category)}</div>
        <div class="prompt-preview">${this.escapeHtml(prompt.content.substring(0, 100))}${prompt.content.length > 100 ? '...' : ''}</div>
      </div>
    `).join('');
    
    this.promptSelector.querySelector('.prompt-list').innerHTML = 
      promptsHtml || '<div class="no-prompts">No matching prompts found.</div>';
    
    // Re-add click listeners
    this.promptSelector.querySelectorAll('.prompt-item').forEach(item => {
      item.addEventListener('click', () => {
        const promptId = item.dataset.promptId;
        const prompt = filteredPrompts.find(p => p.id === promptId);
        if (prompt) {
          this.insertPrompt(this.currentTextarea, prompt.content);
          this.promptSelector.remove();
        }
      });
    });
  }

  insertPrompt(textarea, content) {
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

  async getPrompts() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['prompts'], (result) => {
        resolve(result.prompts || []);
      });
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize the injector
new PromptLibraryInjector();