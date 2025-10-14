# Prompt Sharing Feature - Comprehensive Test Plan

## Application Overview

The Prompt Library Chrome Extension now includes a **Prompt Sharing** feature that allows users to share individual prompts with others via encoded URLs. The feature consists of three main components:

1. **Share Button**: Located on each `PromptCard`, enables one-click sharing via clipboard
2. **PromptEncoder Service**: Handles secure encoding/decoding with compression (LZ-string) and sanitization (DOMPurify)
3. **Import Mode**: New mode in `AddPromptForm` that allows importing shared prompts via encoded strings

### Key Technical Details

- **Encoding**: LZ-string compression (60-80% size reduction) with URL-safe characters
- **Security**: HTML tag stripping on both encode and decode paths, size limit validation
- **Size Limits**:
  - Title: 100 characters max
  - Content: 10,000 characters max
  - Category: 50 characters max
  - Encoded string: 20KB max
- **URL Pattern**: Extension runs at `chrome-extension://[id]/popup.html`
- **Storage**: Chrome storage API with atomic operations

---

## Test Scenarios

### 1. Share Button Functionality

**Priority**: CRITICAL
**Dependencies**: None
**Seed File**: `tests/e2e/seed.spec.ts`

#### 1.1 Share Button Visibility and State

**Steps:**
1. Navigate to the extension popup (dev server: `http://localhost:5173`)
2. Create a test prompt with:
   - Title: "Test Sharing Prompt"
   - Content: "This is a test prompt for sharing functionality validation."
   - Category: "General"
3. Locate the newly created prompt card
4. Identify the share button (icon showing connected nodes)

**Expected Results:**
- Share button is visible next to the copy button
- Button displays a share icon (SVG with connected nodes)
- Button has proper hover state (purple highlight)
- Button is enabled and clickable
- ARIA label reads "Share [Prompt Title]"
- Button has proper focus indicator when tabbed to

**Accessibility Check:**
- Screen reader announces button properly
- Keyboard navigation works (Tab to focus, Enter/Space to activate)

---

#### 1.2 Share Button Click - Success Flow

**Steps:**
1. Create a prompt with standard content
2. Click the share button
3. Observe the button state during operation
4. Wait for completion

**Expected Results:**
- Button immediately enters loading state:
  - Button becomes disabled (`disabled` attribute)
  - ARIA label changes to "Sharing [Prompt Title]..."
  - ARIA-busy attribute set to `true`
- Success toast notification appears: "Share link copied to clipboard!"
- Toast auto-dismisses after ~3 seconds
- Button returns to normal state (enabled)
- Clipboard contains encoded sharing code
- Encoded code format: URL-safe base64-like string matching pattern `^[A-Za-z0-9_-]+$`
- No console errors

**Performance Check:**
- Operation completes in < 500ms for normal-sized prompts
- UI remains responsive during operation

---

#### 1.3 Share Button Keyboard Interaction

**Steps:**
1. Create a test prompt
2. Use Tab key to navigate to the share button
3. Press Enter key
4. Observe result
5. Repeat with Space key instead

**Expected Results:**
- Both Enter and Space keys trigger sharing
- Same behavior as mouse click (loading state, toast, clipboard)
- Focus remains on button after operation completes
- Focus indicator visible throughout

---

#### 1.4 Share Button - Clipboard Permission Denied

**Steps:**
1. Create a test prompt
2. Mock clipboard API to reject permission
3. Click share button
4. Observe error handling

**Expected Results:**
- Error toast appears: "Failed to share prompt. Please try again."
- Toast has red/error styling
- Button returns to normal state
- Error is logged to console (dev mode only)
- No uncaught exceptions

**Mock Setup:**
```javascript
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: () => Promise.reject(new Error('Clipboard access denied'))
  },
  configurable: true
});
```

---

#### 1.5 Share Button - Very Long Prompt (Size Limit)

**Steps:**
1. Create a prompt with content length > 10,000 characters
2. Attempt to share the prompt
3. Observe behavior

**Expected Results:**
- Share operation fails gracefully
- Error toast appears: "Prompt too large to share" or similar message
- No partial data copied to clipboard
- Button returns to normal state
- Error logged with size details (dev mode)

**Test Data:**
- Content: 'A'.repeat(10001)

---

#### 1.6 Share Button with Special Characters

**Steps:**
1. Create a prompt with special characters:
   - Title: `Test "Special" <Characters> & Symbols`
   - Content: `Content with\nnewlines\tand\ttabs\nand "quotes" & <tags>`
   - Category: "General"
2. Click share button
3. Verify clipboard content
4. Verify content can be decoded

**Expected Results:**
- Share operation succeeds
- Clipboard contains valid encoded string
- Special characters are preserved in encoded data
- HTML tags are stripped (XSS protection)
- Newlines and tabs preserved
- Quotes and ampersands handled correctly

---

### 2. Prompt Encoding/Decoding

**Priority**: CRITICAL
**Dependencies**: Share button tests (1.1-1.6)

#### 2.1 Encoding - Standard Prompt

**Steps:**
1. Create a standard test prompt
2. Share the prompt to get encoded string
3. Manually inspect the encoded string

**Expected Results:**
- Encoded string contains only URL-safe characters: `[A-Za-z0-9_-]`
- String length is significantly shorter than original JSON (compression working)
- String is deterministic (same input = same output)
- String length < 20KB
- No special characters that would break URLs

---

#### 2.2 Encoding - Unicode and Emoji

**Steps:**
1. Create a prompt with Unicode characters:
   - Title: "Test 中文 日本語 한글"
   - Content: "Emoji test: 🎉 🚀 💻 Unicode: café, naïve, résumé"
   - Category: "General"
2. Share the prompt
3. Verify encoding succeeds

**Expected Results:**
- Encoding succeeds without errors
- Unicode characters preserved in encoded data
- Emoji preserved correctly
- String remains URL-safe
- Compression ratio reasonable (60-80% smaller than uncompressed)

