---
name: dependency-audit
user-invocable: false
description: >
  Audit and remediate Node.js dependency vulnerabilities across npm and pnpm projects.
  Use when: (1) "audit my dependencies for vulnerabilities", "fix CVE in my project",
  "remediate npm/pnpm security advisories", "run dependency security check",
  (2) remediating known CVEs in direct or transitive dependencies,
  (3) applying semver-safe upgrades and pnpm/npm overrides.
  Do NOT use for: Yarn projects (explicitly unsupported), license compliance, SAST scanning,
  secret detection, or routine dependency updates without security motivation — use standard
  package manager commands instead.
allowed-tools: Read Grep Glob Bash Edit
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Dependency Audit

Remediate known dependency vulnerabilities through safe semver upgrades and, as a last resort, overrides. This skill is package-manager agnostic — it supports **npm** and **pnpm**. Yarn is explicitly unsupported.

> This skill is invoked by the `security-auditor` agent or the `/secure-deps` command. It assumes the caller has already completed preflight checks, detected the package manager, and created a topic branch.

## Inputs

The caller provides these values before invoking this skill:

| Variable | Description | Example |
|----------|-------------|---------|
| `PM` | Detected package manager | `npm` or `pnpm` |
| `PM_LOCKFILE` | Lockfile name | `package-lock.json` or `pnpm-lock.yaml` |

Read `references/pm-command-map.md` to translate generic operations into PM-specific commands throughout this workflow.

---

## Phase 1: Detect Project Layout

Determine whether this is a **monorepo** or a **single-package** repo:

| PM | Monorepo indicator | Detection |
|----|-------------------|-----------|
| pnpm | `pnpm-workspace.yaml` exists | `cat pnpm-workspace.yaml 2>/dev/null` |
| npm | `"workspaces"` field in root `package.json` | `node -e "const p=require('./package.json'); console.log(p.workspaces ? 'monorepo' : 'single')"` |

If monorepo, note the workspace patterns. All update commands must use the recursive/workspaces flag (see command map).

---

## Phase 2: Initial Audit

Run the audit and capture output in both JSON and human-readable formats. Use the PM-specific command from the command map:

```bash
# JSON (for programmatic analysis)
<PM> audit --json 2>/dev/null || true

# Human-readable (for PR body)
<PM> audit 2>/dev/null || true
```

> `audit` exits non-zero when vulnerabilities exist — this is expected, not an error. Always append `|| true`.

**If zero vulnerabilities**, inform the user and **STOP**.

Count and categorize by severity: **critical**, **high**, **moderate**, **low**.

Read `references/audit-output-formats.md` to understand the JSON structure differences between npm and pnpm. Both formats provide severity counts at `metadata.vulnerabilities` with the same keys.

---

## Phase 3: Remediate via Direct Dependency Upgrades

The goal: resolve vulnerabilities by upgrading **direct** dependencies to newer **patch or minor** versions. Major version upgrades require human decision and are never applied automatically.

### 3a: Trace each vulnerability to a direct dependency

For each advisory, identify the dependency path:

```
project > direct-dep > transitive-dep@vulnerable-version
```

Extract the **direct dependency** (the first package after `project`). In npm output, check `vulnerabilities.<pkg>.via`; in pnpm, check `advisories.<id>.findings[].paths` (paths use `>` as separator, e.g. `direct-dep>intermediate>vulnerable-pkg`).

### 3b: Check for safe upgrades

For each direct dependency:

```bash
<PM> outdated <package> --json
```

Apply semver rules strictly:

| Upgrade | Type | Action |
|---------|------|--------|
| `1.2.3` → `1.2.5` | patch | Safe — apply |
| `1.2.3` → `1.3.0` | minor | Safe — apply |
| `1.2.3` → `2.0.0` | major | **NEVER** do this automatically |

### 3c: Handle scoped package families

For scoped packages (`@aws-sdk/*`, `@smithy/*`, `@babel/*`), mixing versions within the same scope causes breakage. Before updating one package in a scope, find all packages in that scope:

```bash
<PM> ls --depth 0 | grep "@scope/"
```

Then update **all** packages in the scope together (see `references/pm-command-map.md` for the exact syntax).

### 3d: Apply the upgrades

For each safe upgrade, run the PM-appropriate update command (single-package or recursive for monorepos).

After each batch of upgrades (grouped by scope or related packages), re-run the audit to measure progress:

```bash
<PM> audit --json 2>/dev/null || true
```

If all vulnerabilities are resolved, skip to **Phase 5**.

---

## Phase 4: Last-Resort Override Remediation

If vulnerabilities remain after Phase 3, apply overrides as a last resort.

