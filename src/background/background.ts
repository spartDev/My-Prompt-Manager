/**
 * Background script for Chrome extension
 * Handles message passing, content script injection, and coordination between popup and content scripts
 */

import {
  changeIconPlacementRepairs,
  overrideFromPick,
  type PlacementReport,
  type PlacementReportResponse,
  repairablePlatformHostname,
} from "../services/iconPlacementRepairs";
import {
  enabledCustomSite,
  enabledHostnames,
  isHostnameEnabled,
  readSiteSettings,
} from "../services/siteSettings";
import { StorageManager } from "../services/storage";
import { UsageTracker } from "../services/UsageTracker";
import type { ElementFingerprint, PlatformType } from "../types";
import { getErrorMessage, Logger, toError } from "../utils";

/** An Element picker open in a tab, from START_ELEMENT_PICKER until the pick or its cancel */
interface PickerSession {
  tabId: number;
  windowId: number;
  /** Set when the pick repairs the icon placement of this built-in Platform (Settings, "Place the icon") */
  repairHostname?: string;
}

const PICKER_SESSION_KEY_PREFIX = "pickerSession:";
const pickerSessionKey = (tabId: number): string => `${PICKER_SESSION_KEY_PREFIX}${tabId}`;

function isPickerSession(value: unknown): value is PickerSession {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const session = value as Record<string, unknown>;
  return typeof session.tabId === "number"
    && typeof session.windowId === "number"
    && (session.repairHostname === undefined || typeof session.repairHostname === "string");
}

/**
 * The open picker sessions, in chrome.storage.session under one key per tab, not in memory: Chrome
 * stops the service worker after about 30 s with no event, and hovering the page sends none, so a
 * session held in memory would be gone by the time the user clicks, and the pick lost.
 */
const pickerSessions = {
  async get(tabId: number): Promise<PickerSession | undefined> {
    const key = pickerSessionKey(tabId);
    const stored: unknown = (await chrome.storage.session.get(key))[key];
    return isPickerSession(stored) ? stored : undefined;
  },
  set(session: PickerSession): Promise<void> {
    return chrome.storage.session.set({ [pickerSessionKey(session.tabId)]: session });
  },
  delete(tabId: number): Promise<void> {
    return chrome.storage.session.remove(pickerSessionKey(tabId));
  },
  async tabIds(): Promise<number[]> {
    const stored = await chrome.storage.session.get(null);
    return Object.keys(stored)
      .filter((key) => key.startsWith(PICKER_SESSION_KEY_PREFIX))
      .map((key) => Number(key.slice(PICKER_SESSION_KEY_PREFIX.length)))
      .filter((tabId) => Number.isInteger(tabId));
  },
};

/** Forgets a tab's picker session, as its tab closes */
function forgetPickerSession(tabId: number): void {
  pickerSessions.delete(tabId).catch((error: unknown) => {
    Logger.warn("Could not forget the picker session of a closed tab", {
      component: "Background",
      tabId,
      error: getErrorMessage(error),
    });
  });
}

const storageManager = StorageManager.getInstance();

// Configuration constants
const ORPHANED_TAB_DETECTION_WINDOW_MS = 10000; // 10 seconds after extension start

// The extension files changed on disk since Chrome loaded them (a rebuild): only a reload recovers
const STALE_BUILD_ERROR =
  "The extension was updated on disk. Reload it in chrome://extensions, then refresh this page and try again.";