---

#### 2.3 Decoding - Valid Code

**Steps:**
1. Create and share a test prompt to get valid code
2. Use PromptEncoder.decode() to decode the string
3. Compare decoded data to original

**Expected Results:**
- Decoding succeeds without errors
- Decoded object has correct structure: `{ title, content, category }`
- All fields match original (with HTML stripped)
- Whitespace trimmed appropriately
- Data types correct (all strings)

---

#### 2.4 Decoding - Invalid Format

**Steps:**
1. Attempt to decode invalid strings:
   - Empty string: `""`
   - Random text: `"INVALID_CODE_12345"`
   - Partial code: `"MZAwXyAQ===CORRUPTED==="`
   - Valid base64 but not LZ-compressed: `"SGVsbG8gV29ybGQ="`

**Expected Results:**
- All invalid codes throw errors
- Error type: `DATA_CORRUPTION` or `VALIDATION_ERROR`
- Error message: "Invalid sharing code format"
- No uncaught exceptions
- No partial/corrupted data returned

---

#### 2.5 Decoding - Decompression Bomb Protection

**Steps:**
1. Create malicious encoded string that decompresses to huge size
2. Attempt to decode

**Expected Results:**
- Decode operation rejects if:
  - Encoded string > 20KB
  - Decompressed JSON > 40KB (2x encoded max)
- Error message indicates size limit exceeded
- Operation fails safely without consuming excessive memory

---

#### 2.6 Decoding - XSS Prevention

**Steps:**
1. Create encoded string containing XSS payloads:
   - `<script>alert('xss')</script>`
   - `<img src=x onerror=alert('xss')>`
   - `javascript:alert('xss')`
2. Decode the string
3. Verify sanitization

**Expected Results:**
- Decoding succeeds
- All HTML tags completely stripped from output
- Script tags removed entirely
- Event handlers removed
- Javascript URLs neutralized
- Text content preserved (tags removed but content kept)

---

### 3. Import Mode UI and Workflow

**Priority**: HIGH
**Dependencies**: Encoding tests (2.1-2.6)

#### 3.1 Mode Toggle Display and Interaction

**Steps:**
1. Click "Add New Prompt" button
2. Observe the mode toggle buttons
3. Verify default state

**Expected Results:**
- Two toggle buttons visible:
  - "Create New" (with plus icon)
  - "Import Shared" (with download icon)
- "Create New" is active by default
- Active button has:
  - White/light background
  - Purple text color
  - Shadow effect
  - `aria-pressed="true"`
- Inactive button has:
  - Transparent/gray background
  - Gray text color
  - `aria-pressed="false"`
- Buttons are horizontally aligned in a rounded container

---

#### 3.2 Switch to Import Mode

**Steps:**
1. Open Add Prompt form
2. Click "Import Shared" toggle button
3. Observe UI changes

**Expected Results:**
- Import mode becomes active (`aria-pressed="true"`)
- Create mode fields hidden:
  - Title input not visible
  - Content textarea not visible
  - Category selector not visible (in create position)
- Import mode fields visible:
  - Information box with instructions
  - "Sharing Code" textarea (6 rows)
  - Placeholder text: "Paste the sharing code here..."
  - Font set to monospace for code display
- Submit button text changes to "Import Prompt"
- Submit button disabled until valid code entered

**Accessibility:**
- Mode toggle keyboard accessible
- Focus management correct
- Screen reader announces mode change

---

#### 3.3 Import Mode - Information Box

**Steps:**
1. Switch to import mode
2. Locate and read the information box

**Expected Results:**
- Blue information box displayed at top
- Contains icon (info circle)
- Heading: "How to Import"
- Description text:
  - Clear instructions
  - Mentions automatic validation
  - Mentions decoding process
- Proper contrast ratios (WCAG AA)
- Dark mode support

---

#### 3.4 Import Code Validation - Debouncing

**Steps:**
1. Switch to import mode
2. Type characters slowly into sharing code textarea
3. Observe validation timing
4. Type quickly (simulate paste)
5. Observe validation

**Expected Results:**
- "Validating..." indicator appears immediately when typing
- Validation does NOT trigger on every keystroke
- Validation triggers 300ms after typing stops (debounced)
- Only one validation runs at a time (previous timers cancelled)
- Fast typing results in single validation
- Loading spinner shows during validation

**Performance:**
- No lag or freezing during typing
- Debounce prevents unnecessary validation calls

---

#### 3.5 Import Code - Valid Code Detection

**Steps:**
1. Create and share a test prompt
2. Copy the sharing code
3. Switch to import mode
4. Paste the code into textarea
5. Wait for validation

**Expected Results:**
- "Validating..." indicator appears
- After 300ms, validation completes
- Success indicator appears:
  - Green checkmark icon
  - Text: "Valid sharing code detected"
  - Green color scheme
- Preview section appears below
- Category selector appears
- Submit button becomes enabled
- No error messages visible

---

#### 3.6 Import Code - Invalid Code Detection

**Steps:**
1. Switch to import mode
2. Enter invalid codes one at a time:
   - Random text: "INVALID_CODE"
   - Partial code: "ABC123"
   - Corrupted code: "MZAwXyAQ===CORRUPTED==="
3. Wait for validation after each

**Expected Results:**
- "Validating..." indicator appears
- After 300ms, validation completes
- Error indicator appears:
  - Red warning icon
  - Text: "Invalid sharing code format"
  - Red color scheme
- Preview section does NOT appear
- Submit button remains disabled
- Error is field-level (not general error banner)

---

#### 3.7 Import Code - Empty Input Handling

**Steps:**
1. Switch to import mode
2. Type some text in sharing code field
3. Delete all text (clear field)
4. Observe behavior

