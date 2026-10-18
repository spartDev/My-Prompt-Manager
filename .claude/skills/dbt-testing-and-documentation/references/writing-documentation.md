<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Writing dbt Documentation

Never generate documentation that simply restates the entity's name. Describe **why, not just what**.

## Before Writing

Inspect the model before documenting it:
- Read the `.sql` file to understand transformations, filters, and joins
- Check existing `schema.yml` for descriptions already in place — enrich or correct them, do not blindly overwrite
- Run `dbt show --select <model_name>` to see real sample data if needed

To profile multiple columns at once, run a single query rather than querying each column separately:

```sql
SELECT
  COUNT(DISTINCT column_a)        AS column_a_cardinality,
  COUNT_IF(column_a IS NULL)      AS column_a_nulls,
  ARRAY_AGG(DISTINCT column_a)
    WITHIN GROUP (ORDER BY column_a)
    AS column_a_values,           -- use when cardinality is low
  COUNT(DISTINCT column_b)        AS column_b_cardinality,
  COUNT_IF(column_b IS NULL)      AS column_b_nulls
FROM {{ ref('model_name') }} TABLESAMPLE (1000 ROWS)
```

Use `TABLESAMPLE` on large tables to keep profiling fast. Adjust column list to match the model.

**When to list all possible values in the description** — a column warrants a "possible values" line when:
- Its cardinality is low (≤ 25 distinct values observed in the data), **or**
- Its name suggests a controlled vocabulary: `_type`, `_status`, `_category`, `_code`, `_flag`, `_level`, `_phase`, `_stage`, `_state`, `_kind`, `_class`, `_mode`, `_role`

```yaml
# Column with low-cardinality enum values
- name: project_status
  description: >
    Current lifecycle status of the project.
    Possible values: ACTIVE, ARCHIVED, ON_HOLD, CANCELLED.
```

Never guess values — always derive them from `dbt show` or a direct query.

## Model (Table) Level

Every model description must include:
1. **Grain** — one row per what?
2. **Purpose** — why does this model exist, what question does it answer?
3. **Edge cases** — filters applied, known nulls, exclusions, or historical quirks

```yaml
# Bad: restates the name
models:
  - name: active_customers
    description: All customers who are active

# Good: grain + purpose + edge case
models:
  - name: active_customers
    description: >
      One row per customer whose contract has not expired.
      Pre-filtered from the customers table for easier analytics consumption.
      Excludes customers with contract_expiry_date in the past.
      Does not include trial accounts (account_type = 'trial').
```

## Column Level

Document columns that are non-obvious. Skip columns whose name and type are self-explanatory (e.g. `created_at timestamp`).

Always document:
- **Calculated fields** — what the formula does and why
- **Encoded/prefixed values** — legacy formats, migrations, or system-specific conventions
- **Foreign keys** — what they reference
- **Nullable columns** — when and why nulls are expected

```yaml
# Bad: restates the column name
- name: customer_id
  description: The customer's identification number

# Good: explains non-obvious behavior
- name: customer_id
  description: >
    Unique customer identifier. Customers created before the platform migration
    have a legacy prefix in their ID.

# Good: explains calculated field
- name: days_since_last_order
  description: >
    Number of days between the customer's most recent order and today.
    Null if the customer has never placed an order.
```

## Sources

Document sources with the same "why not what" principle at both source and table level:

```yaml
sources:
  - name: crm
    description: >
      Raw data loaded from the CRM system. Tables reflect source schemas
      with no transformation applied.
    tables:
      - name: accounts
        description: >
          One row per account. Includes both active and archived records.
          Archived accounts have is_deleted = true and are excluded in staging.
```

## Tags

Use `tags` to make models and columns discoverable in the catalog by domain, team, or sensitivity:

```yaml
models:
  - name: fct_orders
    tags: [finance, certified, pii]
```

## meta

Use `meta` to attach structured, machine-readable metadata (ownership, classification, SLA). Fields are team-defined — align with your catalog conventions:

```yaml
models:
  - name: fct_orders
    description: "One row per confirmed order."
    meta:
      owner: data-platform-team
      classification: internal
      sla: 06:00 UTC
```

> `persist_docs` (pushing descriptions into warehouse column comments) is a project-level config set in `dbt_project.yml` by the project owner — not set per model.

## Updating Existing Documentation

When descriptions already exist:
- **Enrich** if the existing description is correct but incomplete
- **Correct** if it is factually wrong or outdated
- **Leave unchanged** if it is accurate and complete — do not rewrite for style

## What Not to Document

- Columns whose name and type are fully self-explanatory (`created_at`, `updated_at`, `id`)
- Descriptions that just repeat the column name in different words
- Implementation details that belong in code comments, not in the catalog
