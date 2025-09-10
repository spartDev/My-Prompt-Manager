/**
 * Background script for Chrome extension
 * Handles message passing, content script injection, and coordination between popup and content scripts
 */

// Track active element picker sessions
const activePickerSessions = new Map<number, { tabId: number; windowId: number }>();

/**
 * Content script injection controller
 * Handles programmatic injection of content scripts based on site enablement
 */
class ContentScriptInjector {
  private injectedTabs: Set<number> = new Set();
  private injectionPromises: Map<number, Promise<void>> = new Map();

  /**
   * Inject content script if needed for the given tab
   */
  async injectIfNeeded(tabId: number): Promise<void> {
    // Avoid concurrent injections for the same tab
    if (this.injectionPromises.has(tabId)) {
      return this.injectionPromises.get(tabId);
    }

    const injectionPromise = this._injectIfNeededInternal(tabId);
    this.injectionPromises.set(tabId, injectionPromise);

    try {
      await injectionPromise;
    } finally {
      this.injectionPromises.delete(tabId);
    }
  }

  private async _injectIfNeededInternal(tabId: number): Promise<void> {
    if (this.injectedTabs.has(tabId)) {
      return;
    }

    let hostname = 'unknown';
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url) {
        return;
      }

      const url = new URL(tab.url);
      hostname = url.hostname;

      // Don't inject on extension or browser pages
      if (this.isRestrictedUrl(tab.url)) {
        return;
      }

