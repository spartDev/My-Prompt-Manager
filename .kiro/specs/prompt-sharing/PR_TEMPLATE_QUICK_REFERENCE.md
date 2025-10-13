# Pull Request Template Quick Reference

## TL;DR - Key Takeaways

### The Golden Rules
1. **Keep it under 30 lines** - 90%+ completion rate
2. **Use checkboxes** - Makes completion tracking easy
3. **Include examples inline** - Reduces confusion
4. **Add visual evidence** - Screenshots/GIFs speed reviews by 40%
5. **Link issues** - JIRA/GitHub references are essential

---

## Essential Sections (In Order of Priority)

### Tier 1: Must-Have (Every PR)
```markdown
## Summary
## Type of Change (checkboxes)
## Testing
## Pre-Merge Checklist
```

### Tier 2: Strongly Recommended
```markdown
## Related Issues (JIRA/GitHub links)
## Implementation Details
## Breaking Changes Assessment
```

### Tier 3: Situational
```markdown
## Visual Changes (if UI changes)
## Security Considerations (if security-relevant)
## Performance Impact (if performance-critical)
## Migration Guide (if breaking changes)
```

---

## Markdown Cheat Sheet

### Code Blocks with Syntax Highlighting
```markdown
```typescript
const example: string = "Hello";
```
```

### Collapsible Sections
```markdown
<details>
<summary>Click to expand</summary>

Content here

</details>
```

### Tables
```markdown
| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |
```

### Task Lists (GitHub tracks completion)
```markdown
- [x] Completed item
- [ ] Pending item
```

### Alerts
```markdown
> **Note**
> This is informational

> **Warning**
> This requires attention

> **Important**
> Critical information
```

### Issue References
```markdown
Closes #42          - Auto-closes on merge
Fixes #38, #41      - Closes multiple
Related to #55      - Links without closing
```

### JIRA Links
```markdown
**JIRA:** [PROJ-123](https://company.atlassian.net/browse/PROJ-123)
```

---

## Screenshot Best Practices

### When to Include
- ✅ UI/UX changes
- ✅ Visual bug fixes
- ✅ New user-facing features
- ✅ CSS/styling changes
- ❌ Backend/API only changes
- ❌ Refactoring without visual changes

### Format: Before/After
```markdown
| Before | After |
|--------|-------|
| ![Before](url) | ![After](url) |
```

### GIF Best Practices
- **Duration:** 5-15 seconds
- **File Size:** < 10 MB
- **Resolution:** 1280x720 or smaller
- **Frame Rate:** 15-24 fps
- **Tools:** Recordit, LICEcap, Kap, ScreenToGif

### Upload to GitHub
1. Drag & drop image into PR description
2. GitHub auto-uploads to CDN
3. URL format: `https://user-images.githubusercontent.com/...`
4. **Never** use external services (Imgur, Dropbox)

---

## Security Checklist (Copy-Paste)

```markdown
## Security Considerations
- [ ] No security implications
- [ ] Input validation implemented
- [ ] Output encoding implemented
- [ ] Authentication/authorization reviewed
- [ ] No sensitive data exposed
- [ ] Dependencies scanned for vulnerabilities
```

---

## Breaking Changes Template (Copy-Paste)

```markdown
## Breaking Changes
**Does this introduce breaking changes?** ⚠️
- [ ] Yes - See details below
- [ ] No - Fully backward compatible

**If yes:**
- **What's Breaking:** [Description]
- **Who's Affected:** [Services/Users]
- **Migration Steps:**
  1. Step 1
  2. Step 2
```

---

## Type of Change Checkboxes (Copy-Paste)

```markdown
## Type of Change
- [ ] 🆕 New feature (non-breaking change that adds functionality)
- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to change)
- [ ] 📝 Documentation update
- [ ] ♻️ Code refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] ✅ Test improvement
- [ ] 🔧 Configuration/build changes
```

---

## Pre-Merge Checklist (Copy-Paste)

```markdown
## Pre-Merge Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Code builds without errors
- [ ] All tests pass
- [ ] Lint checks pass
- [ ] No new warnings introduced
- [ ] Branch is up-to-date with base branch
- [ ] Commits are clean and well-described
```

---

## Real-World Examples by Complexity

### Minimalist (React Native Style)
```markdown
## Summary
## Changelog
## Test Plan
```
**Use when:** Mature projects, experienced contributors

### Balanced (Recommended)
```markdown
## Summary
## Related Issues
## Type of Change
## Implementation Details
## Testing
## Pre-Merge Checklist
```
**Use when:** Most professional projects

### Comprehensive (Enterprise)
Add to balanced template:
```markdown
## Breaking Changes Assessment
## Security Considerations
## Performance Impact
## Documentation
## Deployment Notes
## Rollback Plan
```
**Use when:** Large teams, strict governance, regulated industries

---

## Automation Ideas

### GitHub Actions: Validate PR Description
```yaml
name: PR Description Check
on:
  pull_request:
    types: [opened, edited]
jobs:
  check-description:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v6
        with:
          script: |
            const body = context.payload.pull_request.body || '';
            if (body.length < 50) {
              core.setFailed('PR description must be at least 50 characters');
            }
```

