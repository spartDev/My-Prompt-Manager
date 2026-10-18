---
name: cicd-engineering
disable-model-invocation: true
user-invocable: false
description: >
  GitHub Actions workflow patterns, pipeline templates, and security hardening for CI/CD
  at Sanofi. Covers workflow security, quality gates, supply chain integrity, environment
  promotion, operational hygiene, and Sanofi-specific patterns (ARC runner, CodeGuard,
  SonarCloud). Use when: (1) writing or reviewing GitHub Actions workflows, (2) creating
  a CI pipeline, (3) adding SAST, SCA, or coverage to a workflow, (4) pinning actions
  to SHA, (5) setting up environment promotion. Do NOT use for application code review
  (use code-review), IaC security analysis (use iac-security-review), Terraform module
  patterns (use iac-terraform), dependency remediation workflows (use dependency-audit),
  release-note generation (use release-process), or non-GitHub-Actions CI systems.
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# CI/CD Engineering

This skill is the Sanofi source of truth for CI/CD practices on GitHub Actions. It is
organized by **functional domain**, not by administrative IDs. Each rule is stated with
RFC 2119 keywords (**MUST**, **SHOULD**, **MAY**), a short rationale, an example, and a
review checklist.

## References

Load as needed:

- `references/pipeline-templates.md` — Complete copy-paste workflows (Node.js, Python,
  Terraform, container, CD, SonarCloud, CodeGuard)
- `references/security-hardening.md` — Deep-dive on attack vectors and mitigations
  (supply chain, `pull_request_target`, workflow injection, OIDC, self-hosted runners)

---

## 1. Workflow Security

The pipeline runs with high privileges. Treat every workflow file as production code.

### 1.1 Reference actions in a form the Sanofi allowlist accepts

GitHub Actions at Sanofi are governed by an **org-level allowlist**. Even a
well-formed workflow will fail at runtime if the action it calls is not permitted.
The rule for this skill is: pick the strongest form of pinning the allowlist accepts,
not the strongest form in principle.

**GitHub-published actions and verified creators** — allowed broadly by the org
policy. These SHOULD be pinned to a full 40-character commit SHA so a compromised
maintainer tag cannot silently swap the code that runs with your `GITHUB_TOKEN`.

```yaml
# GOOD — GitHub-published action, pinned SHA, version comment for humans
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
```

Find the SHA for a tag:

```bash
gh api repos/actions/checkout/git/ref/tags/v4.1.1 --jq '.object.sha'
```

**Other third-party actions** — MUST be explicitly listed in the Sanofi allowlist
before they can run. The allowlist entries are tag-based, not SHA-based, so pinning
a non-listed action to a commit SHA in your workflow will be rejected regardless of
how secure the SHA is. Use the exact reference registered in the allowlist (normally
a tag such as `@v2`) and open a request with the platform team if you need a new
action or a newer version added. Do not invent SHA pins for actions the allowlist
has not cleared.

**Sanofi-managed reusable workflows** (e.g. CodeGuard `cyber-AST-Action_reusable`,
Tyr `tsg-tyr`) MAY be referenced with `@main`. They are centrally reviewed and not
subject to third-party supply-chain risk. Add a comment noting the exception.

### 1.2 Set explicit, least-privilege `permissions`

**Every workflow MUST declare a `permissions:` block.** Missing or `write-all`
permissions let a compromised action push to protected branches, approve PRs, or
publish packages.

```yaml
# Workflow-level default: read-only
permissions:
  contents: read

jobs:
  publish:
    # Narrow expansion only in the job that needs it
    permissions:
      contents: read
      packages: write
```

Common patterns:

| Workflow type   | Permissions                         |
| --------------- | ----------------------------------- |
| Build + test    | `contents: read`                    |
| Publish package | `contents: read`, `packages: write` |
| Create release  | `contents: write`                   |
| PR comment      | `pull-requests: write`              |
| Deploy via OIDC | `contents: read`, `id-token: write` |
| Code scanning   | `security-events: write`            |

`write-all` and `read-all` are **prohibited**. Reusable workflow callers MUST declare
their own `permissions:` block — inherited permissions are not safe.

### 1.3 Manage secrets through GitHub Environments or approved vaults