/**
 * Content script injection controller
 * Handles programmatic injection of content scripts based on site enablement
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

  /**
   * Injects the content script into the tab when its site is enabled, permitted and not injected
   * yet. A tab left with elements of an earlier injection (the extension was updated) is cleaned first.
   */
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
          const isCustomSite =
            enabledCustomSite(await readSiteSettings(), hostname) !== null;

          if (isCustomSite) {
            // For custom sites, verify the content script is actually there
            const isActuallyInjected =
              await this.isContentScriptInjected(tabId);
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

    let hostname = "unknown";
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
      "chrome://",
      "chrome-extension://",
      "moz-extension://",
      "edge-extension://",
      "about:",
      "data:",
      "file://",
      "ftp://",
    ];

    return restrictedPatterns.some((pattern) => url.startsWith(pattern));
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

      return isHostnameEnabled(await readSiteSettings(), hostname);
    } catch (error) {
      Logger.error("Error checking site enablement", toError(error), {
        component: "ContentScriptInjector",
        hostname,
      });
      return false;
    }
  }

  /**
   * Check if the extension has permission for the given hostname
   */
  private async hasPermissionForHostname(hostname: string): Promise<boolean> {
    try {
      const origins = [`https://${hostname}/*`, `http://${hostname}/*`];

      // Check if we have permission for any of the origins
      for (const origin of origins) {
        const hasPermission = await chrome.permissions.contains({
          origins: [origin],
        });
        if (hasPermission) {
          return true;
        }
      }

      return false;
    } catch (error) {
      Logger.error(
        `[ContentScriptInjector] Error checking permissions for ${hostname}`,
        toError(error),
      );
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
      if (!tab.url || tab.status !== "complete") {
        return false;
      }

      // Don't try to inject into restricted URLs
      if (this.isRestrictedUrl(tab.url)) {
        return false;
      }

      // Try to execute a minimal script to test access
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          return true;
        }, // Minimal function that just returns true
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Classify injection error types for appropriate handling
   */
  private classifyInjectionError(
    error: Error,
    tabId: number,
  ):
    | "permission"
    | "tab_access_denied"
    | "orphaned_tab"
    | "network"
    | "tab_closed"
    | "security"
    | "unknown" {
    const message = error.message;

    // Check if this is an orphaned tab from before extension reload
    if (
      this.isLikelyOrphanedTab(tabId) &&
      message.includes("tab access denied")
    ) {
      return "orphaned_tab";
    }

    if (message.includes("No permission to inject into")) {
      return "permission";
    }
    if (message.includes("tab access denied")) {
      return "tab_access_denied";
    }
    if (message.includes("interrupted by user")) {
      return "network";
    }
    if (message.includes("No tab with id")) {
      return "tab_closed";
    }
    if (message.includes("violates CSP")) {
      return "security";
    }

    return "unknown";
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
        throw new Error("Tab has no URL");
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
        throw new Error(
          `Cannot inject into tab ${tabId.toString()} for ${hostname} - tab access denied`,
        );
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
        files: [contentScriptFile],
      });
    } catch (error) {
      const hostname = await this.getTabHostname(tabId);

      // Classify error and handle appropriately
      const errorType = this.classifyInjectionError(toError(error), tabId);

      switch (errorType) {
        case "permission":
          // Expected for most sites - suppress logging for cleaner console
          break;
        case "orphaned_tab":
          // Expected after extension reload - suppress logging and mark as orphaned
          this.orphanedTabs.add(tabId);
          break;
        case "tab_access_denied":
          // Log warning for unexpected access issues (not orphaned tabs)
          if (!this.isLikelyOrphanedTab(tabId)) {
            Logger.warn(`Tab access denied for tab ${tabId.toString()}`, {
              component: "ContentScriptInjector",
              hostname,
              tabId,
            });
          }
          break;
        case "network":
        case "tab_closed":
          // Transient errors - suppress logging
          break;
        case "security":
        case "unknown":
        default:
          // Unexpected errors - always log
          Logger.error(
            `Unexpected injection failure for tab ${tabId.toString()}`,
            toError(error),
            { component: "ContentScriptInjector", hostname, errorType },
          );
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
          const isInjected =
            (window as { __promptLibraryInjected?: boolean })
              .__promptLibraryInjected === true;

          // If not injected, clean up any orphaned DOM elements from previous extension versions
          if (!isInjected) {
            try {
              // Remove any orphaned icons
              const orphanedIcons = document.querySelectorAll(
                ".prompt-library-cleanup-target, [data-prompt-library-icon]",
              );
              orphanedIcons.forEach((icon) => {
                try {
                  icon.remove();
                } catch {
                  // Element might already be removed
                }
              });

              // Remove any orphaned selectors: the shadow host of the Prompt selector
              // (SELECTOR_HOST_ID in src/content/selector/controller.ts; this function runs in
              // the page and cannot import it), and the selector of versions before it
              const orphanedSelectors = document.querySelectorAll(
                "#mpm-prompt-selector, .prompt-library-selector",
              );
              orphanedSelectors.forEach((selector) => {
                try {
                  selector.remove();
                } catch {
                  // Element might already be removed
                }
              });

              // Return cleanup info along with injection status
              return {
                isInjected: false,
                orphanedElements:
                  orphanedIcons.length + orphanedSelectors.length,
              };
            } catch {
              return { isInjected: false, orphanedElements: 0 };
            }
          }

          return { isInjected: true, orphanedElements: 0 };
        },
      });

      if (typeof result.result === "boolean") {
        // Legacy response format
        return result.result;
      } else if (result.result && typeof result.result === "object") {
        // New response format with cleanup info
        const { isInjected } = result.result as {
          isInjected: boolean;
          orphanedElements: number;
        };
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
  async forceInjectContentScript(
    tabId: number,
  ): Promise<{ success: boolean; error?: string }> {
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
        case "permission":
          return {
            success: false,
            error: `Permission required for ${hostname}. Please grant permission to use the extension on this site.`,
          };
        case "orphaned_tab":
          return {
            success: false,
            error: `Please refresh this tab and try again. The extension was recently reloaded.`,
          };
        case "tab_access_denied":
          return {
            success: false,
            error: `Cannot access this tab. Please refresh the page and try again.`,
          };
        case "tab_closed":
          return {
            success: false,
            error: `Tab is no longer available.`,
          };
        default:
          // Log unexpected errors
          Logger.error(
            `Force injection failed for tab ${tabId.toString()}`,
            toError(error),
            { component: "ContentScriptInjector", hostname, errorType },
          );
          return {
            success: false,
            error: getErrorMessage(error),
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
   * The content script loader the manifest names (crxjs writes it as assets/index.ts-loader-<hash>.js).
   *
   * Chrome reads the manifest once, when it loads the extension: after a rebuild that Chrome has not
   * reloaded, the manifest still names a loader that is no longer on disk, and only a reload helps.
   */
  private async getContentScriptFilename(): Promise<string> {
    const contentScriptPath =
      chrome.runtime.getManifest().content_scripts?.[0]?.js?.[0];
    if (!contentScriptPath) {
      throw new Error("The extension manifest declares no content script");
    }

    try {
      await fetch(chrome.runtime.getURL(contentScriptPath));
      return contentScriptPath;
    } catch {
      Logger.warn("Content script named by the manifest is not on disk", {
        component: "ContentScriptInjector",
        contentScriptPath,
      });
      throw new Error(STALE_BUILD_ERROR);
    }
  }

  /**
   * Get injection status for debugging
   */
  getInjectionStatus(): {
    injectedTabs: number[];
    activePromises: number[];
    orphanedTabs: number[];
    extensionUptime: number;
  } {
    return {
      injectedTabs: Array.from(this.injectedTabs),
      activePromises: Array.from(this.injectionPromises.keys()),
      orphanedTabs: Array.from(this.orphanedTabs),
      extensionUptime: Date.now() - this.extensionStartTime,
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
    return "unknown";
  }
}

// Create global injector instance
const injector = new ContentScriptInjector();

// Interface mode types
type InterfaceMode = "popup" | "sidepanel";

// ===============================
// TAB LIFECYCLE MANAGEMENT
// ===============================

// Inject when tab is updated (navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    void injector.injectIfNeeded(tabId);
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  injector.cleanup(tabId);
  forgetPickerSession(tabId);
});

// Inject when extension icon is clicked (activeTab permission)
chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) {
    const tabId = tab.id; // Capture the value to ensure TypeScript knows it's defined
    void (async () => {
      try {
        await injector.forceInjectContentScript(tabId);
        // Content script injected via activeTab
      } catch (error) {
        Logger.error("Failed to inject via activeTab", toError(error), {
          component: "Background",
          tabId,
          url: tab.url,
        });
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
    Logger.error("Error during initial setup", toError(error), {
      component: "Background",
      phase: "initialization",
      action: "updateActionBehavior",
    });
  }
})();

/** The picker window of the Custom site flow, and the tab it picks in */
interface PickerWindow {
  windowId: number | null;
  originalTabId: number | null;
}

const PICKER_WINDOW_KEY = "pickerWindow";
const NO_PICKER_WINDOW: PickerWindow = { windowId: null, originalTabId: null };
let pickerWindowUpdates: Promise<void> = Promise.resolve();

/**
 * The picker window, in chrome.storage.session like the picker sessions, so that after a service
 * worker restart a pick still brings the window back to the front, and closing it still stops the
 * picker.
 */
const pickerWindow = {
  async read(): Promise<PickerWindow> {
    const stored: unknown = (await chrome.storage.session.get(PICKER_WINDOW_KEY))[PICKER_WINDOW_KEY];
    if (typeof stored !== "object" || stored === null) {
      return NO_PICKER_WINDOW;
    }
    const { windowId, originalTabId } = stored as Record<string, unknown>;
    return {
      windowId: typeof windowId === "number" ? windowId : null,
      originalTabId: typeof originalTabId === "number" ? originalTabId : null,
    };
  },
  /** Changes some of its fields; the changes run one after the other, so none is lost or undone */
  update(change: Partial<PickerWindow>): Promise<void> {
    const run = pickerWindowUpdates.then(async () => {
      const next = { ...(await pickerWindow.read()), ...change };
      if (next.windowId === null && next.originalTabId === null) {
        await chrome.storage.session.remove(PICKER_WINDOW_KEY);
        return;
      }
      await chrome.storage.session.set({ [PICKER_WINDOW_KEY]: next });
    });
    pickerWindowUpdates = run.catch(() => undefined);
    return run;
  },
};

// Message types for element picker and injection
interface BackgroundMessage {
  type:
    | "START_ELEMENT_PICKER"
    | "STOP_ELEMENT_PICKER"
    | "ELEMENT_SELECTED"
    | "PICKER_CANCELLED"
    | "OPEN_PICKER_WINDOW"
    | "GET_INTERFACE_MODE"
    | "REQUEST_INJECTION"
    | "REQUEST_PERMISSION"
    | "PROMPT_USAGE_INCREMENT"
    | "ICON_PLACEMENT_REPORTED";
  data?: {
    /** START_ELEMENT_PICKER: the built-in Platform the pick places the icon for */
    repairHostname?: string;
    /** ICON_PLACEMENT_REPORTED: how the content script placed the icon */
    placement?: PlacementReport;
    fingerprint?: ElementFingerprint; // Element fingerprint for robust identification
    selector?: string;
    elementType?: string;
    elementInfo?: Record<string, unknown>;
    hostname?: string;
    tabId?: number;
    origins?: string[];
    promptId?: string;
  };
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener(
  (message: BackgroundMessage, sender, sendResponse) => {
    switch (message.type) {
      case "START_ELEMENT_PICKER":
        void handleStartElementPicker(
          message.data?.tabId,
          sender,
          sendResponse,
          message.data?.repairHostname,
        );
        break;

      case "OPEN_PICKER_WINDOW":
        void handleOpenPickerWindow(message.data?.tabId, sendResponse);
        break;

      case "ELEMENT_SELECTED":
        void handleElementSelected(message.data, sender, sendResponse);
        break;

      case "STOP_ELEMENT_PICKER":
      case "PICKER_CANCELLED":
        void handleStopElementPicker(undefined, sender, sendResponse);
        break;

      case "GET_INTERFACE_MODE":
        void handleGetInterfaceMode(sendResponse);
        break;

      case "REQUEST_INJECTION":
        void handleRequestInjection(message.data?.tabId, sendResponse);
        break;

      case "REQUEST_PERMISSION":
        void handleRequestPermission(message.data?.origins || [], sendResponse);
        break;

      case "PROMPT_USAGE_INCREMENT":
        void handlePromptUsageIncrement(message.data, sendResponse);
        break;

      case "ICON_PLACEMENT_REPORTED":
        void handleIconPlacementReported(message.data?.placement, sender, sendResponse);
        break;

      default:
        break;
    }

    // Return true to indicate async response
    return true;
  },
);

/**
 * A content script placed the icon on a built-in Platform: kept for Settings, which offers to
 * place the icon while it is on the Anchored overlay. The hostname is the sender tab's, never one
 * the message names.
 */
async function handleIconPlacementReported(
  placement: PlacementReport | undefined,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: PlacementReportResponse) => void,
) {
  const hostname = repairablePlatformHostname(sender.tab?.url);
  if (!hostname || (placement !== "toolbar" && placement !== "overlay" && placement !== "override")) {
    sendResponse({ success: false, error: "Not a placement report of a built-in platform", permanent: true });
    return;
  }
  try {
    await changeIconPlacementRepairs({ type: "reportPlacement", hostname, placement });
    sendResponse({ success: true });
  } catch (error) {
    Logger.error("Failed to record the icon placement", toError(error), {
      component: "Background",
      hostname,
    });
    sendResponse({ success: false, error: getErrorMessage(error) });
  }
}

/**
 * Handle manual injection requests from popup/side panel
 */
async function handleRequestInjection(
  tabId: number | undefined,
  sendResponse: (response?: { success: boolean; error?: string }) => void,
) {
  let targetTabId = tabId;

  try {
    if (!targetTabId) {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs.length > 0 && tabs[0]?.id) {
        targetTabId = tabs[0].id;
      }
    }

    if (!targetTabId) {
      sendResponse({ success: false, error: "No valid tab found" });
      return;
    }

    await injector.forceInjectContentScript(targetTabId);
    sendResponse({ success: true });
  } catch (error) {
    Logger.error("Manual injection failed", toError(error), {
      component: "Background",
      tabId: targetTabId,
    });
    sendResponse({ success: false, error: getErrorMessage(error) });
  }
}

