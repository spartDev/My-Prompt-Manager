<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Writing Data Tests in dbt

Write high-value tests that catch real data issues without burning warehouse credits on low-signal checks. Testing should drive action, not accumulate alerts.

> **Column names in this file are illustrative only.** Every team has its own schema and naming conventions. Always read the actual model files (`schema.yml`, `.sql`) to derive real column names, grain keys, and nullability before writing any test.

## Before Writing Tests

**Understand the model before writing any test.** How you do this depends on the task:

- **Task is `tests` only** → inspect the existing `schema.yml` and model `.sql` file to understand grain, column types, and nullability. Do not write or modify documentation.
- **Task is `both`** → follow [`writing-documentation.md`](writing-documentation.md) first to write the documentation, then use that output as the basis for tests.

Check that `dbt_utils` is installed in your `packages.yml` before using any `dbt_utils.*` tests:

```yaml
packages:
  - package: dbt-labs/dbt_utils
    version: [">=1.0.0", "<2.0.0"]
```

## Grain and Uniqueness

"No duplicates" means no duplicates on the **grain key**, not necessarily on the entity key. Always declare the grain in the model description.

| Model type | Grain key | Test to use |
|------------|-----------|-------------|
| Point-in-time (standard) | `entity_id` | `unique` on that column |
| Historized / SCD | `entity_id + valid_from` | `unique_combination_of_columns` |
| dbt snapshot | `entity_id + dbt_scd_id` | `unique` on `dbt_scd_id` |
| Multi-dimensional (fact / analytics) | `dim1 + dim2 + ... + date` | `unique_combination_of_columns` on all grain columns |

Use `dbt_utils.unique_combination_of_columns` whenever the grain spans more than one column:

```yaml
models:
  - name: fct_indication_country_metrics
    description: "One row per indication, country, and reporting date."
    data_tests:
      - dbt_utils.unique_combination_of_columns:
          arguments:
            combination_of_columns:
              - indication_id
              - country_code
              - report_date
```

## Where Tests Belong

Layer names vary by team (`stg`, `psa`, `bronze`, `raw`, `dwh`, `int`, `intermediate`, `silver`, `marts`, `dmt`, `gold`). Apply the logic below based on what each layer **does**, not what it is called.

| Layer | Purpose | Focus |
|-------|---------|-------|
| Ingestion (`stg`, `psa`, `bronze`, `raw`) | First contact with source data | Structural integrity: PKs, FKs, accepted values, nulls |
| Transformation (`int`, `intermediate`, `silver`, `dwh`) | Joins, grain changes, enrichment | New composite keys, post-join uniqueness |
| Consumption (`marts`, `dmt`, `gold`, `reporting`) | End-user facing | Business invariants, calculated field correctness |

Don't duplicate tests for pass-through columns — test each column at the layer where it first appears.

## Priority Framework

Tests are defined either at **column level** (under a specific column in `columns:`) or at **model level** (under `data_tests:` directly on the model). The table below shows both.

| Tier | When | Test | Level | Why |
|------|------|------|-------|-----|
| **1 — Always** | Primary key column | `unique` + `not_null` | column | Broken PKs break everything downstream |
| **1 — Always** | Foreign key column | `relationships` | column | Catches broken joins early |
| **1 — Always** | Grain spans multiple columns | `unique_combination_of_columns` | model | Single-column `unique` won't work |
| **2 — When warranted** | Enum column with known values (verified via `dbt show`) | `accepted_values` | column | Catches new invalid values |
| **2 — When warranted** | Non-PK column confirmed 0% nulls | `not_null` | column | Catches regressions |
| **3 — Selective** | Multi-column business invariant | `expression_is_true` | model | Detects subtle logic bugs |
| **3 — Selective** | Constrained numeric/date range | `accepted_range` | column | Avoids illogical values |
| **4 — Avoid** | `not_null` on every column | — | — | Low signal, high cost |
| **4 — Avoid** | Multiple `expression_is_true` per model | — | — | Expensive, hard to maintain |
| **4 — Avoid** | `unique` on non-PK columns | — | — | Unnecessary and likely wrong |

## Test Severity

By default every test has `severity: error` — a failure stops the run. Use `severity: warn` when a failure is informational but should not block the pipeline.

| Tier | Severity | Rationale |
|------|----------|-----------|
| Tier 1 (PK, FK) | `error` | Data is broken — never let it pass downstream |
| Tier 2 (nulls, accepted values) | `error` or `warn` | Use `error` when used in joins or calculations, `warn` when informational only |
| Tier 3 (business logic) | `warn` | Flag anomalies without blocking; investigate async |

Set severity via `config:` on the test:

```yaml
# Column-level test with warn
- name: customer_id
  data_tests:
    - relationships:
        to: ref('dim_customers')
        field: customer_id
        config:
          severity: warn

# Model-level test with warn + thresholds
data_tests:
  - dbt_utils.expression_is_true:
      arguments:
        expression: "total_amount >= 0 OR is_refund = true"
      config:
        severity: warn
        warn_if: ">= 1"
        error_if: ">= 100"
```

Use `warn_if` / `error_if` thresholds when a small number of failures is acceptable but a large number indicates a real problem.

## Document Debugging Steps

For simple tests (`unique`, `not_null`, `relationships`) no description is needed — the failure is self-explanatory.

For complex tests (`expression_is_true`, `accepted_range`, custom business logic), always add a `description` field with the first steps to investigate when the test fails. This acts as an inline runbook for the engineer who will debug it:

```yaml
- dbt_utils.expression_is_true:
    arguments:
      expression: "total_amount >= 0 OR is_refund = true"
    description: |
      Negative totals indicate calculation errors.
      Debug steps:
      1. Query failed rows using test SQL
      2. Check source line_items for the same records
      3. Verify discount logic in the transformation model
```

## Cost-Conscious Testing

For large tables, use `where` to limit scope:

```yaml
- relationships:
    arguments:
      to: ref('dim_users')
      field: user_id
    config:
      where: "created_at >= current_date - interval '7 days'"
```

## Common Mistakes

### Over-testing business logic

Test data assumptions, not SQL correctness.

```yaml
# WRONG: verifying that SQL ran correctly
- dbt_utils.expression_is_true:
    arguments: {expression: "a > 0"}
- dbt_utils.expression_is_true:
    arguments: {expression: "b > 0"}
# ... 8 more

# RIGHT: one critical business invariant
- dbt_utils.expression_is_true:
    arguments: {expression: "total = subtotal + tax + shipping"}
```

### Assuming you know the contents of a table

Never write `accepted_values` without first checking real values via `dbt show` or a direct query.

```yaml
# WRONG: guessed values
- accepted_values:
    arguments:
      values: ['placed', 'shipped', 'completed', 'returned']

# RIGHT: verified values from actual data
- accepted_values:
    arguments:
      values: ['created', 'processing', 'shipped', 'delivered', 'refunded']
```
