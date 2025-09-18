# Troubleshooting Guide

Having issues with My Prompt Manager? This comprehensive troubleshooting guide covers common problems and their solutions, organized by symptoms and severity.

![Troubleshooting Hero](../docs/screenshots/troubleshooting-hero.png)
*Get your prompt manager working smoothly again*

## Quick Diagnostic Checklist

Before diving into specific issues, run through this quick checklist:

### ✅ Basic System Check
- [ ] Chrome browser version 114+ (check in `chrome://version/`)
- [ ] Extension is enabled in `chrome://extensions/`
- [ ] Extension has necessary permissions
- [ ] Page has been refreshed after making changes
- [ ] Other conflicting extensions are disabled temporarily

### ✅ Extension Status Check
- [ ] Extension icon visible in toolbar (pin if needed)
- [ ] Extension popup opens when clicked
- [ ] Extension shows prompt count > 0 (if you have prompts)
- [ ] No error messages in browser console (`F12` → Console)

![Basic Checklist Interface](../docs/screenshots/basic-checklist.png)
*Screenshot: Chrome extensions management page*

## Extension Installation and Loading Issues

### Extension Not Visible in Toolbar

**Symptoms**: Can't find My Prompt Manager icon in Chrome toolbar

**Solutions**:
1. **Pin the Extension**:
   - Click the puzzle piece icon (⋯) in Chrome toolbar
   - Find "My Prompt Manager" in the dropdown
   - Click the pin icon to keep it visible permanently

![Pin Extension Process](../docs/screenshots/pin-extension-process.png)
*Screenshot: Steps to pin extension to toolbar*

2. **Check Extension Status**:
   - Go to `chrome://extensions/`
   - Ensure My Prompt Manager is enabled (toggle switch on)
   - If grayed out, try disabling and re-enabling

3. **Reinstall if Necessary**:
   - Remove extension from `chrome://extensions/`
   - Reinstall from Chrome Web Store
   - Restore data from previous export if available

### Extension Popup Won't Open

**Symptoms**: Clicking extension icon does nothing or shows error

**Immediate Solutions**:
1. **Hard Refresh**: Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. **Restart Chrome**: Close all Chrome windows and restart
3. **Check for Errors**: Open browser console and look for error messages

**Advanced Solutions**:
1. **Clear Extension Data**:
   - Right-click extension icon → "Options" or "Manage"
   - Clear all extension data (will delete prompts - export first!)
   - Restart Chrome and test

![Extension Error Console](../docs/screenshots/extension-error-console.png)
*Screenshot: Browser console showing extension errors*

2. **Permission Issues**:
   - Go to `chrome://extensions/`
   - Click "Details" on My Prompt Manager
   - Check "Allow in incognito" if using private browsing
   - Review site access permissions

### Developer Installation Problems

**For users installing from source code**:

**Build Failures**:
```bash
# Clear and reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild extension
npm run build

# Check if dist folder was created
ls -la dist/
```

**Loading Unpacked Extension Errors**:
- Ensure you're selecting the `dist` folder, not the root project folder
- Check that `manifest.json` exists in the `dist` folder
- Verify Node.js version is 18+ with `node --version`

## Platform Integration Issues

### Prompt Button Not Appearing on AI Platforms

**Symptoms**: Extension works in popup but no integration button on Claude/ChatGPT/Perplexity

#### For All Platforms:

**Check Site Enablement**:
1. Open extension popup/side panel
2. Click Settings (gear icon)
3. Go to "Site Integration" section
4. Ensure the platform is toggled ON
5. Refresh the AI platform webpage

![Site Integration Settings](../docs/screenshots/site-integration-settings.png)
*Screenshot: Site integration settings panel*

**Permission Verification**:
- When visiting a new AI platform, Chrome may request permissions
- Look for notification bar at top of browser
- Click "Allow" to grant necessary permissions
- Manual permission management in `chrome://extensions/` → Details → Permissions

#### Platform-Specific Solutions:

**Claude.ai**:
- Wait for page to fully load before expecting button
- Look for "My Prompts" button next to Research button
- If missing, try starting a new conversation
- Clear site cookies if persistent issues

**ChatGPT**:
- Ensure you're in a chat conversation, not settings pages
- Look for small icon in input area toolbar
- Try switching between different chat conversations
- Disable other ChatGPT browser extensions temporarily

**Perplexity.ai**:
- Button appears in the ask input area
- Wait a few seconds after page load
- Try asking a question first to activate input area
- Check for "My Prompts" text button

### Prompt Insertion Not Working

**Symptoms**: Modal opens, prompts visible, but clicking them doesn't insert text

