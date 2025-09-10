/**
 * Element Picker Module
 * Provides visual element selection functionality for custom positioning
 */

import { debug, info } from '../utils/logger';

// Interface for audit log details
interface AuditDetails {
  reason?: string;
  selector?: string;
  domain?: string;
  elementType?: string;
  secure?: boolean;
  url?: string;
  timestamp?: string;
  [key: string]: unknown; // Allow additional properties while maintaining type safety
}

// Sensitive field selectors that should be blocked
const BLOCKED_SELECTORS = [
  'input[type="password"]',
  'input[type="hidden"]',
  'input[type="tel"]',
  'input[type="email"]',
  'input[type="ssn"]',
  'input[data-sensitive]',
  'input[data-private]',
  '[autocomplete*="cc-"]',           // Credit card fields
  '[autocomplete*="password"]',       // Password managers
  '[autocomplete*="transaction-"]',   // Payment fields
  '[autocomplete*="one-time-code"]',  // 2FA codes
  '.sensitive',                        // Custom sensitive class
  '[data-testid*="password"]',        // Common test IDs
  '[id*="cvv"]',                      // CVV fields
  '[id*="pin"]',                      // PIN fields
  '[name*="creditcard"]',             // Credit card by name
  '[name*="ssn"]',                    // SSN by name
  '[aria-label*="password"]',         // Accessibility labels
  'iframe'                             // Prevent iframe interaction
];

// Sensitive domain patterns
const SENSITIVE_DOMAINS = [
  /\.bank/i,
  /banking\./i,
  /\.gov/i,
  /healthcare/i,
  /medical/i,
  /paypal\./i,
  /stripe\./i,
  /square\./i,
  /venmo\./i,
  /coinbase\./i,
  /kraken\./i,
  /binance\./i,
  /\.tax/i,
  /irs\./i,
  /insurance/i,
  /fidelity\./i,
  /vanguard\./i,
  /schwab\./i,
  /wellsfargo\./i,
  /chase\./i,
  /bankofamerica\./i,
  /citibank\./i
];

export class ElementPicker {
  private isActive = false;
  private overlay: HTMLDivElement | null = null;
  private highlightBox: HTMLDivElement | null = null;
  private infoBox: HTMLDivElement | null = null;
  private currentElement: Element | null = null;
  private originalCursor: string = '';
  private listeners: Map<string, EventListener> = new Map();
  private auditLog: Array<{
    timestamp: number;
    action: string;
    details: AuditDetails;
  }> = [];

  constructor() {
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
  }

  /**
   * Check if an element is blocked for security reasons
   */
  private isElementBlocked(element: Element): { blocked: boolean; reason?: string } {
    // Check if element matches blocked selectors
    for (const selector of BLOCKED_SELECTORS) {
      try {
        if (element.matches(selector)) {
          return {
            blocked: true,
            reason: `Sensitive field detected: ${selector}`
          };
        }
      } catch (error) {
        // Invalid selector, skip
        debug('[ElementPicker] Invalid selector:', selector, error);
        continue;
      }
    }

    // Check if element is within a blocked container
    try {
      const sensitiveParent = element.closest(BLOCKED_SELECTORS.join(','));
      if (sensitiveParent) {
        return {
          blocked: true,
          reason: 'Element is within a sensitive container'
        };
      }
    } catch (error) {
      // Invalid selector combination, continue with individual checks
      debug('[ElementPicker] Error checking parent containers:', error);
    }

    // Check element attributes for sensitive patterns
    const attributes = element.getAttributeNames();
    const sensitivePatterns = /password|secret|token|key|credential|private|ssn|credit|card|cvv|pin|bank|account/i;
    
    for (const attr of attributes) {
      if (sensitivePatterns.test(attr)) {
        return {
          blocked: true,
          reason: `Sensitive attribute detected: ${attr}`
        };
      }
      
      const attrValue = element.getAttribute(attr);
      if (attrValue && sensitivePatterns.test(attrValue)) {
        return {
          blocked: true,
          reason: `Sensitive attribute value detected: ${attr}="${attrValue}"`
        };
      }
    }

    // Check placeholder text for sensitive patterns
    const placeholder = element.getAttribute('placeholder');
    if (placeholder && sensitivePatterns.test(placeholder)) {
      return {
        blocked: true,
        reason: 'Sensitive placeholder text detected'
      };
    }

    // Check ARIA labels for sensitive patterns
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel && sensitivePatterns.test(ariaLabel)) {
      return {
        blocked: true,
        reason: 'Sensitive ARIA label detected'
      };
    }

