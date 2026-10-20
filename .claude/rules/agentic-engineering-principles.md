---
paths:
  - "**/*.{ts,tsx,js,jsx,mjs,cjs,py,java,go,rs,cs,cpp,c,h,sh,bash,zsh,tf,hcl,sq\
    l,rb,php,swift,kt}"
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Agentic Engineering Principles

Behavioral floor for AI coding agents (Claude Code, Cursor, Codex, Copilot, and any successor). These four principles directly address the failure modes Andrej Karpathy catalogued in his January 2025 observations on LLM coding pitfalls.

**Tradeoff.** These guidelines bias toward caution over speed. For trivial tasks (typo fixes, obvious one-liners) use judgment — not every change needs full rigor. The point is to reduce costly mistakes on non-trivial work.

Adapted from [`forrestchang/andrej-karpathy-skills`](https://github.com/forrestchang/andrej-karpathy-skills) (MIT, per project README), itself distilled from [Andrej Karpathy's January 2025 tweet](https://twitter.com/karpathy/status/1883941452738355376).

---

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — do not pick silently.
- If a simpler approach exists, say so.
- If something is unclear, stop. Name what's confusing.
- When existing context conflicts (spec vs. existing code), surface the conflict and the options — do not resolve it silently. The `context-engineering` skill covers this under "Confusion Management" if installed.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If 200 lines could be 50, rewrite it.

The test: would a senior engineer call this overcomplicated? If yes, simplify. The "overcomplicated" version usually isn't wrong — it just adds complexity before it is needed.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- **Never edit files managed by `@sanofi-accelerator/ai-standards`** — they carry a `⚠️ MANAGED BY` banner and appear in `.ai-standards.lock.yaml` under `file_hashes`. Local edits will be overwritten on the next sync. To change managed content, open a PR against the standards package, not the consuming repo.
- When your changes create orphans, remove imports/variables/functions that **your changes** made unused. Leave pre-existing dead code alone unless asked.

The test: every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform imperative tasks into verifiable goals:

| Instead of...    | Transform to...                                       |
| ---------------- | ----------------------------------------------------- |
| "Add validation" | "Write tests for invalid inputs, then make them pass" |
| "Fix the bug"    | "Write a test that reproduces it, then make it pass"  |
| "Refactor X"     | "Ensure tests pass before and after"                  |

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let the agent loop independently. Weak criteria ("make it work") require constant clarification. For the test-first variant of this loop, follow the `tdd` skill if installed.

---

## How to know it's working

You should see:

- Fewer unnecessary changes in diffs — only requested changes appear.
- Clarifying questions arrive **before** implementation, not after mistakes.
- PRs are small and single-purpose, with no drive-by refactoring.
- Code is simple the first time, not after a rewrite.

If diffs are sprawling, refactors are unsolicited, or assumptions surface only after the code is written, the principles aren't landing — revisit the relevant section above before continuing.