/**
 * Handle dynamic permission requests for custom sites
 */
async function handleRequestPermission(
  origins: string[],
  sendResponse: (response?: { success: boolean; error?: string }) => void,
) {
  try {
    const granted = await chrome.permissions.request({
      origins: origins,
    });

    if (granted) {
      // Store the permission grant for tracking
      const settings = await chrome.storage.local.get(["grantedPermissions"]);
      const grantedPermissions =
        (settings.grantedPermissions as string[] | undefined) || [];

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
          const matchesOrigin = origins.some((origin) => {
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
    Logger.error("Permission request failed", toError(error), {
      component: "Background",
      origins,
    });
    sendResponse({ success: false, error: getErrorMessage(error) });
  }
}

async function handlePromptUsageIncrement(
  data: { promptId?: string; platform?: PlatformType; categoryId?: string | null } | undefined,
  sendResponse: (response?: { success: boolean; error?: string }) => void,
) {
  const promptId = data?.promptId;
  const platform = data?.platform;
  const categoryId = data?.categoryId ?? null;

  if (!promptId) {
    sendResponse({ success: false, error: "Prompt ID is required" });
    return;
  }

  try {
    // Record analytics event (parallel operations)
    const usageTracker = UsageTracker.getInstance();
    await Promise.all([
      storageManager.incrementUsageCount(promptId),
      platform ? usageTracker.record(promptId, platform, categoryId) : Promise.resolve()
    ]);
    sendResponse({ success: true });
  } catch (error) {
    Logger.error("Failed to increment prompt usage", toError(error), {
      component: "Background",
      promptId,
      platform,
    });
    sendResponse({ success: false, error: getErrorMessage(error) });
  }
}

/**
 * Handle extension updates by re-injecting content scripts
 * This method gracefully handles existing tabs that may have orphaned content scripts
 */
async function handleExtensionUpdate(): Promise<void> {
  try {
    const allEnabledHosts = enabledHostnames(await readSiteSettings());

    // Get all tabs and identify those that need re-injection
    const tabs = await chrome.tabs.query({});
    const reinjectionResults: Array<{
      tabId: number;
      hostname: string;
      success: boolean;
    }> = [];

    for (const tab of tabs) {
      if (tab.id && tab.url) {
        try {
          const url = new URL(tab.url);
          const hostname = url.hostname;

          if (allEnabledHosts.includes(hostname)) {
            // Try to inject - this will be handled gracefully for orphaned tabs
            const result = await injector.forceInjectContentScript(tab.id);
            reinjectionResults.push({
              tabId: tab.id,
              hostname,
              success: result.success,
            });
          }
        } catch {
          // Invalid URL, skip
          continue;
        }
      }
    }

    // Only log if there were actual issues during re-injection
    const failedReinjections = reinjectionResults.filter((r) => !r.success);
    if (failedReinjections.length > 0) {
      Logger.warn(
        `Some tabs could not be re-injected after extension update (${failedReinjections.length.toString()}/${reinjectionResults.length.toString()} failed). This is normal for orphaned tabs - they will work after refresh.`,
        {
          component: "ContentScriptInjector",
          failedCount: failedReinjections.length,
          totalTabs: reinjectionResults.length,
          failedTabIds: failedReinjections.map((r) => r.tabId),
        },
      );
    } else if (reinjectionResults.length > 0) {
      Logger.info(
        `Successfully re-injected content scripts in ${reinjectionResults.length.toString()} tabs after extension update`,
        {
          component: "ContentScriptInjector",
          totalTabs: reinjectionResults.length,
        },
      );
    }

    // Extension update processing complete
  } catch (error) {
    Logger.error("Error handling extension update", toError(error), {
      component: "Background",
      phase: "extension_update",
    });
  }
}

/**
 * Clean stored Prompts and Category names of Hidden characters on extension update, and again
 * at every browser startup so a pass that failed or was cut short is retried (ADR-001). The pass
 * writes nothing on a clean Library. Independent of the re-injection above: nothing waits for
 * it, and a failure is logged here and never reaches the caller.
 */
async function upgradeStoredData(): Promise<void> {
  try {
    const { promptsChanged, categoriesChanged } =
      await storageManager.upgradeStoredData();

    if (promptsChanged || categoriesChanged) {
      Logger.info("Cleaned stored data of Hidden characters", {
        component: "Background",
        promptsChanged,
        categoriesChanged,
      });
    }
  } catch (error) {
    Logger.error(
      "Error cleaning stored data of Hidden characters",
      toError(error),
      { component: "Background", phase: "upgrade_pass" },
    );
  }
}

/**
 * Get the current interface mode from storage
 */
async function getInterfaceMode(): Promise<InterfaceMode> {
  const result = await chrome.storage.local.get("interfaceMode");
  return (result.interfaceMode as InterfaceMode | undefined) || "sidepanel";
}

/**
 * Update the action button behavior based on interface mode
 */
async function updateActionBehavior(mode: InterfaceMode): Promise<void> {
  if (mode === "popup") {
    // Set popup for action button
    await chrome.action.setPopup({ popup: "src/popup.html" });
  } else {
    // Clear popup to enable onClicked event for side panel
    await chrome.action.setPopup({ popup: "" });
  }
}

/**
 * Handle getting the interface mode
 */
async function handleGetInterfaceMode(
  sendResponse: (response?: { mode: InterfaceMode }) => void,
) {
  const mode = await getInterfaceMode();
  sendResponse({ mode });
}

/**
 * Open picker in a new window to prevent popup from closing
 */
async function handleOpenPickerWindow(
  targetTabId: number | undefined,
  sendResponse: (response?: { success: boolean; error?: string }) => void,
) {
  try {
    // Store the original tab that we're picking from
    let originalTabId: number | null = null;
    let originalUrl = "";
    let originalHostname = "";

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
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
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
      picker: "true",
      originalUrl: originalUrl,
      originalHostname: originalHostname,
      originalTabId: String(originalTabId || ""),
    });

    // Create a new window with the popup HTML and original tab info
    const window = await chrome.windows.create({
      url: chrome.runtime.getURL(`src/popup.html?${params.toString()}`),
      type: "popup",
      width: 400,
      height: 600,
      left: 100,
      top: 100,
    });

    await pickerWindow.update({ windowId: window?.id ?? null, originalTabId });
    sendResponse({ success: true });
  } catch (error) {
    Logger.error("Error opening picker window", toError(error), {
      component: "Background",
      targetTabId,
    });
    sendResponse({ success: false, error: getErrorMessage(error) });
  }
}

/**
 * Start element picker mode
 */
async function handleStartElementPicker(
  passedTabId: number | undefined,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: {
    success: boolean;
    error?: string;
    tabId?: number;
  }) => void,
  repairHostname?: string,
) {
  try {
    // Determine which tab to activate picker on
    let targetTabId: number | null = null;

    // First priority: the explicitly passed tab ID (from picker window); second, the original
    // tab stored as the picker window opened, if any
    const storedTabId = passedTabId ? null : (await pickerWindow.read()).originalTabId;
    if (passedTabId) {
      targetTabId = passedTabId;
    } else if (storedTabId) {
      targetTabId = storedTabId;
    } else {
      // Otherwise, get the active tab (but not the popup itself)
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs.length > 0 && tabs[0]) {
        const activeTab = tabs[0];
        // Don't activate on extension pages
        if (activeTab.url && !activeTab.url.startsWith("chrome-extension://")) {
          targetTabId = activeTab.id || null;
        }
      }
    }

    if (!targetTabId) {
      sendResponse({
        success: false,
        error: "No valid tab found for element picking",
      });
      return;
    }

    // Get the tab details
    const tab = await chrome.tabs.get(targetTabId);
    if (!tab.url) {
      sendResponse({ success: false, error: "Cannot access tab URL" });
      return;
    }

    // A repair is kept only for the built-in Platform the tab is on
    if (repairHostname !== undefined && repairablePlatformHostname(tab.url) !== repairHostname) {
      sendResponse({ success: false, error: "The tab is not on this platform" });
      return;
    }

    // Store picker session
    await pickerSessions.set({
      tabId: targetTabId,
      windowId: sender.tab?.windowId || 0,
      ...(repairHostname !== undefined ? { repairHostname } : {}),
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
        const injectionResult =
          await injector.forceInjectContentScript(targetTabId);

        if (!injectionResult.success) {
          sendResponse({
            success: false,
            error:
              injectionResult.error ||
              "Failed to inject content script. Please refresh the page and try again.",
          });
          return;
        }

        // Wait a bit for the script to initialize
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      Logger.error("Error checking/injecting content script", toError(error), {
        component: "Background",
        tabId: targetTabId,
      });
      sendResponse({
        success: false,
        error:
          "Failed to initialize content script. Please refresh the page and try again.",
      });
      return;
    }

    // Now send the message to activate element picker
    try {
      await chrome.tabs.sendMessage(targetTabId, {
        type: "ACTIVATE_ELEMENT_PICKER",
        source: "background",
      });
      sendResponse({ success: true, tabId: targetTabId });
    } catch (messageError) {
      Logger.error("Failed to activate element picker", toError(messageError), {
        component: "Background",
        tabId: targetTabId,
      });
      sendResponse({
        success: false,
        error:
          "Failed to activate element picker. Please refresh the page and try again.",
      });
    }
  } catch (error) {
    Logger.error("Error starting element picker", toError(error), {
      component: "Background",
      passedTabId,
      senderTabId: sender.tab?.id,
    });
    sendResponse({ success: false, error: getErrorMessage(error) });
  }
}