**Expected Results:**
- No validation runs for empty input
- No error message displayed
- "Validating..." indicator does not appear
- Preview section hidden
- Submit button disabled
- Clean state (no leftover validation messages)

---

#### 3.8 Preview Section - Content Display

**Steps:**
1. Import valid sharing code
2. Wait for validation
3. Examine preview section

**Expected Results:**
- Preview section visible with heading "Preview"
- Subheading: "Decoded from sharing code"
- Preview card contains three sections:
  1. **Title Preview**:
     - Label: "Title"
     - Shows decoded title
     - Bold font weight
  2. **Content Preview**:
     - Label: "Content"
     - Shows full content in scrollable box
     - Max height ~160px with scrollbar
     - Preserves newlines and whitespace (pre-wrap)
     - Character count displayed below
  3. **Original Category Preview**:
     - Label: "Original Category"
     - Shows category as colored badge
     - Purple/indigo styling
- Info note: "You can select a different category below before importing"

**Visual Check:**
- Proper spacing and alignment
- Dark mode support
- Scrollbar styled consistently
- Text wrapping correct

---

#### 3.9 Category Selector in Import Mode

**Steps:**
1. Import valid sharing code with category "General"
2. Wait for preview to appear
3. Locate category selector below preview
4. Check default value
5. Change category to "Work"
6. Observe helper text

**Expected Results:**
- Category selector visible below preview
- Label: "Import to Category"
- Dropdown populated with all available categories
- Default value matches decoded prompt's category (if exists)
- If decoded category doesn't exist, defaults to "General"
- When category matches original: Helper text shows "Using original category"
- When category differs: Helper text shows "Importing to '[new]' instead of '[original]'"
- Category selection persists while code is valid

---

#### 3.10 Category Override Workflow

**Steps:**
1. Create prompt in category "General"
2. Share and copy code
3. Open import mode
4. Paste code
5. Wait for validation
6. Change category to "Work"
7. Click "Import Prompt"
8. Verify imported prompt

**Expected Results:**
- Import succeeds
- Prompt appears in "Work" category (not "General")
- Title and content match original
- Original category not used
- User's selection respected

---

#### 3.11 Mode Switching - State Preservation

**Steps:**
1. Switch to import mode
2. Paste valid sharing code
3. Wait for validation (preview appears)
4. Switch back to "Create New" mode
5. Switch back to "Import Shared" mode
6. Observe state

**Expected Results:**
- Import mode state CLEARED when switching away:
  - Sharing code textarea empty
  - Preview section hidden
  - Validation state reset
  - No error messages
  - Submit button disabled
- Fresh state on return to import mode
- No stale data displayed

**Rationale:** Prevents confusion and race conditions

---

#### 3.12 Submit Button State Management

**Steps:**
1. Switch to import mode
2. Observe submit button (should be disabled)
3. Paste invalid code
4. Observe button (should remain disabled)
5. Paste valid code
6. Wait for validation
7. Observe button (should become enabled)

**Expected Results:**
- Button disabled by default in import mode
- Button remains disabled while:
  - No code entered
  - Code is validating (`isValidating: true`)
  - Code is invalid (`validationError` present)
  - No decoded prompt available
- Button enabled only when:
  - Valid code entered
  - Validation complete
  - Preview visible
  - Category selected
- Button shows proper disabled styling (opacity 50%)
- Cursor shows "not-allowed" when disabled

---

#### 3.13 Import Submission - Success Flow

**Steps:**
1. Create and share a test prompt
2. Delete the original prompt (to verify import creates new one)
3. Open import mode
4. Paste sharing code
5. Wait for validation
6. (Optionally) change category
7. Click "Import Prompt" button
8. Observe loading state
9. Wait for completion

**Expected Results:**
- Button enters loading state immediately:
  - Text changes to "Importing..."
  - Spinner icon appears
  - Button becomes disabled
- Form submits
- After completion:
  - Form closes
  - User returns to main prompt list
  - Imported prompt visible in list
  - Prompt data matches preview (title, content, category)
  - Prompt has new ID (not duplicate of original)
  - Success toast may appear (depending on implementation)

**Verification:**
- Imported prompt is fully functional (can edit, delete, share again)
- Storage updated correctly

---

#### 3.14 Import Submission - Loading State UI

**Steps:**
1. Prepare valid import
2. Click submit button
3. Immediately observe button state

**Expected Results:**
- Loading state UI:
  - Button text: "Importing..."
  - Spinner animation (rotating circle)
  - Button disabled
  - Button maintains styling (gradient background)
  - White spinner and text color
- Loading state persists until operation completes
- Form fields remain disabled during import
- Cannot switch modes during import

---

#### 3.15 Import Error - Duplicate Detection

**Steps:**
1. Create a prompt: "Unique Test Prompt"
2. Share and copy code
3. Import the code (creates duplicate)
4. Try to import the same code again

**Expected Results:**
- Behavior depends on duplicate detection implementation:
  - **Option A**: Warning shown, import allowed with new ID
  - **Option B**: Error shown, import prevented
  - **Option C**: Auto-rename (e.g., "Unique Test Prompt (2)")
- User receives clear feedback about duplicate
- No silent failure or data corruption

**Note**: Verify expected behavior matches implementation

---

### 4. Edge Cases and Error Scenarios

**Priority**: HIGH
**Dependencies**: All previous tests

#### 4.1 Empty Prompt Fields

**Steps:**
1. Attempt to share a prompt with empty/whitespace-only content
2. Observe validation

**Expected Results:**
- Sharing prevented (encoding throws validation error)
- Error toast shown
- No encoded data created
- Proper error message: "Content is required"

**Note**: This scenario should not occur in normal use since forms validate before saving

---

#### 4.2 Maximum Length Content

**Steps:**
1. Create prompt with exactly 10,000 character content
2. Share the prompt
3. Import the prompt

**Expected Results:**
- Share succeeds
- Import succeeds
- Content preserved completely
- No truncation
- Character count accurate in preview

