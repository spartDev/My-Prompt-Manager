<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# [Short Title of Decision]

* Status: [proposed | rejected | accepted | deprecated | superseded by [ADR-NNN](ADR-NNN-slug.md)]
* Deciders: [list everyone involved]
* Date: [YYYY-MM-DD]

Technical Story: [description | ticket/issue URL]

## Context and Problem Statement

[2-3 sentences describing the context and problem. Articulate as a question when possible.]

## Decision Outcome

Chosen option: "[option]", because [justification].

### Positive Consequences

* [e.g., improvement of quality attribute, follow-up decisions enabled]

### Negative Consequences

* [e.g., trade-off accepted, follow-up work required]

## Decision Drivers

| Driver      | Description                          |
| ----------- | ------------------------------------ |
| [driver 1]  | [e.g., a force, facing concern]      |
| [driver 2]  | [description]                        |

## Considered Options

* [option 1]
* [option 2]
* [option 3]

### [Option 1]

[Brief description]

* **Pros**
  * Good, because [argument]
* **Cons**
  * Bad, because [argument]

### [Option 2]

[Brief description]

* **Pros**
  * Good, because [argument]
* **Cons**
  * Bad, because [argument]

### [Option 3]

[Brief description]

* **Pros**
  * Good, because [argument]
* **Cons**
  * Bad, because [argument]

## Architecture Manifesto Alignment

[Required. Map the decision to the relevant principles from the
[Sanofi Architecture Manifesto](https://sanofi.atlassian.net/wiki/spaces/DIGASTD/pages/60467430731/Architecture+Manifesto).
List only the principles that this decision directly impacts — do not list all 10.]

| # | Principle | Alignment | Notes |
| - | --------- | --------- | ----- |
| [N] | [principle name] | Aligned / Partial / Tension | [brief explanation] |

The 10 manifesto principles are:

1. **User Centricity** — Design solutions that delight users; mobile-first / responsive
2. **Simplicity** — KISS; don't over-engineer; don't assume future requirements
3. **Technical Debt** — Track and eliminate debt; don't add features to obsolete platforms
4. **Quality by Design** — Shift-left; embed quality, security, privacy, resilience from the start
5. **Security and Privacy** — Least privilege; data stores never publicly accessible
6. **Decoupling** — Decouple for autonomy and agility; smart endpoints, dumb pipes; reusable APIs
7. **Data Focus** — Minimize point-to-point integrations; proper data governance; data in same cloud
8. **Performance and Monitoring** — Observability; alerts on critical indicators; measure to learn
9. **Automation** — Code everything; use pre-built templates; automate rebuilds
10. **Frugality** — Right-size resources; optimize run cost; monitor spend with threshold alerts

Use these verdicts:
- **Aligned**: The decision directly supports this principle.
- **Partial**: The decision partially supports but has trade-offs against this principle.
- **Tension**: The decision conflicts with this principle — explain the trade-off and why it's acceptable.

## Options Ruled Out

[Optional. Use when an option was considered but ruled out early due to technical
infeasibility, platform constraints, or other hard blockers — not just preference.
Include the reason and a documentation reference.]

### [Ruled-Out Option]

Not viable because [reason with documentation reference].

## Cost Annex

[Optional. Include when the decision involves infrastructure, cloud services, or tooling
with variable pricing. Source data from vendor pricing APIs where possible.]

### Component Pricing

| Component | Rate | Source |
| --------- | ---- | ------ |
| [item]    | [$/hr or $/mo] | [vendor pricing page URL] |

### Scenario Comparison

| Scenario | Option A | Option B | Option C |
| -------- | -------- | -------- | -------- |
| [scenario 1] | $X/mo | $Y/mo | $Z/mo |

## Links

* [Related ADRs, tickets, or references]