/**
 * Handle element selection from content script
 */
async function handleElementSelected(
  data: BackgroundMessage["data"],
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: { success: boolean; error?: string }) => void,
) {
  try {
    const tabId = sender.tab?.id;

    const session = tabId ? await pickerSessions.get(tabId) : undefined;
    if (!tabId || !session) {
      sendResponse({ success: false, error: "No active picker session" });
      return;
    }

    // Remove session
    await pickerSessions.delete(tabId);

    // A pick for a built-in Platform's icon is its override, stored here: the popup that asked
    // for it has closed by now. The content script places the icon there when storage changes.
    if (session.repairHostname) {
      const positioning = overrideFromPick(data);
      if (!positioning || repairablePlatformHostname(sender.tab?.url) !== session.repairHostname) {
        sendResponse({ success: false, error: "The pick names no element of this platform" });
        return;
      }
      await changeIconPlacementRepairs({ type: "setOverride", hostname: session.repairHostname, positioning });
      await pickerWindow.update({ originalTabId: null });
      sendResponse({ success: true });
      return;
    }

    // Forward selected element data to all popup instances and the picker window
    void chrome.runtime.sendMessage({
      type: "ELEMENT_PICKER_RESULT",
      data: {
        fingerprint: data?.fingerprint, // NEW: Forward fingerprint
        selector: data?.selector,
        elementType: data?.elementType,
        elementInfo: data?.elementInfo,
        hostname: data?.hostname,
      },
    });

    // If we have a picker window, focus it
    const { windowId } = await pickerWindow.read();
    if (windowId) {
      try {
        await chrome.windows.update(windowId, { focused: true });
      } catch {
        // Window might be closed, ignore
        await pickerWindow.update({ windowId: null });
      }
    }

    // Clear the original tab reference; the window id is left as windows.onRemoved may have cleared it meanwhile
    await pickerWindow.update({ originalTabId: null });

    sendResponse({ success: true });
  } catch (error) {
    Logger.error("Error handling element selection", toError(error), {
      component: "Background",
      senderTabId: sender.tab?.id,
    });
    sendResponse({ success: false, error: getErrorMessage(error) });
  }
}

