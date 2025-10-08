# Google Gemini Manual QA Test Plan

## Overview
This document provides comprehensive manual testing procedures for the Google Gemini platform integration in My Prompt Manager Chrome Extension.

**Platform:** Google Gemini (gemini.google.com)
**Integration Type:** Quill.js editor with 3-tier insertion fallback
**Priority:** 85 (same as Mistral)
**Version:** 1.5.0+

---

## Prerequisites

### Environment Setup
- [ ] Chrome browser (v120+)
- [ ] Extension built with `npm run build`
- [ ] Extension loaded as unpacked extension
- [ ] Google account with Gemini access
- [ ] Debug mode enabled: `localStorage.setItem('prompt-library-debug', 'true')`

### Test Data Preparation
Create the following test prompts in the extension:

1. **Short Prompt** (Category: Testing)
   - Content: "Explain this code snippet in simple terms."

2. **Long Prompt** (Category: Testing)
   - Content: "You are an expert software engineer. Please review the following code for security vulnerabilities, performance issues, and best practices. Provide detailed recommendations with code examples."

3. **Special Characters** (Category: Testing)
   - Content: "Test with special chars: @#$%^&*()_+-=[]{}|;':\"<>,.?/~`"

4. **Multi-line Prompt** (Category: Testing)
   - Content:
     ```
     Line 1: Introduction
     Line 2: Requirements
     Line 3: Expected Output
     Line 4: Additional Notes
     ```

---

## Test Scenarios

### 1. Icon Visibility & Positioning

#### 1.1 Initial Page Load
**Steps:**
1. Navigate to https://gemini.google.com
2. Wait for page to fully load
3. Locate the input textarea at the bottom of the page

**Expected Results:**
- [ ] Purple library icon appears within `.input-buttons-wrapper-bottom` container
- [ ] Icon positioned inline with microphone and send buttons
- [ ] Icon has Google's 4-color gradient (Blue, Purple, Pink, Yellow)
- [ ] Icon size matches surrounding buttons
- [ ] Icon has proper hover state (slight scale/opacity change)

**Debug Verification:**
```javascript
// Open DevTools Console
console.log(document.querySelector('.input-buttons-wrapper-bottom'));
// Should show container with library icon
```

---

#### 1.2 Icon Positioning After Conversation Start
**Steps:**
1. Send a test message to Gemini
2. Wait for response
3. Scroll down to input area

**Expected Results:**
- [ ] Icon remains visible and properly positioned
- [ ] Icon stays in correct container after DOM updates
- [ ] No duplicate icons appear

---

### 2. Prompt Insertion - Quill.js API (Tier 1)

#### 2.1 Basic Text Insertion
**Steps:**
1. Click the library icon
2. Select "Short Prompt" from the list
3. Observe the input field

**Expected Results:**
- [ ] Prompt text appears in the Quill editor
- [ ] Text is properly formatted (no HTML tags visible)
- [ ] Cursor is positioned after inserted text
- [ ] Send button becomes enabled

**Debug Verification:**
```javascript
// Check console for insertion method
// Should see: "Quill API insertion successful"
```

---

#### 2.2 Long Text Insertion
**Steps:**
1. Clear the input field
2. Click library icon
3. Select "Long Prompt"

**Expected Results:**
- [ ] Full prompt text inserted without truncation
- [ ] Text wraps properly in the input area
- [ ] No performance lag during insertion
- [ ] Quill editor maintains formatting

---

#### 2.3 Special Characters Handling
**Steps:**
1. Clear the input field
2. Click library icon
3. Select "Special Characters" prompt

**Expected Results:**
- [ ] All special characters appear correctly
- [ ] No characters are escaped or doubled
- [ ] No XSS attempts succeed (characters are sanitized)
- [ ] Quill editor handles characters properly

---

#### 2.4 Multi-line Insertion
**Steps:**
1. Clear the input field
2. Click library icon
3. Select "Multi-line Prompt"

