<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Security Controls Checklist

Check every applicable control for each resource in the inventory. Each control lists what to look for across IaC frameworks.

## Severity Definitions

| Level | Definition | Examples |
|-------|------------|----------|
| **Critical** | Direct exploitation possible, data exposure imminent | Public S3 with sensitive data, IAM `Action: "*"` + `Resource: "*"`, unauthenticated public API |
| **High** | Serious vulnerability, limited conditions needed | Missing encryption at rest, overly permissive security groups, no WAF on public endpoints |
| **Medium** | Weakens defense-in-depth | Missing logging, no backup retention, default VPC usage |
| **Low** | Minor hardening gap | Missing tags, no description fields, suboptimal configuration |
| **Informational** | Advisory observation | Deprecated resource types, upcoming feature recommendations |

---

## 1. Public Exposure

### PE-01: API Gateway Without Authorizer

**Severity**: Critical

Look for HTTP/REST API Gateways with no authorization configured.

| Framework | Pattern to detect |
|-----------|-------------------|
| Terraform | `resource "aws_apigatewayv2_route"` without `authorization_type` or set to `"NONE"` |
| CDK | `HttpApi` or `RestApi` routes without `authorizer` property |
| SST | `new sst.aws.ApiGatewayV2(...)` without `auth` or `authorizers` |
| CloudFormation | `AWS::ApiGatewayV2::Route` with `AuthorizationType: NONE` |

### PE-02: Lambda Function URL Without Auth

**Severity**: Critical

Look for Lambda function URLs with `AuthType: NONE` and permissive resource policies.

| Framework | Pattern to detect |
|-----------|-------------------|
| Terraform | `resource "aws_lambda_function_url"` with `authorization_type = "NONE"` |
| CDK | `FunctionUrl` with `authType: FunctionUrlAuthType.NONE` |
| SST | Function URL config without `auth` or with `auth: "none"` |
| CloudFormation | `AWS::Lambda::Url` with `AuthType: NONE` |

Also check for resource-based policies granting `Principal: "*"` with `FunctionURLAllowPublicAccess`.

### PE-03: Public S3 Bucket

**Severity**: Critical

| Framework | Pattern to detect |
|-----------|-------------------|
| Terraform | `acl = "public-read"`, `block_public_access` all set to `false`, or missing `aws_s3_bucket_public_access_block` |
| CDK | `blockPublicAccess` not set to `BlockPublicAccess.BLOCK_ALL`, `publicReadAccess: true` |
| SST | `public: true` on `sst.aws.Bucket` or `StaticSite` without auth |
| CloudFormation | `AccessControl: PublicRead`, missing `PublicAccessBlockConfiguration` |

### PE-04: RDS Publicly Accessible

**Severity**: Critical

| Framework | Pattern to detect |
|-----------|-------------------|
| Terraform | `publicly_accessible = true` on `aws_db_instance` or `aws_rds_cluster` |
| CDK | `publiclyAccessible: true` on `DatabaseInstance` or `DatabaseCluster` |
| CloudFormation | `PubliclyAccessible: true` on `AWS::RDS::DBInstance` |

### PE-05: Elasticsearch/OpenSearch Public Access

**Severity**: Critical

| Framework | Pattern to detect |
|-----------|-------------------|
| Terraform | `aws_opensearch_domain` without VPC config, or access policy with `Principal: "*"` |
| CDK | `Domain` without `vpc` property, or open access policy |
| CloudFormation | `AWS::OpenSearchService::Domain` missing `VPCOptions` |

### PE-06: ECS/ELB Without Restricted Ingress

**Severity**: High

Look for ALBs or NLBs accepting traffic from `0.0.0.0/0` without WAF or auth.

---

## 2. Authentication & Authorization

### AA-01: Overly Permissive IAM Policy — Actions

**Severity**: Critical