/**
 * Stop element picker mode
 */
async function handleStopElementPicker(
  _passedTabId: number | undefined,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: { success: boolean; error?: string }) => void,
) {
  let tabIds: number[] = [];
  try {
    // Clear all active sessions
    tabIds = await pickerSessions.tabIds();
    for (const tabId of tabIds) {
      await chrome.tabs
        .sendMessage(tabId, {
          type: "DEACTIVATE_ELEMENT_PICKER",
          source: "background",
        })
        .catch(() => {
          // Tab might be closed, ignore error
        });
    }

    if (tabIds.length > 0) {
      await chrome.storage.session.remove(tabIds.map(pickerSessionKey));
    }
    sendResponse({ success: true });
  } catch (error) {
    Logger.error("Error stopping element picker", toError(error), {
      component: "Background",
      activeSessionCount: tabIds.length,
    });
    sendResponse({ success: false, error: getErrorMessage(error) });
  }
}

// Clean up on window close
chrome.windows.onRemoved.addListener((windowId) => {
  void (async () => {
    if ((await pickerWindow.read()).windowId !== windowId) {
      return;
    }
    await pickerWindow.update(NO_PICKER_WINDOW);
    // Stop any active picker sessions
    await handleStopElementPicker(
      undefined,
      { tab: undefined } as chrome.runtime.MessageSender,
      () => undefined,
    );
  })().catch((error: unknown) => {
    Logger.warn("Could not stop the picker as its window closed", {
      component: "Background",
      windowId,
      error: getErrorMessage(error),
    });
  });
});

