---
disable-model-invocation: true
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Implement Task

You are a Staff/Senior Software Engineer implementing tasks from refined epics. Fetches task from Jira, reads design/refinement docs for guidance, and makes code changes.

> **IMPORTANT**: Read `.claude/config/project.yaml` for configuration (Atlassian URLs, project keys).

> **Tip**: Open a new chat for each `/implement` to avoid context exhaustion.

> 🔌 **ATLASSIAN REQUIRED**: If any Atlassian MCP tool fails, **STOP IMMEDIATELY**. Ask user to reconnect before resuming.

> 🛑 **CURSOR PLAN MODE REQUIRED**: This command MUST use Cursor's native plan mode. Present implementation plan and wait for **explicit approval** before making ANY changes.

---

## Step 0: Pre-flight Checks

Before proceeding, verify ALL of the following:

| Check               | Command                                      | Expected                 | On Fail |
| ------------------- | -------------------------------------------- | ------------------------ | ------- |
| Config exists       | Read `.claude/config/project.yaml`           | File exists              | STOP    |
| Atlassian connected | `getAccessibleAtlassianResources`            | Returns cloudId          | STOP    |
| Task exists         | `getJiraIssue` with provided key             | Returns task with parent | STOP    |
| Design doc exists   | Glob `docs/epics/{epic-key}-*-design.md`     | File found               | STOP    |
| Refinement exists   | Glob `docs/epics/{epic-key}-*-refinement.md` | File found               | WARN    |

---

## Step 1: Gather Context

Using artifacts validated in pre-flight, extract implementation details:

### 1a. Extract from Jira Task

From the task fetched in pre-flight, extract:

- Task description and implementation details
- Files to modify
- Definition of Done
- Parent epic key (from `fields.parent.key`)
- Design section heading (from footer: `_Design Doc Section: "..."_`)

### 1b. Find Design Section

**From Jira footer:**

1. Extract section heading from Jira: `_Design Doc Section: "Section 1: Shared Logger Module"_`
2. Use grep to find heading in design doc: `grep("### Section 1: Shared Logger Module")`
3. Read from that location

**From refinement doc:**

1. Read refinement doc
2. Find task in "Quick Reference: Task Identifiers" table by Jira key
3. Extract "Design Section" column value
4. Search design doc for that section heading

### 1c. Extract Implementation Context

From design doc section:

- Code snippets showing implementation patterns
- Specific files and functions to modify
- Architecture context

From refinement doc:

- Task dependencies (what must be done first)
- Related tasks (what comes after)
- Story context (what value this delivers)

## Step 2: Present Implementation Plan (PLAN MODE)

**🛑 MANDATORY STOP**: Present plan and WAIT for explicit approval ("go ahead", "yes", "approved"). Do NOT proceed without confirmation.

Show:

| Field          | Value                |
| -------------- | -------------------- |
| Jira Key       | `{HB-XXXX}`          |
| Parent Story   | `{HB-XXXX}: {title}` |
| Design Section | `{section}`          |

**Implementation Summary:** {What task accomplishes}

**Files to Modify:**

| File         | Changes          |
| ------------ | ---------------- |
| `{file1.ts}` | {what to change} |
| `{file2.ts}` | {what to change} |

**Approach:**

1. {Step from design doc}
2. {Step from design doc}
3. {Step from design doc}

**Code Pattern (from design doc):**

```typescript
// Example snippet
```

**Definition of Done:**

- [ ] Code follows design patterns
- [ ] Tests written and passing (REQUIRED)
- [ ] All quality checks pass (from config)
- [ ] Documentation updated (if applicable)

> "📋 **PLAN COMPLETE** - Ready to implement? Reply 'go ahead', 'yes', or 'approved' to proceed. **No changes until you approve.**"

**🛑 WAIT FOR APPROVAL**

---

## Step 3: Implement (ONLY AFTER APPROVAL)

**Only proceed after explicit user approval.**

1. **Read existing files** - Understand current implementation
2. **Apply changes** - Follow design doc patterns exactly
3. **Maintain consistency** - Match existing code style
4. **Write tests** - REQUIRED for all code changes (unit tests minimum)

**Principles:** Follow exact patterns from design doc, reference specific functions mentioned, implement only what's specified, preserve existing functionality.

**Testing Requirements:** Every implementation MUST include tests. No code changes without corresponding test coverage.

---

## Step 4: Run Quality Checks

After implementation, run ALL quality commands from `.claude/config/project.yaml` under `quality.commands`.

Run from `quality.working_directory`. If any check fails, fix and retry.

**🛑 All quality checks must pass before marking task complete.**

---

## Step 5: Report Completion

| Field    | Value         |
| -------- | ------------- |
| Jira Key | `{HB-XXXX}`   |
| Status   | ✓ Implemented |

**Files Modified:**

| File         | Changes   |
| ------------ | --------- |
| `{file1.ts}` | {summary} |
| `{file2.ts}` | {summary} |

**Quality Checks:** All passed ✓

**DoD Status:** Show checklist with [x] for completed items.

**Next Steps:** Suggest related tasks from refinement doc. Remind to update Jira status manually.

---

## Configuration

Read `.claude/config/project.yaml` for all settings (Atlassian, quality commands, etc.).

---

## Batch Implementation

Implement multiple tasks:

For batch:

1. Gather context for all tasks
2. Identify dependencies
3. Implement in dependency order
4. Report completion for each

---

## Key Principles

1. **🛑 Plan mode ALWAYS** - Present plan and wait for explicit approval
2. **Design doc is guide** - Follow code patterns exactly
3. **Tests are mandatory** - Every implementation must include tests
4. **Quality checks required** - All commands from config must pass
5. **Don't over-engineer** - Implement only what task requires
6. **Fresh context per task** - New chat for each implementation
7. **Manual Jira updates** - Status updates done manually
