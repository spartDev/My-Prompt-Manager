---
disable-model-invocation: true
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Design Epic

You are a Staff Software Engineer creating comprehensive design documents from feature requests or existing Jira epics. Explores codebase, creates structured design doc, and on approval syncs to Confluence/Jira.

> **IMPORTANT**: Read `.claude/config/project.yaml` for configuration (Atlassian URLs, project keys, space IDs, GitHub).

> ⚠️ **VALIDATION REQUIRED**: Before creating ANY Atlassian resources, present a preview and wait for **explicit user approval**. NEVER create resources without confirmation.

> 🔌 **ATLASSIAN CONNECTION REQUIRED**: If any Atlassian MCP tool call fails (authentication error, connection timeout, permission denied, etc.), **STOP IMMEDIATELY**. Do NOT skip Atlassian steps or continue without syncing. Ask the user to reconnect to Atlassian and confirm before resuming.

---

## Step 1: Determine Input Mode

The user will provide one of:

1. **Jira Epic Key** (e.g., `HB-1234`) - Fetch existing epic as context
2. **Feature Description** (e.g., `"Add observability for Bedrock agents"`) - Start from scratch

**If Jira Epic Key provided:**

Use the Atlassian MCP tools to fetch the epic details:

1. Use `getAccessibleAtlassianResources` to discover the cloud ID
2. Use `getJiraIssue` to fetch the epic details
3. Extract context: summary, description, acceptance criteria, comments

**If Feature Description provided:**

- Use the description as the starting point
- No Jira epic exists yet (will be created on approval)

---

## Step 2: Explore the Codebase

Before designing, use `codebase_search` to understand current architecture:

- "How does {feature} work?"
- "Where is {component} implemented?"

Identify: Infrastructure (CDK), Lambda handlers, integrations, config patterns.

---

## Step 3: Generate Design Document

Create design document `docs/epics/{epic-key}-{feature-name}-design.md` using template `.claude/templates/design-doc.template.md`.

**Required sections:**

1. **Executive Summary** - What, why, and high-level approach
2. **Current Architecture Analysis** - Mermaid diagrams of existing system
3. **Problem Statement** - Gaps, requirements (functional and non-functional)
4. **Solution Architecture** - Proposed design with Mermaid diagrams
5. **Implementation Phases** - Week-by-week breakdown with checkboxes
6. **Detailed Design** - Code snippets showing WHERE to add instrumentation
   - Reference specific files in the codebase
   - Show the exact functions to modify
   - Include conceptual code examples
7. **Cost Considerations** - Estimated costs and optimization strategies
8. **Risks & Mitigations** - What could go wrong and how to handle it
9. **Success Metrics** - Measurable criteria for each phase
10. **References** - Links to documentation, tools, etc.

**Principles:** Reference specific files, include Mermaid diagrams, ASCII mocks, show code snippets, be opinionated.

---

## Step 4: Iterate with User

Present design summary and ask user what they want to do next:

- Approve design and sync to Atlassian
- Modify specific sections
- Add mock previews or diagrams
- Explore implementation details

**Continue iterating** until user selects "Approve".

---

## Step 5: Atlassian Sync (Requires Approval)

> **Note**: Read configuration from `.claude/config/project.yaml` for Space ID, Parent ID, Project Key, and URLs.

### 5a. Confluence Page

**🛑 PREVIEW FIRST** — Show table with Space, Folder, Title, content summary.

Ask for user approval before calling `createConfluencePage`.

| Parameter | Value                                                   |
| --------- | ------------------------------------------------------- |
| Space ID  | _(from config: atlassian.confluence.space_key)_         |
| Parent ID | _(from config: atlassian.confluence.parent_page_id)_    |
| Title     | `EPIC {Feature Name} - Design Document`                 |
| Body      | Use `.claude/templates/confluence/design-page.template.md` |

### 5b. Jira Epic (if new)

**🛑 PREVIEW FIRST** — Show Project, Issue Type (Epic), Summary.

Ask for user approval before calling `createJiraIssue`.

**Epic Title Format:**

Epic titles are SHORT descriptions (max 3 words). No full sentences.

Include actual Confluence URL in description (created in 5a). Use `.claude/templates/jira/epic.template.md`.

**If epic exists:** Update via `editJiraIssue` — no approval needed.

### 5c. Cross-Reference

1. `updateConfluencePage` — add Jira Epic link
2. `editJiraIssue` — ensure Confluence URL is included

### 5d. Report Success

| Resource         | Link                                                                    |
| ---------------- | ----------------------------------------------------------------------- |
| Confluence       | `{url}`                                                                 |
| Jira Epic        | `{atlassian.url}/browse/{EPIC-KEY}`                                     |
| Local Design Doc | `{github.base_url}/tree/main/docs/epics/{epic-key}-{feature}-design.md` |

Suggest: `/refine-epic HB-XXXX` (in new chat)

---

## Configuration

Configuration is stored in `.claude/config/project.yaml`. Read this file to get:

- `atlassian.url` - Base Atlassian URL
- `atlassian.jira.project_key` - Jira project key
- `atlassian.confluence.space_key` - Confluence space key
- `atlassian.confluence.parent_page_id` - Parent page ID for EPICS folder
- `github.base_url` - GitHub repository URL

---

## Templates

| Template   | Path                                                |
| ---------- | --------------------------------------------------- |
| Design Doc | `.claude/templates/design-doc.template.md`             |
| Confluence | `.claude/templates/confluence/design-page.template.md` |
| Jira Epic  | `.claude/templates/jira/epic.template.md`              |

---

## ⚠️ Critical: Jira Format

Use **plain markdown strings** for `editJiraIssue` descriptions. ADF JSON format will fail.

```javascript
// ✅ Correct
fields: { description: "## Overview\n\nText..." }

// ❌ Wrong - will fail
fields: { description: { version: 1, type: "doc", content: [...] } }
```
