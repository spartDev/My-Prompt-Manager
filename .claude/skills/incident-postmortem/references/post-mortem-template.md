<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Post-Mortem Template

Copy this file to `docs/postmortems/YYYY-MM-DD-short-slug.md` where the date
is the **incident start date** and the slug describes the impact (e.g.,
`2026-04-28-checkout-500s.md`).

Every section marked **Required** must be filled. Optional sections may be
omitted if they have no content — do not leave `TBD` placeholders.

---

# Post-Mortem: Checkout 500 errors following orders-api v2.41.0

> This post-mortem is **blameless**: it examines systems and processes,
> not individuals.

## Header (Required)

> **Incident ID**: reuse the ID from your incident tracker (PagerDuty,
> ServiceNow, Opsgenie, Jira incident, etc.) so the post-mortem is
> linkable from the same ID the responders used live. If no tracker
> issued one, fall back to `INC-YYYY-MMDD-NNN` (start date + daily
> sequence).
>
> **Severity**: record both the **live severity** (set during the
> incident) and the **final severity** (after post-mortem review). If
> they differ, add a short reason. Do not reclassify down to dodge the
> 5-business-day post-mortem deadline.

| Field                                                 | Value                                                 |
| ----------------------------------------------------- | ----------------------------------------------------- |
| **Incident ID**                                       | PD-INC-88421 (PagerDuty)                              |
| **Severity (live → final)**                           | SEV2 → SEV2 (confirmed; measured impact matched live) |
| **Incident start (UTC)**                              | 2026-04-28 14:03                                      |
| **Incident resolved (UTC)**                           | 2026-04-28 15:47                                      |
| **Duration (customer impact)**                        | 1h 44m                                                |
| **Post-mortem author**                                | Alice Ng (@alice)                                     |
| **Incident Commander**                                | Bob Kim (@bob)                                        |
| **Responders**                                        | @alice, @carol, @dev-oncall                           |
| **Communications lead**                               | n/a (SEV2)                                            |
| **Reviewers**                                         | @ic-manager, @sre-lead                                |
| **Post-mortem deadline (SEV1/SEV2: 5 business days)** | 2026-05-05                                            |
| **Published**                                         | 2026-05-04                                            |
| **Related tickets**                                   | ENG-1200 (root cause), SUP-4471 (customer escalation) |

## Summary (Required)

Two-to-four-sentence summary suitable for leadership and incident-review
meetings. Include: what broke, who was affected, how long it lasted, and
what the root cause was in one line.

> Between 14:07 and 15:36 UTC on 2026-04-28, approximately 8% of checkout
> requests returned HTTP 500 errors for users with legacy cart schemas
> (primarily EU paying customers who had not migrated). The outage was
> triggered by `orders-api` v2.41.0, which assumed a field populated only
> for post-migration carts. Rollback at 15:32 UTC mitigated impact;
> resolution with a forward fix landed at 15:47 UTC.

## Impact (Required)

Quantify wherever possible. If a number is unknown, say so — do not guess.