**Boundary Test:** Also test 9,999 and 10,001 characters

---

#### 4.3 Minimum Length Content

**Steps:**
1. Create prompt with 1 character content: "A"
2. Share and import

**Expected Results:**
- Share succeeds
- Import succeeds
- Single character preserved
- No issues with compression/decompression

---

#### 4.4 Prompt with Newlines Only

**Steps:**
1. Create prompt with content: "\n\n\n"
2. Share the prompt

**Expected Results:**
- Validation fails (content trims to empty)
- Error shown: "Content is required"
- Share prevented

---

#### 4.5 Extremely Long Title

**Steps:**
1. Create prompt with 100-character title (at limit)
2. Share and import
3. Create prompt with 101-character title
4. Attempt to share

**Expected Results:**
- 100 chars: Share and import succeed
- 101 chars: Share fails with validation error
- Error message: "Title too long (max 100 characters)"

---

#### 4.6 Category with Special Characters

**Steps:**
1. Create custom category: "Work/Personal"
2. Create prompt in that category
3. Share and import

**Expected Results:**
- Share succeeds
- Category name preserved
- Import succeeds if category exists
- If category doesn't exist on target: defaults to "General"

---

#### 4.7 Concurrent Share Operations

**Steps:**
1. Create 3 different prompts
2. Rapidly click share buttons on all three (within 1 second)
3. Check clipboard after each
4. Verify codes are different

**Expected Results:**
- All three share operations complete
- No race conditions or conflicts
- Each clipboard update successful
- Three different sharing codes generated
- No operations fail due to concurrency

---

#### 4.8 Share During Import

**Steps:**
1. Open import mode with valid code pasted
2. While validation is running, share another prompt
3. Observe behavior

**Expected Results:**
- Share operation succeeds independently
- Import validation not affected
- No interference between operations
- Both complete successfully

---

#### 4.9 Network/Storage Failure During Import

**Steps:**
1. Prepare valid import
2. Mock Chrome storage API to fail
3. Click Import button
4. Observe error handling

**Expected Results:**
- General error banner appears
- Error message: "Failed to save prompt" or similar
- Button returns to enabled state (allows retry)
- Form does not close
- User can correct issue or cancel
- Error logged to console

**Mock Setup:**
```javascript
chrome.storage.local.set.mockRejectedValue(new Error('Storage quota exceeded'));
```

---

#### 4.10 Browser Restart - Clipboard Persistence

**Steps:**
1. Share a prompt (code in clipboard)
2. Close extension popup
3. Open another app and paste
4. Reopen extension popup
5. Open import mode and paste

**Expected Results:**
- Clipboard persists across popup close
- Code remains valid after popup restart
- Import works from clipboard after restart
- No session-dependent data in code

---

#### 4.11 Sharing Code with Leading/Trailing Whitespace

**Steps:**
1. Get valid sharing code
2. Add whitespace: `"  [CODE]  \n"`
3. Paste into import field
4. Wait for validation

**Expected Results:**
- Validation trims whitespace automatically
- Code validates successfully
- Import succeeds
- User-friendly (no error for extra whitespace)

---

#### 4.12 Import Mode with No Categories

**Steps:**
1. Mock empty categories array
2. Open import mode
3. Paste valid code
4. Observe category selector

**Expected Results:**
- Category selector shows at least "General" (default)
- Import works
- Prompt created in default category
- No crashes or empty dropdowns

**Note**: Edge case - unlikely in production but good defensive check

---

### 5. Accessibility and Keyboard Navigation

**Priority**: HIGH
**Dependencies**: Import mode tests (3.1-3.15)

#### 5.1 ARIA Labels and Roles

**Steps:**
1. Inspect all interactive elements in import workflow
2. Check ARIA attributes
3. Test with screen reader (NVDA, JAWS, or VoiceOver)

**Expected Results:**
- Share button: `aria-label="Share [title]"`, `aria-busy="true"` during loading
- Mode toggle buttons: `aria-pressed="true/false"`, `aria-label` descriptive
- Import textarea: `id="import-code"`, associated `<label for="import-code">`
- Category selector: `id="import-category"`, associated `<label for="import-category">`
- Submit button: `type="submit"`, proper disabled state
- Error messages: `role="alert"` or `aria-live="polite"`
- Preview section: Proper heading hierarchy (`<h3>`)

**Screen Reader Checks:**
- All labels announced correctly
- State changes announced (validating, valid, error)
- Loading states announced
- Form structure logical

---

#### 5.2 Keyboard Navigation - Complete Import Workflow

**Steps:**
1. Use only keyboard (no mouse)
2. Navigate through complete import workflow:
   - Tab to "Add New Prompt" button → Enter
   - Tab to "Import Shared" toggle → Enter
   - Tab to sharing code textarea → Type/paste code
   - Wait for validation
   - Tab to category selector → Arrow keys to change
   - Tab to "Import Prompt" button → Enter

**Expected Results:**
- All elements reachable via Tab
- Tab order logical and intuitive
- Focus indicators always visible
- Enter/Space keys activate buttons
- Arrow keys work in dropdown
- No keyboard traps
- Can cancel with Tab to Cancel button
- Shift+Tab navigates backwards

**Focus Order:**
1. Mode toggles
2. Sharing code textarea
3. Category selector (when visible)
4. Cancel button
5. Submit button

---

#### 5.3 Focus Management - Mode Switching

**Steps:**
1. Tab to mode toggle buttons
2. Focus on "Create New" (active)
3. Tab to "Import Shared"
4. Press Enter
5. Observe focus

**Expected Results:**
- Focus moves logically after mode change
- No focus loss
- Focus indicator visible
- Can continue navigating from current position

---

#### 5.4 Screen Reader Announcements - Validation States

**Steps:**
1. Enable screen reader
2. Switch to import mode
3. Paste invalid code
4. Wait for validation error
5. Listen to announcement

