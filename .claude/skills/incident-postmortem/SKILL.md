---
name: incident-postmortem
description: >
  Runs Sanofi's blameless post-mortem process for production incidents:
  classifies severity (SEV1/SEV2/SEV3), guides timeline
  reconstruction, runs structured root-cause analysis (5 Whys plus
  contributing factors), and produces a post-mortem document with tracked
  action items (owner + deadline) ready for review. Use when the user says
  "write a post-mortem", "postmortem", "incident review", "RCA", "root cause
  analysis", "blameless retro", "write up the incident", "SEV1 follow-up",
  "incident report", or "document the outage". Trigger even for casual
  requests like "let's do the post-mortem on
  yesterday's outage". Do NOT use for live incident response or paging
  workflows (that is runbook territory), minor bug triage, feature
  retrospectives, or sprint retros — those are a different artefact.
allowed-tools: Bash Read Write Edit Grep Glob
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Incident Post-Mortem

Produces a blameless post-mortem for Sanofi incident management. The output
is a single Markdown document with severity classification, a reconstructed
timeline, root-cause analysis, and action items owned by named people with
deadlines.

## Philosophy

- **Blameless**: focus on systems, processes, and missing safeguards — never
  on individuals. Bad outcomes come from weak systems, not bad people.
- **Timeline before theories**: reconstruct what happened in chronological
  order before trying to explain why. Speculation anchored on a wrong fact
  is worse than no theory.
- **Every action item has an owner and a deadline**. Un-owned actions rot.
- **SEV1 and SEV2 must be documented within 5 business days** of incident
  closure — while memory is fresh and remediation is still being scheduled.
- **Lessons > documents**. A post-mortem that produces no durable change
  (runbook update, monitor added, code fix, process change) has failed.

## Workflow

### 1. Confirm (or revise) severity

Severity is set **during** the incident — it drives paging, war-room
activation, and the comms plan, so it cannot wait for the post-mortem.
The post-mortem's job here is to **confirm the live classification was
correct, or deliberately reclassify** now that the settled facts
(actual user impact, duration, data/compliance blast radius) are known.

See [references/severity-levels.md](references/severity-levels.md) for
full definitions and examples. Summary:

| Severity | Impact                                                                                       | Response SLA                                      | Post-mortem required?                                |
| -------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| **SEV1** | Critical — major customer-facing outage, data loss, regulatory/security breach, revenue loss | Immediate (on-call paged, war room within 15 min) | **Yes — within 5 business days**                     |
| **SEV2** | High — significant degradation, partial outage, key feature broken for many users            | On-call response within 30 min                    | **Yes — within 5 business days**                     |
| **SEV3** | Moderate — minor degradation, workaround exists, small user subset affected                  | Same business day                                 | Optional (strongly recommended if recurring pattern) |

Check the live severity against the measured impact:

- **Reclassify up** if settled facts show the blast radius was larger than
  first thought (more users, longer duration, data / compliance impact
  discovered after the fact).
- **Reclassify down** only when the measured impact is genuinely smaller
  than the live call, and record the reason. Do **not** reclassify down
  to avoid the 5-business-day post-mortem deadline — if impact was real
  and material, it is SEV2 (or higher) regardless of whether writing it
  up is inconvenient.
- If no live severity was set (the incident bypassed the declared
  process), record that as a process gap in the Contributing Factors
  section and classify now based on measured impact.

Capture both the live severity and the final severity (and the reason if
they differ) in the header of the post-mortem document.

### 2. Identify roles

Every incident has at minimum:

- **Incident Commander (IC)** — owned the response, drove decisions,
  coordinated communications. Usually the on-call engineer or their
  designated deputy. The IC is **responsible for ensuring the post-mortem
  is written**, but does not have to write every section alone.
- **Responders** — engineers who diagnosed or remediated the issue.
- **Communications lead** (SEV1 only) — owned customer/stakeholder updates.
- **Post-mortem author** — usually the IC. Name explicitly so ownership is
  unambiguous.

Capture these in the header of the post-mortem document, along with the
**Incident ID**. Reuse the ID from whichever incident tracker your team
already uses (PagerDuty incident ID, ServiceNow ticket, Opsgenie alert
ID, Jira incident issue, etc.) so the post-mortem is linkable from the
same ID the responders used in the war room. If the team has no such
system, fall back to `INC-YYYY-MMDD-NNN` using the incident start date
and a daily sequence number.

