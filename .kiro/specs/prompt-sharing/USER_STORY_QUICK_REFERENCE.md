# User Story Quick Reference Guide

## 1-Page Cheat Sheet for Creating Jira User Stories

---

## ✅ Good User Story Checklist

```
□ Title: 5-10 words, descriptive (not full "As a..." format)
□ Story: "As a [user], I want [action], so that [benefit]"
□ Context: Why is this needed?
□ Acceptance Criteria: 3-8 clear, testable criteria
□ Size: 1-5 story points, fits in 1 sprint
□ INVEST: Independent, Negotiable, Valuable, Estimable, Small, Testable
□ Design: Mockups linked (if UI work)
□ Technical Notes: Dependencies & constraints listed
□ Epic: Linked to parent epic
□ Priority: Set appropriately
```

---

## 📝 Basic Template (30 Seconds)

```markdown
### User Story
As a [user type], I want [action], so that [benefit].

### Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]
```

---

## 🎯 INVEST Criteria (Must Pass All)

| Letter | Meaning | Quick Check |
|--------|---------|-------------|
| **I** | Independent | Can build without other stories? |
| **N** | Negotiable | Team can decide how to implement? |
| **V** | Valuable | Solves real user problem? |
| **E** | Estimable | Team can estimate effort? |
| **S** | Small | Fits in 1 sprint (1-3 days ideal)? |
| **T** | Testable | Has clear acceptance criteria? |

---

## 📏 Story Sizing

| Points | Time | When to Use |
|--------|------|-------------|
| 1 | 1-2 hours | Trivial change |
| 2 | 2-4 hours | Simple feature |
| 3 | 1 day | Standard story |
| 5 | 2-3 days | Complex feature |
| 8 | 3-5 days | Very complex - consider splitting |
| 13+ | 1+ weeks | TOO BIG - must split |

**Rule of Thumb:** If >8 points or >1 sprint, split it!

---

## ✂️ Story Splitting (SPIDR Method)

When story is too large, split by:

| Method | Example |
|--------|---------|
| **S**pike | Research → Implementation |
| **P**aths | Happy path → Edge cases |
| **I**nterfaces | Desktop → Mobile |
| **D**ata | Simple data → Complex data |
| **R**ules | Basic rules → Advanced rules |

**Other ways:**
- By acceptance criteria (1 story per criterion)
- By operation (Create → Read → Update → Delete)
- By user role (Regular user → Admin)

---

## 📋 Acceptance Criteria: 2 Formats

### Format 1: Checklist (Simple)
```
- [ ] Button visible when prompt selected
- [ ] Clicking button generates URL
- [ ] URL copied to clipboard
- [ ] Success message shown
```

### Format 2: Given/When/Then (BDD)
```gherkin
Scenario: Share prompt successfully
Given I have a prompt selected
When I click "Share" button
Then a URL is generated
And the URL is copied to clipboard
And I see "Link copied!" message
```

**Use Given/When/Then when:**
- Automated testing planned
- Complex user interactions
- Multiple scenarios needed

**Use Checklist when:**
- Manual testing
- Simple pass/fail checks
- Quick to write/read

---

## 🚫 Top 10 Mistakes to Avoid

| ❌ Mistake | ✅ Fix |
|-----------|-------|
| Stories too large (>8 points) | Split into smaller stories |
| Technical slicing (API story, UI story, DB story) | Vertical slicing (working feature) |
| No acceptance criteria | Add 3-8 clear, testable criteria |
| Missing value ("so that" clause) | Always explain user benefit |
| Technical jargon in story | Use plain language |
| No context/background | Explain why feature needed |
| Over-detailed upfront | Keep flexible, discuss in sprint |
| Title is full sentence | Use 5-10 word summary |
| Skipping Definition of Done | Team agrees on quality standards |
| Working alone on stories | Collaborate in refinement |

---

## 🏷️ Essential Jira Fields

| Field | What to Put | Example |
|-------|-------------|---------|
| **Summary** | Short title (5-10 words) | "Share Prompt via URL" |
| **Description** | Full story + criteria | See templates |
| **Issue Type** | Story, Bug, Task, Epic | Story |
| **Priority** | Highest → Lowest | High |
| **Story Points** | 1, 2, 3, 5, 8, 13 | 5 |
| **Epic Link** | Parent epic | "Prompt Sharing" |
| **Sprint** | Which sprint | Sprint 23 |
| **Labels** | Tags (lowercase-with-hyphens) | sharing-feature |
| **Components** | Code area | Content Scripts |

---

## 🔗 Story Relationships

