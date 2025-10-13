---
description: Plan architecture with validation, document in Confluence, create Jira tasks, and build implementation with agile tracking
allowed-tools: Editor, CreateFile, RunCommand, Browser, MCP, Bash
model: claude-sonnet-4-5-20250929
---

# Create Confluence Page (via Atlassian MCP Server)

## Introduction

Transform feature descriptions, bug reports, or improvement ideas into **well-structured Confluence pages** that suivent les conventions du projet et les bonnes pratiques. La commande s’adapte au niveau de détail désiré.

## Feature Description

<feature_description> #$ARGUMENTS </feature_description>

## Main Tasks

### 1. Repository/Workspace Research & Context Gathering

<thinking>
Je dois comprendre les conventions du projet (naming, templates, labels, glossaire), les patterns existants (Composants/UI, modules/backend), et les attentes doc (ADR, RFC, Conventions). J’utilise des sous-agents en parallèle.
</thinking>

Lancer ces trois agents en parallèle :

- Task repo-research-analyst(feature_description)
- Task best-practices-researcher(feature_description)
- Task framework-docs-researcher(feature_description)

**Reference Collection:**

- [ ] Consigner toutes les trouvailles avec chemins fichiers précis (ex: `app/services/example_service.rb:42`)
- [ ] Inclure des URLs vers docs externes & guides de bonnes pratiques
- [ ] Lister issues/PRs similaires (ex: `#123`, `#456`) et pages Confluence connexes
- [ ] Noter conventions d’équipe trouvées (`CLAUDE.md`, `CONTRIBUTING.md`, guide interne)

### 2. Page Planning & Structure

<thinking>
Pense produit : qu’est-ce qui rend la page claire, actionnable, partageable ? Multiples points de vue (PO, devs, QA, Sec, Ops).
</thinking>

**Title & Categorization:**

- [ ] Rédiger un **titre clair & searchable** (ex: `feat:`, `fix:`, `docs:`)
- [ ] Sélectionner **labels Confluence** pertinents (ex: `docs`, `rfc`, `backend`, `security`)
- [ ] Déterminer le **type de contenu** : Enhancement, Bug, Refactor, RFC, ADR, Post-mortem

**Stakeholder Analysis:**

- [ ] Qui est impacté ? (end-users, devs, ops, support, compliance)
- [ ] Complexité d’implémentation et expertise requise

**Content Planning:**

- [ ] Choisir le **niveau de détail** (MINIMAL / MORE / A LOT)
- [ ] Lister les sections nécessaires pour le template retenu
- [ ] Rassembler artefacts (logs, captures, schémas, maquettes)
- [ ] Préparer exemples de code/repro steps, **nommer les fichiers mock**

### 3. Choose Implementation Detail Level

#### 📄 MINIMAL (Quick Page)

**Best for:** Petits bugs, micro-améliorations, features évidentes

**Includes:**

- Problème ou description de feature
- Acceptance criteria de base
- Contexte essentiel

**Structure (Confluence Markdown/Wiki compatible):**

````markdown
[Brief problem/feature description]

h2. Acceptance Criteria

- [ ] Core requirement 1
- [ ] Core requirement 2

h2. Context

[Any critical information]

h2. MVP

*test.rb*
```ruby
class Test
  def initialize
    @name = "test"
  end
end
```

h2. References

Related issue: #[issue_number]

Documentation: [relevant_docs_url]

#### 📋 MORE (Standard Page)

**Best for:** La plupart des features, bugs complexes, collaboration d’équipe

**Includes everything from MINIMAL plus:**

- Background & motivation détaillés
- Considérations techniques
- Success metrics
- Dépendances & risques
- Suggestions d’implémentation

**Structure:**

```markdown
h2. Overview
[Comprehensive description]

h2. Problem Statement / Motivation
[Why this matters]

h2. Proposed Solution
[High-level approach]

h2. Technical Considerations
- Architecture impacts
- Performance implications
- Security considerations

h2. Acceptance Criteria
- [ ] Detailed requirement 1
- [ ] Detailed requirement 2
- [ ] Testing requirements

h2. Success Metrics
[How we measure success]

h2. Dependencies & Risks
[What could block or complicate this]

h2. References & Research
- Similar implementations: [file_path:line_number]
- Best practices: [documentation_url]
- Related PRs: #[pr_number]
```

#### 📚 A LOT (Comprehensive Page)

**Best for:** Gros sujets, changements d’architecture, intégrations complexes

**Includes everything from MORE plus:**

- Plan d’implémentation par phases
- Approches alternatives
- Spécifications techniques complètes
- Ressources & timeline
- Future considerations & extensibility
- Stratégies de mitigation
- Plan de documentation

**Structure:**

