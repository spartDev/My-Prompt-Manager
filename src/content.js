/* eslint-env browser, webextensions */
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
    this.detectionTimeout = null;
    this.hostname = window.location.hostname;
    
    // Add unique identifier to prevent cross-tab interference
    this.instanceId = `prompt-lib-${this.hostname}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
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
      }
    };
    
    this.init();
  }
  
  cleanup() {
    // Remove icon if it exists
    if (this.icon) {
      try {
        this.icon.remove();
      } catch (e) {
        // Silent cleanup
      }
    }
    
    // Remove prompt selector if it exists
    if (this.promptSelector) {
      try {
        this.promptSelector.remove();
      } catch (e) {
        // Silent cleanup
      }
    }
    
    // Clear timeouts
    if (this.detectionTimeout) {
      clearTimeout(this.detectionTimeout);
    }
    
    // Reset state
    this.icon = null;
    this.currentTextarea = null;
    this.promptSelector = null;
    this.isInitialized = false;
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
    
    // Also detect on focus events for Sanofi Concierge input elements
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
        '[contenteditable]',
        '[data-testid*="input"]',
        '[class*="input"]'
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
    try {
      // Remove existing icon if any
      if (this.icon) {
        try {
          this.icon.remove();
        } catch (removeError) {
          // Silent cleanup
        }
      }
      
      const hostname = window.location.hostname;
      const config = this.siteConfigs[hostname];
      
      if (!config) return;
    
    // For supported sites, try integrated button approach
    if (hostname === 'concierge.sanofi.com' || hostname === 'claude.ai' || hostname === 'www.perplexity.ai') {
      // Find the button container using configured selector or fallback selectors
      let buttonContainer = null;
      
      if (config.buttonContainerSelector) {
        buttonContainer = document.querySelector(config.buttonContainerSelector);
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
              break;
            }
          } catch (e) {
            // Continue with next selector
          }
        }
      }
      
      if (buttonContainer && !buttonContainer.querySelector(`.prompt-library-integrated-icon-${this.instanceId}`)) {
        if (hostname === 'claude.ai') {
          try {
            // Claude.ai specific - create wrapped container like other buttons
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
            
            this.icon = document.createElement('button');
            this.icon.className = `prompt-library-integrated-icon-${this.instanceId} inline-flex items-center justify-center relative shrink-0 can-focus select-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:drop-shadow-none border-0.5 transition-all h-8 min-w-8 rounded-lg flex items-center px-[7.5px] group !pointer-events-auto !outline-offset-1 text-text-300 border-border-300 active:scale-[0.98] hover:text-text-200/90 hover:bg-bg-100`;
            this.icon.setAttribute('type', 'button');
            this.icon.setAttribute('aria-label', 'Open prompt library');
            this.icon.setAttribute('title', 'Prompt Library - Access your saved prompts');
            
            this.icon.innerHTML = `
              <div class="flex flex-row items-center justify-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
                  <path d="M224,48H32A16,16,0,0,0,16,64V192a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM208,192H48a8,8,0,0,1-8-8V72H216V184A8,8,0,0,1,208,192ZM64,96a8,8,0,0,1,8-8H184a8,8,0,0,1,0,16H72A8,8,0,0,1,64,96Zm0,32a8,8,0,0,1,8-8H184a8,8,0,0,1,0,16H72A8,8,0,0,1,64,128Zm0,32a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H72A8,8,0,0,1,64,160Z"/>
                </svg>
              </div>
            `;
            
            // Build the hierarchy safely
            shrinkDiv.appendChild(this.icon);
            flexDiv.appendChild(shrinkDiv);
            innerDiv.appendChild(flexDiv);
            iconContainer.appendChild(innerDiv);
            
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
              } catch (selectorError) {
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
            // Fall back to floating icon
            this.createFloatingIcon(textarea);
            return;
          }
          
        } else if (hostname === 'www.perplexity.ai') {
          // Perplexity specific styling
          this.icon = document.createElement('button');
          this.icon.className = `prompt-library-integrated-icon-${this.instanceId} focus-visible:bg-offsetPlus hover:bg-offsetPlus text-textOff hover:text-textMain dark:hover:bg-offsetPlus dark:hover:text-textMainDark font-sans focus:outline-none outline-none outline-transparent transition duration-300 ease-out font-sans select-none items-center relative group/button justify-center text-center items-center rounded-lg cursor-pointer active:scale-[0.97] active:duration-150 active:ease-outExpo origin-center whitespace-nowrap inline-flex text-sm h-8 aspect-[9/8]`;
          this.icon.setAttribute('type', 'button');
          this.icon.setAttribute('aria-label', 'Open prompt library');
          this.icon.setAttribute('title', 'Prompt Library - Access your saved prompts');
          this.icon.setAttribute('data-state', 'closed');
          
          this.icon.innerHTML = `
            <div class="flex items-center min-w-0 font-medium gap-1.5 justify-center">
              <div class="flex shrink-0 items-center justify-center size-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10,9 9,9 8,9"/>
                </svg>
              </div>
            </div>
          `;
          
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
            } catch (e) {
              // Continue with next selector
            }
          }
          
          if (insertPosition) {
            try {
              buttonContainer.insertBefore(this.icon, insertPosition);
            } catch (e) {
              buttonContainer.appendChild(this.icon);
            }
          } else {
            // Fallback: insert at the end
            buttonContainer.appendChild(this.icon);
          }
          
        } else {
          // Sanofi Concierge styling
          this.icon = document.createElement('div');
          this.icon.className = `prompt-library-integrated-icon-${this.instanceId} text-pulse-text-subtle hover:bg-elements-neutrals-100 hover:dark:bg-elements-neutrals-700 flex h-8 w-8 flex-col items-center justify-center px-1 hover:rounded-lg cursor-pointer`;
          this.icon.innerHTML = `
            <span class="material-icons-round _icon_mqc2e_1" style="font-size: 1.5rem;">
              <span aria-hidden="true">library_books</span>
            </span>
          `;
          this.icon.setAttribute('title', 'Prompt Library - Access your saved prompts');
          
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
      // Last resort: try creating a simple floating icon
      try {
        this.createFloatingIcon(textarea);
      } catch (fallbackError) {
        // Silent failure
      }
    }
  }

  createFloatingIcon(textarea) {
    // Create icon element
    this.icon = document.createElement('div');
    this.icon.className = `prompt-library-icon-${this.instanceId}`;
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
      const outsideClickHandler = (e) => {
        if (this.promptSelector && 
            !this.promptSelector.contains(e.target) && 
            this.icon && 
            !this.icon.contains(e.target)) {
          this.promptSelector.remove();
          this.promptSelector = null;
          document.removeEventListener('click', outsideClickHandler);
        }
      };
      document.addEventListener('click', outsideClickHandler);
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
      
      // Try setting React input value directly
      const valueSetter = Object.getOwnPropertyDescriptor(textarea, 'value')?.set || 
                         Object.getOwnPropertyDescriptor(Object.getPrototypeOf(textarea), 'value')?.set ||
                         Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      
      if (valueSetter && textarea.tagName === 'TEXTAREA') {
        valueSetter.call(textarea, content);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      // Try manual typing simulation
      setTimeout(() => {
        textarea.focus();
        document.execCommand('selectAll');
        document.execCommand('insertText', false, content);
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

// Initialize the injector with proper cleanup
const promptLibraryInstance = new PromptLibraryInjector();

// Cleanup on page unload to prevent cross-tab interference
window.addEventListener('beforeunload', () => {
  if (promptLibraryInstance) {
    promptLibraryInstance.cleanup();
  }
});

// Also cleanup on page hide (when switching tabs)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && promptLibraryInstance) {
    // Don't fully cleanup, just remove UI elements
    if (promptLibraryInstance.promptSelector) {
      try {
        promptLibraryInstance.promptSelector.remove();
        promptLibraryInstance.promptSelector = null;
      } catch (e) {
        // Silent cleanup
      }
    }
  }
});