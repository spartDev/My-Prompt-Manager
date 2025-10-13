# Comprehensive User Story Best Practices for Jira

## Table of Contents
1. [User Story Format](#user-story-format)
2. [Acceptance Criteria](#acceptance-criteria)
3. [Story Size & Scope](#story-size--scope)
4. [Story Fields & Metadata](#story-fields--metadata)
5. [Story Relationships](#story-relationships)
6. [Story Documentation](#story-documentation)
7. [Common Mistakes to Avoid](#common-mistakes-to-avoid)
8. [Templates & Checklists](#templates--checklists)
9. [Examples for Prompt Sharing Feature](#examples-for-prompt-sharing-feature)

---

## 1. User Story Format

### The Standard Format

**Structure:**
```
As a [user type/persona], I want [action/feature], so that [value/benefit].
```

**Components:**
- **Who**: The user type or persona (e.g., "prompt library user", "content creator")
- **What**: The action or feature they want
- **Why**: The benefit or value they'll receive

### Title vs Description Best Practices

#### **Title (Summary Field)**
- **Keep it short and descriptive** (5-10 words max)
- Use keywords that describe the functionality
- Avoid the full "As a... I want..." format in titles (they get truncated)
- Focus on what the story delivers

**Good Title Examples:**
```
✓ Share Prompt via Encoded URL
✓ Import Shared Prompt
✓ Generate Shareable Link
```

**Poor Title Examples:**
```
✗ As a user I want to share prompts so that I can collaborate
✗ User Story for Sharing Feature
✗ Implement sharing
```

#### **Description Field**
- Use the full "As a... I want... so that..." format here
- Add context, user flows, and use cases
- Include links to mockups, designs, or technical specs
- Explain edge cases and constraints

**Description Template:**
```markdown
### User Story
As a [user type], I want [action], so that [benefit].

### Context
[Brief explanation of why this is needed and how it fits into the larger feature]

### User Flow
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Constraints & Considerations
- [Technical constraint 1]
- [Business rule 1]

### Related Resources
- Design: [Link to mockup]
- Technical Spec: [Link to doc]
```

### Alternative Formats

While the standard format works for most stories, consider these alternatives:

**Job Story Format** (focuses on context and motivation):
```
When [situation], I want to [action], so I can [outcome].
```

**Feature-First Format** (for technical stories):
```
[System/Feature] should [capability] so that [value].
```

---

## 2. Acceptance Criteria

Acceptance criteria define the conditions that must be met for a story to be considered complete. They minimize ambiguity and clarify conditions of satisfaction.

### Given/When/Then Format (BDD Style)

**Use When:**
- Following Behavior-Driven Development (BDD)
- Planning automated tests
- Need to specify precise scenarios
- Testing specific user interactions

**Structure:**
```
Scenario: [Scenario name]
Given [precondition/context]
When [action taken]
Then [expected result]
```

**Example:**
```gherkin
Scenario: Successfully share a prompt
Given I have a prompt selected in my library
When I click the "Share" button
Then a shareable link is generated
And the link is copied to my clipboard
And a success message is displayed

Scenario: Import a shared prompt from URL
Given I receive a valid share URL from another user
When I click the share URL
Then the extension opens with the import dialog
And the prompt details are pre-populated
And I see an "Add to Library" button
```

**Advantages:**
- Clear, testable scenarios
- Maps directly to automated tests
- Unambiguous expected behavior
- Follows industry standard (Gherkin syntax)

### Checklist Format (Rule-Oriented)

**Use When:**
- Manual testing is planned
- Simple pass/fail criteria
- Business rules are straightforward
- Team prefers concise format

**Structure:**
```
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3
```

**Example:**
```
Acceptance Criteria:
- [ ] Share button is visible when a prompt is selected
- [ ] Generated URL includes encoded prompt data
- [ ] URL is automatically copied to clipboard
- [ ] Success toast notification appears
- [ ] Shared prompt includes title, content, and category
- [ ] URL is under 2000 characters for browser compatibility
- [ ] Share works for prompts with special characters
```

**Advantages:**
- Quick to write and read
- Easy for manual QA
- Clear pass/fail criteria
- Less verbose than Given/When/Then

### Best Practices for Acceptance Criteria

1. **Be Specific and Measurable**
   ```
   ✓ "URL must be under 2000 characters"
   ✗ "URL should be reasonable length"
   ```

2. **Include Both Happy Path and Edge Cases**
   ```
   - [ ] Sharing works for standard prompts
   - [ ] Sharing works for prompts with emoji
   - [ ] Error shown if prompt exceeds size limit
   ```

3. **Make Them Testable**
   - Each criterion should be verifiable
   - QA/testers should be able to test each one independently

4. **Keep Them Independent**
   - Each criterion should stand alone
   - Order shouldn't matter

5. **Write from User Perspective**
   ```
   ✓ "User sees confirmation message"
   ✗ "System logs share event to database"
   ```

---

## 3. Story Size & Scope

### INVEST Criteria

Every user story should follow the **INVEST** principles:

| Criterion | Description | Example Check |
|-----------|-------------|---------------|
| **I**ndependent | Story can be developed without depending on other stories | Can this be built without waiting for another story? |
| **N**egotiable | Details are flexible; story is open to discussion | Can the team decide how to implement this? |
| **V**aluable | Provides clear business value to users or stakeholders | Does this solve a real user problem? |
| **E**stimable | Team can estimate effort/complexity | Do we understand this well enough to estimate? |
| **S**mall | Can be completed in one sprint (ideally 1-3 days) | Can this be done in less than a week? |
| **T**estable | Has clear acceptance criteria that can be tested | Can QA verify this is complete? |

### Ideal Story Size

**Time-Based:**
- **Sweet Spot**: 1-3 days of development effort
- **Maximum**: One sprint (1-2 weeks)
- **Minimum**: Not so small it becomes administrative overhead

**Complexity-Based:**
- Use story points (1, 2, 3, 5, 8, 13)
- Stories larger than 8 points should be split
- Stories of 13+ points are epics, not stories

**Red Flags for Too Large:**
- Story has multiple "and" statements in the title
- Acceptance criteria list is very long (>8-10 items)
- Multiple developers need to work on different parts
- Story spans multiple sprints
- Team struggles to estimate

### When to Split Stories

Split stories when:
1. **Story is too large** (>8 story points or >1 sprint)
2. **Multiple user personas** are involved
3. **Multiple workflows** are covered
4. **Too many acceptance criteria** (>10)
5. **Team can't estimate** confidently

### Vertical Slicing Techniques

**Vertical slicing** = Each slice delivers working, demonstrable software with value

Think of a story as a multi-layer cake:
- UI Layer
- Business Logic Layer
- Data Layer
- API Layer

A **vertical slice** cuts through ALL layers to deliver a thin but complete feature.

#### SPIDR Method for Splitting

| Technique | Description | Example |
|-----------|-------------|---------|
| **S**pike | Research/learning story | "Research URL encoding libraries for sharing" |
| **P**aths | Different user workflows | "Share via URL" vs "Share via QR code" |
| **I**nterfaces | Different channels/platforms | "Share on desktop" vs "Share on mobile" |
| **D**ata | Different data types | "Share simple prompts" vs "Share prompts with attachments" |
| **R**ules | Different business rules | "Share public prompts" vs "Share with password protection" |

#### Other Splitting Techniques

**1. By Acceptance Criteria**
```
Original: "Share and import prompts"
Split into:
  → "Share prompt via URL"
  → "Import prompt from URL"
```

**2. Happy Path First**
```
Original: "Share prompts with validation and error handling"
Split into:
  → "Share valid prompts (happy path)"
  → "Handle invalid prompts and errors"
```

**3. By User Role**
```
Original: "Users and admins can share prompts"
Split into:
  → "Regular users can share their prompts"
  → "Admins can share organization prompts"
```

**4. By Operation/CRUD**
```
Original: "Manage shared prompts"
Split into:
  → "Create shareable link"
  → "View shared prompt"
  → "Import shared prompt"
  → "Delete shared link"
```

### Horizontal vs Vertical Slicing

**❌ Horizontal Slicing (Anti-Pattern)**
```
Story 1: Build sharing API
Story 2: Build sharing UI
Story 3: Build sharing database schema
```
**Problems:**
- Nothing works until all stories are done
- No demonstrable value until the end
- Front-end and back-end teams work in silos

**✅ Vertical Slicing (Best Practice)**
```
Story 1: Basic prompt sharing (API + UI + DB)
Story 2: Advanced sharing with options (API + UI + DB)
Story 3: Share analytics dashboard (API + UI + DB)
```
**Benefits:**
- Each story delivers working software
- Early user feedback possible
- Teams collaborate continuously

---

## 4. Story Fields & Metadata

### Essential Jira Fields

| Field | Purpose | Best Practice |
|-------|---------|---------------|
| **Summary** (Title) | Short description | 5-10 words, descriptive, no full story format |
| **Description** | Full story details | Use template with story, context, acceptance criteria |
| **Issue Type** | Type of work | "Story" for user-facing features |
| **Priority** | Importance/urgency | Use consistently across team |
| **Assignee** | Who's working on it | Assign during sprint planning, not during backlog grooming |
| **Story Points** | Effort estimate | Use Fibonacci sequence (1, 2, 3, 5, 8, 13) |
| **Sprint** | When it will be done | Assign during sprint planning |
| **Epic Link** | Parent epic | Link to group related stories |
| **Labels** | Categorization tags | Use for cross-project grouping |
| **Components** | Project subsystems | Use for within-project grouping |

### Priority Levels

Jira's default priority levels:

| Priority | When to Use | Example |
|----------|-------------|---------|
| **Highest** | Critical bugs, blockers, legal requirements | "Security vulnerability fix" |
| **High** | Important features, significant bugs | "Core feature for upcoming release" |
| **Medium** | Standard features, normal priority | "Enhancement to existing feature" |
| **Low** | Nice-to-have features | "UI polish" |
| **Lowest** | Future considerations | "Exploratory feature idea" |

**Best Practices:**
- Not everything can be "Highest" priority
- Use MoSCoW method: Must have, Should have, Could have, Won't have
- Review priorities regularly in backlog grooming
- Priority ≠ Order (order is set in backlog, priority is relative importance)

### Labels Best Practices

**Use Labels For:**
- Cross-project categorization
- Feature grouping (e.g., `sharing-feature`, `analytics`)
- Technical tags (e.g., `frontend`, `backend`, `api`)
- Sprint themes (e.g., `performance`, `ux-improvement`)
- Platform tags (e.g., `chrome-extension`, `firefox`)

**Naming Conventions:**
```
✓ lowercase-with-hyphens
✓ sharing-feature
✓ bug-fix
✗ Sharing Feature (spaces)
✗ SHARING (all caps)
✗ sharing_feature (underscores)
```

**Label Strategy:**
```yaml
Technical:
  - frontend
  - backend
  - api
  - database

Feature Areas:
  - prompt-library
  - sharing-feature
  - custom-sites
  - analytics

Cross-cutting:
  - accessibility
  - performance
  - security
  - ux-improvement
```

### Components vs Labels

| Aspect | Components | Labels |
|--------|-----------|---------|
| **Scope** | Single project only | Cross-project |
| **Management** | Admin sets them | Anyone can create |
| **Structure** | Formal, consistent | Informal, flexible |
| **Use Case** | Architectural areas | Themes, tags, attributes |
| **Example** | "Content Script System", "Popup UI" | "sharing-feature", "performance" |

**Best Practice:**
- **Components** = Code modules/architectural areas (Admin managed)
- **Labels** = Features, themes, cross-cutting concerns (Team managed)

### Custom Fields (When to Use)

Add custom fields only when:
1. **Standard fields don't cover your need**
2. **Information is critical for the team**
3. **Field will be used consistently**
4. **It adds clear value to workflow**

**Common Valuable Custom Fields:**
- **Design Link**: URL to Figma/Sketch mockup
- **Test Strategy**: Manual, Automated, or Both
- **Technical Approach**: Brief implementation note
- **Security Review Required**: Yes/No checkbox

**Avoid Custom Field Overload:**
```
✗ Don't create fields that nobody fills out
✗ Don't duplicate information that exists elsewhere
✗ Don't create fields for one-time use
```

---

## 5. Story Relationships

### Linking Stories to Epics

**Epic**: Large body of work that spans multiple sprints and contains multiple stories

**Hierarchy:**
```
Epic (large initiative, 3+ months)
  ├── Story 1 (1-5 days)
  ├── Story 2 (1-5 days)
  ├── Story 3 (1-5 days)
  │     ├── Sub-task 1 (hours)
  │     └── Sub-task 2 (hours)
  └── Story 4 (1-5 days)
```

**How to Link:**
1. Open the user story
2. Find the "Epic Link" field
3. Select the appropriate epic
4. Save

**Alternative Method:**
1. Open the epic
2. Click "Add child issue"
3. Select "Story" as issue type
4. Fill in story details

### When to Create an Epic

Create an epic when:
- Work will take **multiple sprints** (2+ sprints)
- You have a **pattern of related stories** that should be grouped
- The initiative has a **clear goal** that requires multiple features
- You need to **track progress** of a large feature set

**Example: Prompt Sharing Feature Epic**
```
Epic: Prompt Sharing & Collaboration
  ├── Story: Generate shareable prompt URL
  ├── Story: Import prompt from URL
  ├── Story: Share prompt to clipboard
  ├── Story: View shared prompt preview
  ├── Story: Track sharing analytics
  └── Story: Share via QR code
```

### Epic Best Practices

1. **Write Clear Epic Goals**
   ```markdown
   Epic: Prompt Sharing & Collaboration

   Goal: Enable users to easily share prompts with others and
   import shared prompts into their library.

   Success Metrics:
   - 30% of users share at least one prompt per month
   - 80% of shared links successfully import
   ```

2. **Define Epic Completion Criteria**
   ```
   Epic is done when:
   - Users can share prompts via URL
   - Users can import shared prompts
   - Analytics track sharing activity
   - Documentation is published
   ```

3. **Review Epic Progress Regularly**
   - Track % of stories completed
   - Adjust scope if needed
   - Close epic when goal is achieved (not when all stories are done)

### Story Dependencies and Blockers

**Link Types:**

| Link Type | When to Use | Example |
|-----------|-------------|---------|
| **Blocks / Is Blocked By** | Story A must be done before Story B | "Share URL feature" blocks "Share via QR code" |
| **Relates To** | Stories are connected but not dependent | "Share prompt" relates to "Import prompt" |
| **Duplicates / Is Duplicated By** | Same work described twice | Mark one as duplicate |
| **Clones / Is Cloned By** | Story copied for another use case | Clone for different platform |

**Dependency Best Practices:**
- **Minimize dependencies** (violates INVEST "Independent")
- If dependencies exist, **order stories in backlog** to resolve them
- Mark blockers clearly with "Blocks" link type
- In stand-ups, **call out blocked stories**

**Example:**
```
Story A: "Generate encoded share URL"
  Blocks →
Story B: "Add QR code generation for share URL"
```

### Parent-Child Relationships

**Sub-tasks** break a story into smaller technical tasks:

```
User Story: Share Prompt via URL
  ├── Sub-task: Implement URL encoding logic
  ├── Sub-task: Create share button UI
  ├── Sub-task: Add clipboard copy functionality
  └── Sub-task: Write unit tests for encoding
```

**When to Use Sub-tasks:**
- Story is well-defined but has multiple technical steps
- Different team members work on different parts
- Track progress within a story during sprint

**When NOT to Use Sub-tasks:**
- Breaking story into sub-tasks by layer (use vertical slicing instead)
- Sub-tasks represent different user value (should be separate stories)
- Over-planning upfront (create sub-tasks during sprint, not during backlog grooming)

---

## 6. Story Documentation

### What to Include in Story Descriptions

A well-documented story includes:

1. **User Story Statement**
   ```
   As a [user], I want [feature], so that [benefit].
   ```

2. **Context & Background**
   - Why is this needed?
   - What problem does it solve?
   - How does it fit into the larger feature?

3. **User Flow / Scenarios**
   - Step-by-step walkthrough
   - Expected user journey

4. **Acceptance Criteria**
   - Clear, testable conditions
   - Both happy path and edge cases

5. **Design & Mockups**
   - Links to Figma/Sketch/wireframes
   - Screenshots of expected UI

6. **Technical Considerations**
   - API dependencies
   - Performance requirements
   - Security considerations
   - Browser compatibility

7. **Test Scenarios**
   - Key test cases
   - Edge cases to verify

8. **Out of Scope**
   - What this story does NOT include
   - Future enhancements

### Linking to External Resources

**Design Resources:**
```markdown
### Design
- Figma: [Share Dialog Mockup](https://figma.com/file/...)
- User Flow: [Sharing Flow Diagram](https://miro.com/board/...)
```

**Technical Specs:**
```markdown
### Technical Documentation
- Architecture Doc: [Sharing Architecture](https://confluence.com/...)
- API Spec: [Share API](https://github.com/.../API_SPEC.md)
- Data Model: [Share Data Structure](https://dbdiagram.io/...)
```

**Related Discussions:**
```markdown
### Background
- Original Feature Request: [GitHub Issue #123](https://github.com/...)
- Team Discussion: [Slack Thread](https://slack.com/...)
- User Research: [Interview Notes](https://confluence.com/...)
```

### Definition of Done (DoD)

**Definition of Done** applies to ALL stories in the project. It's a quality checklist.

**Example DoD:**
```markdown
Definition of Done:
- [ ] Code is written and follows project style guide
- [ ] All acceptance criteria met
- [ ] Unit tests written and passing (>80% coverage)
- [ ] Integration tests passing
- [ ] Code reviewed and approved
- [ ] Documentation updated (if needed)
- [ ] No critical bugs or blockers
- [ ] Tested in supported browsers (Chrome, Firefox, Edge)
- [ ] Accessibility checked (WCAG 2.1 AA)
- [ ] Performance benchmarks met
- [ ] Merged to main branch
```

**DoD vs Acceptance Criteria:**

| Aspect | Acceptance Criteria | Definition of Done |
|--------|---------------------|-------------------|
| **Scope** | Story-specific | Applies to all stories |
| **Content** | Functional requirements | Quality standards & process |
| **Who Defines** | Product Owner | Team |
| **Example** | "Share button generates URL" | "Code reviewed and tested" |

### Definition of Ready (DoR)

**Definition of Ready** ensures stories are prepared BEFORE sprint planning.

**Example DoR Checklist:**
```markdown
Story is Ready when:
- [ ] User story follows "As a... I want... so that..." format
- [ ] Acceptance criteria are clear and testable
- [ ] Story meets INVEST criteria (Independent, Negotiable, Valuable, Estimable, Small, Testable)
- [ ] Design mockups attached (if UI work)
- [ ] Technical dependencies identified
- [ ] No blockers prevent starting work
- [ ] Team can estimate story points
- [ ] Product Owner has prioritized the story
- [ ] Story is small enough to complete in one sprint
```

**Use DoR During Backlog Refinement:**
- Review stories against DoR checklist
- Stories that don't meet DoR stay in backlog
- Only "Ready" stories are candidates for sprint planning

---

## 7. Common Mistakes to Avoid

### Top 10 User Story Anti-Patterns

#### 1. **Stories That Are Too Large**
**Problem**: Story spans multiple sprints, hard to estimate, risks incomplete work

**Example:**
```
❌ "Build complete sharing system"
```

**Solution:**
```
✅ "Generate shareable URL for prompt"
✅ "Import prompt from shared URL"
✅ "Add sharing analytics dashboard"
```

---

#### 2. **Technical/Horizontal Slicing**
**Problem**: Stories split by technical layer, no end-to-end value

**Example:**
```
❌ "Build sharing API"
❌ "Create sharing UI"
❌ "Add sharing database tables"
```

**Solution:**
```
✅ "Share prompt via URL" (includes API + UI + DB)
```

---

#### 3. **UI-Based Stories Without Functionality**
**Problem**: Pretty screens that don't work end-to-end

**Example:**
```
❌ "Design sharing dialog"
❌ "Style share button"
```

**Solution:**
```
✅ "Enable users to share prompts via URL" (includes working feature)
```

---

#### 4. **Missing Acceptance Criteria**
**Problem**: Team doesn't know when story is "done"

**Example:**
```
❌ User Story: As a user, I want to share prompts.
(No acceptance criteria listed)
```

**Solution:**
```
✅ User Story: As a user, I want to share prompts via URL.

Acceptance Criteria:
- [ ] Share button visible when prompt selected
- [ ] Clicking share generates URL
- [ ] URL copied to clipboard automatically
- [ ] Success message shown
```

---

#### 5. **Confusing Acceptance Criteria with Definition of Done**
**Problem**: Story-specific criteria mixed with general quality standards

**Example:**
```
❌ Acceptance Criteria:
- [ ] Share button generates URL
- [ ] Code is reviewed
- [ ] Unit tests pass
- [ ] Linting passes
```

**Solution:**
```
✅ Acceptance Criteria (story-specific):
- [ ] Share button generates URL
- [ ] URL includes encoded prompt data

✅ Definition of Done (applies to all stories):
- [ ] Code reviewed
- [ ] Tests pass
- [ ] Linting passes
```

---

#### 6. **Working in Isolation**
**Problem**: BA/PO writes all stories alone, team not engaged

**Example:**
```
❌ Product Owner writes complete backlog without team input
```

**Solution:**
```
✅ Team collaborates in backlog refinement
✅ Developers, QA, and PO discuss stories together
✅ Team identifies technical considerations together
```

---

#### 7. **Using Technical Language**
**Problem**: Stories filled with jargon, stakeholders can't understand

**Example:**
```
❌ "Implement base64 encoding service for JSON serialization of prompt DTOs"
```

**Solution:**
```
✅ "Generate shareable link for prompts"

Technical Notes: Uses base64 encoding for URL safety
```

---

#### 8. **Missing Value Statement ("So That")**
**Problem**: Team doesn't understand WHY feature is needed

**Example:**
```
❌ "As a user, I want to share prompts."
```

**Solution:**
```
✅ "As a user, I want to share prompts via URL, so that I can collaborate with colleagues without manually copying content."
```

---

#### 9. **Over-Detailed Stories Written Upfront**
**Problem**: Too much detail too early, reduces team engagement

**Example:**
```
❌ Story includes:
- Complete technical architecture
- Detailed implementation steps
- All edge cases designed upfront
- No room for team input
```

**Solution:**
```
✅ Story includes:
- User goal and value
- Acceptance criteria
- Key design mockup
- Technical considerations (not complete design)
- Team discusses implementation during sprint
```

---

#### 10. **Skipping Definition of Done**
**Problem**: Inconsistent quality, stories that "never finish"

**Example:**
```
❌ Team has no DoD, each developer decides when "done"
Result: Stories re-opened, bugs, tech debt
```

**Solution:**
```
✅ Team agrees on DoD:
- Code reviewed
- Tests pass
- Documentation updated
- Tested in all browsers
```

---

## 8. Templates & Checklists

### User Story Template (Markdown for Jira)

```markdown
### User Story
As a [user type/persona], I want [action/feature], so that [value/benefit].

### Context
[Why is this needed? What problem does it solve?]

### User Flow
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]
- [ ] [Edge case 1]
- [ ] [Edge case 2]

### Design & Mockups
- Figma: [Link]
- User Flow: [Link]

### Technical Considerations
- [Dependency 1]
- [Performance requirement]
- [Browser compatibility note]

### Test Scenarios
- [Key test case 1]
- [Key test case 2]

### Out of Scope
- [What this story does NOT include]

### Related Resources
- Epic: [Link to Epic]
- Related Story: [Link]
- Technical Doc: [Link]
```

### Alternative: Given/When/Then Template

```markdown
### User Story
As a [user type], I want [action], so that [benefit].

### Context
[Background and reasoning]

### Scenarios

**Scenario 1: [Happy Path Scenario Name]**
```gherkin
Given [precondition]
When [action]
Then [expected result]
And [additional result]
```

**Scenario 2: [Edge Case Scenario Name]**
```gherkin
Given [precondition]
When [action]
Then [expected result]
```

**Scenario 3: [Error Case Scenario Name]**
```gherkin
Given [precondition]
When [action]
Then [expected error]
```

### Design
- Mockup: [Link]

### Technical Notes
- [Technical consideration]

### Definition of Done
- [ ] All scenarios pass
- [ ] Code reviewed
- [ ] Tests automated
```

### Definition of Ready Checklist

Use this checklist during backlog refinement:

```markdown
## Definition of Ready Checklist

Story is ready for sprint planning when:

### Story Completeness
- [ ] Title is clear and concise (5-10 words)
- [ ] Description includes "As a... I want... so that..."
- [ ] Value/benefit is clearly stated

### INVEST Criteria
- [ ] **Independent**: Can be developed without other stories
- [ ] **Negotiable**: Implementation details are flexible
- [ ] **Valuable**: Delivers clear user/business value
- [ ] **Estimable**: Team can estimate effort
- [ ] **Small**: Can complete in one sprint (1-3 days ideal)
- [ ] **Testable**: Has clear acceptance criteria

### Acceptance Criteria
- [ ] At least 3 acceptance criteria defined
- [ ] Criteria are clear and testable
- [ ] Criteria cover happy path
- [ ] Edge cases identified

### Resources & Dependencies
- [ ] Design mockups attached (if UI work)
- [ ] Technical dependencies identified
- [ ] No active blockers
- [ ] Related stories linked

### Team Understanding
- [ ] Team understands the story goal
- [ ] Team can estimate story points
- [ ] Technical approach discussed (if needed)

### Priority & Planning
- [ ] Product Owner has prioritized
- [ ] Story is sequenced in backlog
- [ ] Epic link added (if applicable)
```

### Definition of Done Checklist

Team-wide quality standards for ALL stories:

```markdown
## Definition of Done

A story is DONE when:

### Code Quality
- [ ] Code written and follows style guide (ESLint passes)
- [ ] All acceptance criteria met
- [ ] No known bugs or defects

### Testing
- [ ] Unit tests written and passing (>80% coverage)
- [ ] Integration tests passing
- [ ] Manual testing completed
- [ ] Tested in supported browsers (Chrome, Firefox, Edge)

### Review & Approval
- [ ] Code reviewed and approved by peer
- [ ] QA testing completed and approved
- [ ] Product Owner accepted the story

### Documentation
- [ ] Code comments added where needed
- [ ] README updated (if needed)
- [ ] User documentation updated (if needed)

### Accessibility & Performance
- [ ] Accessibility standards met (WCAG 2.1 AA)
- [ ] Performance benchmarks met
- [ ] No console errors or warnings

### Deployment
- [ ] Merged to main branch
- [ ] CI/CD pipeline passes
- [ ] Deployed to staging environment
```

### Story Splitting Checklist

Use this when a story is too large:

```markdown
## Story Splitting Checklist

Is the story too large? Check if:
- [ ] Story points > 8
- [ ] Can't complete in one sprint
- [ ] Multiple "and" in the title
- [ ] More than 8-10 acceptance criteria
- [ ] Team struggles to estimate

If yes to any, consider splitting using:

### SPIDR Method
- [ ] **Spike**: Can we split off research/learning?
- [ ] **Paths**: Different user workflows?
- [ ] **Interfaces**: Different platforms/channels?
- [ ] **Data**: Different data types?
- [ ] **Rules**: Different business rules?

### Other Techniques
- [ ] By acceptance criteria (one story per criterion)
- [ ] Happy path first, edge cases later
- [ ] By user role/persona
- [ ] By operation (CRUD: Create, Read, Update, Delete)
- [ ] Simple version first, advanced features later
```

---

## 9. Examples for Prompt Sharing Feature

### Example 1: Core Sharing Story

#### Title
```
Share Prompt via Encoded URL
```

#### Description
```markdown
### User Story
As a prompt library user, I want to generate a shareable URL for my prompts, so that I can easily share them with colleagues without manually copying content.

### Context
Users frequently need to share prompts with team members or across their own devices. Currently, they must manually copy/paste prompt content, which is error-prone and loses metadata like categories. A shareable URL would streamline collaboration and prompt distribution.

### User Flow
1. User selects a prompt in their library
2. User clicks "Share" button in prompt card
3. System generates encoded URL containing prompt data
4. URL is automatically copied to clipboard
5. Success toast notification appears
6. User pastes URL to share with others

### Acceptance Criteria
- [ ] Share button visible on prompt cards when hovering
- [ ] Clicking share generates URL with encoded prompt data
- [ ] Generated URL includes: title, content, category, tags
- [ ] URL is base64-encoded for safe sharing
- [ ] URL is automatically copied to clipboard
- [ ] Success toast shows "Link copied to clipboard!"
- [ ] URL is under 2000 characters for browser compatibility
- [ ] Sharing works for prompts with special characters (emoji, unicode)
- [ ] Sharing preserves newlines and formatting in prompt content

### Design & Mockups
- Figma: [Share Button & Toast Mockup](link)
- User Flow: [Sharing Flow Diagram](link)

### Technical Considerations
- Use base64 encoding for URL safety
- Compress JSON data to reduce URL length
- Check browser URL length limits (2000 chars recommended)
- Handle special characters in encoding
- Consider URL shortening for future enhancement

### Test Scenarios
1. Share a simple prompt with ASCII text
2. Share a prompt with emoji and special characters
3. Share a very long prompt (test size limits)
4. Share a prompt with multiple line breaks
5. Verify URL can be decoded correctly
6. Test on Chrome, Firefox, Edge

### Out of Scope
- QR code generation (separate story)
- Share analytics tracking (separate story)
- Password-protected sharing (future enhancement)
- Share expiration dates (future enhancement)

### Related Resources
- Epic: Prompt Sharing & Collaboration
- Related Story: [Import Prompt from URL](link)
- Technical Spec: [Sharing Architecture Doc](link)
```

---

### Example 2: Import Story

#### Title
```
Import Shared Prompt from URL
```

#### Description
```markdown
### User Story
As a prompt library user, I want to import prompts from shared URLs, so that I can easily add prompts shared by colleagues to my library.

### Context
This is the receiving side of the prompt sharing feature. When a user receives a share URL, they should be able to quickly import the prompt into their own library with a single click.

### User Flow
1. User receives share URL from colleague
2. User clicks the URL
3. Extension detects share URL and opens side panel
4. Import dialog displays with prompt preview
5. User reviews prompt details (title, content, category)
6. User clicks "Add to Library"
7. Prompt is saved to user's library
8. Success confirmation shown

### Acceptance Criteria
- [ ] Extension detects share URLs (e.g., extension://...?share=...)
- [ ] Share URL opens extension side panel (or popup)
- [ ] Import dialog shows prompt preview before adding
- [ ] Dialog displays: title, content, category, tags
- [ ] User can edit prompt before importing (optional)
- [ ] "Add to Library" button imports the prompt
- [ ] Duplicate detection: warn if prompt already exists
- [ ] Success toast: "Prompt added to your library!"
- [ ] Newly imported prompt visible in library immediately
- [ ] Invalid/corrupted URLs show error message

### Design & Mockups
- Figma: [Import Dialog Mockup](link)

### Technical Considerations
- Decode base64 URL parameter
- Validate decoded JSON structure
- Check for prompt duplicates using Levenshtein distance
- Handle URL decoding errors gracefully
- Sanitize imported content for XSS protection

### Test Scenarios
**Scenario 1: Successfully import shared prompt**
```gherkin
Given I receive a valid share URL
When I click the URL
Then the extension opens with import dialog
And the prompt details are displayed correctly
When I click "Add to Library"
Then the prompt is saved to my library
And I see "Prompt added to your library!" message
```

**Scenario 2: Import duplicate prompt**
```gherkin
Given I already have the shared prompt in my library
When I click a share URL for that prompt
Then I see a warning "This prompt already exists in your library"
And I have option to "Add Anyway" or "Cancel"
```

**Scenario 3: Invalid share URL**
```gherkin
Given I receive a corrupted share URL
When I click the URL
Then I see error message "Invalid share link"
And I see suggestion "Ask sender for a new link"
```

### Out of Scope
- Batch import of multiple prompts (future)
- Import from file upload (separate feature)
- Merge imported prompt with existing (future)

### Related Resources
- Epic: Prompt Sharing & Collaboration
- Related Story: [Share Prompt via URL](link)
- Technical Spec: [Import Validation Logic](link)
```

---

### Example 3: Small Enhancement Story

#### Title
```
Copy Share Link to Clipboard
```

#### Description
```markdown
### User Story
As a prompt library user, I want the share URL to be automatically copied to my clipboard, so that I can immediately paste and send it without extra steps.

### Context
After generating a share URL, users need to copy it to send to others. Auto-copying to clipboard removes friction and improves UX.

### Acceptance Criteria
- [ ] When share URL is generated, it's automatically copied to clipboard
- [ ] Success toast shows "Link copied to clipboard!"
- [ ] Works on Chrome, Firefox, Edge
- [ ] Handles clipboard permission errors gracefully
- [ ] If clipboard fails, show URL in dialog to manually copy

### Design
- Toast notification matches existing design system

### Technical Notes
- Use `navigator.clipboard.writeText()` API
- Requires clipboard permission
- Fallback: show URL in text field if permission denied

### Test Scenarios
1. Generate share link → verify clipboard contains URL
2. Deny clipboard permission → verify fallback dialog appears
3. Test on all supported browsers
```

---

### Example 4: Error Handling Story

#### Title
```
Handle Invalid Share URLs
```

#### Description
```markdown
### User Story
As a prompt library user, I want clear error messages when share URLs are invalid, so that I understand what went wrong and can request a new link.

### Context
Share URLs can become corrupted through copy/paste, truncation, or manual editing. Users need helpful error messages to resolve issues.

### Acceptance Criteria
- [ ] Detect corrupted/invalid share URLs
- [ ] Show user-friendly error message (not technical jargon)
- [ ] Suggest next action: "Ask sender for a new link"
- [ ] Log errors for debugging (without exposing to user)
- [ ] Error dialog has "Close" button

### Error Cases to Handle
- URL parameter is missing
- Base64 decoding fails
- JSON parsing fails
- Required fields missing (title, content)
- URL is too long/truncated

### Technical Notes
- Validate share URL format before decoding
- Try-catch around decoding/parsing
- Use `Logger.error()` for debugging
- Show generic error to user, log specific error

### Test Scenarios
1. Click URL with missing parameter
2. Click URL with invalid base64
3. Click URL with malformed JSON
4. Click truncated URL
```

---

### Example 5: Analytics Story (Medium Size)

#### Title
```
Track Prompt Sharing Analytics
```

#### Description
```markdown
### User Story
As a product manager, I want to track how often prompts are shared, so that I can measure feature adoption and understand user behavior.

### Context
Understanding sharing patterns helps us improve the feature and prioritize related enhancements.

### User Flow
1. User shares a prompt
2. Analytics event logged
3. Dashboard displays sharing metrics

### Acceptance Criteria
- [ ] Log event when prompt is shared: `prompt_shared`
- [ ] Track: timestamp, prompt_id, user_id
- [ ] Log event when prompt is imported: `prompt_imported`
- [ ] Track: timestamp, prompt_id, source (if available)
- [ ] Analytics dashboard shows: total shares, shares per day, top shared prompts
- [ ] Privacy: No PII logged, opt-out respected
- [ ] Analytics don't block user actions (async logging)

### Design
- Dashboard: [Analytics Dashboard Mockup](link)

### Technical Considerations
- Use existing analytics service (if available)
- Make analytics logging non-blocking
- Respect user privacy settings
- Consider GDPR compliance
- Store analytics data separately from prompts

### Out of Scope
- Real-time analytics (daily aggregation is fine)
- Export analytics data (future)
- Cross-user sharing network graph (future)

### Related Resources
- Epic: Prompt Sharing & Collaboration
- Technical Doc: [Analytics Architecture](link)
```

---

### Summary of Examples

| Story | Size | Priority | Sprint |
|-------|------|----------|--------|
| Share Prompt via Encoded URL | 5 points | Highest | Sprint 1 |
| Import Shared Prompt from URL | 5 points | Highest | Sprint 1 |
| Copy Share Link to Clipboard | 2 points | High | Sprint 1 |
| Handle Invalid Share URLs | 3 points | High | Sprint 2 |
| Track Prompt Sharing Analytics | 8 points | Medium | Sprint 2 |

These examples demonstrate:
- ✅ Clear, concise titles
- ✅ Full user story format in description
- ✅ Context explaining "why"
- ✅ Detailed acceptance criteria
- ✅ Both checklist and Given/When/Then formats
- ✅ Technical considerations
- ✅ Clear scope boundaries
- ✅ Links to related resources
- ✅ Vertical slicing (each story delivers value)
- ✅ INVEST criteria followed

---

## Additional Resources

### Industry Authorities Referenced

1. **Atlassian Agile Resources**
   - https://www.atlassian.com/agile/project-management/user-stories
   - https://www.atlassian.com/agile/tutorials/epics

2. **Mountain Goat Software (Mike Cohn)**
   - https://www.mountaingoatsoftware.com/agile/user-stories
   - Recognized Agile expert and author

3. **Scrum Alliance**
   - https://resources.scrumalliance.org/Article/need-know-acceptance-criteria
   - Official Scrum certification body

4. **Scrum.org (Ken Schwaber)**
   - https://www.scruminc.com/definition-of-ready/
   - Co-creator of Scrum

5. **Humanizing Work**
   - https://www.humanizingwork.com/the-humanizing-work-guide-to-splitting-user-stories/
   - Industry-recognized Agile consultancy

### Tools Mentioned

- **Jira**: Atlassian's project management tool
- **Confluence**: Documentation and knowledge base
- **Figma/Sketch**: Design mockup tools
- **Miro**: Collaborative whiteboarding

### Further Reading

- "User Stories Applied" by Mike Cohn
- "Agile Estimating and Planning" by Mike Cohn
- "Specification by Example" by Gojko Adzic
- "BDD in Action" by John Ferguson Smart

---

## Quick Reference Card

### Story Checklist
- [ ] Title: 5-10 words, descriptive
- [ ] Format: "As a [user], I want [action], so that [benefit]"
- [ ] Context: Why is this needed?
- [ ] Acceptance Criteria: 3-8 clear, testable criteria
- [ ] INVEST: Independent, Negotiable, Valuable, Estimable, Small, Testable
- [ ] Size: 1-5 story points, completable in 1 sprint
- [ ] Epic Link: Linked to parent epic
- [ ] Priority: Appropriate priority level set
- [ ] Ready: Meets Definition of Ready

### During Sprint
- [ ] Acceptance criteria met
- [ ] Tests pass
- [ ] Code reviewed
- [ ] Definition of Done met
- [ ] Demo-ready

### Red Flags
- ❌ Story has 10+ acceptance criteria
- ❌ Story title is full sentence
- ❌ "Technical" story with no user value
- ❌ Story split by layer (UI, API, DB)
- ❌ No acceptance criteria
- ❌ Story can't be estimated
- ❌ Story spans multiple sprints

---

**Document Version**: 1.0
**Last Updated**: 2025-10-12
**Author**: Research Analyst (Claude Code)
**Sources**: Atlassian, Mountain Goat Software, Scrum Alliance, Industry Best Practices (2024-2025)
