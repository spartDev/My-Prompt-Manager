---
name: skill-reviewer
description: >
  Review a skill for quality, completeness, and convention adherence.
  Use when: (1) authoring or editing a SKILL.md,
  (2) onboarding a new skill into standards/skills/,
  (3) auditing existing skills for drift.
  Do NOT use for cross-skill coherence checks.
allowed-tools: Read Grep Glob Bash Edit
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

## Purpose

Review a single skill directory (`SKILL.md` + `manifest.yaml` + supporting directories) across 8 quality dimensions aligned with Anthropic's official skill-authoring guide, fix what is fixable, and report the rest.

## Phase 1: Scope Detection

**If `$ARGUMENTS` provided:** treat each token as a skill directory name under `standards/skills/`. Glob `standards/skills/{token}/SKILL.md` per token.

**If `$ARGUMENTS` empty:** auto-detect from git:
```bash
git diff --name-only HEAD
git diff --name-only --cached
git ls-files --others --exclude-standard
```
Extract skill directories from changed paths matching `standards/skills/*/`. If no skill files changed, abort with: `No skill changes detected. Pass a skill name explicitly.`

For each skill in scope, read:
1. `SKILL.md`
2. `manifest.yaml`
3. `ls scripts/` (if present)
4. `ls references/` (if present)
5. `ls assets/` (if present)

## Phase 2: Eight-Dimension Review

### D1: Naming & File Structure

| Check | Rule |
|-------|------|
| Folder name kebab-case | Lowercase, hyphens only — no spaces, underscores, or capitals |
| `SKILL.md` exact casing | File must be named `SKILL.md` — not `skill.md`, `Skill.md`, or `README.md` |
| No README.md | A skill folder must NOT contain a README.md — all content goes in SKILL.md |
| No forbidden prefix | Folder name must NOT start with `claude-` or `anthropic-` (reserved by Anthropic) |
| `name` matches folder | Frontmatter `name` field must equal the directory name exactly |
| Valid subdirectories | Only `scripts/`, `references/`, `assets/` are allowed subdirectories |

### D2: Description Quality

This is the **most important dimension**. The description drives skill triggering and selection.

| Check | Rule |
|-------|------|
| Formula coverage | Description follows `[What it does] + [When to use it] + [Key capabilities]` |
| "What" present | First clause states what the skill does |
| "When" present | Explicit trigger conditions listed in `description` (numbered or comma-separated), OR present in the `when_to_use` frontmatter field |
| Trigger phrases | Description includes specific phrases a user would say to invoke this skill |
| Negative triggers | "Do NOT use for..." clause present with redirect to correct skill |
| File types mentioned | If the skill handles specific file formats, file extensions or globs (`.tf`, `.ts`, `*.yaml`) are named — framework names alone are not sufficient |
| Output described | If the skill produces a deliverable (report, file, PR comment), the description states what it produces |
| Max 1024 characters | Total description length must not exceed 1024 characters |
| No XML angle brackets | Description must not contain `<` or `>` characters |
| Not too generic | Description avoids vague terms like "helps with things" or "general utility" |
| Not too broad | Description does not claim applicability to unrelated domains |

### D3: Frontmatter Integrity

| Check | Rule |
|-------|------|
| `---` delimiters | File starts with `---` and frontmatter ends with `---` |
| `name` required | Must be present and non-empty |
| `description` required | Must be present and non-empty |
| `name` is kebab-case | Lowercase letters and hyphens only |
| No XML angle brackets | No `<` or `>` anywhere in frontmatter values |
| No code execution | No shell commands, backtick expressions, or `$(...)` in YAML values |
| `allowed-tools` valid | If present, value must be a space-separated string (e.g. `Read Bash Glob`) or a YAML list; commas are not a supported separator |
| `when_to_use` optional | If present, appended to `description` in the skill listing; trigger phrases here satisfy the D2 "When present" check; counts toward the combined 1,536-character cap |
| `disable-model-invocation` optional | If present, must be a boolean; `true` prevents Claude from auto-invoking the skill (manual `/name` invocation only) |
| `user-invocable` optional | If present, must be a boolean; `false` hides the skill from the `/` menu so only Claude can invoke it |
| `argument-hint` optional | If present, a string hint shown in autocomplete for the expected arguments (e.g. `[issue-number]`) |

### D4: Body Structure

| Check | Rule |
|-------|------|
| Heading hierarchy | No skipped levels (e.g., `##` followed by `####` with no `###`) |
| Tables for structured data | Comparisons, mappings, and rule sets use markdown tables |
| Consistent list style | All lists within a section use the same marker (`-`, `*`, or numbered) |
| No empty sections | Every heading has content below it before the next heading |
| Fenced code blocks | All code uses triple-backtick fencing with a language tag |
| Actionable instructions | Imperative verbs: "Use", "Read", "Always", "Never" — not passive voice |
| No ambiguous quantifiers | Prefer "always", "never", "exactly N" over "some", "might", "possibly" |
| Word count under 5,000 | Total SKILL.md body (excluding frontmatter) must not exceed 5,000 words |