#### Universal Solutions:

**Focus and Timing**:
1. **Click in text input** area before opening prompt selector
2. **Wait for modal** to fully load before selecting prompts
3. **Close other modals** or popups on the platform
4. **Try keyboard selection**: Use arrow keys + Enter instead of mouse click

![Prompt Selection Demo](../docs/screenshots/prompt-selection-demo.gif)
*GIF: Proper sequence for prompt insertion*

**Debug Mode Activation**:
1. Open browser console (`F12`)
2. Type: `localStorage.setItem('prompt-library-debug', 'true')`
3. Refresh page and try inserting prompt
4. Check console for detailed error messages

#### Platform-Specific Insertion Issues:

**Claude.ai Insertion Problems**:
- **Rich Editor Issues**: Claude uses ProseMirror - try clicking directly in editor area
- **Format Problems**: Prompts with special formatting may need simplification
- **Multiple Insertion**: If text appears twice, refresh page and try again

**ChatGPT Insertion Problems**:
- **React State Issues**: Ensure ChatGPT interface has finished loading
- **Input Focus**: Click directly in message input textarea
- **Extension Conflicts**: Disable other ChatGPT-related extensions

**Perplexity Insertion Problems**:
- **ContentEditable Issues**: These are more complex than regular textareas
- **Timing Sensitivity**: Wait longer after page load
- **Selection Issues**: Try clearing any existing text in input first

## Storage and Data Issues

### Storage Quota Exceeded

**Symptoms**: Warning about storage limits, cannot save new prompts

![Storage Warning Interface](../docs/screenshots/storage-warning-interface.png)
*Screenshot: Storage quota warning dialog*

**Immediate Solutions**:
1. **Export Data First**: Always backup before cleanup
   - Settings → Data Management → Export Data
   - Save the JSON file somewhere safe

2. **Clean Up Prompts**:
   - Delete unused or duplicate prompts
   - Remove overly long prompts (break into smaller ones)
   - Clean up unused categories

3. **Check Storage Usage**:
   - Settings → Data Management
   - Review storage usage bar
   - Identify largest data consumers

**Long-term Solutions**:
- **Regular Maintenance**: Monthly cleanup of unused prompts
- **External Storage**: Export subsets of prompts for different projects
- **Efficient Organization**: Better categories reduce search needs

### Data Import/Export Problems

**Import Failures**:
```
Common Error Messages:
- "Invalid file format"
- "File too large"
- "Corrupted backup data"
- "Version mismatch"
```

**Solutions**:
1. **File Validation**:
   - Ensure file is valid JSON format
   - Check file isn't corrupted (try opening in text editor)
   - Verify file size is reasonable (< 5MB)

2. **Format Verification**:
   ```json
   {
     "version": "1.2.1",
     "exportDate": "2024-12-16T10:30:00.000Z",
     "prompts": [...],
     "categories": [...]
   }
   ```

3. **Incremental Import**:
   - If a large file fails, try importing a smaller subset first
   - Import categories before prompts when splitting files
   - If issues persist, restore a fresh backup and re-export from the source machine

**Export Issues**:
- **Download Failures**: Check browser download settings
- **Empty Exports**: Ensure you have prompts to export
- **Permission Errors**: Check browser file access permissions

### Data Corruption Recovery

**Symptoms**: Extension loads but shows empty library, error messages, or crashes

**Emergency Recovery**:
1. **Don't Panic**: Data might still be recoverable
2. **Avoid Making Changes**: Don't add/delete anything yet
3. **Check Browser Storage**: Data might still exist in Chrome storage

**Recovery Methods**:
1. **Soft Reset**:
   - Disable and re-enable extension in `chrome://extensions/`
   - Restart Chrome browser
   - Check if data reappears

2. **Hard Reset** (Last Resort):
   - Export any visible data first
   - Clear all extension data from settings
   - Import from previous backup

![Data Recovery Process](../docs/screenshots/data-recovery-process.png)
*Screenshot: Data recovery options in settings*

## Performance and User Interface Issues

### Extension Running Slowly

**Symptoms**: Slow loading, laggy interface, high memory usage

**Performance Solutions**:
1. **Large Library Optimization**:
   - Use search instead of scrolling through many prompts
   - Break large categories into smaller, more specific ones
   - Remove unused prompts to reduce data processing

2. **Browser Optimization**:
   - Close unused tabs to free memory
   - Restart Chrome to clear memory leaks
   - Check Task Manager (`Shift+Esc`) for memory usage

