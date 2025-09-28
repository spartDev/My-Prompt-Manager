# Custom Site Icons Disappearing Bug Fix

## Problem Description
Custom site icons were disappearing after page reload (F5 or browser refresh) but would reappear when opening/closing the extension popup. This issue started in version 1.4.0 and persisted in 1.4.1.

## Root Cause
The issue had multiple layers:

1. **Manifest vs Programmatic Injection**: Sites listed in `manifest.json` (Claude, ChatGPT, Perplexity, Mistral) have automatic content script injection via Chrome's `content_scripts` field. Custom sites rely on programmatic injection via the background script.

2. **Stale Injection Tracking**: The `ContentScriptInjector` tracked injected tabs in a Set by tab ID. When a page reloaded:
   - The browser cleared all injected content (including icons)
   - The tab ID remained the same
   - The `injectedTabs` Set still contained that tab ID
   - The injector would skip re-injection thinking it was already injected

3. **Missing Verification**: The injector trusted its memory (`injectedTabs` Set) without verifying if the content script was actually present in the page after reload.

## The Fix
The solution was to add special handling for custom sites that verifies actual injection state on every check. We modified the `_injectIfNeededInternal` method in `src/background/background.ts`:

```typescript
private async _injectIfNeededInternal(tabId: number): Promise<void> {
  if (this.injectedTabs.has(tabId)) {
    // Even if we think it's injected, verify for custom sites
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url) {
        const url = new URL(tab.url);
        const hostname = url.hostname;
        
        // Check if this is a custom site
        const settings = await chrome.storage.local.get(['promptLibrarySettings']);
        const customSites = settings.promptLibrarySettings?.customSites || [];
        const isCustomSite = customSites.some(site => 
          site.hostname === hostname && site.enabled
        );
        
        if (isCustomSite) {
          // For custom sites, verify the content script is actually there
          const isActuallyInjected = await this.isContentScriptInjected(tabId);
          if (!isActuallyInjected) {
            // It's not there, clear tracking and continue to inject
            this.injectedTabs.delete(tabId);
          } else {
            return; // It's actually there, we're done
          }
        } else {
          return; // For manifest-injected sites, trust our tracking
        }
      }
    } catch {
      return; // If we can't verify, trust our tracking
    }
  }
  // ... continue with normal injection logic
}
```

### How it works:
1. For custom sites, we always verify if the content script is actually present by checking for the `window.__promptLibraryInjected` flag
2. If the flag is missing (page was reloaded), we clear the tab from our tracking and proceed with injection
3. For manifest-injected sites, we trust our tracking since Chrome handles re-injection automatically

## Why Built-in Platforms Were Unaffected
Built-in platforms like Claude, ChatGPT, and Perplexity likely worked because:
1. They may have had additional injection triggers through other mechanisms
2. The manifest.json might have had content script entries that auto-injected on these specific domains
3. The issue was specifically with the programmatic injection used for custom sites

## Testing the Fix
To verify this fix works:
1. Load the extension from the `dist/` folder
2. Add a custom site configuration
3. Navigate to that custom site
4. Verify icons appear
5. Reload the page (F5 or browser refresh)
6. Verify icons still appear without needing to open/close the popup

## Impact
- No breaking changes to existing functionality
- All tests continue to pass
- Linting passes with no issues
- The fix is minimal and targeted, reducing risk of side effects