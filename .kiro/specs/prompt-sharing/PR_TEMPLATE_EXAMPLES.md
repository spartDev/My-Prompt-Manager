# Pull Request Template - Real-World Examples

This document shows the template filled out for different types of changes in the Claude UI Chrome Extension project.

---

## Example 1: New Feature with Service Implementation

**PR Title:** `feat: Add Analytics Service with Event Tracking`

```markdown
## Summary

Implements a new `AnalyticsService` that tracks user interactions with prompts (view, copy, use). Includes a React hook `useAnalytics()` for easy integration and comprehensive unit tests. This provides foundation for understanding user behavior and feature usage.

## Related Issues
**JIRA:** [CLAUDE-456](https://company.atlassian.net/browse/CLAUDE-456)
**GitHub Issues:** Closes #123, Related to #118

## Type of Change
- [x] 🆕 New feature (non-breaking change that adds functionality)
- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to change)
- [ ] 📝 Documentation update
- [ ] ♻️ Code refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] ✅ Test improvement
- [ ] 🔧 Configuration/build changes

## Motivation and Context

Users requested insights into which prompts are most useful. Analytics will help us:
1. Identify popular prompts to feature prominently
2. Understand usage patterns across different AI platforms
3. Make data-driven decisions for future features

Design doc: [Analytics Implementation Plan](../ANALYTICS_IMPLEMENTATION_PLAN.md)

## Implementation Details

### What Changed

Implemented a singleton `AnalyticsService` using the Strategy pattern for different event types. The service:
- Batches events to minimize storage operations (100ms debounce)
- Stores analytics data in Chrome storage.local
- Provides TypeScript-first API with full type safety
- Includes automatic cleanup of old events (30-day retention)

### Key Files Modified

- `src/services/AnalyticsService.ts` - Core analytics service implementation (singleton pattern)
- `src/hooks/useAnalytics.ts` - React hook for component-level analytics tracking
- `src/types/analytics.ts` - TypeScript types for events and service contract
- `src/components/PromptCard.tsx` - Integrated analytics tracking on prompt actions
- `tests/services/AnalyticsService.test.ts` - Comprehensive unit tests (95% coverage)

### API/Interface Changes

New public API:

<details>
<summary>Example API Usage (click to expand)</summary>

```typescript
// Service usage (singleton)
import { AnalyticsService } from '@/services/AnalyticsService';

const analytics = AnalyticsService.getInstance();
await analytics.trackEvent({
  type: 'prompt_used',
  promptId: 'abc-123',
  platform: 'claude',
  timestamp: Date.now()
});

// Hook usage (React components)
import { useAnalytics } from '@/hooks/useAnalytics';

function PromptCard({ prompt }) {
  const { trackPromptUsed, trackPromptCopied } = useAnalytics();

  const handleUse = () => {
    trackPromptUsed(prompt.id, 'claude');
    // ... rest of logic
  };

  return <button onClick={handleUse}>Use Prompt</button>;
}

// Query analytics data
const stats = await analytics.getStats({
  startDate: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
  endDate: Date.now()
});
```

</details>

## Breaking Changes
**Does this introduce breaking changes?** ⚠️
- [ ] Yes - See details below
- [x] No - Fully backward compatible

## Testing

### Test Coverage
- [x] Unit tests added/updated (`npm test`)
- [x] Integration tests added/updated
- [x] Manual testing completed
- [x] All existing tests pass

**Coverage:** `npm run test:coverage` shows 95% coverage for new code (38 tests added)

### Test Scenarios Validated

1. **Happy Path - Track Event:** Create and track multiple events successfully - ✅ Pass
2. **Edge Case - Event Batching:** Verify events are batched within 100ms window - ✅ Pass
3. **Edge Case - Storage Full:** Handle quota exceeded gracefully with error logging - ✅ Pass
4. **Error Handling - Invalid Event:** Reject events with missing required fields - ✅ Pass
5. **Data Cleanup - Old Events:** Automatically delete events older than 30 days - ✅ Pass
6. **Concurrency - Multiple Trackers:** Handle concurrent tracking from multiple components - ✅ Pass

### How to Test Manually

```bash
npm run dev

