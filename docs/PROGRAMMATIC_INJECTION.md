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

// Check enabled sites and custom site configuration
const enabledSites = settings.enabledSites || ['claude.ai', 'chatgpt.com', 'www.perplexity.ai'];
const customSites = settings.customSites || [];
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

#### 3. Settings Update Handler

```typescript
// Re-evaluate injection when settings change
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SETTINGS_UPDATED') {
    // Re-scan all tabs for injection eligibility
  }
});
```

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
// Robust content script file discovery
private async getContentScriptFilename(): Promise<string> {
  try {
    // Try build manifest first
    const manifest = await fetch('.vite/manifest.json');
    // ... extract correct filename
  } catch {
    // Fallback to common patterns
    const fallbacks = ['assets/content.js', 'content.js'];
    // ... try each fallback
  }
}
```

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