3. **Extension Conflicts**:
   - Temporarily disable other extensions
   - Identify conflicts with other productivity tools
   - Use Chrome's incognito mode for testing

### Interface Display Problems

**Modal Position Issues**:
- **Off-screen Modal**: Zoom out or resize browser window
- **Blocked by Other Elements**: Close other popups/modals on platform
- **Theme Conflicts**: Try switching light/dark mode

**Text Display Problems**:
- **Truncated Text**: Increase window size or zoom out
- **Overlapping Elements**: Try different browser zoom levels
- **Font Issues**: Check browser font settings and accessibility options

![Interface Problems](../docs/screenshots/interface-problems-examples.png)
*Screenshot: Common interface display issues and fixes*

## Advanced Troubleshooting

### Browser Console Debugging

**Accessing Console**:
1. Press `F12` or right-click → "Inspect"
2. Go to "Console" tab
3. Look for red error messages
4. Copy error messages for support

**Enable Debug Mode**:
```javascript
// Enable detailed logging
localStorage.setItem('prompt-library-debug', 'true');

// Check extension status
window.__promptLibraryDebug?.getInstance();
```

**Useful Debug Commands**:
```javascript
// Check if extension is initialized
window.__promptLibraryDebug?.isInitialized();

// Force reinitialization
window.__promptLibraryDebug?.reinitialize();

// Clean shutdown
window.__promptLibraryDebug?.cleanup();
```

### Extension Context Issues

**Symptoms**: Extension works sometimes but fails intermittently

**Context Loss Problems**:
- **Service Worker Sleep**: Chrome may suspend background script
- **Page Navigation**: SPA navigation can break injection
- **Tab Switching**: Extension context may reset

**Solutions**:
1. **Force Reinitialization**:
   - Refresh the AI platform page
   - Toggle extension off/on in `chrome://extensions/`
   - Wait a few seconds between actions

2. **Persistent Issues**:
   - Check Chrome version (ensure 114+)
   - Look for conflicting extensions
   - Try Chrome Canary for testing

### Custom Site Configuration Issues

**Element Picker Not Working**:
- **Security Blocks**: Some sites prevent element selection
- **Dynamic Content**: Wait for page to fully load
- **Complex Layouts**: Try selecting simpler parent elements

![Custom Site Configuration](../docs/screenshots/custom-site-configuration.png)
*Screenshot: Element picker in action with security warnings*

**Positioning Problems**:
- **Refresh Required**: Save the site, then reload the target page to see the updated placement
- **Offset Adjustment**: Fine-tune X/Y coordinates in the settings panel if the button is slightly off
- **Z-index Issues**: Increase the z-index value when surrounding UI overlaps the prompt button

## Error Message Reference

### Common Error Messages and Solutions

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Storage quota exceeded" | Too much data stored | [Clean up prompts](#storage-quota-exceeded) |
| "Extension context lost" | Chrome suspended extension | Refresh page, restart Chrome |
| "Cannot access storage" | Permissions issue | Check extension permissions |
| "Invalid prompt data" | Corrupted data | [Data corruption recovery](#data-corruption-recovery) |
| "Platform not supported" | Site not configured | Check site integration settings |
| "Insertion failed" | Text input issues | [Prompt insertion problems](#prompt-insertion-not-working) |

### Debug Information Collection

**For Support Requests**, collect this information:
1. **Chrome version**: `chrome://version/`
2. **Extension version**: Check in `chrome://extensions/`
3. **Platform URL**: Which AI platform you're using
4. **Error messages**: From browser console
5. **Steps to reproduce**: Exact sequence that causes issue

![Support Information Collection](../docs/screenshots/support-info-collection.png)
*Screenshot: Where to find version and debug information*

## Getting Additional Help

### Before Contacting Support

1. **Check FAQ**: Review [FAQ](FAQ.md) for common questions
2. **Search Issues**: Look through [GitHub Issues](https://github.com/spartDev/My-Prompt-Manager/issues) for similar problems
3. **Try Incognito**: Test in Chrome incognito mode to rule out conflicts

### Reporting Issues

**Create Effective Bug Reports**:
1. **Clear Title**: Describe the problem concisely
2. **Steps to Reproduce**: Exact sequence of actions
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **System Information**: Chrome version, OS, extension version
6. **Screenshots/Videos**: Visual evidence when helpful

### Community Resources

- **GitHub Discussions**: Community Q&A and tips
- **Issue Tracker**: Report bugs and request features
- **Wiki**: This documentation for comprehensive guides

---

**Still having issues?** Visit our [FAQ](FAQ.md) for additional common questions or open a ticket on GitHub with detailed logs.