# 1. Open extension popup
# 2. Click "Use Prompt" on any prompt
# 3. Open Chrome DevTools > Application > Storage > chrome.local
# 4. Verify 'analytics_events' key contains the tracked event
# 5. Repeat steps 2-4 multiple times within 100ms
# 6. Verify events are batched (not individual writes)
```

**Debug Mode:**
```javascript
// In console
window.__analyticsDebug = true;
// Now all analytics events are logged to console
```

## Visual Changes

No UI changes in this PR. Analytics runs in the background.

## Performance Impact
- [x] No performance impact
- [ ] Performance improved (describe below)
- [ ] Performance impact acceptable (explain below)

**Metrics:**
- Bundle size: +8.2 KB (minified + gzipped)
- Storage operations: Reduced by 90% due to batching (1 write per 100ms vs. 1 per event)
- Memory usage: +~50 KB for event buffer (acceptable)
- No impact on UI rendering

## Security Considerations
- [x] No security implications
- [x] Input validation implemented
- [x] Output encoding implemented
- [ ] Authentication/authorization reviewed
- [x] No sensitive data exposed
- [x] Dependencies scanned for vulnerabilities

**Security Notes:**
- Events contain no PII (only prompt IDs, timestamps, action types)
- Data stored locally in Chrome storage (not sent to external servers)
- All event data sanitized and validated before storage
- Implemented event data size limits (max 10 KB per event)

## Documentation
- [x] Code comments added for complex logic
- [x] README.md updated (added "Analytics" section)
- [x] ARCHITECTURE.md updated (added service to diagram)
- [x] CHANGELOG.md updated (added to [Unreleased] section)

## Pre-Merge Checklist
- [x] Code follows project style guidelines
- [x] Self-review completed
- [x] Code builds without errors (`npm run build`)
- [x] All tests pass (`npm test`)
- [x] Lint checks pass (`npm run lint`)
- [x] No new warnings introduced
- [x] Branch is up-to-date with base branch
- [x] Commits are clean and well-described

## Deployment Notes

**Feature Flag:** None required - service is opt-in via explicit API calls

**Rollout Plan:**
1. Merge and deploy
2. Monitor storage quota usage for 24 hours
3. If no issues, integrate with more components in follow-up PRs

## Additional Context

**Future Work:**
- #124 - Add analytics dashboard in settings
- #125 - Export analytics data to CSV
- #126 - Add privacy controls (opt-out)

**Technical Decisions:**
- Chose 100ms batching window after testing (balance between responsiveness and storage efficiency)
- 30-day retention based on Chrome storage quota limits (~5 MB total)
- Singleton pattern to ensure single event buffer across extension contexts

---

**Reviewer Focus Areas:**
- Verify batching logic in `AnalyticsService.ts` (lines 45-82)
- Check storage quota handling in error cases
- Review TypeScript types for completeness
```

---

## Example 2: Bug Fix

**PR Title:** `fix: Resolve PromptCard title truncation in resizable sidebar`

```markdown
## Summary

Fixes a CSS issue where prompt titles were truncated incorrectly when the sidebar was resized below 300px width. The title now properly wraps to multiple lines and maintains readability at all sidebar widths.

## Related Issues
**GitHub Issues:** Fixes #83

## Type of Change
- [ ] 🆕 New feature (non-breaking change that adds functionality)
- [x] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to change)
- [ ] 📝 Documentation update
- [ ] ♻️ Code refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] ✅ Test improvement
- [ ] 🔧 Configuration/build changes

## Motivation and Context

Users reported that when resizing the sidebar to narrow widths (< 300px), prompt titles were cut off mid-word with ellipsis, making them unreadable. This was particularly problematic for long prompt titles.

Issue report: #83

## Implementation Details

### What Changed

Changed CSS for `.prompt-card-title` from `text-overflow: ellipsis` with `white-space: nowrap` to use `word-wrap: break-word` with a max-height constraint. This allows titles to wrap naturally while still preventing excessive vertical space usage.

### Key Files Modified

- `src/components/PromptCard.tsx` - Updated className to use new CSS utility
- `src/index.css` - Added `.prompt-title-wrap` utility class
- `tests/components/PromptCard.test.tsx` - Added regression test for title wrapping

### CSS Changes

<details>
<summary>CSS Diff (click to expand)</summary>

```css
/* Before */
.prompt-card-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

