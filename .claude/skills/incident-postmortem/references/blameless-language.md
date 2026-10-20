<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Blameless Language: Do / Don't

This skill requires blameless post-mortems. Blameless does **not** mean
"omit details" or "pretend no one made a decision" — it means framing
every cause as a **systems or process** property rather than a **personal
failing**.

Humans operating under pressure, with incomplete information, and with
systems they did not design will make choices that look wrong in
retrospect. A blameless post-mortem asks: _why did the system make that
choice look reasonable at the time?_

## The core reframes

### Name systems and processes, not individuals

| Don't write                                   | Write instead                                                                                         |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| "Alice deployed without checking the canary." | "The deploy process did not require verifying canary health before rollout."                          |
| "Bob approved the PR too quickly."            | "The review checklist did not include verifying schema compatibility for legacy records."             |
| "The on-call engineer missed the page."       | "The paging system did not escalate when the first responder failed to acknowledge within 5 minutes." |
| "Carol wrote buggy code."                     | "The code path hit a null dereference that was not covered by existing tests."                        |

### Describe decisions in context

| Don't write                                 | Write instead                                                                                                              |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| "They made the wrong call."                 | "Given the information available at the time (dashboard X looked normal, no alerts firing), rollback was not prioritized." |
| "They should have known this would happen." | "The failure mode was not represented in any existing runbook, test fixture, or monitoring dashboard."                     |
| "Obvious mistake."                          | "This was the first time this code path had been exercised with legacy-schema data in production."                         |

### Replace shame words with system words

| Shame word       | System word                                            |
| ---------------- | ------------------------------------------------------ |
| "carelessly"     | "following standard procedure, which did not include…" |
| "failed to"      | "the process did not require…"                         |
| "should have"    | "a future safeguard could…"                            |
| "sloppy"         | "under-specified"                                      |
| "stupid mistake" | "easy-to-make error given the current design"          |
| "forgot to"      | "no reminder exists in the workflow for…"              |

### Present tense for durable facts, past for events

| Better framing                                                                                    |
| ------------------------------------------------------------------------------------------------- |
| "The deploy pipeline **does not** block rollouts on canary errors." (property of the system, now) |
| "The responder **acknowledged** the page at 14:21 UTC." (event)                                   |

Using present tense for system properties makes it clear the gap still
exists until the action item closes it.

## Near-misses and luck

Call out luck explicitly. Luck is not a safeguard; naming it pushes the
team toward building real ones.

| Don't write                                   | Write instead                                                                                                                                                                                |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Luckily, it didn't affect the other region." | "The incident did not propagate to region B because the deploy had not yet reached it — this was timing, not a safeguard, and could have been worse had the rollout been 20 minutes faster." |

## Action-item language

| Don't write                     | Write instead                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| "Be more careful with deploys." | "Add a canary health gate that blocks rollout when 5xx > baseline + 2σ."                                              |
| "Review code more thoroughly."  | "Add checklist item: verify all DB field accesses are null-safe for records created before schema-migration YYYY-MM." |
| "Train the team on X."          | "Add integration test covering X; failure becomes a CI signal rather than a human memory item."                       |

Actions framed as "be more careful" are invisible on the next incident
because there is nothing to verify. Actions framed as concrete artefact
changes produce durable safeguards.

## When the report must mention a person

Sometimes an individual must be named — for example, to credit the IC, to
note who holds an action item, or to preserve the timeline (who did
what). That is fine. The blameless principle forbids assigning **causal
fault** to individuals, not acknowledging their presence.

| Acceptable                                             | Not acceptable                                      |
| ------------------------------------------------------ | --------------------------------------------------- |
| "IC: @bob."                                            | "@bob should have declared the incident sooner."    |
| "@alice identified the null dereference at 14:26 UTC." | "@alice caused the bug by not null-checking."       |
| "Action item owner: @carol."                           | "@carol needs to stop making this kind of mistake." |

## Anti-pattern: the "passive voice trick"

Blameless writing is **not** just rewriting active voice as passive. It
is moving the responsibility from a person to a system.

| Don't (passive but still blaming)                  | Do (genuinely blameless)                                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| "A mistake was made in the PR review."             | "The review checklist did not include schema-compatibility verification, so the regression was not caught." |
| "The deploy was done without checking the canary." | "The deploy workflow does not require canary health verification before full rollout."                      |

The first column still implies a human failing with the agent hidden; the
second column points at a fixable system property.

## Self-check

Before publishing, run this quick read-through:

1. Search the document for every human name. For each, ask: **is this
   person framed as a cause, or as a participant?** If "cause", rewrite.
2. Search for "should have", "failed to", "forgot to", "didn't check".
   Each hit is almost always a blameless rewrite opportunity.
3. Check every root cause answer: does it name a system / process /
   artefact gap, or a person? If a person, keep asking "why was that
   reasonable to do?" until a system-level cause surfaces.
4. Check every action item: could someone verify it by looking at a
   file, config, or test — or does it depend on a person "being more
   careful"?
