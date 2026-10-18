<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# IaC Security Review Report Template

Save reports to `audits/iac-security-review-YYYY-MM-DD.md`.

## Report Structure

```markdown
# Infrastructure Security Review

## 1. Metadata

| Field | Value |
|-------|-------|
| Review Date | YYYY-MM-DD |
| Target Repository | {repo-name} |
| Environments | {dev, test, prod — as detected} |
| Frameworks Scanned | {Terraform, CDK, SST, CloudFormation, Pulumi} |
| Files Scanned | {count} |
| Standards Referenced | CIS AWS Benchmark, NIST SP 800-53 |

## 2. Executive Summary

**Overall Risk Level**: [Critical / High / Medium / Low / Clean]

| Severity | Count |
|----------|-------|
| Critical | X |
| High | X |
| Medium | X |
| Low | X |
| Informational | X |

**Top Findings**:
- [One-line summary of each Critical/High finding]

## 3. Resource Inventory

| Resource Type | Name/ID | File | Internet-Facing | Auth | Encryption | WAF |
|---------------|---------|------|------------------|------|------------|-----|
| API Gateway | example-api | infra/api.ts:42 | Yes | None | TLS | No |
| S3 Bucket | data-bucket | infra/storage.tf:10 | No | N/A | AES-256 | N/A |
| Lambda URL | processor | infra/compute.ts:18 | Yes | None | TLS | No |

## 4. Detailed Findings

### Finding 1: [Title]

| Attribute | Value |
|-----------|-------|
| Control | [Control ID from security-controls.md, e.g. PE-01] |
| Severity | Critical / High / Medium / Low / Informational |
| Confidence | High / Medium / Low |
| Category | Public Exposure / Auth / Encryption / Network / Edge / Logging / Secrets / Sanofi |

**Evidence**:

File: `path/to/file.ts` (lines XX-XX)
```typescript
// or hcl, yaml, python — match the source framework
[code snippet showing the vulnerability]
```

**Impact**:
[What risk this enables — e.g., "Unauthenticated users can invoke the Lambda function
directly via its public URL, bypassing all API Gateway controls."]

**Attack Scenario** (Critical/High findings only):
> [Step-by-step narrative of how an attacker exploits this. Example:]
>
> 1. Attacker discovers the API Gateway URL in the frontend JS bundle served by CloudFront
> 2. Attacker sends `POST /personas` with a crafted payload — no auth check blocks it
> 3. Attacker calls `GET /personas` to enumerate all existing personas and their IDs
> 4. Attacker calls `GET /personas/{id}/memories` to exfiltrate persona memory data
> 5. Attacker calls `POST /chat/stream` to invoke Bedrock models at the organization's cost
>
> **Tools**: `curl`, browser DevTools, or any HTTP client. No credentials needed.
> **Time to exploit**: Minutes.

**Remediation**:
```typescript
// Corrected code in the same framework as the finding
[remediation snippet]
```

**Estimated Effort**: Minimal / Low / Moderate / High / Extensive

---

[Repeat for each finding, ordered by severity (Critical first)]

## 5. Cross-Resource Findings

### Architectural Gaps

[Findings from cross-resource analysis — defense-in-depth gaps, blast radius,
environment inconsistency]

### Attack Surface Map

[Trace external traffic paths through infrastructure layers]

```
Internet → CloudFront (no WAF) → API Gateway (no auth) → Lambda → OpenSearch
```

### End-to-End Attack Chains

[Describe realistic attack chains that combine multiple findings to show escalation.
Each chain should tell a story: who the attacker is, what they do step by step,
and what the business impact is. Example:]

#### Chain 1: Unauthenticated data exfiltration via public API

> **Attacker profile**: External, no credentials, no insider knowledge.
>
> 1. Attacker visits the CloudFront URL (no WAF) and opens browser DevTools
> 2. In the JS bundle, attacker finds `VITE_API_URL` and `VITE_FUNCTION_URL`
> 3. Attacker calls `GET /personas` on the API Gateway (no authorizer) — gets full persona list
> 4. For each persona ID, attacker calls `GET /personas/{id}/memories` — exfiltrates all semantic memories
> 5. Attacker calls `POST /chat` with each persona — generates AI responses at organization cost
>
> **Combined findings**: EP-01 (no WAF) + PE-01 (no auth on API GW) + EP-03 (CORS `*`)
> **Business impact**: Full data exfiltration, uncontrolled Bedrock spend, persona IP theft.

#### Chain 2: Direct backend access via Lambda Function URL

> **Attacker profile**: External, discovers Function URL from frontend bundle or DNS enumeration.
>
> 1. Attacker extracts the Lambda Function URL from the frontend JS bundle
> 2. Attacker sends requests directly to the Function URL, bypassing API Gateway entirely
> 3. With `Resource: "*"` on OpenSearch, attacker queries any OpenSearch domain in the account
> 4. With `Resource: "*"` on Bedrock, attacker invokes any model (including expensive ones)
> 5. No CloudWatch alarms exist — the attack runs undetected
>
> **Combined findings**: PE-02 (Function URL no auth) + AA-02 (IAM `*`) + LM-04 (no alarms)
> **Business impact**: Cross-domain data access, unlimited AI costs, no detection.

## 6. Recommendations

### Immediate Actions (Critical/High)
1. [Specific action with file reference]
2. [Specific action with file reference]

### Short-term Improvements (Medium)
1. [Action item]

### Long-term Hardening (Low/Informational)
1. [Action item]

## 7. Appendix

### A. Files Scanned
- `path/to/file1.tf`
- `path/to/file2.ts`

### B. Controls Checked
[List all control IDs that were evaluated]

### C. Controls Not Applicable
[List controls skipped and why — e.g., "NS-04: No VPC-based resources detected"]
```

## Effort Estimation Scale

| Level | Time | Scope |
|-------|------|-------|
| **Minimal** | <1 hour | Single config change |
| **Low** | 1-4 hours | One resource/module |
| **Moderate** | 0.5-2 days | Multi-service impact |
| **High** | 2-5 days | Architectural impact |
| **Extensive** | >5 days | Policy-level change |
