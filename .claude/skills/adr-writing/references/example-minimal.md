<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Use PostgreSQL for User Profile Persistence

* Status: accepted
* Deciders: Alice Chen, Bob Martin
* Date: 2025-11-04

## Context and Problem Statement

How should we persist user profile data given our requirements for sub-10ms read
latency, eventual consistency tolerance, and a schema that evolves monthly?

## Decision Outcome

Chosen option: "PostgreSQL with JSONB columns", because it meets our latency
target via indexed queries, the team has existing SQL expertise, and operational
overhead stays low with a single managed database engine (RDS).

Option B (MongoDB) was not selected because it introduces a new database engine
and operational tooling without measurable benefit for our access patterns.

### Positive Consequences

* Single database engine simplifies backup, monitoring, and on-call runbooks
* JSONB columns accommodate monthly schema changes without migrations

### Negative Consequences

* JSONB queries require GIN indexes — must be monitored for write amplification
* Team needs a short ramp-up on JSONB-specific query patterns

## Considered Options

* PostgreSQL with JSONB columns
* MongoDB Atlas

### PostgreSQL with JSONB Columns

Managed PostgreSQL (RDS) with JSONB columns for semi-structured profile fields
and B-tree indexes on high-cardinality lookup keys.

* **Pros**
  * Good, because p95 read latency is 6ms on a db.r6g.large instance (load test: PROJ-456)
  * Good, because the team has 3 years of production PostgreSQL experience
* **Cons**
  * Bad, because JSONB GIN indexes increase write latency by ~15% vs flat columns
  * Bad, because complex JSONB queries are harder to optimize than flat-table queries

### MongoDB Atlas

Managed MongoDB with flexible document schema and built-in horizontal scaling.

* **Pros**
  * Good, because schema-less documents naturally fit evolving profile shapes
  * Good, because Atlas provides auto-scaling and built-in monitoring
* **Cons**
  * Bad, because it introduces a second database engine (training, ops tooling, on-call)
  * Bad, because our read patterns are simple key lookups — MongoDB's aggregation pipeline adds unused complexity

## Architecture Manifesto Alignment

| # | Principle          | Alignment | Notes                                                       |
| - | ------------------ | --------- | ----------------------------------------------------------- |
| 2 | Simplicity         | Aligned   | Single DB engine, no new operational tooling                |
| 3 | Technical Debt     | Aligned   | Avoids introducing a second database with duplicated ops    |
| 8 | Performance        | Aligned   | 6ms p95 read latency verified under production-like load    |

## Links

* Load test results: PROJ-456
