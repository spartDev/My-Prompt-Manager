---
name: architecture-documentation
disable-model-invocation: true
user-invocable: false
description: >
  C4 model architecture documentation with draw.io diagram generation, Confluence page
  templates, and versioning conventions. Use when: (1) creating or updating C4 architecture
  diagrams (System Context, Container, Component, Deployment, Dynamic), (2) publishing
  architecture docs to Confluence, (3) reviewing architectural changes, (4) detecting
  architecture from codebase analysis. Capabilities: draw.io XML templates with Sanofi
  color palette, Confluence storage-format page templates, semantic versioning for diagrams,
  codebase-to-C4 analysis heuristics, cross-repository documentation patterns. Do NOT use
  for general technical writing (use internal-comms), API documentation (OpenAPI/Swagger),
  or code-level documentation (JSDoc/docstrings).
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Architecture Documentation

C4 model patterns and draw.io templates for versioned architecture documentation.

## References

Load as needed:
- **C4 abstractions guide**: `references/c4-abstractions-guide.md` - Definitions and
  boundary rules for Person, Software System, Container, Component. Includes common
  mistakes (SPA = 2 containers, cloud services = containers, JARs != containers)
- **Draw.io templates**: `references/drawio-c4-templates.md` - Complete draw.io XML
  templates for each C4 level and supplementary diagrams (Deployment, Dynamic, Landscape)
  with C4 shapes, colors, 3-line labels, legend templates, and layout patterns
- **Confluence templates**: `references/confluence-page-templates.md` - Page body
  templates for each C4 level and supplementary diagrams with Confluence storage format
- **Codebase analysis patterns**: `references/codebase-analysis-patterns.md` - How to
  detect architecture from code: service boundaries, data flows, external integrations
- **Versioning guide**: `references/versioning-guide.md` - Versioning scheme, changelog
  format, and traceability patterns
- **C4 notation checklist**: `references/c4-notation-checklist.md` - Pre-publish
  validation checklist for C4 notation compliance, cross-level consistency, and draw.io
  technical correctness

## C4 Abstractions

Before creating diagrams, correctly classify elements: Person (human role),
Software System (team boundary = system boundary), Container (runtime boundary -- NOT
Docker; SPAs = 2 containers; cloud services you own = containers), Component (grouped
functionality, not separately deployable, 8-15 per diagram). Read
`references/c4-abstractions-guide.md` for full definitions, boundary rules, and common
mistakes.

---

## C4 Model Overview

> **Important**: The C4 model describes systems at various abstraction levels. It does NOT
> imply a specific design process, team structure, or delivery workflow. This agent uses C4
> within a Sanofi documentation workflow, but the C4 levels themselves are purely descriptive.

### Level 1: System Context

**What it shows**: The system as a single box surrounded by the people who use it and
the external systems it interacts with. This is a "zoomed out" big picture view.

**Audience**: Everybody, both technical and non-technical.

**Recommended**: Yes -- a System Context diagram is recommended for ALL teams.

**When to update**: New external integration, new user persona, system boundary change.

**Elements**:
- People / personas (who uses the system)
- The system itself (single box -- no internal details)
- External systems (systems we depend on or that depend on us)
- Relationships (labeled arrows with purpose -- NOT protocols at this level)

### Level 2: Container Diagram

**What it shows**: The high-level shape of the software architecture and how
responsibilities are distributed across containers.

**Audience**: Technical people (architects, developers, operations/support).

**Recommended**: Yes -- a Container diagram is recommended for ALL teams.

**When to update**: New service, new database, new frontend app, infrastructure change.

### Level 3: Component Diagram

**What it shows**: The internal structure of a single container -- groupings of related
functionality encapsulated behind well-defined interfaces.

**Audience**: Software architects and developers only.

**Recommended**: OPTIONAL. Only create if they add genuine value for understanding a
complex container.

### Level 4: Code Diagram

**What it shows**: Class/module level detail within a component.

**Recommended**: No. Most IDEs can generate this level of detail on demand.

**When to create**: Only on explicit request for a deep-dive into a specific component.
Not recommended for long-lived documentation.

**Key rule**: Show selectively -- include only the attributes and methods that tell the
story you want to tell, not a comprehensive class/module dump.

### Supplementary: Dynamic Diagram

