/**
 * Background script for Chrome extension
 * Handles message passing, content script injection, and coordination between popup and content scripts
 */

import {
  changeIconPlacementRepairs,
  expectIconPlacementReports,
  forgetIconPlacementTab,
  isPlacementReport,
  moveIconPlacementTab,
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
  upgradeStoredSiteSettings,
} from "../services/siteSettings";
import { StorageManager } from "../services/storage";
import { UsageTracker } from "../services/UsageTracker";
import type { ElementFingerprint, PlatformType } from "../types";
import { getErrorMessage, Logger, toError } from "../utils";
import { markExistingUserDone, recordWelcomePending } from "../welcome/storage";
import { recordInstall, recordUpdateFrom } from "../whatsNew/storage";

/** An Element picker open in a tab, from START_ELEMENT_PICKER until the pick or its cancel */
interface PickerSession {
  tabId: number;
  windowId: number;
  /** Set when the pick repairs the icon placement of this built-in Platform (Settings, "Place the icon") */
  repairHostname?: string;
  /** The START_ELEMENT_PICKER that stored it: a stop removes a session only as it saw it, never a newer start's */
  attempt?: string;
  /** When its activation was sent, in the order of all activations: a cancel removes it if sent no later than the one cancelled */
  activation?: number;
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
    && (session.repairHostname === undefined || typeof session.repairHostname === "string")
    && (session.attempt === undefined || typeof session.attempt === "string")
    && (session.activation === undefined || typeof session.activation === "number");
}

// The changes of picker sessions run one after the other, so a change that reads then writes is one step
let pickerSessionChanges: Promise<unknown> = Promise.resolve();
function changePickerSessions<T>(change: () => Promise<T>): Promise<T> {
  const run = pickerSessionChanges.then(change);
  pickerSessionChanges = run.catch(() => undefined);
  return run;
}

/** The sessions held now, by tab, with the start that stored each */
async function readPickerSessions(): Promise<Map<number, PickerSession>> {
  const stored = await chrome.storage.session.get(null);
  const sessions = new Map<number, PickerSession>();
  for (const [key, value] of Object.entries(stored)) {
    if (key.startsWith(PICKER_SESSION_KEY_PREFIX) && isPickerSession(value)) {
      sessions.set(value.tabId, value);
    }
  }
  return sessions;
}

/**
 * A START_ELEMENT_PICKER not yet stored. A stop that runs meanwhile finds no session to end, so it
 * marks the starts in flight instead: each one it marked stores nothing, and ends its picker if it
 * already sent its activation. Held in memory: a service worker restart ends the starts in flight with it.
 */
interface PickerStart {
  stopped: boolean;
  /** Names its activation in the page, and its session */
  attempt: string;
  /** The tab it activates the picker in, once known: a cancel there stops it too */
  tabId?: number;
  /** When its activation was sent, in the order of all activations; 0 until then */
  activation: number;
  /**
   * Set while its store step writes its session, past the stop check: a cancel does not count it
   * among the starts it stops, since it will keep its picker once the write succeeds. Should the
   * write fail, the step itself removes the older session (see pickerSessions.set).
   */
  storing?: boolean;
}
const pickerStarts = new Set<PickerStart>();

/**
 * By tab, the latest activation sent there that the page answered. The page keeps the picker of the
 * last activation it received, and those arrive in the order they were sent, whatever the order
 * their answers come back in: a start whose activation a later one followed stores no session,
 * so the session stored always names the activation the page holds. An activation sent again,
 * while the content script did not listen yet, is numbered again when it is sent.
 */
let pickerActivationsSent = 0;

/**
 * The stamp of an activation sent now: above every one this service worker sent before, and above
 * those of a session stored before it restarted as long as the clock was not set back meanwhile
 */
function nextPickerActivation(): number {
  pickerActivationsSent = Math.max(Date.now(), pickerActivationsSent + 1);
  return pickerActivationsSent;
}
const pickerActivationsAnswered = new Map<number, number>();

/**
 * The open picker sessions, in chrome.storage.session under one key per tab, not in memory: Chrome
 * stops the service worker after about 30 s with no event, and hovering the page sends none, so a
 * session held in memory would be gone by the time the user clicks, and the pick lost. Every
 * change goes through one chain, and a change that depends on what is stored reads it in its step.
 */