- **Users affected**: ~4,200 users (EU paying segment, ~6% of that
  segment's active users during the window).
- **Requests affected**: ~31,000 failed `/checkout` calls out of ~390,000
  (8.0% error rate at peak; baseline 0.1%).
- **Duration of customer impact**: 1h 29m (14:07 → 15:36 UTC, from
  first elevated errors to post-rollback recovery).
- **Revenue impact**: est. €48k in abandoned carts; confirmed via
  support ticket sampling, pending finance confirmation.
- **Data impact**: none — no writes were corrupted. Failed checkouts did
  not create partial orders.
- **Regulatory / compliance impact**: none (no PII exposure, no GDPR or
  SOx-relevant records affected).
- **Customer tickets filed**: 14 (all closed as "resolved after retry").

## Timeline (Required)

All times UTC. Sources linked inline where available. Facts only — no
interpretation.

| Time (UTC) | Actor            | Event                                                                          |
| ---------- | ---------------- | ------------------------------------------------------------------------------ |
| 14:03      | Deploy system    | `orders-api` v2.41.0 deploy to production completes ([run](#)).                |
| 14:07      | Monitoring       | Error rate on `POST /checkout` climbs from 0.1% → 3% ([dashboard](#)).         |
| 14:09      | Customer support | First ticket filed ("Payment fails with 500").                                 |
| 14:12      | Monitoring       | Error rate crosses 5%; no page fires (threshold: 10%).                         |
| 14:18      | Support → oncall | Support escalates via Slack; oncall (@dev-oncall) acknowledges. **Detection**. |
| 14:21      | @bob             | Declares incident, assumes IC role. **Acknowledgement**.                       |
| 14:26      | @alice           | Bisects logs; identifies NullPointerException in `CartHydrator` at line 142.   |
| 14:41      | @alice           | Correlates nulls with legacy cart records (`schema_version = 1`).              |
| 14:55      | @carol           | Drafts forward fix (null-check); begins test run.                              |
| 15:12      | @bob             | Decides to roll back rather than wait for forward fix CI.                      |
| 15:20      | @carol           | Rollback PR merged; redeploy triggered.                                        |
| 15:32      | Deploy system    | v2.40.3 live. Error rate drops to baseline within 4 min. **Mitigation**.       |
| 15:36      | Monitoring       | Error rate at 0.1% baseline; support backlog clearing.                         |
| 15:47      | @carol           | Forward fix (v2.41.1) deployed to replace rolled-back version. **Resolution**. |

- **Time-to-Detect (TTD)**: 11 min (14:07 → 14:18).
- **Time-to-Mitigate (TTM)**: 1h 14m (14:18 → 15:32).
- **Time-to-Resolve (TTR)**: 1h 44m (14:03 → 15:47).

## Root Cause (Required)

### 5 Whys

1. **Why did `/checkout` return 500s?**
   `CartHydrator` threw `NullPointerException` when hydrating legacy carts.
2. **Why did the hydrator hit null?**
   v2.41.0 assumed every cart has `pricing_context.region`, which is only
   populated for carts created after the Feb 2026 schema migration.
3. **Why wasn't this caught in testing?**
   Unit and integration test fixtures only include post-migration carts.
   No legacy cart shape is represented in any fixture.
4. **Why didn't the canary detect it?**
   The canary router sends traffic from new accounts only (a 2023 default
   for rollout safety), and new accounts do not have legacy carts.
5. **Why is the canary router segmented this way?**
   The 2023 configuration was never revisited after the 2026 schema
   migration changed the risk profile.

### Contributing Factors

Root cause is rarely a single chain. Capture **all** factors that had to
align for this incident to occur:

- **Trigger**: v2.41.0 dereferenced `pricing_context.region` without null
  guard.
- **Gap — test coverage**: no legacy-cart fixture in any test suite.
- **Gap — canary traffic segmentation**: canary does not represent
  legacy-schema traffic, so pre-production signal was absent.
- **Gap — alert threshold**: `/checkout` 5xx alert fires at 10% error
  rate; incident peaked at 8% and never paged. Support escalation was
  the only detection path.
- **Gap — rollback runbook**: no documented rollback procedure for
  `orders-api` > v2.40. @bob reconstructed the procedure live.

## What Went Well

- Rollback was clean and fully mitigated impact within 4 minutes of
  deploy.
- @bob's decision at 15:12 to stop waiting for the forward fix and roll
  back was the right call; TTM would have been 25+ min longer otherwise.
- Support and oncall communication in Slack was tight; no confusion
  about who owned what.
- No data corruption; failed checkouts failed cleanly.

## What Went Wrong

- The error-rate alert threshold was too loose; detection relied on
  customer support rather than on monitoring.
- The canary process gave false confidence — the segmentation meant the
  bug was never observable in canary traffic.
- No rollback runbook; the IC had to improvise.
- Test fixtures did not represent production's actual data shape
  diversity.

## Where We Got Lucky

- The `/checkout` endpoint fails cleanly on this error; retries succeed
  once the cart state is refreshed. A similar bug on an asynchronous
  path could have left partial orders in an inconsistent state.
- The incident began during EU business hours; detection by support
  escalation happened within 11 minutes. At 03:00 UTC on a weekend the
  alert gap would have let the incident run for hours.

## Action Items (Required)

Every action item must have owner (named person), absolute deadline,
tracking link, priority (P0/P1/P2), and type (`prevent`, `detect`,
`mitigate`, `process`, `documentation`).

| #   | Description                                                                                                     | Type          | Owner       | Deadline   | Priority | Tracking |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------- | ----------- | ---------- | -------- | -------- |
| 1   | Add null-safe accessor for `pricing_context.region` in `CartHydrator`, with regression test.                    | prevent       | @alice      | 2026-05-07 | P0       | ENG-1234 |
| 2   | Add legacy-cart fixture (`test/fixtures/legacy_cart_v1.json`) and integration tests covering both cart schemas. | prevent       | @alice      | 2026-05-14 | P1       | ENG-1235 |
| 3   | Lower `/checkout` 5xx alert threshold from 10% → 2% with 5-minute window.                                       | detect        | @dev-oncall | 2026-05-10 | P0       | ENG-1236 |
| 4   | Update canary router to mirror production cart-schema distribution (weighted by `schema_version`).              | detect        | @carol      | 2026-05-28 | P1       | ENG-1237 |
| 5   | Write rollback runbook for `orders-api` covering v2.40+ schema changes.                                         | documentation | @bob        | 2026-05-14 | P1       | ENG-1238 |
| 6   | Add deploy-gate check: block rollout when canary error rate > baseline + 2σ.                                    | mitigate      | @carol      | 2026-06-04 | P2       | ENG-1239 |

## Lessons Learned

- **Canary segmentation is a silent assumption.** A canary that doesn't
  represent production traffic gives false confidence. Audit canary
  routing whenever data-model assumptions change.
- **Alert thresholds are written for past traffic, not present risk.**
  The 10% threshold was set when baseline error rate was 1%. With a 0.1%
  baseline it is too loose by 100x.
- **Rollback is a feature; test and document it.** The absence of a
  rollback runbook adds minutes of IC cognitive load during exactly the
  moments when speed matters most.
- **Fixture diversity lags schema reality.** Every migration should
  include a fixture-update checklist item.

## Links

- Incident chat: [#inc-2026-0428-001](#)
- Primary dashboard during incident: [orders-api error rate](#)
- Deploy that introduced the bug: [orders-api v2.41.0](#)
- Rollback PR: [orders-api #8421](#)
- Forward-fix PR: [orders-api #8423](#)
- Related customer support ticket: SUP-4471

## Sign-off

- [ ] IC review: @bob — YYYY-MM-DD
- [ ] Engineering manager review: @ic-manager — YYYY-MM-DD
- [ ] SRE lead review: @sre-lead — YYYY-MM-DD
- [ ] Action items filed in tracker with owners
- [ ] Published to `docs/postmortems/`
- [ ] Shared with engineering leadership channel (SEV1 only)
