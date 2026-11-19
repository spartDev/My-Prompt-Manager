# Programmatic Content Script Injection

## Overview

This document describes the migration from global content script injection to programmatic injection, implemented to eliminate the `<all_urls>` permission overreach while maintaining full functionality across all supported AI platforms.

## Problem Statement

The previous implementation used `<all_urls>` in the manifest's `host_permissions` and `content_scripts` configuration, which:

- **Security Risk**: Granted unnecessary permissions to all websites
- **Privacy Concern**: Extension could access any website user visits
- **Store Compliance**: Chrome Web Store prefers minimal permissions
- **User Trust**: Users see "Read and change all your data on all websites" warning

## Solution: Programmatic Injection

### Architecture Changes

#### 1. Manifest Updates

**Before:**
```json
{
  "host_permissions": ["<all_urls>"],
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["src/content/index.ts"],
    "run_at": "document_idle"
  }]
}
```

**After:**
```json
{
  "host_permissions": [
    "https://claude.ai/*",
    "https://chatgpt.com/*", 
    "https://www.perplexity.ai/*"
  ],
  "content_scripts": [{
    "matches": [
      "https://claude.ai/*",
      "https://chatgpt.com/*",
      "https://www.perplexity.ai/*"
    ],
    "js": ["src/content/index.ts"],
    "run_at": "document_idle",
    "all_frames": false
  }],
  "optional_host_permissions": [
    "https://*/*",
    "http://*/*"
  ]
}
```

#### 2. ContentScriptInjector Class

New background script component that handles intelligent content script injection:

```typescript
class ContentScriptInjector {
  private injectedTabs: Set<number> = new Set();
  private injectionPromises: Map<number, Promise<void>> = new Map();

  async injectIfNeeded(tabId: number): Promise<void>
  async forceInjectContentScript(tabId: number): Promise<{success: boolean; error?: string}>
  async isContentScriptInjected(tabId: number): Promise<boolean>
  private async shouldInjectForSite(hostname: string): Promise<boolean>
  private async hasPermissionForHostname(hostname: string): Promise<boolean>
}
```

#### 3. Permission Management

**Default Sites (Always Available):**
- claude.ai
- chatgpt.com 
- www.perplexity.ai

**Custom Sites:**
- Use `optional_host_permissions` for additional sites
- Dynamic permission requests via `chrome.permissions.request()`
- Permission granted only when user adds custom site

### Key Features

#### 1. Smart Injection Logic

- **Tab Lifecycle**: Inject on `chrome.tabs.onUpdated` when status is 'complete'
- **Site Enablement**: Check user settings before injection
- **Permission Validation**: Verify permissions before injection attempts
- **Duplicate Prevention**: Track injected tabs to avoid re-injection
- **Error Handling**: Graceful handling of permission denials and injection failures

#### 2. Permission Model

```typescript
// Check permission for hostname
const hasPermission = await chrome.permissions.contains({
  origins: [`https://${hostname}/*`]
});

// Request permission dynamically
const granted = await chrome.permissions.request({
  origins: [origin]
});
```

#### 3. ActiveTab Integration

- Extension icon click triggers `activeTab` permission
- Temporary access for any site user explicitly allows
- No permanent permission storage for one-time use

#### 4. Settings Integration

```typescript
// Settings determine injection eligibility
const shouldInject = await this.shouldInjectForSite(hostname);

// A Platform the user turned on, or never switched and on by default, or a Custom site that is on
// (src/services/siteSettings.ts)
const enabled = isHostnameEnabled(await readSiteSettings(), hostname);
```

## Implementation Details

### Background Script Changes

#### 1. Tab Lifecycle Management

```typescript
// Inject when tab navigation completes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    void injector.injectIfNeeded(tabId);
  }
});

// Cleanup when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  injector.cleanup(tabId);
});
```

#### 2. Extension Icon Click Handler

```typescript
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    // Use activeTab permission for injection
    void injector.forceInjectContentScript(tab.id);
  }
});
```

#### 3. Site settings

The service worker decides whether a tab gets the content script from the Site settings, read with
`readSiteSettings()` and `isHostnameEnabled()` of `src/services/siteSettings.ts`, the same rule the
content script applies when it starts. The content script then follows the key in storage
(`onSiteSettingsChanged()`): it starts on its site when a change turns the site on, stops when one
turns it off, and starts over when the Custom site of its hostname changes. No surface sends the tabs
a message for it.

That needs a content script in the tab. A Platform's tabs get one from the manifest when they load,
on or off (a tab open across an extension update while its Platform was off keeps only the old one,
which no longer receives storage changes, until a click on the extension icon in side panel mode or
an icon placement repair pick injects a fresh one). Chrome runs the manifest's content scripts only
in pages loaded after the extension, so at a first install and at an update the service worker
injects one into each open tab of a site that is on (`injectIntoOpenTabs`, from
`chrome.runtime.onInstalled`): a chat open before the install answers `//` without a reload, as the
Welcome tells a new user it will. Adding a Custom site asks the service worker
to inject into its open tabs (`REQUEST_INJECTION` from `AddCustomSiteForm`). A Custom site that was
off when its tab loaded has none, unless one was injected since: in side panel mode (the default) a
click on the extension icon injects one into its tab, and so does the Element picker. Turning its switch back on
injects none: a tab with no content script starts on the next page load.

### Content Script Adaptation

#### 1. Injection Detection

```typescript
// Mark script as injected to prevent duplicates
(window as any).__promptLibraryInjected = true;

// Allow background script to check injection status
const isInjected = window.__promptLibraryInjected === true;
```