const pickerSessions = {
  async get(tabId: number): Promise<PickerSession | undefined> {
    const key = pickerSessionKey(tabId);
    const stored: unknown = (await chrome.storage.session.get(key))[key];
    return isPickerSession(stored) ? stored : undefined;
  },
  /**
   * Stores the session of a picker now active in its tab, unless a stop marked its start
   * ("stopped") or a later activation in the tab took over the picker ("superseded"). Checked in
   * the step, so a stop either marked the start first or reads the session it stored.
   */
  set(session: PickerSession, start: PickerStart): Promise<"stored" | "stopped" | "superseded"> {
    return changePickerSessions(async () => {
      if (start.stopped) {
        return "stopped";
      }
      if ((pickerActivationsAnswered.get(session.tabId) ?? 0) > start.activation) {
        return "superseded";
      }
      start.storing = true;
      try {
        await chrome.storage.session.set({ [pickerSessionKey(session.tabId)]: session });
      } catch (error) {
        start.storing = false;
        // The page took this start's activation after the older session's, so that session has
        // no picker left: it goes too. Should this removal fail as well, after the write (two
        // storage failures), the older session stays until something else removes it
        const older = await pickerSessions.get(session.tabId).catch(() => undefined);
        if (older && (older.activation ?? 0) < start.activation) {
          await chrome.storage.session.remove(pickerSessionKey(session.tabId)).catch(() => undefined);
        }
        throw error;
      }
      return "stored";
    });
  },
  /** Takes the tab's session for a pick: read and removed in one step */
  take(tabId: number): Promise<PickerSession | undefined> {
    return changePickerSessions(async () => {
      const session = await pickerSessions.get(tabId);
      if (session) {
        await chrome.storage.session.remove(pickerSessionKey(tabId));
      }
      return session;
    });
  },
  delete(tabId: number): Promise<void> {
    return changePickerSessions(() => chrome.storage.session.remove(pickerSessionKey(tabId)));
  },
  /**
   * Removes the tab's session as its picker is cancelled, read and removed in one step. The session
   * goes if it is the cancelled start's, or of an activation sent no later than `activation`, the
   * latest one among the starts in flight the cancel stopped, which each end their own picker. A
   * session of a later activation is kept: its picker is the one the page holds now. With no start
   * named, the session goes whichever it is.
   */
  cancel(tabId: number, attempt: string | undefined, activation: number | undefined): Promise<void> {
    return changePickerSessions(async () => {
      const session = await pickerSessions.get(tabId);
      if (!session) {
        return;
      }
      const cancelled = attempt === undefined
        || session.attempt === attempt
        || (activation !== undefined && (session.activation ?? 0) <= activation);
      if (cancelled) {
        await chrome.storage.session.remove(pickerSessionKey(tabId));
      }
    });
  },
  /** The sessions held now, to stop them */
  snapshot(): Promise<Map<number, PickerSession>> {
    return changePickerSessions(readPickerSessions);
  },
  /** Removes the sessions of a snapshot still as they were: a start since keeps its own */
  removeUnchanged(snapshot: ReadonlyMap<number, PickerSession>): Promise<void> {
    return changePickerSessions(async () => {
      const current = await readPickerSessions();
      const keys = [...snapshot.values()]
        .filter((session) => current.get(session.tabId)?.attempt === session.attempt)
        .map((session) => pickerSessionKey(session.tabId));
      if (keys.length > 0) {
        await chrome.storage.session.remove(keys);
      }
    });
  },
};