### 3. Reconstruct the timeline

Gather raw sources in this order:

```bash
# Incident chat/war room transcript
# Paging/alerting history (PagerDuty, Opsgenie, etc.)
# Deploy history around the incident window
# Monitoring dashboards (screenshot or link)
# Customer support tickets filed during the incident
```

Build the timeline in UTC, with source links where possible. Every entry
has a timestamp, actor (role not person when identity doesn't matter), and
a short factual statement. **Do not interpret yet** — just record what
happened.

Example row (good):

> `14:03 UTC` — Deploy of `orders-api` v2.41.0 completes.
> `14:07 UTC` — Error rate on `/checkout` climbs from 0.1% to 8% (link to dashboard).
> `14:09 UTC` — First customer ticket filed ("Payment fails with 500").

Anti-pattern (bad — contains interpretation and blame):

> `14:07 UTC` — Alice's deploy breaks checkout because she didn't test properly.

Key timestamps to always capture:

- **Detection** — when did someone (or something) first notice?
- **Acknowledgement** — when was the incident declared / on-call paged?
- **Mitigation** — when was customer impact stopped (even if root cause
  wasn't yet known)?
- **Resolution** — when was the underlying issue fully fixed?

**Time-to-Detect (TTD)** = Detection − Start.
**Time-to-Mitigate (TTM)** = Mitigation − Detection.
**Time-to-Resolve (TTR)** = Resolution − Start.

### 4. Quantify impact

Be specific. "Some users were affected" is not impact. Use the format:

- **Users affected**: rough count or percentage, and segment (e.g., "EU
  paying customers").
- **Requests affected**: count or error rate.
- **Duration**: start → mitigation (and separately to resolution if they
  differ).
- **Revenue / data / compliance impact**: if applicable. If unknown, say
  so — do not guess.

### 5. Run root-cause analysis

Use **5 Whys** as a starting frame, but do not stop at a single chain.
Real incidents have **multiple contributing factors** — capture all of
them.

5 Whys sketch:

```
Q1: Why did /checkout return 500s?          A: Orders-api threw NullPointer on line X.
Q2: Why did the code path hit null?         A: New field not populated for legacy carts.
Q3: Why wasn't that caught in testing?      A: Test fixtures only cover post-migration carts.
Q4: Why didn't the canary catch it?         A: Canary traffic routed only to new accounts.
Q5: Why is canary traffic segmented that way? A: Default router config from 2023 never revisited.
```

Then capture **Contributing Factors** separately — the conditions that
allowed the trigger to cause the outage:

- Alerting gap: error-rate alert threshold was 10% (incident peaked at 8%).
- Runbook gap: no documented rollback for orders-api > v2.40.
- Process gap: deploy approval did not require canary health check.

Use blameless language throughout. See [references/blameless-language.md](references/blameless-language.md)
for do/don't phrasings.

### 6. Capture what went well and what went wrong

Post-mortems are not just failure catalogs — call out what worked so it
gets reinforced:

- **What went well**: fast detection, clean rollback, good communication,
  useful runbook, solid monitoring.
- **What went wrong**: gaps, surprises, places where the system or process
  let the team down.
- **Where we got lucky**: near-misses that could have made this worse.
  Lucky outcomes are future incidents waiting to happen.

### 7. Define action items

Every action item **must** have:

| Field         | Required | Notes                                                               |
| ------------- | -------- | ------------------------------------------------------------------- |
| Description   | Yes      | Concrete and verifiable                                             |
| Type          | Yes      | One of: `prevent`, `detect`, `mitigate`, `process`, `documentation` |
| Owner         | Yes      | A named person, not a team (teams diffuse ownership)                |
| Deadline      | Yes      | Absolute date (YYYY-MM-DD), not "next sprint"                       |
| Tracking link | Yes      | Jira/Linear/GitHub issue ID so progress is visible                  |
| Priority      | Yes      | P0/P1/P2                                                            |

**Balance the action types.** A post-mortem that only produces "prevent"
actions is brittle — add at least one "detect" (catch it sooner next time)
and consider "mitigate" (shrink the blast radius when it recurs).

Reject vague actions:

- ❌ "Improve testing"
- ❌ "Be more careful with deploys"
- ❌ "Review the monitoring"
- ✅ "Add integration test covering legacy-cart checkout path (test fixture
  `legacy_cart_v1.json`). Owner: @alice. Deadline: 2026-05-14. ENG-1234."

### 8. Write the document

Use [references/post-mortem-template.md](references/post-mortem-template.md)
as the exact template. Fill every required section; omit optional sections
only if they have no content (do not leave "TBD" placeholders).

File the document at `docs/postmortems/YYYY-MM-DD-short-slug.md`
(create the directory if it does not exist). Use the incident **start
date**, not the authoring date.

### 9. Review and publish

Before sharing:

- Reread the document with the [blameless language](references/blameless-language.md)
  rules in mind — rewrite any sentence that names a person as a cause.
- Confirm every action item has owner + deadline + tracking link.
- For SEV1/SEV2, confirm you are within the **5 business days** window
  from incident closure. If the deadline has slipped, add that slip as an
  action item (process gap) and note it in the document.
- Circulate to responders and the IC's manager for review before wider
  publication.

For SEV1 incidents, the final document is also shared with the
engineering leadership channel.

## Anti-Patterns

### Naming individuals as causes

```markdown
<!-- BAD -->

Root cause: Alice deployed without checking the canary.

<!-- GOOD -->

Root cause: The deploy process did not require canary health
verification before full rollout. The engineer followed the documented
procedure.
```

### Action items without owners or deadlines

```markdown
<!-- BAD -->

- [ ] Improve deploy safety
- [ ] Add more tests

<!-- GOOD -->

- [ ] Add canary health gate to `deploy.yaml` (block rollout if 5xx >
      baseline+2σ). Owner: @bob. Deadline: 2026-05-21. ENG-1235.
- [ ] Extend orders-api fixture set to cover legacy carts (`test/fixtures/
legacy_cart_v1.json`). Owner: @alice. Deadline: 2026-05-14. ENG-1234.
```

### Timeline with interpretation mixed in

```markdown
<!-- BAD -->

14:07 — Error rate spikes because the new deploy is broken.

<!-- GOOD -->

14:07 — Error rate on /checkout rises from 0.1% to 8% ([dashboard](link)).
(Root cause identified later at 15:42.)
```

### SEV classification drift

Do not classify down to avoid the post-mortem requirement. If customer
impact was real and material, it is SEV2 (or higher) regardless of
whether writing it up is inconvenient.

### Single-cause narratives

Outages are almost always multi-causal. A post-mortem with exactly one
contributing factor usually means the author stopped looking. Push on
"what else had to go wrong for this to happen?"

## References

Loaded on demand:

- **Template**: [references/post-mortem-template.md](references/post-mortem-template.md)
  — full worked example; copy and fill.
- **Severity levels**: [references/severity-levels.md](references/severity-levels.md)
  — SEV1/2/3 definitions with Sanofi examples.
- **Blameless language**: [references/blameless-language.md](references/blameless-language.md)
  — do/don't phrasings for common traps.
- Google SRE Book — [Postmortem Culture: Learning from Failure](https://sre.google/sre-book/postmortem-culture/).

## Self-review

Before declaring the post-mortem done, verify:

- [ ] Severity confirmed or revised (SEV1/SEV2/SEV3) with justification;
      live vs final severity recorded if they differ
- [ ] Incident ID recorded (tracker-sourced, or INC-YYYY-MMDD-NNN fallback)
- [ ] Incident Commander named
- [ ] Timeline in UTC, with detection / acknowledgement / mitigation /
      resolution timestamps
- [ ] Impact quantified (users, duration, revenue/data/compliance)
- [ ] Root cause captured with 5 Whys **and** contributing factors list
- [ ] "What went well", "What went wrong", and "Where we got lucky"
      sections filled
- [ ] Every action item has owner (named person), deadline
      (absolute date), tracking link, priority, and type
- [ ] Document uses blameless language throughout (no individual blame)
- [ ] For SEV1/SEV2: published within 5 business days of incident
      closure (or slip is tracked as an action item)
