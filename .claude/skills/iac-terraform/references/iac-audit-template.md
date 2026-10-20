<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# IaC Audit Template

Save audits to `audits/iac-audit-YYYY-MM-DD.md`

## Report Structure

```markdown
# Infrastructure as Code Security Audit

## 1. Metadata

| Field | Value |
|-------|-------|
| Audit Date | YYYY-MM-DD |
| Agent Version | iac-tf-engineer v1.0 |
| Target Repository | {repo-name} |
| Environment | DEV / TEST / PROD |
| Frameworks Scanned | Terraform |
| Standards Referenced | CIS AWS Benchmark, NIST SP 800-53, ISO/IEC 27001 |

## 2. Executive Summary

**Overall Risk Level**: [Critical / High / Medium / Low]

| Severity | Count |
|----------|-------|
| Critical | X |
| High | X |
| Medium | X |
| Low | X |
| Informational | X |

**Key Findings**:
- [One-line summary of most critical findings]

**Compliance Status**:
- CIS AWS Benchmark: X% compliant
- Sanofi Tagging Policy: [Compliant / Non-compliant]

## 3. Detailed Findings

### Finding 1: [Title]

| Attribute | Value |
|-----------|-------|
| Severity | Critical / High / Medium / Low / Informational |
| Confidence | High / Medium / Low |
| Control Mapping | CIS X.X / NIST XX-XX / ISO X.X.X |

**Evidence**:
```hcl
# File: path/to/file.tf
# Lines: XX-XX
[code snippet]
```

**Impact**:
[What risk this enables or compromises]

**Remediation**:
```hcl
# Recommended fix
[corrected code]
```

**Estimated Effort**: Minimal / Low / Moderate / High / Extensive

---

[Repeat for each finding]

## 4. Recommendations

### Immediate Actions (Critical/High)
1. [Action item]
2. [Action item]

### Short-term Improvements (Medium)
1. [Action item]

### Long-term Hardening (Low/Informational)
1. [Action item]

## 5. Control Mapping

| Finding | CIS | NIST | ISO 27001 | Sanofi Policy |
|---------|-----|------|-----------|---------------|
| Finding 1 | X.X | XX-XX | X.X.X | [Policy ref] |

## 6. Appendix

### A. Files Scanned
- `path/to/file1.tf`
- `path/to/file2.tf`

### B. Tools Used
- terraform validate
- tfsec (if available)
- checkov (if available)

### C. References
- [CIS AWS Foundations Benchmark](https://www.cisecurity.org/benchmark/amazon_web_services)
- [NIST SP 800-53](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final)
- Sanofi Request-for-Comments: [RFC link]
- Confluence CODE space: [relevant pages]
```

## Severity Definitions

| Level | Definition | Examples |
|-------|------------|----------|
| **Critical** | Direct exploitation possible | Public S3 bucket with sensitive data, IAM admin access to *, unencrypted RDS with public access |
| **High** | Serious vulnerability, limited conditions | Overly permissive security groups, missing encryption at rest, no MFA on IAM |
| **Medium** | Weakens defense-in-depth | Missing logging, no backup retention, default VPC usage |
| **Low** | Minor hardening issue | Missing tags, no description fields, suboptimal instance sizes |
| **Informational** | Advisory observation | Deprecated resource types, upcoming feature recommendations |

## Effort Estimation

| Level | Time | Cost | Scope |
|-------|------|------|-------|
| **Minimal** | <1 hour | Negligible | Single config change |
| **Low** | 1-4 hours | Low | One resource/module |
| **Moderate** | 0.5-2 days | Some testing | Multi-service impact |
| **High** | 2-5 days | Complex | Architectural impact |
| **Extensive** | >5 days | Significant | Policy-level change |

## Common IaC Issues

### Critical
- S3 bucket with `acl = "public-read"`
- Security group with `0.0.0.0/0` ingress on sensitive ports
- IAM policy with `"Action": "*"` or `"Resource": "*"`
- Hardcoded credentials in `.tf` files
- RDS instance with `publicly_accessible = true`

### High
- Missing KMS encryption on S3, RDS, EBS
- Security group allowing all egress
- IAM role without condition constraints
- Missing VPC flow logs
- No CloudTrail logging

### Medium
- Missing CloudWatch alarms
- No backup/snapshot configuration
- Default encryption keys instead of CMK
- Missing resource tagging
- No lifecycle policies

### Low
- Missing description fields
- Inconsistent naming conventions
- No provider version constraints
- Missing outputs for important values

## Sanofi-Specific Checks

### Tagging Compliance
```hcl
# REQUIRED on all resources
tags = {
  CE_Application_ID   = "APM1234567"  # Must be valid APM ID
  CE_Application_Name = "App Name"
  CE_Environment      = "DEV|TEST|PROD"
}
```

### Module Compliance
- All AWS resources MUST use `terraform-aws-library` modules
- Direct `aws_*` resources are non-compliant unless module doesn't exist
- Module versions MUST be pinned

### RFC Compliance
- Check `Sanofi-Accelerator/Request-for-Comments` accepted folder
- Validate against approved architecture patterns