### 4a: Snapshot existing overrides

Read current overrides from the PM-appropriate location:

| PM | Override location |
|----|-------------------|
| npm | `"overrides"` in `package.json` |
| pnpm | `"pnpm.overrides"` in `package.json` (or `pnpm-workspace.yaml` in pnpm 9+) |

Record all existing entries. These may include manually curated entries for peer dependency resolution or compatibility pinning — **do not remove them**.

### 4b: Attempt automatic fix

Run the PM-appropriate audit fix command (see `references/pm-command-map.md` — "Audit fix" row):

```bash
<PM_AUDIT_FIX_CMD> 2>/dev/null || true
```

Not all registries or PM versions support this. If it errors, skip the override step and report that manual intervention is needed.

### 4c: Fix override version specifiers (pnpm only)

`pnpm audit --fix` writes overrides with `>=` ranges (e.g., `">=4.1.2"`). These allow **major version jumps** at the next install. Replace every `>=` with `^` in the **newly added** overrides only:

- `">=4.1.2"` → `"^4.1.2"`

Check both `package.json` and `pnpm-workspace.yaml`. If overrides were written to a different file than the project's conventional location, consolidate into the project's existing file.

> npm's `npm audit fix` does not use overrides — it modifies `package-lock.json` directly. This step applies only to pnpm.

### 4d: Reinstall with corrected overrides

Run the PM-appropriate install command that allows lockfile changes (see `references/pm-command-map.md` — "Install (allow lockfile changes)" row).

### 4e: Final audit

```bash
<PM> audit 2>/dev/null || true
```

If vulnerabilities **still** remain, record them for the summary. **Do not loop** — report the remaining issues and continue.

---

## Phase 5: Verify the Build

Detect available verification scripts dynamically from `package.json`:

```bash
node -e "const p = require('./package.json'); console.log(Object.keys(p.scripts || {}).join('\n'))"
```

Look for and run the following script names **if they exist** (in this order):

1. **Type checking**: `typecheck`, `type-check`, `tsc`, `check:types`, `check-types`
2. **Linting**: `lint`, `eslint`, `check:lint`, `lint:check`
3. **Unit tests**: `test`, `test:unit`, `test:ci`, `vitest`, `jest`

```bash
<PM> run <script-name>
```

For monorepos with no root scripts, use the recursive flag with `--if-present` (see command map).

**If any verification step fails**, show the full error output and inform the user. **Do not silently continue.** The user must decide whether to fix the issue or proceed anyway.

---

## Phase 6: Check for Changes

```bash
git diff --stat
```

**If there are no changes** (audit found vulnerabilities but no upgrades were possible or all were already at latest), inform the user that no automated fixes could be applied. List the remaining vulnerabilities and **STOP**.

---

## Phase 7: Summary

Present the audit results to the caller:

| Metric | Value |
|--------|-------|
| Vulnerabilities before | N (X critical, Y high, Z moderate, W low) |
| Vulnerabilities after | N (X critical, Y high, Z moderate, W low) |
| Vulnerabilities resolved | N |
| Vulnerabilities remaining | N |
| Direct deps upgraded | list of `pkg@old` → `pkg@new` |
| Overrides added/modified | list or "none" |
| Verification | passed / failed (details) |

Return this summary to the caller (the `/secure-deps` command or `security-auditor` agent) for user confirmation before proceeding to commit and PR creation.

---

## Safety

- **NEVER** modify pre-existing overrides when fixing `>=` ranges — only change overrides that were added by the audit fix command in this session
- **NEVER** edit the lockfile manually — always let the PM regenerate it
- **NEVER** perform major version upgrades automatically — only patch and minor
- **NEVER** skip the `>=` → `^` override fix for pnpm — `>=` ranges allow uncontrolled major bumps
- **NEVER** loop endlessly on unresolvable vulnerabilities — report and move on
- **NEVER** hardcode project-specific workspace names, test commands, or package names
- **NEVER** use `--no-frozen-lockfile` in CI — this flag is only for local remediation work

## Error Handling

| Scenario | Action |
|----------|--------|
| `audit` exits non-zero | Expected when vulnerabilities exist. Use `\|\| true`. |
| `audit fix` fails | Some registries or PM versions don't support it. Skip overrides, report. |
| Version conflicts after upgrade | Show full error. Ask user about `--legacy-peer-deps` (npm) or `--no-strict-peer-dependencies` (pnpm). |
| Test failures after upgrade | Show full output. User decides: fix, revert, or accept. |
| Network errors during version lookups | Skip that package, note in summary. Don't abort the entire run. |