      // Check if site should have content script
      const shouldInject = await this.shouldInjectForSite(hostname);
      if (shouldInject) {
        await this.injectContentScript(tabId);
        this.injectedTabs.add(tabId);
      } else {
        // Injection skipped: site not enabled in settings or does not meet injection criteria
      }
    } catch {
      // Silently skip injection failures - they're handled gracefully by the caller
    }
  }

  /**
   * Check if URL is restricted (extension pages, chrome:// URLs, etc.)
   */
  private isRestrictedUrl(url: string): boolean {
    const restrictedPatterns = [
      'chrome://',
      'chrome-extension://',
      'moz-extension://',
      'edge-extension://',
      'about:',
      'data:',
      'file://',
      'ftp://',
    ];

    return restrictedPatterns.some(pattern => url.startsWith(pattern));
  }

  /**
   * Determine if content script should be injected for the given hostname
   */
  private async shouldInjectForSite(hostname: string): Promise<boolean> {
    try {
      // First, check if we have the required permissions for this hostname
      const hasPermission = await this.hasPermissionForHostname(hostname);
      if (!hasPermission) {
        return false;
      }

      const settings = await chrome.storage.local.get(['promptLibrarySettings']);
      const promptLibrarySettings = settings.promptLibrarySettings as {
        enabledSites?: string[];
        customSites?: Array<{ hostname: string; enabled: boolean }>;
      } | undefined;
      
      if (!promptLibrarySettings) {
        return ['claude.ai', 'chatgpt.com', 'www.perplexity.ai'].includes(hostname);
      }
      
      // Get enabled sites and custom sites from settings
      const enabledSites = promptLibrarySettings.enabledSites || ['claude.ai', 'chatgpt.com', 'www.perplexity.ai'];
      const customSites = promptLibrarySettings.customSites || [];

      // Check default enabled sites
      if (enabledSites.includes(hostname)) {
        return true;
      }

      // Check custom sites
      const customSite = customSites.find((site) => 
        site.hostname === hostname && site.enabled
      );
      if (customSite) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('[ContentScriptInjector] Error checking site enablement:', error);
      return false;
    }
  }

  /**
   * Check if the extension has permission for the given hostname
   */
  private async hasPermissionForHostname(hostname: string): Promise<boolean> {
    try {
      const origins = [
        `https://${hostname}/*`,
        `http://${hostname}/*`
      ];

      // Check if we have permission for any of the origins
      for (const origin of origins) {
        const hasPermission = await chrome.permissions.contains({
          origins: [origin]
        });
        if (hasPermission) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('[ContentScriptInjector] Error checking permissions for', hostname, ':', error);
      return false;
    }
  }

  /**
   * Test if we can actually inject into the specific tab (more robust than just checking permissions)
   */
  private async canInjectIntoTab(tabId: number): Promise<boolean> {
    try {
      // Try to execute a minimal script to test access
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => { return true; } // Minimal function that just returns true
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Inject the content script into the specified tab
   */
  private async injectContentScript(tabId: number): Promise<void> {
    try {
      // Get tab info for permission double-check
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url) {
        throw new Error('Tab has no URL');
      }
      
      const hostname = new URL(tab.url).hostname;
      
      // Double-check permissions right before injection
      const hasPermission = await this.hasPermissionForHostname(hostname);
      if (!hasPermission) {
        // This is expected for most sites - log at debug level only
        const errorMessage = `No permission to inject into ${hostname}`;

        throw new Error(errorMessage);
      }
      
      // More robust check: test if we can actually inject into this specific tab
      const canInject = await this.canInjectIntoTab(tabId);
      if (!canInject) {
        throw new Error(`Cannot inject into tab ${tabId.toString()} for ${hostname} - tab access denied`);
      }

      // First check if already injected by testing for marker
      const isAlreadyInjected = await this.isContentScriptInjected(tabId);
      if (isAlreadyInjected) {
        this.injectedTabs.add(tabId);
        return;
      }

      // Then inject the main content script
      const contentScriptFile = await this.getContentScriptFilename();
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [contentScriptFile]
      });

    } catch (error) {
      const hostname = await this.getTabHostname(tabId);
      
      // Classify error types
      if (error instanceof Error && error.message.includes('No permission to inject into')) {
        // This is expected for most sites - suppress error logging
        // Debug logging removed to avoid console statement linting warnings
      } else {
        // This is an unexpected injection failure - always log as error
        console.error('[ContentScriptInjector] Unexpected injection failure for tab', tabId, 'hostname:', hostname, ':', error);
      }
      
      throw error;
    }
  }

  /**
   * Check if content script is already injected in the tab
   */
  async isContentScriptInjected(tabId: number): Promise<boolean> {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          return (window as { __promptLibraryInjected?: boolean }).__promptLibraryInjected === true;
        }
      });
      return result.result === true;
    } catch {
      return false;
    }
  }

  /**
   * Force inject content script (used by activeTab clicks)
   */
  async forceInjectContentScript(tabId: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Remove from injected tabs to force re-injection
      this.injectedTabs.delete(tabId);
      await this.injectContentScript(tabId);
      this.injectedTabs.add(tabId);
      return { success: true };
    } catch (error) {
      const hostname = await this.getTabHostname(tabId);
      
      // Handle different error types appropriately
      if (error instanceof Error && error.message.includes('No permission to inject into')) {
        // Permission error - this might be expected, suppress debug logging
        return { 
          success: false, 
          error: `Permission required for ${hostname}. Please grant permission to use the extension on this site.`
        };
      } else {
        // Unexpected error - always log
        console.error('[ContentScriptInjector] Force injection failed for tab', tabId, 'hostname:', hostname, ':', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to inject content script'
        };
      }
    }
  }

  /**
   * Clean up injection tracking for a tab
   */
  cleanup(tabId: number): void {
    this.injectedTabs.delete(tabId);
    this.injectionPromises.delete(tabId);
  }

  /**
   * Get the correct content script filename from the build manifest
   */
  private async getContentScriptFilename(): Promise<string> {
    try {
      // Try to fetch the build manifest to get the correct filename
      const manifestResponse = await fetch(chrome.runtime.getURL('.vite/manifest.json'));
      const manifest = await manifestResponse.json() as Record<string, { file?: string } | undefined>;
      
      // Look for the content script entry
      const contentEntry = manifest['src/content/index.ts'];
      if (contentEntry?.file) {
        return contentEntry.file;
      }
      
      // Fallback: try to find any file matching content-*.js pattern
      const contentFiles = Object.values(manifest)
        .filter((entry): entry is { file: string } => 
          Boolean(entry?.file && entry.file.includes('content-') && entry.file.endsWith('.js'))
        )
        .map(entry => entry.file);
      
      if (contentFiles.length > 0) {
        return contentFiles[0];
      }
      
      throw new Error('Content script file not found in build manifest');
    } catch {
      // Ultimate fallback - try common patterns
      const fallbackFiles = [
        'assets/content.js',
        'src/content/index.js',
        'content.js'
      ];
      
      // Try each fallback in order
      for (const file of fallbackFiles) {
        try {
          await fetch(chrome.runtime.getURL(file));
          return file;
        } catch {
          // File doesn't exist, try next
          continue;
        }
      }
      
      throw new Error('Unable to locate content script file');
    }
  }

  /**
   * Get injection status for debugging
   */
  getInjectionStatus(): { injectedTabs: number[]; activePromises: number[] } {
    return {
      injectedTabs: Array.from(this.injectedTabs),
      activePromises: Array.from(this.injectionPromises.keys())
    };
  }

  /**
   * Check if debug mode is enabled
   */
  private isDebugMode(): boolean {
    // Debug mode is disabled in production for clean console output
    // Can be enabled during development if needed
    return false;
  }

  /**
   * Get hostname for a tab (helper for error reporting)
   */
  private async getTabHostname(tabId: number): Promise<string> {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url) {
        return new URL(tab.url).hostname;
      }
    } catch {
      // Tab might have been closed or is inaccessible
    }
    return 'unknown';
  }
}