| Framework | Pattern to detect |
|-----------|-------------------|
| Terraform | `"Action": "*"` or `"Action": "s3:*"` in `aws_iam_policy_document` or inline JSON |
| CDK | `.grant(iam.Effect.ALLOW, '*')`, `PolicyStatement` with `actions: ['*']` |
| SST | `permissions` blocks with wildcard actions |
| CloudFormation | `Action: '*'` in `AWS::IAM::Policy` |

### AA-02: Overly Permissive IAM Policy — Resources

**Severity**: High

Look for `"Resource": "*"` when the policy could be scoped to specific ARNs.

### AA-03: IAM Role Without Condition Constraints

**Severity**: Medium

Look for assume-role policies missing `Condition` blocks (e.g., `aws:SourceArn`, `aws:SourceAccount`).

### AA-04: Missing MFA on IAM Users

**Severity**: High

Look for IAM user policies that do not enforce MFA via conditions.

### AA-05: Cross-Account Access Without External ID

**Severity**: High

Look for trust policies allowing cross-account `sts:AssumeRole` without `sts:ExternalId` condition.

---

## 3. Encryption

### EN-01: S3 Bucket Without Encryption

**Severity**: High

| Framework | Pattern to detect |
|-----------|-------------------|
| Terraform | `aws_s3_bucket` without `aws_s3_bucket_server_side_encryption_configuration` or `server_side_encryption_configuration` block |
| CDK | `Bucket` without `encryption` property or set to `BucketEncryption.UNENCRYPTED` |
| CloudFormation | `AWS::S3::Bucket` missing `BucketEncryption` |

### EN-02: RDS Without Encryption at Rest

**Severity**: High

| Framework | Pattern to detect |
|-----------|-------------------|
| Terraform | `storage_encrypted = false` or missing on `aws_db_instance` |
| CDK | `storageEncrypted: false` or missing on `DatabaseInstance` |
| CloudFormation | `StorageEncrypted: false` on `AWS::RDS::DBInstance` |

### EN-03: EBS Volumes Without Encryption

**Severity**: High

Look for `aws_ebs_volume` or `aws_instance` root block device without `encrypted = true`.

### EN-04: SQS/SNS Without Encryption

**Severity**: Medium

Look for SQS queues or SNS topics without KMS key configuration.

### EN-05: DynamoDB Without Encryption Using CMK

**Severity**: Medium

DynamoDB encrypts by default with AWS-owned keys. Check if CMK (customer-managed key) is required by policy.

### EN-06: Missing TLS/HTTPS Enforcement

**Severity**: High

Look for S3 bucket policies missing `aws:SecureTransport` condition, ALB listeners on port 80 without redirect, API Gateways without TLS.

---

## 4. Network Security

### NS-01: Security Group — Unrestricted Ingress

**Severity**: Critical (for sensitive ports), High (for others)

| Framework | Pattern to detect |
|-----------|-------------------|
| Terraform | `ingress` with `cidr_blocks = ["0.0.0.0/0"]` on ports 22, 3389, 3306, 5432, 27017, etc. |
| CDK | `SecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(22))` |
| CloudFormation | `SecurityGroupIngress` with `CidrIp: 0.0.0.0/0` |

Sensitive ports: 22 (SSH), 3389 (RDP), 3306 (MySQL), 5432 (Postgres), 6379 (Redis), 27017 (MongoDB), 9200 (Elasticsearch).

### NS-02: Security Group — Unrestricted Egress

**Severity**: Medium

Look for `egress` rules allowing all traffic to `0.0.0.0/0` on all ports.

### NS-03: Resources in Public Subnet

**Severity**: High

Look for databases, caches, or internal services placed in public subnets (subnets with route to IGW).

### NS-04: Missing VPC Endpoints

**Severity**: Medium

For S3, DynamoDB, and other services accessed from private subnets, check if VPC endpoints exist to avoid traffic traversing the public internet.

### NS-05: Default VPC Usage

**Severity**: Medium

Look for resources without explicit VPC/subnet configuration (will use default VPC).

