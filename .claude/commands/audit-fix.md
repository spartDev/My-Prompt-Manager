---
disable-model-invocation: true
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Audit Fix (Python / uv)

Audit Python dependencies with `pip-audit` and remediate vulnerabilities, preferring direct dependency updates over `[tool.uv]` constraints/overrides. Creates a branch, fixes per package, verifies, then commits and opens a PR with confirmation.

> **Scope**: this command is **only** for Python projects managed with [`uv`](https://docs.astral.sh/uv/). It detects `pyproject.toml` + `uv.lock` and the `uv` CLI. If the repository is not a Python `uv` project, the command informs the user and **STOPS** — it does not fall back to pip, Poetry, npm, or any other tooling.

> **Requires**: `uv` (with `uvx`) for auditing and resolution. `gh` (GitHub CLI) is optional and only used for the PR step.

---

## Step 0: Preflight — confirm this is a Python `uv` project

Run these checks **before doing anything else**. If any required condition fails, inform the user precisely what is missing and **STOP**.

1. **`uv` is installed** — run `uv --version`. If it fails, tell the user `uv` is required and is not installed (point them to https://docs.astral.sh/uv/) and **STOP**.
2. **A `uv` project exists** — discover every directory that contains both `pyproject.toml` and a sibling `uv.lock`: the repo root (if both files exist there) and/or one or more packages under `src/`. If no such directory is found, this is not a `uv` project — inform the user and **STOP**.
3. **No mixed non-`uv` layouts** — scan the repo root and each immediate subdirectory of `src/` for `pyproject.toml`. If any such directory has `pyproject.toml` but **no** sibling `uv.lock` (e.g. Poetry/pip/PDM at root while `src/` packages use `uv`), inform the user that this command only supports fully `uv`-managed layouts and **STOP**. Do not run `uv lock` to bootstrap a lockfile on a project that was never `uv`-managed.
4. **Clean working tree** — run `git status --porcelain`. If it produces **any** output, warn the user that uncommitted changes exist and **STOP**. The working tree must be clean before proceeding.

Only continue past this step once all four conditions hold.

---

## Step 1: Create a Branch

Detect the default branch, pull latest, and create a dated topic branch:

```bash
DEFAULT_BRANCH=$(git remote show origin | grep 'HEAD branch' | sed 's/.*: //')
git checkout "$DEFAULT_BRANCH"
git pull origin "$DEFAULT_BRANCH"
git checkout -b chore/audit-fix-$(date +%Y%m%d)
```

If the branch `chore/audit-fix-YYYYMMDD` already exists, append a counter: `chore/audit-fix-YYYYMMDD-2`, `chore/audit-fix-YYYYMMDD-3`, etc.

---

## Step 2: Discover packages

Build the list of package directories to process. A package is a directory whose **sibling** files include both `pyproject.toml` and `uv.lock`:

1. If `./pyproject.toml` and `./uv.lock` both exist at the repo root, include `.` (repo root).
2. For each immediate subdirectory of `src/` that contains both `pyproject.toml` and `uv.lock`, include that path (e.g. `src/my_pkg`).

Both can apply in the same repo — process **every** directory on the list, not just the first match.

Run **steps 3–7 for each package**, from inside that package directory. Each package has its own `pyproject.toml` and `uv.lock` and must be audited and fixed independently. **Continue to the next package** even when the current one needed no lockfile changes.

After all packages are processed, continue to Step 8.

---

## Step 3: Sync and audit

From inside the package directory:

```bash
uv sync --group dev
uv run --with pip-audit pip-audit
```

`pip-audit` reads the resolved environment and reports each vulnerability with its dependency path and the fixed version(s). Record the findings.

---

## Step 4: Fix by updating direct dependencies first

**Try to fix vulnerabilities by updating direct dependencies before falling back to constraints/overrides.**

a. For each vulnerability, trace the dependency path (e.g. `package > sub-dep > vulnerable-dep`) and determine whether updating the **direct dependency** that pulls it in resolves the issue.

b. **NEVER perform major version updates** — only apply patch or minor updates. If a fix requires a major version bump, skip it and report the vulnerability to the user as unfixable without a major upgrade.

c. If the vulnerable package is a **direct dependency**, bump its constraint in `pyproject.toml` to the patched minor/patch version (e.g. `pydantic>=2.12.0` → `pydantic>=2.12.3`), staying within the same major. Then run `uv lock` and `uv sync --group dev`.

d. If the vulnerable package is **transitive** but a newer (minor/patch) version of a direct dependency ships the patched sub-dependency, refresh just that dependency with `uv lock --upgrade-package <direct-pkg>` followed by `uv sync --group dev`. Verify the resolved direct version did not cross a major boundary (`uv pip list` / inspect `uv.lock`); if it did, revert and treat as unfixable without a major bump.

e. After updating, re-run `uv run --with pip-audit pip-audit`. Repeat for any remaining vulnerabilities with different dependency paths.

---

## Step 5: Clean up stale constraints

Read `pyproject.toml` and remove any pre-existing `[tool.uv]` `override-dependencies` / `constraint-dependencies` entries that were previously added only to patch vulnerabilities, then run `uv lock` and `uv sync --group dev`. This ensures only constraints that are still strictly necessary get re-added in Step 6.

Then run `uv run --with pip-audit pip-audit` to check which vulnerabilities remain.

---

## Step 6: Constrain remaining transitive vulnerabilities (last resort)

If vulnerabilities still exist (transitive deps that can't be fixed by updating direct deps), pin them via `[tool.uv]` `constraint-dependencies` in `pyproject.toml` — add the **minimum** set needed. Use a bounded range that stays within the current major to avoid breaking changes, e.g.:

```toml
[tool.uv]
constraint-dependencies = [
    "urllib3>=2.5.0,<3",
]
```

Then run `uv lock` and `uv sync --group dev`. Prefer `constraint-dependencies` (only narrows existing transitive deps) over `override-dependencies` (force-replaces, more aggressive); use an override only if a constraint cannot resolve the issue.

Run `uv run --with pip-audit pip-audit` one final time. If vulnerabilities still remain, report them to the user and continue — do not loop further.

---

## Step 7: Verify nothing is broken

For each package that had dependencies updated:

- `uv run pytest tests` (mirror CI, e.g. `uv run pytest tests --cov=src`)
- If the package configures linters/type checkers (e.g. `ruff`, `mypy` in `pyproject.toml`), also run `uv run ruff check .` and `uv run mypy src` as applicable.

If any fail, try to fix the issues. Report unfixable failures to the user before continuing.

---

## Step 8: User confirmation

After **all packages** from Step 2 have finished steps 3–7, run `git diff --stat` from the **repo root**.

- If there are **no changes**, inform the user that no fixes were needed and **STOP**.
- Otherwise present a summary table with before/after vulnerability counts per package, packages updated, constraints added, and verification results.

### MANDATORY STOP

**WAIT for explicit user confirmation** before committing or pushing. Do NOT proceed until the user says "go", "yes", "approve", or similar.

---

## Step 9: Commit and PR

Once approved:

1. **Commit** — stage and commit the changes. Suggested message:
   ```
   chore: audit-fix-YYYYMMDD
   ```
2. **Push** — push the branch (ask for confirmation first).
3. **Pull Request** — if `gh` is available, create a PR with `gh pr create`, title `chore: audit-fix-YYYYMMDD`. Include the `pip-audit` summary (before/after, packages updated, constraints added, remaining vulnerabilities) in the PR body. If `gh` is not installed, skip this step — the commit and branch are still valuable.

---

## Notes

- **`uv`-only** — this command never falls back to pip/Poetry/PDM. If the project is not `uv`-managed (Step 0), it stops.
- **NEVER edit `uv.lock` manually** — always let `uv lock` / `uv sync` regenerate it.
- **No major version bumps** — only patch and minor updates are allowed for direct dependencies. If a vulnerability fix requires a major version bump, report it to the user and skip it. Bounded `[tool.uv]` constraints for transitive deps that stay within the current major are acceptable.
- **Bound constraint/override versions to the current major** — use `>=<fixed>,<<next-major>` (e.g. `>=2.5.0,<3`) so a forced transitive update can't silently introduce a breaking major version.
- **Prefer direct dependency updates over constraints/overrides** — constraints mask the real problem and can cause unexpected resolution behavior. Only use them as a last resort for transitive deps that can't be updated directly.
- **Run per package** — when a repo keeps each Python package self-contained under `src/` with its own `pyproject.toml` and `uv.lock`, audit and fix each one independently.
- Always ask for user confirmation before pushing or creating PRs.
- The `gh` CLI is optional; if it is not available, skip the PR creation step.

## Safety

- **NEVER** proceed past Step 0 if the project is not a Python `uv` project.
- **NEVER** proceed past Step 8 without explicit user confirmation.
- **NEVER** use `--force` or `--no-verify` on git commands.
- **NEVER** edit `uv.lock` by hand.