/* After */
.prompt-title-wrap {
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-height: 3.6em; /* ~3 lines */
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}
```

</details>

## Breaking Changes
**Does this introduce breaking changes?** ⚠️
- [ ] Yes - See details below
- [x] No - Fully backward compatible

## Testing

### Test Coverage
- [x] Unit tests added/updated (`npm test`)
- [ ] Integration tests added/updated
- [x] Manual testing completed
- [x] All existing tests pass

**Coverage:** Added test case for title wrapping behavior

### Test Scenarios Validated

1. **Original Bug:** Narrow sidebar (< 300px) with long title - ✅ Pass (title wraps)
2. **Edge Case:** Very long title (> 150 characters) - ✅ Pass (wraps to max 3 lines)
3. **Edge Case:** Short title in narrow sidebar - ✅ Pass (single line, no wrapping)
4. **Regression:** Wide sidebar (> 400px) with long title - ✅ Pass (wraps naturally)

### How to Test Manually

```bash
npm run dev

# 1. Open extension side panel
# 2. Find a prompt with a long title (or create one: "This is a very long prompt title that should demonstrate the wrapping behavior properly")
# 3. Slowly resize the sidebar from wide (500px) to narrow (200px)
# 4. Verify:
#    - Title wraps to multiple lines (max 3)
#    - No mid-word ellipsis truncation
#    - Text remains readable
#    - Card height adjusts appropriately
```

## Visual Changes

### Before & After

| Before (Bug) | After (Fixed) |
|--------------|---------------|
| ![Before - title truncated with ellipsis](https://user-images.githubusercontent.com/12345/before-truncation.png) | ![After - title wraps properly](https://user-images.githubusercontent.com/12345/after-wrap.png) |

**Demo GIF showing resize behavior:**

![Sidebar resize demo](https://user-images.githubusercontent.com/12345/sidebar-resize-demo.gif)

**Steps shown in GIF:**
1. Start with wide sidebar (title on single line)
2. Resize to narrow (title wraps to 2 lines)
3. Resize to very narrow (title wraps to 3 lines, then ellipsis on 3rd line)

## Performance Impact
- [x] No performance impact
- [ ] Performance improved (describe below)
- [ ] Performance impact acceptable (explain below)

**Metrics:**
- CSS-only change, no JavaScript performance impact
- Negligible layout reflow (only when resizing)

## Security Considerations
- [x] No security implications
- [ ] Input validation implemented
- [ ] Output encoding implemented
- [ ] Authentication/authorization reviewed
- [ ] No sensitive data exposed
- [ ] Dependencies scanned for vulnerabilities

**Security Notes:** CSS-only change, no security implications.

## Documentation
- [x] Code comments added for complex logic (CSS clamping)
- [ ] README.md updated (not needed for bug fix)
- [ ] ARCHITECTURE.md or other docs updated (not needed)
- [x] CHANGELOG.md updated (added to [Unreleased] - Fixed section)

## Pre-Merge Checklist
- [x] Code follows project style guidelines
- [x] Self-review completed
- [x] Code builds without errors (`npm run build`)
- [x] All tests pass (`npm test`)
- [x] Lint checks pass (`npm run lint`)
- [x] No new warnings introduced
- [x] Branch is up-to-date with base branch
- [x] Commits are clean and well-described

## Deployment Notes

No special deployment considerations. CSS change takes effect immediately.

## Additional Context

**Alternative Approaches Considered:**
1. Dynamic font size based on sidebar width - Rejected (too complex, poor UX)
2. Tooltip on hover for full title - Rejected (mobile users can't hover)
3. Expandable title on click - Rejected (unnecessary interaction)

**Design Decision:** Max 3 lines with ellipsis on 3rd line balances readability with card height consistency.

---

**Reviewer Focus Areas:**
- Verify CSS cross-browser compatibility (especially `-webkit-line-clamp`)
- Test on different screen sizes
- Check dark mode appearance
```

---

## Example 3: Documentation Update

**PR Title:** `docs: Add comprehensive component catalog with examples`