/** Forgets a tab's picker session, as its tab closes */
function forgetPickerSession(tabId: number): void {
  pickerActivationsAnswered.delete(tabId);
  pickerSessions.delete(tabId).catch((error: unknown) => {
    Logger.warn("Could not forget a picker session", {
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
  forgetPlacementTab(tabId, null);
});

// A tab whose page Chrome swapped (a prerender, a discard) gets a new id: its placement on the
// Platform the new page is on goes with it, whatever order Chrome tells the swap and the new URL in;
// its placements on other Platforms are forgotten
chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  void movePlacementTab(removedTabId, addedTabId);
});

async function movePlacementTab(removedTabId: number, addedTabId: number): Promise<void> {
  try {
    const tab = await chrome.tabs.get(addedTabId).catch(() => undefined);
    const hostname = repairablePlatformHostname(tab?.url);
    if (hostname) {
      await moveIconPlacementTab(removedTabId, addedTabId, hostname);
    }
  } catch (error) {
    Logger.warn("Could not move the icon placement of a replaced tab", { component: "Background", addedTabId, removedTabId, error: getErrorMessage(error) });
  }
  forgetPlacementTab(removedTabId, null);
}

// A tab that leaves a Platform no longer keeps its icon placement repair
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url !== undefined) {
    forgetPlacementTab(tabId, repairablePlatformHostname(changeInfo.url));
  }
});

/** Forgets the icon placement of a tab, but on the Platform it is on now */
function forgetPlacementTab(tabId: number, keepHostname: string | null): void {
  forgetIconPlacementTab(tabId, keepHostname).catch((error: unknown) => {
    Logger.warn("Could not forget the icon placement of a tab", {
      component: "Background",
      tabId,
      error: getErrorMessage(error),
    });
  });
}

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
  async update(change: Partial<PickerWindow>): Promise<void> {
    await changePickerWindow(() => change);
  },
  /** Forgets the tab it picks in if it is this one: a picker window opened since for another tab keeps its own */
  async forgetTabIf(tabId: number): Promise<void> {
    await changePickerWindow((current) => (current.originalTabId === tabId ? { originalTabId: null } : null));
  },
  /**
   * Forgets the picker window if it is this one, in one change: a window opened since keeps its
   * record. True when it was this one.
   */
  async forgetIf(windowId: number): Promise<boolean> {
    let matched = false;
    await changePickerWindow((current) => {
      matched = current.windowId === windowId;
      return matched ? NO_PICKER_WINDOW : null;
    });
    return matched;
  },
};

/** Runs a change of the picker window after the ones before it; a change that returns null writes nothing */
function changePickerWindow(change: (current: PickerWindow) => Partial<PickerWindow> | null): Promise<void> {
  const run = pickerWindowUpdates.then(async () => {
    const current = await pickerWindow.read();
    const fields = change(current);
    if (fields === null) {
      return;
    }
    const next = { ...current, ...fields };
    if (next.windowId === null && next.originalTabId === null) {
      await chrome.storage.session.remove(PICKER_WINDOW_KEY);
      return;
    }
    await chrome.storage.session.set({ [PICKER_WINDOW_KEY]: next });
  });
  pickerWindowUpdates = run.catch(() => undefined);
  return run;
}

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
  /** PICKER_CANCELLED: the start whose picker the page cancelled */
  attempt?: string;
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

      case "PICKER_CANCELLED":
        // From the picker in a tab (Escape, or its page unloading): only that tab's pick ends
        if (sender.tab?.id !== undefined) {
          void handlePickerCancelled(sender.tab.id, message.attempt, sendResponse);
          break;
        }
        void handleStopElementPicker(undefined, sender, sendResponse);
        break;

      case "STOP_ELEMENT_PICKER":
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
  // A prerendered page is not the tab's page yet: its sender tab is the page it may replace
  if (sender.documentLifecycle === "prerender") {
    sendResponse({ success: false, error: "Not the tab's page yet" });
    return;
  }
  const hostname = repairablePlatformHostname(sender.tab?.url);
  if (!hostname || !isPlacementReport(placement)) {
    sendResponse({ success: false, error: "Not a placement report of a built-in platform", permanent: true });
    return;
  }
  try {
    await changeIconPlacementRepairs({ type: "reportPlacement", hostname, placement, tabId: sender.tab?.id });
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
 * Gives the content script to each open tab of a site the extension works on, as the extension
 * starts in it. After an update, the tabs' content scripts are orphaned: this handles them gracefully.
 * After a first install, a tab opened before has none: Chrome runs a manifest's content scripts only
 * in pages loaded after the extension, and the Welcome tells a new user to type // in their AI chat
 * (decision D1, My-Prompt-Manager-ojz.19), so that chat must answer without a reload. On a fresh
 * install no Site settings are stored (the defaults apply) and no icon placement either, so the
 * count of the placement reports below does nothing.
 */
async function injectIntoOpenTabs(reason: "install" | "update"): Promise<void> {
  try {
    const allEnabledHosts = enabledHostnames(await readSiteSettings());

    // Get all tabs and identify those that need re-injection
    const tabs = await chrome.tabs.query({});
    await expectPlacementReports(async () => ({ tabs, enabledHosts: allEnabledHosts }));
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
        `Some tabs could not be re-injected after extension ${reason} (${failedReinjections.length.toString()}/${reinjectionResults.length.toString()} failed). This is normal for orphaned tabs - they will work after refresh.`,
        {
          component: "ContentScriptInjector",
          failedCount: failedReinjections.length,
          totalTabs: reinjectionResults.length,
          failedTabIds: failedReinjections.map((r) => r.tabId),
        },
      );
    } else if (reinjectionResults.length > 0) {
      Logger.info(
        `Successfully re-injected content scripts in ${reinjectionResults.length.toString()} tabs after extension ${reason}`,
        {
          component: "ContentScriptInjector",
          totalTabs: reinjectionResults.length,
        },
      );
    }
  } catch (error) {
    Logger.error(`Error handling extension ${reason}`, toError(error), {
      component: "Background",
      phase: `extension_${reason}`,
    });
  }
}

