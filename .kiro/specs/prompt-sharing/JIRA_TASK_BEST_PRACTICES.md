# Jira Tasks and Sub-tasks: Comprehensive Best Practices Guide

## Table of Contents
1. [Tasks vs Sub-tasks](#tasks-vs-sub-tasks)
2. [Task Writing Guidelines](#task-writing-guidelines)
3. [Task Types and Patterns](#task-types-and-patterns)
4. [Task Fields and Metadata](#task-fields-and-metadata)
5. [Task Organization](#task-organization)
6. [Task Completion Criteria](#task-completion-criteria)
7. [Decomposition Strategies](#decomposition-strategies)
8. [Practical Examples](#practical-examples)
9. [Common Pitfalls](#common-pitfalls)

---

## Tasks vs Sub-tasks

### Understanding the Hierarchy

**Jira Issue Type Hierarchy:**
```
Level 1:  Epic (optional)
Level 0:  Story, Task, Bug (standard issue types)
Level -1: Sub-task (optional)
```

### Key Differences

| Aspect | Task | Sub-task |
|--------|------|----------|
| **Independence** | Can exist independently | Must have a parent (Story, Task, or Bug) |
| **Scope** | Complete unit of work | Component of a larger work item |
| **Estimation** | Can use story points or hours | Typically estimated in hours |
| **Board Display** | Shows on board by default | Can clutter board if overused |
| **Completion** | Independent completion | Parent requires all sub-tasks completed |
| **Project** | Can be in any project | Must be in same project as parent |

### When to Use Tasks vs Sub-tasks

**Use Tasks when:**
- Work is independently completable
- Multiple discrete jobs that can be individually finished
- Each piece deserves its own tracking and reporting
- Work doesn't logically belong under a specific Story

**Use Sub-tasks when:**
- Breaking down a Story/Task into implementation steps
- Splitting work between different team members
- Following layered architecture (UI, business logic, database)
- Need to track sub-components of larger work

**Use Simple Checklists instead when:**
- Steps are simple verification items
- Don't need separate time tracking
- Don't need individual assignment
- Steps are sequential prerequisites

### Best Practice Guidelines

**Avoid Over-using Sub-tasks:**
- Many sub-tasks clutter your board
- Complicates time tracking and reporting
- Parent task can't be closed until all sub-tasks are done
- Ignored/obsolete sub-tasks still affect reporting

**Right-size Your Work:**
- If Epic has too many Stories → Split into multiple Epics
- If Story has too many Sub-tasks → Split into multiple Stories
- If Task has too many Sub-tasks → Split into multiple Tasks

---

## Task Writing Guidelines

### Task Titles

**Best Practices:**
- Clear, immediate understanding of what needs to be done
- Specific action verb + object + context (when needed)
- Concise but not cryptic (avoid abbreviations)
- Technical enough for developers, clear enough for team

**Good Examples:**
```
✅ Create PromptEncoder service with Base64 encoding
✅ Add share button to PromptCard component
✅ Implement URL parameter parsing in import flow
✅ Write unit tests for PromptEncoder service
✅ Update README with prompt sharing documentation
```

**Bad Examples:**
```
❌ Coding (too vague)
❌ Implementation (no specifics)
❌ Add checkbox (too small/granular)
❌ Fix the thing (unclear)
❌ Update stuff for new feature (imprecise)
```

### Task Descriptions

**Keep Them Concise:**
- 2-3 sentences is ideal
- Avoid long paragraphs where details get lost
- Use bullet points for clarity
- Link to detailed specs/docs if needed

**Essential Elements:**
1. **What**: Specific deliverable or change
2. **Why**: Context or business reason (brief)
3. **Where**: File/component location
4. **Acceptance**: How to verify completion

**Template:**
```markdown
## Description
[1-2 sentence overview of the task]

## Implementation Details
- Specific change 1
- Specific change 2
- Technical consideration

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Tests pass

## Related
- Link to design doc
- Link to parent story
```

**Example:**
```markdown
## Description
Create a new PromptEncoder service to handle encoding/decoding
of prompt data for URL sharing. Service should support Base64
encoding with URL-safe characters.

## Implementation Details
- Create `src/services/promptEncoder.ts`
- Implement `encode()` and `decode()` methods
- Handle special characters in prompt content
- Add compression for large prompts (>500 chars)

## Acceptance Criteria
- [ ] Encodes prompt objects to URL-safe strings
- [ ] Decodes strings back to valid prompt objects
- [ ] Handles edge cases (empty, special chars)
- [ ] Unit tests achieve 100% coverage

## Related
- Design doc: .kiro/specs/prompt-sharing/design.md
```

### Task Granularity

**The One-Day Rule:**
- A task should be completable in less than one day
- Not so small it's trivial (e.g., "add checkbox")
- Not so large it's ambiguous (e.g., "implement feature")

**Breaking Down Large Tasks:**

**Too Large:**
```
❌ Implement prompt sharing feature
```

**Right-sized:**
```
✅ Create PromptEncoder service
✅ Add share button to UI
✅ Implement import URL parsing
✅ Add error handling for invalid URLs
✅ Write integration tests
```

---

## Task Types and Patterns

### 1. Development Tasks

**Frontend Development:**
```
Title: Add share button to PromptCard component

Description:
Add a share icon button to the PromptCard action menu that
generates and copies a shareable URL to clipboard.

Implementation:
- Add Share icon to action menu in PromptCard.tsx
- Create handleShare() function using PromptEncoder
- Show toast notification on copy success
- Add aria-label for accessibility

Acceptance:
- [ ] Share button appears in action menu
- [ ] Clicking copies URL to clipboard
- [ ] Toast shows "Link copied!" message
- [ ] Button has proper accessibility attributes
```

**Backend/Service Development:**
```
Title: Create PromptEncoder service with compression

Description:
Implement service to encode/decode prompt data with LZ-string
compression for URLs longer than 500 characters.

Implementation:
- Create src/services/promptEncoder.ts
- Implement encode(prompt): string method
- Implement decode(encoded): Prompt method
- Add LZ-string compression for large data
- Add error handling for invalid input

Acceptance:
- [ ] Encodes/decodes prompt objects correctly
- [ ] Compresses payloads >500 chars
- [ ] Throws descriptive errors on invalid input
- [ ] All edge cases handled (null, empty, special chars)
```

**Architecture/Refactoring:**
```
Title: Refactor StorageManager to use async/await pattern

Description:
Replace Promise-based callbacks with async/await throughout
StorageManager for improved readability and error handling.

Implementation:
- Convert all public methods to async functions
- Update error handling to use try/catch
- Maintain backward compatibility
- Update method documentation

Acceptance:
- [ ] All methods use async/await
- [ ] Error handling is consistent
- [ ] No breaking changes to API
- [ ] Existing tests still pass
```

### 2. Testing Tasks

**Unit Testing:**
```
Title: Write unit tests for PromptEncoder service

Description:
Achieve 100% test coverage for PromptEncoder with edge case
handling and error scenarios.

Test Cases:
- Valid prompt encoding/decoding
- Special characters handling
- Empty/null input handling
- Large payloads (>1000 chars)
- Invalid encoded string decoding
- Compression threshold behavior

Acceptance:
- [ ] 100% line coverage
- [ ] 100% branch coverage
- [ ] All edge cases tested
- [ ] Tests run in <100ms
```

**Integration Testing:**
```
Title: Add integration tests for prompt sharing flow

Description:
Test complete sharing flow from UI button click through URL
generation and import.

Test Scenarios:
- Share button generates valid URL
- Import URL creates correct prompt
- Invalid URL shows error message
- Large prompts are compressed
- Error handling works end-to-end

Acceptance:
- [ ] All happy path scenarios pass
- [ ] Error cases properly handled
- [ ] Tests are deterministic
- [ ] Tests run in <500ms
```

**Manual Testing:**
```
Title: Manual testing of prompt sharing on supported sites

Description:
Verify prompt sharing works correctly across all supported
AI platforms (Claude, ChatGPT, Perplexity).

Test Matrix:
| Platform | Share | Import | Error Handling |
|----------|-------|--------|----------------|
| Claude   | [ ]   | [ ]    | [ ]            |
| ChatGPT  | [ ]   | [ ]    | [ ]            |
| Perplexity| [ ]  | [ ]    | [ ]            |

Acceptance:
- [ ] All platforms tested and working
- [ ] Screenshots attached for each
- [ ] Bugs filed for any issues found
```

### 3. Documentation Tasks

**Technical Documentation:**
```
Title: Document PromptEncoder API in services guide

Description:
Add comprehensive API documentation for PromptEncoder service
to docs/SERVICES_AND_HOOKS.md.

Content:
- Service overview and purpose
- API methods with signatures
- Usage examples (encode/decode)
- Error handling patterns
- Performance considerations

Acceptance:
- [ ] All public methods documented
- [ ] Code examples are runnable
- [ ] Error scenarios explained
- [ ] Links to related services added
```

**User Documentation:**
```
Title: Add prompt sharing guide to README

Description:
Create user-facing documentation explaining how to share and
import prompts via URL.

Content:
- Feature overview (2-3 sentences)
- How to share a prompt (with screenshot)
- How to import a prompt (with screenshot)
- Limitations and considerations
- Privacy notes about URL sharing

Acceptance:
- [ ] Clear step-by-step instructions
- [ ] Screenshots embedded
- [ ] FAQ section added
- [ ] Reviewed by product owner
```

**API Documentation:**
```
Title: Generate JSDoc comments for PromptEncoder

Description:
Add comprehensive JSDoc comments to all public methods and
interfaces in promptEncoder.ts.

Requirements:
- Method descriptions
- @param tags with types
- @returns with types
- @throws for error cases
- @example with code samples

Acceptance:
- [ ] All public APIs documented
- [ ] Examples are tested/working
- [ ] Types are accurate
- [ ] ESLint JSDoc rules pass
```

### 4. Code Review Tasks

**Pre-merge Review:**
```
Title: Code review: Prompt sharing feature implementation

Description:
Review PR #123 implementing prompt sharing functionality.

Review Checklist:
- [ ] Code follows project style guide
- [ ] All functions have proper error handling
- [ ] Tests achieve >90% coverage
- [ ] No console.log() statements (use Logger)
- [ ] Dark mode styles included
- [ ] Accessibility attributes present
- [ ] Performance considerations addressed
- [ ] Documentation updated

Acceptance:
- [ ] All checklist items verified
- [ ] Comments added for issues found
- [ ] PR approved or changes requested
```

### 5. DevOps/Deployment Tasks

**Build Configuration:**
```
Title: Update build script to minify shared URLs

Description:
Modify Vite build config to optimize PromptEncoder bundle size
for minimal URL payload.

Implementation:
- Enable terser minification for promptEncoder
- Configure tree-shaking for unused compression
- Verify bundle size reduction
- Update build documentation

Acceptance:
- [ ] Bundle size reduced by >20%
- [ ] Build still completes successfully
- [ ] All tests pass with minified code
- [ ] Source maps generated correctly
```

**Release Task:**
```
Title: Deploy v2.5.0 with prompt sharing to Chrome Web Store

Description:
Package and deploy new version with prompt sharing feature.

Deployment Steps:
- [ ] Update version in manifest.json (2.5.0)
- [ ] Run `npm run build`
- [ ] Run `npm run package`
- [ ] Test packaged extension in clean Chrome profile
- [ ] Upload to Chrome Web Store
- [ ] Update release notes
- [ ] Tag release in Git (v2.5.0)

Acceptance:
- [ ] Extension uploaded successfully
- [ ] Review submission accepted
- [ ] Release notes published
- [ ] Git tag created
```

---

## Task Fields and Metadata

### Essential Fields

**1. Summary (Title)**
- Action-oriented, specific, concise
- See "Task Titles" section above

**2. Description**
- What, why, where, how to verify
- See "Task Descriptions" section above

**3. Issue Type**
- Task: Standard development work
- Sub-task: Component of parent issue
- Bug: Defect fixes
- Technical Task: Architecture/infrastructure

**4. Assignee**
- Single person responsible
- Assign during sprint planning
- Can be changed if priorities shift
- Leave unassigned for backlog items

**5. Priority**
- **Highest**: Blockers, critical bugs
- **High**: Sprint commitments, dependencies
- **Medium**: Normal sprint work
- **Low**: Nice-to-have, technical debt
- **Lowest**: Future considerations

**6. Story Points / Time Estimate**
- **Story Points**: For Stories (relative complexity)
- **Hours**: For Tasks/Sub-tasks (actual time)
- **Guideline**: Tasks = 1-8 hours, Stories = 1-13 points

**7. Sprint**
- Assigned during sprint planning
- Only for committed work
- Move to backlog if not completed

**8. Labels**
- `frontend`, `backend`, `testing`, `documentation`
- `bug`, `enhancement`, `refactor`
- `high-priority`, `technical-debt`
- Feature-specific: `prompt-sharing`, `analytics`

**9. Components**
- UI, Services, Content Scripts, Background
- Used for filtering and reporting

**10. Due Date**
- Use sparingly (creates pressure)
- Reserve for actual deadlines
- Better to rely on sprint cadence

### Optional But Useful Fields

**Epic Link**
- Connect tasks to larger initiatives
- Enables epic-level reporting

**Linked Issues**
- **Blocks/Blocked by**: Dependencies
- **Relates to**: Related work
- **Duplicates**: Duplicate tracking

**Original Estimate / Time Tracking**
- Log work as it's completed
- Compare actual vs. estimate
- Improve future estimation

**Acceptance Criteria (custom field)**
- Checklist of completion requirements
- Validated during review
- Prevents "done" ambiguity

---

## Task Organization

### Logical Grouping

**Group by Technical Layer:**
```
Story: User can share prompts via URL

Tasks:
├── Services Layer
│   ├── Create PromptEncoder service
│   └── Add compression utility functions
├── UI Layer
│   ├── Add share button to PromptCard
│   └── Add import button to PromptLibrary
├── Integration Layer
│   ├── Wire up share functionality
│   └── Implement import URL parsing
└── Quality Layer
    ├── Write unit tests
    ├── Write integration tests
    └── Manual testing across platforms
```

**Group by Workflow Phase:**
```
Story: User can share prompts via URL

Tasks (in order):
1. Design & Planning
   └── Finalize URL encoding scheme
2. Core Implementation
   ├── Create PromptEncoder service
   └── Add compression logic
3. UI Implementation
   ├── Add share button
   └── Add import button
4. Integration
   └── Wire up components
5. Testing
   ├── Unit tests
   └── Integration tests
6. Documentation
   └── Update user guide
7. Release
   └── Deploy to production
```

**Group by Team Member:**
```
Story: User can share prompts via URL

Alice (Frontend):
├── Add share button to PromptCard
└── Add import button to PromptLibrary

Bob (Services):
├── Create PromptEncoder service
└── Add compression utility

Charlie (QA):
├── Write integration tests
└── Manual testing

Diana (Tech Writer):
└── Update documentation
```

### Task Dependencies

**Using Jira Links:**
```
Task: Add share button to PromptCard
├── Blocks: Write integration tests for sharing
└── Blocked by: Create PromptEncoder service

Task: Create PromptEncoder service
├── Blocks: Add share button to PromptCard
└── Blocks: Implement import URL parsing
```

**Ordering Tasks:**
- Order sub-tasks by dependency sequence
- Put blocking tasks higher in backlog
- Consider parallel work opportunities

### Sprint Planning with Tasks

**Capacity Planning:**
```
Sprint Capacity: 80 hours (4 developers × 20 hours each)

Story Breakdown:
Story A (13 points) → 6 tasks → 32 hours
Story B (8 points)  → 4 tasks → 24 hours
Story C (5 points)  → 3 tasks → 16 hours
Bug fixes           → 2 tasks → 8 hours
──────────────────────────────────────
Total: 26 points, 13 tasks, 80 hours ✓
```

**Two-Level Estimation:**
- Estimate Stories in points (complexity)
- Estimate Tasks in hours (actual time)
- Use velocity to plan sprints
- Use hours to track daily progress

### Task Workflow States

**Common Task Workflow:**
```
To Do → In Progress → In Review → Done
```

**Extended Workflow (with testing):**
```
To Do → In Progress → Code Review → In Testing → Done
```

**Task State Transitions:**

**To Do:**
- Backlog items
- Not yet started
- May have preliminary estimates

**In Progress:**
- Currently being worked on
- Should have assignee
- Should have time logging

**In Review:**
- Code complete, awaiting review
- PR/MR created and linked
- Blockers identified

**In Testing:**
- Code reviewed and merged
- Awaiting QA verification
- Test cases executed

**Done:**
- All acceptance criteria met
- Code merged to main
- Tests passing
- Documentation updated

---

## Task Completion Criteria

### Definition of Done (DoD)

**What is DoD?**
A clear and concise list of requirements that software must adhere to for the team to call it complete. Applies to ALL items in the backlog.

**Task-Level DoD Checklist:**
```markdown
## Definition of Done (applies to all tasks)

### Code Quality
- [ ] Code follows project style guide
- [ ] ESLint passes with no warnings
- [ ] TypeScript strict mode compliance
- [ ] No console.* statements (use Logger)
- [ ] Functions have proper error handling

### Testing
- [ ] Unit tests written (>90% coverage)
- [ ] All tests passing
- [ ] Integration tests added (if applicable)
- [ ] Manual testing completed

### Code Review
- [ ] PR created and linked to task
- [ ] Code reviewed by peer
- [ ] Review comments addressed
- [ ] PR approved and merged

### Documentation
- [ ] JSDoc comments added to public APIs
- [ ] README updated (if user-facing)
- [ ] Technical docs updated (if applicable)

### Accessibility & Design
- [ ] Dark mode styles included
- [ ] Accessibility attributes present (ARIA)
- [ ] Focus states working
- [ ] Keyboard navigation supported

### Quality & Security
- [ ] No security vulnerabilities introduced
- [ ] Performance considered (no regressions)
- [ ] Error scenarios handled gracefully
- [ ] Logging added for debugging

### Integration
- [ ] Code merged to main branch
- [ ] Build passes in CI/CD
- [ ] No breaking changes (or documented)
```

### Task-Specific Acceptance Criteria

**Frontend Task:**
```markdown
## Acceptance Criteria

Functionality:
- [ ] Share button appears in PromptCard action menu
- [ ] Clicking button copies URL to clipboard
- [ ] Toast notification shows success message

Visual Design:
- [ ] Button uses share icon (lucide-react)
- [ ] Follows design system (purple-indigo gradient)
- [ ] Hover state shows proper transition
- [ ] Dark mode styling included

Accessibility:
- [ ] Button has aria-label="Share prompt"
- [ ] Keyboard accessible (Tab + Enter)
- [ ] Focus state visible
- [ ] Screen reader announcement works

Error Handling:
- [ ] Handles clipboard permission denied
- [ ] Shows error toast if encoding fails
- [ ] Button disabled during operation
```

**Service/Backend Task:**
```markdown
## Acceptance Criteria

Functionality:
- [ ] encode() converts Prompt object to URL-safe string
- [ ] decode() converts string back to valid Prompt object
- [ ] Compression applies for payloads >500 characters
- [ ] Handles special characters correctly

Error Handling:
- [ ] Throws EncodeError for invalid input
- [ ] Throws DecodeError for corrupted strings
- [ ] Error messages are descriptive
- [ ] All error paths tested

Testing:
- [ ] 100% line coverage
- [ ] 100% branch coverage
- [ ] Edge cases tested (null, empty, special chars)
- [ ] Performance tested (large prompts)

Documentation:
- [ ] JSDoc comments on all public methods
- [ ] Usage examples in docs/SERVICES_AND_HOOKS.md
- [ ] Error scenarios documented
```

**Testing Task:**
```markdown
## Acceptance Criteria

Test Coverage:
- [ ] All happy path scenarios covered
- [ ] All error scenarios covered
- [ ] Edge cases tested (boundary conditions)
- [ ] Integration points tested

Test Quality:
- [ ] Tests are deterministic (no flaky tests)
- [ ] Tests run fast (<500ms for integration)
- [ ] Mocks used appropriately
- [ ] Test names clearly describe scenarios

Code Coverage:
- [ ] Line coverage >90%
- [ ] Branch coverage >90%
- [ ] Function coverage 100%
- [ ] Coverage report generated

Documentation:
- [ ] Test plan documented (if complex)
- [ ] Known limitations noted
```

**Documentation Task:**
```markdown
## Acceptance Criteria

Content:
- [ ] Overview explains purpose clearly
- [ ] Step-by-step instructions included
- [ ] Code examples are runnable
- [ ] Screenshots embedded (if UI feature)

Quality:
- [ ] Grammar and spelling checked
- [ ] Technical accuracy verified
- [ ] Links work correctly
- [ ] Formatting consistent with existing docs

Completeness:
- [ ] All public APIs documented
- [ ] Error scenarios explained
- [ ] Prerequisites listed
- [ ] Related docs cross-linked

Review:
- [ ] Reviewed by product owner (user docs)
- [ ] Reviewed by tech lead (technical docs)
- [ ] Incorporated feedback
```

### Verification Steps

**Pre-completion Checklist:**
1. Re-read task description and requirements
2. Verify each acceptance criterion
3. Run full test suite locally
4. Check linting and type checking
5. Test manually in development environment
6. Review code changes one more time
7. Update task with completion notes
8. Link PR and any related issues

**Before Moving to "Done":**
- All acceptance criteria checked off
- Definition of Done checklist complete
- Code merged to main branch
- Tests passing in CI/CD
- Documentation updated
- No outstanding review comments

---

## Decomposition Strategies

### The INVEST Principle for Tasks

While INVEST typically applies to Stories, adapted for Tasks:

- **Independent**: Can be completed without dependencies (when possible)
- **Negotiable**: Implementation details can be discussed
- **Valuable**: Delivers tangible progress toward Story
- **Estimable**: Small enough to estimate confidently
- **Small**: Completable in less than one day
- **Testable**: Clear verification criteria

### Decomposition by Technical Layer

**Original Story:**
```
Story: User can share prompts via URL
```

**Decomposed Tasks:**
```
Data Layer:
└── Create PromptEncoder service with Base64 encoding

Service Layer:
├── Add compression for large prompts
└── Add error handling for invalid data

UI Layer:
├── Add share button to PromptCard component
├── Add import button to header
└── Create SharePromptModal component

Integration Layer:
├── Wire up share button to PromptEncoder
├── Implement URL parameter parsing on load
└── Add clipboard copy functionality

Testing Layer:
├── Write unit tests for PromptEncoder
├── Write integration tests for sharing flow
└── Manual testing across AI platforms

Documentation Layer:
├── Update README with sharing instructions
└── Document PromptEncoder API in services guide
```

### Decomposition by Workflow Phase

**Phase 1: Foundation**
```
Tasks:
├── Design URL encoding scheme
├── Create PromptEncoder service
└── Add compression utility
```

**Phase 2: Core Features**
```
Tasks:
├── Add share button to UI
├── Implement clipboard copy
├── Add import URL parsing
└── Create error handling
```

**Phase 3: Polish**
```
Tasks:
├── Add loading states
├── Add success/error toasts
└── Add keyboard shortcuts
```

**Phase 4: Quality Assurance**
```
Tasks:
├── Write unit tests
├── Write integration tests
├── Manual testing
└── Bug fixes
```

**Phase 5: Documentation & Release**
```
Tasks:
├── Update user documentation
├── Update technical documentation
└── Deploy to production
```

### Decomposition by User Journey

**User Story:** User can share prompts via URL

**User Journey Tasks:**
```
1. User discovers feature
   └── Add share button to PromptCard action menu

2. User clicks share
   ├── Generate shareable URL with PromptEncoder
   ├── Copy URL to clipboard
   └── Show success notification

3. User shares URL
   (No task - external to system)

4. Recipient clicks URL
   └── Parse URL parameters on app load

5. Recipient sees import prompt
   ├── Show import confirmation modal
   └── Display prompt details

6. Recipient confirms import
   ├── Decode prompt from URL
   ├── Add prompt to library
   └── Show success message

7. Edge cases
   ├── Handle invalid URLs
   ├── Handle clipboard permissions
   └── Handle large prompt compression
```

### Acceptance Criteria Driven Decomposition

**User Story Acceptance Criteria:**
```
Story: User can share prompts via URL

Acceptance Criteria:
1. User can generate shareable URL for any prompt
2. URL is copied to clipboard automatically
3. Opening URL pre-fills import form
4. Invalid URLs show helpful error message
5. Large prompts are compressed
```

**Tasks Derived from Criteria:**
```
AC #1: User can generate shareable URL
├── Create PromptEncoder.encode() method
└── Add share button that calls encode()

AC #2: URL is copied to clipboard
├── Implement clipboard API integration
└── Add permission handling

AC #3: Opening URL pre-fills import form
├── Parse URL parameters on load
├── Call PromptEncoder.decode()
└── Populate import form

AC #4: Invalid URLs show error message
├── Add validation in decode()
├── Create error toast component
└── Handle edge cases

AC #5: Large prompts are compressed
├── Add LZ-string compression
└── Test with 1000+ character prompts
```

### Task Size Guidelines

**Too Large (Split Further):**
```
❌ Implement prompt sharing feature (>5 days)
❌ Add all sharing UI components (>2 days)
❌ Write all tests for sharing (>1 day)
```

**Just Right (1 day or less):**
```
✅ Create PromptEncoder service (4-6 hours)
✅ Add share button to PromptCard (2-3 hours)
✅ Write unit tests for PromptEncoder (3-4 hours)
✅ Update README with sharing guide (2-3 hours)
```

**Too Small (Combine or Use Checklist):**
```
❌ Add share icon (15 minutes)
❌ Import lucide-react icon (5 minutes)
❌ Add single test case (10 minutes)
```

---

## Practical Examples

### Example 1: Prompt Sharing Feature Decomposition

**Epic:**
```
Epic: Prompt Sharing and Collaboration
```

**User Stories:**
```
Story 1: User can share prompts via URL
Story 2: User can import prompts from shared URLs
Story 3: User can preview prompt before importing
```

**Story 1 Task Breakdown:**
```
Story: User can share prompts via URL (13 points)

Sub-tasks:
1. Create PromptEncoder service with Base64 encoding (5h)
   - Implement encode() method
   - Implement decode() method
   - Add unit tests
   - Document API

2. Add compression for large prompts (3h)
   - Integrate LZ-string library
   - Add compression threshold (500 chars)
   - Update tests

3. Add share button to PromptCard component (4h)
   - Add Share icon button
   - Implement handleShare()
   - Add clipboard integration
   - Add loading and error states

4. Add success/error notifications (2h)
   - Create toast for copy success
   - Create toast for copy failure
   - Handle clipboard permissions

5. Write integration tests for share flow (4h)
   - Test share button click
   - Test URL generation
   - Test clipboard copy
   - Test error scenarios

6. Update user documentation (2h)
   - Add "Sharing Prompts" section to README
   - Include screenshots
   - Document limitations

Total: 20 hours (reasonable for 1 sprint)
```

### Example 2: Adding Analytics Feature

**Story:**
```
Story: Track prompt usage analytics
```

**Task Breakdown:**
```
1. Design analytics data structure (2h)
   - Define events to track
   - Design storage schema
   - Document privacy considerations

2. Create AnalyticsService (4h)
   - Implement event tracking methods
   - Add local storage persistence
   - Add privacy controls

3. Add tracking to prompt actions (3h)
   - Track prompt usage
   - Track prompt creation
   - Track prompt editing
   - Track prompt deletion

4. Create analytics dashboard component (6h)
   - Design dashboard layout
   - Create visualization components
   - Add date range filters
   - Add export functionality

5. Add privacy settings (2h)
   - Add analytics toggle to settings
   - Implement opt-out logic
   - Show privacy notice

6. Write tests (4h)
   - Unit tests for AnalyticsService
   - Integration tests for tracking
   - UI tests for dashboard

7. Documentation (2h)
   - Document analytics events
   - Update privacy policy
   - Add dashboard guide

Total: 23 hours
```

### Example 3: Bug Fix Task

**Bug:**
```
Bug: PromptCard title truncates incorrectly in resizable sidebar

Priority: High
Severity: Medium
```

**Task Breakdown:**
```
1. Investigate root cause (1h)
   - Reproduce in different sidebar widths
   - Check CSS styles
   - Review responsive breakpoints
   - Document findings

2. Implement fix (2h)
   - Update CSS for proper truncation
   - Add responsive font sizing
   - Test at various widths
   - Verify dark mode

3. Add regression tests (2h)
   - Add visual regression test
   - Test responsive behavior
   - Test in both themes

4. Update design guidelines (1h)
   - Document proper truncation pattern
   - Add to component guidelines

Total: 6 hours
```

### Example 4: Technical Debt Task

**Technical Debt:**
```
Story: Refactor StorageManager to use async/await
```

**Task Breakdown:**
```
1. Audit current Promise-based code (2h)
   - Identify all callback patterns
   - Map dependencies
   - Plan migration approach

2. Convert core methods to async/await (6h)
   - Update getPrompts()
   - Update savePrompt()
   - Update deletePrompt()
   - Update error handling

3. Update tests (4h)
   - Convert test assertions
   - Add async/await to test cases
   - Verify all tests pass

4. Update documentation (2h)
   - Update API docs
   - Update code examples
   - Add migration guide

5. Update dependent code (4h)
   - Update React hooks
   - Update content scripts
   - Verify no breaking changes

Total: 18 hours
```

### Example 5: Documentation Task

**Documentation Story:**
```
Story: Create comprehensive developer onboarding guide
```

**Task Breakdown:**
```
1. Create ARCHITECTURE.md (8h)
   - Document system design
   - Create architecture diagrams
   - Explain design patterns
   - Document data flow

2. Create COMPONENTS.md (6h)
   - Catalog all React components
   - Add usage examples
   - Document props and patterns

3. Create SERVICES_AND_HOOKS.md (6h)
   - Document all services
   - Document custom hooks
   - Add code examples

4. Create PLATFORM_INTEGRATION.md (4h)
   - Explain platform detection
   - Document strategy pattern
   - Guide for adding new platforms

5. Create TESTING.md (4h)
   - Document testing strategy
   - Add testing examples
   - Document test utilities

6. Update README (2h)
   - Reorganize structure
   - Add links to new docs
   - Update getting started guide

Total: 30 hours (split across multiple sprints)
```

---

## Common Pitfalls

### 1. Task Granularity Issues

**Pitfall: Tasks Too Large**
```
❌ Implement prompt sharing feature
```
**Impact:** Unclear progress, difficult to estimate, hard to test

**Solution:** Break down by layer/component
```
✅ Create PromptEncoder service
✅ Add share button to UI
✅ Implement URL parsing
```

**Pitfall: Tasks Too Small**
```
❌ Add share icon
❌ Import library
❌ Add single test case
```
**Impact:** Administrative overhead, cluttered board, tracking waste

**Solution:** Combine into meaningful units or use checklists
```
✅ Add share button with icon and styling (includes icon import)
✅ Write unit tests for PromptEncoder (includes all test cases)
```

### 2. Vague Task Descriptions

**Pitfall: Unclear Requirements**
```
❌ Title: Update UI
   Description: Make changes to the interface
```

**Solution: Be Specific**
```
✅ Title: Add share button to PromptCard component
   Description: Add a share icon button to the action menu
   that generates and copies a shareable URL to clipboard.

   Acceptance:
   - Share button appears in action menu
   - Clicking copies URL to clipboard
   - Toast shows success message
```

### 3. Missing Acceptance Criteria

**Pitfall: No Clear Definition of Done**
```
❌ Task: Add share button
   Description: Add button for sharing
   (No acceptance criteria)
```

**Solution: Always Include Acceptance Criteria**
```
✅ Task: Add share button to PromptCard

   Acceptance Criteria:
   - [ ] Share button appears in action menu
   - [ ] Button uses correct icon and styling
   - [ ] Clicking generates and copies URL
   - [ ] Toast notification shows on success
   - [ ] Error handling for clipboard permission
   - [ ] Dark mode styling included
   - [ ] Accessibility attributes present
```

### 4. Overusing Sub-tasks

**Pitfall: Too Many Sub-tasks**
```
❌ Story: Add prompt sharing
    ├── Design share button (Sub-task)
    ├── Add share icon (Sub-task)
    ├── Style share button (Sub-task)
    ├── Add hover effect (Sub-task)
    ├── Add click handler (Sub-task)
    ├── Add clipboard copy (Sub-task)
    ├── Handle errors (Sub-task)
    ├── Add toast (Sub-task)
    ├── Style toast (Sub-task)
    └── Add tests (Sub-task)
```
**Impact:** Board clutter, tracking overhead, difficult reporting

**Solution: Right-size Tasks**
```
✅ Story: Add prompt sharing
    ├── Create PromptEncoder service (includes tests)
    ├── Add share button to PromptCard (includes styling, errors)
    ├── Add clipboard integration (includes permissions)
    └── Write integration tests
```

### 5. Missing Dependencies

**Pitfall: No Dependency Links**
```
❌ Task A: Add share button (depends on PromptEncoder)
   Task B: Create PromptEncoder
   (No link between tasks)
```
**Impact:** Tasks started in wrong order, blockers not visible

**Solution: Link Dependencies**
```
✅ Task A: Add share button
   Blocked by: Task B (Create PromptEncoder)

   Task B: Create PromptEncoder
   Blocks: Task A (Add share button)
```

### 6. Inconsistent Estimation

**Pitfall: Mixing Story Points and Hours**
```
❌ Story: 8 points
   ├── Task A: 3 points
   ├── Task B: 5 points
   └── Task C: 2 points
```
**Impact:** Confused metrics, poor capacity planning

**Solution: Stories in Points, Tasks in Hours**
```
✅ Story: 8 points
   ├── Task A: 4 hours
   ├── Task B: 6 hours
   └── Task C: 3 hours
```

### 7. Generic Task Titles

**Pitfall: Vague Titles**
```
❌ Implementation
❌ Coding
❌ Testing
❌ Fix bug
❌ Update docs
```

**Solution: Specific, Action-Oriented Titles**
```
✅ Create PromptEncoder service with Base64 encoding
✅ Add share button to PromptCard component
✅ Write unit tests for PromptEncoder service
✅ Fix PromptCard title truncation in resizable sidebar
✅ Update README with prompt sharing documentation
```

### 8. Neglecting Non-Functional Tasks

**Pitfall: Only Creating Feature Tasks**
```
❌ Missing: Testing tasks
❌ Missing: Documentation tasks
❌ Missing: Code review tasks
❌ Missing: Deployment tasks
```

**Solution: Include All Work Types**
```
✅ Feature Implementation
   ├── Create PromptEncoder service
   └── Add share button to UI

✅ Quality Assurance
   ├── Write unit tests
   ├── Write integration tests
   └── Manual testing

✅ Documentation
   ├── Update README
   └── Update API docs

✅ DevOps
   └── Deploy to production
```

### 9. Not Updating Task Status

**Pitfall: Stale Task Status**
```
❌ Task status: "To Do" (but work already started)
❌ Task status: "In Progress" (but work is done)
❌ No time logging
```

**Solution: Keep Status Current**
```
✅ Update status when work starts: "In Progress"
✅ Update status when review needed: "In Review"
✅ Log time spent on task
✅ Update status when complete: "Done"
✅ Add comments about progress/blockers
```

### 10. Ignoring Definition of Done

**Pitfall: Marking Tasks Done Prematurely**
```
❌ Task marked "Done" but:
   - Tests not written
   - Code not reviewed
   - Documentation not updated
   - Lint errors present
```

**Solution: Enforce Definition of Done**
```
✅ Before marking "Done", verify:
   - All acceptance criteria met
   - Tests written and passing
   - Code reviewed and approved
   - Documentation updated
   - Linting passing
   - No outstanding comments
```

### 11. Not Linking Related Work

**Pitfall: Orphaned Tasks**
```
❌ Task has no parent Story
❌ Task not linked to Epic
❌ Task not linked to related tasks
❌ Task not linked to PR
```

**Solution: Connect the Dots**
```
✅ Link task to parent Story
✅ Link Story to Epic
✅ Link related tasks (dependencies)
✅ Link PR/branch to task
✅ Link design docs/specs
✅ Link test results
```

### 12. Forgetting About Testing

**Pitfall: No Dedicated Testing Tasks**
```
❌ Story: Add prompt sharing
    ├── Create PromptEncoder service
    ├── Add share button
    └── Add import button
    (No testing tasks)
```

**Solution: Always Include Testing**
```
✅ Story: Add prompt sharing
    ├── Create PromptEncoder service
    ├── Add share button
    ├── Add import button
    ├── Write unit tests for PromptEncoder
    ├── Write integration tests for share flow
    └── Manual testing on all platforms
```

---

## Quick Reference: Task Templates

### Standard Development Task Template

```markdown
## Task Title
[Action verb] + [specific component/feature] + [context if needed]

## Description
[1-2 sentence overview of what needs to be done and why]

## Implementation Details
- [ ] Specific change 1
- [ ] Specific change 2
- [ ] Technical consideration 3

## Acceptance Criteria
- [ ] Functional requirement 1
- [ ] Functional requirement 2
- [ ] Non-functional requirement (performance, a11y, etc.)
- [ ] Tests passing
- [ ] Documentation updated

## Related Links
- Parent Story: [STORY-123]
- Design Doc: [link]
- PR: [link when created]

## Technical Notes
[Any important technical context, gotchas, or decisions]
```

### Testing Task Template

```markdown
## Task Title
Write [unit/integration/e2e] tests for [component/service]

## Description
Achieve comprehensive test coverage for [component] including
happy paths, error scenarios, and edge cases.

## Test Scenarios
- [ ] Scenario 1: [description]
- [ ] Scenario 2: [description]
- [ ] Scenario 3: [edge case]
- [ ] Scenario 4: [error handling]

## Coverage Goals
- [ ] Line coverage: >90%
- [ ] Branch coverage: >90%
- [ ] Function coverage: 100%

## Acceptance Criteria
- [ ] All scenarios covered
- [ ] Tests are deterministic
- [ ] Tests run fast (<500ms)
- [ ] Coverage goals met
```

### Documentation Task Template

```markdown
## Task Title
[Create/Update] [document name] with [specific content]

## Description
[What documentation needs to be created/updated and why]

## Content Requirements
- [ ] Section 1: [topic]
- [ ] Section 2: [topic]
- [ ] Code examples
- [ ] Screenshots (if applicable)

## Acceptance Criteria
- [ ] All sections complete
- [ ] Technical accuracy verified
- [ ] Grammar/spelling checked
- [ ] Links working
- [ ] Reviewed by [role]

## Target Audience
[Developers/Users/Both]
```

---

## Summary: Key Takeaways

### Golden Rules

1. **One-Day Rule**: Tasks should be completable in less than one day
2. **Be Specific**: Titles and descriptions should be clear and actionable
3. **Always Define "Done"**: Every task needs acceptance criteria
4. **Right-size Work**: Not too big, not too small
5. **Link Everything**: Connect tasks to stories, epics, PRs, docs
6. **Include Testing**: Testing is not optional
7. **Document as You Go**: Documentation tasks are real tasks
8. **Use Sub-tasks Wisely**: Don't overuse, they clutter the board
9. **Estimate Consistently**: Stories in points, tasks in hours
10. **Keep Status Current**: Update as work progresses

### Task Checklist

Before creating a task, verify:
- [ ] Title is specific and action-oriented
- [ ] Description includes what, why, where
- [ ] Acceptance criteria are defined
- [ ] Task size is reasonable (< 1 day)
- [ ] Dependencies are identified
- [ ] Parent story is linked
- [ ] Assignee is identified (during planning)
- [ ] Estimate is provided
- [ ] Labels and components are set

Before marking a task done, verify:
- [ ] All acceptance criteria met
- [ ] Definition of Done checklist complete
- [ ] Tests written and passing
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] PR merged to main
- [ ] Linting passing
- [ ] No outstanding comments or blockers

---

## Additional Resources

### Atlassian Official Documentation
- [What are work types?](https://support.atlassian.com/jira-cloud-administration/docs/what-are-issue-types/)
- [Create a work item and a subtask](https://support.atlassian.com/jira-software-cloud/docs/create-a-work-item-and-a-subtask/)
- [8 steps to a definition of done in Jira](https://www.atlassian.com/blog/jira/8-steps-to-a-definition-of-done-in-jira)

### Community Resources
- [Complete Guide to Jira Subtasks](https://idalko.com/a-complete-guide-to-jira-subtasks/)
- [How to write a useful Jira ticket](https://community.atlassian.com/forums/Jira-articles/How-to-write-a-useful-Jira-ticket/ba-p/2147004)
- [Decomposing Features into User Stories](https://www.pmi.org/disciplined-agile/team-lead/practice-decomposing-features-into-stories)

### Books
- "User Stories Applied" by Mike Cohn
- "Agile Estimating and Planning" by Mike Cohn
- "The Scrum Guide" by Ken Schwaber and Jeff Sutherland

---

**Document Version:** 1.0
**Last Updated:** 2025-10-12
**Author:** AI Research (Claude)
**Sources:** Atlassian Documentation, Agile Community Best Practices, Industry Standards