// Create global injector instance
const injector = new ContentScriptInjector();

// Interface mode types
type InterfaceMode = 'popup' | 'sidepanel';

// ===============================
// TAB LIFECYCLE MANAGEMENT
// ===============================

// Inject when tab is updated (navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    void injector.injectIfNeeded(tabId);
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  injector.cleanup(tabId);
  if (activePickerSessions.has(tabId)) {
    activePickerSessions.delete(tabId);
  }
});

// Inject when extension icon is clicked (activeTab permission)
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    void (async () => {
      try {
        await injector.forceInjectContentScript(tab.id);
        // Content script injected via activeTab
      } catch (error) {
        console.error('[Background] Failed to inject via activeTab:', error);
      }
    })();
  }
});

// Initialize the extension on service worker start
void (async () => {
  try {
    const mode = await getInterfaceMode();
    await updateActionBehavior(mode);
  } catch (error) {
    console.error('[Background] Error during initial setup:', error);
  }
})();

// Track the picker window
let pickerWindowId: number | null = null;
let originalTabId: number | null = null;

// Message types for element picker and injection
interface BackgroundMessage {
  type: 'START_ELEMENT_PICKER' | 'STOP_ELEMENT_PICKER' | 'ELEMENT_SELECTED' | 'PICKER_CANCELLED' | 'OPEN_PICKER_WINDOW' | 'GET_INTERFACE_MODE' | 'REQUEST_INJECTION' | 'SETTINGS_UPDATED' | 'REQUEST_PERMISSION';
  data?: {
    selector?: string;
    elementType?: string;
    elementInfo?: Record<string, unknown>;
    hostname?: string;
    tabId?: number;
    origins?: string[];
    settings?: unknown;
  };
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
  switch (message.type) {
    case 'START_ELEMENT_PICKER':
      void handleStartElementPicker(message.data?.tabId, sender, sendResponse);
      break;
      
    case 'OPEN_PICKER_WINDOW':
      void handleOpenPickerWindow(message.data?.tabId, sendResponse);
      break;

    case 'ELEMENT_SELECTED':
      void handleElementSelected(message.data, sender, sendResponse);
      break;

    case 'STOP_ELEMENT_PICKER':
    case 'PICKER_CANCELLED':
      void handleStopElementPicker(undefined, sender, sendResponse);
      break;

    case 'GET_INTERFACE_MODE':
      void handleGetInterfaceMode(sendResponse);
      break;

    case 'REQUEST_INJECTION':
      void handleRequestInjection(message.data?.tabId, sendResponse);
      break;

    case 'SETTINGS_UPDATED':
      void handleSettingsUpdated(message.data?.settings, sendResponse);
      break;

    case 'REQUEST_PERMISSION':
      void handleRequestPermission(message.data?.origins || [], sendResponse);
      break;

    default:
      break;
  }

  // Return true to indicate async response
  return true;
});

/**
 * Handle manual injection requests from popup/side panel
 */
async function handleRequestInjection(tabId: number | undefined, sendResponse: (response?: { success: boolean; error?: string }) => void) {
  try {
    let targetTabId = tabId;
    
    if (!targetTabId) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0 && tabs[0]?.id) {
        targetTabId = tabs[0].id;
      }
    }
    
    if (!targetTabId) {
      sendResponse({ success: false, error: 'No valid tab found' });
      return;
    }

    await injector.forceInjectContentScript(targetTabId);
    sendResponse({ success: true });
  } catch (error) {
    console.error('[Background] Manual injection failed:', error);
    sendResponse({ success: false, error: String(error) });
  }
}

/**
 * Handle settings updates that might affect injection
 */
