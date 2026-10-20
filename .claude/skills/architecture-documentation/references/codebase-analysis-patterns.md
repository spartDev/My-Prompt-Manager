<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Codebase Analysis Patterns

How to detect architecture from code. Use these patterns to identify C4 elements
(systems, containers, components) and relationships (data flows, external integrations)
by reading the codebase.

## Table of Contents

- [Service Boundary Detection](#service-boundary-detection)
  - [Monorepo Pattern](#monorepo-pattern)
  - [Multi-Repo Pattern](#multi-repo-pattern)
  - [Infrastructure-Defined Containers](#infrastructure-defined-containers)
- [Data Flow Detection](#data-flow-detection)
  - [HTTP Calls (REST, GraphQL)](#http-calls-rest-graphql)
  - [Database Queries](#database-queries)
  - [Message Queues](#message-queues)
  - [Cache Operations](#cache-operations)
  - [Object Storage](#object-storage)
- [External System Detection](#external-system-detection)
  - [Authentication Providers](#authentication-providers)
  - [Payment Services](#payment-services)
  - [Analytics and Monitoring](#analytics-and-monitoring)
  - [Email and Notification](#email-and-notification)
  - [CDN and Storage](#cdn-and-storage)
- [Technology Detection](#technology-detection)
  - [Framework Detection (package.json)](#framework-detection-packagejson)
  - [ORM Detection](#orm-detection)
  - [Runtime Detection](#runtime-detection)
- [Worked Example: Mapping Code to C4](#worked-example-mapping-code-to-c4)
  - [Resulting C4 Elements](#resulting-c4-elements)
  - [Resulting Relationships](#resulting-relationships)

---

## Service Boundary Detection

### Monorepo Pattern

In a monorepo, each independently deployable unit is a container.

```
project-root/
  packages/
    api/                    -> Container: API Service
      package.json          (has "scripts": { "start": ... })
      Dockerfile
      src/
    web-app/                -> Container: Web Application (client-side SPA)
      package.json          (has "react", "vite")
      src/
    worker/                 -> Container: Background Worker
      package.json          (has "start": "node worker.js")
      src/
    shared/                 -> NOT a container (shared library)
      package.json          (no "start" script, only "main"/"module")
      src/
  infrastructure/
    terraform/              -> Infrastructure definitions (DB, queues = containers)
      main.tf
      modules/
  docker-compose.yml        -> Maps containers for local dev
```

**Heuristics:**
- Each directory with its own `package.json` AND a `start` script or `Dockerfile` is a container
- Shared libraries (`shared/`, `common/`, `utils/`) are NOT containers
- `docker-compose.yml` services map closely to production containers
- Each entry in `docker-compose.yml` with its own image or build context is a container

### Multi-Repo Pattern

When each repository is a separate service:

```
github.com/org/user-api       -> Container: User API
  package.json
  Dockerfile

github.com/org/user-web       -> Container: User Web App (SPA)
  package.json (react)

github.com/org/notification-service  -> Container: Notification Service
  package.json
  Dockerfile

github.com/org/infrastructure -> Not a container (Terraform definitions)
  terraform/
```

**Heuristics:**
- Each repo with a `Dockerfile` or deployment config is usually one container
- Some repos may contain multiple containers (check for multiple Dockerfiles)
- Infrastructure repos define containers (databases, queues) as Terraform resources

**Cross-repo workspace detection:**

When `sanofi-code-workflow.yaml` provides `github.repos`, the agent receives multiple
local paths. Analysis strategy:

1. Analyze each repo independently using the same heuristics (Dockerfile, package.json, etc.)
2. Merge all discovered containers into a single L2 system boundary
3. Detect cross-repo relationships by matching:
   - API URLs / base paths referenced in one repo that match routes defined in another
   - Shared database names (same RDS instance, same DynamoDB table)
   - Shared queue names (same SQS queue name in producer and consumer repos)
   - Shared S3 bucket names
4. Infrastructure repos contribute data store and managed service containers

```yaml
# Example: sanofi-code-workflow.yaml
github:
  repos:
    backend: ./user-api
    frontend: ./user-web
    infra: ./infrastructure

# Analysis result:
# ./user-api        -> Container: User API [Fastify / TypeScript]
# ./user-web        -> Container: User SPA [React / TypeScript] (client)
#                   -> Container: User Web Server [Vite / Node.js] (server, delivers SPA)
# ./infrastructure  -> Container: User DB [PostgreSQL / RDS]
#                   -> Container: User Cache [Redis / ElastiCache]
#                   -> Container: Event Queue [SQS]
```

### Serverless Consolidation Pattern

Multiple Lambda functions do NOT always mean multiple containers. Apply these consolidation
rules before creating the L2 diagram:

**Same container** (consolidate into ONE):
- Multiple Lambdas behind a **single API Gateway** sharing a database and codebase
- Multiple Lambdas in a **SAM template** or **serverless.yml** that form one logical service
- Multiple Lambdas in a **monorepo workspace** with shared ports/adapters/services layers

**Separate containers** (keep as individual):
- Lambdas with **independent deployment pipelines** and no shared API Gateway
- Lambdas with **different runtimes** (e.g., Node.js vs Python) serving different concerns
- Lambdas that are **action group tools** invoked by a managed orchestration service

```
Consolidation heuristics:
  Single API Gateway + N Lambdas + shared DB    -> ONE container (the API service)
  SAM template.yml with grouped functions        -> Usually ONE container per logical service
  Lambda A (Node.js API) + Lambda B (Python ML)  -> TWO containers (different concerns)
  Lambda invoked only by Bedrock/Step Functions   -> Separate container (action group tool)
```

**Example**: A repo with 4 Lambda functions (studies, benchmark, feedback, migrations) behind
one API Gateway, all using the same PostgreSQL database and Drizzle ORM, is ONE container:
"Core API [Node.js / Hono]" -- not four.

### Managed Orchestration Services

AWS managed orchestration services are **external systems**, not containers within your
system boundary:

```
IS an external system:
  AWS Bedrock Agents          -> External: AWS Bedrock (agent orchestration)
  AWS Step Functions          -> External: AWS Step Functions (workflow orchestration)
  Amazon EventBridge Pipes    -> External: EventBridge (event routing)
  AWS App Runner              -> External: AWS App Runner (managed compute)

IS a container (you own and deploy it):
  Lambda function (your code) -> Container: your service [Lambda / Python]
  ECS Fargate task (your app) -> Container: your service [FastAPI / Python]
  Action group Lambda (tool)  -> Container: your tool [Lambda / Python]
```

**Key distinction**: If the service runs YOUR code (Lambda, ECS task), it is a container.
If the service orchestrates your containers using AWS-managed logic (Bedrock Agents,
Step Functions state machines), it is an external system that invokes your containers.

### Infrastructure-Defined Containers

Terraform and Kubernetes manifests define containers that code repositories depend on:

```hcl
# terraform/main.tf
module "rds" { ... }           -> Container: Database [PostgreSQL]
module "elasticache" { ... }   -> Container: Cache [Redis]
module "sqs" { ... }           -> Container: Queue [SQS]
module "s3_bucket" { ... }     -> Container: Object Store [S3]
module "lambda" { ... }        -> Container: see Serverless Consolidation Pattern above
module "dynamodb" { ... }      -> Container: Database [DynamoDB]
module "ecs_service" { ... }   -> Container: (application service)
module "ecr_repository" { ... } -> NOT a container (image registry)
```

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-api               -> Container: User API
spec:
  template:
    spec:
      containers:
        - name: user-api
          image: user-api:latest
```

---

## Data Flow Detection

Identify relationships between containers by searching for client/SDK usage patterns.

### HTTP Calls (REST, GraphQL)

```
Pattern                          -> Relationship
─────────────────────────────────────────────────────
fetch('https://api.example.com') -> Sends requests to External: Example API [HTTP/REST]
axios.get('/api/users')          -> Fetches data from Internal API [HTTP/REST]
new ApolloClient({ uri })       -> Queries data from GraphQL API [HTTP/GraphQL]
httpClient.post('/orders')       -> Creates orders via API [HTTP/REST]
```

**What to search for:**
```
# Node.js / TypeScript
grep -r "fetch\|axios\|http\.get\|http\.post\|got\(" src/
grep -r "new ApolloClient\|gql\`" src/

# Python
grep -r "requests\.get\|requests\.post\|httpx\.\|aiohttp\." src/
```

### Database Queries

```
Pattern                          -> Relationship
─────────────────────────────────────────────────────
import { Pool } from 'pg'       -> Reads/writes data [SQL/TCP] to PostgreSQL container
prisma.user.findMany()           -> Queries user data [Prisma/TCP] to database
drizzle.select().from(users)     -> Queries user data [Drizzle/TCP] to database
dynamoClient.send(new PutItemCommand) -> Stores data [AWS SDK] in DynamoDB container
mongoose.connect(MONGO_URI)      -> Reads/writes data [MongoDB Wire/TCP] to MongoDB
```

**What to search for:**
```
grep -r "new Pool\|PrismaClient\|drizzle\|mongoose\|DynamoDB\|DocumentClient" src/
grep -r "createConnection\|getRepository\|DataSource" src/  # TypeORM
```

### Message Queues

```
Pattern                          -> Relationship
─────────────────────────────────────────────────────
sqs.sendMessage({ QueueUrl })    -> Publishes messages to Queue [SQS/HTTPS]
sqs.receiveMessage()             -> Consumes messages from Queue [SQS/HTTPS]
eventBridge.putEvents()          -> Emits events to Event Bus [EventBridge/HTTPS]
channel.publish(exchange, key)   -> Publishes messages to Broker [AMQP]
producer.send({ topic })         -> Produces records to Topic [Kafka]
```

**Arrow style:** Use **dashed lines** for async message-based communication.

### Cache Operations

```
Pattern                          -> Relationship
─────────────────────────────────────────────────────
redis.get(key)                   -> Reads cached data [Redis/TCP]
redis.set(key, value)            -> Writes to cache [Redis/TCP]
memcached.get(key)               -> Reads cached data [Memcached/TCP]
```

### Object Storage

```
Pattern                          -> Relationship
─────────────────────────────────────────────────────
s3.putObject({ Bucket, Key })    -> Stores files in Object Store [S3/HTTPS]
s3.getObject({ Bucket, Key })    -> Retrieves files from Object Store [S3/HTTPS]
s3.upload(params)                -> Uploads to Object Store [S3/HTTPS]
```

---

## External System Detection

External systems are identified by SDK usage, OAuth configuration, and third-party
API client patterns.

### Authentication Providers

```
Signal                            -> External System
──────────────────────────────────────────────────────
OIDC_ISSUER env var               -> Identity Provider (e.g., Azure AD, Okta)
passport.use(new OIDCStrategy())  -> Identity Provider
@azure/msal-node                  -> Azure Active Directory
AWS Cognito SDK                   -> AWS Cognito (Identity)
auth0 SDK                         -> Auth0 (Identity)
SAML2 config                      -> Enterprise SSO Provider
```

### Payment Services

```
Signal                            -> External System
──────────────────────────────────────────────────────
stripe SDK / @stripe/stripe-js    -> Stripe (Payment Processing)
adyen SDK                         -> Adyen (Payment Processing)
paypal SDK                        -> PayPal (Payment Processing)
```

### Analytics and Monitoring

```
Signal                            -> External System
──────────────────────────────────────────────────────
dd-trace / datadog SDK            -> Datadog (Monitoring)
@sentry/node / Sentry.init()     -> Sentry (Error Tracking)
newrelic agent                    -> New Relic (APM)
@google-analytics / gtag          -> Google Analytics
amplitude SDK                     -> Amplitude (Product Analytics)
@opentelemetry/*                  -> OpenTelemetry Collector -> Observability Platform
```

### Email and Notification

```
Signal                            -> External System
──────────────────────────────────────────────────────
nodemailer + SMTP config          -> Email Service (SMTP)
@sendgrid/mail                    -> SendGrid (Email)
AWS SES SDK                       -> AWS SES (Email)
twilio SDK                        -> Twilio (SMS/Voice)
firebase-admin (messaging)        -> Firebase Cloud Messaging (Push)
```

### CDN and Storage

```
Signal                            -> External System
──────────────────────────────────────────────────────
CloudFront distribution config    -> AWS CloudFront (CDN)
Akamai config                     -> Akamai (CDN)
```

---

## Technology Detection

Detect the technology stack to annotate C4 elements with the correct technology labels.

### Framework Detection (package.json)

```json
{
  "dependencies": {
    "fastify": "^4.x"        -> [Fastify / TypeScript]
    "express": "^4.x"        -> [Express / TypeScript]
    "@nestjs/core": "^10.x"  -> [NestJS / TypeScript]
    "hono": "^4.x"           -> [Hono / TypeScript]
    "react": "^19.x"         -> [React 19]
    "next": "^14.x"          -> [Next.js / React]
    "vue": "^3.x"            -> [Vue 3]
  }
}
```

### ORM Detection

```
prisma (schema.prisma file)       -> ORM: Prisma
drizzle-orm (drizzle.config.ts)   -> ORM: Drizzle
typeorm (ormconfig, DataSource)   -> ORM: TypeORM
sequelize                         -> ORM: Sequelize
mongoose                          -> ODM: Mongoose (MongoDB)
```

### Runtime Detection

```
.nvmrc or .node-version          -> Node.js (specific version)
.python-version                   -> Python (specific version)
go.mod                            -> Go
Cargo.toml                        -> Rust
pom.xml / build.gradle            -> Java
```

---

## Worked Example: Mapping Code to C4

Given this directory structure:

```
my-service/
  apps/
    web/                       # React SPA
      package.json             # react, vite
      src/
    api/                       # Fastify backend
      package.json             # fastify, drizzle-orm, pg
      src/
        routes/
        services/
        repositories/
        middleware/
    worker/                    # Background processor
      package.json             # bullmq, pg
      src/
  infrastructure/
    terraform/
      main.tf                  # RDS PostgreSQL, SQS, S3, ElastiCache Redis
      modules/
  docker-compose.yml           # web, api, worker, postgres, redis
```

### Resulting C4 Elements

| Code Signal | C4 Element | Type | Technology |
|-------------|-----------|------|------------|
| `apps/web/` (react, vite) | Web Application | Container | React 19 / TypeScript |
| `apps/web/` serves SPA | (implied) API delivery | -- | Static assets via CDN or API server |
| `apps/api/` (fastify) | API Service | Container | Fastify / TypeScript |
| `apps/worker/` (bullmq) | Background Worker | Container | Node.js / BullMQ |
| terraform `aws_rds_instance` | Database | Container | PostgreSQL |
| terraform `aws_sqs_queue` | Message Queue | Container | SQS |
| terraform `aws_s3_bucket` | Object Store | Container | S3 |
| terraform `aws_elasticache` | Cache | Container | Redis |
| `apps/api/src/routes/` | Route Handler | Component (L3) | Fastify Routes |
| `apps/api/src/services/` | Service Layer | Component (L3) | TypeScript |
| `apps/api/src/repositories/` | Repository Layer | Component (L3) | Drizzle ORM |
| `apps/api/src/middleware/` | Middleware | Component (L3) | JWT / OIDC |

### Resulting Relationships

| Source | Target | Label | Protocol | Style |
|--------|--------|-------|----------|-------|
| User | Web Application | Browses application | HTTPS | Solid |
| Web Application | API Service | Fetches data | HTTP/REST JSON | Solid |
| API Service | Database | Reads/writes user data | SQL/TCP | Solid |
| API Service | Message Queue | Publishes processing jobs | SQS/HTTPS | Dashed |
| Worker | Message Queue | Consumes processing jobs | SQS/HTTPS | Dashed |
| Worker | Database | Updates processing results | SQL/TCP | Solid |
| API Service | Cache | Caches session data | Redis/TCP | Solid |
| API Service | Object Store | Stores uploaded files | S3/HTTPS | Solid |
