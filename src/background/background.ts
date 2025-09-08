/**
 * Background script for Chrome extension
 * Handles message passing and coordination between popup and content scripts
 */

// Track active element picker sessions
const activePickerSessions = new Map<number, { tabId: number; windowId: number }>();

// Interface mode types
type InterfaceMode = 'popup' | 'sidepanel';

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

// Message types for element picker
interface ElementPickerMessage {
  type: 'START_ELEMENT_PICKER' | 'STOP_ELEMENT_PICKER' | 'ELEMENT_SELECTED' | 'PICKER_CANCELLED' | 'OPEN_PICKER_WINDOW' | 'GET_INTERFACE_MODE';
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

    case 'GET_INTERFACE_MODE':
      void handleGetInterfaceMode(sendResponse);
      break;

    default:
      break;
  }

  // Return true to indicate async response
  return true;
});

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

    // Try to inject the content script if it's not already injected
    // This is needed for tabs that were open before the extension was installed/updated
    try {
      // First, try to ping the content script
      await chrome.tabs.sendMessage(targetTabId, { type: 'PING' });
    } catch {
      // Content script not injected, inject it now
      try {
        await chrome.scripting.executeScript({
          target: { tabId: targetTabId },
          files: ['assets/index.ts-Do1Z669-.js']  // The bundled content script
        });
        
        // Wait a bit for the script to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (injectError) {
        console.error('[Background] Failed to inject content script:', injectError);
        sendResponse({ success: false, error: 'Failed to inject content script. Please refresh the page and try again.' });
        return;
      }
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

// Initialize interface mode on extension startup
chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    try {
      const mode = await getInterfaceMode();
      await updateActionBehavior(mode);
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