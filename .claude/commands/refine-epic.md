---
disable-model-invocation: true
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Refine Epic into User Stories and Tasks

You are a Senior Product Owner/ Staff Software Engineer, refine & generate epic breakdown from a design document and syncs to Jira. **Design doc is source of truth** - existing Jira content is supplementary. On approval, Jira issues are created/overwritten.

> **IMPORTANT**: Read `.claude/config/project.yaml` for configuration (Atlassian URLs, project keys, space IDs, GitHub).

> **Tip**: Open a new Cursor chat for `/refine-epic` to avoid context token exhaustion.
>
> **Usage**: `/refine-epic HB-XXXX` (epic key is REQUIRED)

> 🔌 **ATLASSIAN CONNECTION REQUIRED**: If any Atlassian MCP tool call fails (authentication error, connection timeout, permission denied, etc.), **STOP IMMEDIATELY**. Do NOT skip Atlassian steps or continue without syncing. Ask the user to reconnect to Atlassian and confirm before resuming.

---

## Step 0: Pre-flight Checks

Before proceeding, verify ALL of the following:

| Check               | Command                                  | Expected        | On Fail |
| ------------------- | ---------------------------------------- | --------------- | ------- |
| Config exists       | Read `.claude/config/project.yaml`       | File exists     | STOP    |
| Atlassian connected | `getAccessibleAtlassianResources`        | Returns cloudId | STOP    |
| Epic exists         | `getJiraIssue` with provided epic key    | Returns epic    | STOP    |
| Design doc exists   | Glob `docs/epics/{epic-key}-*-design.md` | File found      | STOP    |

---

## Step 1: Load Design Document

Read the design doc validated in pre-flight and extract:

- Executive summary
- Phases
- Detailed design
- Success criteria
- Implementation sections

---

## Step 2: Summarize

| Field      | Value                             |
| ---------- | --------------------------------- |
| Design Doc | `{path or Confluence URL}`        |
| Feature    | {name}                            |
| Goal       | {one-line from executive summary} |
| Phases     | {count}                           |
| Jira Epic  | `{HB-XXXX}`                       |

---

## Step 3: Propose User Stories (2-4 max)

**Principles:**

- Functional, self-contained stories (not technical)
- INVEST: Independent, Negotiable, Valuable, Estimable, Small, Testable
- Each story independently testable end-to-end

**For each story provide:**