```markdown
## Summary

Adds `COMPONENTS.md` documenting all 40+ React components in the project with descriptions, props, usage examples, and design patterns. Includes visual examples and links to source code.

## Related Issues
**GitHub Issues:** Closes #78, Related to #65

## Type of Change
- [ ] 🆕 New feature (non-breaking change that adds functionality)
- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to change)
- [x] 📝 Documentation update
- [ ] ♻️ Code refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] ✅ Test improvement
- [ ] 🔧 Configuration/build changes

## Motivation and Context

New contributors struggled to understand:
1. Which components exist and their purposes
2. How to use components correctly
3. Established patterns and conventions

This documentation serves as a reference guide and onboarding resource.

Related discussion: #65

## Implementation Details

### What Changed

Created comprehensive component documentation with:
- Categorized component list (Layout, Forms, Display, etc.)
- Props tables with types and defaults
- Usage examples with code snippets
- Visual examples (screenshots)
- Design patterns and best practices
- Links to source code

### Key Files Added/Modified

- `docs/COMPONENTS.md` - **NEW** - Complete component catalog (850 lines)
- `docs/README.md` - Updated with link to component catalog
- `README.md` - Added "Component Documentation" section
- `.github/assets/components/` - **NEW** - Screenshot directory for component examples

## Breaking Changes
**Does this introduce breaking changes?** ⚠️
- [ ] Yes - See details below
- [x] No - Fully backward compatible (documentation only)

## Testing

### Test Coverage
- [ ] Unit tests added/updated (not applicable - docs only)
- [ ] Integration tests added/updated (not applicable)
- [x] Manual testing completed (verified all links and code examples)
- [x] All existing tests pass

**Verification:**
- ✅ All internal links work
- ✅ All code examples compile
- ✅ All screenshots display correctly
- ✅ Markdown formatting renders properly on GitHub

### Test Scenarios Validated

1. **Link Validation:** All internal links point to existing files/sections - ✅ Pass
2. **Code Examples:** All code snippets are syntactically correct TypeScript/TSX - ✅ Pass
3. **Screenshots:** All images load and display at readable size - ✅ Pass
4. **Table Formatting:** All props tables render correctly in GitHub UI - ✅ Pass

### How to Test Manually

```bash
# Verify documentation renders correctly
# 1. View docs/COMPONENTS.md on GitHub
# 2. Click through all internal links
# 3. Copy/paste code examples into project to verify they work
```

## Visual Changes

New documentation includes 15+ screenshots of components. Examples:

| Component | Screenshot |
|-----------|------------|
| AddPromptForm | ![AddPromptForm](https://github.com/user/repo/blob/main/.github/assets/components/add-prompt-form.png) |
| PromptCard | ![PromptCard](https://github.com/user/repo/blob/main/.github/assets/components/prompt-card.png) |
| CategoryFilter | ![CategoryFilter](https://github.com/user/repo/blob/main/.github/assets/components/category-filter.png) |

## Performance Impact
- [x] No performance impact (documentation only)
- [ ] Performance improved
- [ ] Performance impact acceptable

## Security Considerations
- [x] No security implications (documentation only)
- [ ] Input validation implemented
- [ ] Output encoding implemented
- [ ] Authentication/authorization reviewed
- [ ] No sensitive data exposed
- [ ] Dependencies scanned for vulnerabilities

## Documentation
- [x] Code comments added (not applicable)
- [x] README.md updated (added link to COMPONENTS.md)
- [x] COMPONENTS.md created (new comprehensive guide)
- [x] CHANGELOG.md updated (added to [Unreleased] - Documentation section)

## Pre-Merge Checklist
- [x] Code follows project style guidelines (Markdown formatting)
- [x] Self-review completed
- [x] Code builds without errors (`npm run build`) - ✅ No code changes
- [x] All tests pass (`npm test`) - ✅ No test changes needed
- [ ] Lint checks pass (`npm run lint`) - ✅ Markdown not linted
- [x] No new warnings introduced
- [x] Branch is up-to-date with base branch
- [x] Commits are clean and well-described

## Deployment Notes

No deployment required - documentation only.

## Additional Context

**Documentation Structure:**
```
docs/
├── COMPONENTS.md         (NEW - this PR)
├── ARCHITECTURE.md       (existing)
├── TESTING.md           (existing)
├── REACT_19_MIGRATION.md (existing)
└── DESIGN_GUIDELINES.md  (existing)
```

**Future Work:**
- #79 - Add interactive component playground (Storybook)
- #80 - Document hooks in HOOKS.md
- #81 - Add video tutorials for complex components

---

**Reviewer Focus Areas:**
- Verify code examples are correct and follow project conventions
- Check that component descriptions are clear and accurate
- Ensure screenshots are high quality and representative
```

---

## Example 4: Refactoring (No Functional Changes)

**PR Title:** `refactor: Extract authentication logic into AuthService`

