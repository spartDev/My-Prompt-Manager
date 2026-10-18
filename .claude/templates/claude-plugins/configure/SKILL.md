---
name: configure
description: Configure the user-owned project settings shared by Sanofi AI standards CLI and plugin workflows.
allowed-tools: Read Write Edit Bash
---

# Configure Sanofi AI Standards

Create or update `.claude/config/project.yaml` in the current project. This is
a user-owned file shared by the Sanofi AI standards CLI and Claude plugin
workflows. Never add generated ownership markers and never remove keys that are
not described by the bundled schema.

## Bundled Contract

Read these files before making changes:

- `${CLAUDE_PLUGIN_ROOT}/support/config/schema.yaml`
- `${CLAUDE_PLUGIN_ROOT}/support/config/project.yaml.template`

The current required configuration contract is:

- `atlassian.url`
- `atlassian.jira.project_key`
- `atlassian.confluence.space_key`
- `atlassian.confluence.parent_page_id`
- `github.base_url`
- `quality.working_directory`
- `quality.commands`, a map whose keys are check names and values are shell commands

Treat a required value as unresolved when it is absent, null, blank, or still
contains a template placeholder such as `YOUR_PROJECT_KEY`. Do not ask for
optional values or values that are already resolved.

## Workflow

1. Read the bundled schema and template.
2. Read `.claude/config/project.yaml` if it exists. If it does not, begin with
   the bundled template.
3. Compare the working configuration with the schema. Ask the user only for
   unresolved required values, grouping the questions into one concise prompt
   when practical.
4. Merge the answers into the working configuration. Preserve every existing
   unknown key and every resolved value. Do not replace the file wholesale on
   reruns.
5. Ensure `.claude/config/` exists and write valid YAML to
   `.claude/config/project.yaml`.
6. Read the result back, verify the complete required contract, and report
   which paths changed. Remind the user to reload plugins or start a new Claude
   Code session before retrying an MCP server.

Do not run the npm CLI, install workspace-owned hooks or MCP entries, or request
credentials and secrets that are not part of the bundled schema.
