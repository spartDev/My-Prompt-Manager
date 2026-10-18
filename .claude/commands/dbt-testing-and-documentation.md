---
disable-model-invocation: true
argument-hint: "[tests|docs|both|<path>]"
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# dbt Tests and Doc

Spawns the `dbt-testing-and-documentation-generator` agent to execute dbt testing and documentation workflows.

Follow the agent's workflow to choose the right dbt path (tests, documentation, or both),
apply the team's conventions from the skill, and generate scoped updates that avoid low-value checks.

## Arguments

`$ARGUMENTS` - Optional task context:

- `tests` - Focus only on data test strategy and authoring
- `docs` - Focus only on model/source/column documentation
- `both` - Run both test and documentation workflows
- `<path>` - Target model/schema path (for example `models/marts/orders.yml`)