**Expected Results:**
- [ ] All lines inserted correctly
- [ ] Line breaks preserved (or converted to spaces if Quill doesn't support)
- [ ] No extra whitespace added

---

### 3. Fallback Methods Testing

#### 3.1 ExecCommand Fallback (Tier 2)
**Simulation (requires code modification):**
1. Temporarily disable Quill API in GeminiStrategy
2. Attempt prompt insertion

**Expected Results:**
- [ ] Insertion still succeeds via execCommand
- [ ] Console shows: "execCommand insertion successful"
- [ ] Text appears in editor correctly
- [ ] Angular change detection fires

---

#### 3.2 DOM Manipulation Fallback (Tier 3)
**Simulation (requires code modification):**
1. Disable both Quill API and execCommand
2. Attempt prompt insertion

**Expected Results:**
- [ ] Insertion succeeds via DOM manipulation
- [ ] Console shows: "DOM manipulation successful"
- [ ] Text appears in `<p>` tag within editor
- [ ] Send button becomes enabled

---

### 4. Angular Integration & Events

#### 4.1 Change Detection
**Steps:**
1. Open DevTools and monitor console
2. Insert a prompt using library icon
3. Observe console for event logs

**Expected Results:**
- [ ] `input` event fired
- [ ] `change` event fired
- [ ] `text-change` event fired (for Quill API path)
- [ ] `compositionend` event fired (for execCommand path)
- [ ] Send button state updates correctly

**Debug Verification:**
```javascript
// Add event listeners in console
const editor = document.querySelector('.ql-editor');
['input', 'change', 'text-change', 'compositionend'].forEach(eventType => {
  editor.addEventListener(eventType, (e) => {
    console.log(`${eventType} fired:`, e);
  });
});
```

---

### 5. Cache Performance Testing

#### 5.1 Repeated Insertions
**Steps:**
1. Enable debug mode in console:
   ```javascript
   localStorage.setItem('prompt-library-debug', 'true');
   ```
2. Refresh Gemini page
3. Insert a prompt
4. Clear editor manually (Ctrl/Cmd+A, Delete)
5. Insert the same prompt again (repeat 3-4 times)
6. Check console logs

**Expected Results:**
- [ ] First insertion: No cache hit message
- [ ] Subsequent insertions: "Quill editor found in cache" message
- [ ] Each insertion completes in <10ms (check console timestamps)
- [ ] No page-wide searches after first insertion

---

#### 5.2 Cache Invalidation
**Steps:**
1. Insert a prompt successfully
2. Navigate to a different conversation
3. Return to original conversation
4. Insert another prompt

**Expected Results:**
- [ ] Cache correctly invalidated on navigation
- [ ] New Quill editor found on page return
- [ ] No stale cache errors
- [ ] Insertion still succeeds

---

### 6. Edge Cases & Error Handling

#### 6.1 Empty Prompt Insertion
**Steps:**
1. Create a prompt with empty content
2. Attempt to insert it

**Expected Results:**
- [ ] Insertion prevented or handled gracefully
- [ ] User receives appropriate feedback
- [ ] No console errors

---

#### 6.2 Very Large Prompt (>10KB)
**Steps:**
1. Create a prompt with ~15KB of text
2. Insert the prompt

**Expected Results:**
- [ ] Prompt inserted successfully (may take longer)
- [ ] Sanitization applied (limited to 50KB)
- [ ] No browser freeze
- [ ] Quill editor handles large content

---

#### 6.3 Rapid Repeated Insertions
**Steps:**
1. Click library icon
2. Select a prompt
3. Immediately click icon again and select another prompt
4. Repeat 5-6 times rapidly

**Expected Results:**
- [ ] All insertions complete successfully
- [ ] No race conditions or duplicate text
- [ ] Throttling prevents excessive page-wide searches
- [ ] Console shows throttle messages after 1 second

---

#### 6.4 Page Load Before DOM Ready
**Steps:**
1. Refresh Gemini page
2. Immediately try to click library icon (if visible)

**Expected Results:**
- [ ] Icon waits for DOM ready before becoming interactive
- [ ] No console errors
- [ ] Prompt selector appears correctly when clicked

---

### 7. Theme Compatibility

#### 7.1 Light Mode
**Steps:**
1. Set Gemini to light mode (if available)
2. Verify icon visibility and colors

**Expected Results:**
- [ ] Icon visible against light background
- [ ] Gradient colors render correctly
- [ ] Hover state visible

---

#### 7.2 Dark Mode
**Steps:**
1. Set Gemini to dark mode
2. Verify icon visibility and colors

**Expected Results:**
- [ ] Icon visible against dark background
- [ ] Gradient colors render correctly
- [ ] Hover state visible

---

### 8. Cross-Browser Testing (Chrome Variants)

#### 8.1 Chrome Stable
- [ ] All tests pass on Chrome stable (latest version)

#### 8.2 Chrome Beta
- [ ] All tests pass on Chrome beta (if available)

#### 8.3 Chrome Canary
- [ ] All tests pass on Chrome Canary (for future compatibility)

---

### 9. Settings Integration

#### 9.1 Platform Toggle
**Steps:**
1. Open extension settings
2. Navigate to "Supported Sites"
3. Find Google Gemini entry
4. Toggle Gemini OFF
5. Reload Gemini page
6. Toggle Gemini ON
7. Reload Gemini page

**Expected Results:**
- [ ] Gemini listed as "Google Gemini" in settings
- [ ] Icon has 4-color Google gradient
- [ ] When OFF: No icon appears on Gemini page
- [ ] When ON: Icon appears correctly

---

#### 9.2 Default Enabled State
**Steps:**
1. Reset extension settings to defaults
2. Check Gemini toggle state

**Expected Results:**
- [ ] Gemini enabled by default for new users
- [ ] Appears in correct priority order (after ChatGPT, before/with Mistral)

---

### 10. Performance Benchmarks

#### 10.1 Insertion Speed
**Measurement:**
```javascript
// In console, measure insertion time
const start = performance.now();
// Click library icon and select prompt
const end = performance.now();
console.log(`Insertion took ${end - start}ms`);
```

**Expected Results:**
- [ ] Tier 1 (Quill API): <10ms
- [ ] Tier 2 (execCommand): <50ms
- [ ] Tier 3 (DOM): <20ms

---

#### 10.2 Memory Usage
**Steps:**
1. Open DevTools → Performance → Memory
2. Take heap snapshot
3. Insert 20 different prompts
4. Take another heap snapshot
5. Compare memory usage

**Expected Results:**
- [ ] Memory increase <1MB for 20 insertions
- [ ] No memory leaks (WeakMap properly garbage collects)
- [ ] Cache doesn't grow indefinitely

---

## Regression Testing Checklist

Run these tests after any code changes to ensure no regressions:

### Critical Path
- [ ] Icon appears on Gemini page load
- [ ] Clicking icon opens prompt selector
- [ ] Selecting prompt inserts text into editor
- [ ] Inserted text can be sent to Gemini

### Integration Points
- [ ] Settings toggle works (on/off)
- [ ] Search functionality works in prompt selector
- [ ] Category filtering works
- [ ] Dark mode styling correct

### Performance
- [ ] No console errors
- [ ] Insertion completes in <100ms
- [ ] Page remains responsive during insertion

---

## Bug Reporting Template

If a test fails, use this template to report bugs:

```markdown
**Bug Title:** [Concise description]

**Severity:** Critical / Major / Minor

**Test Scenario:** [Which test section/step]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happened]

**Screenshots/Console Logs:**
[Attach relevant screenshots or console output]

**Environment:**
- Chrome Version: [e.g., 120.0.6099.109]
- Extension Version: [e.g., 1.5.0]
- OS: [e.g., macOS 14.0]
- Gemini URL: [Full URL]

**Additional Context:**
[Any other relevant information]
```

---

## Test Sign-off

### Test Execution
- **Tester Name:** _________________
- **Date:** _________________
- **Extension Version:** _________________
- **Chrome Version:** _________________

### Results Summary
- **Total Tests:** _____ / _____
- **Passed:** _____
- **Failed:** _____
- **Blocked:** _____

### Sign-off
- [ ] All critical tests passed
- [ ] No P0/P1 bugs found
- [ ] Performance benchmarks met
- [ ] Ready for production deployment

**Signature:** _________________
**Date:** _________________

---

## Automated Test Coverage

The following scenarios are already covered by automated tests (863 tests total):

### Unit Tests (27 Gemini-specific tests)
- ✅ Constructor configuration
- ✅ `canHandle()` method validation
- ✅ Selector matching
- ✅ Quill editor detection
- ✅ All 3 insertion tiers (Quill API, execCommand, DOM)
- ✅ Event dispatching (input, change, text-change, compositionend)
- ✅ Error handling
- ✅ Angular compatibility
- ✅ Caching behavior (5 new tests)

### Integration Tests
- ✅ Platform strategy registration
- ✅ Icon creation
- ✅ Content sanitization

### Performance Tests
- ✅ Cache hit/miss behavior
- ✅ Throttling of page-wide searches
- ✅ Cache invalidation on DOM removal
- ✅ Negative result caching

**Note:** Manual QA focuses on real-world browser behavior, Angular integration, and visual/UX aspects that cannot be fully automated in JSDOM.

---

## Continuous Improvement

After each QA cycle, update this document with:
- New edge cases discovered
- Performance regression baselines
- Additional test scenarios
- Lessons learned

**Last Updated:** 2025-10-08
**Next Review Date:** [To be determined based on release cycle]