### D5: Completeness

| Check | Rule |
|-------|------|
| `manifest.yaml` exists | Every skill directory must contain one |
| Referenced assets exist | Every `assets/` path in SKILL.md resolves to a file on disk |
| Referenced references exist | Every `references/` path in SKILL.md resolves to a file on disk |
| Referenced scripts exist | Every `scripts/` path in SKILL.md resolves to a file on disk |
| No orphan files | Every file under `assets/`, `references/`, `scripts/` is mentioned in SKILL.md or manifest.yaml |
| Template file naming | Template files follow `*.template.md` or `*.template.*` convention |
| Template file location | Template files (`*.template.*`) must live in `assets/`, not `references/` — `references/` is for documentation loaded on demand, `assets/` is for output templates |
| Examples included | At least one concrete example or usage scenario is present |
| Error handling guidance | If the skill involves operations, failure behavior is specified |

### D6: Manifest Consistency

| Check | Rule |
|-------|------|
| `name` matches | `manifest.yaml` name == SKILL.md frontmatter name == directory name |
| `description` aligned | Manifest description conveys the same meaning as SKILL.md description |
| `version` present | Semver format (e.g., `1.0.0`) |
| `level` present | One of: `essential`, `recommended`, `advanced`, `expert`, `paranoid` |
| `tags` present | Non-empty array of lowercase kebab-case tags |
| `compatibility` present | Must have a boolean `claude-code` key (`cursor` is optional and legacy) |
| `requires` valid | If present, `mcps` and `config` are arrays of known identifiers |

### D7: Cross-References

| Check | Rule |
|-------|------|
| "Use X instead" targets exist | Any skill name in "Do NOT use for...use Y instead" must be a real skill directory |
| Template paths valid | Every `assets/...` path in SKILL.md resolves to a file |
| Config paths valid | Any `.claude/config/...` references resolve to real files |
| Reference paths valid | Every `references/...` path in SKILL.md resolves to a file |
| No self-references | Skill does not redirect to itself in "Do NOT use" clauses |
| `references/` files linked | Every file in `references/` is referenced from SKILL.md with a clear read trigger |

### D8: Context Economy & Progressive Disclosure

| Check | Rule |
|-------|------|
| No verbose inline blocks | Large examples (>30 lines) belong in `assets/` or `references/`, not inline |
| Tables over prose | Structured data in tables, not paragraphs |
| No duplicated content | Content in an asset or reference file is not repeated verbatim in SKILL.md |
| SKILL.md is focused | Body stays under 5,000 words; move supplementary detail to `references/` |
| Conditional reads | Large reference material is in separate files with "read when needed" guidance |
| Frontmatter description concise | Core description (before "Use when") is under 200 characters |

## Phase 3: Fix

For each finding:

- **Auto-fixable** (missing manifest field, wrong name casing, broken asset path, empty section, README.md rename, XML brackets in description, template file in wrong directory) — fix via Edit immediately.
- **Manual review needed** (description too generic, missing negative triggers, missing output description, missing file extensions, subjective clarity issues, orphan files of unknown purpose) — list in report with a specific suggestion.

### Fix Priority

1. **D1 / D3 fixes first** — structural and frontmatter issues block further validation.
2. **D2 fixes next** — description quality drives trigger accuracy.
3. **D5 / D6 / D7 fixes** — completeness and consistency.
4. **D4 / D8 last** — body polish and economy.

## Phase 4: Report

Use template `assets/review-report.template.md` for output format.

```
## Skill Review: {skill_name}

**Scope:** `standards/skills/{skill_name}/`
**Files reviewed:** SKILL.md, manifest.yaml, {asset_count} assets, {ref_count} references
**Date:** {date}

### Trigger & Description Health

| Metric | Value |
|--------|-------|
| Description length | {desc_length} / 1024 chars |
| Trigger phrases found | {trigger_count} |
| Negative triggers found | {negative_trigger_count} |
| Formula coverage | {formula_coverage} (What / When / Capabilities) |

### Auto-Fixed ({fixed_count})

| # | Dim | Check | Issue | Fix Applied |
|---|-----|-------|-------|-------------|

### Needs Attention ({attention_count})

| # | Dim | Check | Issue | Suggestion |
|---|-----|-------|-------|------------|

### Passed

Dimensions fully passing: {passing_dimensions}

### Summary

| Metric | Count |
|--------|-------|
| Total checks | {total_checks} |
| Auto-fixed | {fixed_count} |
| Need attention | {attention_count} |
| Dimensions clean | {passed_count} / 8 |
```

If zero findings: `All 8 dimensions clean. No issues found.`

## Rules

- Read ALL files in the skill directory before reporting
- Fix errors immediately — do not defer fixable issues
- Follow the fix priority order: D1/D3 then D2 then D5/D6/D7 then D4/D8
- Do NOT update versions or dates unless explicitly requested
- Do NOT modify template content in assets — only fix references and metadata
- One skill at a time — scope to a single skill directory

## Reference

For the full official checklist and rationale behind each dimension, see `references/best-practices.md`.