```markdown
## Summary

Refactors authentication-related code scattered across multiple components into a centralized `AuthService`. This improves code organization, testability, and maintainability without changing any functionality.

## Related Issues
**JIRA:** [CLAUDE-321](https://company.atlassian.net/browse/CLAUDE-321)
**GitHub Issues:** Related to #91

## Type of Change
- [ ] 🆕 New feature (non-breaking change that adds functionality)
- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to change)
- [ ] 📝 Documentation update
- [x] ♻️ Code refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] ✅ Test improvement
- [ ] 🔧 Configuration/build changes

## Motivation and Context

Authentication logic was duplicated across 5 components, making it:
1. Difficult to test in isolation
2. Hard to maintain (changes required in multiple places)
3. Prone to inconsistencies

This refactoring centralizes auth logic following the Single Responsibility Principle.

## Implementation Details

### What Changed

Extracted all authentication logic into a new `AuthService` class with methods for:
- `checkAuthStatus()` - Verify user authentication
- `refreshToken()` - Refresh expired auth tokens
- `logout()` - Clear authentication state

Updated 5 components to use the service instead of inline logic. **No behavior changes** - this is a pure refactoring.

### Key Files Modified

- `src/services/AuthService.ts` - **NEW** - Centralized authentication service
- `src/components/Header.tsx` - Refactored to use AuthService (removed 45 lines)
- `src/components/SettingsView.tsx` - Refactored to use AuthService (removed 38 lines)
- `src/components/ProfileMenu.tsx` - Refactored to use AuthService (removed 22 lines)
- `src/hooks/useAuth.ts` - Refactored to use AuthService (simplified logic)
- `src/background/background.ts` - Refactored to use AuthService (removed duplication)
- `tests/services/AuthService.test.ts` - **NEW** - Comprehensive unit tests

### Code Comparison

<details>
<summary>Before & After (click to expand)</summary>

**Before (in Header.tsx):**
```typescript
const Header = () => {
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    // Duplicated across 5 components
    chrome.storage.local.get(['authToken'], (result) => {
      if (result.authToken) {
        fetch('/api/verify', {
          headers: { Authorization: `Bearer ${result.authToken}` }
        })
        .then(res => res.ok ? setIsAuthed(true) : setIsAuthed(false))
        .catch(() => setIsAuthed(false));
      }
    });
  }, []);

  // ... rest of component
};
```

**After (in Header.tsx):**
```typescript
import { AuthService } from '@/services/AuthService';