**Secrets MUST NOT appear in workflow files, committed configs, or logs.** Secrets MUST
be scoped per environment (dev / test / prod) with separate values; a single
`API_KEY` shared across environments is **prohibited**.

```yaml
# GOOD — secret scoped to the 'production' environment
jobs:
  deploy:
    environment: production
    steps:
      - run: deploy --api-key "${{ secrets.API_KEY }}"

# BAD — never hardcode secrets
env:
  API_KEY: sk-1234567890
```

Requirements:

- Use **GitHub Environments** or **AWS Secrets Manager** (the approved Sanofi vault)
  for secret storage.
- Production environments SHOULD require manual approval via environment protection
  rules. For **GxP** projects this is a **MUST** — regulatory change control requires
  a recorded approval step.
- Secret scanning MUST be enabled org-wide (GitHub secret scanning; GitGuardian for
  Sanofi). Exposed credentials MUST be revoked and rotated immediately.

**Avoid `secrets: inherit`** when calling reusable workflows unless the callee is an
org-managed workflow (CodeGuard, Tyr). Prefer explicit secret passing; see
`references/security-hardening.md`.

### 1.4 Prefer OIDC over long-lived cloud credentials

**Workflows SHOULD authenticate to cloud providers via OIDC federation** (short-lived,
scoped tokens) rather than long-lived keys stored as secrets. For AWS:

```yaml
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    environment: ${{ inputs.env }}
    steps:
      - uses: aws-actions/configure-aws-credentials@5579c002bb4778aa43395ef1df492868a9a1c83f # v4.0.2
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/App_githubrunners_accelerator_${{ inputs.env }}
          aws-region: eu-west-1
```

The IAM trust policy MUST scope the `sub` claim to the specific repo **and**
environment. Separate roles per environment (dev / test / prod). Full trust-policy
template in `references/security-hardening.md`.

Long-lived cloud keys in `secrets` are a compliance gap — remove them once OIDC is in
place.

### 1.5 Prevent workflow injection

Attacker-controlled strings (PR title, branch name, issue body) interpolated into
`run:` blocks enable command injection. **Never interpolate user-controlled expressions
directly in shell commands** — pass them through environment variables.

```yaml
# BAD — PR title is interpolated into the shell
- run: echo "Processing: ${{ github.event.pull_request.title }}"

# GOOD — PR title becomes a shell variable, not a shell token
- env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: echo "Processing: $PR_TITLE"
```

Dangerous expressions include `github.event.pull_request.{title,body}`,
`github.event.issue.{title,body}`, `github.event.comment.body`,
`github.head_ref`, `github.event.pull_request.head.ref`.

`pull_request_target` MUST NOT check out code from the PR head. See
`references/security-hardening.md` for the safe two-workflow alternative.

### 1.6 Never use `continue-on-error: true` on security steps

`continue-on-error: true` silently swallows failures. On SAST, dependency audit,
secret scanning, or compliance steps this hides critical findings — the workflow
reports green while a vulnerability ships. **Prohibited on any security-related step.**

### 1.7 Define workflows as code, detect workflow drift

**All CI/CD workflows MUST live in `.github/workflows/` under version control.** UI-defined
jobs, manual tweaks, or undocumented deviations from the committed workflow files are
prohibited.

_Drift_ here means **workflow-configuration drift**: a repo's committed workflow files
diverging from org-level reference templates or policy rules (for example, a team
copying a template and later removing the SAST step, or changing `runs-on` away from
the ARC runner). Detect it with:

- `actionlint` for syntax and security patterns
- OPA/Conftest or reusable workflow policies for org-level rules
- PR checks that compare workflow files against reference templates

Exemptions (e.g., hotfix deviations) MUST be documented and time-bound.

> Scope note: this section is about the workflow files themselves. Infrastructure
> drift (deployed state vs. IaC) is covered by `iac-terraform`; dependency drift is
> covered by `dependency-audit`.

---

## 2. Quality Gates

### 2.1 Lint, format, and type-check in CI

**Every repo MUST run linting, formatting, and type-checking jobs that block merge on
failure.** Manual enforcement does not scale; these checks MUST be automated on every PR.

Language-typical tooling:

| Language        | Lint                   | Format           | Types          |
| --------------- | ---------------------- | ---------------- | -------------- |
| TypeScript / JS | ESLint / Biome         | Prettier / Biome | `tsc --noEmit` |
| Python          | Ruff / Flake8 / Pylint | Black / Ruff     | mypy / Pyright |
| Go              | golangci-lint          | gofmt            | compiler       |

Runs SHOULD be **parallel jobs**, not a single serial step, so developers see all
failures at once:

```yaml
jobs:
  format: # Prettier check
  lint: # ESLint
  typecheck: # tsc --noEmit
  test: # Unit tests with coverage
  build:
    needs: [format, lint, typecheck, test]
    # Summary job — final gate
```

Configuration files (`.eslintrc`, `.prettierrc`, `tsconfig.json`, `pyproject.toml`)
MUST be committed. Pre-commit hooks SHOULD provide the same checks locally.

### 2.2 Enforce coverage thresholds via SonarCloud

**Every repo with automated tests MUST enforce a minimum coverage threshold**, and
merges that drop coverage below the baseline MUST be blocked.

At Sanofi, coverage is measured and enforced by **SonarCloud** (Sanofi's managed
SonarQube tenant). Deviations from the standard Sanofi SonarCloud configuration
require explicit approval.

```yaml
# Run tests with coverage, upload as artifact
- run: npm run test:coverage -- --run
- uses: actions/upload-artifact@SHA # v4
  if: always()
  with:
    name: coverage_result
    path: coverage/
    retention-days: 7
# SonarCloud reusable workflow then consumes the artifact
# and enforces the Sanofi quality gate.
```

For **GxP projects**, coverage reports MUST be stored as artifacts for traceability,
with retention matching regulatory requirements.

Inline thresholds (Vitest / Jest / pytest-cov) are acceptable for defense in depth but
do not replace the SonarCloud gate.

---

## 3. Supply Chain Integrity

### 3.1 Commit lockfiles

**Lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `uv.lock`,
`Pipfile.lock`, `poetry.lock`) MUST be committed** to guarantee deterministic builds.
CI MUST use deterministic install commands (`npm ci`, `pipenv sync`, `uv sync --frozen`,
`bundle install --deployment`) and MUST fail if the lockfile is missing or out of sync.

Lockfile updates flow through PRs so dependency changes are reviewed. Dependabot or
Renovate SHOULD automate these PRs.

### 3.2 Audit dependencies automatically (SCA)

**Every repo MUST run automated dependency audits in CI** covering:

- **Security vulnerabilities** in direct **and** transitive dependencies
- **License compliance** against the approved list
- **Version freshness** (no deprecated or end-of-life libraries)

Critical vulnerabilities MUST block merge until remediated.

**Remediation SLAs:**

- Critical: within 7 days
- High: within 14 days
- Medium / low: at team discretion, tracked

At Sanofi, use one of the Cybersecurity-provided tools (Checkmarx / CodeGuard SCA, or
GitHub Dependabot) via the standard reusable workflows. Minimal inline examples:

```yaml
# Node.js — lightweight gate
- run: npm audit --audit-level=high

# Python
- run: pip-audit --strict
```

Dependabot or Renovate SHOULD be enabled to open PRs for vulnerable packages
automatically.

### 3.3 Run SAST in the pipeline

**Every repo MUST integrate a SAST tool into CI** with blocking results.

At Sanofi, the preferred SAST is **CodeGuard** (Checkmarx-based) via the org-level
reusable workflow. **SonarCloud** additionally provides quality + security scanning.
**CodeQL** is an acceptable fallback when CodeGuard is unavailable.

```yaml
jobs:
  codeguard:
    # Org-managed reusable workflow — @main acceptable (see §1.1 exception)
    uses: Sanofi-Shared-GitHub-Apps/cyber-AST-Action_reusable/.github/workflows/code_guard_ast.yml@main
    with:
      production-branch: main
      groups: Digital-Accelerator
      cmdb: ${{ vars.cmdb }}
      codeguard-gate: true
    secrets:
      CX_CLIENT_ID: ${{ secrets.CHECKMARX_CX_CLIENT_ID }}
      CX_CLIENT_SECRET: ${{ secrets.CHECKMARX_CX_CLIENT_SECRET }}
```

SAST findings MUST NOT be gated by `continue-on-error: true`.

