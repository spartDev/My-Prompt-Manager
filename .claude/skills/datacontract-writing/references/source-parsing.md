<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Source Parsing Patterns

Extraction patterns for the three supported input sources: dbt YAML, Snowflake via Snowflake CLI,
and SQL DDL files.

## Table of Contents

- [dbt YAML Projects](#dbt-yaml-projects)
  - [Model Discovery](#model-discovery)
  - [Column Extraction](#column-extraction)
  - [Test-to-Quality Mapping](#test-to-quality-mapping)
- [Snowflake via Snowflake CLI](#snowflake-via-snowflake-cli)
  - [Prerequisites](#prerequisites)
  - [Server Info Extraction](#server-info-extraction)
  - [Input Parsing](#input-parsing)
  - [Schema Extraction Queries](#schema-extraction-queries)
  - [Safety Rules](#safety-rules)
- [SQL DDL Files](#sql-ddl-files)
  - [Supported Statements](#supported-statements)
  - [Column Parsing](#column-parsing)
  - [Constraint Extraction](#constraint-extraction)

## dbt YAML Projects

### Model Discovery

Glob pattern: `models/**/*.yml` (also check `models/**/*.yaml`)

dbt schema files contain model and column definitions in YAML format:

```yaml
# models/staging/schema.yml
version: 2

models:
  - name: stg_orders
    description: Staged order data from the source system
    columns:
      - name: order_id
        description: Unique order identifier
        data_type: integer
        tests:
          - unique
          - not_null
      - name: customer_id
        description: FK to customers
        data_type: integer
        tests:
          - not_null
          - relationships:
              to: ref('stg_customers')
              field: customer_id
      - name: order_date
        description: Date the order was placed
        data_type: date
        tests:
          - not_null
      - name: status
        description: Current order status
        data_type: varchar
        tests:
          - accepted_values:
              values: ['placed', 'shipped', 'completed', 'returned']
```

### Column Extraction

For each model found in the YAML:

1. **`name`** -> `name` in the contract schema object
2. **`description`** (model-level) -> `description` on the schema object
3. For each column:
   - `name` -> property `name`
   - `description` -> property `description`
   - `data_type` -> use dbt type mapping table (see SKILL.md) for `logicalType` and `physicalType`
   - `meta` -> map relevant keys to ODCS fields (see Meta Field Mapping below)
4. If `data_type` is missing, set `logicalType: string` and `physicalType: VARCHAR` with a comment

### Meta Field Mapping

dbt columns can include a `meta:` block with additional metadata. Map recognized keys to ODCS:

| dbt meta key | ODCS field | Example |
|--------------|-----------|---------|
| `contains_pii: true` | `classification: confidential` + `tags: [pii]` | Patient name, email |
| `contains_phi: true` | `classification: confidential` + `tags: [phi]` | Medical records |
| `owner` or `team` | Note in property description | Data stewardship info |

Only map keys that are explicitly present. Do not infer PII/PHI from column names alone.

### Test-to-Quality Mapping

Map dbt tests to ODCS quality rules. Rules are placed on the **property level** in the contract.

| dbt Test | type | metric | Dimension | Operator |
|----------|------|--------|-----------|----------|
| `unique` | `library` | `duplicateValues` | uniqueness | `mustBe: 0` |
| `not_null` | `library` | `nullValues` | completeness | `mustBe: 0` |
| `accepted_values` | `library` | `invalidValues` | conformity | `mustBe: 0` (list values in `arguments.values`) |
| `relationships` | `sql` | _(query)_ | consistency | `mustBe: 0` (use query template below) |

**Relationships query template** (for foreign key / referential integrity checks):

```yaml
quality:
  - type: sql
    description: "All {column} values must exist in {target_table}.{target_column}"
    dimension: consistency
    query: "SELECT COUNT(*) FROM ${table} t WHERE t.${column} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM {target_table} r WHERE r.{target_column} = t.${column})"
    mustBe: 0
```

Replace `{target_table}` and `{target_column}` with the values from the `relationships` test
(`to: ref('{target_model}')`, `field: {target_column}`).

dbt custom tests (e.g., `dbt_utils.expression_is_true`) should use `type: custom` with
`engine: dbt` and the test expression in `implementation`.

## Snowflake via Snowflake CLI

### Prerequisites

Before running any Snowflake queries:

1. **Verify Snowflake CLI is installed:**
   ```bash
   snow --version
   ```
   If this fails, ask the user with `AskUserQuestion`:
   "Snowflake CLI is not installed. How would you like to proceed?"
   - **Install via pip** -- run `pip install snowflake-cli` then retry
   - **Install via Homebrew** (macOS) -- run `brew install snowflake-cli` then retry
   - **Provide a SQL DDL file instead** -- skip Snowflake and use a `.sql` file as input
   If the user chooses an install option, run the install command, then re-run `snow --version`
   to confirm it succeeded before continuing.

2. **Test connectivity:**
   ```bash
   snow connection test
   ```
   If this fails, stop and tell the user: "Could not connect to Snowflake. Check your
   Snowflake CLI configuration (~/.snowflake/config.toml or ~/.snowflake/connections.toml)
   or set connection parameters."

### Server Info Extraction

After `snow connection test` succeeds, extract the connection details for the `servers`
section. Parse the output of `snow connection test` to get:

- `account` -- from the `Account` row
- `host` -- from the `Host` row (use account value as `server` identifier)
- `database` -- from the parsed `DB.SCHEMA` or `DB.SCHEMA.TABLE` input
- `schema` -- from the parsed `DB.SCHEMA` or `DB.SCHEMA.TABLE` input
- `warehouse` -- from the `Warehouse` row

Also run `snow connection list --format csv` if needed to get the warehouse and role.

Set `type: snowflake` and `environment` based on the database name convention
(e.g., `_DEV` suffix -> `dev`, `_PROD` -> `prod`, `_STG` -> `staging`).
If the database name does not follow a recognizable suffix convention, ask the user
which environment this server represents.

### Input Parsing

The Snowflake input can be either:
- `DB.SCHEMA` (2 parts) -- extract **all tables** in the schema
- `DB.SCHEMA.TABLE` (3 parts) -- extract a **single table** (contract still represents the schema)

Split the input on `.` to determine:
- 1 part: Invalid -- ask the user: "Please provide a schema reference in `DB.SCHEMA` or `DB.SCHEMA.TABLE` format."
- 2 parts: `DATABASE = parts[0]`, `SCHEMA = parts[1]`, `TABLE = null` (all tables)
- 3 parts: `DATABASE = parts[0]`, `SCHEMA = parts[1]`, `TABLE = parts[2]`
- 4+ parts: Invalid -- ask the user to verify the input. Snowflake identifiers use `DB.SCHEMA.TABLE` (max 3 parts).

### Schema Extraction Queries

Use these read-only queries to extract schema information. Always specify the database
and schema explicitly.

**List all tables in schema** (when `TABLE` is null -- `DB.SCHEMA` input):
```sql
SELECT
    TABLE_NAME,
    TABLE_TYPE,
    ROW_COUNT,
    COMMENT
FROM {DATABASE}.INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = '{SCHEMA}'
  AND TABLE_TYPE IN ('BASE TABLE', 'VIEW')
ORDER BY TABLE_NAME;
```

Present the table list to the user and ask which to include (default: all).
Then run the column and primary key queries for each selected table.

**Table metadata** (single table or per-table in multi-table mode):
```sql
SELECT
    TABLE_NAME,
    TABLE_TYPE,
    ROW_COUNT,
    COMMENT
FROM {DATABASE}.INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = '{SCHEMA}'
  AND TABLE_NAME = '{TABLE}';
```

**Column metadata:**
```sql
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    NUMERIC_PRECISION,
    NUMERIC_SCALE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COMMENT
FROM {DATABASE}.INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = '{SCHEMA}'
  AND TABLE_NAME = '{TABLE}'
ORDER BY ORDINAL_POSITION;
```

**Primary keys:**
```sql
SHOW PRIMARY KEYS IN {DATABASE}.{SCHEMA}.{TABLE};
```

**Unique constraints:**
```sql
SELECT
    tc.CONSTRAINT_NAME,
    cc.COLUMN_NAME
FROM {DATABASE}.INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
JOIN {DATABASE}.INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE cc
  ON tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
  AND tc.TABLE_SCHEMA = cc.TABLE_SCHEMA
WHERE tc.TABLE_SCHEMA = '{SCHEMA}'
  AND tc.TABLE_NAME = '{TABLE}'
  AND tc.CONSTRAINT_TYPE = 'UNIQUE';
```

Set `isUnique: true` on each column returned.

**Foreign keys (imported keys):**
```sql
SHOW IMPORTED KEYS IN {DATABASE}.{SCHEMA}.{TABLE};
```

For each foreign key, create a `type: sql` quality rule on the referencing column using the
relationships query template from the dbt section (replace `{target_table}` and `{target_column}`
with the `pk_table_name` and `pk_column_name` from the output).

**Run queries via Snowflake CLI:**
```bash
snow sql -q "<query>" --format csv
```

### Safety Rules

**ALLOWED commands (read-only):**
- `SELECT` on `INFORMATION_SCHEMA` views only
- `SHOW PRIMARY KEYS`
- `SHOW IMPORTED KEYS`
- `SHOW COLUMNS`
- `DESCRIBE TABLE`
- `SELECT CURRENT_ROLE()`

**BLOCKED commands (NEVER execute):**
- `INSERT`, `UPDATE`, `DELETE`, `MERGE`
- `DROP`, `ALTER`, `TRUNCATE`
- `CREATE`, `GRANT`, `REVOKE`
- `COPY INTO`, `PUT`, `GET`
- Any `SELECT` on data tables (only INFORMATION_SCHEMA is allowed)

If the user requests data sampling or row-level queries, decline and explain that the
agent only reads metadata for contract generation.

## SQL DDL Files

### Supported Statements

Parse the following DDL statements:

| Statement | Extracted Information |
|-----------|---------------------|
| `CREATE TABLE` | Table name, columns, constraints |
| `CREATE VIEW` | View name, columns |
| `CREATE OR REPLACE TABLE` | Same as CREATE TABLE |
| `CREATE OR REPLACE VIEW` | Same as CREATE VIEW |
| `ALTER TABLE ... ADD CONSTRAINT` | Additional constraints |

### Column Parsing

Extract columns from `CREATE TABLE` statements:

```sql
CREATE TABLE orders (
    order_id        INTEGER         NOT NULL PRIMARY KEY,
    customer_id     INTEGER         NOT NULL,
    order_date      DATE            NOT NULL,
    total_amount    DECIMAL(10,2)   DEFAULT 0.00,
    status          VARCHAR(50)     NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP
);
```

For each column, extract:

| DDL Element | Maps To |
|-------------|---------|
| Column name | `name` |
| Data type | `physicalType` (use SQL type mapping table in SKILL.md for `logicalType`) |
| `NOT NULL` | `isNullable: false` |
| `PRIMARY KEY` (inline) | `isPrimaryKey: true`, `isNullable: false`, `isUnique: true` |
| `UNIQUE` | `isUnique: true` |
| `DEFAULT` | Note in description (not an ODCS field) |
| `REFERENCES table(col)` (inline FK) | `type: sql` quality rule (use relationships query template from dbt section) |

### Constraint Extraction

Parse table-level constraints:

```sql
-- Composite primary key
CONSTRAINT pk_order_items PRIMARY KEY (order_id, line_item_id)

-- Foreign key
CONSTRAINT fk_orders_customers FOREIGN KEY (customer_id) REFERENCES customers(customer_id)

-- Unique constraint
CONSTRAINT uq_email UNIQUE (email)

-- Check constraint
CONSTRAINT chk_status CHECK (status IN ('active', 'inactive', 'pending'))
```

| Constraint Type | Maps To |
|----------------|---------|
| `PRIMARY KEY` | Set `isPrimaryKey: true` on referenced columns |
| `FOREIGN KEY` | `type: sql` quality rule on the referencing column (use relationships query template from dbt section) |
| `UNIQUE` | Set `isUnique: true` on referenced columns |
| `CHECK` with value list | `type: library`, `metric: invalidValues`, `dimension: conformity`, `mustBe: 0` with `arguments.values` listing the allowed values |
| `CHECK` with expression | `type: sql` quality rule with the check expression adapted as a query |
