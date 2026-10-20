<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Severity Levels

Sanofi's incident severity classification. Based on **customer impact**,
not engineering effort or internal inconvenience.

Use the **highest** applicable severity. When in doubt, escalate up
(SEV3 → SEV2, SEV2 → SEV1), not down. It is always acceptable to
reclassify downward after the facts settle; under-classifying in the
moment delays the right level of response.

## SEV1 — Critical

**Definition**: Major customer-facing outage, data loss, security breach,
or regulatory-reporting failure. Business is materially impaired.

**Characteristics** (any one qualifies):

- Complete or near-complete unavailability of a core product surface
  (login, checkout, prescription submission, clinical data entry).
- Data loss, data corruption, or unintended data exposure (including PII,
  PHI, or GxP-regulated records).
- Security breach or credible suspected breach.
- Regulatory-reporting failure (e.g., missed pharmacovigilance submission
  window).
- Revenue-critical path broken for > 5 minutes with no workaround.

**Response SLA**:

- On-call paged immediately.
- Incident Commander declared within 15 minutes.
- Dedicated war room (Slack channel + video bridge) within 15 minutes.
- Communications lead assigned.
- Status-page update within 30 minutes of detection.
- Stakeholders notified per incident-comms plan (execs on SEV1).

**Post-mortem**: **Required within 5 business days** of incident closure.
Reviewed by engineering leadership.

**Examples**:

- User authentication completely down for 20 minutes.
- Prescription-submission API rejecting all valid requests.
- Accidental exposure of patient records to unauthorized users.
- Ransomware or confirmed unauthorized access to production systems.
- Payments processor integration broken; no checkouts complete globally.

## SEV2 — High

**Definition**: Significant degradation or partial outage. A key feature
is broken for a meaningful user segment, or performance is severely
degraded. Business continues but is measurably harmed.

**Characteristics** (any one qualifies):

- Error rate elevated well above baseline (typically > 1% sustained) for
  a user-facing surface.
- Latency degraded to unusable levels (p95 > 10× baseline) for a core
  flow.
- A major feature broken for a subset of users (e.g., EU region,
  enterprise tier, a specific integration).
- Partial data-processing failure with no data loss but delays to a
  business process.
- Recurring SEV3 incidents over short windows (cumulative impact).

**Response SLA**:

- On-call response within 30 minutes.
- Incident Commander declared for the duration.
- Slack incident channel opened.
- Status-page update within 60 minutes if customer-visible.

**Post-mortem**: **Required within 5 business days** of incident closure.

**Examples**:

- Checkout fails for ~8% of requests for 1.5 hours (the example used in
  the template).
- Clinical dashboard loads taking 30s instead of 2s for enterprise tier.
- One regional deployment intermittently failing over a 4-hour window.
- Notification emails delayed by 6+ hours (business process disrupted).

## SEV3 — Moderate

**Definition**: Minor degradation, contained blast radius, workaround
exists. Detected by monitoring or reported by a small number of users.

**Characteristics** (any one qualifies):

- Elevated error rate slightly above baseline, contained to a non-core
  flow.
- Small user subset affected with available workaround.
- Background job failing with automatic retry succeeding within SLA.
- Cosmetic or non-blocking bug on a core surface.

**Response SLA**:

- Responded to during the same business day.
- Tracked in the normal issue tracker (no dedicated war room).

**Post-mortem**: **Optional**. Strongly recommended when:

- The same pattern has caused multiple SEV3s (recurrence signal).
- A near-miss — would have been SEV2 but for luck (timing, traffic level).
- A new failure mode not seen before (learning signal).

**Examples**:

- Internal admin dashboard throws errors on a filter rarely used.
- Nightly data-export job retries once before succeeding.
- Layout glitch on the billing page on one browser version.
- A single background worker crashes and auto-restarts within seconds.

## Classification rules

1. **Customer impact drives severity**, not engineering embarrassment or
   on-call fatigue.
2. **"Degraded" is SEV2, not SEV3**, when degradation is measurable by
   customers (slow, flaky, partial).
3. **Security and compliance are force multipliers**: a SEV3-sized outage
   with a PII leak is a SEV1. A SEV2-sized outage that also missed a
   regulatory report is SEV1.
4. **Reclassify explicitly**. If the scope widens mid-incident, the IC
   re-declares severity (e.g., "this just became SEV1, paging leadership
   now"). Do not silently let SEV creep happen without a decision.
5. **Do not classify down to avoid paperwork.** If SEV2 criteria apply,
   the post-mortem is required even if it is inconvenient.

## Decision flow

```
Is customer data at risk? (loss, corruption, exposure)
├── Yes → SEV1
└── No → Is a core product surface fully down?
         ├── Yes → SEV1
         └── No → Is a user-facing feature materially degraded for > 5 min?
                  ├── Yes, meaningful user segment → SEV2
                  └── No, narrow impact with workaround → SEV3
```

When the flow gives an ambiguous answer, pick the higher severity and let
the incident review reclassify later.