**Expected Results:**
- Error region has `role="alert"` or `aria-live="polite"`
- Error message announced automatically
- User informed of error without moving focus
- Success states also announced when code becomes valid

---

#### 5.5 Color Contrast - WCAG Compliance

**Steps:**
1. Test color contrast ratios for:
   - Validation success message (green on white)
   - Validation error message (red on white)
   - Info box (blue on white)
   - Dark mode variants of all above
2. Use contrast checker tool

**Expected Results:**
- All text meets WCAG AA standard (4.5:1 for normal text)
- Icons with text meet requirements
- Status indicators distinguishable without color alone (icons + text)
- Dark mode meets same standards

**Tool**: Use browser DevTools or online contrast checker

---

#### 5.6 Keyboard Shortcuts - Quick Actions

**Steps:**
1. Test if keyboard shortcuts exist for common actions:
   - Share: Click share button → Enter/Space
   - Import: Focus textarea → Ctrl+V to paste
   - Submit: Form focused → Enter submits

**Expected Results:**
- Enter key submits form when focus in form
- Space/Enter activate focused buttons
- Standard shortcuts work (Ctrl+V, Ctrl+A, etc.)
- No conflicting shortcuts
- Shortcuts documented (if custom ones exist)

---

### 6. Integration and Data Integrity Tests

**Priority**: CRITICAL
**Dependencies**: All previous tests

#### 6.1 Round-Trip Data Integrity

**Steps:**
1. Create complex prompt:
   - Title: "Integration Test Prompt - 中文 Emoji 🎉"
   - Content: Multi-paragraph with:
     - Newlines and tabs
     - Special chars: `"quotes", <brackets>, & ampersands`
     - Unicode: café, résumé, naïve
     - Emoji: 🚀 💻 ✨
   - Category: "Work"
2. Share the prompt
3. Save sharing code
4. Delete original prompt
5. Import from sharing code
6. Compare imported to original

**Expected Results:**
- All text fields match exactly (after sanitization)
- Newlines preserved
- Tabs preserved
- Unicode characters intact
- Emoji intact
- Special characters preserved (HTML stripped)
- Category matches (if category exists) or defaults
- No data loss or corruption

**Verification Method:**
- Export both prompts
- Compare JSON (excluding IDs and timestamps)
- Character-by-character match

---

#### 6.2 Re-Sharing Imported Prompt

**Steps:**
1. Create and share prompt A → get code1
2. Import prompt A from code1
3. Share the imported prompt → get code2
4. Import from code2 → get prompt B
5. Compare original A to final B

**Expected Results:**
- code1 and code2 may differ (different compression) but both valid
- Prompt B data matches prompt A data
- No degradation through re-sharing
- Multiple generations preserve data integrity

---

#### 6.3 Import to Different User/Extension

**Steps:**
1. User 1: Create and share prompt
2. User 1: Send code to User 2 (via chat, email, etc.)
3. User 2: Open their extension (different Chrome profile)
4. User 2: Import code
5. Verify prompt appears

**Expected Results:**
- Code is truly portable (no user/session dependency)
- User 2 sees correct content
- Category defaults if not present in User 2's extension
- All features work for User 2's prompt

**Setup:** Requires two Chrome profiles or manual testing with colleague

---

#### 6.4 Large-Scale Sharing

**Steps:**
1. Create 10 different prompts
2. Share all 10 (collect codes)
3. Delete all 10 prompts
4. Import all 10 codes one by one
5. Verify all imported correctly

**Expected Results:**
- All 10 imports succeed
- No duplicate IDs
- All data preserved
- No performance degradation
- Storage updated correctly
- No quota issues (if within limits)

---

#### 6.5 Sharing with Storage Near Quota

**Steps:**
1. Fill storage to near quota limit (e.g., 95% full)
2. Attempt to share a prompt
3. Attempt to import a prompt

