# Epic: {Epic Title}

> **Epic Key**: `{EPIC-KEY}` _(to be assigned)_  
> **Status**: Ready for Refinement  
> **Priority**: {High/Medium/Low}  
> **Target**: {Quarter/Sprint}

---

## Epic Summary

| Field      | Value                                    |
| ---------- | ---------------------------------------- |
| Epic Title | {Epic Title}                             |
| Team       | {Team Name}                              |
| Components | {Component 1}, {Component 2}             |
| Labels     | `{label1}`, `{label2}`, `{label3}`       |
| Design Doc | [{design-doc-name}.md]({confluence_url}) |

**Description:**

> {Epic description - 2-3 sentences summarizing the feature and its value}

**Business Value:**

- {Value proposition 1}
- {Value proposition 2}
- {Value proposition 3}

**Prerequisites (if any):**

- {Prerequisite 1 - status}
- {Prerequisite 2 - status}

---

## User Stories

### Story 1: {Story Title}

| Attribute      | Details                                                             |
| -------------- | ------------------------------------------------------------------- |
| **User Story** | As a {Persona}, I want {feature/capability} so that {benefit/value} |

<!-- Persona Enum: Developer, Product Owner, End User, Designer, Operations Engineer, QA Engineer, Administrator, Business Analyst -->

**Scope:**

- {What's included in this story}
- {Key functionality}
- {Key functionality}

**Acceptance Criteria:**

- [ ] {Criterion 1}
- [ ] {Criterion 2}
- [ ] {Criterion 3}
- [ ] {Criterion 4}

**Dependencies/Prerequisites:**

- {Dependency or "None"}

**Technical Notes:**

- {Technical consideration 1}
- {Technical consideration 2}

---

### Story 2: {Story Title}

| Attribute      | Details                                                             |
| -------------- | ------------------------------------------------------------------- |
| **User Story** | As a {Persona}, I want {feature/capability} so that {benefit/value} |

<!-- Persona Enum: Developer, Product Owner, End User, Designer, Operations Engineer, QA Engineer, Administrator, Business Analyst -->

**Scope:**

- {What's included in this story}
- {Key functionality}

**Acceptance Criteria:**

- [ ] {Criterion 1}
- [ ] {Criterion 2}
- [ ] {Criterion 3}

**Dependencies/Prerequisites:**

- Story 1 (or specific tasks from Story 1)

**Technical Notes:**

- {Technical consideration}

---

## Technical Tasks

> **Principle**: Each task is self-contained, delivers isolated value, and can be merged without breaking existing functionality.

### Tasks for Story 1: {Story Title}

| Task # | Title        | Description                                |
| ------ | ------------ | ------------------------------------------ |
| T1.1   | {Task title} | {Brief description of implementation work} |
| T1.2   | {Task title} | {Brief description of implementation work} |
| T1.3   | {Task title} | {Brief description of implementation work} |
| T1.4   | {Task title} | {Brief description of implementation work} |

---

### Tasks for Story 2: {Story Title}

| Task # | Title        | Description                                |
| ------ | ------------ | ------------------------------------------ |
| T2.1   | {Task title} | {Brief description of implementation work} |
| T2.2   | {Task title} | {Brief description of implementation work} |
| T2.3   | {Task title} | {Brief description of implementation work} |

---

## Dependency Graph

```
Epic: {Epic Title}
│
│   Prerequisites:
│      - {Prerequisite 1}
│      - {Prerequisite 2}
│
├── Story 1: {Story 1 Title}
│   │
│   ├── Foundation
│   │   ├── T1.1: {Task title}
│   │   └── T1.2: {Task title}
│   │
│   └── Implementation (depends on T1.1, T1.2)
│       ├── T1.3: {Task title}
│       └── T1.4: {Task title}
│
└── Story 2: {Story 2 Title} (depends on Story 1)
    │
    ├── T2.1: {Task title}
    ├── T2.2: {Task title}
    └── T2.3: {Task title}
```

---

## Summary

| Story     | Title           | Tasks       |
| --------- | --------------- | ----------- |
| 1         | {Story 1 Title} | {count}     |
| 2         | {Story 2 Title} | {count}     |
| **Total** |                 | **{total}** |

---

## Implementation Order (Recommended)

### Phase 1: {Phase Name} (Parallel Streams)

**Stream A - {Stream Description}:**

1. T1.1: {Task title}
2. T1.2: {Task title}

**Stream B - {Stream Description} (can start immediately):**

1. T2.1: {Task title}

### Phase 2: {Phase Name}

3. T1.3: {Task title}
4. T1.4: {Task title}
5. T2.2: {Task title}

### Phase 3: {Phase Name}

6. T2.3: {Task title}

---

## Quick Reference: Task Identifiers

Use these identifiers when requesting implementation:

| Task ID | Jira Key | Description  | Design Section    |
| ------- | -------- | ------------ | ----------------- |
| T1.1    | HB-XXXX  | {Task title} | {Section heading} |
| T1.2    | HB-XXXX  | {Task title} | {Section heading} |
| T1.3    | HB-XXXX  | {Task title} | {Section heading} |
| T1.4    | HB-XXXX  | {Task title} | {Section heading} |
| T2.1    | HB-XXXX  | {Task title} | {Section heading} |
| T2.2    | HB-XXXX  | {Task title} | {Section heading} |
| T2.3    | HB-XXXX  | {Task title} | {Section heading} |

**Note:** Jira Key column is populated after tasks are created in Jira. Use either Task ID or Jira Key for implementation.

**Example usage:**

> "`/implement HB-XXXX`"

---

## Success Criteria

- [ ] {Success criterion 1}
- [ ] {Success criterion 2}
- [ ] {Success criterion 3}
- [ ] {Success criterion 4}

---

## References

- [Design Document]({confluence_url})
- [{Reference 1}]({url})
- [{Reference 2}]({url})
