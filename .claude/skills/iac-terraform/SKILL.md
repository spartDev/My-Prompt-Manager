---
name: iac-terraform
disable-model-invocation: true
user-invocable: false
description: >
  Provides Terraform patterns, module references, tagging requirements, and audit templates
  for AWS infrastructure using Sanofi's terraform-aws-library. Use when creating IaC,
  provisioning AWS resources, architecting infrastructure, or auditing Terraform configurations.
  Do NOT use for application code, CI/CD pipelines, or non-AWS infrastructure.
metadata:
  author: Sanofi-Accelerator
  version: 1.0.0
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Infrastructure as Code with Terraform

Build AWS infrastructure using Sanofi's Terraform module library.

## Required MCP Servers

Before starting, verify MCP servers are available:

```
mcp__github      → Access terraform-aws-library, Request-for-Comments
mcp__confluence  → Access CODE space for engineering docs
mcp__terraform   → Best practices, AWS docs search, Checkov security scanning (awslabs)
```

**If any MCP server is unavailable, STOP and notify the user.**

> **Note:** Terraform commands (`terraform fmt`, `terraform validate`, `terraform plan`, `terraform apply`) are executed manually via the Bash tool. The terraform MCP provides guidance and security scanning, not command execution.

## Guardrails (MANDATORY)

### Module Usage
- **ALWAYS** use modules from `Sanofi-InnerSource/terraform-aws-library`
- **NEVER** write raw AWS resources when a module exists
- **ALWAYS** read module README and variables.tf before using
- **ALWAYS** check Request-for-Comments for approved patterns

### Tagging (MANDATORY - ALL RESOURCES)

Per RFC, ALL resources must have these tags:

```hcl
tags = {
  # Accelerator Team Tags
  team        = "platform"              # REQUIRED: Pod name (single word)
  name        = "my-project"            # REQUIRED: Custom project name
  env         = "dev"                   # REQUIRED: dev | test | prod (lowercase)
  version     = "1.0.0"                 # REQUIRED: Deployed resource version
  service     = "api-gateway"           # REQUIRED: Service name
  cost_center = "apm-1234567"           # REQUIRED: cc-*, dp-*, or apm-*
  contact     = "team@sanofi.com"       # REQUIRED: Team/tech lead email

  # Sanofi Corporate Tags
  CE_Application_ID   = "APM1234567"    # REQUIRED: Same as cost_center (APM format)
  CE_Application_Name = "Application"   # REQUIRED: Application name
  CE_Environment      = "DEV"           # REQUIRED: Capitalized env value
}
```

- **NEVER** deploy without ALL mandatory tags
- **ASK** user for missing values (team, cost_center, contact, etc.)
- **CHECK** `references/tagging-guide.md` for implementation patterns
- **VALIDATE** cost_center starts with `cc-`, `dp-`, or `apm-`
- **ENSURE** env/CE_Environment match (dev→DEV, test→TEST, prod→PROD)

### When Uncertain
- **ALWAYS** ask the user for clarification
- **NEVER** guess at security-sensitive configurations
- **NEVER** assume default values for critical settings

## Workflow

### 1. Discovery (MANDATORY FIRST STEP)

```bash
# Check available modules
github:get_file_contents owner:Sanofi-InnerSource repo:terraform-aws-library path:README.md

# List modules for specific service
github:get_file_contents owner:Sanofi-InnerSource repo:terraform-aws-library path:src/{service}

# Read module documentation
github:get_file_contents owner:Sanofi-InnerSource repo:terraform-aws-library path:src/{service}/{module}/README.md

# Read module variables
github:get_file_contents owner:Sanofi-InnerSource repo:terraform-aws-library path:src/{service}/{module}/variables.tf

# Check RFC for guidelines
github:search_code query:"tagging" repo:Sanofi-Accelerator/Request-for-Comments path:accepted
```

### 2. Confluence Check

```bash
# Search configured space for relevant docs (default: CODE)
mcp__confluence: searchConfluenceUsingCql query:"space = {SPACE} AND text ~ 'AWS {service} guidelines'" limit:5

# Get specific page
mcp__confluence: getConfluencePage pageId:"{id}"
```

### 3. Implementation

Module source pattern:
```hcl
module "example" {
  source  = "sanofi.jfrog.io/terraform-innersource-local__aws-services/{module}/aws"
  version = "X.Y.Z"  # Always pin version

  # Required tags
  tags = {
    CE_Application_ID   = var.application_id
    CE_Application_Name = var.application_name
    CE_Environment      = var.environment
  }

  # Module-specific variables...
}
```

### 4. Validation (Manual via Bash)

```bash
# Format check
terraform fmt -check -recursive

# Validate syntax
terraform validate

# Preview changes (run manually)
terraform plan -out=tfplan

# Security scan via MCP
mcp__terraform: checkov_scan path:"."
```

> **Important:** `terraform plan` and `terraform apply` should be run manually by the user. The agent can help review plan output but should not auto-apply.

### 5. Audit (After Implementation)

Run IaC audit and save to `audits/` folder. See `references/iac-audit-template.md`.

## Module Library Reference

