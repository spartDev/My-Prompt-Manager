---
disable-model-invocation: true
argument-hint: <schema-source>
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Data Contract

Spawns the `datacontract-generator` agent to execute the workflow.

Follow the agent's workflow to detect the input source, extract schema, suggest quality rules, and write an ODCS v3.1.0 data contract.

## Arguments

`$ARGUMENTS` - Schema source to introspect:

- `models/staging/schema.yml` - dbt YAML schema file
- `./my-dbt-project` - dbt project directory (scans for models)
- `ANALYTICS.PUBLIC` - Snowflake schema (all tables)
- `ANALYTICS.PUBLIC.ORDERS` - Snowflake single table
- `ddl/create_orders.sql` - SQL DDL file