```
Epic: Prompt Sharing Feature (3+ sprints)
  ├── Story: Share prompt via URL (5 points)
  ├── Story: Import shared prompt (5 points)
  │     ├── Sub-task: Decode URL parameter
  │     └── Sub-task: Validate imported data
  └── Story: Share analytics (3 points)
```

**Link Types:**
- **Epic Link**: Groups related stories
- **Blocks**: Story A must finish before Story B
- **Relates to**: Stories are connected

---

## 📖 Definition of Ready vs Done

### Definition of Ready (Before Sprint)
```
□ Story format correct
□ INVEST criteria met
□ Acceptance criteria defined
□ Design attached (if UI)
□ Team can estimate
□ No blockers
```

### Definition of Done (After Sprint)
```
□ Code written & reviewed
□ All acceptance criteria met
□ Tests written & passing
□ Tested in all browsers
□ Merged to main
□ Documentation updated
```

---

## 🎨 Title Examples

### ✅ Good Titles
```
✓ Share Prompt via Encoded URL
✓ Import Shared Prompt
✓ Track Sharing Analytics
✓ Handle Invalid Share URLs
```

### ❌ Bad Titles
```
✗ As a user I want to share prompts so that I can collaborate
✗ Sharing Feature
✗ Implement Sharing
✗ User Story 123
```

---

## 🔍 Priority Guidelines

| Priority | When to Use |
|----------|-------------|
| **Highest** | Security bugs, blockers, legal requirements |
| **High** | Core features, significant bugs |
| **Medium** | Standard features, normal work |
| **Low** | Nice-to-have, UI polish |
| **Lowest** | Future ideas, exploratory |

**Not everything can be "Highest"!**

---

## 🏃 Quick Story Creation (2 Minutes)

1. **Title** (10 sec): "Share Prompt via URL"
2. **Story** (20 sec): "As a user, I want to share prompts via URL, so that I can collaborate with colleagues."
3. **Context** (30 sec): "Users need to share prompts easily without copy/paste."
4. **Acceptance Criteria** (45 sec):
   - [ ] Share button visible
   - [ ] Generates URL
   - [ ] Copies to clipboard
   - [ ] Success message shown
5. **Fields** (15 sec): Points: 5, Priority: High, Epic: Prompt Sharing

**Total: 2 minutes!**

---

## 🔧 Jira Markdown Cheat Sheet

```markdown
### Heading
**Bold** *Italic*
- Bullet list
1. Numbered list
- [ ] Checkbox
[Link](URL)
`Code`
```

---

## 📚 Resources

### Documents
- **USER_STORY_BEST_PRACTICES.md**: Comprehensive 60-page guide
- **JIRA_TEMPLATES.md**: Copy-paste templates for all story types
- **This guide**: Quick 1-page reference

### External Resources
- [Atlassian User Stories Guide](https://www.atlassian.com/agile/project-management/user-stories)
- [Mike Cohn's User Stories](https://www.mountaingoatsoftware.com/agile/user-stories)
- [INVEST Criteria](https://www.agilealliance.org/glossary/invest/)

---

## 💡 Pro Tips

1. **Write stories together** - Team collaboration beats solo BA work
2. **Keep stories small** - 1-3 days is the sweet spot
3. **Focus on value** - Always explain "so that [benefit]"
4. **Split vertically** - Each story should be working software
5. **Refine regularly** - Backlog grooming is essential
6. **Use templates** - Don't start from blank page
7. **Test early** - Write acceptance criteria first
8. **Link everything** - Connect to epics, designs, docs
9. **Keep it simple** - Plain language, no jargon
10. **Iterate** - Stories improve with practice

---

## 🎯 For Your Prompt Sharing Feature

### Example Epic
**Epic**: Prompt Sharing & Collaboration
**Goal**: Enable users to share and import prompts seamlessly

### Example Stories (Sprint 1)
1. **Share Prompt via URL** (5 pts) - Generate encoded URL
2. **Import Shared Prompt** (5 pts) - Import from URL
3. **Copy to Clipboard** (2 pts) - Auto-copy share link

### Example Stories (Sprint 2)
4. **Invalid URL Handling** (3 pts) - Error messages
5. **Sharing Analytics** (8 pts) - Track usage metrics

---

## 📞 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Story too big | Use SPIDR to split |
| Can't estimate | More discussion needed, might need spike |
| No acceptance criteria | Ask "How do we know it's done?" |
| Not valuable | Ask "What user problem does this solve?" |
| Blocked by another story | Re-order backlog or mark dependency |
| Too technical | Rewrite from user perspective |

---

**Keep This Handy**: Print this page and keep it visible during backlog refinement!

**Last Updated**: 2025-10-12
