# Jira User Story Templates

## Quick Reference

Copy these templates directly into Jira when creating user stories.

---

## Template 1: Standard User Story (Checklist Format)

**Use this for**: Most user-facing features

```markdown
### User Story
As a [user type/persona], I want [action/feature], so that [value/benefit].

### Context
[Brief explanation of why this is needed and the problem it solves]

### User Flow
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]
- [ ] [Edge case 1]
- [ ] [Error handling 1]

### Design & Mockups
- Figma: [Link]
- Prototype: [Link]

### Technical Notes
- [Technical consideration 1]
- [Dependency or constraint]

### Test Scenarios
- [Key test case 1]
- [Key test case 2]

### Out of Scope
- [What this story does NOT include]

### Related Links
- Epic: [Link]
- Related Story: [Link]
- Technical Doc: [Link]
```

---

## Template 2: BDD-Style User Story (Given/When/Then)

**Use this for**: Features that will be automated tested with BDD tools

```markdown
### User Story
As a [user type], I want [action], so that [benefit].

### Context
[Background and business value]

### Scenarios

**Scenario 1: [Happy Path Name]**
```gherkin
Given [precondition/context]
When [user action]
Then [expected result]
And [additional result]
```

**Scenario 2: [Alternative Path Name]**
```gherkin
Given [precondition]
When [user action]
Then [expected result]
```

**Scenario 3: [Error Case Name]**
```gherkin
Given [precondition]
When [error-triggering action]
Then [error message or recovery]
```

### Design
- Mockup: [Link]
- Flow Diagram: [Link]

### Technical Considerations
- [Technical note 1]
- [Technical note 2]

### Related Links
- Epic: [Link]
- Related Story: [Link]
```

---

## Template 3: Enhancement Story

**Use this for**: Improvements to existing features

```markdown
### Enhancement Story
As a [user type], I want [improvement], so that [benefit].

### Current Behavior
[Describe what currently happens]

### Desired Behavior
[Describe what should happen instead]

### Why This Matters
[User pain point or business value]

### Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Backward compatibility maintained]
- [ ] [No regression in existing functionality]

### Design
- Before/After: [Link]

### Technical Notes
- [Implementation approach]
- [Migration considerations]

### Related Links
- Original Feature Story: [Link]
- Related Enhancement: [Link]
```

---

## Template 4: Bug Fix Story

**Use this for**: Bug fixes written as stories

```markdown
### Bug Description
As a [user type], I experience [problem], which prevents me from [goal].

### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Expected Behavior
[What should happen]

### Actual Behavior
[What currently happens]

### Impact
- Severity: [Critical / Major / Minor]
- Affected Users: [Percentage or user group]
- Workaround: [If available]

### Acceptance Criteria
- [ ] Bug no longer reproducible
- [ ] [Specific fix verification 1]
- [ ] [Specific fix verification 2]
- [ ] Regression tests added
- [ ] No new bugs introduced

### Root Cause
[Technical explanation - optional]

### Related Links
- Original Bug Report: [Link]
- Related Story: [Link]
```

---

## Template 5: Technical Story

**Use this for**: Technical improvements with indirect user value

```markdown
### Technical Story
Improve [technical aspect], so that [user benefit or system improvement].

### Business Value
[Explain how this technical work helps users or the business]

### Current State
[Describe current technical situation]

### Desired State
[Describe improved technical situation]

### Success Criteria
- [ ] [Technical criterion 1]
- [ ] [Technical criterion 2]
- [ ] [Performance benchmark met]
- [ ] [Technical debt reduced]

### Technical Approach
[High-level implementation approach]

### Testing Strategy
- [ ] Unit tests: [Coverage target]
- [ ] Integration tests: [Key scenarios]
- [ ] Performance tests: [Benchmarks]

### Risks & Mitigation
- Risk: [Potential risk]
  Mitigation: [How to address]

### Related Links
- Architecture Doc: [Link]
- Related Technical Story: [Link]
```

---

## Template 6: Spike/Research Story

**Use this for**: Investigation or research work

