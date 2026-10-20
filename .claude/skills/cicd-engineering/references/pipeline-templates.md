<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Pipeline Templates

Complete GitHub Actions workflow templates for common project types at Sanofi.
All templates follow the Sanofi CI/CD skill: pinned actions (40-char SHA), explicit
least-privilege `permissions`, `run-name`, `$GITHUB_STEP_SUMMARY` output, and
`runs-on: atmos-aws-arc-runner-set` on every job.

## Table of Contents

- [Node.js / TypeScript CI](#nodejs--typescript-ci)
- [Python CI](#python-ci)
- [Terraform CI (Plan + Apply)](#terraform-ci-plan--apply)
- [Container Build + Push to ECR](#container-build--push-to-ecr)
- [CD Workflow (Auto-Deploy + Manual Promotion)](#cd-workflow-auto-deploy--manual-promotion)
- [SonarCloud PR Analysis (Reusable)](#sonarcloud-pr-analysis-reusable)
- [SonarCloud Baseline (Reusable)](#sonarcloud-baseline-reusable)
- [CodeGuard / Checkmarx SAST (Reusable Workflow Call)](#codeguard--checkmarx-sast-reusable-workflow-call)

---

## Node.js / TypeScript CI

```yaml
name: "CI"
run-name: ${{ github.workflow }} - ${{ github.ref_name }}

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

permissions:
  contents: read

jobs:
  format:
    name: Format Check
    runs-on: atmos-aws-arc-runner-set
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
      - uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2
        with:
          node-version-file: ".nvmrc"
          cache: "npm"
      - run: npm ci
      - run: npx prettier --check .

  lint:
    name: Lint
    runs-on: atmos-aws-arc-runner-set
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
      - uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2
        with:
          node-version-file: ".nvmrc"
          cache: "npm"
      - run: npm ci
      - run: npx eslint . --max-warnings=0

  typecheck:
    name: Type Check
    runs-on: atmos-aws-arc-runner-set
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
      - uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2
        with:
          node-version-file: ".nvmrc"
          cache: "npm"
      - run: npm ci
      - run: npx tsc --noEmit

  test:
    name: Unit Tests
    runs-on: atmos-aws-arc-runner-set
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
      - uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2
        with:
          node-version-file: ".nvmrc"
          cache: "npm"
      - run: npm ci
      - name: Run tests with coverage
        run: npx vitest run --coverage --coverage.thresholds.statements=80
      - uses: actions/upload-artifact@5d5d22a31266ced268874388b861e4b58bb5c2f3 # v4.3.1
        if: always()
        with:
          name: coverage_result
          path: coverage/
          retention-days: 7

  audit:
    name: Dependency Audit
    runs-on: atmos-aws-arc-runner-set
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
      - uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2
        with:
          node-version-file: ".nvmrc"
          cache: "npm"
      - run: npm ci
      - name: Audit dependencies
        run: npm audit --audit-level=high

  build:
    name: Build Complete
    runs-on: atmos-aws-arc-runner-set
    if: always()
    needs: [format, lint, typecheck, test, audit]
    steps:
      - name: Check job results
        run: |
          if [[ "${{ needs.format.result }}" != "success" ]] || \
             [[ "${{ needs.lint.result }}" != "success" ]] || \
             [[ "${{ needs.typecheck.result }}" != "success" ]] || \
             [[ "${{ needs.test.result }}" != "success" ]] || \
             [[ "${{ needs.audit.result }}" != "success" ]]; then
            echo "One or more checks failed"
            exit 1
          fi
      - name: CI Summary
        run: |
          echo "## CI Results" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "| Check | Status |" >> $GITHUB_STEP_SUMMARY
          echo "|-------|--------|" >> $GITHUB_STEP_SUMMARY
          echo "| Format | ${{ needs.format.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Lint | ${{ needs.lint.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "| TypeScript | ${{ needs.typecheck.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Tests | ${{ needs.test.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Audit | ${{ needs.audit.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "**Branch:** \`${{ github.ref_name }}\`" >> $GITHUB_STEP_SUMMARY
          echo "**Commit:** \`${{ github.sha }}\`" >> $GITHUB_STEP_SUMMARY

  sonarcloud_pr:
    name: SonarCloud PR Analysis
    needs: [test]
    if: github.event_name == 'pull_request'
    uses: ./.github/workflows/sonarcloud-pullrequest-analysis.yaml
    secrets: inherit

  sonarcloud_baseline:
    name: SonarCloud Baseline
    needs: [test]
    if: github.event_name == 'push'
    uses: ./.github/workflows/sonarcloud-baseline.yaml
    secrets: inherit
```

---

## Python CI

```yaml
name: "CI"
run-name: ${{ github.workflow }} - ${{ github.ref_name }}

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

permissions:
  contents: read

jobs:
  format:
    name: Format Check
    runs-on: atmos-aws-arc-runner-set
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
      - uses: actions/setup-python@82c7e631bb3cdc910f68e0081d67478d79c6982d # v5.1.0
        with:
          python-version-file: ".python-version"
          cache: "pip"
      - run: pip install -r requirements-dev.txt
      - run: black --check .
      - run: isort --check-only .

  lint:
    name: Lint
    runs-on: atmos-aws-arc-runner-set
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
      - uses: actions/setup-python@82c7e631bb3cdc910f68e0081d67478d79c6982d # v5.1.0
        with:
          python-version-file: ".python-version"
          cache: "pip"
      - run: pip install -r requirements-dev.txt
      - run: ruff check .

  typecheck:
    name: Type Check
    runs-on: atmos-aws-arc-runner-set
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
      - uses: actions/setup-python@82c7e631bb3cdc910f68e0081d67478d79c6982d # v5.1.0
        with:
          python-version-file: ".python-version"
          cache: "pip"
      - run: pip install -r requirements-dev.txt
      - run: mypy src/

  test:
    name: Unit Tests
    runs-on: atmos-aws-arc-runner-set
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
      - uses: actions/setup-python@82c7e631bb3cdc910f68e0081d67478d79c6982d # v5.1.0
        with:
          python-version-file: ".python-version"
          cache: "pip"
      - run: pip install -r requirements-dev.txt
      - name: Run tests with coverage
        run: pytest --cov=src --cov-report=xml --cov-fail-under=80
      - uses: actions/upload-artifact@5d5d22a31266ced268874388b861e4b58bb5c2f3 # v4.3.1
        if: always()
        with:
          name: coverage_result
          path: coverage.xml
          retention-days: 7

  audit:
    name: Dependency Audit
    runs-on: atmos-aws-arc-runner-set
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
      - uses: actions/setup-python@82c7e631bb3cdc910f68e0081d67478d79c6982d # v5.1.0
        with:
          python-version-file: ".python-version"
          cache: "pip"
      - run: pip install pip-audit
      - run: pip-audit --strict -r requirements.txt

  build:
    name: Build Complete
    runs-on: atmos-aws-arc-runner-set
    if: always()
    needs: [format, lint, typecheck, test, audit]
    steps:
      - name: Check job results
        run: |
          if [[ "${{ needs.format.result }}" != "success" ]] || \
             [[ "${{ needs.lint.result }}" != "success" ]] || \
             [[ "${{ needs.typecheck.result }}" != "success" ]] || \
             [[ "${{ needs.test.result }}" != "success" ]] || \
             [[ "${{ needs.audit.result }}" != "success" ]]; then
            exit 1
          fi
      - name: CI Summary
        run: |
          echo "## CI Results" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "| Check | Status |" >> $GITHUB_STEP_SUMMARY
          echo "|-------|--------|" >> $GITHUB_STEP_SUMMARY
          echo "| Format | ${{ needs.format.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Lint | ${{ needs.lint.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Type Check | ${{ needs.typecheck.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Tests | ${{ needs.test.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Audit | ${{ needs.audit.result }} |" >> $GITHUB_STEP_SUMMARY
```

---

## Terraform CI (Plan + Apply)

```yaml
name: "Infrastructure"
run-name: ${{ github.workflow }} - ${{ inputs.env || 'dev' }} - ${{ inputs.action || 'plan' }}

on:
  pull_request:
    paths: ["infrastructure/terraform/**"]
  workflow_dispatch:
    inputs:
      env:
        description: "Target environment"
        required: true
        type: choice
        options: [dev, test, prod]
        default: "dev"
      action:
        description: "Terraform action"
        required: true
        type: choice
        options: [plan, apply]
        default: "plan"

permissions:
  contents: read
  id-token: write
  pull-requests: write

jobs:
  validate:
    name: Validate
    runs-on: atmos-aws-arc-runner-set
    defaults:
      run:
        working-directory: infrastructure/terraform
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
      - uses: hashicorp/setup-terraform@a1502cd9e758c50496cc9ac5308c4843bcd56d36 # v3.0.0
      - name: Configure JFrog Credentials
        run: |
          cat <<EOF > ~/.terraformrc
          credentials "sanofi.jfrog.io" {
            token = "${{ secrets.JFROG_TOKEN }}"
          }
          EOF
      - run: terraform fmt -check -recursive
      - run: terraform init -backend=false
      - run: terraform validate

  plan:
    name: Plan (${{ inputs.env || 'dev' }})
    needs: validate
    runs-on: atmos-aws-arc-runner-set
    environment: ${{ inputs.env || 'dev' }}
    defaults:
      run:
        working-directory: infrastructure/terraform
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
      - uses: hashicorp/setup-terraform@a1502cd9e758c50496cc9ac5308c4843bcd56d36 # v3.0.0
      - name: Configure JFrog Credentials
        run: |
          cat <<EOF > ~/.terraformrc
          credentials "sanofi.jfrog.io" {
            token = "${{ secrets.JFROG_TOKEN }}"
          }
          EOF
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@e3dd6a429d7300a6a4c196c26e071d42e0343502 # v4.0.2
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/App_githubrunners_accelerator_${{ inputs.env || 'dev' }}
          aws-region: eu-west-1
      - run: terraform init
      - name: Terraform Plan
        id: plan
        run: |
          set +e
          terraform plan -var-file=envs/${{ inputs.env || 'dev' }}.tfvars -out=tfplan -detailed-exitcode
          EXIT_CODE=$?
          echo "exitcode=$EXIT_CODE" >> $GITHUB_OUTPUT
          if [ $EXIT_CODE -eq 1 ]; then exit 1; fi
          exit 0
      - uses: actions/upload-artifact@5d5d22a31266ced268874388b861e4b58bb5c2f3 # v4.3.1
        with:
          name: tfplan-${{ inputs.env || 'dev' }}
          path: infrastructure/terraform/tfplan
          retention-days: 7
      - name: Plan Summary
        run: |
          echo "## Terraform Plan - ${{ inputs.env || 'dev' }}" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "**Exit code:** ${{ steps.plan.outputs.exitcode }}" >> $GITHUB_STEP_SUMMARY
          echo "- 0 = No changes" >> $GITHUB_STEP_SUMMARY
          echo "- 2 = Changes detected" >> $GITHUB_STEP_SUMMARY

  apply:
    name: Apply (${{ inputs.env }})
    needs: plan
    if: inputs.action == 'apply'
    runs-on: atmos-aws-arc-runner-set
    environment: ${{ inputs.env }}
    defaults:
      run:
        working-directory: infrastructure/terraform
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
      - uses: hashicorp/setup-terraform@a1502cd9e758c50496cc9ac5308c4843bcd56d36 # v3.0.0
      - name: Configure JFrog Credentials
        run: |
          cat <<EOF > ~/.terraformrc
          credentials "sanofi.jfrog.io" {
            token = "${{ secrets.JFROG_TOKEN }}"
          }
          EOF
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@e3dd6a429d7300a6a4c196c26e071d42e0343502 # v4.0.2
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/App_githubrunners_accelerator_${{ inputs.env }}
          aws-region: eu-west-1
      - run: terraform init
      - uses: actions/download-artifact@c850b930e6ba138125429b7e5c93fc707a7f8427 # v4.1.4
        with:
          name: tfplan-${{ inputs.env }}
          path: infrastructure/terraform/
      - name: Terraform Apply
        run: terraform apply tfplan
```

---

## Container Build + Push to ECR

```yaml
name: "Container Build"
run-name: ${{ github.workflow }} - ${{ inputs.env || 'dev' }}

on:
  workflow_call:
    inputs:
      env:
        required: true
        type: string
    outputs:
      image-tag:
        description: "Published image tag"
        value: ${{ jobs.build.outputs.tag }}

permissions:
  contents: read
  id-token: write

env:
  ECR_REPOSITORY: my-service

jobs:
  build:
    name: Build & Push
    runs-on: atmos-aws-arc-runner-set
    environment: ${{ inputs.env }}
    outputs:
      tag: ${{ steps.version.outputs.tag }}
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@e3dd6a429d7300a6a4c196c26e071d42e0343502 # v4.0.2
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/App_githubrunners_accelerator_${{ inputs.env }}
          aws-region: eu-west-1

      - name: Login to ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@062b18b96a7aff071d4dc91bc00c4c1a7945b076 # v2.0.1

      - name: Determine version
        id: version
        run: |
          SHORT_SHA=$(echo "${{ github.sha }}" | cut -c1-7)
          TAG="${{ inputs.env }}-${{ github.run_number }}-${SHORT_SHA}"
          echo "tag=${TAG}" >> $GITHUB_OUTPUT

      - uses: docker/setup-buildx-action@2b51285047da1547cc430b0cb7ea1c6dc2b16e9a # v3.2.0

      - uses: docker/build-push-action@2cdde995de11925a030ce8070c3d77a52ffcf1c0 # v5.3.0
        with:
          context: .
          push: true
          platforms: linux/amd64
          tags: |
            ${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:${{ steps.version.outputs.tag }}
            ${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:${{ inputs.env }}-latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build Summary
        run: |
          echo "## Container Build" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "**Image:** \`${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}\`" >> $GITHUB_STEP_SUMMARY
          echo "**Tag:** \`${{ steps.version.outputs.tag }}\`" >> $GITHUB_STEP_SUMMARY
          echo "**Environment:** \`${{ inputs.env }}\`" >> $GITHUB_STEP_SUMMARY
```

---

## CD Workflow (Auto-Deploy + Manual Promotion)

```yaml
name: "CD"
run-name: ${{ github.workflow }} - ${{ inputs.env || 'dev' }} - ${{ inputs.version || github.sha }}

on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]
  workflow_dispatch:
    inputs:
      env:
        description: "Environment to deploy"
        required: true
        type: choice
        options: [dev, test, prod]
        default: "dev"
      version:
        description: "Version tag (leave empty for auto)"
        required: false
        type: string

permissions:
  contents: read
  id-token: write

jobs:
  build-container:
    name: Build Container
    if: github.event.workflow_run.conclusion == 'success' || github.event_name == 'workflow_dispatch'
    uses: ./.github/workflows/container-build.yaml
    with:
      env: ${{ inputs.env || 'dev' }}
    secrets: inherit

  deploy-dev:
    name: Deploy to Dev
    needs: build-container
    if: github.event_name == 'workflow_run' || (github.event_name == 'workflow_dispatch' && inputs.env == 'dev')
    runs-on: atmos-aws-arc-runner-set
    environment: dev
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@e3dd6a429d7300a6a4c196c26e071d42e0343502 # v4.0.2
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/App_githubrunners_accelerator_dev
          aws-region: eu-west-1
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster my-service-dev \
            --service my-service \
            --force-new-deployment
      - name: Deploy Summary
        run: |
          echo "## Deployed to dev" >> $GITHUB_STEP_SUMMARY
          echo "**Image tag:** \`${{ needs.build-container.outputs.image-tag }}\`" >> $GITHUB_STEP_SUMMARY

  deploy-test:
    name: Deploy to Test
    needs: build-container
    if: github.event_name == 'workflow_dispatch' && inputs.env == 'test'
    runs-on: atmos-aws-arc-runner-set
    environment: test
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@e3dd6a429d7300a6a4c196c26e071d42e0343502 # v4.0.2
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/App_githubrunners_accelerator_test
          aws-region: eu-west-1
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster my-service-test \
            --service my-service \
            --force-new-deployment

  deploy-prod:
    name: Deploy to Production
    needs: build-container
    if: github.event_name == 'workflow_dispatch' && inputs.env == 'prod'
    runs-on: atmos-aws-arc-runner-set
    environment: prod # Requires manual approval
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@e3dd6a429d7300a6a4c196c26e071d42e0343502 # v4.0.2
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/App_githubrunners_accelerator_prod
          aws-region: eu-west-1
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster my-service-prod \
            --service my-service \
            --force-new-deployment
```

---

## SonarCloud PR Analysis (Reusable)

```yaml
name: "SonarCloud PR Analysis"
run-name: SonarCloud - PR #${{ github.event.pull_request.number }}

on:
  workflow_call:

permissions:
  contents: read
  pull-requests: read

jobs:
  quality:
    name: SonarCloud Analysis
    runs-on: atmos-aws-arc-runner-set
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
        with:
          fetch-depth: 0
      - uses: actions/download-artifact@c850b930e6ba138125429b7e5c93fc707a7f8427 # v4.1.4
        with:
          name: coverage_result
          path: coverage/
      - uses: SonarSource/sonarqube-scan-action@7295e71c9583053f5bf40e9d4068a0c974603ec8 # v3.0.0
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
        with:
          args: >
            -Dsonar.pullrequest.key=${{ github.event.pull_request.number }}
            -Dsonar.pullrequest.branch=${{ github.head_ref }}
            -Dsonar.pullrequest.base=${{ github.base_ref }}
```

## SonarCloud Baseline (Reusable)

```yaml
name: "SonarCloud Baseline"
run-name: SonarCloud - baseline (${{ github.ref_name }})

on:
  workflow_call:

permissions:
  contents: read

jobs:
  quality:
    name: SonarCloud Baseline
    runs-on: atmos-aws-arc-runner-set
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
        with:
          fetch-depth: 0
      - uses: actions/download-artifact@c850b930e6ba138125429b7e5c93fc707a7f8427 # v4.1.4
        with:
          name: coverage_result
          path: coverage/
      - uses: SonarSource/sonarqube-scan-action@7295e71c9583053f5bf40e9d4068a0c974603ec8 # v3.0.0
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

---

## CodeGuard / Checkmarx SAST (Reusable Workflow Call)

```yaml
name: "SAST"
run-name: ${{ github.workflow }} - CodeGuard

on:
  push:
    branches: [main]
  schedule:
    - cron: "0 6 * * 1" # Weekly Monday 6 AM UTC
  workflow_call:

permissions:
  contents: read
  security-events: write

jobs:
  codeguard:
    name: CodeGuard SAST
    # @main exception: org-managed reusable workflow (see security-hardening.md §1)
    uses: Sanofi-Shared-GitHub-Apps/cyber-AST-Action_reusable/.github/workflows/code_guard_ast.yml@main
    with:
      production-branch: main
      groups: Digital-Accelerator
      cmdb: ${{ vars.cmdb }}
      summary-output: true
      codeguard-gate: true
    secrets:
      DOCKER_AUTH_CONFIG: ${{ secrets.CHECKMARX_DOCKER_AUTH_CONFIG }}
      CX_CLIENT_ID: ${{ secrets.CHECKMARX_CX_CLIENT_ID }}
      CX_CLIENT_SECRET: ${{ secrets.CHECKMARX_CX_CLIENT_SECRET }}
```