**Expected Results:**
- Share succeeds (encoding doesn't use storage)
- Import may fail if storage full
- Clear error message if storage quota exceeded
- User informed to free up space
- No data corruption

---

#### 6.6 Prompt with Duplicate Detection

**Steps:**
1. Create prompt: "Example Prompt"
2. Share and import (creates duplicate)
3. Verify duplicate handling
4. Edit one copy
5. Share edited version
6. Import edited version

**Expected Results:**
- Duplicate detection works (if implemented)
- Both versions maintained independently
- Editing one doesn't affect other
- Sharing edited version creates new code
- Import creates new prompt (not update existing)

**Note:** Verify duplicate detection behavior matches implementation (allow, prevent, or warn)

---

#### 6.7 Cross-Version Compatibility

**Steps:**
1. Create sharing code in current version
2. (If applicable) Test import in older version
3. Test import in newer version (future proofing)

**Expected Results:**
- Forward compatibility: Old codes work in new version
- Backward compatibility: New codes may fail gracefully in old version
- Version indicator in code (if implemented)
- Migration path documented

**Note:** Primarily relevant for long-term maintenance

---

### 7. Security and Validation Tests

**Priority**: CRITICAL
**Dependencies**: Encoding tests (2.1-2.6)

#### 7.1 XSS Prevention - Script Tags

**Steps:**
1. Create encoded string containing:
   ```
   Title: "<script>alert('XSS')</script>"
   Content: "Normal content"
   ```
2. Import the code
3. Verify sanitization

**Expected Results:**
- Import succeeds
- Script tags completely removed
- No JavaScript execution
- Title shows as plain text (no tags)
- Preview safe to display
- Imported prompt safe in storage

**Verification:**
- Check DOM for `<script>` tags (should be 0)
- Check prompt content (should not include tags)

---

#### 7.2 XSS Prevention - Event Handlers

**Steps:**
1. Create encoded string with event handlers:
   ```
   Title: "Test"
   Content: "<img src=x onerror=alert('XSS')>"
   ```
2. Import and display

**Expected Results:**
- Event handlers stripped
- No JavaScript execution
- Image tag removed
- Text content preserved: "Test"
- Safe to display in UI

---

#### 7.3 XSS Prevention - JavaScript URLs

**Steps:**
1. Create encoded string with JavaScript URLs:
   ```
   Title: "Test"
   Content: "<a href='javascript:alert(\"XSS\")'>Click</a>"
   ```
2. Import and verify

**Expected Results:**
- JavaScript URL neutralized
- Link tag removed
- Text content preserved: "Click"
- No executable code in output

---

#### 7.4 HTML Injection

**Steps:**
1. Create encoded string with HTML:
   ```
   Content: "<div style='background:red'>Styled content</div>"
   ```
2. Import and display

**Expected Results:**
- All HTML tags stripped
- Styling not applied
- Text content preserved: "Styled content"
- No layout breaking
- Consistent styling with app theme

---

#### 7.5 SQL Injection Patterns (Not Applicable but Test)

**Steps:**
1. Create prompt with SQL-like content:
   ```
   Content: "'; DROP TABLE prompts; --"
   ```
2. Share and import

**Expected Results:**
- Content treated as plain text
- No SQL execution (extension uses Chrome storage, not SQL)
- Special characters preserved
- Import succeeds

**Rationale:** Defense-in-depth, future-proofing

---

#### 7.6 Path Traversal Patterns

**Steps:**
1. Create prompt with path traversal attempts:
   ```
   Title: "../../etc/passwd"
   Content: "../../../system/files"
   ```
2. Share and import

**Expected Results:**
- Content treated as plain text
- No file system access attempted
- Import succeeds
- Content stored safely

---

#### 7.7 Size Bomb - Highly Compressible Content

**Steps:**
1. Create prompt with highly repetitive content:
   ```
   Content: "A".repeat(9999)
   ```
2. Share (compresses very well)
3. Attempt to create malicious code that decompresses to huge size
4. Try to import

**Expected Results:**
- Normal repetitive content: Share and import succeed
- Malicious decompression bomb: Rejected
- Size check before decompression
- Size check after decompression
- Max decompressed size: 40KB (2x encoded max)

---

#### 7.8 Prototype Pollution

**Steps:**
1. Create encoded string with prototype pollution attempt:
   ```json
   {
     "title": "Test",
     "content": "Test",
     "category": "General",
     "__proto__": { "isAdmin": true }
   }
   ```
2. Import the code
3. Check object prototype

**Expected Results:**
- Import either fails validation or strips `__proto__`
- No prototype modification
- JavaScript prototypes unchanged
- Security not compromised

---

#### 7.9 Invalid Data Types

**Steps:**
1. Create encoded strings with wrong types:
   ```json
   { "title": 123, "content": true, "category": null }
   ```
2. Attempt to import

**Expected Results:**
- Validation fails
- Error: "Invalid sharing code format"
- Type checking enforced (all fields must be strings)
- No type coercion issues

---

#### 7.10 Required Fields Validation

**Steps:**
1. Create encoded strings missing required fields:
   - Missing title: `{ "content": "Test", "category": "General" }`
   - Missing content: `{ "title": "Test", "category": "General" }`
   - Missing category: `{ "title": "Test", "content": "Test" }`
2. Attempt to import each

**Expected Results:**
- All imports fail validation
- Clear error messages indicating missing field
- No partial data imported
- Form remains open for correction

---

### 8. Dark Mode and Visual Design

**Priority**: MEDIUM
**Dependencies**: Basic functionality tests (1.1-3.15)

#### 8.1 Dark Mode - Share Button

**Steps:**
1. Enable dark mode in extension
2. Observe share button styling
3. Hover over button
4. Click button

**Expected Results:**
- Button icon color: light gray (`text-gray-500`)
- Hover state: purple tint (`text-purple-400`)
- Background hover: purple with transparency (`bg-purple-900/20`)
- Consistent with other buttons (copy, menu)
- Proper contrast for visibility

---

#### 8.2 Dark Mode - Import Mode UI

**Steps:**
1. Enable dark mode
2. Switch to import mode
3. Review all UI elements

**Expected Results:**
- Info box: Blue background with transparency, light text
- Textarea: Dark background (`bg-gray-700/60`), light text
- Validation messages: Appropriate colors (green/red with good contrast)
- Preview card: Dark background, light text
- Category selector: Dark styling
- All text readable (meets WCAG AA)

---

#### 8.3 Dark Mode - Toast Notifications

**Steps:**
1. Enable dark mode
2. Share a prompt
3. Observe success toast
4. Trigger error toast

**Expected Results:**
- Success toast: Dark background, light text, green accent
- Error toast: Dark background, light text, red accent
- Proper contrast ratios
- Auto-dismiss works
- Positioned consistently

---

#### 8.4 Light/Dark Mode Toggle

**Steps:**
1. Start in light mode
2. Share a prompt
3. Toggle to dark mode
4. Toggle back to light mode
5. Verify consistency

**Expected Results:**
- No layout shifts during toggle
- All colors transition smoothly
- No stuck elements in wrong theme
- State preserved during toggle
- Transitions applied (if implemented)

---

#### 8.5 Visual Design - Button States

**Steps:**
1. Review share button states:
   - Default
   - Hover
   - Focus
   - Active (pressed)
   - Disabled (loading)
2. Test in both light and dark modes

**Expected Results:**
- Default: Gray icon, transparent background
- Hover: Purple icon, light purple background
- Focus: Clear outline, proper contrast
- Active: Darker purple
- Disabled: Reduced opacity (50%), no pointer cursor
- All states visually distinct
- Consistent with design system

---

#### 8.6 Visual Design - Form Layout

**Steps:**
1. Open import mode
2. Resize window (test responsive behavior)
3. Test at different sizes:
   - Extension popup (default ~400px)
   - Side panel mode (wider)
   - Minimum width

**Expected Results:**
- Layout adapts gracefully
- No horizontal scrolling (unless content requires)
- Buttons remain accessible
- Text doesn't overflow
- Preview scrolls correctly
- Minimum width enforced

---

### 9. Performance and Optimization

**Priority**: MEDIUM
**Dependencies**: All functional tests

#### 9.1 Share Performance - Normal Prompt

**Steps:**
1. Create standard prompt (~500 chars)
2. Click share button
3. Measure time to clipboard

**Expected Results:**
- Operation completes in < 200ms
- No UI blocking
- Smooth state transitions
- No lag or stutter

**Measurement:** Use Performance API or DevTools

---

#### 9.2 Share Performance - Large Prompt

**Steps:**
1. Create large prompt (9,000 chars)
2. Click share button
3. Measure encoding time

**Expected Results:**
- Operation completes in < 500ms
- UI remains responsive
- Loading state shows appropriately
- No browser freezing

---

#### 9.3 Import Performance - Validation

**Steps:**
1. Paste valid sharing code
2. Measure validation time (from last keystroke to result)

**Expected Results:**
- Debounce delay: 300ms
- Validation execution: < 100ms
- Total time: < 400ms
- No blocking of UI thread
- Smooth indicator updates

---

#### 9.4 Memory Usage - Multiple Operations

**Steps:**
1. Perform 20 share operations in sequence
2. Monitor memory usage in DevTools
3. Perform 20 import operations
4. Check for memory leaks

**Expected Results:**
- Memory usage stable (no continuous growth)
- No memory leaks from event listeners
- Garbage collection works properly
- No retained detached DOM nodes
- Memory returns to baseline after operations

---

#### 9.5 Storage Performance - Import

**Steps:**
1. Import 10 prompts rapidly
2. Measure storage write times
3. Check for conflicts

**Expected Results:**
- Each import completes in < 500ms
- No race conditions
- Atomic operations
- Storage lock mechanism works (if implemented)
- All imports successful

---

### 10. Error Recovery and User Experience

**Priority**: MEDIUM
**Dependencies**: Error scenario tests (4.1-4.12)

#### 10.1 Error Recovery - Retry After Failure

**Steps:**
1. Trigger share failure (mock clipboard rejection)
2. Click share button again
3. This time allow success

**Expected Results:**
- First attempt: Error toast, button returns to normal
- Second attempt: Success toast, works correctly
- No stuck state
- User can retry immediately
- No residual error state

---

#### 10.2 Error Recovery - Fix Invalid Code

**Steps:**
1. Paste invalid code in import mode
2. Wait for error
3. Correct the code (paste valid code)
4. Wait for validation

**Expected Results:**
- Error clears automatically
- Success indicator appears
- Preview shows
- Submit button enables
- Smooth transition from error to success

---

#### 10.3 User Feedback - Loading States

**Steps:**
1. Perform share operation
2. Observe loading indicators
3. Perform import operation
4. Observe loading indicators

**Expected Results:**
- Loading states always visible during operations
- Spinner or progress indicator
- Descriptive text ("Sharing...", "Importing...")
- Buttons disabled during loading
- Cannot trigger multiple operations
- Clear when operation completes

---

#### 10.4 User Feedback - Success Confirmation

**Steps:**
1. Share a prompt
2. Observe success feedback
3. Import a prompt
4. Observe success feedback

**Expected Results:**
- **Share**: Toast notification, clipboard confirmation
- **Import**: Form closes, prompt appears in list, optional toast
- Success messages clear and actionable
- Auto-dismiss after appropriate time (~3-5 seconds)
- User can proceed immediately

---

#### 10.5 User Feedback - Error Messages

**Steps:**
1. Trigger various errors:
   - Invalid code
   - Storage failure
   - Size limit exceeded
   - Clipboard denied
2. Review error messages

**Expected Results:**
- Error messages clear and specific
- Suggest corrective action when possible
- No technical jargon (user-friendly)
- Appropriate tone (helpful, not blaming)
- Persistent until resolved (field errors)
- Auto-dismiss or user-dismiss for toasts

**Examples:**
- ✅ "Prompt too large to share. Try reducing content length."
- ❌ "Validation error: ERR_SIZE_LIMIT_EXCEEDED"

---

#### 10.6 Cancel During Import

**Steps:**
1. Open import mode
2. Paste valid code
3. Wait for validation (preview appears)
4. Click "Cancel" button
5. Verify cleanup

**Expected Results:**
- Form closes immediately
- No import performed
- State cleaned up (no pending operations)
- Return to main prompt list
- No errors or warnings

---

#### 10.7 Escape Key Handling

**Steps:**
1. Open import mode
2. Enter some data
3. Press Escape key
4. Verify behavior

**Expected Results:**
- Escape closes form (same as cancel)
- Or Escape clears current field (depending on focus)
- Behavior consistent with rest of app
- No data submitted

---

---

## Test Execution Guide

### Prerequisites

1. **Development Environment**:
   - Node.js installed
   - Dependencies installed: `npm install`
   - Dev server running: `npm run dev`
   - Extension loaded in Chrome: `chrome://extensions/` → Load Unpacked → `dist/`

2. **Test Tools**:
   - Chrome DevTools
   - Playwright (for automated tests): `npx playwright test`
   - Screen reader (NVDA, JAWS, or VoiceOver)
   - Color contrast checker

3. **Test Data**:
   - Sample prompts with various content
   - Valid sharing codes
   - Invalid/malicious codes for security testing

### Test Execution Priority

**Phase 1 - Critical Path (Must Pass):**
- 1.2: Share Button - Success Flow
- 2.3: Decoding - Valid Code
- 3.5: Import Code - Valid Detection
- 3.13: Import Submission - Success
- 6.1: Round-Trip Data Integrity
- 7.1-7.4: XSS Prevention

**Phase 2 - High Priority:**
- All Section 1 (Share Button)
- All Section 3 (Import Mode)
- All Section 5 (Accessibility)
- 2.6: XSS Prevention
- 6.2-6.4: Integration tests

**Phase 3 - Medium Priority:**
- Section 4 (Edge Cases)
- Section 8 (Dark Mode)
- Section 9 (Performance)
- Section 10 (Error Recovery)

**Phase 4 - Low Priority:**
- Remaining edge cases
- Cross-version testing
- Large-scale testing

### Automated vs Manual Testing

**Automated (Playwright):**
- All functional tests (Sections 1-3)
- Most integration tests (Section 6)
- Basic accessibility tests (Section 5)
- Error scenarios (Section 4)

**Manual Testing Required:**
- Screen reader testing (5.1, 5.4)
- Visual design review (Section 8)
- Performance profiling (Section 9)
- Cross-browser testing
- Real-world usability

### Reporting Issues

When reporting issues, include:

1. **Test ID**: e.g., "3.5 - Import Code Valid Detection"
2. **Priority**: Critical / High / Medium / Low
3. **Actual vs Expected**: Clear description
4. **Reproduction Steps**: Exact steps to reproduce
5. **Environment**: Browser version, OS, extension version
6. **Screenshots/Video**: Visual evidence
7. **Console Logs**: Errors or warnings
8. **Related Tests**: Dependencies or related failures

### Success Criteria

**For Release:**
- All Critical Path tests pass (Phase 1)
- All High Priority tests pass (Phase 2)
- No Critical or High severity issues
- Accessibility compliance (WCAG AA)
- Performance benchmarks met
- Security tests pass

**For Beta:**
- Critical Path tests pass
- No Critical issues
- Known issues documented

---

## Appendix

### A. Test Data

**Standard Test Prompt:**
```
Title: "Test Sharing Prompt"
Content: "This is a test prompt for sharing functionality validation."
Category: "General"
```

**Special Characters Prompt:**
```
Title: "Test \"Special\" <Characters> & Symbols"
Content: "Content with\nnewlines\tand\ttabs\nand \"quotes\" & <tags>"
Category: "General"
```

**Unicode Prompt:**
```
Title: "Test 中文 日本語 한글"
Content: "Emoji test: 🎉 🚀 💻\nUnicode: café, naïve, résumé"
Category: "General"
```

**Large Prompt:**
```
Title: "Large Content Test"
Content: "A".repeat(9000) + "\n\n" + "B".repeat(999)
Category: "General"
```

### B. Valid Sharing Code Examples

Generated from test prompts (examples only, not actual codes):

```
Standard: MZAwXyAQAAQA5A0A...
Special: NTAwXyBRAAMA9B1B...
Unicode: PTBwYyBSAAQB3C2C...
```

### C. Invalid Sharing Code Examples

```
Empty: ""
Random: "INVALID_CODE_12345"
Corrupted: "MZAwXyAQ===CORRUPTED==="
Partial: "MZAw"
Too Short: "ABC"
Wrong Format: "not-a-valid-code"
```

### D. Useful Commands

```bash
# Run all E2E tests
npx playwright test

# Run specific test file
npx playwright test tests/e2e/prompt-sharing.spec.ts

# Run with UI
npx playwright test --ui

# Debug mode
npx playwright test --debug

# Generate test report
npx playwright show-report

# Start dev server
npm run dev

# Build extension
npm run build

# Lint check
npm run lint

# Type check
npm run type-check
```

### E. Browser DevTools Checks

**Console Checks:**
- No errors during normal operations
- Warnings logged appropriately (dev mode only)
- Errors logged with context

**Network Checks:**
- No external network calls (all local)
- Chrome storage API calls only

**Performance Checks:**
- Memory usage stable
- No memory leaks
- Encoding/decoding under 500ms

**Storage Checks:**
- Chrome storage.local used correctly
- Data structure valid
- No quota exceeded errors

### F. Accessibility Checklist

- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible
- [ ] ARIA labels present and accurate
- [ ] Screen reader announcements correct
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] Status updates announced
- [ ] Error messages accessible
- [ ] Form validation accessible
- [ ] No keyboard traps
- [ ] Logical tab order