/**
 * An extension update or a browser restart emptied the icon placement of each tab (session storage)
 * while the repairs stay: each open tab of an enabled Platform, discarded ones included, counts as
 * waiting until its content script reports, so the first report does not drop a pick another tab
 * needs. On update (and on install, which finds no repair), before the re-injection, so no report
 * comes first; the update read the open tabs before, for the re-injection. At startup,
 * `readOpenTabs` reads them under the repairs lock, with the count. A failure is logged: the
 * re-injection, or the startup, goes on.
 */
async function expectPlacementReports(
  readOpenTabs: () => Promise<{ tabs: chrome.tabs.Tab[]; enabledHosts: readonly string[] }>,
): Promise<void> {
  try {
    await expectIconPlacementReports(async () => {
      const { tabs, enabledHosts } = await readOpenTabs();
      return tabs.flatMap((tab) => {
        const hostname = repairablePlatformHostname(tab.url);
        return tab.id !== undefined && hostname && enabledHosts.includes(hostname) ? [{ tabId: tab.id, hostname }] : [];
      });
    });
  } catch (error) {
    Logger.warn("Could not count the open tabs of the Platforms after an update or a restart", {
      component: "Background",
      error: getErrorMessage(error),
    });
  }
}

/**
 * A browser restart empties the icon placement of each tab (session storage) as an update does: the
 * restored tabs of an enabled Platform with a repair count as waiting until their content scripts
 * report, so a tab at another host of the Platform that reports first does not drop their repair as
 * one no tab is open for. The Site settings and the open tabs are read under the repairs lock, so no
 * report runs between that read and the count. A tab Chrome restores after this read is not counted
 * (design §6).
 */
