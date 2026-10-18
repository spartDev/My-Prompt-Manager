---
disable-model-invocation: true
argument-hint: PROJ-123
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Architecture Decision Record

Spawns the `adr-assistant` agent to execute the workflow.

Follow the agent's workflow to bootstrap Atlassian MCP, gather decision context, and write or review an ADR using the MADR template with structured pros/cons analysis.

## Arguments

`$ARGUMENTS` - Decision title, Jira ticket key, or review target:

- `PROJ-123` - Fetch the Jira ticket and use it as decision context
- `use Redis for session caching` - Decision title for write mode
- `review https://sanofi.atlassian.net/wiki/x/...` - Review an existing ADR on Confluence
- `review docs/adr/ADR-005-slug.md` - Review a local ADR file