    return { blocked: false };
  }

  /**
   * Check if current domain is sensitive or requires confirmation
   */
  private isDomainSensitive(): { sensitive: boolean; requiresConfirmation: boolean } {
    const hostname = window.location.hostname;
    const href = window.location.href;

    // Check against sensitive domain patterns
    for (const pattern of SENSITIVE_DOMAINS) {
      if (pattern.test(hostname) || pattern.test(href)) {
        return { sensitive: true, requiresConfirmation: true };
      }
    }

    // Check for HTTPS and common sensitive indicators
    if (window.location.protocol === 'https:') {
      const sensitiveIndicators = /login|signin|checkout|payment|account|profile|banking|financial/i;
      if (sensitiveIndicators.test(href)) {
        return { sensitive: false, requiresConfirmation: true };
      }
    }

    return { sensitive: false, requiresConfirmation: false };
  }

  /**
   * Show warning message for blocked elements
   */
  private showWarning(message: string, element: Element): boolean {
    // Create warning overlay
    const warning = document.createElement('div');
    warning.id = 'mpm-security-warning';
    warning.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #dc2626;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      z-index: 2147483647;
      font-size: 14px;
      font-family: 'Segoe UI', system-ui, sans-serif;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      max-width: 400px;
      text-align: center;
      border: 2px solid #b91c1c;
    `;
    warning.textContent = message;
    document.body.appendChild(warning);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (warning.parentNode) {
        warning.remove();
      }
    }, 3000);

    // Log attempt for audit
    this.logAudit('blocked_selection', {
      reason: message,
      selector: this.generateSelector(element),
      domain: window.location.hostname
    });

    return false; // Prevent selection
  }

  /**
   * Log audit events for security monitoring
   */
  private logAudit(action: string, details: AuditDetails): void {
    const entry = {
      timestamp: Date.now(),
      action,
      details: {
        ...details,
        url: window.location.href,
        timestamp: new Date().toISOString()
      }
    };

    this.auditLog.push(entry);

    // Store last 50 entries in session storage for debugging
    if (this.auditLog.length > 50) {
      this.auditLog.shift();
    }

    try {
      sessionStorage.setItem(
        'element-picker-audit',
        JSON.stringify(this.auditLog)
      );
    } catch (error) {
      // Session storage might be full or disabled
      debug('[ElementPicker] Audit log storage failed:', error);
    }

    // Log to console in debug mode
    if (localStorage.getItem('prompt-library-debug') === 'true') {
      console.log(`[ElementPicker Audit] ${action}:`, details);
    }
  }

  /**
   * Get element depth in DOM tree
   */
  private getElementDepth(element: Element): number {
    let depth = 0;
    let current = element.parentElement;
    while (current && depth < 50) { // Prevent infinite loops
      depth++;
      current = current.parentElement;
    }
    return depth;
  }

  /**
   * Check if element is visible
   */
  private isElementVisible(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0'
    );
  }

  /**
   * Activate the element picker
   */
  activate(): void {
    if (this.isActive) {return;}
    
    info('[ElementPicker] Activating element picker mode');
    this.isActive = true;
    
    // Store original cursor
    this.originalCursor = document.body.style.cursor;
    
    // Create UI elements
    this.createOverlay();
    this.createHighlightBox();
    this.createInfoBox();
    
    // Add event listeners
    this.attachEventListeners();
    
    // Set cursor style
    document.body.style.cursor = 'crosshair';
  }

  /**
   * Deactivate the element picker
   */
  deactivate(): void {
    if (!this.isActive) {return;}
    
    info('[ElementPicker] Deactivating element picker mode');
    this.isActive = false;
    
    // Remove UI elements
    this.removeUI();
    
    // Remove event listeners
    this.detachEventListeners();
    
    // Restore cursor
    document.body.style.cursor = this.originalCursor;
    
    // Clear current element
    this.currentElement = null;
  }

  /**
   * Create overlay for visual feedback
   */
  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.id = 'mpm-element-picker-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2147483646;
    `;
    document.body.appendChild(this.overlay);
  }

  /**
   * Create highlight box for hovering elements
   */
  private createHighlightBox(): void {
    this.highlightBox = document.createElement('div');
    this.highlightBox.id = 'mpm-element-highlight';
    this.highlightBox.style.cssText = `
      position: absolute;
      border: 2px solid #7c3aed;
      background: rgba(124, 58, 237, 0.1);
      pointer-events: none;
      transition: all 0.1s ease;
      z-index: 2147483647;
      box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.3);
    `;
    
    if (this.overlay) {
      this.overlay.appendChild(this.highlightBox);
    }
  }

  /**
   * Create info box to show element details
   */
  private createInfoBox(): void {
    this.infoBox = document.createElement('div');
    this.infoBox.id = 'mpm-element-info';
    this.infoBox.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #1f2937;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      max-width: 400px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      z-index: 2147483647;
      pointer-events: none;
    `;
    
    this.infoBox.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px; color: #a78bfa;">Select an element</div>
      <div style="color: #9ca3af; font-size: 12px;">Click to select • ESC to cancel</div>
    `;
    
    document.body.appendChild(this.infoBox);
  }

  /**
   * Remove all UI elements
   */
  private removeUI(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    
    if (this.highlightBox) {
      this.highlightBox = null;
    }
    
    if (this.infoBox) {
      this.infoBox.remove();
      this.infoBox = null;
    }
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Use capture phase to intercept events before page handlers
    const boundHandleMouseMove = (e: MouseEvent) => { this.handleMouseMove(e); };
    const boundHandleClick = (e: MouseEvent) => { this.handleClick(e); };
    const boundHandleKeyDown = (e: KeyboardEvent) => { this.handleKeyDown(e); };
    const boundHandleMessage = (message: { source?: string; type?: string }, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => { this.handleMessage(message, sender, sendResponse); };
    
    document.addEventListener('mousemove', boundHandleMouseMove, true);
    document.addEventListener('click', boundHandleClick, true);
    document.addEventListener('keydown', boundHandleKeyDown, true);
    chrome.runtime.onMessage.addListener(boundHandleMessage);
    
    // Store listeners for cleanup
    this.listeners.set('mousemove', boundHandleMouseMove);
    this.listeners.set('click', boundHandleClick);
    this.listeners.set('keydown', boundHandleKeyDown);
    this.listeners.set('message', boundHandleMessage);
  }

  /**
   * Detach event listeners
   */
  private detachEventListeners(): void {
    const mouseMoveListener = this.listeners.get('mousemove');
    const clickListener = this.listeners.get('click');
    const keyDownListener = this.listeners.get('keydown');
    const messageListener = this.listeners.get('message');
    
    if (mouseMoveListener) {document.removeEventListener('mousemove', mouseMoveListener, true);}
    if (clickListener) {document.removeEventListener('click', clickListener, true);}
    if (keyDownListener) {document.removeEventListener('keydown', keyDownListener, true);}
    if (messageListener) {chrome.runtime.onMessage.removeListener(messageListener as (message: { source?: string; type?: string }, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => void);}
    
    this.listeners.clear();
  }

  /**
   * Handle mouse movement
   */
  private handleMouseMove(event: MouseEvent): void {
    if (!this.isActive) {return;}
    
    // Prevent default to avoid interference
    event.stopPropagation();
    
    const element = document.elementFromPoint(event.clientX, event.clientY);
    
    if (element && element !== this.currentElement) {
      this.currentElement = element;
      
      // Check if element is blocked for visual feedback
      const blockCheck = this.isElementBlocked(element);
      
      this.highlightElement(element, blockCheck.blocked);
      this.updateInfoBox(element, blockCheck);
    }
  }

  /**
   * Handle click to select element
   */
  private handleClick(event: MouseEvent): void {
    if (!this.isActive) {return;}
    
    // Prevent default and stop propagation
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    if (this.currentElement) {
      // Check if element is blocked
      const blockCheck = this.isElementBlocked(this.currentElement);
      if (blockCheck.blocked) {
        this.showWarning(
          `Cannot select this element: ${blockCheck.reason ?? 'Unknown reason'}. ` +
          `For security reasons, sensitive fields cannot be selected.`,
          this.currentElement
        );
        return;
      }

      // Check if domain requires special handling
      const domainCheck = this.isDomainSensitive();
      if (domainCheck.sensitive) {
        this.showWarning(
          'Warning: You are on a sensitive website. ' +
          'Element picker has been disabled for security reasons.',
          this.currentElement
        );
        this.deactivate();
        return;
      }

      if (domainCheck.requiresConfirmation) {
        // Show confirmation but allow if user has explicitly triggered picker
        this.showWarning(
          'Caution: This appears to be a sensitive page. ' +
          'Please ensure you are not selecting private information.',
          this.currentElement
        );
      }

      // Proceed with safe selection
      const selector = this.generateSelector(this.currentElement);
      const elementInfo = this.getElementInfo(this.currentElement);
      
      debug('[ElementPicker] Element selected:', { selector, elementInfo });
      
      // Log successful selection
      this.logAudit('element_selected', {
        selector,
        elementType: this.currentElement.tagName.toLowerCase(),
        domain: window.location.hostname,
        secure: !domainCheck.requiresConfirmation && !domainCheck.sensitive
      });
      
      // Send selection to background script
      void chrome.runtime.sendMessage({
        type: 'ELEMENT_SELECTED',
        data: {
          selector,
          elementType: this.currentElement.tagName.toLowerCase(),
          elementInfo,
          hostname: window.location.hostname
        }
      });
      
      // Deactivate picker
      this.deactivate();
    }
  }

  /**
   * Handle keyboard events
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.isActive) {return;}
    
    // ESC to cancel
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      
      void chrome.runtime.sendMessage({ type: 'PICKER_CANCELLED' });
      this.deactivate();
    }
  }

  /**
   * Handle messages from background script
   */
  private handleMessage(message: { source?: string; type?: string }): void {
    if (message.source !== 'background') {return;}
    
    switch (message.type) {
      case 'ACTIVATE_ELEMENT_PICKER':
        this.activate();
        break;
      case 'DEACTIVATE_ELEMENT_PICKER':
        this.deactivate();
        break;
    }
  }

  /**
   * Highlight the given element
   */
  private highlightElement(element: Element, isBlocked = false): void {
    if (!this.highlightBox) {return;}
    
    const rect = element.getBoundingClientRect();
    
    this.highlightBox.style.left = `${String(rect.left + window.scrollX)}px`;
    this.highlightBox.style.top = `${String(rect.top + window.scrollY)}px`;
    this.highlightBox.style.width = `${String(rect.width)}px`;
    this.highlightBox.style.height = `${String(rect.height)}px`;
    
    // Update highlight style based on block status
    if (isBlocked) {
      this.highlightBox.style.backgroundColor = 'rgba(239, 68, 68, 0.3)'; // Red for blocked
      this.highlightBox.style.borderColor = '#dc2626';
      this.highlightBox.style.cursor = 'not-allowed';
      this.highlightBox.style.boxShadow = '0 0 0 1px rgba(220, 38, 38, 0.5)';
    } else {
      this.highlightBox.style.backgroundColor = 'rgba(124, 58, 237, 0.1)'; // Purple for allowed
      this.highlightBox.style.borderColor = '#7c3aed';
      this.highlightBox.style.cursor = 'pointer';
      this.highlightBox.style.boxShadow = '0 0 0 1px rgba(124, 58, 237, 0.3)';
    }
  }

  /**
   * Update info box with element details
   */
  private updateInfoBox(element: Element, blockCheck?: { blocked: boolean; reason?: string }): void {
    if (!this.infoBox) {return;}
    
    const selector = this.generateSelector(element);
    const tagName = element.tagName.toLowerCase();
    const className = element.className ? `.${element.className.split(' ').join('.')}` : '';
    const id = element.id ? `#${element.id}` : '';
    
    // Clear any existing warning
    const existingWarning = this.infoBox.querySelector('.warning');
    if (existingWarning) {
      existingWarning.remove();
    }
    
    let warningSection = '';
    if (blockCheck?.blocked) {
      warningSection = `
        <div class="warning" style="color: #ef4444; font-size: 12px; margin-bottom: 8px; padding: 6px; background: rgba(239, 68, 68, 0.1); border-radius: 4px; border: 1px solid #dc2626;">
          <span style="font-weight: 600;">⚠️ Sensitive Field</span><br>
          <span style="font-size: 11px;">${blockCheck.reason || 'Cannot select this element'}</span>
        </div>
      `;
    }
    
    this.infoBox.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px; color: #a78bfa;">Element Info</div>
      ${warningSection}
      <div style="margin-bottom: 2px;">
        <span style="color: #6b7280;">Type:</span> 
        <span style="color: #fbbf24; font-family: monospace;">${tagName}</span>
      </div>
      ${id ? `
      <div style="margin-bottom: 2px;">
        <span style="color: #6b7280;">ID:</span> 
        <span style="color: #34d399; font-family: monospace;">${id}</span>
      </div>` : ''}
      ${className ? `
      <div style="margin-bottom: 2px;">
        <span style="color: #6b7280;">Class:</span> 
        <span style="color: #60a5fa; font-family: monospace; word-break: break-all;">${className}</span>
      </div>` : ''}
      <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #374151;">
        <span style="color: #6b7280;">Selector:</span>
        <div style="color: #e5e7eb; font-family: monospace; font-size: 11px; margin-top: 2px; word-break: break-all;">
          ${selector}
        </div>
      </div>
      <div style="color: #9ca3af; font-size: 11px; margin-top: 8px;">
        ${blockCheck?.blocked ? 'Element blocked for security • ESC to cancel' : 'Click to select • ESC to cancel'}
      </div>
    `;
  }

  /**
   * Escape special characters in CSS identifiers
   */
  private escapeCSSIdentifier(identifier: string): string {
    // CSS identifier escape rules
    return identifier.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
  }

  /**
   * Generate a unique selector for an element
   */
  private generateSelector(element: Element): string {
    // Try ID first
    if (element.id) {
      // Escape special characters in ID
      return `#${this.escapeCSSIdentifier(element.id)}`;
    }
    
    // Try data attributes as they're often more stable
    const dataAttrs = Array.from(element.attributes)
      .filter(attr => attr.name.startsWith('data-'))
      .map(attr => `[${attr.name}="${attr.value}"]`);
    
    if (dataAttrs.length > 0) {
      const dataSelector = `${element.tagName.toLowerCase()}${dataAttrs[0]}`;
      try {
        const matches = document.querySelectorAll(dataSelector);
        if (matches.length === 1) {
          return dataSelector;
        }
      } catch {
        // Invalid selector, continue
      }
    }
    
    // Try simple class names (avoid complex ones with special characters)
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/)
        .filter(c => c && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c)) // Only simple class names
        .slice(0, 2); // Limit to first 2 classes to avoid overly complex selectors
      
      if (classes.length > 0) {
        const classSelector = `${element.tagName.toLowerCase()}.${classes.join('.')}`;
        try {
          const matches = document.querySelectorAll(classSelector);
          if (matches.length === 1) {
            return classSelector;
          }
        } catch {
          // Invalid selector, continue
        }
      }
    }
    
    // Generate path-based selector with nth-child
    const path: string[] = [];
    let current: Element | null = element;
    
    while (current && current !== document.body && path.length < 5) { // Limit depth
      let selector = current.tagName.toLowerCase();
      
      if (current.id && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(current.id)) {
        // Only use ID if it's a simple identifier
        selector = `#${this.escapeCSSIdentifier(current.id)}`;
        path.unshift(selector);
        break;
      }
      
      // Add nth-child for specificity
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(el => el.tagName === current.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${String(index)})`;
        }
      }
      
      path.unshift(selector);
      current = current.parentElement;
    }
    
    // If path is too generic, add more specificity
    if (path.length === 1 && path[0] === element.tagName.toLowerCase()) {
      const parent = element.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(element) + 1;
        path[0] += `:nth-child(${String(index)})`;
      }
    }
    
    return path.join(' > ');
  }

  /**
   * Get minimal information about an element (no sensitive data extraction)
   */
  private getElementInfo(element: Element): Record<string, unknown> {
    const rect = element.getBoundingClientRect();
    const domainSecurity = this.isDomainSensitive();
    
    return {
      // Only structural information, no content
      tagName: element.tagName.toLowerCase(),
      selector: this.generateSelector(element),
      position: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      },
      // Add safe metadata only
      hasId: !!element.id,
      hasClasses: !!element.className,
      depth: this.getElementDepth(element),
      isVisible: this.isElementVisible(element),
      // Security context
      blocked: this.isElementBlocked(element).blocked,
      securityLevel: domainSecurity.sensitive ? 'high' : 
                    domainSecurity.requiresConfirmation ? 'medium' : 'low'
    };
  }
}

// Create singleton instance
let elementPickerInstance: ElementPicker | null = null;

export function getElementPicker(): ElementPicker {
  if (!elementPickerInstance) {
    elementPickerInstance = new ElementPicker();
  }
  return elementPickerInstance;
}

// Listen for activation messages
chrome.runtime.onMessage.addListener((message: { source?: string; type?: string }) => {
  if (message.source === 'background') {
    const picker = getElementPicker();
    
    switch (message.type) {
      case 'ACTIVATE_ELEMENT_PICKER':
        picker.activate();
        break;
      case 'DEACTIVATE_ELEMENT_PICKER':
        picker.deactivate();
        break;
    }
  }
});