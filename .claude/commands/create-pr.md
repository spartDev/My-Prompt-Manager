---
disable-model-invocation: true
argument-hint: "[--draft] [--base <branch>]"
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Create Pull Request

Spawns the `pr-author` agent to execute the workflow.

Follow the agent's workflow to analyze the current branch, evaluate PR size, determine the conventional commit type and scope, and create a pull request using `gh pr create`.

## Arguments

`$ARGUMENTS` - Optional PR configuration:

- `--base <branch>` - Force target branch (default: auto-detected)
- `--draft` - Create PR in draft mode
- `--title <title>` - Force PR title (default: generated from commits)
- `--reviewer <users>` - Request specific reviewers (comma-separated)
- `--label <labels>` - Add labels (comma-separated)
