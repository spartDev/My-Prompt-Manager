# Chrome Extension Prompt Library - Testing Guide

This document outlines the testing procedures for verifying all requirements and ensuring data persistence across browser sessions and extension updates.

## Setup Instructions

1. **Build the Extension**
   ```bash
   npm install
   npm run build
   ```

2. **Load Extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked" and select the `dist` folder
   - The extension should appear in your extensions list

## Data Persistence Testing (Requirement 6)

### Test 1: Browser Session Persistence
**Objective:** Verify prompts persist across browser restarts

**Steps:**
1. Open the extension popup
2. Create 2-3 test prompts with different categories
3. Close the browser completely
4. Restart the browser
5. Open the extension popup
6. **Expected:** All created prompts should be visible

### Test 2: Extension Update Persistence
**Objective:** Verify data survives extension updates

**Steps:**
1. Create several test prompts
2. Make a minor change to the code
3. Run `npm run build`
4. Reload the extension in `chrome://extensions/`
5. Open the extension popup
6. **Expected:** All existing prompts should remain intact

### Test 3: Storage Recovery
**Objective:** Test data corruption recovery

**Steps:**
1. Create test data
2. Open Chrome DevTools for the extension popup
3. Go to Application tab > Storage > Local Storage
4. Manually corrupt some data entries
5. Reload the extension
6. **Expected:** Extension should handle errors gracefully

## Requirements Testing

### Requirement 1: Save Prompts to Personal Library

#### Test 1.1: Basic Prompt Creation
- [ ] Click extension icon shows popup interface
- [ ] Enter prompt text and click save
- [ ] Prompt is stored successfully
- [ ] Custom title is saved when provided
- [ ] Auto-generated title (first 50 chars) when title is empty

#### Test 1.2: Validation
- [ ] Empty content shows validation error
- [ ] Title over 100 chars shows warning
- [ ] Content over 5000 chars shows warning

### Requirement 2: Organize Prompts into Categories

#### Test 2.1: Category Assignment
- [ ] Prompts can be assigned to categories during creation
- [ ] New categories can be created
- [ ] Uncategorized section exists for prompts without category
- [ ] Category filter shows only prompts from selected category

#### Test 2.2: Category Management
- [ ] Access "Manage Categories" button
- [ ] Create new categories with names and colors
- [ ] Edit existing category names
- [ ] Delete categories (prompts move to "Uncategorized")
- [ ] Cannot delete "Uncategorized" category

### Requirement 3: Quick Copy Prompts

#### Test 3.1: Copy Functionality
- [ ] Click on prompt card's "Copy" button
- [ ] Content is copied to clipboard
- [ ] Visual confirmation message appears
- [ ] Hover shows full text preview for long prompts
- [ ] Truncated prompts show ellipsis

#### Test 3.2: Copy Confirmation
- [ ] Success toast shows "Prompt copied to clipboard"
- [ ] Failed copy shows error toast
- [ ] Copy works across different websites

### Requirement 4: Edit and Delete Prompts

#### Test 4.1: Edit Functionality
- [ ] Right-click on prompt shows context menu
- [ ] Click "Edit" opens edit form with existing data
- [ ] Save changes updates the prompt
- [ ] Updated timestamp changes
- [ ] Cancel discards changes

#### Test 4.2: Delete Functionality
- [ ] Right-click shows "Delete" option
- [ ] Confirmation dialog appears
- [ ] Confirm removes prompt permanently
- [ ] Cancel preserves the prompt

### Requirement 5: Search Through Prompt Library

#### Test 5.1: Search Functionality
- [ ] Type in search box filters prompts in real-time
- [ ] Search matches prompt titles
- [ ] Search matches prompt content
- [ ] Search matches category names
- [ ] Matching text is highlighted in results
- [ ] Clear search shows all prompts
- [ ] "No results found" message for empty results

#### Test 5.2: Search Performance
- [ ] Real-time filtering is responsive
- [ ] Highlights work correctly
- [ ] Search works with special characters

### Requirement 6: Data Persistence

