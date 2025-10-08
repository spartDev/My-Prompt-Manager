---
description: Scout requirements, plan architecture with validation, document in Confluence, create Jira tasks, and build implementation with agile tracking
argument-hint: <feature-name> [options]
allowed-tools: Editor, CreateFile, RunCommand, Browser, MCP, Bash
model: claude-sonnet-4-5-20250929
---

# Scout Plan Build Command

## Purpose

This command orchestrates a comprehensive agile development workflow that:
1. **Scouts** - Analyzes existing codebase, identifies patterns, and gathers requirements
2. **Plans** - Creates detailed technical specifications with iterative refinement
3. **Documents** - Creates Confluence documentation under Features & Roadmap
4. **Tracks** - Creates and manages Jira tasks for the implementation
5. **Builds** - Implements the solution while updating Jira task status
6. **Reports** - Provides agile metrics and completion summary

## Variables

```
PROJECT_NAME: $1
FEATURE_TYPE: ${2:-feature}  # feature | bugfix | refactor | infrastructure
SCOPE: ${3:-full}            # full | frontend | backend | infra
ENVIRONMENT: ${4:-development} # development | staging | production
```

## Required MCP Servers

Ensure the following MCP servers are connected:
- **Atlassian MCP Server** - For Confluence documentation and Jira task management

## Instructions

You are an expert full-stack developer and agile practitioner who follows clean architecture principles, manages work through Jira, and documents everything in Confluence.

### Phase 1: Scout (Requirements & Analysis)

When scouting, you should:

1. **Analyze Existing Codebase**
   - Review project structure and conventions
   - Identify design patterns in use
   - Check configuration files and dependencies
   - Examine build and deployment setup
   - Understand the testing strategy

2. **Gather Requirements**
   - Ask clarifying questions about:
     - Business requirements and user stories
     - Performance requirements
     - Security considerations
     - Scalability needs
     - Acceptance criteria
   - Document assumptions

3. **Technology Assessment**
   - Identify the current tech stack
   - Verify compatibility requirements
   - Identify required new dependencies
   - Check for potential conflicts

### Phase 2: Plan (Architecture & Design with Validation)

1. **Create Initial Plan**
   ```markdown
   ## Feature: $PROJECT_NAME
   
   ### Overview
   [Brief description]
   
   ### User Stories
   - As a [user], I want to [action] so that [benefit]
   
   ### Technical Requirements
   - Frontend Components
   - API Endpoints
   - Database Changes
   - Infrastructure Requirements
   
   ### Task Breakdown
   - [ ] Task 1 (Story Points: X)
   - [ ] Task 2 (Story Points: X)
   ```

2. **Plan Validation Loop**
   ```
   Present the plan to the user with:
   "Here's the proposed plan for $PROJECT_NAME:
   [Show plan]
   
   Are you satisfied with this plan, or would you like to refine it?
   - Type 'approve' to proceed
   - Type your refinement suggestions to iterate"
   ```
   
   Continue refining until the user types 'approve' or confirms satisfaction.

### Phase 3: Document (Confluence Integration)

1. **Get Confluence Project**
   ```
   Ask: "Which Confluence project should I document this in?"
   Wait for user response with project name
   ```

2. **Create Confluence Documentation**
   Using Atlassian MCP server:
   - Navigate to Features & Roadmap section
   - Create new page with title: "[$FEATURE_TYPE] $PROJECT_NAME"
   - Include:
     - Executive Summary
     - Technical Specification
     - Architecture Diagrams (if applicable)
     - Task Breakdown with Story Points
     - Acceptance Criteria
     - Risk Mitigation
     - Dependencies

3. **Confirm Documentation**
   ```
   "Documentation created in Confluence under Features & Roadmap.
   Page: [$FEATURE_TYPE] $PROJECT_NAME
   URL: [confluence_url]"
   ```

### Phase 4: Track (Jira Task Creation)

1. **Request Permission**
   ```
   "Would you like me to create Jira tasks based on this specification?
   (yes/no)"
   ```

2. **Create Jira Tasks** (if approved)
   Using Atlassian MCP server, create:
   - Epic: $PROJECT_NAME
   - Individual tasks from the task breakdown
   - Set story points for each task
   - Add acceptance criteria
   - Link to Confluence documentation
   - Set appropriate labels and components

3. **Report Created Tasks**
   ```markdown
   ## Jira Tasks Created
   
   Epic: [EPIC-XXX] $PROJECT_NAME
   
   Tasks:
   - [TASK-001] Setup and Configuration (3 points)
   - [TASK-002] Frontend Implementation (5 points)
   - [TASK-003] Backend API Development (5 points)
   - [TASK-004] Testing (3 points)
   - [TASK-005] Documentation (2 points)
   
   Total Story Points: 18
   ```