```markdown
### Spike Goal
Investigate [topic], so that [decision or knowledge outcome].

### Questions to Answer
1. [Question 1]
2. [Question 2]
3. [Question 3]

### Success Criteria
- [ ] [Question 1] answered with recommendation
- [ ] [Question 2] answered with data
- [ ] [Question 3] answered with pros/cons
- [ ] Document created with findings
- [ ] Recommendation presented to team

### Timebox
[Max time to spend on research - e.g., 2 days]

### Deliverables
- [ ] Research document with findings
- [ ] Proof of concept (if applicable)
- [ ] Recommendation for next steps
- [ ] Follow-up stories created (if needed)

### Research Areas
- [Area 1 to investigate]
- [Area 2 to investigate]
- [Tool/library to evaluate]

### Related Links
- Background Discussion: [Link]
- Technical Doc: [Link]
```

---

## Template 7: Documentation Story

**Use this for**: Documentation work

```markdown
### Documentation Goal
Create/update documentation for [feature], so that [user group] can [benefit].

### Target Audience
- [User type 1]
- [User type 2]

### Documentation Scope
- [ ] User guide section
- [ ] API documentation
- [ ] Code comments
- [ ] Architecture diagram
- [ ] Troubleshooting guide

### Acceptance Criteria
- [ ] Documentation is accurate and complete
- [ ] All features covered
- [ ] Examples provided
- [ ] Screenshots included (if needed)
- [ ] Reviewed by subject matter expert
- [ ] Published to documentation site

### Content Outline
1. [Section 1]
2. [Section 2]
3. [Section 3]

### Related Links
- Feature Story: [Link]
- Documentation Site: [Link]
```

---

## Template 8: Epic Description Template

**Use this for**: Creating epics

```markdown
### Epic Goal
Enable [user group] to [high-level capability], so that [business value].

### Problem Statement
[Describe the problem this epic solves]

### Target Users
- [User persona 1]
- [User persona 2]

### Success Metrics
- [Metric 1]: [Target]
- [Metric 2]: [Target]
- [Metric 3]: [Target]

### High-Level Features
1. [Feature 1]
2. [Feature 2]
3. [Feature 3]
4. [Feature 4]

### In Scope
- [What's included]
- [What's included]

### Out of Scope
- [What's NOT included]
- [Future considerations]

### Dependencies
- [Dependency 1]
- [Dependency 2]

### Definition of Done
Epic is complete when:
- [ ] All core features delivered
- [ ] Success metrics achieved
- [ ] User documentation published
- [ ] Feature announced to users

### Timeline
- **Start**: [Date]
- **Target Completion**: [Date]
- **Estimated Sprints**: [Number]

### Related Links
- Product Brief: [Link]
- Design: [Link]
- Technical Spec: [Link]
```

---

## Checklist Templates

### Definition of Ready (DoR) Template

Copy this to your Jira project settings or use in story descriptions:

```markdown
## Definition of Ready

Story is ready for sprint planning when:

### Story Quality
- [ ] User story format: "As a... I want... so that..."
- [ ] Value clearly stated
- [ ] Context provided

### INVEST Criteria
- [ ] Independent
- [ ] Negotiable
- [ ] Valuable
- [ ] Estimable
- [ ] Small (< 1 sprint)
- [ ] Testable

### Acceptance Criteria
- [ ] At least 3 criteria
- [ ] Clear and testable
- [ ] Covers happy path
- [ ] Edge cases identified

### Resources
- [ ] Design attached (if UI)
- [ ] Dependencies identified
- [ ] No blockers

### Team
- [ ] Team understands goal
- [ ] Can be estimated
- [ ] PO prioritized
```

---

### Definition of Done (DoD) Template

Copy this to your Jira project settings:

```markdown
## Definition of Done

A story is complete when:

### Code
- [ ] Code written to style guide
- [ ] All acceptance criteria met
- [ ] No known bugs

### Testing
- [ ] Unit tests (>80% coverage)
- [ ] Integration tests pass
- [ ] Manual testing complete
- [ ] Tested in supported browsers

### Review
- [ ] Code reviewed & approved
- [ ] QA approved
- [ ] PO accepted

### Documentation
- [ ] Code comments added
- [ ] Docs updated (if needed)

### Deployment
- [ ] Merged to main
- [ ] CI/CD passes
- [ ] Deployed to staging
```

---

## Field Value Templates

### Priority Guidelines

Copy to team wiki or Confluence:

```markdown
## Priority Definitions

### Highest
- Security vulnerabilities
- Data loss bugs
- Legal/compliance requirements
- Complete blockers

### High
- Core features for current release
- Significant bugs affecting many users
- Important improvements

### Medium
- Standard features
- Normal priority work
- Planned enhancements

### Low
- Nice-to-have features
- Minor improvements
- UI polish

### Lowest
- Future ideas
- Exploratory work
```