### 3.4 Generate and keep an SBOM

**Production-bound projects SHOULD generate a Software Bill of Materials (SBOM)** at
release time (CycloneDX or SPDX) and store it alongside the release artifact. SBOMs
are required input for SLSA provenance, vulnerability response, and license audits.

SBOM tooling:

- Node.js: `@cyclonedx/cyclonedx-npm`
- Python: `cyclonedx-py`, `pip-audit --format cyclonedx`
- Container: Syft (`anchore/sbom-action`)

SBOMs SHOULD be signed together with the release artifact (see §3.5).

### 3.5 Sign and verify release artifacts (recommended)

**Production-bound artifacts SHOULD be cryptographically signed during CI and verified
before deployment.** Unsigned artifacts SHOULD NOT be promoted to production registries.

- Use **Sigstore / cosign** for containers and generic artifacts (keyless OIDC flow is
  preferred over long-lived keys).
- Generate **SLSA provenance attestations** to record builder, inputs, and timestamp.
- Configure the registry (ECR, JFrog) to reject unsigned uploads where supported.
- Rotate signing keys at least every 6 months; prefer Sigstore keyless to avoid key
  rotation entirely.

Teams MUST document their signing process (tools, key management, verification gates)
in the project runbook.

---

## 4. Deployment & Environments

### 4.1 Follow the dev → test → prod promotion flow

**Production deployments MUST go through dev → test → prod** with quality/security
gates and approvals at each stage. Direct feature-branch-to-prod is **prohibited**
outside of documented emergency hotfix procedures.

The standard Sanofi pattern combines `workflow_run` (auto-deploy to dev on CI pass)
with `workflow_dispatch` (manual promotion to test and prod):

```yaml
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]
  workflow_dispatch:
    inputs:
      env:
        type: choice
        options: [dev, test, prod]

jobs:
  deploy-dev:
    environment: dev
    if: github.event_name == 'workflow_run'
      || (github.event_name == 'workflow_dispatch' && inputs.env == 'dev')

  deploy-test:
    environment: test
    if: github.event_name == 'workflow_dispatch' && inputs.env == 'test'

  deploy-prod:
    environment: prod
    # Approval enforced by GitHub Environment protection rules
    if: github.event_name == 'workflow_dispatch' && inputs.env == 'prod'
```

Requirements:

- **Same artifact** promoted across environments (build once, deploy many).
- **Environment-specific secrets and IAM roles.**
- **Approval gate on `prod`** via GitHub Environment protection rules. Manual approval
  is **required for GxP** and SHOULD be the default elsewhere; automated promotion
  (e.g., continuous delivery with progressive rollout and automated rollback) is
  acceptable for non-GxP projects when documented in the runbook.
- Promotion flow documented in the project runbook.

Canary or blue-green deployments SHOULD be validated in the `test` environment before
prod promotion.

### 4.2 Version artifacts and generate release notes

**Every repo producing release artifacts MUST declare a documented versioning scheme
and MUST auto-generate release notes** from commits or PR metadata.

Which scheme is appropriate depends on what the repo produces:

- **Published libraries, SDKs, CLIs, container images consumed by others** — use
  **Semantic Versioning** (`MAJOR.MINOR.PATCH`). Consumers rely on semver to reason
  about breaking changes.
- **Continuously deployed services / applications** — semver is **not required**.
  Any monotonic, traceable scheme (date-based `YYYY.MM.DD.N`, commit SHA, incremental
  build number) is acceptable. A service has no public API version surface that
  semver is designed to describe; forcing semver on a service tends to manufacture
  meaningless major bumps.
- **Published HTTP/gRPC APIs** — version the API contract independently (URL path,
  `Accept` header) rather than tying it to the deployable artifact version.

Approved tooling:

- **Release Please** (Google) — recommended for libraries / published artifacts
- `semantic-release` — libraries
- GitHub's built-in release notes generator — any repo

Release notes MUST include contributors, bug fixes, new features, and explicit
breaking-change callouts. Release tags SHOULD be signed (see §3.5). SBOMs and
vulnerability reports SHOULD be published alongside release notes.

---

## 5. Operational Hygiene

### 5.1 Clean up artifacts and temporary resources