### Require Issue Link
```yaml
- name: Check for Issue Reference
  uses: actions/github-script@v6
  with:
    script: |
      const body = context.payload.pull_request.body || '';
      const hasIssue = /#\d+|[A-Z]+-\d+/.test(body);
      if (!hasIssue) {
        core.setFailed('PR must reference an issue');
      }
```

---

## Multiple Templates Setup

### Directory Structure
```
.github/
└── PULL_REQUEST_TEMPLATE/
    ├── feature.md
    ├── bugfix.md
    ├── documentation.md
    └── hotfix.md
```

### Usage
```
# Use specific template
https://github.com/owner/repo/compare/main...branch?template=feature.md
```

### When to Use Multiple Templates
- ✅ Large teams (10+ contributors)
- ✅ Diverse change types (features, bugs, docs)
- ✅ Complex review requirements
- ❌ Small teams (< 10 people)
- ❌ Simple projects with uniform changes

---

## Common Mistakes to Avoid

### Don't
- ❌ Make templates > 50 lines (low completion rates)
- ❌ Use external image hosting (links break)
- ❌ Skip issue references
- ❌ Ignore security considerations
- ❌ Leave template comments in final PR
- ❌ Make PRs > 400 lines without good reason

### Do
- ✅ Keep templates scannable
- ✅ Use native GitHub image upload
- ✅ Link to JIRA/GitHub issues
- ✅ Include security checklist
- ✅ Remove instructional comments before submitting
- ✅ Split large changes into multiple PRs

---

## Project-Specific Notes (Claude UI Chrome Extension)

### Your Test Commands
```bash
npm test              # Run all tests (MANDATORY before PR)
npm run lint          # Run linting (MANDATORY before PR)
npm run test:coverage # Check coverage
npm run build         # Verify production build
```

### Your Checklist Must Include
- [ ] `npm test` passes (no exceptions)
- [ ] `npm run lint` passes (no exceptions)
- [ ] Manual testing in Chrome extension popup
- [ ] Content script tested on AI platforms (if applicable)
- [ ] Dark mode tested (if UI changes)

### Your Specific Sections
Add these for your project:
```markdown
## Chrome Extension Testing
- [ ] Tested in popup
- [ ] Tested in side panel
- [ ] Tested content script on [Claude/ChatGPT/Perplexity]
- [ ] Storage operations tested
- [ ] Browser compatibility verified (Chrome 114+)

## UI/UX Testing (if applicable)
- [ ] Dark mode tested
- [ ] Responsive design verified
- [ ] Keyboard navigation works
- [ ] Focus states correct
- [ ] Animations smooth
```

---

## Sources by Authority Level

### ⭐⭐⭐ Highest Authority (Official)
- GitHub Official Documentation
- Microsoft Engineering Playbook
- Chrome Extension Developer Docs

### ⭐⭐ High Authority (Major OSS)
- React Native (Facebook)
- Ant Design (Alibaba)
- Vue.js
- TypeScript (Microsoft)
- dbt Labs

### ⭐ Moderate Authority (Community)
- DEV Community best practices
- Engineering blogs (Medium, company blogs)
- GitHub template collections

---

## Quick Decision Tree

```
Start Here
│
├─ Is this a simple project? (< 10 contributors)
│  └─ YES → Use 3-section template (What/Why/Testing)
│  └─ NO ↓
│
├─ Are there diverse change types? (features, bugs, docs, etc.)
│  └─ YES → Use multiple templates (feature.md, bugfix.md, etc.)
│  └─ NO ↓
│
├─ Is this enterprise/regulated?
│  └─ YES → Use comprehensive template (add security, compliance)
│  └─ NO ↓
│
└─ Use balanced template (Summary, Issues, Type, Testing, Checklist)
```

---

## Implementation Checklist

### Phase 1: Create Template
- [ ] Copy template to `.github/PULL_REQUEST_TEMPLATE.md`
- [ ] Customize sections for your project
- [ ] Add project-specific checklist items
- [ ] Test with a sample PR

### Phase 2: Team Onboarding
- [ ] Document template usage in CONTRIBUTING.md
- [ ] Share examples of good PRs
- [ ] Conduct team training session
- [ ] Designate template owner for updates

### Phase 3: Automation (Optional)
- [ ] Add GitHub Action to validate PR description
- [ ] Add Action to check for issue references
- [ ] Add Action to verify checklist completion
- [ ] Set up Danger.js for advanced checks

### Phase 4: Iterate
- [ ] Collect feedback after 2 weeks
- [ ] Measure completion rates
- [ ] Adjust template based on feedback
- [ ] Review and update quarterly

---

## Need Help?

**Full Research Report:** See `PR_TEMPLATE_BEST_PRACTICES.md`
**Your Template:** See `.github/PULL_REQUEST_TEMPLATE.md`

**Quick Questions:**
- Too long? Remove optional sections
- Too short? Add security or performance sections
- Not working? Check file path (`.github/PULL_REQUEST_TEMPLATE.md`)
- Need multiple? Create `.github/PULL_REQUEST_TEMPLATE/` directory
