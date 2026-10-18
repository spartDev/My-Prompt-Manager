---
name: datacontract-writing
disable-model-invocation: true
user-invocable: false
description: >
  Provides ODCS v3.1.0 templates, type mapping tables, quality rule patterns, and guidelines
  for writing data contracts. Use when creating data contracts, documenting dataset schemas,
  or when user says "write a data contract", "document this dataset", or "generate an ODCS contract".
  Do NOT use for general documentation, API contracts (OpenAPI/Swagger), or non-schema work.
metadata:
  author: Sanofi-Accelerator
  version: 1.0.0
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Writing Data Contracts (ODCS v3.1.0)

Creates data contracts following the
[Open Data Contract Standard v3.1.0](https://github.com/bitol-io/open-data-contract-standard).

## Output Directory Convention

Data contracts live in `datacontracts/`. If the directory does not exist, create it.

## Contract Scope

A contract represents a **database schema** (one or more tables), not a single table.
The contract `name` is derived from the database schema name, kebab-cased.

| Source | Contract name derived from | Example |
|--------|---------------------------|---------|
| Snowflake `DB.SCHEMA` or `DB.SCHEMA.TABLE` | Schema name | `DMT_TRIALTROVE` -> `dmt-trialtrove` |
| dbt project | dbt model group or directory | `models/staging/` -> `staging` |
| SQL DDL file | File name (without extension) | `create_orders.sql` -> `create-orders` |

## File Naming

Format: `{contract-name}.odcs.yaml`

1. Use the contract `name` field value (kebab-case), derived from the database schema name
2. Always use the `.odcs.yaml` extension
3. Examples: `dmt-trialtrove.odcs.yaml`, `public-orders.odcs.yaml`

## Type Mapping Tables

These tables map source types to ODCS logical types. Use `logicalType` for the contract
and `physicalType` for the database-specific representation.

### Snowflake to ODCS

| Snowflake Type | ODCS logicalType | Notes |
|----------------|------------------|-------|
| `VARCHAR(n)`, `STRING`, `TEXT` | `string` | Preserve length in physicalType |
| `NUMBER(p,0)`, `INTEGER`, `INT`, `BIGINT`, `SMALLINT` | `integer` | Zero-scale NUMBER is integer |
| `NUMBER(p,s)`, `FLOAT`, `DOUBLE`, `REAL` | `number` | Non-zero scale is decimal |
| `DECIMAL(p,s)`, `NUMERIC(p,s)` | `number` | Preserve precision in physicalType |
| `BOOLEAN` | `boolean` | |
| `DATE` | `date` | |
| `TIMESTAMP`, `TIMESTAMP_NTZ`, `TIMESTAMP_LTZ`, `TIMESTAMP_TZ` | `timestamp` | Note timezone variant in physicalType |
| `TIME` | `string` | No ODCS time type; use string with format note |
| `VARIANT`, `OBJECT`, `ARRAY` | `object` | Semi-structured types |
| `BINARY`, `VARBINARY` | `string` | Encode as base64; note in description |
| `GEOGRAPHY`, `GEOMETRY` | `object` | Spatial types; note format in description |

### SQL (ANSI/PostgreSQL/MySQL) to ODCS

| SQL Type | ODCS logicalType | Notes |
|----------|------------------|-------|
| `VARCHAR(n)`, `CHAR(n)`, `TEXT`, `CLOB` | `string` | Preserve length in physicalType |
| `INTEGER`, `INT`, `BIGINT`, `SMALLINT`, `TINYINT`, `SERIAL` | `integer` | |
| `DECIMAL(p,s)`, `NUMERIC(p,s)`, `FLOAT`, `DOUBLE`, `REAL` | `number` | |
| `BOOLEAN`, `BOOL`, `BIT` | `boolean` | |
| `DATE` | `date` | |
| `TIMESTAMP`, `DATETIME`, `TIMESTAMPTZ` | `timestamp` | |
| `TIME`, `TIMETZ` | `string` | No ODCS time type |
| `JSON`, `JSONB` | `object` | |
| `BYTEA`, `BLOB`, `BINARY` | `string` | Binary; note encoding |
| `UUID` | `string` | Note UUID format in description |
| `INTERVAL` | `string` | Duration; note ISO 8601 format |
| `ARRAY` | `array` | |

### dbt to ODCS

dbt `data_type` values depend on the adapter. When a dbt model specifies `data_type`:

| dbt data_type | ODCS logicalType | Notes |
|---------------|------------------|-------|
| `string`, `varchar`, `text` | `string` | |
| `integer`, `int`, `bigint` | `integer` | |
| `float`, `double`, `numeric`, `decimal`, `number` | `number` | |
| `boolean`, `bool` | `boolean` | |
| `date` | `date` | |
| `timestamp`, `datetime` | `timestamp` | |
| `variant`, `json`, `object` | `object` | |
| _(missing)_ | `string` | Default when dbt model has no data_type |

## Quality Rule Patterns

Suggest quality rules based on column characteristics. These are suggestions -- the user
approves which rules to include.

**ODCS v3.1.0 quality structure** -- quality rules are placed at the **schema object level**
(table-level checks) or **property level** (column-specific checks). Do NOT use a root-level
`quality` section with `column` references.

**Strict vocabulary** -- use ONLY these values:
- **type**: `library` (default, for built-in metrics), `sql` (for custom queries), `custom` (for external engines), `text` (descriptive only)
- **metric** (library type only): `nullValues`, `missingValues`, `invalidValues`, `duplicateValues`, `rowCount`
- **dimension**: `accuracy`, `completeness`, `conformity`, `consistency`, `coverage`, `timeliness`, `uniqueness`
- **operators**: `mustBe`, `mustNotBe`, `mustBeGreaterThan`, `mustBeGreaterOrEqualTo`, `mustBeLessThan`, `mustBeLessOrEqualTo`, `mustBeBetween`, `mustNotBeBetween`

### Auto-Suggested Rules

| Condition | Metric | Dimension | Operator | Level |
|-----------|--------|-----------|----------|-------|
| Column is `NOT NULL` or `isNullable: false` | `nullValues` | completeness | `mustBe: 0` | property |
| Column is primary key | `duplicateValues` | uniqueness | `mustBe: 0` | property |
| Column is primary key | `nullValues` | completeness | `mustBe: 0` | property |
| Column has `UNIQUE` constraint | `duplicateValues` | uniqueness | `mustBe: 0` | property |
| Column has `CHECK` constraint with value list | `invalidValues` | conformity | `mustBe: 0` | property |
| Table exists (always) | `rowCount` | completeness | `mustBeGreaterOrEqualTo: 1` | schema object |
| Timestamp column suggesting recency | _(use sql type)_ | timeliness | SQL query | property |

### Quality Rule Examples

**Schema object level** (table-level rules like rowCount):

```yaml
schema:
  - name: orders
    description: Customer orders
    type: table
    quality:
      - type: library
        description: Orders table must contain at least one row
        dimension: completeness
        metric: rowCount
        mustBeGreaterOrEqualTo: 1
```

**Property level** (column-specific rules):

```yaml
    properties:
      - name: order_id
        description: Unique order identifier
        logicalType: integer
        physicalType: INTEGER
        isPrimaryKey: true
        isNullable: false
        isUnique: true
        quality:
          - type: library
            description: order_id must be unique across all rows
            dimension: uniqueness
            metric: duplicateValues
            mustBe: 0
          - type: library
            description: order_id must not contain null values
            dimension: completeness
            metric: nullValues
            mustBe: 0

      - name: updated_at
        description: Timestamp when the record was last updated
        logicalType: timestamp
        physicalType: TIMESTAMP_TZ
        quality:
          - type: sql
            description: Data should be updated within the last 24 hours
            dimension: timeliness
            query: "SELECT COUNT(*) FROM ${table} WHERE ${column} >= DATEADD('day', -1, CURRENT_TIMESTAMP())"
            mustBeGreaterOrEqualTo: 1

      - name: status
        description: Current order status
        logicalType: string
        physicalType: VARCHAR(50)
        quality:
          - type: library
            description: Status must not have invalid values
            dimension: conformity
            metric: invalidValues
            mustBe: 0
            arguments:
              values: ['placed', 'shipped', 'completed', 'returned']
```

## Workflows

Step-by-step orchestration for generating data contracts:

- **Source parsing** (dbt, Snowflake, SQL DDL extraction patterns): `references/source-parsing.md`
- **ODCS template** (minimal and full contract YAML, field reference): `references/odcs-template.md`

## Guidelines

- Generate an `id` value (UUID v4) for each new contract (use `uuidgen` via Bash or equivalent). The ODCS field name is `id`, not `uuid`.
- Default `status` to `draft` -- the user promotes to `active` when ready
- Default `tenant` to `sanofi` unless overridden
- Default `classification` to `restricted` -- it is safer to over-classify
- Default `version` to `1.0.0` for new contracts
- Omit optional sections (`quality`, `serviceLevel`, `team`, `links`, `customProperties`)
  when no data is available -- do not leave placeholder text
- Use kebab-case for contract names and file names
- Use snake_case for column names (match the source system)
- Always include `description` on both objects and properties
- Every property MUST have both `logicalType` and `physicalType` -- `logicalType` is the ODCS abstract type (from the mapping tables above), `physicalType` is the exact source-system type. Never omit either field.
- Preserve the original `physicalType` exactly as found in the source
- When a type cannot be mapped, use `logicalType: string` and preserve the original type in `physicalType`. Note the unmapped type in the property description.
- Quote YAML values that could be misinterpreted (e.g., `"true"`, `"null"`, `"yes"`)
- Quality rules are suggestions -- present them and let the user decide which to include

## Anti-Patterns

### Empty Descriptions

```yaml
# BAD
- name: cust_id
  description: ""
  logicalType: integer

# GOOD
- name: cust_id
  description: Foreign key to the customers table, links orders to customer records
  logicalType: integer
```

### Over-Classifying Every Column

```yaml
# BAD -- redundant when contract-level classification is already 'restricted'
properties:
  - name: order_id
    classification: restricted
  - name: order_date
    classification: restricted

# GOOD -- only override when a column differs from the contract level
properties:
  - name: order_id
    logicalType: integer
  - name: patient_name
    classification: confidential
    tags:
      - pii
```

### Placeholder Quality Rules

```yaml
# BAD -- rule with no real threshold
- type: custom
  description: TODO check this later
  dimension: accuracy

# GOOD -- concrete, measurable rule
- type: library
  description: patient_id must never be null in clinical trial data
  dimension: completeness
  metric: nullValues
  mustBe: 0
```

### Missing Physical Types

```yaml
# BAD -- physicalType must reflect the source system
- name: amount
  logicalType: number
  physicalType: number

# GOOD -- preserve the exact source type
- name: amount
  logicalType: number
  physicalType: DECIMAL(10,2)
```

## Troubleshooting

### No `datacontracts/` directory exists

Create it. This is the first data contract in the repo.

### File already exists at the target path

Warn the user. Ask whether to overwrite or choose a different name. Never silently overwrite.

### dbt model has no `data_type` on columns

Default to `logicalType: string`, `physicalType: VARCHAR`. Add a YAML comment noting the
type was inferred. Suggest the user verify and update.

### Snowflake connection fails

Provide specific instructions:
1. Check `~/.snowflake/config.toml` exists and has valid credentials
2. Check network connectivity (VPN may be required)
3. Suggest using a SQL DDL export as fallback

### Column descriptions are empty in the source

Use the column name to generate a basic description (e.g., `order_id` -> "Order identifier").
Mark it with `# TODO: verify description` in the YAML output so the user knows to review it.

### Multiple tables in a single DDL file

Create one schema object per `CREATE TABLE` / `CREATE VIEW` statement. All objects go in
the same contract file under the `schema` list.

### Source uses types not in the mapping table

Use `logicalType: string` as the fallback. Preserve the original type in `physicalType`
exactly as written. Note the unmapped type in the property description.
