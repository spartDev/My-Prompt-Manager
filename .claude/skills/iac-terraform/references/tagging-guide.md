<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Sanofi AWS Tagging Guide

## Table of Contents

- [ALL Mandatory Tags (EVERY RESOURCE)](#all-mandatory-tags-every-resource)
- [Tag Definitions](#tag-definitions)
  - [Accelerator Team Tags](#accelerator-team-tags)
  - [Sanofi Corporate Tags](#sanofi-corporate-tags)
- [Environment Mapping](#environment-mapping)
- [Standard Implementation Pattern](#standard-implementation-pattern)
- [Provider Default Tags](#provider-default-tags)
- [Using tags_mandatory_tags Module](#using-tags_mandatory_tags-module)
- [Tag Inheritance](#tag-inheritance)
- [Validation in CI/CD](#validation-in-cicd)
- [Common Mistakes](#common-mistakes)
- [RFC and Confluence References](#rfc-and-confluence-references)

---

## ALL Mandatory Tags (EVERY RESOURCE)

Per RFC from Request-for-Comments, ALL resources must have these tags:

```hcl
tags = {
  # Accelerator Team Tags (RFC mandatory)
  team        = "platform"              # REQUIRED: Pod name (single word)
  name        = "my-project"            # REQUIRED: Custom project name
  env         = "dev"                   # REQUIRED: dev | test | prod (lowercase)
  version     = "1.0.0"                 # REQUIRED: Deployed resource version
  service     = "api-gateway"           # REQUIRED: Service name
  cost_center = "apm-1234567"           # REQUIRED: cc-*, dp-*, or apm-* prefix
  contact     = "team@sanofi.com"       # REQUIRED: Team/tech lead email

  # Sanofi Corporate Tags (mandatory)
  CE_Application_ID   = "APM1234567"    # REQUIRED: Same value as cost_center (APM format)
  CE_Application_Name = "Application"   # REQUIRED: Application name
  CE_Environment      = "DEV"           # REQUIRED: Capitalized env value
}
```

## Tag Definitions

### Accelerator Team Tags

| Tag | Format | Description | Example |
|-----|--------|-------------|---------|
| `team` | Single word | Pod/team name | `platform`, `dataeng`, `frontend` |
| `name` | Alphanumeric with `-` or `_` | Custom project name | `user-service`, `data_pipeline` |
| `env` | Lowercase | Environment | `dev`, `test`, `prod` |
| `version` | Semver | Deployed version | `1.0.0`, `2.3.1` |
| `service` | Alphanumeric | Service identifier | `api-gateway`, `lambda-processor` |
| `cost_center` | Prefixed code | Project code | `cc-12345`, `dp-67890`, `apm-1234567` |
| `contact` | Email | Team/owner email | `platform-team@sanofi.com` |

### Sanofi Corporate Tags

| Tag | Format | Description | Relationship |
|-----|--------|-------------|--------------|
| `CE_Application_ID` | `APM` + 7 digits | APM ID | Should match `cost_center` value |
| `CE_Application_Name` | Free text | Application name | Human-readable app name |
| `CE_Environment` | Uppercase | Environment | Capitalized version of `env` |

## Environment Mapping

| env (lowercase) | CE_Environment (uppercase) | Description |
|-----------------|---------------------------|-------------|
| `dev` | `DEV` | Development/sandbox, used within dev team |
| `test` | `TEST` | QA/UAT, shared with business |
| `prod` | `PROD` | Production, change control required |

## Standard Implementation Pattern

```hcl
# variables.tf
variable "team" {
  type        = string
  description = "Pod/team name (single word)"
}

variable "project_name" {
  type        = string
  description = "Custom project name"
}

variable "environment" {
  type        = string
  description = "Environment: dev, test, or prod"

  validation {
    condition     = contains(["dev", "test", "prod"], var.environment)
    error_message = "Environment must be dev, test, or prod"
  }
}

variable "version" {
  type        = string
  description = "Deployed resource version"
  default     = "1.0.0"
}

variable "service" {
  type        = string
  description = "Service name"
}

variable "cost_center" {
  type        = string
  description = "Cost center code (cc-*, dp-*, or apm-*)"

  validation {
    condition     = can(regex("^(cc-|dp-|apm-)", var.cost_center))
    error_message = "Cost center must start with cc-, dp-, or apm-"
  }
}

variable "contact_email" {
  type        = string
  description = "Team/tech lead email"

  validation {
    condition     = can(regex("@sanofi\\.com$", var.contact_email))
    error_message = "Contact must be a @sanofi.com email"
  }
}

variable "application_name" {
  type        = string
  description = "CE_Application_Name value"
}

# locals.tf
locals {
  # Map lowercase env to uppercase CE_Environment
  ce_environment_map = {
    dev  = "DEV"
    test = "TEST"
    prod = "PROD"
  }

  # Extract APM ID from cost_center if apm- prefix, otherwise use as-is
  application_id = (
    startswith(var.cost_center, "apm-")
    ? upper(replace(var.cost_center, "apm-", "APM"))
    : var.cost_center
  )

  # Complete tag set - ALL MANDATORY
  tags = {
    # Accelerator Team Tags
    team        = var.team
    name        = var.project_name
    env         = var.environment
    version     = var.version
    service     = var.service
    cost_center = var.cost_center
    contact     = var.contact_email

    # Sanofi Corporate Tags
    CE_Application_ID   = local.application_id
    CE_Application_Name = var.application_name
    CE_Environment      = local.ce_environment_map[var.environment]

    # Operational Tags (recommended)
    ManagedBy  = "Terraform"
    Repository = "github.com/Sanofi-Accelerator/${var.project_name}"
  }
}

# Usage in modules
module "s3_bucket" {
  source  = "sanofi.jfrog.io/terraform-innersource-local__aws-services/s3_bucket/aws"
  version = "1.0.0"

  tags = local.tags
}
```

## Provider Default Tags

Apply common tags at provider level:

```hcl
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      team        = var.team
      env         = var.environment
      cost_center = var.cost_center
      contact     = var.contact_email
      ManagedBy   = "Terraform"
    }
  }
}
```

**Note**: Resource-level tags merge with and override provider default tags.

## Using tags_mandatory_tags Module

The library provides a helper module for Sanofi corporate tags:

```hcl
module "tags" {
  source  = "sanofi.jfrog.io/terraform-innersource-local__aws-services/tags_mandatory_tags/aws"
  version = "1.0.0"

  application_id   = local.application_id
  application_name = var.application_name
  environment      = local.ce_environment_map[var.environment]
}

# Merge with Accelerator team tags for complete tag set
locals {
  all_tags = merge(module.tags.tags, {
    team        = var.team
    name        = var.project_name
    env         = var.environment
    version     = var.version
    service     = var.service
    cost_center = var.cost_center
    contact     = var.contact_email
  })
}

# Use in modules
module "s3_bucket" {
  source = "..."
  tags   = local.all_tags
}
```

## Tag Inheritance

For resources created by modules, tags should propagate:

```hcl
# ECS example - tags propagate to tasks
module "ecs_service" {
  source = "..."
  tags   = local.all_tags

  propagate_tags = "SERVICE"  # If supported by module
}
```

## Validation in CI/CD

Add tag validation to your pipeline:

```yaml
# GitHub Actions example
- name: Validate Mandatory Tags
  run: |
    # Accelerator team tags
    for tag in team name env version service cost_center contact; do
      grep -r "\"$tag\"" *.tf || (echo "Missing tag: $tag" && exit 1)
    done

    # Sanofi corporate tags
    for tag in CE_Application_ID CE_Application_Name CE_Environment; do
      grep -r "$tag" *.tf || (echo "Missing tag: $tag" && exit 1)
    done
```

## Common Mistakes

### Missing Accelerator Team Tags
```hcl
# BAD
tags = {
  CE_Application_ID   = "APM1234567"
  CE_Application_Name = "My App"
  CE_Environment      = "DEV"
  # Missing: team, name, env, version, service, cost_center, contact!
}

# GOOD
tags = local.tags  # Contains all mandatory tags
```

### Mismatched env/CE_Environment
```hcl
# BAD
tags = {
  env            = "development"  # Wrong format
  CE_Environment = "Dev"          # Wrong case
}

# GOOD
tags = {
  env            = "dev"   # Lowercase: dev, test, prod
  CE_Environment = "DEV"   # Uppercase: DEV, TEST, PROD
}
```

### Invalid cost_center Format
```hcl
# BAD
tags = {
  cost_center = "12345"     # Missing prefix!
}

# GOOD
tags = {
  cost_center = "apm-1234567"  # Valid: cc-*, dp-*, apm-*
}
```

### Missing Tags on Module
```hcl
# BAD
module "s3" {
  source = "..."
  # No tags = non-compliant!
}

# GOOD
module "s3" {
  source = "..."
  tags   = local.all_tags  # Complete tag set
}
```

## RFC and Confluence References

For the latest tagging requirements:

1. **Request-for-Comments**: Check `Sanofi-Accelerator/Request-for-Comments` accepted folder
2. **Confluence CODE**: Search for "tagging policy" or "AWS tags"
3. **terraform-aws-library**: Check tags module documentation

Always verify current requirements before deployment.