async function handleSettingsUpdated(settings: unknown, sendResponse: (response?: { success: boolean }) => void) {
  try {
    const tabs = await chrome.tabs.query({});
    
    // Filter tabs that might need injection to avoid unnecessary checks
    const relevantTabs = tabs.filter(tab => {
      if (!tab.id || !tab.url) {
        return false;
      }
      
      try {
        const url = new URL(tab.url);
        const hostname = url.hostname;
        
        // Quick hostname check - only process tabs that could potentially need injection
        return ['claude.ai', 'chatgpt.com', 'www.perplexity.ai'].includes(hostname) ||
               hostname.includes('claude') || hostname.includes('openai') || hostname.includes('perplexity');
      } catch {
        return false; // Invalid URL
      }
    });
    
    // Process relevant tabs concurrently for better performance
    await Promise.all(
      relevantTabs.map(async (tab) => {
        try {
          if (tab.id && tab.url) {
            const isInjected = await injector.isContentScriptInjected(tab.id);
            if (!isInjected) {
              await injector.injectIfNeeded(tab.id);
            }
          }
        } catch (error) {
          // Log error but don't fail the entire operation for individual tab failures
          const tabId = tab.id?.toString() || 'unknown';
          console.error(`[Background] Failed to process tab ${tabId} during settings update:`, error);
        }
      })
    );
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('[Background] Settings update handling failed:', error);
    sendResponse({ success: false });
  }
}

/**
 * Handle dynamic permission requests for custom sites
 */
async function handleRequestPermission(origins: string[], sendResponse: (response?: { success: boolean; error?: string }) => void) {
  try {
    const granted = await chrome.permissions.request({
      origins: origins
    });

    if (granted) {
      // Store the permission grant for tracking
      const settings = await chrome.storage.local.get(['grantedPermissions']);
      const grantedPermissions = (settings.grantedPermissions as string[] | undefined) || [];
      
      for (const origin of origins) {
        if (!grantedPermissions.includes(origin)) {
          grantedPermissions.push(origin);
        }
      }
      
      await chrome.storage.local.set({ grantedPermissions });

      // Immediately inject into any matching tabs
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id && tab.url) {
          const url = new URL(tab.url);
          const matchesOrigin = origins.some(origin => {
            const originUrl = new URL(origin);
            return url.hostname === originUrl.hostname;
          });
          
          if (matchesOrigin) {
            await injector.injectIfNeeded(tab.id);
          }
        }
      }
    }

    sendResponse({ success: granted });
  } catch (error) {
    console.error('[Background] Permission request failed:', error);
    sendResponse({ success: false, error: String(error) });
  }
}

/**
 * Handle extension updates by re-injecting content scripts
 */
async function handleExtensionUpdate(): Promise<void> {
  try {
    const settings = await chrome.storage.local.get(['promptLibrarySettings']);
    const promptLibrarySettings = settings.promptLibrarySettings as {
      enabledSites?: string[];
      customSites?: Array<{ hostname: string; enabled: boolean }>;
    } | undefined;
    const enabledSites = promptLibrarySettings?.enabledSites || ['claude.ai', 'chatgpt.com', 'www.perplexity.ai'];
    const customSites = promptLibrarySettings?.customSites || [];

    const allEnabledHosts = [
      ...enabledSites,
      ...customSites.filter((s) => s.enabled).map((s) => s.hostname)
    ];

    // Get all tabs and re-inject where appropriate
    const tabs = await chrome.tabs.query({});
    
    for (const tab of tabs) {
      if (tab.id && tab.url) {
        try {
          const url = new URL(tab.url);
          const hostname = url.hostname;
          
          if (allEnabledHosts.includes(hostname)) {
            await injector.forceInjectContentScript(tab.id);
          }
        } catch {
          // Invalid URL, skip
          continue;
        }
      }
    }
    
    // Extension update injection complete
  } catch (error) {
    console.error('[Background] Error handling extension update:', error);
  }
}

/**
 * Get the current interface mode from storage
 */
async function getInterfaceMode(): Promise<InterfaceMode> {
  const result = await chrome.storage.local.get('interfaceMode');
  return (result.interfaceMode as InterfaceMode | undefined) || 'popup';
}


/**
 * Update the action button behavior based on interface mode
 */
async function updateActionBehavior(mode: InterfaceMode): Promise<void> {
  if (mode === 'popup') {
    // Set popup for action button
    await chrome.action.setPopup({ popup: 'src/popup.html' });
  } else {
    // Clear popup to enable onClicked event for side panel
    await chrome.action.setPopup({ popup: '' });
  }
}

/**
 * Handle getting the interface mode
 */