### G. Security Checklist

- [ ] HTML tags stripped on encode
- [ ] HTML tags stripped on decode
- [ ] XSS prevention effective
- [ ] Size limits enforced
- [ ] Decompression bombs prevented
- [ ] Type validation enforced
- [ ] Required fields validated
- [ ] No prototype pollution
- [ ] No injection vulnerabilities
- [ ] Safe clipboard handling

---

## Changelog

**Version 1.0** - Initial test plan created
- Comprehensive coverage of prompt sharing feature
- 80+ test scenarios across 10 categories
- Automated test file already exists (`prompt-sharing.spec.ts`)
- Focus on critical path, security, and accessibility

**Test Plan Metadata:**
- Total Scenarios: 87
- Critical Priority: 15
- High Priority: 45
- Medium Priority: 20
- Low Priority: 7
- Estimated Manual Test Time: 8-10 hours
- Estimated Automated Test Time: 15-20 minutes

---

## Summary

This test plan provides comprehensive coverage of the Prompt Sharing feature, including:

✅ **Functional Testing**: Share button, encoding/decoding, import workflow
✅ **Security Testing**: XSS prevention, input validation, sanitization
✅ **Accessibility Testing**: Keyboard navigation, ARIA labels, screen readers
✅ **Integration Testing**: Round-trip data integrity, concurrent operations
✅ **Edge Cases**: Size limits, special characters, error scenarios
✅ **UX Testing**: Loading states, error messages, dark mode
✅ **Performance Testing**: Encoding speed, memory usage, debouncing

The feature is production-ready when all Critical and High priority tests pass with no known security or accessibility issues.
