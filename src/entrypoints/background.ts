/**
 * Background script for Chrome extension
 * Handles message passing, content script injection, and coordination between popup and content scripts
 */

import { defineBackground } from 'wxt/utils/define-background';

import { getDefaultEnabledPlatforms, getAllHostnamePatterns } from '../config/platforms';
import type { ElementFingerprint } from '../types';
import { Logger, toError, getErrorMessage } from '../utils';

// Configuration constants
const ORPHANED_TAB_DETECTION_WINDOW_MS = 10000; // 10 seconds after extension start

/**
 * Content script injection controller
 * Handles programmatic injection of content scripts based on site enablement
 * Exported for testing purposes
 */
export class ContentScriptInjector {
  private injectedTabs: Set<number> = new Set();
  private injectionPromises: Map<number, Promise<void>> = new Map();
  private extensionStartTime: number = Date.now();
  private orphanedTabs: Set<number> = new Set();

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
    // Check our memory first for performance, but don't trust it completely
    // We'll verify actual injection state in injectContentScript
    if (this.injectedTabs.has(tabId)) {
      // Even if we think it's injected, verify for custom sites
      // This handles the case where the page was reloaded
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.url) {
          const url = new URL(tab.url);
          const hostname = url.hostname;

          // For custom sites, always verify actual injection state
          const settings = await chrome.storage.local.get(['promptLibrarySettings']);
          const promptLibrarySettings = settings.promptLibrarySettings as {
            customSites?: Array<{ hostname: string; enabled: boolean }>;
          } | undefined;

          const customSites = promptLibrarySettings?.customSites || [];
          const isCustomSite = customSites.some(site => site.hostname === hostname && site.enabled);

          if (isCustomSite) {
            // For custom sites, verify the content script is actually there
            const isActuallyInjected = await this.isContentScriptInjected(tabId);
            if (!isActuallyInjected) {
              // It's not there, remove from our tracking and continue to inject
              this.injectedTabs.delete(tabId);
            } else {
              // It's actually there, we're done
              return;
            }
          } else {
            // For non-custom sites (manifest-injected sites), trust our tracking
            return;
          }
        }
      } catch {
        // If we can't verify, trust our tracking
        return;
      }
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
        return getDefaultEnabledPlatforms().includes(hostname);
      }

      // Get enabled sites and custom sites from settings
      const enabledSites = promptLibrarySettings.enabledSites || getDefaultEnabledPlatforms();
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
      Logger.error('Error checking site enablement', toError(error), { component: 'ContentScriptInjector', hostname });
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
      Logger.error(`[ContentScriptInjector] Error checking permissions for ${hostname}`, toError(error));
      return false;
    }
  }

  /**
   * Test if we can actually inject into the specific tab (more robust than just checking permissions)
   */
  private async canInjectIntoTab(tabId: number): Promise<boolean> {
    try {
      const tab = await chrome.tabs.get(tabId);

      // Check if tab is in a valid state
      if (!tab.url || tab.status !== 'complete') {
        return false;
      }

      // Don't try to inject into restricted URLs
      if (this.isRestrictedUrl(tab.url)) {
        return false;
      }

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
   * Classify injection error types for appropriate handling
   */
  private classifyInjectionError(error: Error, tabId: number): 'permission' | 'tab_access_denied' | 'orphaned_tab' | 'network' | 'tab_closed' | 'security' | 'unknown' {
    const message = error.message;

    // Check if this is an orphaned tab from before extension reload
    if (this.isLikelyOrphanedTab(tabId) && message.includes('tab access denied')) {
      return 'orphaned_tab';
    }

    if (message.includes('No permission to inject into')) {
      return 'permission';
    }
    if (message.includes('tab access denied')) {
      return 'tab_access_denied';
    }
    if (message.includes('interrupted by user')) {
      return 'network';
    }
    if (message.includes('No tab with id')) {
      return 'tab_closed';
    }
    if (message.includes('violates CSP')) {
      return 'security';
    }

    return 'unknown';
  }

  /**
   * Check if a tab is likely orphaned from before extension reload
   */
  private isLikelyOrphanedTab(_tabId: number): boolean {
    // If tab was created before extension started, it might be orphaned
    const timeSinceExtensionStart = Date.now() - this.extensionStartTime;
    return timeSinceExtensionStart < ORPHANED_TAB_DETECTION_WINDOW_MS;
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
        throw new Error(`No permission to inject into ${hostname}`);
      }

      // More robust check: test if we can actually inject into this specific tab
      const canInject = await this.canInjectIntoTab(tabId);
      if (!canInject) {
        throw new Error(`Cannot inject into tab ${tabId.toString()} for ${hostname} - tab access denied`);
      }

      // Check if already injected by testing for marker
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

      // Classify error and handle appropriately
      const errorType = this.classifyInjectionError(toError(error), tabId);

      switch (errorType) {
        case 'permission':
          // Expected for most sites - suppress logging for cleaner console
          break;
        case 'orphaned_tab':
          // Expected after extension reload - suppress logging and mark as orphaned
          this.orphanedTabs.add(tabId);
          break;
        case 'tab_access_denied':
          // Log warning for unexpected access issues (not orphaned tabs)
          if (!this.isLikelyOrphanedTab(tabId)) {
            Logger.warn(`Tab access denied for tab ${tabId.toString()}`, { component: 'ContentScriptInjector', hostname, tabId });
          }
          break;
        case 'network':
        case 'tab_closed':
          // Transient errors - suppress logging
          break;
        case 'security':
        case 'unknown':
        default:
          // Unexpected errors - always log
          Logger.error(`Unexpected injection failure for tab ${tabId.toString()}`, toError(error), { component: 'ContentScriptInjector', hostname, errorType });
          break;
      }

      throw error;
    }
  }

  /**
   * Check if content script is already injected in the tab
   * Also performs cleanup of orphaned DOM elements from previous injections
   */
  async isContentScriptInjected(tabId: number): Promise<boolean> {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const isInjected = (window as { __promptLibraryInjected?: boolean }).__promptLibraryInjected === true;

          // If not injected, clean up any orphaned DOM elements from previous extension versions
          if (!isInjected) {
            try {
              // Remove any orphaned icons
              const orphanedIcons = document.querySelectorAll('.prompt-library-cleanup-target, [data-prompt-library-icon]');
              orphanedIcons.forEach(icon => {
                try {
                  icon.remove();
                } catch {
                  // Element might already be removed
                }
              });

              // Remove any orphaned selectors
              const orphanedSelectors = document.querySelectorAll('.prompt-library-selector');
              orphanedSelectors.forEach(selector => {
                try {
                  selector.remove();
                } catch {
                  // Element might already be removed
                }
              });

              // Return cleanup info along with injection status
              return {
                isInjected: false,
                orphanedElements: orphanedIcons.length + orphanedSelectors.length
              };
            } catch {
              return { isInjected: false, orphanedElements: 0 };
            }
          }

          return { isInjected: true, orphanedElements: 0 };
        }
      });

      if (typeof result.result === 'boolean') {
        // Legacy response format
        return result.result;
      } else if (result.result && typeof result.result === 'object') {
        // New response format with cleanup info
        const { isInjected } = result.result as { isInjected: boolean; orphanedElements: number };
        // Silent cleanup - no logging needed for expected orphaned element removal
        return isInjected;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Force inject content script (used by activeTab clicks)
   */
  async forceInjectContentScript(tabId: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Remove from injected and orphaned tabs to force re-injection
      this.injectedTabs.delete(tabId);
      this.orphanedTabs.delete(tabId);
      await this.injectContentScript(tabId);
      this.injectedTabs.add(tabId);
      return { success: true };
    } catch (error) {
      const hostname = await this.getTabHostname(tabId);
      const errorType = this.classifyInjectionError(toError(error), tabId);

      // Handle different error types appropriately
      switch (errorType) {
        case 'permission':
          return {
            success: false,
            error: `Permission required for ${hostname}. Please grant permission to use the extension on this site.`
          };
        case 'orphaned_tab':
          return {
            success: false,
            error: `Please refresh this tab and try again. The extension was recently reloaded.`
          };
        case 'tab_access_denied':
          return {
            success: false,
            error: `Cannot access this tab. Please refresh the page and try again.`
          };
        case 'tab_closed':
          return {
            success: false,
            error: `Tab is no longer available.`
          };
        default:
          // Log unexpected errors
          Logger.error(`Force injection failed for tab ${tabId.toString()}`, toError(error), { component: 'ContentScriptInjector', hostname, errorType });
          return {
            success: false,
            error: getErrorMessage(error)
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
    this.orphanedTabs.delete(tabId);
  }

  /**
   * Get the correct content script filename from the extension manifest
   */
  private async getContentScriptFilename(): Promise<string> {
    try {
      // Primary: Use Chrome's official API to get content script path
      const manifest = chrome.runtime.getManifest();
      const contentScripts = manifest.content_scripts;

      if (contentScripts && contentScripts[0]?.js?.[0]) {
        const contentScriptPath = contentScripts[0].js[0];

        // Verify the file exists before returning
        try {
          await fetch(chrome.runtime.getURL(contentScriptPath));
          return contentScriptPath;
        } catch {
          // File doesn't exist, continue to fallbacks
          Logger.warn('Manifest content script path not accessible', { component: 'ContentScriptInjector', contentScriptPath });
        }
      }
    } catch (error) {
      Logger.error('Failed to read manifest', toError(error), { component: 'ContentScriptInjector' });
    }

    // WXT typically places content scripts in content-scripts directory
    const wxtFallbackFiles = [
      'content-scripts/content.js',
      'content-scripts/content.ts',
    ];

    for (const file of wxtFallbackFiles) {
      try {
        await fetch(chrome.runtime.getURL(file));
        return file;
      } catch {
        continue;
      }
    }

    // Other fallbacks
    const fallbackFiles = [
      'assets/content.js',
      'content.js'
    ];

    for (const file of fallbackFiles) {
      try {
        await fetch(chrome.runtime.getURL(file));
        return file;
      } catch {
        continue;
      }
    }

    throw new Error('Unable to locate content script file');
  }

  /**
   * Get injection status for debugging
   */
  getInjectionStatus(): { injectedTabs: number[]; activePromises: number[]; orphanedTabs: number[]; extensionUptime: number } {
    return {
      injectedTabs: Array.from(this.injectedTabs),
      activePromises: Array.from(this.injectionPromises.keys()),
      orphanedTabs: Array.from(this.orphanedTabs),
      extensionUptime: Date.now() - this.extensionStartTime
    };
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

// Interface mode types
type InterfaceMode = 'popup' | 'sidepanel';

// Message types for element picker and injection
interface BackgroundMessage {
  type: 'START_ELEMENT_PICKER' | 'STOP_ELEMENT_PICKER' | 'ELEMENT_SELECTED' | 'PICKER_CANCELLED' | 'OPEN_PICKER_WINDOW' | 'GET_INTERFACE_MODE' | 'REQUEST_INJECTION' | 'SETTINGS_UPDATED' | 'REQUEST_PERMISSION';
  data?: {
    fingerprint?: ElementFingerprint;
    selector?: string;
    elementType?: string;
    elementInfo?: Record<string, unknown>;
    hostname?: string;
    tabId?: number;
    origins?: string[];
    settings?: unknown;
  };
}

export default defineBackground(() => {
  // ALL runtime code must be inside this callback

  // Track active element picker sessions
  const activePickerSessions = new Map<number, { tabId: number; windowId: number }>();

  // Create global injector instance
  const injector = new ContentScriptInjector();

  // Track the picker window
  let pickerWindowId: number | null = null;
  let originalTabId: number | null = null;

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
    if (tab.id !== undefined) {
      const tabId = tab.id;
      void (async () => {
        try {
          await injector.forceInjectContentScript(tabId);
        } catch (error) {
          Logger.error('Failed to inject via activeTab', toError(error), { component: 'Background', tabId, url: tab.url });
        }
      })();
    }
  });

  /**
   * Get the current interface mode from storage
   */
  async function getInterfaceMode(): Promise<InterfaceMode> {
    const result = await chrome.storage.local.get('interfaceMode');
    return (result.interfaceMode as InterfaceMode | undefined) || 'sidepanel';
  }

  /**
   * Update the action button behavior based on interface mode
   */
  async function updateActionBehavior(mode: InterfaceMode): Promise<void> {
    if (mode === 'popup') {
      // Set popup for action button  - WXT will use /popup.html
      await chrome.action.setPopup({ popup: '/popup.html' });
    } else {
      // Clear popup to enable onClicked event for side panel
      await chrome.action.setPopup({ popup: '' });
    }
  }

  /**
   * Handle manual injection requests from popup/side panel
   */
  async function handleRequestInjection(tabId: number | undefined, sendResponse: (response?: { success: boolean; error?: string }) => void) {
    let targetTabId = tabId;

    try {
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
      Logger.error('Manual injection failed', toError(error), { component: 'Background', tabId: targetTabId });
      sendResponse({ success: false, error: getErrorMessage(error) });
    }
  }

  /**
   * Handle settings updates that might affect injection
   */
  async function handleSettingsUpdated(_settings: unknown, sendResponse: (response?: { success: boolean }) => void) {
    try {
      const tabs = await chrome.tabs.query({});

      const relevantTabs = tabs.filter(tab => {
        if (!tab.id || !tab.url) {
          return false;
        }

        try {
          const url = new URL(tab.url);
          const hostname = url.hostname;

          return getDefaultEnabledPlatforms().includes(hostname) ||
                 getAllHostnamePatterns().some(pattern => hostname.includes(pattern));
        } catch {
          return false;
        }
      });

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
            Logger.error('Failed to process tab during settings update', toError(error), { component: 'Background', tabId: tab.id, url: tab.url });
          }
        })
      );

      sendResponse({ success: true });
    } catch (error) {
      Logger.error('Settings update handling failed', toError(error), { component: 'Background' });
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
        const settings = await chrome.storage.local.get(['grantedPermissions']);
        const grantedPermissions = (settings.grantedPermissions as string[] | undefined) || [];

        for (const origin of origins) {
          if (!grantedPermissions.includes(origin)) {
            grantedPermissions.push(origin);
          }
        }

        await chrome.storage.local.set({ grantedPermissions });

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
      Logger.error('Permission request failed', toError(error), { component: 'Background', origins });
      sendResponse({ success: false, error: getErrorMessage(error) });
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
      const enabledSites = promptLibrarySettings?.enabledSites || getDefaultEnabledPlatforms();
      const customSites = promptLibrarySettings?.customSites || [];

      const allEnabledHosts = [
        ...enabledSites,
        ...customSites.filter((s) => s.enabled).map((s) => s.hostname)
      ];

      const tabs = await chrome.tabs.query({});
      const reinjectionResults: Array<{ tabId: number; hostname: string; success: boolean }> = [];

      for (const tab of tabs) {
        if (tab.id && tab.url) {
          try {
            const url = new URL(tab.url);
            const hostname = url.hostname;

            if (allEnabledHosts.includes(hostname)) {
              const result = await injector.forceInjectContentScript(tab.id);
              reinjectionResults.push({
                tabId: tab.id,
                hostname,
                success: result.success
              });
            }
          } catch {
            continue;
          }
        }
      }

      const failedReinjections = reinjectionResults.filter(r => !r.success);
      if (failedReinjections.length > 0) {
        Logger.warn(
          `Some tabs could not be re-injected after extension update (${failedReinjections.length.toString()}/${reinjectionResults.length.toString()} failed)`,
          {
            component: 'ContentScriptInjector',
            failedCount: failedReinjections.length,
            totalTabs: reinjectionResults.length,
            failedTabIds: failedReinjections.map(r => r.tabId)
          }
        );
      } else if (reinjectionResults.length > 0) {
        Logger.info(`Successfully re-injected content scripts in ${reinjectionResults.length.toString()} tabs`, {
          component: 'ContentScriptInjector',
          totalTabs: reinjectionResults.length
        });
      }
    } catch (error) {
      Logger.error('Error handling extension update', toError(error), { component: 'Background', phase: 'extension_update' });
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
            // Invalid URL
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
              // Invalid URL
            }
          }
        }
      }

      const params = new URLSearchParams({
        picker: 'true',
        originalUrl: originalUrl,
        originalHostname: originalHostname,
        originalTabId: String(originalTabId || '')
      });

      const window = await chrome.windows.create({
        url: chrome.runtime.getURL(`/popup.html?${params.toString()}`),
        type: 'popup',
        width: 400,
        height: 600,
        left: 100,
        top: 100
      });

      pickerWindowId = window?.id ?? null;
      sendResponse({ success: true });
    } catch (error) {
      Logger.error('Error opening picker window', toError(error), { component: 'Background', originalTabId });
      sendResponse({ success: false, error: getErrorMessage(error) });
    }
  }

  /**
   * Start element picker mode
   */
  async function handleStartElementPicker(passedTabId: number | undefined, sender: chrome.runtime.MessageSender, sendResponse: (response?: { success: boolean; error?: string; tabId?: number }) => void) {
    try {
      let targetTabId: number | null = null;

      if (passedTabId) {
        targetTabId = passedTabId;
      } else if (originalTabId) {
        targetTabId = originalTabId;
      } else {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0 && tabs[0]) {
          const activeTab = tabs[0];
          if (activeTab.url && !activeTab.url.startsWith('chrome-extension://')) {
            targetTabId = activeTab.id || null;
          }
        }
      }

      if (!targetTabId) {
        sendResponse({ success: false, error: 'No valid tab found for element picking' });
        return;
      }

      const tab = await chrome.tabs.get(targetTabId);
      if (!tab.url) {
        sendResponse({ success: false, error: 'Cannot access tab URL' });
        return;
      }

      activePickerSessions.set(targetTabId, {
        tabId: targetTabId,
        windowId: sender.tab?.windowId || 0
      });

      await chrome.tabs.update(targetTabId, { active: true });

      if (tab.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }

      try {
        const isInjected = await injector.isContentScriptInjected(targetTabId);

        if (!isInjected) {
          const injectionResult = await injector.forceInjectContentScript(targetTabId);

          if (!injectionResult.success) {
            sendResponse({
              success: false,
              error: injectionResult.error || 'Failed to inject content script'
            });
            return;
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        Logger.error('Error checking/injecting content script', toError(error), { component: 'Background', tabId: targetTabId });
        sendResponse({
          success: false,
          error: 'Failed to initialize content script'
        });
        return;
      }

      try {
        await chrome.tabs.sendMessage(targetTabId, {
          type: 'ACTIVATE_ELEMENT_PICKER',
          source: 'background'
        });
        sendResponse({ success: true, tabId: targetTabId });
      } catch (messageError) {
        Logger.error('Failed to activate element picker', toError(messageError), { component: 'Background', tabId: targetTabId });
        sendResponse({ success: false, error: 'Failed to activate element picker' });
      }
    } catch (error) {
      Logger.error('Error starting element picker', toError(error), { component: 'Background', passedTabId, senderTabId: sender.tab?.id });
      sendResponse({ success: false, error: getErrorMessage(error) });
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

      activePickerSessions.delete(tabId);

      void chrome.runtime.sendMessage({
        type: 'ELEMENT_PICKER_RESULT',
        data: {
          fingerprint: data?.fingerprint,
          selector: data?.selector,
          elementType: data?.elementType,
          elementInfo: data?.elementInfo,
          hostname: data?.hostname
        }
      });

      if (pickerWindowId) {
        try {
          await chrome.windows.update(pickerWindowId, { focused: true });
        } catch {
          pickerWindowId = null;
        }
      }

      originalTabId = null;

      sendResponse({ success: true });
    } catch (error) {
      Logger.error('Error handling element selection', toError(error), { component: 'Background', senderTabId: sender.tab?.id });
      sendResponse({ success: false, error: getErrorMessage(error) });
    }
  }

  /**
   * Stop element picker mode
   */
  async function handleStopElementPicker(_passedTabId: number | undefined, _sender: chrome.runtime.MessageSender, sendResponse: (response?: { success: boolean; error?: string }) => void) {
    try {
      for (const [tabId] of activePickerSessions) {
        await chrome.tabs.sendMessage(tabId, {
          type: 'DEACTIVATE_ELEMENT_PICKER',
          source: 'background'
        }).catch(() => {
          // Tab might be closed
        });
      }

      activePickerSessions.clear();
      sendResponse({ success: true });
    } catch (error) {
      Logger.error('Error stopping element picker', toError(error), { component: 'Background', activeSessionCount: activePickerSessions.size });
      sendResponse({ success: false, error: getErrorMessage(error) });
    }
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

    return true;
  });

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
      void handleStopElementPicker(undefined, { tab: undefined } as chrome.runtime.MessageSender, () => undefined);
    }
  });

  // Handle connection for keeping popup alive
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'popup-keep-alive') {
      port.onDisconnect.addListener(() => {
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

        if (details.reason === chrome.runtime.OnInstalledReason.UPDATE as string) {
          await handleExtensionUpdate();
        }
      } catch (error) {
        Logger.error('Error initializing interface mode on install', toError(error), { component: 'Background', reason: details.reason });
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
        Logger.error('Error initializing interface mode on startup', toError(error), { component: 'Background', phase: 'startup' });
      }
    })();
  });

  // Handle action button clicks for side panel mode
  chrome.action.onClicked.addListener((tab) => {
    if (tab.windowId) {
      try {
        void chrome.sidePanel.open({ windowId: tab.windowId });
      } catch (error) {
        Logger.error('Error opening side panel', toError(error), { component: 'Background', windowId: tab.windowId, tabId: tab.id });
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
            Logger.error('Error updating interface mode', toError(error), { component: 'Background', newMode: interfaceModeChange.newValue });
          }
        })();
      }
    }
  });

  // Initialize the extension on service worker start
  void (async () => {
    try {
      const mode = await getInterfaceMode();
      await updateActionBehavior(mode);
    } catch (error) {
      Logger.error('Error during initial setup', toError(error), { component: 'Background', phase: 'initialization' });
    }
  })();
});
