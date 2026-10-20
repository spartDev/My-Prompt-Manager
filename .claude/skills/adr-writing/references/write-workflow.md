<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Write Mode Workflow

## 1. Understand the Decision

Present a single comprehensive question to the engineer. Ask for all of the following
in ONE message — do not split across multiple turns:

1. **The decision topic** — what needs to be decided and why (required)
2. **Options considered** — what alternatives were evaluated, with any known pros/cons (required, minimum 2)
3. **Chosen option** — which was selected and why, or "undecided" (required)
4. **Decision drivers** — key forces or constraints (e.g., cost, performance, team expertise) (optional)
5. **Confluence pages** — titles, URLs, or search terms (optional, multiple allowed)
6. **Jira tickets** — ticket keys (optional, multiple allowed)
7. **External references** — URLs to RFCs, blog posts, docs (optional)
8. **Status** — proposed, accepted, deprecated, or superseded (default: `accepted`)
9. **Deciders** — who was involved (optional)

If the user provides only a decision topic, proceed and ask ONE follow-up for the
missing required fields (options, chosen option). Fields 4-9 are optional.

If the user passes a Jira key or title as `$ARGUMENTS`, treat it as input to field 1.
Fetch the ticket immediately, then ask a single follow-up for any missing required fields.

If MCP was marked unavailable in the First Step, still collect Atlassian refs — they will be
recorded as Links and the user can paste content manually (see Step 2 degradation matrix).

## 2. Fetch Atlassian Context

For each Jira ticket provided:

- Fetch via `mcp__confluence: getJiraIssue` with `cloudId` and `issueIdOrKey`
- Extract: problem context, acceptance criteria, linked issues, decision-related comments

For each Confluence page provided:

- Resolve tiny URLs using the process in the `atlassian-integration.md` reference
- Search by title/term via `mcp__confluence: searchConfluenceUsingCql` (param: `cql`) or fetch by ID via `mcp__confluence: getConfluencePage` (param: `pageId`)
- Extract: architecture context, constraints, prior decisions

**Confirm fetched sources:** After fetching, list each page title and Jira ticket summary.
Ask the user: "I fetched the following sources — are these correct?" If a user-provided link
could not be resolved, explicitly flag it: "I could not resolve [link]. Please provide the
page title or numeric ID."

**Detect existing standards:** Search Confluence for existing architecture standards or
technology decisions related to the decision topic (e.g., search for "standard" + the
technology names). If an existing enterprise standard already addresses the question,
surface it as context and suggest it as a factor in the analysis. For example, if Snowflake
is the enterprise standard for data warehousing, note that and suggest evaluating a
compliance-aligned or hybrid option alongside the user-provided alternatives.

**Fetch the Architecture Manifesto:** Always fetch the Sanofi Architecture Manifesto to
evaluate the decision against its 10 principles:

```text
mcp__confluence: getConfluencePage cloudId:"{cloudId}" pageId:"60467430731" contentFormat:"markdown"
```

If MCP is unavailable, use the principle list embedded in the skill template. In Step 5,
populate the Architecture Manifesto Alignment section by mapping the decision to the
relevant principles (typically 2-5, not all 10).

After fetching, present a **consolidated summary** of all extracted content and confirm
with the user before proceeding.

**Graceful degradation:**

| MCP Available | User Provides Atlassian Refs | Behavior                                             |
| :-----------: | :--------------------------: | :--------------------------------------------------- |
| Yes           | Yes                          | Fetch all, present summary, confirm                  |
| Yes           | No                           | Skip Step 2                                          |
| No            | Yes                          | Inform user, record as Links, ask for manual summary |
| No            | No                           | Skip Step 2                                          |

## 3. Gather Remaining Context

Collect any information not already covered by Steps 1-2. Only ask for what's missing.
Present all remaining questions in a single message:

1. **Options**: What alternatives were considered? (minimum 2)
2. **Decision**: Which option was chosen and why?
3. **Status**: What is the current status? (default: `accepted`)
4. **Deciders**: Who was involved? (optional)
5. **Drivers**: What forces or concerns influenced this? (optional)

If the decision topic from Step 1 was too vague, clarify it here before continuing.
If the user already provided sufficient context (directly or via Atlassian), skip this step
entirely. Only ask for missing critical information (options, decision).

## 4. Determine File Name

1. Scan `docs/adr/` for existing ADRs to find the next sequential number
2. Match the formatting conventions of existing ADRs (header style, table format, section order)
3. Generate a kebab-case slug from the decision title
4. Format: `ADR-NNN-slug.md` (e.g., `ADR-001-use-postgresql-for-persistence.md`)

If `docs/adr/` does not exist, create it.

## 5. Write the ADR

Use the MADR template from the skill. Include all required sections; include optional
sections only when the user provided relevant information.

- Populate **Technical Story** from Jira ticket keys collected in Step 1
- Populate **Links** with Jira URLs, Confluence page URLs, and external references collected in Steps 1-2
- If an option was ruled out early for technical infeasibility (e.g., a feature not supported
  by the target platform), use the **Options Ruled Out** section instead of a full option entry
- If the ADR involves infrastructure or tooling with variable pricing, include a **Cost Annex**
  with data sourced from vendor pricing APIs (see `cost-analysis.md` reference)

## 6. Confirm

After writing, show the user:

- The file path
- A brief summary of the decision recorded
- Suggest next steps (e.g., share with team for review, link from relevant code)