// Handle connection for keeping popup alive
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup-keep-alive") {
    port.onDisconnect.addListener(() => {
      // Cleanup any active picker sessions when popup closes
      void handleStopElementPicker(
        undefined,
        { tab: undefined } as chrome.runtime.MessageSender,
        () => undefined,
      );
    });
  }
});

// Initialize interface mode on extension startup and handle updates
chrome.runtime.onInstalled.addListener((details) => {
  // Clean stored data of Hidden characters after an update, alongside (not before) the rest
  if (details.reason === "update") {
    void upgradeStoredData();
  }

  void (async () => {
    try {
      const mode = await getInterfaceMode();
      await updateActionBehavior(mode);

      // Re-inject content scripts after extension updates
      if (details.reason === "update") {
        // Extension updated, re-injecting content scripts
        await handleExtensionUpdate();
      }
    } catch (error) {
      Logger.error(
        "Error initializing interface mode on install",
        toError(error),
        { component: "Background", reason: details.reason },
      );
    }
  })();
});

// Initialize interface mode on browser startup
chrome.runtime.onStartup.addListener(() => {
  // Retry the upgrade pass: one that failed or was cut short on update left stored data uncleaned
  void upgradeStoredData();

  void (async () => {
    try {
      const mode = await getInterfaceMode();
      await updateActionBehavior(mode);
    } catch (error) {
      Logger.error(
        "Error initializing interface mode on startup",
        toError(error),
        { component: "Background", phase: "startup" },
      );
    }
  })();
});

// Handle action button clicks for side panel mode
chrome.action.onClicked.addListener((tab) => {
  // This handler only fires when popup is not set (i.e., in side panel mode)
  // We can safely open the side panel here as it's a direct user action
  if (tab.windowId) {
    try {
      void chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (error) {
      Logger.error("Error opening side panel", toError(error), {
        component: "Background",
        windowId: tab.windowId,
        tabId: tab.id,
      });
    }
  }
});

// Listen for storage changes to update interface mode
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && "interfaceMode" in changes) {
    const interfaceModeChange = changes.interfaceMode;
    if (interfaceModeChange.newValue) {
      void (async () => {
        try {
          const newMode = interfaceModeChange.newValue as InterfaceMode;
          await updateActionBehavior(newMode);
        } catch (error) {
          Logger.error("Error updating interface mode", toError(error), {
            component: "Background",
            newMode: interfaceModeChange.newValue,
          });
        }
      })();
    }
  }
});

export {};
