---
name: iac-security-review
user-invocable: false
description: >
  Static security analysis of IaC (Terraform, CDK, SST, CloudFormation, Pulumi).
  Handles .tf, .ts (CDK/SST), CloudFormation YAML/JSON, and Pulumi.yaml files.
  Scans for public exposure, missing encryption, permissive IAM, network gaps, and secrets.
  Produces a structured markdown report with severity ratings, evidence, attack scenarios, and remediation code.
  Use when: "review my infra security", "scan IaC for vulnerabilities", "audit
  infrastructure", "check for publicly exposed resources", "security review my cloud setup",
  "generate a security report for my infra".
  Do NOT use for: dependency vulnerabilities (use dependency-audit), CI/CD pipeline
  security (use cicd-engineering), application code security review (use code-review),
  runtime cloud posture monitoring, or Terraform module selection (use iac-terraform).
allowed-tools: Read Grep Glob Bash
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# IaC Security Review

Perform a static security analysis of infrastructure-as-code files in a repository and produce a structured markdown report with findings, severity ratings, evidence, and remediation guidance.

This skill is **framework-agnostic** — it supports Terraform, AWS CDK, SST, CloudFormation, and Pulumi. It is **read-only** — it never modifies IaC files.

> **Boundary with `iac-terraform`**: this skill audits security posture. It does not guide IaC authoring, module selection, or tagging policy — use `iac-terraform` for those concerns.

## Guardrails (MANDATORY)

- **NEVER** modify any IaC file — this skill is read-only analysis
- **NEVER** skip a security category — run all checks from `references/security-controls.md`
- **NEVER** downplay severity — if a resource is publicly accessible without auth, it is Critical
- **ALWAYS** provide evidence (file path + code snippet) for every finding
- **ALWAYS** provide concrete remediation code in the same IaC framework as the finding
- **ALWAYS** include a concrete attack scenario for each Critical/High finding — describe step-by-step what an attacker would do, not just the abstract risk
- **ALWAYS** include the executive summary even if no issues are found (report "clean" status)

## Workflow

### Phase 1: Discovery

Detect which IaC framework(s) are present in the repository.

```bash
# Terraform
find . -name '*.tf' -not -path '*/.terraform/*' | head -5

# CDK
ls cdk.json 2>/dev/null && grep -r "aws-cdk-lib\|@aws-cdk" package.json 2>/dev/null

# SST
ls sst.config.ts sst.config.js 2>/dev/null

# CloudFormation
find . -name '*.yaml' -o -name '*.json' | xargs grep -l 'AWSTemplateFormatVersion' 2>/dev/null | head -5

# Pulumi
ls Pulumi.yaml 2>/dev/null
```

For each detected framework, locate all IaC entry points and identify environments (dev, test, staging, prod) by scanning directory structure, file names, and configuration.

**If no IaC files are detected, STOP and inform the user.**

### Phase 2: Resource Inventory

Catalog all cloud resources defined across the IaC files.

Build an inventory table:

| Resource Type | Name/ID | File | Internet-Facing | Notes |
|---------------|---------|------|------------------|-------|
| API Gateway | DigitalTwin_Api | infra/api.ts:42 | Yes | HTTP API |
| Lambda Function URL | TinyTroupe | infra/compute.ts:18 | Yes | AuthType NONE |
| S3 Bucket | assets | infra/storage.tf:10 | No | Private |

For each resource, determine:

1. **Type** — AWS service / resource kind
2. **Internet-facing** — is it reachable from public internet?
3. **Relationships** — what connects to what (e.g., Lambda behind API Gateway behind CloudFront)

### Phase 3: Security Analysis

Load the full security control checklist from `references/security-controls.md`.

For every resource in the inventory, check it against **all applicable controls** across these categories:

1. **Public Exposure** — resources reachable without authentication
2. **Authentication & Authorization** — missing authorizers, overly permissive IAM
3. **Encryption** — missing encryption at rest or in transit
4. **Network Security** — permissive security groups, public subnets, missing VPC endpoints
5. **Edge & Perimeter** — missing WAF, rate limiting, permissive CORS
6. **Logging & Monitoring** — missing CloudTrail, flow logs, access logs, alarms
7. **Secrets Management** — hardcoded credentials, missing Secrets Manager references
8. **Sanofi-Specific** — tagging compliance, terraform-aws-library module usage

For each violation found, record:

- **Severity**: Critical / High / Medium / Low / Informational
- **Confidence**: High / Medium / Low
- **Evidence**: file path, line reference, and code snippet
- **Impact**: what risk this enables
- **Attack Scenario** (Critical/High only): a concrete, step-by-step narrative of how an attacker would exploit this vulnerability — what tools they'd use, what data they'd access, what damage they'd cause
- **Remediation**: corrected code in the same IaC framework

### Phase 4: Cross-Resource Analysis

After individual resource checks, assess systemic and architectural gaps:

- **Defense-in-depth**: any public-facing path that lacks layered controls (e.g., API without both WAF and authorizer)?
- **Blast radius**: IAM policies with `*` resource or action that grant cross-service access?
- **Environment consistency**: are dev/test environments missing protections that prod has?
- **Attack surface mapping**: trace external traffic paths through all layers to backend resources and describe realistic end-to-end attack chains showing how combined weaknesses escalate risk

### Phase 5: Report Generation

Generate the security report using the template from `assets/report.template.md`.

Save the report to `audits/iac-security-review-YYYY-MM-DD.md` (create the `audits/` directory if needed).

Present the executive summary to the user after generation:

```markdown
## Results

Overall Risk: [Critical/High/Medium/Low]
Findings: X Critical, Y High, Z Medium, W Low
Files Scanned: N across [frameworks]

Report saved to: audits/iac-security-review-YYYY-MM-DD.md
```

## Framework Detection Reference

| Framework | Key Files | Resource Pattern |
|-----------|-----------|------------------|
| Terraform | `*.tf` | `resource "aws_*"`, `module "..."` |
| CDK | `cdk.json`, `*.ts` with `aws-cdk-lib` | `new s3.Bucket(...)`, `new lambda.Function(...)` |
| SST | `sst.config.ts` | `new sst.aws.Function(...)`, `new sst.aws.StaticSite(...)` |
| CloudFormation | `AWSTemplateFormatVersion` in YAML/JSON | `Type: AWS::S3::Bucket` |
| Pulumi | `Pulumi.yaml` | `new aws.s3.Bucket(...)`, `aws.lambda.Function(...)` |

## Error Handling

| Scenario | Action |
|----------|--------|
| No IaC files found | Inform user and STOP |
| Mixed frameworks in one repo | Analyze all of them, note in metadata |
| Unrecognized resource types | Flag as Informational, note for manual review |
| Very large repos (>500 IaC files) | Ask user to scope to specific directories |

## References

- Security controls checklist: `references/security-controls.md`
- Report template: `assets/report.template.md`