- **User story format:** Aa{PersonaAbbrev}, I want {feature} so that {benefit}
- **Scope** (what's included, key functionality)
- **Acceptance criteria** (specific, testable checkboxes)
- **Dependencies** (blockers/dependencies)
- **Technical notes** (reference design doc sections)

**Story Title Format (Jira Summary):**

Story titles MUST follow this exact pattern:

```
Aa{PersonaAbbrev}, I want {feature} so that {benefit}
```

**Persona Abbreviations:**
| Abbreviation | Full Persona |
|--------------|--------------|
| Dev | Developer |
| PO | Product Owner |
| User | End User |
| Designer | Designer |

---

## Step 4: Propose Tasks per Story

Tasks must:

- **Produce isolated value** (can be merged without breaking)
- **Be technical and self-contained** (no partial implementations)
- **Reference design doc** (file paths, code locations)

**Task Title Format:**

Task titles are descriptive action phrases. **NO prefixes like T1.1, etc.**

**Task Sizing Guidelines:**

- **Target PR size**: ~300 lines of code (tests and lock files excluded)
- **Not too small**: Avoid 1 task per file if files share the same context/pattern - group them
- **Not too large**: If a task would exceed ~500 lines (tests and lock files excluded), split it
- **Easy to review**: Same context, cohesive changes, clear scope
- **Testable**: Each task should be independently testable
- **Rule of thumb**: If multiple files follow the exact same pattern, consolidate into one task

Provide: Task table (Title, Description) + Details (files to modify, implementation approach, DoD).

---

## Step 5: Generate Local Refinement Document

Create `docs/epics/{epic-key}-{feature-name}-refinement.md` using `.claude/templates/epic-refinement.template.md`.

**Filename format:** Must match the design doc filename pattern

- Extract `{epic-key}` from input
- Extract `{feature-name}` from design doc filename

Include: Epic summary, stories (2-4), tasks table, dependency graph (Mermaid), implementation order, success criteria.

> ⚠️ **CHECKPOINT**: Before proceeding to Step 6, verify the refinement document exists at `docs/epics/{epic-key}-{feature-name}-refinement.md`. Do NOT continue without this file.

---

## Step 6: Ask for Refinements

Present summary: {N} stories, {M} tasks. Offer to adjust story split, modify criteria, add/remove tasks, or approve.

Iterate: "Already done" → remove; "Combine these" → merge; "Simpler" → consolidate.

> ⚠️ **CHECKPOINT**: Do NOT proceed to Step 7 until the user explicitly approves (says "approve", "yes", "go ahead", etc.). Never auto-approve.

---

## Step 7: Create Jira Issues (on approval)

> **Note**: Read configuration from `.claude/config/project.yaml` for Project Key and URLs.

**Before creating issues**, confirm with user (include counts: {N} stories, {M} tasks).

### Epic

Update existing epic via `editJiraIssue` to overwrite description.

**Epic Title Format:**

Epic titles are SHORT descriptions (max 3 words). No full sentences.

### Stories

`createJiraIssue`: Project: _(from config: atlassian.jira.project_key)_, Type: Story, Parent: Epic key
Use `.claude/templates/jira/story.template.md`

### Tasks (Children of Epic, NOT Subtasks)

**IMPORTANT**: Tasks are direct children of the Epic, NOT subtasks of Stories!

`createJiraIssue`: Project: _(from config: atlassian.jira.project_key)_, Type: **Task**, Parent: **Epic key** (NOT Story key)
Use `.claude/templates/jira/task.template.md`

Stories are used for logical grouping in the refinement document, but Tasks link directly to the Epic in Jira.

---

## Step 7b: Update Refinement Doc with Jira Keys

**After all tasks are created**, update the refinement document to add Jira keys to the task table:

1. Read the existing refinement doc: `docs/epics/{epic-key}-{feature-name}-refinement.md`
2. Find the "Quick Reference: Task Identifiers" table
3. Update each row with the corresponding Jira key created in Step 7
4. Map Task IDs (T1.1, T1.2, etc.) to their Jira keys (HB-XXXX)

This creates bidirectional linking between local docs and Jira for reliable task lookup during implementation.

---

## Step 8: Summary Report

Provide:

1. **Created Issues table:** Type, Key, Title, Parent
2. **Dependency graph:** Mermaid flowchart showing Epic → Stories → Tasks
3. **Quick links:**
   - Jira Epic: `{atlassian.url}/browse/{epic-key}`
   - Design Doc: `docs/epics/{epic-key}-{feature-name}-design.md`
   - Refinement Doc: `docs/epics/{epic-key}-{feature-name}-refinement.md`
4. **Next steps:** Suggest `/implement HB-XXXX` (first task key) in a new chat

---

## Configuration

Configuration is stored in `.claude/config/project.yaml`. Read this file to get:

- `atlassian.url` - Base Atlassian URL
- `atlassian.jira.project_key` - Jira project key
- `atlassian.confluence.space_key` - Confluence space key

---

## Templates

Templates are located in `.claude/templates/`:

| Template        | Path                                         |
| --------------- | -------------------------------------------- |
| Epic Refinement | `.claude/templates/epic-refinement.template.md` |
| Jira Story      | `.claude/templates/jira/story.template.md`      |
| Jira Task       | `.claude/templates/jira/task.template.md`       |

---

## Jira Description Templates (MUST FOLLOW EXACTLY)

When creating Refinement doc and Jira issues, **read and follow the template files exactly**. The description field must match the template structure.

### Story Description (`.claude/templates/jira/story.template.md`)

### Task Description (`.claude/templates/jira/task.template.md`)

**⚠️ CRITICAL**: Always read the template file before creating issues. Do NOT deviate from the template structure.

---

## Key Principles

1. **Epic must exist** - This skill requires an existing Jira epic (fail if not found)
2. **Design doc must exist** - This skill requires a local design document (fail if not found)
3. **Design doc is source of truth** - Jira content generated from it
4. **2-4 stories max** - Consolidate into functional, self-contained stories
5. **Self-contained tasks** - Each can be merged without breaking
6. **Overwrite on approval** - Existing Jira content is replaced
7. **No estimates** - Team estimates in refinement session
8. **Tasks are Epic children** - Tasks link to Epic directly (Type: Task, Parent: Epic), NOT as Subtasks of Stories
