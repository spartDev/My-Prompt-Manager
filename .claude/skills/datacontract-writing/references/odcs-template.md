<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# ODCS v3.1.0 Template

Full YAML template and field reference for the
[Open Data Contract Standard v3.1.0](https://github.com/bitol-io/open-data-contract-standard).

## Table of Contents

- [Minimal Contract](#minimal-contract)
- [Full Contract Template](#full-contract-template)
- [Field Reference](#field-reference)
  - [Root Fields](#root-fields)
  - [Schema Object](#schema-object)
  - [Property Object](#property-object)
  - [Quality Rules](#quality-rules)
  - [Service Level Agreements](#service-level-agreements)
  - [Support and Stakeholders](#support-and-stakeholders)

## Minimal Contract

The smallest valid ODCS contract. Use this as a starting point and add sections as needed.

```yaml
kind: DataContract
apiVersion: v3.1.0
id: <generated-uuid>
version: 1.0.0

name: <contract-name>
status: draft
tenant: sanofi

description:
  purpose: <what this dataset is for>
  usage: <how consumers should use it>

domain: <business-domain>
dataProduct: <data-product-name>

schema:
  - name: <table-or-view-name>
    description: <schema object description>
    properties:
      - name: <column-name>
        description: <column description>
        logicalType: string
        physicalType: VARCHAR(255)
```

## Full Contract Template

All sections included. Omit any section that has no data -- do not leave placeholder text.

```yaml
kind: DataContract
apiVersion: v3.1.0
id: <generated-uuid>
version: <semver, default: 1.0.0>

name: <contract-name>
status: <draft | active | retired | deprecated>
tenant: <tenant, default: sanofi>

description:
  purpose: <what this dataset is for>
  usage: <how consumers should use it>
  limitations: <known limitations or caveats>

domain: <business-domain>
dataProduct: <data-product-name>

tags:
  - <tag1>
  - <tag2>

classification: <public | internal | confidential | restricted>

servers:
  - server: <server-identifier>
    type: <snowflake | postgresql | bigquery | s3 | ...>
    description: <server description>
    environment: <prod | dev | staging | ...>
    # Snowflake-specific fields:
    account: <snowflake-account>
    database: <database-name>
    schema: <schema-name>
    warehouse: <warehouse-name>

schema:
  - name: <table-or-view-name>
    description: <schema object description>
    type: table  # table | view | materializedView
    quality:
      # Table-level quality rules (e.g., rowCount)
      - type: library
        description: <human-readable description>
        dimension: <accuracy | completeness | conformity | consistency | coverage | timeliness | uniqueness>
        metric: rowCount
        mustBeGreaterOrEqualTo: 1
    properties:
      - name: <column-name>
        description: <column description>
        logicalType: <see type mapping tables in SKILL.md>
        physicalType: <database-specific type>
        isPrimaryKey: true
        isNullable: false
        isUnique: true
        classification: <override contract-level classification>
        tags:
          - <pii>
        examples:
          - <example-value>
        quality:
          # Property-level quality rules (nullValues, duplicateValues, etc.)
          - type: library
            description: <human-readable description>
            dimension: completeness
            metric: nullValues
            mustBe: 0
      - name: <another-column>
        description: <description>
        logicalType: string
        physicalType: VARCHAR(100)
        isNullable: true

serviceLevel:
  - property: latency
    value: 5s
    description: <description>
  - property: freshness
    value: 24h
    description: <description>
  - property: availability
    value: 99.9%
    description: <description>
  - property: retention
    value: 365d
    description: <description>

team:
  - name: <team-name>
    role: owner
    email: <team-email>
  - name: <person-name>
    role: steward
    email: <person-email>

links:
  - name: <link-name>
    url: <url>
    type: <documentation | catalog | repository | dashboard>

customProperties:
  - property: <key>
    value: <value>
```

## Field Reference

### Root Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `kind` | Yes | string | Always `DataContract` |
| `apiVersion` | Yes | string | Always `v3.1.0` |
| `id` | Yes | string | Unique identifier to reduce the risk of dataset name collisions (e.g., UUID v4) |
| `version` | Yes | string | Contract version (semver) |
| `name` | Yes | string | Human-readable contract name (kebab-case) |
| `status` | Yes | enum | `draft`, `active`, `retired`, `deprecated` |
| `tenant` | Yes | string | Organization tenant (default: `sanofi`) |
| `description` | Yes | object | Contains `purpose`, `usage`, optional `limitations` |
| `domain` | Yes | string | Business domain (e.g., `clinical-data`, `supply-chain`) |
| `dataProduct` | Yes | string | Data product this contract belongs to |
| `tags` | No | list | Free-form tags for discovery |
| `classification` | No | enum | `public`, `internal`, `confidential`, `restricted` |
| `servers` | No | list | Physical server locations where data resides |
| `schema` | Yes | list | One or more schema objects |
| `quality` | No | list | Quality rules (prefer placing on schema objects or properties) |
| `serviceLevel` | No | list | SLA properties |
| `team` | No | list | Ownership and stewardship |
| `links` | No | list | External references |
| `customProperties` | No | list | Arbitrary key-value pairs |

### Schema Object

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | Yes | string | Table, view, or entity name |
| `description` | No | string | What this schema object represents |
| `type` | No | enum | `table`, `view`, `materializedView` (default: `table`) |
| `quality` | No | list | Table-level quality rules (e.g., rowCount) |
| `properties` | No | list | Column/field definitions |

### Server Object

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `server` | Yes | string | Server identifier |
| `type` | Yes | enum | `snowflake`, `postgresql`, `bigquery`, `s3`, `redshift`, `databricks`, `kafka`, `mysql`, `sqlserver`, `custom`, etc. |
| `description` | No | string | Server description |
| `environment` | No | string | `prod`, `dev`, `staging`, etc. |

**Snowflake-specific fields** (when `type: snowflake`):

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `account` | Yes | string | Snowflake account identifier |
| `database` | Yes | string | Database name |
| `schema` | Yes | string | Schema name |
| `warehouse` | No | string | Virtual warehouse name |
| `host` | No | string | Snowflake server host |
| `port` | No | integer | Snowflake server port |

### Property Object

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | Yes | string | Column/field name |
| `description` | Yes | string | What this field represents |
| `logicalType` | Yes | string | Logical type (see type mapping tables in SKILL.md) |
| `physicalType` | Yes | string | Database-specific type (e.g., `VARCHAR(255)`, `NUMBER(38,0)`) |
| `isPrimaryKey` | No | boolean | Part of the primary key (default: false) |
| `isNullable` | No | boolean | Allows NULL values (default: true) |
| `isUnique` | No | boolean | Values must be unique (default: false) |
| `classification` | No | enum | Override contract-level classification |
| `tags` | No | list | Column-level tags (e.g., `pii`, `phi`) |
| `examples` | No | list | Example values for documentation |
| `quality` | No | list | Property-level quality rules |

### Quality Rules

Quality rules can be placed at the **schema object level** (table-level checks like `rowCount`)
or at the **property level** (column-specific checks like `nullValues`, `duplicateValues`).
Do NOT use a root-level `quality` section with `column` references.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `type` | No | enum | Rule type: `library` (default), `sql`, `custom`, `text` |
| `description` | No | string | Human-readable rule description |
| `dimension` | No | enum | `accuracy`, `completeness`, `conformity`, `consistency`, `coverage`, `timeliness`, `uniqueness` |
| `metric` | Yes (library) | enum | `nullValues`, `missingValues`, `invalidValues`, `duplicateValues`, `rowCount` |
| `query` | Yes (sql) | string | SQL with `${table}` and `${column}` template variables |
| `engine` | Yes (custom) | string | Tool name: `soda`, `great-expectations`, `dbt`, etc. |
| `implementation` | Yes (custom) | string/object | Engine-specific configuration |
| `severity` | No | string | `info`, `warning`, `error` |
| `schedule` | No | string | Execution timing (e.g., cron expression) |
| `unit` | No | string | Measurement unit: `rows`, `percent` |

**Quality Rule Operators** (one per rule, used with `library` and `sql` types):

| Operator | Type | Example |
|----------|------|---------|
| `mustBe` | any | `mustBe: 0` (zero nulls) |
| `mustNotBe` | any | `mustNotBe: null` |
| `mustBeGreaterThan` | number | `mustBeGreaterThan: 0` |
| `mustBeGreaterOrEqualTo` | number | `mustBeGreaterOrEqualTo: 1` (min rows) |
| `mustBeLessThan` | number | `mustBeLessThan: 100` |
| `mustBeLessOrEqualTo` | number | `mustBeLessOrEqualTo: 0.01` (1% max) |
| `mustBeBetween` | [number, number] | `mustBeBetween: [1000, 100000]` |
| `mustNotBeBetween` | [number, number] | `mustNotBeBetween: [0, 10]` |

### Service Level Agreements

| Property | Description | Example Values |
|----------|-------------|----------------|
| `latency` | Max query response time | `5s`, `100ms` |
| `freshness` | Max data staleness | `1h`, `24h`, `7d` |
| `availability` | Uptime percentage | `99.9%`, `99.99%` |
| `retention` | Data retention period | `30d`, `365d`, `7y` |

### Support and Stakeholders

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | Yes | string | Team or person name |
| `role` | Yes | string | `owner`, `steward`, `consumer`, `engineer` |
| `email` | No | string | Contact email |