async function handleGetInterfaceMode(sendResponse: (response?: { mode: InterfaceMode }) => void) {
  const mode = await getInterfaceMode();
  sendResponse({ mode });
}

/**
 * Open picker in a new window to prevent popup from closing
 */
async function handleOpenPickerWindow(targetTabId: number | undefined, sendResponse: (response?: { success: boolean; error?: string }) => void) {
  try {
    // Store the original tab that we're picking from
    let originalUrl = '';
    let originalHostname = '';
    
    if (targetTabId) {
      originalTabId = targetTabId;
      const tab = await chrome.tabs.get(targetTabId);
      if (tab.url) {
        originalUrl = tab.url;
        try {
          const url = new URL(tab.url);
          originalHostname = url.hostname;
        } catch {
          // Invalid URL, keep empty
        }
      }
    } else {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0 && tabs[0]) {
        const activeTab = tabs[0];
        originalTabId = activeTab.id || null;
        if (activeTab.url) {
          originalUrl = activeTab.url;
          try {
            const url = new URL(activeTab.url);
            originalHostname = url.hostname;
          } catch {
            // Invalid URL, keep empty
          }
        }
      }
    }
    
    // Create URL with original tab info as parameters
    const params = new URLSearchParams({
      picker: 'true',
      originalUrl: originalUrl,
      originalHostname: originalHostname,
      originalTabId: String(originalTabId || '')
    });
    
    // Create a new window with the popup HTML and original tab info
    const window = await chrome.windows.create({
      url: chrome.runtime.getURL(`src/popup.html?${params.toString()}`),
      type: 'popup',
      width: 400,
      height: 600,
      left: 100,
      top: 100
    });
    
    pickerWindowId = window.id || null;
    sendResponse({ success: true });
  } catch (error) {
    console.error('[Background] Error opening picker window:', error);
    sendResponse({ success: false, error: String(error) });
  }
}

/**
 * Start element picker mode
 */
async function handleStartElementPicker(passedTabId: number | undefined, sender: chrome.runtime.MessageSender, sendResponse: (response?: { success: boolean; error?: string; tabId?: number }) => void) {
  try {
    // Determine which tab to activate picker on
    let targetTabId: number | null = null;
    
    // First priority: Use the explicitly passed tab ID (from picker window)
    if (passedTabId) {
      targetTabId = passedTabId;
    }
    // Second priority: Use the original tab stored (from picker window), if any
    else if (originalTabId) {
      targetTabId = originalTabId;
    } else {
      // Otherwise, get the active tab (but not the popup itself)
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0 && tabs[0]) {
        const activeTab = tabs[0];
        // Don't activate on extension pages
        if (activeTab.url && !activeTab.url.startsWith('chrome-extension://')) {
          targetTabId = activeTab.id || null;
        }
      }
    }
    
    if (!targetTabId) {
      sendResponse({ success: false, error: 'No valid tab found for element picking' });
      return;
    }

    // Get the tab details
    const tab = await chrome.tabs.get(targetTabId);
    if (!tab.url) {
      sendResponse({ success: false, error: 'Cannot access tab URL' });
      return;
    }

    // Store picker session
    activePickerSessions.set(targetTabId, {
      tabId: targetTabId,
      windowId: sender.tab?.windowId || 0
    });

    // Switch to the target tab
    await chrome.tabs.update(targetTabId, { active: true });
    
    // Focus on the tab's window
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }

    // Use the ContentScriptInjector to ensure content script is injected
    try {
      // Check if content script is already injected
      const isInjected = await injector.isContentScriptInjected(targetTabId);
      
      if (!isInjected) {
        // Force inject the content script
        const injectionResult = await injector.forceInjectContentScript(targetTabId);
        
        if (!injectionResult.success) {
          sendResponse({ 
            success: false, 
            error: injectionResult.error || 'Failed to inject content script. Please refresh the page and try again.' 
          });
          return;
        }
        
        // Wait a bit for the script to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('[Background] Error checking/injecting content script:', error);
      sendResponse({ 
        success: false, 
        error: 'Failed to initialize content script. Please refresh the page and try again.' 
      });
      return;
    }

    // Now send the message to activate element picker
    try {
      await chrome.tabs.sendMessage(targetTabId, {
        type: 'ACTIVATE_ELEMENT_PICKER',
        source: 'background'
      });
      sendResponse({ success: true, tabId: targetTabId });
    } catch (messageError) {
      console.error('[Background] Failed to activate element picker:', messageError);
      sendResponse({ success: false, error: 'Failed to activate element picker. Please refresh the page and try again.' });
    }
  } catch (error) {
    console.error('[Background] Error starting element picker:', error);
    sendResponse({ success: false, error: String(error) });
  }
}