#### 2. Dynamic Loading Support

```typescript
// Handle cases where script is injected after page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
```

### Settings UI Updates

#### 1. Permission Request Integration

```typescript
// Request permission when adding custom site
const granted = await chrome.permissions.request({
  origins: [origin]
});

if (!granted) {
  throw new Error('Permission denied for site');
}
```

#### 2. Element Picker Permission Handling

```typescript
// Check permission before starting element picker
if (!isAllowedOrigin) {
  const hasPermission = await chrome.permissions.contains({
    origins: [origin]
  });
  
  if (!hasPermission) {
    const granted = await chrome.permissions.request({
      origins: [origin]
    });
    if (!granted) {
      throw new Error('Permission required for element picker');
    }
  }
}
```

## Security Benefits

### 1. Minimal Permissions

- **Before**: Access to ALL websites (`<all_urls>`)
- **After**: Access only to 3 specific AI platforms by default

### 2. User Control

- **Explicit Consent**: Users must explicitly grant permission for custom sites
- **Transparency**: Clear understanding of which sites have access
- **Revocable**: Users can revoke permissions through Chrome settings

### 3. Defensive Programming

```typescript
// Validate URL before injection attempts
if (this.isRestrictedUrl(tab.url)) {
  return; // Skip chrome://, extension pages, etc.
}

// Double-check permissions before injection
const hasPermission = await this.hasPermissionForHostname(hostname);
if (!hasPermission) {
  throw new Error('Permission denied');
}
```

## Performance Optimizations

### 1. Injection Tracking

- Track injected tabs to avoid redundant injections
- Use `Set<number>` for O(1) lookup performance
- Clean up tracking on tab close

### 2. Concurrent Injection Prevention

```typescript
// Prevent multiple concurrent injections for same tab
if (this.injectionPromises.has(tabId)) {
  return this.injectionPromises.get(tabId);
}
```

### 3. Permission Caching

- Chrome automatically caches permission checks
- Minimize permission API calls through smart checking
- Use settings to pre-filter injection attempts

## Error Handling

### 1. Permission Errors

```typescript
try {
  await this.injectContentScript(tabId);
} catch (error) {
  if (error.message.includes('No permission')) {
    // Expected for most sites - silent handling
  } else {
    // Unexpected error - log for debugging
    console.error('Injection failed:', error);
  }
}
```

### 2. Tab Access Errors

```typescript
// Graceful handling of closed/inaccessible tabs
try {
  const tab = await chrome.tabs.get(tabId);
} catch {
  // Tab was closed or is inaccessible
  return;
}
```

### 3. Build Manifest Resolution

```typescript
// The loader the manifest names (assets/index.ts-loader-<hash>.js)
private async getContentScriptFilename(): Promise<string> {
  const contentScriptPath = chrome.runtime.getManifest().content_scripts?.[0]?.js?.[0];
  // ... throw if the manifest declares none
  try {
    await fetch(chrome.runtime.getURL(contentScriptPath));
    return contentScriptPath;
  } catch {
    // Not on disk: dist/ was rebuilt after Chrome loaded the extension
    throw new Error(STALE_BUILD_ERROR); // "Reload it in chrome://extensions..."
  }
}
```

Chrome reads the manifest once, when it loads the extension. A rebuild writes the loader under a
new hashed name, so until the extension is reloaded the manifest names a file that is gone; the
error asks for that reload (tests/e2e/content/picker-stale-build.spec.ts).

## Testing Considerations

### 1. Permission Scenarios

- ✅ Default sites work without additional permissions
- ✅ Custom sites prompt for permission appropriately
- ✅ Permission denial handled gracefully
- ✅ Permission revocation detected

### 2. Injection Scenarios

- ✅ Fresh page loads trigger injection
- ✅ SPA navigation triggers re-injection
- ✅ Extension icon click forces injection
- ✅ Duplicate injections prevented

### 3. Error Scenarios

- ✅ Restricted URLs (chrome://) properly skipped
- ✅ Network errors don't crash injection
- ✅ Tab closure during injection handled gracefully
- ✅ Build file changes don't break injection

## Migration Impact

### User Experience

- **Improved**: Reduced permission warnings in Chrome Web Store
- **Maintained**: All existing functionality preserved
- **Enhanced**: More explicit control over site access

### Developer Experience

- **Complexity**: Slightly increased due to permission management
- **Debugging**: Better error messages and injection tracking
- **Maintenance**: More robust error handling

### Performance

- **Memory**: Reduced global listener overhead
- **CPU**: Smarter injection logic reduces unnecessary work
- **Network**: No impact on content script functionality

## Future Considerations

### 1. Permission Management UI

Consider adding:
- Permission status indicator in settings
- One-click permission revocation
- Bulk permission management

### 2. Advanced Injection Strategies

Potential improvements:
- Lazy loading of content script modules
- Platform-specific injection optimization
- Content script hot-reloading in development

### 3. Analytics and Monitoring

Useful metrics:
- Injection success/failure rates
- Permission grant/denial rates
- Performance impact measurement

## Conclusion

The migration to programmatic injection successfully:

✅ **Eliminates** `<all_urls>` permission overreach  
✅ **Maintains** full functionality for all supported platforms  
✅ **Enhances** security through minimal permission principle  
✅ **Improves** user trust through transparent permission model  
✅ **Preserves** performance through intelligent injection logic  

This change positions the extension for better Chrome Web Store compliance while maintaining the excellent user experience that makes My Prompt Manager valuable for AI platform users.