#### Test 6.1: Chrome Storage API
- [ ] Prompts save using chrome.storage.local
- [ ] Data survives browser restart
- [ ] Data survives extension updates
- [ ] Storage quota exceeded shows warning
- [ ] Data corruption is handled gracefully

## Edge Cases and Error Scenarios

### Storage Edge Cases
- [ ] **Storage Quota Exceeded:** Create many large prompts until quota reached
- [ ] **Network Issues:** Test offline functionality
- [ ] **Permission Denied:** Test with restricted storage access

### Input Validation Edge Cases
- [ ] **Maximum Length Content:** Enter exactly 5000 characters
- [ ] **Unicode Characters:** Test with emojis and special characters
- [ ] **HTML/Script Content:** Test XSS prevention
- [ ] **Empty Strings:** Test various empty input combinations

### UI Edge Cases
- [ ] **Very Long Titles:** 100+ character titles
- [ ] **Very Long Category Names:** 50+ character categories
- [ ] **Many Categories:** Test with 20+ categories
- [ ] **Many Prompts:** Test with 100+ prompts
- [ ] **Rapid Interactions:** Quick successive clicks and inputs

### Browser Compatibility
- [ ] **Chrome Latest:** Test on latest Chrome version
- [ ] **Chrome Minimum:** Test on minimum supported version
- [ ] **Different Screen Sizes:** Test popup at various sizes
- [ ] **High DPI Displays:** Test on retina/high-DPI screens

## Performance Testing

### Load Testing
- [ ] **100 Prompts:** Create and test with 100 prompts
- [ ] **Search Performance:** Search through large dataset
- [ ] **Memory Usage:** Monitor extension memory consumption
- [ ] **Storage Performance:** Test with near-quota storage usage

### Responsiveness Testing
- [ ] **UI Interactions:** All buttons respond within 100ms
- [ ] **Search Typing:** Real-time search is smooth
- [ ] **Form Submissions:** Save/edit operations complete quickly
- [ ] **Large Content:** Handle 5000-character prompts smoothly

## Accessibility Testing

### Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Enter/Space activate buttons
- [ ] Escape closes modals
- [ ] Arrow keys work in lists (if applicable)

### Screen Reader Compatibility
- [ ] All elements have proper labels
- [ ] Status changes are announced
- [ ] Form errors are announced
- [ ] Content structure is logical

## Security Testing

### Data Security
- [ ] No sensitive data in console logs
- [ ] No XSS vulnerabilities in user content
- [ ] Content Security Policy compliance
- [ ] No data leaked to external sources

### Extension Security
- [ ] Minimal required permissions
- [ ] No unnecessary network requests
- [ ] Safe handling of user input
- [ ] Proper error message handling

## Regression Testing Checklist

Before each release, run through this abbreviated checklist:

- [ ] Create, edit, delete prompts
- [ ] Search and filter functionality
- [ ] Category management
- [ ] Copy to clipboard
- [ ] Data persistence after browser restart
- [ ] Error handling and recovery
- [ ] Extension update preservation
- [ ] Storage quota warnings

## Bug Report Template

When issues are found, document them using this template:

```
**Bug:** [Brief description]
**Steps to Reproduce:**
1. [First step]
2. [Second step]
3. [etc.]

**Expected Behavior:** [What should happen]
**Actual Behavior:** [What actually happens]
**Browser:** [Chrome version]
**Extension Version:** [Version number]
**Console Errors:** [Any error messages]
**Screenshots:** [If applicable]
```

## Test Data Examples

Use these sample prompts for consistent testing:

### Short Prompt
```
Title: "Meeting Notes Template"
Content: "## Meeting Notes\n\n**Date:** \n**Attendees:** \n**Agenda:** \n\n**Action Items:** \n- \n\n**Next Meeting:** "
Category: "Templates"
```

### Long Prompt
```
Title: "Comprehensive Project Plan"
Content: [4000+ character detailed project planning template]
Category: "Project Management"
```

### Special Characters
```
Title: "Émojis & Special Characters 🚀"
Content: "Test with émojis 😊, symbols ★☆, and unicode: 中文, العربية, हिन्दी"
Category: "Testing"
```