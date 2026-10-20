<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Skill Best Practices Reference

Condensed from Anthropic's official "Complete Guide to Building Skills for Claude."

## File Structure

```
my-skill/
├── SKILL.md          # Required — exact casing, never skill.md or Skill.md
├── references/       # Optional — docs loaded on demand (progressive disclosure)
├── scripts/          # Optional — executable code
└── assets/           # Optional — templates, fonts, icons
```

Forbidden: `README.md` inside the skill folder.

## Naming Rules

| Rule | Detail |
|------|--------|
| Folder | kebab-case only, no spaces, no capitals |
| `name` field | kebab-case, must match folder name exactly |
| Forbidden prefixes | `claude-*`, `anthropic-*` (reserved) |

## Description — The Most Important Part

### Formula

```
description: [What it does] + [Key capabilities]
when_to_use:  [When to use it]   ← preferred; separates trigger conditions
```

Or, when `when_to_use` is not used:

```
description: [What it does] + [When to use it] + [Key capabilities]
```

### Requirements

| Requirement | Limit |
|-------------|-------|
| Max length (`description` alone) | 1024 characters |
| Combined `description` + `when_to_use` | 1,536 characters (truncated in skill listing) |
| Must include | What + When (both required; When may be in `when_to_use`) |
| Trigger phrases | Specific phrases users would say |
| Negative triggers | "Do NOT use for…" with redirect |
| File types | Mention if skill handles specific formats |
| XML brackets | Forbidden (< or >) |

### Good vs Bad

**Good:**
```
Comprehensive PDF manipulation toolkit for extracting text and tables,
creating new PDFs, merging/splitting documents, and handling forms.
When Claude needs to fill in a PDF form or programmatically process,
generate, or analyze PDF documents at scale.
```

**Bad:**
```
A skill for working with documents.
```

Why bad: Too generic — won't trigger, no file types, no specific use cases.

## Frontmatter

```yaml
---
name: my-skill                  # Required: kebab-case, matches folder
description: >                  # Required: max 1024 chars, no XML brackets
  [What] + [Capabilities]
when_to_use: >                  # Optional: trigger conditions; appended to description
  Use when the user says "..."  # in skill listing; counts toward 1,536-char combined cap
allowed-tools: Read Bash        # Optional: space-separated; scoped form: Bash(npm *)
disable-model-invocation: true  # Optional: prevent Claude from auto-invoking
user-invocable: false           # Optional: hide from / menu (Claude-only invocation)
argument-hint: "[issue-number]" # Optional: shown in autocomplete
---
```

`when_to_use` separates trigger conditions from the main `description`. When present, D2 "When present" is satisfied by this field instead of by content inside `description`. The combined length of `description` + `when_to_use` is capped at 1,536 characters in the skill listing.

Security: No XML angle brackets. No code execution in YAML values.

## Instructions Body

| Guideline | Detail |
|-----------|--------|
| Word limit | Under 5,000 words in SKILL.md |
| Voice | Specific, actionable, imperative |
| Error handling | Required — what to do on failure |
| Resource references | Clear paths to bundled files |
| Progressive disclosure | SKILL.md focused; details in references/ |
| Examples | Include concrete examples where possible |

## Progressive Disclosure (3 Levels)

| Level | Content | When Loaded |
|-------|---------|-------------|
| 1 | YAML frontmatter | Always (skill matching) |
| 2 | SKILL.md body | When skill is triggered |
| 3 | references/, assets/, scripts/ | On demand during execution |

Keep SKILL.md lean. Move large blocks to references/.

## Trigger Quality

### Symptoms & Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Skill never triggers | Description too generic | Add specific trigger phrases and file types |
| Skill triggers too often | Description too broad | Add negative triggers, narrow scope |
| Wrong skill triggers | Overlapping descriptions | Differentiate with explicit "Do NOT use for" |

### Trigger Testing Checklist

- [ ] Test 3+ trigger phrases — skill activates
- [ ] Test 2+ negative triggers — skill does NOT activate
- [ ] Test adjacent skills — correct one activates

## Pre-Upload Checklist

### Structure
- [ ] Folder is kebab-case
- [ ] `SKILL.md` exact casing
- [ ] No `README.md` in skill folder
- [ ] `name` field matches folder name
- [ ] No `claude-*` or `anthropic-*` prefix

### Description
- [ ] Has What + When + Capabilities
- [ ] Under 1024 characters
- [ ] No XML angle brackets
- [ ] Trigger phrases included
- [ ] Negative triggers included
- [ ] File types mentioned (if applicable)

### Body
- [ ] Under 5,000 words
- [ ] Error handling guidance present
- [ ] Examples included
- [ ] Resources clearly referenced
- [ ] Large content in references/ (progressive disclosure)

### Functional
- [ ] Trigger phrases activate the skill
- [ ] Negative triggers do NOT activate the skill
- [ ] Tool integrations work
- [ ] Edge cases handled
