<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# C4 Notation Checklist

Pre-publish validation checklist for C4 diagrams. Run through ALL applicable sections
before presenting a diagram to the engineer for review.

## Table of Contents

- [1. Cross-Level Consistency Checks](#1-cross-level-consistency-checks)
  - [Naming Consistency](#naming-consistency)
  - [Element Consistency](#element-consistency)
  - [Relationship Consistency](#relationship-consistency)
- [2. C4 Notation Compliance](#2-c4-notation-compliance)
  - [Diagram Titles](#diagram-titles)
  - [Legend / Key](#legend--key)
  - [Element Labels](#element-labels)
  - [Relationship Labels](#relationship-labels)
  - [Protocol Labels](#protocol-labels)
  - [Arrow Styles](#arrow-styles)
- [3. Abstraction Correctness](#3-abstraction-correctness)
  - [SPA Rule](#spa-rule)
  - [Cloud Services Rule](#cloud-services-rule)
  - [Not-a-Container Checks](#not-a-container-checks)
  - [Not-a-Component Checks](#not-a-component-checks)
  - [Component Diagram Necessity](#component-diagram-necessity)
- [4. Draw.io Technical Checks](#4-drawio-technical-checks)
  - [XML Validity](#xml-validity)
  - [Cell IDs](#cell-ids)
  - [Root Element](#root-element)
  - [Label Format](#label-format)
- [5. Sanofi-Specific Checks](#5-sanofi-specific-checks)
  - [Color Palette](#color-palette)
  - [Naming Conventions](#naming-conventions)
  - [Metadata](#metadata)
  - [Description Templates](#description-templates)
- [6. Per-Level Review Checklists](#6-per-level-review-checklists)
  - [Context Diagram (L1) Review](#context-diagram-l1-review)
  - [Container Diagram (L2) Review](#container-diagram-l2-review)
  - [Component Diagram (L3) Review](#component-diagram-l3-review)
  - [Deployment Diagram Review](#deployment-diagram-review)
- [7. Anti-Patterns Check](#7-anti-patterns-check)
- [8. Element Count Guidelines](#8-element-count-guidelines)

---

## 1. Cross-Level Consistency Checks

These checks ensure all C4 levels tell a coherent story.

### Naming Consistency

- [ ] The system name is identical across L1, L2, and L3 diagrams
- [ ] Container names in L2 match exactly when referenced in L3 boundary boxes
- [ ] External system names are identical across all levels where they appear
- [ ] Person/persona names are identical across all levels where they appear
- [ ] No synonyms used across levels (e.g., "User Service" in L1 and "Users API" in L2)

### Element Consistency

- [ ] Every container shown in L2 corresponds to the single system box in L1
- [ ] Every component shown in L3 belongs to a container shown in L2
- [ ] External systems in L2/L3 match those in L1
- [ ] No "orphan" elements appear in lower levels that are not traceable to higher levels
- [ ] People shown at L2/L3 are also present at L1

### Relationship Consistency

- [ ] High-level relationships in L1 are decomposed into specific container-level
      relationships in L2 (no relationship disappears when zooming in)
- [ ] Protocol labels at L2 are consistent with the technology labels on containers
- [ ] Direction of data flow is consistent across levels

---

## 2. C4 Notation Compliance

### Diagram Titles

- [ ] Every diagram has a title
- [ ] Title format: "{Diagram Type} for {System/Container/Scope Name}"
- [ ] Examples: "System Context diagram for User Platform",
      "Container diagram for User Platform",
      "Component diagram for User Platform API"

### Legend / Key

- [ ] Every diagram has a legend in the bottom-right corner
- [ ] Legend explains all shapes used (Person, System, Container, Component)
- [ ] Legend explains all colors used (blue, grey, teal, etc.)
- [ ] Legend explains line styles (solid = synchronous, dashed = asynchronous)
- [ ] Legend explains any icons (AWS icons, etc.)
- [ ] Legend has a visible background box to distinguish it from diagram elements

### Element Labels

- [ ] Every element uses the 3-line label format:
      Line 1: **Name** (bold)
      Line 2: [Type: Technology]
      Line 3: Short description
- [ ] Names are concise but descriptive
- [ ] Type is explicitly stated (Person, Software System, Container, Component)
- [ ] Technology is specified for all containers and components
- [ ] Description provides an "at a glance" view of key responsibilities
- [ ] No element is unlabeled

### Relationship Labels

- [ ] Every arrow has a label
- [ ] Labels use specific action verbs (NOT generic "Uses", "Calls", "Connects to")
- [ ] Good examples: "Reads user profiles from", "Sends order events to",
      "Authenticates via", "Stores uploaded files in"
- [ ] Bad examples: "Uses", "Calls", "Connects", "Interacts with"
- [ ] Labels are consistent with arrow direction (source -> target)

### Protocol Labels

- [ ] Container-level relationships include protocol/technology labels
- [ ] Format: "[HTTP/REST]", "[SQL/TCP]", "[gRPC]", "[AMQP]", "[SQS/HTTPS]"
- [ ] Protocol labels appear either on the relationship label or as a second line
- [ ] L1 (System Context) relationships do NOT have protocol labels (abstraction level)

### Arrow Styles

- [ ] All arrows are unidirectional (one arrowhead, showing data/control flow direction)
- [ ] No bidirectional arrows (use two separate arrows if needed)
- [ ] Solid lines = synchronous communication
- [ ] Dashed lines = asynchronous communication (queues, events, fire-and-forget)
- [ ] Dotted lines = dependencies (compile-time, structural -- use sparingly)
- [ ] Arrow style: `endArrow=blockThin`

> **Note**: The C4 model is notation-independent regarding line styles. The solid/dashed/dotted
> convention above is a Sanofi standard for consistency across teams.

---

## 3. Abstraction Correctness

### SPA Rule

- [ ] Single-page applications are modeled as TWO containers:
      1. Client-side JS app (React running in browser)
      2. Server-side API (backend serving API + delivering SPA assets)
- [ ] NOT modeled as a single "Web App" container
- [ ] Relationship between SPA and API shows HTTP/REST communication

### Cloud Services Rule

- [ ] AWS services your team owns/manages (S3 buckets, RDS instances, DynamoDB tables,
      ElastiCache clusters, SQS queues) are modeled as **containers** within your system
- [ ] Third-party cloud services you do not own are modeled as **external systems** (grey)
- [ ] Managed services (e.g., AWS Cognito for auth) may be external if you only consume them

### Not-a-Container Checks

- [ ] No JAR files, C# assemblies, or DLLs modeled as containers
- [ ] No npm packages or Python modules modeled as containers
- [ ] No Terraform modules modeled as containers
- [ ] No Dockerfiles modeled as containers (Dockerfiles are build artifacts, not runtime)
- [ ] No tools or frameworks modeled as containers (annotate as [Technology] on the container that uses them)

### Not-a-Component Checks

- [ ] No folders or directories modeled as components
- [ ] No namespaces or packages modeled as components
- [ ] No individual classes modeled as components (too granular -- belongs at L4)
- [ ] No config files or data models modeled as components
- [ ] No ports (inbound/outbound) modeled as components (ports are interfaces -- add as notes to containers instead)
- [ ] No tools or frameworks modeled as systems, containers, or components (annotate as comments on the element that uses them)

### Component Diagram Necessity

- [ ] L3 diagrams only exist for containers where they add genuine value
- [ ] Simple CRUD services do NOT have L3 diagrams
- [ ] Complex containers with significant internal architecture DO have L3 diagrams

---

## 4. Draw.io Technical Checks

### XML Validity

- [ ] XML is well-formed (parseable by any XML parser)
- [ ] All tags are properly opened and closed
- [ ] All attribute values are properly quoted
- [ ] Special characters in labels are properly escaped (`&amp;`, `&lt;`, `&gt;`)

### Cell IDs

- [ ] All `mxCell` elements use numeric IDs (2, 3, 4, 5...)
- [ ] Cell ID "0" is the root cell
- [ ] Cell ID "1" is the default parent layer
- [ ] No string-based cell IDs (no "cell-1", "system-box", etc.)
- [ ] IDs are sequential and unique within the diagram

### Root Element

- [ ] No XML comments (`<!-- -->`) inside the `<root>` element
- [ ] Comments may appear outside `<root>` if absolutely needed
- [ ] No extraneous text nodes inside `<root>`

### Label Format

- [ ] Labels use HTML format with `html=1` in the style
- [ ] Bold text uses `<b>` tags
- [ ] Line breaks use `<br>` tags
- [ ] Small text uses `<font style="font-size:11px">`
- [ ] No raw newlines in label text (use `<br>`)

---

## 5. Sanofi-Specific Checks

> **Note**: The C4 model is notation-independent regarding colors. The palette below is a
> Sanofi standard. The official C4 guidance: use any colors, but keep them consistent within
> and across diagrams, and consider accessibility.

### Color Palette

- [ ] Person elements: `fillColor=#0047BB` (Sanofi Blue)
- [ ] System (in scope): `fillColor=#0047BB` (Sanofi Blue)
- [ ] System (external): `fillColor=#6D6E71` (Sanofi Gray)
- [ ] Container: `fillColor=#4B9CD3` (Sanofi Light Blue)
- [ ] Component: `fillColor=#00A3E0` (Sanofi Teal)
- [ ] All text on colored elements: `fontColor=#ffffff` (white)
- [ ] Boundary boxes: `strokeColor=#888888`, `fillColor=none`
- [ ] Arrows: `strokeColor=#707070`
- [ ] No default draw.io colors used (no bright yellow, green, red)
- [ ] Colors are distinguishable when printed in grayscale
- [ ] Color choices consider color blindness (avoid relying on red/green distinction alone)

### Naming Conventions

- [ ] Systems follow `[Product Name] System` pattern
- [ ] Containers follow `[System Name] [Container Type]` pattern
- [ ] Components follow `[Responsibility] [Component Type]` pattern
- [ ] Persons follow `[Role] [Optional: Organization]` pattern
- [ ] File naming: `{system-name}-L{level}-v{version}.drawio`

### Metadata

- [ ] Confluence page includes full metadata table (System ID, owners, classification,
      status, compliance, technology stack, SLA, DR)
- [ ] All mandatory metadata fields are populated
- [ ] System ID matches the organization's APM/CMDB registry

### Description Templates

- [ ] System descriptions follow: "[System Name] provides [capability] to [users]..."
- [ ] Container descriptions follow: "[Container Name] is a [type] that provides..."
- [ ] Component descriptions follow: "[Component Name] is responsible for..."

---

## 6. Per-Level Review Checklists

### Context Diagram (L1) Review

- [ ] All key stakeholders and user personas identified
- [ ] System boundaries clearly defined (one system box)
- [ ] External dependencies documented (all grey boxes)
- [ ] Data flows indicated with correct directionality
- [ ] No technology details or protocols shown
- [ ] Business value clearly articulated in system description
- [ ] Consistent with enterprise architecture (if exists)
- [ ] Required metadata complete on Confluence page
- [ ] Element count: typically 5-10 elements

### Container Diagram (L2) Review

- [ ] All containers clearly labeled with technology
- [ ] Data stores identified with data classification
- [ ] User interfaces distinguished from APIs
- [ ] Security boundaries marked
- [ ] Integration patterns identified (sync/async)
- [ ] SPA rule applied (2 containers for SPAs)
- [ ] Cloud services modeled as containers (not external)
- [ ] Consistent with context diagram (same system, same external systems)
- [ ] Protocol labels on all relationships
- [ ] Element count: typically 8-12 elements

### Component Diagram (L3) Review

- [ ] Component responsibilities clearly defined
- [ ] Interfaces explicitly documented
- [ ] Data access patterns identified
- [ ] Business logic separation evident
- [ ] Cross-cutting concerns addressed (auth, logging)
- [ ] Consistent with container diagram (same container boundary)
- [ ] Other containers shown as context (grey/blue)
- [ ] Element count: 8-15 components (max 20)

### Deployment Diagram Review

- [ ] Deployment nodes labeled with infrastructure type
- [ ] Container instances mapped to correct deployment nodes
- [ ] Scaling information noted (replicas, auto-scaling)
- [ ] Network boundaries and security groups shown
- [ ] Load balancers and routing shown
- [ ] AWS region and AZ information included
- [ ] Consistent with L2 containers (every container deployed somewhere)

---

## 7. Anti-Patterns Check

- [ ] No spaghetti (too many crossing lines -- rearrange layout if more than 3 crossings)
- [ ] No inconsistent abstraction (mixing Systems and Components in one diagram)
- [ ] No technology overload (too much tech detail at L1 -- keep L1 abstract)
- [ ] No missing interfaces (components connecting without defined APIs)
- [ ] No distributed monolith appearance (tight coupling between supposedly independent services)
- [ ] No big ball of mud (unclear boundaries, everything connected to everything)
- [ ] No outdated documentation (diagrams match current codebase)

---

## 8. Element Count Guidelines

| Diagram Level | Target | Maximum | Action if Exceeded |
|--------------|--------|---------|-------------------|
| L1 System Context | 5-10 | 12 | Group external systems by category |
| L2 Container | 8-12 | 15 | Split into multiple views or use boundary boxes |
| L3 Component | 8-15 | 20 | Reconsider grouping strategy |
| Deployment | 8-12 | 15 | Focus on one AZ or one service group |
| Dynamic | 5-8 | 12 | Focus on one specific use case |

If a diagram exceeds the maximum, consider:
1. Splitting into multiple focused diagrams
2. Using boundary boxes to group related elements
3. Moving detail to a lower C4 level
4. Creating supplementary views for specific aspects
