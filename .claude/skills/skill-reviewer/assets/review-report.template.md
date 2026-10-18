<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

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
{fixed_rows}

### Needs Attention ({attention_count})

| # | Dim | Check | Issue | Suggestion |
|---|-----|-------|-------|------------|
{attention_rows}

### Passed

Dimensions fully passing: {passing_dimensions}

### Summary

| Metric | Count |
|--------|-------|
| Total checks | {total_checks} |
| Auto-fixed | {fixed_count} |
| Need attention | {attention_count} |
| Dimensions clean | {passed_count} / 8 |