const Header = () => {
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    AuthService.getInstance()
      .checkAuthStatus()
      .then(setIsAuthed)
      .catch(() => setIsAuthed(false));
  }, []);

  // ... rest of component
};
```

**New AuthService:**
```typescript
export class AuthService {
  private static instance: AuthService;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async checkAuthStatus(): Promise<boolean> {
    const { authToken } = await chrome.storage.local.get(['authToken']);
    if (!authToken) return false;

    try {
      const response = await fetch('/api/verify', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ... other methods
}
```

</details>

## Breaking Changes
**Does this introduce breaking changes?** ⚠️
- [ ] Yes - See details below
- [x] No - Fully backward compatible (internal refactoring only)

## Testing

### Test Coverage
- [x] Unit tests added/updated (`npm test`)
- [x] Integration tests added/updated
- [x] Manual testing completed
- [x] All existing tests pass

**Coverage:** Added 15 tests for AuthService (100% coverage of new service)

**Critical:** All existing E2E tests pass, proving no behavior changes.

### Test Scenarios Validated

1. **Auth Check - Valid Token:** Returns true for valid token - ✅ Pass
2. **Auth Check - Invalid Token:** Returns false for invalid token - ✅ Pass
3. **Auth Check - No Token:** Returns false when no token exists - ✅ Pass
4. **Token Refresh:** Successfully refreshes expired token - ✅ Pass
5. **Logout:** Clears all auth state correctly - ✅ Pass
6. **Regression:** All 5 refactored components behave identically to before - ✅ Pass

### How to Test Manually

```bash
npm run dev

# Test auth flow remains unchanged:
# 1. Open extension popup
# 2. Click "Settings" (should check auth)
# 3. Click "Profile" menu (should check auth)
# 4. Verify behavior identical to previous version
# 5. Test logout functionality
# 6. Test token refresh on expired token
```

**Regression Testing:**
```bash
# Run full E2E test suite to verify no behavior changes
npm run test:e2e
```

## Visual Changes

No visual changes - this is a pure code refactoring with no UI impact.

## Performance Impact
- [x] No performance impact
- [ ] Performance improved (describe below)
- [ ] Performance impact acceptable (explain below)

**Metrics:**
- Minimal performance change (auth logic is identical, just reorganized)
- Bundle size: +2.1 KB (new AuthService file), -3.8 KB (removed duplication) = **-1.7 KB total**
- No impact on auth check latency (same API calls)

## Security Considerations
- [x] No security implications (code moved, not changed)
- [ ] Input validation implemented
- [ ] Output encoding implemented
- [ ] Authentication/authorization reviewed
- [ ] No sensitive data exposed
- [ ] Dependencies scanned for vulnerabilities

**Security Notes:**
- Auth logic remains identical (no security changes)
- Token handling unchanged
- Centralized logic makes future security updates easier

## Documentation
- [x] Code comments added for complex logic
- [x] README.md updated (not needed)
- [x] ARCHITECTURE.md updated (added AuthService to service layer)
- [x] CHANGELOG.md updated (added to [Unreleased] - Refactor section)

## Pre-Merge Checklist
- [x] Code follows project style guidelines
- [x] Self-review completed
- [x] Code builds without errors (`npm run build`)
- [x] All tests pass (`npm test`)
- [x] Lint checks pass (`npm run lint`)
- [x] No new warnings introduced
- [x] Branch is up-to-date with base branch
- [x] Commits are clean and well-described

## Deployment Notes

**Low Risk:** Pure refactoring with no functional changes. All existing tests pass.

**Rollback Plan:** Simply revert the commit if any issues arise (unlikely given test coverage).

## Additional Context

**Refactoring Metrics:**
- Code duplication: 158 lines → 0 lines (100% elimination)
- Files touched: 5 components, 1 hook, 1 background script
- Lines added: 124 (new service + tests)
- Lines removed: 167 (duplicated code)
- Net change: -43 lines

**Future Work:**
- #92 - Refactor storage logic into StorageService (similar pattern)
- #93 - Extract prompt validation logic

**Design Pattern:**
- Singleton pattern for AuthService (same as StorageManager)
- Follows existing service architecture conventions

---

**Reviewer Focus Areas:**
- Verify behavior is unchanged (check test coverage)
- Review AuthService implementation for correctness
- Confirm no breaking changes in component interfaces
```

---

## Key Differences Between Examples

| Aspect | Feature | Bug Fix | Documentation | Refactoring |
|--------|---------|---------|---------------|-------------|
| **Complexity** | High | Medium | Low | Medium |
| **Testing** | Extensive (new functionality) | Focused (bug scenario) | Link validation | Regression (no changes) |
| **Screenshots** | Optional (if UI) | **Required** (visual bug) | **Required** (examples) | Not needed |
| **Breaking Changes** | Assess carefully | Usually No | No | No |
| **Documentation** | All docs updated | Changelog only | New docs created | Architecture updated |
| **Reviewer Focus** | API design, test coverage | Before/after visuals | Accuracy, clarity | No behavior changes |

---

## Template Usage Tips

### When Filling Out Your Own PR

1. **Start with the easy sections:** Type of Change, Related Issues, Checklist
2. **Write Summary last:** After you know exactly what changed
3. **Delete irrelevant sections:** If no visual changes, delete that section entirely
4. **Be specific in Testing:** "Tested manually" is not enough - list specific scenarios
5. **Use collapsible sections:** For long code examples, use `<details>` tags
6. **Add context:** Link to design docs, related PRs, or discussions

### Red Flags (What NOT to Do)

❌ **Bad:**
```markdown
## Summary
Updated some files

## Testing
Tested it, works fine
```

✅ **Good:**
```markdown
## Summary
Refactored StorageManager to use async/await instead of callbacks, improving code readability and error handling. No functional changes.

## Testing
- [x] All 45 existing StorageManager tests pass
- [x] Manual testing: Import/export functionality works
- [x] Verified no performance regression (benchmark: 42ms → 41ms)
```

---

## Checklist for PR Authors

Before submitting your PR, verify:

- [ ] Template sections filled out completely (or deleted if not applicable)
- [ ] All checkboxes checked (or explicitly marked as N/A)
- [ ] Screenshots/GIFs included for UI changes
- [ ] Issue links are correct and clickable
- [ ] Code examples compile and run
- [ ] Test scenarios are specific and verifiable
- [ ] Removed all template instructional comments
- [ ] `npm test` passes (MANDATORY)
- [ ] `npm run lint` passes (MANDATORY)
- [ ] PR title follows conventional commits format

---

## Need More Examples?

- **Real-world PR:** See closed PRs in this repository for production examples
- **Template guide:** See `PR_TEMPLATE_BEST_PRACTICES.md` for comprehensive research
- **Quick reference:** See `PR_TEMPLATE_QUICK_REFERENCE.md` for tips and tricks
