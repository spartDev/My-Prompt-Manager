/**
 * Background script for Chrome extension
 * Handles message passing and coordination between popup and content scripts
 */

// Track active element picker sessions
const activePickerSessions = new Map<number, { tabId: number; windowId: number }>();

// Track the picker window
let pickerWindowId: number | null = null;
let originalTabId: number | null = null;

// Message types for element picker
interface ElementPickerMessage {
  type: 'START_ELEMENT_PICKER' | 'STOP_ELEMENT_PICKER' | 'ELEMENT_SELECTED' | 'PICKER_CANCELLED' | 'OPEN_PICKER_WINDOW';
  data?: {
    selector?: string;
    elementType?: string;
    elementInfo?: Record<string, unknown>;
    hostname?: string;
    tabId?: number;
  };
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message: ElementPickerMessage, sender, sendResponse) => {
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

    default:
      break;
  }

  // Return true to indicate async response
  return true;
});

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

    // Store picker session
    activePickerSessions.set(targetTabId, {
      tabId: targetTabId,
      windowId: sender.tab?.windowId || 0
    });

    // Switch to the target tab
    await chrome.tabs.update(targetTabId, { active: true });
    
    // Focus on the tab's window
    const tab = await chrome.tabs.get(targetTabId);
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }

    // Inject element picker into the target tab
    await chrome.tabs.sendMessage(targetTabId, {
      type: 'ACTIVATE_ELEMENT_PICKER',
      source: 'background'
    });

    sendResponse({ success: true, tabId: targetTabId });
  } catch (error) {
    console.error('[Background] Error starting element picker:', error);
    sendResponse({ success: false, error: String(error) });
  }
}

/**
 * Handle element selection from content script
 */
async function handleElementSelected(data: ElementPickerMessage['data'], sender: chrome.runtime.MessageSender, sendResponse: (response?: { success: boolean; error?: string }) => void) {
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

export {};