---
name: adr-writing
disable-model-invocation: true
user-invocable: false
description: >
  Provides the MADR template, naming conventions, guidelines, and review checklist for
  writing and reviewing Architecture Decision Records. Use when creating ADRs, reviewing
  proposed ADRs, documenting architecture decisions, recording technical decisions, or when
  user says "write an ADR", "review this ADR", "document this decision", or "record the
  architecture choice". Do NOT use for general documentation, meeting notes, RFCs, or
  design docs.
metadata:
  author: Sanofi-Accelerator
  version: 2.0.0
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Writing and Reviewing Architecture Decision Records (MADR)

Creates and reviews Architecture Decision Records following the
[MADR](https://github.com/joelparkerhenderson/architecture-decision-record/blob/main/locales/en/templates/decision-record-template-of-the-madr-project/index.md) format.

## ADR Directory Convention

ADRs live in `docs/adr/`. If the directory does not exist, create it.

## File Naming

Format: `ADR-NNN-slug.md`

1. Scan `docs/adr/` for existing ADRs to find the next sequential number (zero-padded to 3 digits)
2. Generate a kebab-case slug from the decision title
3. Examples: `ADR-001-use-postgresql-for-persistence.md`, `ADR-012-adopt-event-sourcing.md`
4. Review files use: `ADR-NNN-slug-review.md`

## Style Matching

Before writing, read 1-2 existing ADRs in `docs/adr/` to match:

- Header format (front-matter table vs. bullet list vs. heading metadata)
- Section ordering
- Table alignment style
- Pros/cons format (list vs. subsections)

If no existing ADRs exist, use the template below as-is.

## Template

Read and follow the template in `assets/adr.template.md`.

## Completeness Principle

When writing ADRs, balance completeness with accuracy:

- Add reasonable technical specificity (e.g., "PostgreSQL with JSONB columns", not just "PostgreSQL")
- Include inferred operational concerns (backup, monitoring, security) when they are relevant to the decision
- Do not invent performance numbers, cost data, or benchmarks — ask the user to confirm
- Do not add options the user did not consider unless prompting them per the single-option rule below
- Stay close to the user's input for facts; elaborate only on structure and framing

## Examples

For expected depth and style, read these reference ADRs when writing:

- **Minimal ADR** (2 options, no optional sections): `references/example-minimal.md`
- **Comprehensive ADR** (with Cost Annex, Options Ruled Out, Decision Drivers): `references/example-comprehensive.md`

## Workflows

Step-by-step orchestration for writing and reviewing ADRs:

- **Write workflow**: `references/write-workflow.md`
- **Review workflow**: `references/review-workflow.md` — intended primarily for
  reviewing existing ADRs (written by humans or produced in a separate session).
  Do not self-review an ADR just written in the same conversation; the shared
  context removes the independent perspective that makes review valuable.
- **Atlassian integration** (fetching ADRs from Confluence, comment threads, fact-checking): `references/atlassian-integration.md`
- **Cost analysis** (vendor pricing APIs, comparison tables, Confluence Chart macros): `references/cost-analysis.md`

## Guidelines

- Use today's date for the Date field
- Default status is `accepted` unless the user specifies otherwise
- Keep the problem statement concise (2-3 sentences)
- Write pros/cons as factual statements, not opinions
- Omit optional sections (Decision Drivers, Technical Story, Links, Positive/Negative
  Consequences, Options Ruled Out, Cost Annex) if no relevant info was provided — do not
  leave placeholder text
- When context was sourced from Jira or Confluence, always include the original URL in
  the Links section
- Decision Drivers must always be formatted as a table with Driver and Description columns
- Minimum 2 considered options per ADR
- Use consistent table column separators — pad cells to align pipes for readability
- Pros and Cons use bold list labels (`* **Pros**`), not heading levels, to avoid
  duplicate-heading lint warnings (MD024)
- Each option gets its own `###` heading with the option name, ensuring unique headings
- When an option is infeasible on the target platform, move it to "Options Ruled Out"
  with a documentation reference instead of presenting it as a full option with pros/cons
- Cost data in the Cost Annex must cite its source (pricing page URL or API query)
- The Architecture Manifesto Alignment section is required — list only principles the
  decision directly impacts (typically 2-5, not all 10)

## Anti-Patterns

### Vague Problem Statements

```markdown
<!-- BAD -->
We need to pick a database.

<!-- GOOD -->
How should we persist user profile data given our requirements for sub-10ms read
latency, eventual consistency tolerance, and a schema that evolves monthly?
```

### Opinion-Based Pros/Cons

```markdown
<!-- BAD -->
* Good, because it feels right
* Bad, because it's complex

<!-- GOOD -->
* Good, because it reduces p95 query latency from 120ms to 8ms (benchmark: PROJ-456)
* Bad, because it requires a 2-week migration of 14M existing records
```

### Missing Context

```markdown
<!-- BAD -->
Chosen option: "Option A", because it's better.

<!-- GOOD -->
Chosen option: "PostgreSQL with JSONB columns", because it supports our semi-structured
data model while keeping operational complexity low (single database engine, existing
team expertise, managed via RDS).
```

### Unverified Technical Claims

```markdown
<!-- BAD -->
Option B is not feasible because Service X does not support feature Y.

<!-- GOOD -->
Option B is not feasible because MWAA does not allow custom SQS queues. Per the
[MWAA FAQs](https://docs.aws.amazon.com/mwaa/latest/userguide/mwaa-faqs.html):
"Amazon MWAA automatically provisions and manages its own Amazon SQS queue for each
Amazon MWAA environment."
```

### Missing Rejection Rationale

```markdown
<!-- BAD -->
## Considered Options
* Option A (chosen)
* Option B
* Option C
<!-- Option B and C have pros/cons but no explanation of why they weren't chosen -->

<!-- GOOD -->
## Decision Outcome
Chosen option: "Option A", because [reason].
Option B was not selected because [specific reason].
Option C was ruled out due to [platform constraint — see Options Ruled Out].
```

## Review Checklist

Use this checklist when reviewing an existing ADR. Evaluate each item and assign:
Pass, Fail, or Partial.

### Structure

| # | Check | Criteria |
| - | ----- | -------- |
| S1 | Status field present | One of: proposed, accepted, rejected, deprecated, superseded |
| S2 | Date field present | Valid YYYY-MM-DD date |
| S3 | Deciders listed | At least one named person or role |
| S4 | Context and Problem Statement | 2-3 sentences, articulated as a question where possible |
| S5 | Decision Drivers present | Table format with Driver and Description columns |
| S6 | Decision Drivers weighted | Drivers have explicit priority or weighting (optional but recommended) |
| S7 | Minimum 2 options | At least 2 considered options with pros/cons |
| S8 | Each option has pros and cons | No option listed without both pros and cons |
| S9 | Decision Outcome present | States chosen option with justification |
| S10 | Rejection rationale | Explains why non-chosen options were rejected |
| S11 | Consequences section | Positive and negative consequences listed |
| S12 | Links section | References to related ADRs, tickets, docs |
| S13 | Architecture Manifesto Alignment | Maps decision to relevant Sanofi manifesto principles with verdict |

### Content Quality

| # | Check | Criteria |
| - | ----- | -------- |
| C1 | Problem statement is specific | Not vague — includes constraints, requirements, or metrics |
| C2 | Pros/cons are factual | Evidence-based, not opinion-based |
| C3 | Technical claims are referenced | Claims about platform capabilities cite documentation |
| C4 | Cost data is sourced | Any pricing data cites its source (API, pricing page, quote) |
| C5 | No scope creep | ADR addresses one decision, not multiple bundled decisions |
| C6 | Migration path addressed | If the decision changes an existing system, migration is discussed |
| C7 | Rollback strategy noted | What happens if the decision doesn't work out |
| C8 | Validation criteria defined | How success will be measured |

### Completeness

| # | Check | Criteria |
| - | ----- | -------- |
| X1 | No placeholder text | All sections are filled or omitted — no "[TODO]" or "[TBD]" |
| X2 | No orphan options | Every option in the list has a corresponding detail section |
| X3 | Current-state data | Problem statement is grounded in real numbers or incidents |
| X4 | Future ADRs scoped | Out-of-scope concerns are explicitly listed for follow-up |

## Troubleshooting

### No existing ADRs in `docs/adr/`

Start numbering at `ADR-001`. Create the directory if it does not exist.

### Duplicate ADR numbers

Scan all existing files before assigning a number. If gaps exist in the sequence,
use the next number after the highest existing ADR — do not fill gaps.

### Ambiguous decision title

If the title could apply to multiple decisions, qualify it with the technology or
domain: `use-postgresql-for-user-profiles` not `use-postgresql`.

### Decision has only one option

1. Ask: "What alternatives were considered, even if briefly evaluated and rejected?"
2. If the user names an alternative, include it as a full option with pros/cons.
3. If the user confirms no alternatives exist (e.g., platform policy mandates the choice),
   document the constraint in the Context section, place the mandated option as the chosen
   option, and add at least one alternative to "Options Ruled Out" with the reason it was
   not viable (e.g., "Not approved by platform team — see policy [link]").
4. Never refuse to write the ADR — constraint-driven decisions still need documentation.

### Confluence or Jira context unavailable

Record Atlassian references as Links in the ADR. The engineer can paste relevant
content manually and the ADR remains valid without live MCP access.

### Option is infeasible on target platform

Do not present it as a full option with balanced pros/cons. Move it to "Options Ruled Out"
with a clear explanation and a documentation reference proving infeasibility. This prevents
reviewers from questioning why the option wasn't chosen.
