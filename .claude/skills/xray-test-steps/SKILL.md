---
name: xray-test-steps
description: Generate Xray-compatible CSV test steps from a Jira item (user story, enabler, task, or bug). Derives preconditions, happy paths, verifications, alternative paths, error cases, and guard rails from acceptance criteria. Use when the user says "generate xray test steps for PROJ-123", "create test steps", or asks to generate test scenarios from a Jira ticket. Do NOT use for executing tests, managing Xray test plans, or uploading results to Xray.
argument-hint: PROJ-123
metadata:
  author: sanofi-accelerator
  version: "1.0.0"
allowed-tools: Read Write Edit Grep Glob Bash
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Xray Test Steps Generator

**Goal:** Generate a CSV file of manual test steps importable into Xray Cloud for a given Jira ticket.

**Your Role:** You are a QA engineer writing manual test steps. You produce a single CSV file — no code, no automated tests.

## Prerequisites

- Atlassian MCP must be connected. If any MCP call fails, **STOP** and ask the user to reconnect.
- Read `.claude/config/project.yaml` if it exists. Use `atlassian.url` to help select the correct Atlassian resource when multiple resources are accessible.
- If the config file does not exist or does not identify the correct Atlassian site, ask the user which Atlassian resource to use before continuing.

## Workflow

### Step 1: Parse the Issue Key

Extract the Jira issue key from the user's prompt (e.g., `OCTT-872` from "Generate xray test steps for OCTT-872"). The key follows the pattern `[A-Z][A-Z0-9]+-\d+`.

If no valid key is found, ask the user to provide one.

### Step 2: Resolve Atlassian Cloud ID

Call `getAccessibleAtlassianResources` to obtain the `cloudId`. If multiple resources are returned, pick the one matching the project config or ask the user.

### Step 3: Fetch the Jira Issue

Call `getJiraIssue` with:

- `cloudId`: from Step 2
- `issueIdOrKey`: the parsed key
- `responseContentFormat`: `"markdown"`

Extract:

- `fields.summary` — issue title
- `fields.description` — full description and acceptance criteria
- `fields.issuetype.name` — must be `Story`, `Enabler`, `Task`, `Bug`, `Test`, or a subtype of one of those types
- `fields.issuelinks` — linked issues (look for a "tests" link to a Story)

If the issue type is not supported (e.g., Epic, Initiative), inform the user and stop.

### Step 4: Fetch the Linked Story (if applicable)

If the ticket has a "tests" link to a Story, fetch the Story with `getJiraIssue` using the same `cloudId` and `responseContentFormat: "markdown"`.

Extract:

- User story (As a / I want / So that)
- Acceptance criteria (from description or custom fields)
- Context, dependencies, referenced Confluence pages

If the ticket has no linked Story, use the ticket's own description as context.

### Step 5: Explore the Codebase

Search the codebase for the domain logic related to the story. The goal is to understand how the feature works **from the user's perspective**:

1. **UI components** — Find the screens, forms, dialogs, labels, and chips the tester will actually see
2. **User-facing labels** — Identify the exact labels displayed in the UI (button text, chip labels, column headers). NEVER use internal enum values or technical constants — always use the label the user sees on screen
3. **Workflows** — Understand the user-facing flow: what can the user click, what appears, what changes on screen
4. **API surface (light)** — Note only critical endpoints (POST for creation, DELETE for deletion) that a tester might verify in the browser console. Do NOT deep-dive into DTOs, error codes, or internal validations
5. **Business rules** — Understand which actions are allowed/blocked and when, but describe them in user-facing terms

### Step 6: Design and Generate Test Steps

Build a single end-to-end test scenario that walks through the entire feature using the Jira context and codebase exploration results.

#### Scenario Structure

Use only the sections relevant to the story:

1. **Setup** — Navigate to the right state / establish preconditions
2. **Happy path** — Perform the main workflow
3. **Verification** — Check visible results on screen
4. **Variations** — Alternative paths, edge cases (only if meaningfully different from the happy path)
5. **Cleanup / final state** — Verify consistency if relevant

#### Design Guidelines