| Service | Modules |
|---------|---------|
| acm | acm_public_certificate |
| api_gateway | api_gateway_bootstrap, api_gateway_domain_name, api_gateway_rest_api |
| athena | athena_database, athena_workgroup |
| batch | batch_compute_environment, batch_job_definition |
| cloudwatch | cloudwatch_metric_alarm, cloudwatch_metric_filter |
| documentdb | documentdb_elastic_cluster, documentdb_instance_cluster |
| dynamodb | dynamodb_table |
| ecr | ecr_repository |
| ecs | ecs_cluster, ecs_default_execution_role, ecs_service, ecs_task_definition |
| elasticache | elasticache_memcached_cluster, elasticache_redis_cluster, elasticache_redis_replication_group |
| elb | elb_alb, elb_glb, elb_nlb, elb_target_group |
| event_bridge | event_bridge_bus, event_bridge_rule |
| iam | iam_role_custom_trust, iam_role_github, iam_role_service |
| kinesis | kinesis_datastream |
| kms | kms_symmetric_key |
| lambda | lambda_function |
| rds | rds_instance, rds_instance_snapshot |
| route53 | route53_private_alias, route53_private_cname |
| s3 | s3_bucket, s3_bucket_private_website, s3_bucket_public_website |
| secrets_manager | secrets_manager_secret |
| sns | sns_topic |
| sqs | sqs_queue |
| step_functions | step_functions_state_machine |
| tags | tags_accelerator_tags, tags_mandatory_tags |
| vpc | vpc_endpoint, vpc_selector |

## Project Structure

```
infrastructure/
├── main.tf              # Root module, provider config
├── variables.tf         # Input variables
├── outputs.tf           # Output values
├── terraform.tfvars     # Variable values (gitignored if sensitive)
├── versions.tf          # Provider version constraints
├── backend.tf           # State backend config
├── modules/             # Local modules if needed
│   └── {feature}/
├── environments/        # Per-environment configs
│   ├── dev/
│   ├── test/
│   └── prod/
└── audits/              # Audit reports (auto-generated)
    └── iac-audit-YYYY-MM-DD.md
```

## Common Patterns

### ECS Service with ALB
```hcl
module "alb" {
  source  = "sanofi.jfrog.io/terraform-innersource-local__aws-services/elb_alb/aws"
  version = "1.0.0"
  tags    = local.tags
  # ... see module README
}

module "ecs_cluster" {
  source  = "sanofi.jfrog.io/terraform-innersource-local__aws-services/ecs_cluster/aws"
  version = "1.0.0"
  tags    = local.tags
}

module "ecs_service" {
  source  = "sanofi.jfrog.io/terraform-innersource-local__aws-services/ecs_service/aws"
  version = "1.0.0"
  tags    = local.tags
  # ... see module README
}
```

### Lambda with API Gateway
```hcl
module "lambda" {
  source  = "sanofi.jfrog.io/terraform-innersource-local__aws-services/lambda_function/aws"
  version = "1.0.0"
  tags    = local.tags
}

module "api_gateway" {
  source  = "sanofi.jfrog.io/terraform-innersource-local__aws-services/api_gateway_rest_api/aws"
  version = "1.0.0"
  tags    = local.tags
}
```

## Artifactory Access

For CI/CD (GitHub Actions):
```yaml
steps:
  - uses: hashicorp/setup-terraform@v2
    with:
      cli_config_credentials_hostname: 'sanofi.jfrog.io'
      cli_config_credentials_token: ${{ secrets.TERRAFORM_ARTIFACTORY_TOKEN }}
```

## IaC Audit

After implementation, create audit report in `audits/` folder.

See `references/iac-audit-template.md` for full audit structure.

### Quick Audit Checklist
- [ ] All resources use terraform-aws-library modules
- [ ] Mandatory tags present on all resources
- [ ] No hardcoded secrets
- [ ] KMS encryption enabled where applicable
- [ ] Least privilege IAM policies
- [ ] Security groups restrict ingress
- [ ] S3 buckets not public unless intended
- [ ] Logging enabled (CloudWatch, S3 access logs)
- [ ] State backend uses encryption

## Anti-Patterns

### Raw AWS Resources When Module Exists
```hcl
# BAD — module exists in terraform-aws-library
resource "aws_s3_bucket" "data" {
  bucket = "my-bucket"
}

# GOOD — use the library module
module "data_bucket" {
  source  = "sanofi.jfrog.io/terraform-innersource-local__aws-services/s3_bucket/aws"
  version = "1.0.0"
  tags    = local.tags
}
```

### Missing or Incomplete Tags
```hcl
# BAD — only corporate tags, missing team tags
tags = {
  CE_Application_ID = "APM1234567"
}

# GOOD — complete tag set
tags = local.tags  # Contains all mandatory tags
```

### Unpinned Module Versions
```hcl
# BAD — no version constraint
module "lambda" {
  source = "sanofi.jfrog.io/terraform-innersource-local__aws-services/lambda_function/aws"
}

# GOOD — pinned version
module "lambda" {
  source  = "sanofi.jfrog.io/terraform-innersource-local__aws-services/lambda_function/aws"
  version = "1.2.3"
}
```

### Hardcoded Secrets
```hcl
# BAD — secret in code
resource "aws_db_instance" "db" {
  password = "my-secret-password"
}

# GOOD — reference secrets manager
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = module.db_secret.secret_id
}
```

## Failure Routing

If implementation fails or audit finds issues:
1. Identify the issue type
2. Fix in this skill
3. Re-run validation and audit
4. Only report success when clean

## References

- Tagging guide: `references/tagging-guide.md`
- Audit template: `references/iac-audit-template.md`
