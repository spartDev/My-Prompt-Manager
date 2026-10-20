---
name: tdd
description: Test-driven development with red-green-refactor loop, tracer-bullet vertical slicing, behavior-focused integration tests, deep module design, and refactoring guidance. Use when user wants to build features or fix bugs using TDD, mentions "red-green-refactor", wants integration tests, or asks for test-first development. Do NOT use for test runner configuration, mocking library setup, or writing tests without TDD workflow.
allowed-tools: Read Write Grep Glob Bash Edit
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Test-Driven Development

## Philosophy

**Core principle**: Tests should verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't.

**Good tests** are integration-style: they exercise real code paths through public APIs. They describe _what_ the system does, not _how_ it does it. A good test reads like a specification - "user can checkout with valid cart" tells you exactly what capability exists. These tests survive refactors because they don't care about internal structure.

**Bad tests** are coupled to implementation. They mock internal collaborators, test private methods, or verify through external means (like querying a database directly instead of using the interface). The warning sign: your test breaks when you refactor, but behavior hasn't changed. If you rename an internal function and tests fail, those tests were testing implementation, not behavior.

Read [tests.md](references/tests.md) when distinguishing good from bad tests. Read [mocking.md](references/mocking.md) when deciding whether to mock a dependency.

## Anti-Pattern: Horizontal Slices

**DO NOT write all tests first, then all implementation.** This is "horizontal slicing" - treating RED as "write all tests" and GREEN as "write all code."

This produces **crap tests**:

- Tests written in bulk test _imagined_ behavior, not _actual_ behavior
- You end up testing the _shape_ of things (data structures, function signatures) rather than user-facing behavior
- Tests become insensitive to real changes - they pass when behavior breaks, fail when behavior is fine
- You outrun your headlights, committing to test structure before understanding the implementation

**Correct approach**: Vertical slices via tracer bullets. One test → one implementation → repeat. Each test responds to what you learned from the previous cycle. Because you just wrote the code, you know exactly what behavior matters and how to verify it.

```text
WRONG (horizontal):
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5

RIGHT (vertical):
  RED→GREEN: test1→impl1
  RED→GREEN: test2→impl2
  RED→GREEN: test3→impl3
  ...
```

## Workflow

### 1. Planning

Before writing any code:

- [ ] Confirm with user what interface changes are needed
- [ ] Confirm with user which behaviors to test (prioritize)
- [ ] Identify opportunities for [deep modules](references/deep-modules.md) (small interface, deep implementation)
- [ ] Design interfaces for [testability](references/interface-design.md)
- [ ] List the behaviors to test (not implementation steps)
- [ ] Get user approval on the plan

Ask: "What should the public interface look like? Which behaviors are most important to test?"

**You can't test everything.** Confirm with the user exactly which behaviors matter most. Focus testing effort on critical paths and complex logic, not every possible edge case.

### 2. Tracer Bullet

Write ONE test that confirms ONE thing about the system:

```text
RED:   Write test for first behavior → test fails
GREEN: Write minimal code to pass → test passes
```

This is your tracer bullet - proves the path works end-to-end.

### 3. Incremental Loop

For each remaining behavior:

```text
RED:   Write next test → fails
GREEN: Minimal code to pass → passes
```

Rules:

- One test at a time
- Only enough code to pass current test
- Don't anticipate future tests
- Keep tests focused on observable behavior

**Anti-pattern: natural completion.** When implementing a method, resist writing it "completely." If the current test only checks that adding one item increases the total, your GREEN code should only handle that one case:

```text
Test: "adding an item increases the total"

WRONG (over-implements):
  addItem(item) {
    const existing = this.items.find(i => i.id === item.id);
    if (existing) existing.quantity += 1;  // no test requires this yet
    else this.items.push(item);
  }

RIGHT (minimal):
  addItem(item) {
    this.items.push(item);  // just enough to pass
  }
```

Duplicate-ID handling gets added in a later cycle when a test demands it. If you write it now, the next test will pass immediately — that means you outran your tests.

### 4. Refactor

After all tests pass, read [refactoring.md](references/refactoring.md) for candidates:

- [ ] Extract duplication
- [ ] Deepen modules (move complexity behind simple interfaces)
- [ ] Apply SOLID principles where natural
- [ ] Consider what new code reveals about existing code
- [ ] Run tests after each refactor step

**Never refactor while RED.** Get to GREEN first.

## When Stuck

- **Test won't go green**: The test may be too large. Split it into a smaller behavior and test that instead.
- **Unclear what to test next**: Ask the user which behavior matters most. If no answer, test the happy path first, then edge cases.
- **Test passes immediately (never RED)**: Either you over-implemented in a previous cycle, or the new test is redundant with behavior the previous cycle already legitimately covered. Distinguish the two: if prior GREEN code did more than its test required, that's speculative over-implementation to roll back. If prior code was minimal but naturally handles this case too, pick a test that forces genuinely new behavior instead.
- **Refactor breaks tests**: The tests were coupled to implementation. Rewrite the broken tests against public behavior, then retry the refactor.
- **Too many mocks**: You're testing too deep. Back out and test through a higher-level public interface. Read [mocking.md](references/mocking.md) for boundaries.

## Checklist Per Cycle

```text
[ ] Test describes behavior, not implementation
[ ] Test uses public interface only
[ ] Test would survive internal refactor
[ ] Code is minimal for this test — removing any line would fail it
[ ] No speculative features added
[ ] Next planned test would FAIL against current code (if it passes, treat it as redundant or evidence the previous cycle already covered it, and pick a test that forces new behavior)
```
