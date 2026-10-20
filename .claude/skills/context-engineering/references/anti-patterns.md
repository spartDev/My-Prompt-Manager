<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Context Engineering Anti-Patterns

Common failure modes when setting up rules files for coding agents, each paired with a concrete fix. Scan this list when agent output degrades — most drift traces back to one of these.

## 1. Kitchen-sink CLAUDE.md

### Symptom

A 600–1,200 line `CLAUDE.md` that tries to be simultaneously an onboarding doc, a style guide, a runbook, and a FAQ. Agents start ignoring the tail of the file (the last few hundred lines get deprioritized against task-specific context).

### Example

```markdown
# CLAUDE.md

## Introduction

Welcome! This repo has a long history...
[800 more lines covering every edge case, tool, historical decision]

## Payment processing edge cases

[200 lines describing 14 specific scenarios and how to handle each]

## Deprecated APIs we still support

[150 lines listing v1 endpoints]
```

### Fix

- Keep `CLAUDE.md` under **200 lines**.
- Move depth into skills: payment processing → dedicated skill, deprecated-APIs → dedicated skill, or ADR.
- Reference the skill by name, not by pasted content:

```markdown
## Payment processing

See the `payment-processing` skill for the full set of edge cases and the
required validation sequence.
```

- If the guidance already lives in a `@sanofi-accelerator/ai-standards` skill, do not re-describe it locally. A one-line reference is enough for the runtime to auto-invoke the skill when its triggers match.

---

## 2. Stale context files

### Symptom

Agents suggest using `legacyAuthService.ts` (deleted 6 months ago), or reference `packages/ui-kit/` (renamed to `packages/elements/`). The rules file has not been touched since initial setup.

### Example

```markdown
## Conventions

- Use the `legacyAuthService.ts` helper for login flows
- UI components live in `packages/ui-kit/`
- Run `npm run old-build` before committing
```

Meanwhile the codebase has moved on and none of those paths or commands exist.

### Fix

- Review `CLAUDE.md` quarterly, on the same cadence as the `dependency-audit` skill.
- When renaming a module or deleting a helper, grep the rules file as part of the change:

```bash
grep -n "legacyAuthService\|ui-kit\|old-build" CLAUDE.md
```

- Add a trailing line to `CLAUDE.md` that records the last review date. If it is more than a quarter old, schedule a refresh.

---

## 3. Duplicated content across runtime files

### Symptom

`CLAUDE.md` and `AGENTS.md` both contain the same conventions. Over time they drift — someone updates the commands in `CLAUDE.md` but forgets `AGENTS.md`, and the Codex users silently follow stale rules.

### Example

```
$ diff CLAUDE.md AGENTS.md
23c23
< - Test: `pnpm test --run`
---
> - Test: `npm test`
```

### Fix

Pick one canonical file and symlink the rest:

```bash
ln -sf CLAUDE.md AGENTS.md
git add CLAUDE.md AGENTS.md
```

If a runtime needs a genuinely different instruction (it almost never does), put the divergence in that agent's own config file, not in the top-level runtime file.

---

## 4. Implicit knowledge

### Symptom

The agent does not follow a convention that every human on the team takes for granted — because no one wrote it down. "The agent should have known we always use the `Result<T, E>` type for service responses."

### Fix

Rules files are contracts. **If it is not written, it does not exist.** When you catch the agent violating a convention, add the rule immediately to the "Conventions" section, with one existing file as an example. Ten minutes of writing saves hours of corrections.

---

## 5. Inlined skill guidance

### Symptom

`CLAUDE.md` contains an entire 400-line section titled "How to write ADRs" — which is a near-verbatim paste of the `adr-writing` skill. This cost is paid on every task, not just ADR tasks.

### Fix

Replace the inlined content with a reference:

```markdown
## Architecture decisions

Use the `adr-writing` skill when writing or reviewing ADRs. ADRs live in `docs/adr/`.
```

The skill's description tells the runtime to auto-invoke when the user mentions ADRs. The body loads at that moment — not on every task. Token cost drops from ~2,000 to ~15 per session.

---

## 6. Context starvation

### Symptom

Agents invent APIs, ignore conventions, hallucinate file paths, re-implement utilities that already exist. No rules file exists, or it is a stub.

### Fix

Start from `references/claude-md-template.md`. Fill in tech stack, commands, conventions, and boundaries. That alone prevents the majority of hallucinated-tooling failures.

---

## 7. Kitchen-sink spec pasting

### Symptom

At session start, the user pastes a 5,000-word spec and a 2,000-line architecture doc. Agent loses focus, misses the three sentences that actually apply to the current task.

### Fix

Load the relevant spec **section**, not the whole doc. If the task is adding email validation, paste the validation section or point the agent at `docs/adr/ADR-012-input-validation.md` — not the entire architecture corpus.

---

## 8. Silent confusion

### Symptom

Agent encounters ambiguity (spec says REST but code uses GraphQL; two conflicting conventions in the rules file) and silently picks one. Half the time it picks wrong, and the mistake compounds as more code is built on it.

### Fix

Teach the agent — in the rules file — to surface confusion rather than guess:

```markdown
## When context conflicts

When this file conflicts with the codebase, or when a requirement is missing,
STOP and surface the ambiguity. Do not silently pick an interpretation. See
the `context-engineering` skill's "Confusion Management" section for the
expected format.
```

---

## Quick diagnostic

When agent output feels off, run this in order:

1. `wc -l CLAUDE.md` — is it over 200? → Anti-pattern 1.
2. `grep -c "$(ls src/)" CLAUDE.md` — do referenced paths still exist? → Anti-pattern 2.
3. `diff CLAUDE.md AGENTS.md` (if both exist) — are they identical? → Anti-pattern 3.
4. Does the rules file name the tech stack, commands, conventions, boundaries? → Anti-pattern 6 if not.
5. Is there a 300+ line section that looks like a copy of a standard skill? → Anti-pattern 5.

Address whichever hits first; re-run the agent on a fresh session to confirm the fix.
