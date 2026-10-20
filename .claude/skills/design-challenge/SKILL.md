---
name: design-challenge
description: >
  Stress-test a plan, design, or architecture decision through structured adversarial questioning.
  Use when user wants to challenge a design, stress-test a plan, validate architecture decisions,
  run a pre-mortem, or mentions "design challenge".
  Capabilities: multi-phase questioning (scope, assumptions, trade-offs, failure modes),
  codebase-grounded questions, resolution summary with confirmed decisions and open risks.
  Do NOT use for documenting decisions already made — use adr-writing instead.
  Do NOT use for reviewing skill file quality — use skill-reviewer instead.
  Do NOT use for TDD test planning — use tdd instead.
allowed-tools: Read Grep Glob Bash
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Design Challenge

## Purpose

Challenge a plan or design through relentless, structured questioning until both sides reach shared understanding. Surface hidden assumptions, force explicit trade-offs, and identify failure modes — before any code is written.

## Principles

- **One question at a time.** Never batch questions. Wait for a response before moving on.
- **Recommend an answer that matches your question.** If you present options, pick one. If you ask an open-ended question, propose a concrete answer. The user confirms, adjusts, or rejects.
- **Explore before asking.** If a question can be answered by reading the codebase, read the codebase instead of asking. Don't ask what you can look up.
- **Follow the thread.** When an answer reveals a deeper issue, follow it down before moving to the next topic. Don't leave branches unresolved.
- **Be adversarial, not hostile.** The goal is to find weaknesses in the plan, not to prove the user wrong. Challenge ideas, not people.
- **Stay concrete.** "What happens when X fails?" is better than "Have you considered error handling?"

## Workflow

1. **Gather context.** Read the codebase in the affected areas. Understand existing architecture, patterns, and dependencies before asking anything.
2. **Scope the challenge.** Ask 1-2 scope questions to bound the design. Confirm what's in and what's explicitly out.
3. **Question through phases.** Work through Assumptions, Trade-offs, and Failure Modes. Follow threads as they emerge — don't force a linear path.
4. **Produce resolution summary.** Summarize confirmed decisions, validated assumptions, accepted risks, and open items.
5. **Hand off.** Suggest `adr-writing` if decisions should be formalized.

## Questioning Phases

These phases describe the types of questions to ask. They are not a rigid sequence — jump between them as the conversation demands. A failure mode question may reveal a hidden assumption; follow it.

### 1. Scope

Understand what is being proposed before challenging it.

- What problem does this solve? Who is it for?
- What is the boundary of this change? What is explicitly out of scope?
- What does the codebase look like today in the affected areas?

**Explore the codebase** to understand existing architecture, patterns, and dependencies in the relevant areas. Ground your questions in what actually exists.

### 2. Assumptions

Surface and challenge what is being taken for granted.

- What are you assuming about the users / consumers of this?
- What are you assuming about scale, performance, or data volume?
- What existing behavior are you assuming won't change?
- Which dependencies are you assuming will remain stable?

### 3. Trade-offs

Force explicit acknowledgment of what was chosen and what was rejected.

- What alternatives did you consider? Why were they rejected?
- What are you trading away with this approach?
- Where is this design deliberately simple at the cost of flexibility (or vice versa)?
- What would make you reconsider this approach entirely?

### 4. Failure Modes

Pre-mortem: identify how this breaks.

- How does this fail under load / at scale?
- What happens when a dependency is unavailable?
- What is the rollback plan if this goes wrong in production?
- What is the worst-case scenario, and how likely is it?
- What will be hardest to change later if you get it wrong now?

### 5. Resolution

Wrap up with a clear summary.

- Summarize decisions confirmed during the conversation
- List assumptions that were validated (and any that were not)
- List risks that were acknowledged and accepted
- Flag unresolved items that need further investigation

End with: "If you want to formalize these decisions, hand this summary to `adr-writing`."

## Anti-Patterns

### Asking questions you could answer by reading code

Wastes the user's time and misses concrete context. Grep/Read first, then ask informed questions.

<!-- BAD -->

> Have you considered error handling?

<!-- GOOD -->

> The retry logic in `api-client.ts` caps at 5s backoff. What happens after that — fail, queue, or surface to the user?

### Batching multiple questions

Overwhelms the user. Answers get shallow. One question at a time, follow the thread.

<!-- BAD -->

> What about caching? And how will you handle auth? Also, what's the rollback plan?

<!-- GOOD -->

> Let's start with caching. What invalidation strategy are you planning?

### Accepting "we'll figure it out later"

Defers risk without acknowledging it. Push for at least a named risk and an owner.

<!-- BAD -->

> OK, you'll sort out the invalidation strategy later. Moving on...

<!-- GOOD -->

> OK, let's name the risk: cache invalidation strategy is unresolved. Who owns figuring it out, and by when?

### Other anti-patterns

| Anti-pattern                                           | Why it's bad                                                                 | Instead                                                                    |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Challenging only to challenge                          | Turns adversarial without adding value                                       | Every question should have a purpose — drop it if the answer is solid      |
| Skipping the summary                                   | Conversation value is lost                                                   | Always produce a resolution summary                                        |
| Going too deep on low-stakes decisions                 | Wastes time on things that are easily reversible                             | Focus challenge effort on hard-to-reverse decisions                        |
| Recommending an answer that doesn't match the question | Confuses the user — options are offered but recommendation is something else | If you present options, pick one; if open-ended, propose a concrete answer |

## When to Stop

- All branches of the decision tree have been explored or explicitly deferred
- The user says they've heard enough
- You're asking questions that don't change the design — diminishing returns

## When Stuck

- **User says "we've already decided":** Acknowledge the decision, then ask what would make them revisit it. If the answer is "nothing," move on.
- **Every answer is "yes, we thought about that":** Switch from open questions to concrete failure scenarios: "What happens when X is down at 2am and the on-call has no context?"
- **Proposal is too vague to question:** Start with scope. Ask the user to describe the change as if writing a commit message. Ground in specifics before challenging.
- **Session stalls — diminishing returns:** Check if you've been circling low-stakes decisions. Refocus on the hardest-to-reverse choice and wrap up.

## Checklist Per Question

```text
[ ] Question targets a specific decision, not a vague area
[ ] You checked the codebase first if the answer might be there
[ ] Your recommendation matches your question format (pick from offered options, or propose a concrete answer)
[ ] You followed up on the response before moving on
[ ] The answer was recorded (confirmed, rejected, or deferred)
```

## Resolution Checklist

```text
[ ] Each confirmed decision is specific enough to act on
[ ] Risks are named and prioritized (not just "there are risks")
[ ] Open items have owners or are explicitly marked as unowned
[ ] No assumption is left as "we assume it'll be fine" — restate what specifically is assumed
[ ] The summary distinguishes between confirmed decisions and open questions
```

## Reference

For sample challenge session walkthroughs, read:

- `references/example-session.md` — infrastructure challenge (caching layer)
- `references/example-session-data-model.md` — data model challenge (schema design)