**CI/CD pipelines MUST apply retention policies** to artifacts, logs, caches, and
preview environments. Stale resources inflate cost and expand the attack surface.

Defaults:

- **Artifacts:** `retention-days: 7` for day-to-day build outputs; GitHub's 90-day
  default for persistent artifacts.
- **Preview environments:** destroyed automatically on branch merge or close.
- **Untagged container images:** purged after 14–30 days via registry lifecycle
  rules.
- **Release artifacts and SBOMs:** archived to long-term storage (e.g., S3 Glacier).
- **GxP artifacts:** retained per regulatory requirements (longer than defaults).

```yaml
- uses: actions/upload-artifact@SHA # v4
  with:
    name: coverage_result
    path: coverage/
    retention-days: 7
```

### 5.2 Use deterministic caching (recommended)

**Caches SHOULD be keyed on lockfile or dependency hashes**, not on branch names or
static strings. Non-deterministic keys cause silent cache corruption and hidden
dependency drift.

```yaml
- uses: actions/cache@SHA
  with:
    path: node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

Caches MAY be force-refreshed periodically (e.g., weekly per project, monthly at
org level) to flush stale dependencies and reclaim storage. The exact cadence is left
to each team / platform owner unless a documented org-level policy applies.

### 5.3 Produce audit-ready logs with appropriate retention

**CI/CD pipelines MUST produce complete, centralized logs** with retention aligned to
compliance needs.

Sanofi rules:

- **SIEM** automatically ingests all CI/CD logs; retention is set by Cybersecurity.
- **Regular projects:** GitHub default 90-day log retention.
- **GxP projects:** retention and immutability MUST match regulatory requirements;
  logs MUST be written to tamper-proof storage (e.g., write-once S3, append-only
  index).

Logs SHOULD capture commit SHA, actor, artifact hash, and deployment target. Use
`run-name` on workflows and `$GITHUB_STEP_SUMMARY` for human-readable run summaries:

```yaml
run-name: ${{ github.workflow }} — ${{ github.ref_name }}

# Inside a job
- run: |
    echo "### Coverage" >> "$GITHUB_STEP_SUMMARY"
    echo "- Lines: 87%" >> "$GITHUB_STEP_SUMMARY"
```

---

## 6. Sanofi-Specific Patterns

These patterns are non-negotiable at Sanofi and override generic CI/CD guidance.

### 6.1 Use the Sanofi-managed ARC runner

**All jobs MUST use `runs-on: atmos-aws-arc-runner-set`.** GitHub-hosted runners
(`ubuntu-latest`, `windows-latest`, `macos-latest`) are **prohibited**.

The ARC runner set provides ephemeral, pre-hardened runners managed by the platform
team. It is the only approved execution environment for Sanofi CI/CD.

```yaml
# GOOD
jobs:
  build:
    runs-on: atmos-aws-arc-runner-set

# BAD — GitHub-hosted runner
jobs:
  build:
    runs-on: ubuntu-latest