- **Do NOT over-test.** Keep the scenario focused. If a variation is trivially similar to the happy path, skip it or mention it as a note inside an existing step rather than adding dedicated steps.
- **Group related actions into a single step.** A sequence of clicks that logically belongs together (e.g., "select an item, click validate") can be a single step. The tester should never have to read 5 steps for what is conceptually one action.
- **NEVER hallucinate data.** Do not invent example values (SAP IDs, names, dates, quantities, etc.). If the step requires the tester to enter data, describe *what kind* of data to enter without providing a fabricated value. Do not hallucinate data produced by code execution either. Examples:
  - GOOD: `"Enter a valid SAP ID"` — BAD: `"Enter SAP-12345"`
  - GOOD: `"Type a title for the item"` — BAD: `"Type 'Bioreactor Feed Pump'"`
  - GOOD: `"The ticket detail page opens showing 'Ticket details' with its id"` — BAD: `"The ticket detail page opens showing 'Ticket details' with ID 'FRE-001'"`
- **Use only user-visible labels.** Write steps using the exact text the tester sees on screen (button labels, chip labels, column headers). NEVER use internal/technical names:
  - GOOD: `"To define"` — BAD: `"UNDER_INVESTIGATION"`
  - GOOD: `"Click on a SU item"` — BAD: `"Click on the 'Bioreactor' item of the SU Recipe"`
- **Keep references generic when the specific item doesn't matter.** Say "Click on a SU item" or "Select any available RU item" — not a specific fabricated item name.
- **Data column rules:** Only populate the `Data` column with *instructions* about what to enter or what the tester should see, never with invented application data. If no data input is needed, leave the column empty.
- **No technical verifications** except critical `GET`/`POST`/`DELETE` calls that the tester can easily check in the browser's Network console tab. Do NOT reference:
  - Internal HTTP status codes or error types
  - Database column names (`is_deleted`, `sequenceNumber`, etc.)
  - Domain error class names or enum values
  - Internal field names that differ from UI labels
- **Expected results must describe what the tester sees on screen**, not internal state. Say "The item disappears from the list" not "The entity is soft-deleted (is_deleted = true)".
- **If acceptance criteria are missing or vague**, generate steps from the description and summary. Flag to the user that the steps may need refinement.
- **One scenario per CSV** — if the issue describes multiple independent flows, generate one CSV covering all flows sequentially, with setup rows separating them.

### Step 7: Write the CSV File

Write the file as `<ISSUE-KEY>-test-steps.csv` in the current working directory.

Format rules:

- Header row: `Action,Data,Expected Result`
- All cell values wrapped in double quotes
- Double-quote characters inside a field must be escaped by doubling them (`""`)
- Empty cells left as unquoted empty strings (just commas)
- Newlines within cells escaped as `\n` or avoided entirely
- UTF-8 encoding

Use the template in [references/csv-template.csv](references/csv-template.csv) as the structural reference.

### Step 8: Report

Print:

1. The output file path
2. How many steps were generated
3. A brief summary of what's covered
4. Any warnings (missing acceptance criteria, assumptions made)
5. Import instructions:
   1. Open the Xray Test issue in Jira
   2. Go to the **Steps** tab
   3. Click **...** menu > **Import Steps** > **CSV**
   4. Upload the generated CSV file

## CSV Format Reference

See [references/csv-template.csv](references/csv-template.csv) for the expected row structure and placeholder values.

## Important

- All content must be in **English**
- Do NOT create automated tests — this skill produces manual test steps only
- Do NOT modify the Jira ticket — only generate the CSV file locally
- If the ticket has no linked Story, use the ticket's own description as context
- If codebase exploration yields insufficient context, ask the user for clarification

## Error Handling

| Situation                                 | Action                                                     |
| ----------------------------------------- | ---------------------------------------------------------- |
| MCP not connected                         | Stop and ask user to reconnect Atlassian MCP               |
| Issue not found                           | Report the key and ask user to verify                      |
| Unsupported issue type (Epic, Initiative) | Inform user, suggest using child items instead             |
| No description or acceptance criteria     | Generate minimal steps from summary, warn the user         |
| `cloudId` resolution fails                | Ask user to run `getAccessibleAtlassianResources` manually |
| Codebase exploration yields no context    | Ask user for clarification before generating steps         |
