<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Adopt Step Functions for Order Processing Orchestration

* Status: accepted
* Deciders: Dana Park, Eric Holm, Fatima Al-Rashid
* Date: 2025-09-18

Technical Story: [ORDERS-1042](https://sanofi.atlassian.net/browse/ORDERS-1042)

## Context and Problem Statement

How should we orchestrate the 7-step order processing pipeline (validate, reserve
inventory, charge payment, fulfill, notify, update analytics, emit events) given
our requirements for per-step retry, at-least-once delivery, and auditability of
every state transition?

## Decision Outcome

Chosen option: "AWS Step Functions (Standard)", because it provides built-in
per-step retry with exponential backoff, a visual execution audit trail, and
native integration with the Lambda functions we already use for each step.

Option B (custom SQS choreography) was not selected because it requires building
retry, dead-letter routing, and execution tracing from scratch — estimated at
6 weeks of engineering effort for parity with Step Functions' built-in features.

Option C (MWAA/Airflow) was ruled out — see Options Ruled Out.

### Positive Consequences

* Per-step retry and error handling are declarative, not custom code
* Execution history provides full audit trail without additional instrumentation
* New steps can be added by editing the state machine definition — no plumbing changes

### Negative Consequences

* 25,000 state transition/second hard limit may require partitioning at scale
* Team needs to learn Amazon States Language (ASL) — estimated 1-week ramp-up
* Vendor lock-in: migrating away from Step Functions would require rewriting orchestration logic

## Decision Drivers

| Driver                | Description                                                    |
| --------------------- | -------------------------------------------------------------- |
| Per-step retry        | Each step must independently retry with configurable backoff   |
| Auditability          | Regulators require a full trace of every order state change    |
| Operational overhead  | Small team (3 engineers) cannot maintain custom infrastructure |
| Time to market        | MVP must ship in 4 weeks                                       |

## Considered Options

* AWS Step Functions (Standard)
* Custom SQS-based choreography

### AWS Step Functions (Standard)

Managed orchestration service using state machine definitions (ASL) to
coordinate Lambda functions with built-in retry, parallel execution, and
execution history.

* **Pros**
  * Good, because per-step retry with exponential backoff is declarative (no custom code)
  * Good, because execution history provides audit trail for compliance (SOX)
  * Good, because native Lambda integration eliminates glue code
  * Good, because visual workflow editor accelerates debugging
* **Cons**
  * Bad, because Standard workflow cost is $0.025 per 1,000 state transitions — at 500K orders/month (est. 3.5M transitions) this is ~$87.50/month
  * Bad, because 25,000 state transitions/second limit requires partitioning above ~3,500 concurrent orders
  * Bad, because Amazon States Language has a learning curve for the team

### Custom SQS-Based Choreography

Event-driven architecture using SQS queues between Lambda functions, with
manual retry logic and dead-letter queues for failure handling.

* **Pros**
  * Good, because SQS is essentially free at our volume (~$0.40/month for 3.5M messages)
  * Good, because no vendor-specific orchestration language — standard Lambda code
* **Cons**
  * Bad, because per-step retry requires custom code in each Lambda (estimated 2 weeks to build)
  * Bad, because audit trail requires custom instrumentation across 7 queues (estimated 2 weeks)
  * Bad, because debugging failed orders requires correlating logs across 7 independent functions
  * Bad, because adding a new step requires updating queue subscriptions, retry logic, and DLQ configuration

## Architecture Manifesto Alignment

| # | Principle              | Alignment | Notes                                                                        |
| - | ---------------------- | --------- | ---------------------------------------------------------------------------- |
| 2 | Simplicity             | Aligned   | Declarative orchestration replaces ~2,000 lines of custom retry/routing code |
| 4 | Quality by Design      | Aligned   | Built-in retry and audit trail satisfy SOX compliance from day one           |
| 6 | Decoupling             | Aligned   | Each step is an independent Lambda; orchestration logic is external          |
| 8 | Performance            | Partial   | 25K transitions/sec limit is sufficient today but may constrain at 10x scale |
| 9 | Automation             | Aligned   | State machine definition is IaC-compatible (CDK/CloudFormation)              |
| 10 | Frugality             | Tension   | $87.50/month vs $0.40/month for SQS — justified by 4 weeks saved dev time   |

## Options Ruled Out

### MWAA (Managed Apache Airflow)

Not viable because MWAA does not support sub-second task scheduling — minimum
DAG interval is 1 minute, which violates our requirement for real-time order
processing. Per the [MWAA documentation](https://docs.aws.amazon.com/mwaa/latest/userguide/mwaa-faqs.html):
"Amazon MWAA is designed for batch workflow orchestration, not real-time
event processing."

Additionally, MWAA does not allow custom SQS queues — it provisions and manages
its own SQS queue per environment, preventing integration with our existing
event infrastructure.

## Cost Annex

### Component Pricing

| Component              | Rate                           | Source                                                                 |
| ---------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| Step Functions Standard | $0.025 / 1,000 transitions    | [AWS pricing](https://aws.amazon.com/step-functions/pricing/)          |
| SQS Standard           | $0.40 / 1M requests           | [AWS pricing](https://aws.amazon.com/sqs/pricing/)                     |
| Lambda invocations     | $0.20 / 1M requests           | [AWS pricing](https://aws.amazon.com/lambda/pricing/)                  |

### Scenario Comparison

| Scenario               | Step Functions    | Custom SQS       |
| ---------------------- | ----------------- | ----------------- |
| 500K orders/month      | $87.50/month      | $1.80/month       |
| 2M orders/month        | $350/month        | $7.20/month       |
| Engineering build cost | 0 weeks (built-in) | 6 weeks (~$60K)  |
| Break-even point       | ~7 years at 500K volume | —            |

## Links

* [ORDERS-1042](https://sanofi.atlassian.net/browse/ORDERS-1042) — Epic: Order Processing Pipeline
* [ADR-008-use-lambda-for-compute.md](ADR-008-use-lambda-for-compute.md) — Prior decision on Lambda adoption
* [Step Functions quotas](https://docs.aws.amazon.com/step-functions/latest/dg/limits.html)