### Phase 5: Build (Implementation with Task Management)

1. **Request Build Permission**
   ```
   "All tasks are created in Jira. Should I begin implementation?
   (yes/no)"
   ```

2. **Implementation Workflow** (if approved)
   For each Jira task:
   
   a. **Move to In Progress**
      - Update task status in Jira
      - Log: "Starting [TASK-XXX]: [Task Description]"
   
   b. **Implement Solution**
      - Write code following project conventions
      - Create/modify files as needed
      - Add tests
      - Update documentation
   
   c. **Move to Done**
      - Update task status in Jira
      - Add completion comment with:
        - Files modified
        - Tests added
        - Any notes for reviewers
      - Log: "Completed [TASK-XXX]: [Task Description]"

3. **Track Progress**
   ```markdown
   ## Progress Update
   
   Completed: 3/5 tasks (60%)
   Story Points: 11/18 (61%)
   Current Task: [TASK-004] Testing
   Time Elapsed: 2h 30m
   ```

### Phase 6: Report (Agile Metrics & Summary)

Generate comprehensive metrics report:

```markdown
## Implementation Summary - $PROJECT_NAME

### Completion Metrics
- **Total Tasks**: 5
- **Completed Tasks**: 5
- **Success Rate**: 100%

### Story Points Analysis
- **Planned Points**: 18
- **Completed Points**: 18
- **Velocity**: 18 points/sprint

### Time Metrics
- **Start Time**: [timestamp]
- **End Time**: [timestamp]
- **Total Duration**: Xh Ym
- **Cycle Time per Task**:
  - [TASK-001]: 30 minutes
  - [TASK-002]: 2 hours
  - [TASK-003]: 2 hours
  - [TASK-004]: 1 hour
  - [TASK-005]: 30 minutes
- **Average Cycle Time**: 1.2 hours/task

### Throughput Metrics
- **Lead Time**: X hours (from requirement to done)
- **Process Efficiency**: X% (active time vs wait time)
- **First Time Right**: X% (tasks completed without rework)

### Code Metrics
- **Files Created**: X
- **Files Modified**: Y
- **Lines of Code Added**: Z
- **Test Coverage**: X%
- **Technical Debt**: [if any identified]

### Quality Metrics
- **Bugs Found**: 0
- **Code Review Comments**: [count]
- **Performance Impact**: [if measured]

### Confluence & Jira Links
- **Confluence Page**: [URL]
- **Jira Epic**: [URL]
- **Pull Request**: [if created]

### Key Achievements
- ✅ [Achievement 1]
- ✅ [Achievement 2]
- ✅ [Achievement 3]

### Lessons Learned
- [What went well]
- [What could be improved]
- [Action items for next time]
```

## Workflows

### Workflow 1: Full Feature Development
```bash
# 1. Scout existing code
# 2. Plan with user refinement
# 3. Document in Confluence
# 4. Create Jira tasks
# 5. Implement with task tracking
# 6. Generate metrics report
```

### Workflow 2: Quick Bug Fix
```bash
# 1. Scout and reproduce issue
# 2. Quick plan (may skip refinement for critical bugs)
# 3. Create single Jira task
# 4. Fix and track
# 5. Report completion
```

### Workflow 3: Refactoring
```bash
# 1. Scout current implementation
# 2. Plan refactoring approach
# 3. Get approval on approach
# 4. Document in Confluence
# 5. Break down into Jira tasks
# 6. Refactor incrementally with tracking
```

## Example Usage

```bash
# Basic usage
/scout_plan_build user-authentication

# Chrome extension header refactoring
/scout_plan_build appshell-header refactor frontend

# With all options
/scout_plan_build payment-integration feature full production

# Infrastructure update
/scout_plan_build database-migration infrastructure backend staging
```

## User Interaction Points

The command will pause and request user input at these key points:

1. **After Planning Phase**: "Are you satisfied with this plan?"
2. **Before Confluence**: "Which Confluence project?"
3. **Before Jira Creation**: "Should I create Jira tasks?"
4. **Before Building**: "Should I begin implementation?"
5. **During Build**: Progress updates after each task

## Additional Context

Remember to:
- Always wait for user approval at validation points
- Keep Jira tasks updated in real-time
- Link all artifacts (code, docs, tasks) together
- Calculate accurate agile metrics
- Follow the project's established coding standards
- Write comprehensive tests for each task
- Document architectural decisions in Confluence
- Use meaningful commit messages referencing Jira tickets
- Update Confluence documentation if requirements change

The command ensures full traceability from requirement to implementation, with all work tracked in Jira and documented in Confluence.