```markdown
h2. Overview
[Executive summary]

h2. Problem Statement
[Detailed problem analysis]

h2. Proposed Solution
[Comprehensive solution design]

h2. Technical Approach

h3. Architecture
[Detailed technical design]

h3. Implementation Phases

h4. Phase 1: [Foundation]
- Tasks and deliverables
- Success criteria
- Estimated effort

h4. Phase 2: [Core Implementation]
- Tasks and deliverables
- Success criteria
- Estimated effort

h4. Phase 3: [Polish & Optimization]
- Tasks and deliverables
- Success criteria
- Estimated effort

h2. Alternative Approaches Considered
[Other solutions evaluated and why rejected]

h2. Acceptance Criteria

h3. Functional Requirements
- [ ] Detailed functional criteria

h3. Non-Functional Requirements
- [ ] Performance targets
- [ ] Security requirements
- [ ] Accessibility standards

h3. Quality Gates
- [ ] Test coverage requirements
- [ ] Documentation completeness
- [ ] Code review approval

h2. Success Metrics
[Detailed KPIs and measurement methods]

h2. Dependencies & Prerequisites
[Detailed dependency analysis]

h2. Risk Analysis & Mitigation
[Comprehensive risk assessment]

h2. Resource Requirements
[Team, time, infrastructure needs]

h2. Future Considerations
[Extensibility and long-term vision]

h2. Documentation Plan
[What docs need updating]

h2. References & Research

h3. Internal References
- Architecture decisions: [file_path:line_number]
- Similar features: [file_path:line_number]
- Configuration: [file_path:line_number]

h3. External References
- Framework documentation: [url]
- Best practices guide: [url]
- Industry standards: [url]

h3. Related Work
- Previous PRs: #[pr_numbers]
- Related issues: #[issue_numbers]
- Design documents: [links]
```

### 4. Page Authoring & Confluence Formatting

<thinking>
Optimiser la lisibilité & actionnabilité sous Confluence (titres, macros, expand, code blocks, tables).
</thinking>

**Formatting:**

- [ ] Utiliser `h2.`, `h3.` … pour une hiérarchie claire
- [ ] Blocs de code (triple backticks) avec langage pour *highlighting*
- [ ] Ajouter captures/maquettes (drag & drop) ou via *Attachments*
- [ ] Listes de tâches `- [ ]` (ou *Task list* Confluence)
- [ ] Sections repliables avec macro *Expand* (`<details>` possible si Markdown rendu)
- [ ] Emojis utiles (🐛 bug, ✨ feature, 📚 docs, ♻️ refactor)

**Cross-Referencing & Confluence Goodies:**

- [ ] Lier issues/PRs avec #number et/ou URL
- [ ] Lier commits (SHA) en “permalink”
- [ ] Mentionner des personnes `@username`
- [ ] Ajouter **labels Confluence** (ex: `rfc`, `adr`, `architecture`, `frontend`)
- [ ] Utiliser macros utiles : *Info/Warning Panels*, *Table of Contents*, *Code*, *Expand*
- [ ] Joindre fichiers : logs, CSV, diagrammes

**Code & Examples:**

```markdown
h3. Good example with code + line refs

```ruby
# app/services/user_service.rb:42
def process_user(user)
  # Implementation here
end
```

h3. Collapsible error logs (Macro Expand)
{expand:title=Full error stacktrace}
```
Error details here...
```
{expand}
```

**AI-Era Considerations:**

- [ ] Documenter prompts/approches qui ont bien marché
- [ ] Noter quels outils AI ont été utilisés (Claude, Copilot, Cursor)
- [ ] Insister sur les tests compte tenu de la vélocité d’implémentation
- [ ] Marquer tout code généré à relire humainement

### 5. Final Review & Publication

**Pre-publication Checklist:**

- [ ] Titre clair & searchable
- [ ] Labels pertinents
- [ ] Toutes les sections complètes
- [ ] Liens & références OK
- [ ] Acceptance criteria mesurables
- [ ] Noms de fichiers dans exemples & TODO
- [ ] Ajouter un diagramme ERD (```mermaid) si nouveau modèle

## Output Format

Présenter le contenu complet de la page dans des balises `<confluence_page>` prêt à être publié par l’Atlassian MCP Server.

Exemple d’appel (pseudo-MCP) :

```json
{
  "tool": "atlassian.confluence.create_page",
  "args": {
    "spaceKey": "MPM",
    "title": "[TITLE]",
    "ancestors": [{"id": "$PARENT_PAGE_ID"}],
    "labels": ["docs","rfc"],
    "body": {
      "representation": "wiki", 
      "value": "<confluence_page>[CONTENT]</confluence_page>"
    }
  }
}
```

> Remarques :
> - `spaceKey` est requis (ex: `ENG`, `PROD`, `RD`).
> - `ancestors` est optionnel si tu publies à la racine du Space.
> - `representation` peut être `wiki` (storage) ou `editor` selon ton MCP.
> - Si la page existe, utiliser `atlassian.confluence.update_page` avec `id` + `version`.

Call the atlassian mcp server to create the page on the MPM space.

## Thinking Approaches

- **Analytical:** Décomposer en composants maîtrisables
- **User-Centric:** Impact & expérience utilisateur
- **Technical:** Complexité & fit architectural
- **Strategic:** Alignement roadmap & objectifs