---

## 5. Edge & Perimeter

### EP-01: CloudFront Without WAF

**Severity**: High

| Framework | Pattern to detect |
|-----------|-------------------|
| Terraform | `aws_cloudfront_distribution` without `web_acl_id` |
| CDK | `Distribution` without `webAclId` property |
| SST | `StaticSite` or CDN config without WAF association |
| CloudFormation | `AWS::CloudFront::Distribution` missing `WebACLId` |

### EP-02: ALB/API Gateway Without WAF

**Severity**: High

Look for internet-facing ALBs or API Gateways without WAFv2 WebACL association.

### EP-03: Permissive CORS Configuration

**Severity**: High

| Framework | Pattern to detect |
|-----------|-------------------|
| Terraform | `cors_configuration` with `allow_origins = ["*"]` |
| CDK | `corsPreflight` with `allowOrigins: ['*']` |
| SST | CORS config with `allowOrigins: ["*"]` |
| CloudFormation | `CorsConfiguration` with `AllowOrigins: ['*']` |

### EP-04: Missing Rate Limiting

**Severity**: Medium

Look for public APIs without throttling configuration or WAF rate-based rules.

### EP-05: CloudFront Without HTTPS-Only

**Severity**: High

Look for CloudFront distributions allowing HTTP (viewer protocol policy not set to `redirect-to-https` or `https-only`).

---

## 6. Logging & Monitoring

### LM-01: Missing CloudTrail

**Severity**: High

Check if the account/stack includes a CloudTrail trail. If no trail resource exists in any IaC file, flag as a gap.

### LM-02: Missing VPC Flow Logs

**Severity**: Medium

Look for VPCs without associated `aws_flow_log` or `FlowLog` resources.

### LM-03: Missing S3 Access Logging

**Severity**: Medium

| Framework | Pattern to detect |
|-----------|-------------------|
| Terraform | `aws_s3_bucket` without `logging` block or `aws_s3_bucket_logging` |
| CDK | `Bucket` without `serverAccessLogsBucket` |
| CloudFormation | `AWS::S3::Bucket` missing `LoggingConfiguration` |

### LM-04: Missing CloudWatch Alarms

**Severity**: Medium

Check if critical resources (RDS, Lambda, API Gateway) have associated CloudWatch alarms for error rates, latency, or throttling.

### LM-05: ALB/CloudFront Without Access Logs

**Severity**: Medium

Look for ALBs and CloudFront distributions without access logging enabled.

---

## 7. Secrets Management

### SM-01: Hardcoded Credentials

**Severity**: Critical

Scan IaC files for patterns resembling:
- `password = "..."`, `secret = "..."`, `api_key = "..."`
- AWS access key patterns: `AKIA[A-Z0-9]{16}`
- Base64-encoded secrets in environment variable blocks

### SM-02: Missing Secrets Manager / SSM References

**Severity**: High

Look for plaintext values in environment variables, database connection strings, or API keys that should reference Secrets Manager or SSM Parameter Store.

### SM-03: Secrets in Terraform State

**Severity**: Medium

Check if `terraform.tfvars` or `*.auto.tfvars` files contain sensitive values and whether the state backend uses encryption.

---

## 8. Sanofi-Specific

### SN-01: Missing Mandatory Tags

**Severity**: Low

All resources must have:
```
CE_Application_ID, CE_Application_Name, CE_Environment
team, name, env, version, service, cost_center, contact
```

### SN-02: Direct AWS Resources Instead of terraform-aws-library

**Severity**: Low (Terraform only)

Look for raw `resource "aws_*"` blocks when a module exists in `terraform-aws-library`.

### SN-03: Unpinned Module Versions

**Severity**: Medium (Terraform only)

Look for `module` blocks without `version` constraint.

### SN-04: Missing RFC Compliance

**Severity**: Informational

Flag resources that should be checked against `Sanofi-Accelerator/Request-for-Comments` accepted patterns.