---

### Story Points Guide

```markdown
## Story Points Reference

### 1 Point
- **Time**: 1-2 hours
- **Complexity**: Trivial
- **Example**: Fix typo, update copy

### 2 Points
- **Time**: 2-4 hours
- **Complexity**: Simple
- **Example**: Add button, simple form field

### 3 Points
- **Time**: 4-8 hours (1 day)
- **Complexity**: Moderate
- **Example**: Simple feature with tests

### 5 Points
- **Time**: 1-3 days
- **Complexity**: Complex
- **Example**: Full feature with UI + logic + tests

### 8 Points
- **Time**: 3-5 days
- **Complexity**: Very complex
- **Example**: Large feature, consider splitting

### 13 Points
- **Time**: 1+ weeks
- **Complexity**: Epic-sized
- **Action**: Must split into smaller stories
```

---

## Copy-Paste Snippets

### Common Acceptance Criteria Patterns

**UI Feature:**
```
- [ ] [Element] is visible when [condition]
- [ ] Clicking [element] triggers [action]
- [ ] [Action] displays [expected result]
- [ ] Works on Chrome, Firefox, Edge
- [ ] Mobile responsive (if applicable)
- [ ] Dark mode supported
- [ ] Keyboard accessible
```

**API Feature:**
```
- [ ] Endpoint accepts [parameters]
- [ ] Returns [expected response]
- [ ] HTTP status code: [200/201/etc]
- [ ] Response time < [X]ms
- [ ] Handles invalid input with [error]
- [ ] Authentication/authorization enforced
- [ ] API documentation updated
```

**Form Feature:**
```
- [ ] Form fields: [list fields]
- [ ] Required fields validated
- [ ] Validation messages shown
- [ ] Submit button disabled when invalid
- [ ] Success message after submission
- [ ] Form clears after success
- [ ] Error handling for server errors
```

**Data Processing:**
```
- [ ] Accepts [input format]
- [ ] Validates [criteria]
- [ ] Transforms data to [output format]
- [ ] Handles edge cases: [list]
- [ ] Performance: processes [X] records in [Y] time
- [ ] Error handling: [specific errors]
- [ ] Logs [events] for debugging
```

---

## Labels Quick Reference

Suggested label naming conventions:

```yaml
# Feature Areas
prompt-library
sharing-feature
custom-sites
analytics
settings

# Technical Areas
frontend
backend
api
database
ui-ux

# Types
enhancement
bug-fix
refactor
documentation
testing

# Cross-Cutting
performance
security
accessibility
i18n

# Status/Process
needs-design
needs-review
blocked
technical-debt
```

---

## Component Examples

Suggested component structure:

```yaml
# Code Areas
- Popup UI
- Side Panel UI
- Content Scripts
- Background Service
- Storage Layer
- API Integration

# Platform Integration
- Chrome Extension
- Firefox Extension (future)

# Feature Modules
- Prompt Management
- Sharing System
- Custom Sites
- Analytics
```

---

## How to Use These Templates in Jira

### Method 1: Copy-Paste
1. Create new issue in Jira
2. Copy template from this document
3. Paste into Description field
4. Switch between "Text" and "Visual" modes
5. Fill in the placeholders

### Method 2: Create Template in Jira
1. Go to Project Settings → Issue Templates
2. Click "Create Template"
3. Paste template content
4. Name it (e.g., "User Story Template")
5. Select when creating issues

### Method 3: Use Browser Extension
1. Install text expander (e.g., Text Blaze, Magical)
2. Create snippet with template
3. Type shortcut in Jira to expand

---

## Markdown Formatting Reference

Jira supports these markdown elements:

```markdown
# Heading 1
## Heading 2
### Heading 3

**Bold text**
*Italic text*
~~Strikethrough~~

- Bullet list
- Item 2

1. Numbered list
2. Item 2

- [ ] Checkbox
- [x] Checked checkbox

[Link text](URL)

> Blockquote

`Inline code`

```
Code block
```

| Table | Header |
|-------|--------|
| Cell  | Cell   |
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-12
**Purpose**: Ready-to-use templates for Jira user stories
**Related**: USER_STORY_BEST_PRACTICES.md
