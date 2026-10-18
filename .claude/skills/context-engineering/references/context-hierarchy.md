<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Context Hierarchy — Sanofi Example

A concrete walkthrough of how context layers stack in a Sanofi repository that installs `@sanofi-accelerator/ai-standards`. The hierarchy runs from most persistent (loaded every task) to most transient (loaded per iteration).

## Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 1 — Runtime system prompt                                     │
│   Claude Code base prompt.                                          │
│   Not editable. Sets tone, tool-use patterns, safety defaults.       │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 2 — Repo rules files                                          │
│   CLAUDE.md (canonical), AGENTS.md (symlink).                       │
│   ≤200 lines. Names tech stack, commands, conventions, boundaries.  │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 3 — Standard skills (auto-loaded)                             │
│   @sanofi-accelerator/ai-standards skills: adr-writing,             │
│   release-process, tdd, iac-terraform, code-review, etc.            │
│   Descriptions only at session start; bodies load on trigger.       │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 4 — Spec & architecture docs                                  │
│   catalog-info.yaml, docs/adr/ADR-NNN-*.md, Confluence via MCP.     │
│   Loaded per feature, per task.                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 5 — Relevant source files                                     │
│   The files being edited, their tests, and one existing example    │
│   of the pattern being applied. Loaded per task.                    │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 6 — Error output / test results                               │
│   The specific failure line, not the whole log. Per iteration.      │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 7 — Conversation history                                      │
│   Accumulates. Compact or start fresh when it drifts.               │
└─────────────────────────────────────────────────────────────────────┘
```

## Sanofi-specific touch points

### catalog-info.yaml (Layer 4)

Backstage catalog manifest at the repo root. Tells the agent:

- Component name and ownership (which team owns this)
- Tier (critical / supporting / experimental) — influences risk tolerance
- Tags (language, framework, domain) — influences which skills are most relevant
- Lifecycle (production, experimental, deprecated)

When the agent knows the component is production-tier and owned by a specific team, it behaves more conservatively around schema changes and breaking API updates.

### docs/adr/ (Layer 4)

Architecture Decision Records written with the `adr-writing` skill. Load the specific ADR that covers the area under edit — not the whole directory. Example: when editing the authentication flow, load `docs/adr/ADR-007-session-token-storage.md`, not all 40 ADRs.

### Atlassian MCP (Layer 4, on demand)

The `atlassian` MCP fetches Jira issues and Confluence pages on demand. Use it instead of pasting Confluence HTML into the rules file — the data is always fresh, and it keeps CLAUDE.md short.

### Standard skills (Layer 3)

The skills installed from `@sanofi-accelerator/ai-standards` each declare trigger phrases in their description. When the user says "write an ADR", the runtime auto-invokes `adr-writing`; when they say "cut a release", it invokes `release-process`. You do not need to inline those guidelines in CLAUDE.md — and you should not.

## Per-task loading budget

Aim for **under ~2,000 lines of focused context** loaded at any one time (rules file + active skill + 2–3 source files + error output). Beyond that, agents start prioritizing recently-loaded content and ignoring older layers.

A rough guide:

| Layer                                        | Budget (lines) |
| -------------------------------------------- | -------------- |
| Rules file                                   | ≤200           |
| Active skill body                            | ≤400           |
| Relevant source files (the 2–3 being edited) | ≤800           |
| One existing example of the pattern          | ≤200           |
| Error output / test results                  | ≤50            |
| Spec excerpt (if applicable)                 | ≤200           |
| **Total**                                    | **≤~1,850**    |

If the task genuinely requires more, split it: do the analysis in one session, implement in the next.

## What NOT to put in the hierarchy

- **Whole Confluence pages pasted as HTML** — use the Atlassian MCP.
- **All 40 ADRs at once** — load the one that covers the area under edit.
- **Every file in the module** — load only the 2–3 being edited.
- **Entire test output** — paste the failing assertion line and file:line reference.
- **Old conversation summaries more than two sessions back** — start fresh.