**Audience**: Both technical and non-technical people, inside and outside the team.

**When to create**: SPARINGLY -- only for interesting/recurring patterns or features
requiring complex interaction sequences.

**Styles**: Collaboration (free-form layout, numbered interactions) or sequence (timeline layout).
Both convey the same information -- choose whichever best suits your audience.

**Rules**: Number interactions to indicate ordering (1, 2, 3...).

### Supplementary: Deployment Diagram

**What it shows**: How containers map to infrastructure in a specific deployment
environment (production, staging, dev).

**When to create**: Recommended for all teams to document production deployment topology.

**Rules**: Deployment nodes may be nested (e.g., AWS Region > Availability Zone > ECS Cluster > Container Instance). Infrastructure nodes (DNS, load balancers, firewalls) may be included. AWS/Azure/GCP provider icons are permitted if documented in the legend.

## Versioning Convention

Semantic versioning for architecture diagrams: MAJOR (system boundary changes, platform
migrations), MINOR (container/component additions or removals, new integrations), PATCH
(label fixes, description corrections). File naming:
`{system-name}-L{level}-v{version}.drawio`. Read `references/versioning-guide.md` for
full rules, changelog format, Jira linkage, file naming variants, retroactive
documentation, and archive policy.

## Confluence Page Structure

```text
{Confluence Space} /
  System Design /
    {System Name} Architecture Overview     <- Landing page with links to all levels
    +-- System Context (L1)                 <- L1 diagram + description + changelog
    +-- Container Diagram (L2)              <- L2 diagram + description + changelog
    +-- Component: API Service (L3)         <- L3 per container (only if valuable)
    +-- Deployment: Production (Supp.)      <- Deployment diagram per environment
    +-- Dynamic: Order Processing (Supp.)   <- Dynamic diagrams (sparingly)
    +-- Architecture Change Log             <- Master changelog across all levels
```

## Codebase Analysis Heuristics

How to detect architecture from code: service boundary detection (monorepo, multi-repo,
serverless consolidation, managed orchestration), data flow identification (HTTP, SQL,
queues, cache, storage), external system discovery (auth providers, payment SDKs,
analytics), and technology detection. Read `references/codebase-analysis-patterns.md`
for full heuristics, code search patterns, and a worked example.

## Scaling Large Systems

For systems with many containers or components, split into multiple focused diagrams rather
than cramming everything into one. Split strategies:

- **By business area**: One diagram per domain (e.g., "Order Processing", "User Management")
- **By bounded context**: One diagram per DDD bounded context
- **By service group**: One diagram per related cluster of microservices

Modelling tools (e.g., Structurizr) handle this better than diagramming tools (e.g., draw.io)
because they maintain a single model and generate multiple views. When using draw.io, maintain
consistency manually across split diagrams.

## Cross-Repository Documentation

When a system spans multiple repositories (e.g., separate backend and frontend repos):

### Unified Diagrams
- **L1 (System Context)**: The system is still a single box. Multiple repos do not change
  the system boundary -- they are an implementation detail.
- **L2 (Container)**: All containers from all repos appear within the same system boundary.
  Annotate each container's source repository in the description line.
- **L3 (Component)**: Scoped to a single container within a single repo. The diagram title
  should reference which repo contains the container.
- **Deployment**: May span repos (all containers deploy to shared infrastructure).

### Repo Annotation Convention
In the container description line, include the source repo:
```text
Line 1: **User API**
Line 2: [Container: Fastify / TypeScript]
Line 3: Handles user CRUD operations (repo: user-api)
```

This tells engineers which repo to consult for L3 deep-dives or code changes.

## Troubleshooting

### Codebase too large to analyze

**Cause**: Repository has thousands of files; analysis step is slow or incomplete.
**Solution**: Use `--repo` flag to scope to specific subdirectories. Start with Level 1 (System Context) which needs less detail.

### No Docker or infrastructure files found

**Cause**: Project uses serverless or platform-managed deployment not visible in the repo.
**Solution**: Ask the engineer about deployment targets. Add them manually to the Container diagram.

### Confluence page creation fails

**Cause**: MCP server disconnected or user lacks write permissions to the target space.
**Solution**: Save the Confluence storage-format content locally. The engineer can paste it manually.
