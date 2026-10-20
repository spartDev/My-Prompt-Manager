---
name: dbt-testing-and-documentation
description: >
  Guidelines for writing high-value dbt data tests and dbt model/column documentation.
  Use when adding tests to new or existing dbt models, reviewing test coverage for cost
  optimization, when stakeholders report data quality issues, or when documenting dbt
  models, sources, and columns (descriptions, tags, meta). Covers multi-layer test
  strategy with a Tier 1-4 prioritization framework, grain-aware uniqueness testing,
  test severity, and conventions for model/source/column documentation.
  Triggered by: "document this model", "add tests", "review test coverage", "write schema.yml",
  "documenter ce modèle", "ajoute des tests", "génère la doc dbt", "schema pour",
  "tests dbt", "qualité des données".
  Do NOT use for dbt model authoring, dbt package management, or SQL transformation work. For data contracts, use the datacontract-writing skill.
allowed-tools: Read Grep Glob Bash
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# dbt Tests and Doc

Provides conventions for dbt testing and documentation so quality checks stay high-signal
and model metadata stays useful for downstream users.

## Core Rule

**Always read the actual model schema before writing any test or documentation.**
Column names, grain keys, and nullability must be derived from the real project files —
never copy example column names from this skill verbatim. Examples here illustrate
patterns only; adapt every name, type, and constraint to the model at hand.

## Workflows

**Prefer documentation before testing.** When docs already exist, proceed directly to tests.

Route to the workflow that matches the task:

- **Writing dbt documentation** -> read [`references/writing-documentation.md`](references/writing-documentation.md)
  and follow its instructions. Use when adding or updating model/column descriptions,
  source metadata, tags, or `meta`.
- **Writing or reviewing dbt data tests** -> read [`references/writing-data-tests.md`](references/writing-data-tests.md)
  and follow its instructions. Use when adding tests to new models, auditing existing
  test coverage for cost vs. value, or triaging stakeholder data quality reports.

If a task spans both (e.g. adding a new mart), run documentation first, then tests.