function expectPlacementReportsOnStartup(): Promise<void> {
  return expectPlacementReports(async () => ({
    enabledHosts: enabledHostnames(await readSiteSettings()),
    tabs: await chrome.tabs.query({}),
  }));
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
 * Remove from the usage history the insertions older than the retention period (USAGE_RETENTION_DAYS,
 * the 30 days Analytics shows), on extension update and at every browser startup: each insertion
 * removes them too (UsageTracker.record), but without an insertion they would stay. A failure is
 * logged here and never reaches the caller.
 */
async function removeExpiredUsage(): Promise<void> {
  try {
    const removed = await UsageTracker.getInstance().cleanup();
    if (removed > 0) {
      Logger.info("Removed the usage history entries older than the retention period", {
        component: "Background",
        removed,
      });
    }
  } catch (error) {
    Logger.error(
      "Error removing the usage history entries older than the retention period",
      toError(error),
      { component: "Background", phase: "usage_retention" },
    );
  }
}

/**
 * Write the Site settings an earlier release stored as the list of the Platforms that were on, or
 * whose list it changed after a rollback, back as the Platform choices, on extension update and again at every browser startup, like the pass
 * above. Until it runs, every reader already reads the list as those choices: it only spares later
 * releases from reading the old shape. A failure is logged here and never reaches the caller.
 */
async function upgradeSiteSettings(): Promise<void> {
  try {
    if (await upgradeStoredSiteSettings()) {
      Logger.info("Stored the Site settings as Platform choices", { component: "Background" });
    }
  } catch (error) {
    Logger.error(
      "Error storing the Site settings as Platform choices",
      toError(error),
      { component: "Background", phase: "site_settings_upgrade" },
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

/** The answer to a start a stop ended while it activated */
const PICKER_STOPPED = "The element picker was stopped";
const PICKER_TAB_CLOSED = "The tab was closed";

/**
 * How long a content script just injected is given to listen for the picker's activation. Its loader
 * imports the script, which registers its listener once loaded: a moment, or seconds on a loaded
 * machine, where a fixed wait of 100 ms lost the activation (e2e, PR #576, 2026-11-16).
 */
const PICKER_LISTENER_TIMEOUT_MS = 5000;
const PICKER_LISTENER_RETRY_MS = 100;

/** Chrome's answer to a message sent to a tab where nothing listens yet */
const isNoListener = (error: unknown): boolean => /Receiving end does not exist/i.test(toError(error).message);

/**
 * Ends the picker a start activated in its tab, and only that one: the page has one picker per
 * tab, and a start since may have activated it again. A tab that closed has none to end.
 */
function deactivatePicker(tabId: number, attempt: string | undefined): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, { type: "DEACTIVATE_ELEMENT_PICKER", source: "background", attempt }).catch(() => undefined);
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
  // Names this start's activation in the page, and its session
  const attempt = crypto.randomUUID();
  const start: PickerStart = { stopped: false, attempt, activation: 0 };
  pickerStarts.add(start);
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
    start.tabId = targetTabId;

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


    // Switch to the target tab
    await chrome.tabs.update(targetTabId, { active: true });

    // Focus on the tab's window
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }

    // Use the ContentScriptInjector to ensure content script is injected. One already there listens
    // (its flag is set once its modules, the picker's listener among them, are loaded); one injected
    // now may not yet
    let justInjected = false;
    try {
      // Check if content script is already injected
      const isInjected = await injector.isContentScriptInjected(targetTabId);

      if (!isInjected) {
        justInjected = true;
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

    // A start stopped before it activates sends nothing: an activation sent after the stop could
    // reach the page after the one of a start since, and take its place
    if (start.stopped) {
      sendResponse({ success: false, error: PICKER_STOPPED });
      return;
    }

    // Now send the message to activate element picker. A content script injected a moment ago may
    // not listen yet: the activation is sent again until it does, the start is stopped or the tab
    // is gone. Each send takes a new number: one sent after a newer start's must not pass for older
    start.activation = nextPickerActivation();
    const listenedBy = Date.now() + PICKER_LISTENER_TIMEOUT_MS;
    try {
      for (;;) {
        try {
          await chrome.tabs.sendMessage(targetTabId, {
            type: "ACTIVATE_ELEMENT_PICKER",
            source: "background",
            attempt,
          });
          break;
        } catch (notListening) {
          if (!justInjected || !isNoListener(notListening) || Date.now() >= listenedBy) {
            throw notListening;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, PICKER_LISTENER_RETRY_MS));
        // A closed tab will never listen
        const open = await chrome.tabs.get(targetTabId).then(() => true, () => false);
        if (!open) {
          Logger.warn("The tab closed before the element picker could be activated", {
            component: "Background",
            tabId: targetTabId,
          });
          sendResponse({ success: false, error: PICKER_TAB_CLOSED });
          return;
        }
        // Checked last, with nothing awaited until the send: a stop during the wait sends nothing
        if (start.stopped) {
          sendResponse({ success: false, error: PICKER_STOPPED });
          return;
        }
        start.activation = nextPickerActivation();
      }
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
      return;
    }
    if ((pickerActivationsAnswered.get(targetTabId) ?? 0) < start.activation) {
      pickerActivationsAnswered.set(targetTabId, start.activation);
    }

    // Stored once the picker is active, never before: a start that fails leaves nothing behind,
    // and of two starts on one tab, the last one active is the one kept
    let stored: "stored" | "stopped" | "superseded";
    try {
      stored = await pickerSessions.set({
        tabId: targetTabId,
        windowId: sender.tab?.windowId || 0,
        ...(repairHostname !== undefined ? { repairHostname } : {}),
        attempt,
        activation: start.activation,
      }, start);
    } catch (error) {
      // A picker with no session would take a pick nobody keeps
      await deactivatePicker(targetTabId, attempt);
      throw error;
    }
    if (stored === "stopped") {
      // Stopped while it activated: the stop could not reach this picker, so it ends here
      await deactivatePicker(targetTabId, attempt);
      sendResponse({ success: false, error: PICKER_STOPPED });
      return;
    }
    // Superseded: the picker is active in the tab, under the later start that stores its session.
    // Should that start then fail to store it, it ends the picker and answers the failure itself.
    sendResponse({ success: true, tabId: targetTabId });
  } catch (error) {
    Logger.error("Error starting element picker", toError(error), {
      component: "Background",
      passedTabId,
      senderTabId: sender.tab?.id,
    });
    sendResponse({ success: false, error: getErrorMessage(error) });
  } finally {
    pickerStarts.delete(start);
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

    // Taken in one step: a start that lands meanwhile keeps its own session
    const session = tabId ? await pickerSessions.take(tabId) : undefined;
    if (!tabId || !session) {
      sendResponse({ success: false, error: "No active picker session" });
      return;
    }


    // A pick for a built-in Platform's icon is its override, stored here: the popup that asked
    // for it has closed by now. The content script places the icon there when storage changes.
    if (session.repairHostname) {
      const positioning = overrideFromPick(data);
      if (!positioning || repairablePlatformHostname(sender.tab?.url) !== session.repairHostname) {
        sendResponse({ success: false, error: "The pick names no element of this platform" });
        return;
      }
      await changeIconPlacementRepairs({ type: "setOverride", hostname: session.repairHostname, positioning });
      await pickerWindow.forgetTabIf(tabId);
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

    // If we have a picker window, focus it. One that closed is forgotten by windows.onRemoved, not here:
    // a window opened since may have taken its place
    const { windowId } = await pickerWindow.read();
    if (windowId) {
      await chrome.windows.update(windowId, { focused: true }).catch(() => undefined);
    }

    // Clear the original tab reference
    await pickerWindow.forgetTabIf(tabId);

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
 * The picker of one tab was cancelled there (Escape, or its page unloading): its session is
 * forgotten; the picks open in other tabs go on
 */
async function handlePickerCancelled(
  tabId: number,
  attempt: string | undefined,
  sendResponse: (response?: { success: boolean; error?: string }) => void,
) {
  // A start in flight in the tab would bring the picker back after the cancel: marked, it stores
  // nothing and ends its picker by its attempt, unless its store step already passed the stop check. A start whose tab is not known yet is not one of them:
  // every caller names the tab.
  // The latest activation sent among the starts it stops: each of them ends its own picker, so a
  // session of an activation sent no later has no picker left either
  let latestStopped: number | undefined;
  for (const start of pickerStarts) {
    if (start.tabId === tabId) {
      start.stopped = true;
      // One writing its session keeps its picker if the write succeeds: it is not counted
      if (start.activation > 0 && !start.storing) {
        latestStopped = Math.max(latestStopped ?? 0, start.activation);
      }
    }
  }
  try {
    // Not the session of a later start: it may have stored its own since, and its picker is the
    // one the page holds
    await pickerSessions.cancel(tabId, attempt, latestStopped);
    sendResponse({ success: true });
  } catch (error) {
    Logger.error("Error cancelling element picker", toError(error), {
      component: "Background",
      tabId,
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
  let sessions: Map<number, PickerSession> = new Map();
  // The starts in flight have no session yet: marked now, before the snapshot, they store none
  for (const start of pickerStarts) {
    start.stopped = true;
  }
  try {
    // Clear all active sessions: those held now, unless a start replaced one meanwhile
    sessions = await pickerSessions.snapshot();
    // Each picker as the snapshot saw it: one a start activated since in the same tab goes on
    for (const session of sessions.values()) {
      await deactivatePicker(session.tabId, session.attempt);
    }

    await pickerSessions.removeUnchanged(sessions);
    sendResponse({ success: true });
  } catch (error) {
    Logger.error("Error stopping element picker", toError(error), {
      component: "Background",
      activeSessionCount: sessions.size,
    });
    sendResponse({ success: false, error: getErrorMessage(error) });
  }
}

// Clean up on window close
chrome.windows.onRemoved.addListener((windowId) => {
  void (async () => {
    // Whether it is the picker window is in storage, so the stop marks the starts in flight only
    // once that is read: marked any earlier, a closing window of any kind would stop them. A start
    // made during that read is stopped with the picker window.
    if (!(await pickerWindow.forgetIf(windowId))) {
      return;
    }
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

/** Records the Release of a first install, so What's new never shows on it (CONTEXT.md, Releases) */
async function recordFirstInstall(): Promise<void> {
  const version = chrome.runtime.getManifest().version;
  try {
    await recordInstall(version);
    Logger.info("Recorded the Release of the first install", {
      component: "Background",
      version,
    });
  } catch (error) {
    Logger.error(
      "Could not record the Release of the first install",
      toError(error),
      { component: "Background", version },
    );
  }
}

/**
 * Records the Release an update came from, when the What's new record has no Release of install
 * (an install older than What's new), so What's new shows after that update (CONTEXT.md, Releases)
 */
async function recordUpdateOrigin(previousVersion: string | undefined): Promise<void> {
  try {
    const recorded = await recordUpdateFrom(previousVersion);
    if (recorded) {
      Logger.info("Recorded the Release the update came from", {
        component: "Background",
        previousVersion,
      });
    }
  } catch (error) {
    Logger.error(
      "Could not record the Release the update came from",
      toError(error),
      { component: "Background", previousVersion },
    );
  }
}

/**
 * Records the Welcome as pending at a first install, so the first opening shows it from its first
 * step (CONTEXT.md, Welcome). A record already stored is kept.
 */
async function recordWelcomeOfFirstInstall(): Promise<void> {
  try {
    const recorded = await recordWelcomePending();
    Logger.info(
      recorded
        ? "Recorded the Welcome as pending"
        : "Kept the Welcome record already stored",
      { component: "Background" },
    );
  } catch (error) {
    Logger.error(
      "Could not record the Welcome of the first install",
      toError(error),
      { component: "Background" },
    );
  }
}

/**
 * Marks the Welcome as done at an update when there is no Welcome record: the user installed a
 * Release from before the Welcome and never sees it (CONTEXT.md, Welcome). A record is kept.
 */
async function markWelcomeDoneForExistingUser(
  previousVersion: string | undefined,
): Promise<void> {
  try {
    const marked = await markExistingUserDone();
    if (marked) {
      Logger.info("Marked the Welcome as done for an existing user", {
        component: "Background",
        previousVersion,
      });
    }
  } catch (error) {
    Logger.error(
      "Could not mark the Welcome as done for an existing user",
      toError(error),
      { component: "Background", previousVersion },
    );
  }
}

// Initialize interface mode on extension startup and handle updates
chrome.runtime.onInstalled.addListener((details) => {
  // Clean stored data of Hidden characters, and remove the usage history entries older than the
  // retention period, after an update, alongside (not before) the rest
  if (details.reason === "update") {
    void upgradeStoredData();
    void upgradeSiteSettings();
    void removeExpiredUsage();
  }

  // A first install records its Release; an update records where it came from, only when the
  // What's new record has no Release of install yet. A first install records the Welcome as
  // pending; an update marks it done when there is no Welcome record (an existing user). Other
  // reasons (chrome_update, shared_module_update) write neither record
  if (details.reason === "install") {
    void recordFirstInstall();
    void recordWelcomeOfFirstInstall();
  }
  if (details.reason === "update") {
    void recordUpdateOrigin(details.previousVersion);
    void markWelcomeDoneForExistingUser(details.previousVersion);
  }

  void (async () => {
    try {
      const mode = await getInterfaceMode();
      await updateActionBehavior(mode);

      // The content script in the open tabs of the sites the extension works on: re-injected after
      // an update, injected after a first install into the tabs opened before it
      if (details.reason === "update" || details.reason === "install") {
        await injectIntoOpenTabs(details.reason);
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
  void upgradeSiteSettings();
  void expectPlacementReportsOnStartup();
  void removeExpiredUsage();

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