/**
 * Handle element selection from content script
 */
async function handleElementSelected(data: BackgroundMessage['data'], sender: chrome.runtime.MessageSender, sendResponse: (response?: { success: boolean; error?: string }) => void) {
  try {
    const tabId = sender.tab?.id;
    
    if (!tabId || !activePickerSessions.has(tabId)) {
      sendResponse({ success: false, error: 'No active picker session' });
      return;
    }

    // Remove session
    activePickerSessions.delete(tabId);

    // Forward selected element data to all popup instances and the picker window
    void chrome.runtime.sendMessage({
      type: 'ELEMENT_PICKER_RESULT',
      data: {
        selector: data?.selector,
        elementType: data?.elementType,
        elementInfo: data?.elementInfo,
        hostname: data?.hostname
      }
    });
    
    // If we have a picker window, focus it
    if (pickerWindowId) {
      try {
        await chrome.windows.update(pickerWindowId, { focused: true });
      } catch {
        // Window might be closed, ignore
        pickerWindowId = null;
      }
    }
    
    // Clear the original tab reference
    originalTabId = null;

    sendResponse({ success: true });
  } catch (error) {
    console.error('[Background] Error handling element selection:', error);
    sendResponse({ success: false, error: String(error) });
  }
}

/**
 * Stop element picker mode
 */
async function handleStopElementPicker(passedTabId: number | undefined, sender: chrome.runtime.MessageSender, sendResponse: (response?: { success: boolean; error?: string }) => void) {
  try {
    // Clear all active sessions
    for (const [tabId] of activePickerSessions) {
      await chrome.tabs.sendMessage(tabId, {
        type: 'DEACTIVATE_ELEMENT_PICKER',
        source: 'background'
      }).catch(() => {
        // Tab might be closed, ignore error
      });
    }
    
    activePickerSessions.clear();
    sendResponse({ success: true });
  } catch (error) {
    console.error('[Background] Error stopping element picker:', error);
    sendResponse({ success: false, error: String(error) });
  }
}

// Clean up on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  if (activePickerSessions.has(tabId)) {
    activePickerSessions.delete(tabId);
  }
});

// Clean up on window close
chrome.windows.onRemoved.addListener((windowId) => {
  if (pickerWindowId === windowId) {
    pickerWindowId = null;
    originalTabId = null;
    // Stop any active picker sessions
    void handleStopElementPicker(undefined, { tab: undefined } as chrome.runtime.MessageSender, () => undefined);
  }
});

// Handle connection for keeping popup alive
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup-keep-alive') {
    port.onDisconnect.addListener(() => {
      // Cleanup any active picker sessions when popup closes
      void handleStopElementPicker(undefined, { tab: undefined } as chrome.runtime.MessageSender, () => undefined);
    });
  }
});

// Initialize interface mode on extension startup and handle updates
chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    try {
      const mode = await getInterfaceMode();
      await updateActionBehavior(mode);

      // Re-inject content scripts after extension updates
      if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
        // Extension updated, re-injecting content scripts
        await handleExtensionUpdate();
      }
    } catch (error) {
      console.error('[Background] Error initializing interface mode on install:', error);
    }
  })();
});

// Initialize interface mode on browser startup
chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    try {
      const mode = await getInterfaceMode();
      await updateActionBehavior(mode);
    } catch (error) {
      console.error('[Background] Error initializing interface mode on startup:', error);
    }
  })();
});

// Handle action button clicks for side panel mode
chrome.action.onClicked.addListener((tab) => {
  // This handler only fires when popup is not set (i.e., in side panel mode)
  // We can safely open the side panel here as it's a direct user action
  if (tab.windowId) {
    try {
      // @ts-expect-error - chrome.sidePanel is not in the types yet
      void chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (error) {
      console.error('[Background] Error opening side panel:', error);
    }
  }
});

// Listen for storage changes to update interface mode
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && 'interfaceMode' in changes) {
    const interfaceModeChange = changes.interfaceMode;
    if (interfaceModeChange.newValue) {
      void (async () => {
        try {
          const newMode = interfaceModeChange.newValue as InterfaceMode;
          await updateActionBehavior(newMode);
        } catch (error) {
          console.error('[Background] Error updating interface mode:', error);
        }
      })();
    }
  }
});

export {};