```

### 6.2 CodeGuard (Checkmarx SAST)

Org-level reusable workflow that satisfies the SAST requirement (§3.3). Runs on
`schedule`, `push` to main, and via `workflow_call`. May be referenced with `@main`
(see §1.1 exception). Full template in `references/pipeline-templates.md`.

### 6.3 Tyr compliance scanning

Org-level reusable workflow enforcing repo governance and policy compliance. Same
`@main` exception. Full template in `references/pipeline-templates.md`.

### 6.4 SonarCloud quality gating

Two companion reusable workflows (PR analysis + baseline) satisfy the coverage gate
(§2.2) and provide secondary SAST coverage. Called via `workflow_call` from the main
CI. Full templates in `references/pipeline-templates.md`.

### 6.5 JFrog Artifactory for Terraform modules

Private Terraform modules are pulled from Sanofi's JFrog Artifactory. The JFrog token
MUST be a GitHub Environment secret (not a repo-level secret); `.terraformrc` MUST be
created at runtime only. See `references/security-hardening.md`.

---

## Workflow Review Checklist

When reviewing `.github/workflows/*.yml`:

**Workflow security**

- [ ] All jobs use `runs-on: atmos-aws-arc-runner-set`
- [ ] Actions referenced in a form the Sanofi allowlist accepts: GitHub-published / verified-creator actions pinned to 40-char SHA; other third-party actions use the exact tag registered in the allowlist; Sanofi org-managed reusable workflows on `@main`
- [ ] `permissions:` block present at workflow level, minimal and explicit
- [ ] No `permissions: write-all` or `read-all`
- [ ] No hardcoded secrets; secrets scoped per environment
- [ ] No `secrets: inherit` except to Sanofi org-managed reusable workflows
- [ ] No `pull_request_target` checking out PR head code
- [ ] No user-controlled expressions (`github.event.*.title/body`, `head_ref`) interpolated into `run:`
- [ ] No `continue-on-error: true` on SAST, audit, or compliance steps

**Quality gates**

- [ ] Parallel lint / format / typecheck / test jobs
- [ ] All block merge on failure
- [ ] Coverage flows into SonarCloud quality gate
- [ ] Configuration files committed (`.eslintrc`, `tsconfig.json`, etc.)

**Supply chain**

- [ ] Lockfile present and enforced (`npm ci` / `uv sync --frozen` / etc.)
- [ ] Dependency audit job (CodeGuard SCA, `npm audit`, `pip-audit`)
- [ ] SAST job (CodeGuard preferred, SonarCloud or CodeQL acceptable)
- [ ] SBOM generated for production-bound artifacts
- [ ] Artifact signing for production releases (recommended)

**Deployment**

- [ ] dev → test → prod promotion via GitHub Environments
- [ ] `prod` environment has an approval gate (manual approval required for GxP)
- [ ] OIDC to cloud providers (no long-lived access keys)
- [ ] Release versioning scheme documented and automated (semver for libraries; any
      traceable scheme for services)

**Hygiene**

- [ ] `retention-days` set on all `upload-artifact` calls
- [ ] Cache keys derived from `hashFiles('**/lockfile')`
- [ ] `run-name` set
- [ ] `$GITHUB_STEP_SUMMARY` used for audit-readable summaries

---

## Common Compliance Gaps

| Gap                                                    | Severity   | Remediation                                                                                                         |
| ------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| GitHub-published action pinned to tag (`@v4`) not SHA  | MUST-fix   | Replace with full SHA + version comment                                                                             |
| Third-party action not on the Sanofi allowlist         | MUST-fix   | Use the reference registered in the allowlist, or request an update from the platform team — do not invent SHA pins |
| Missing `permissions:` block                           | MUST-fix   | Add explicit minimal block at workflow level                                                                        |
| No dependency scanning step                            | MUST-fix   | Add CodeGuard SCA reusable workflow or `npm audit --audit-level=high`                                               |
| No SAST                                                | MUST-fix   | Add CodeGuard reusable workflow (preferred) or CodeQL                                                               |
| Coverage uploaded but no threshold                     | MUST-fix   | Wire into SonarCloud quality gate                                                                                   |
| No artifact `retention-days`                           | MUST-fix   | Add `retention-days: 7` (or team policy)                                                                            |
| `continue-on-error: true` on security steps            | MUST-fix   | Remove — failures MUST block merge                                                                                  |
| `secrets: inherit` to non-org workflow                 | MUST-fix   | Pass secrets explicitly                                                                                             |
| `runs-on: ubuntu-latest` or other GitHub-hosted runner | MUST-fix   | Replace with `atmos-aws-arc-runner-set`                                                                             |
| Long-lived cloud keys in GitHub Secrets                | SHOULD-fix | Migrate to OIDC federation                                                                                          |
| No `run-name`                                          | SHOULD-fix | Add descriptive `run-name`                                                                                          |
| No GHA cache for install step                          | SHOULD-fix | Add `actions/cache` keyed on lockfile hash                                                                          |
| No SBOM at release                                     | SHOULD-fix | Add CycloneDX or SPDX generation                                                                                    |

---

## Troubleshooting

### No workflow files found

Project has no `.github/workflows/` directory. This is a new CI setup — generate from
scratch using the templates in `references/pipeline-templates.md`.

### Action SHA lookup fails

GitHub API rate limit or action repo not accessible. Authenticate `gh` and retry.

### Sanofi shared workflows not accessible

The `Sanofi-Shared-GitHub-Apps` org requires specific access. Verify org membership.
If blocked, fall back to CodeQL for SAST while access is being granted.
