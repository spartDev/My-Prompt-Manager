---
description: Scout requirements, plan architecture, and build implementation for software projects
argument-hint: <feature-name> [options]
allowed-tools: Editor, CreateFile, RunCommand, Browser, MCP, Bash
model: claude-sonnet-4-5-20250929
---

# Scout Plan Build Command

## Purpose

This command orchestrates a comprehensive development workflow that:
1. **Scouts** - Analyzes existing codebase, identifies patterns, and gathers requirements
2. **Plans** - Creates detailed technical specifications and architecture decisions
3. **Builds** - Implements the solution following best practices and established patterns

## Variables

```
PROJECT_NAME: $1
FEATURE_TYPE: ${2:-feature}  # feature | bugfix | refactor | infrastructure
SCOPE: ${3:-full}            # full | frontend | backend | infra
ENVIRONMENT: ${4:-development} # development | staging | production
```

## Instructions

You are an expert full-stack developer who follows clean architecture principles, SOLID design patterns, and comprehensive testing practices. You adapt to the project's existing technology stack and conventions.

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
   - Document assumptions

3. **Technology Assessment**
   - Identify the current tech stack
   - Verify compatibility requirements
   - Identify required new dependencies
   - Check for potential conflicts

### Phase 2: Plan (Architecture & Design)

Create a comprehensive plan including:

1. **Technical Specification**
   ```markdown
   ## Feature: $PROJECT_NAME
   
   ### Overview
   [Brief description]
   
   ### User Stories
   - As a [user], I want to [action] so that [benefit]
   
   ### Technical Requirements
   - Frontend Components
   - API Endpoints
   - Database Schema Changes
   - Infrastructure Requirements
   ```

2. **Architecture Decisions**
   - Component/Module structure
   - State management approach
   - API design patterns
   - Data flow architecture
   - Security considerations

3. **Implementation Roadmap**
   - Task breakdown with priorities
   - Dependency order
   - Testing strategy
   - Deployment plan

### Phase 3: Build (Implementation)

Follow this implementation workflow:

1. **Frontend Development**
   ```typescript
   // Follow project conventions
   // Implement proper error handling
   // Add loading and error states
   // Ensure accessibility standards
   ```

2. **Backend Development**
   ```typescript
   // Create type-safe APIs
   // Implement proper error handling
   // Add input validation
   // Set up proper logging
   ```

3. **Infrastructure as Code**
   ```yaml
   # Follow IaC best practices
   # Create modular configurations
   # Implement proper tagging
   # Set up monitoring and alerts
   ```

4. **Testing Implementation**
   - Unit tests
   - Integration tests
   - End-to-end tests
   - Performance tests

## Workflows

### Workflow 1: New Feature Development
```bash
# Scout Phase
!find . -type f -name "*.tsx" -o -name "*.ts" -o -name "*.js" -o -name "*.jsx" | head -20
!cat package.json
!ls -la src/

# Plan Phase
# Generate technical specification
# Create component diagrams
# Design API contracts

# Build Phase
# 1. Create feature branch
# 2. Implement frontend components
# 3. Build API endpoints
# 4. Update configurations
# 5. Write tests
# 6. Create PR
```

### Workflow 2: Bug Fix
```bash
# Scout: Reproduce and isolate issue
# Plan: Identify root cause and fix strategy
# Build: Implement fix with tests
```

### Workflow 3: Infrastructure Update
```bash
# Scout: Review current infrastructure
# Plan: Design infrastructure changes
# Build: Update configurations and deploy
```

## Reports

### 1. Scouting Report
```markdown
## Scouting Report - $PROJECT_NAME

### Current State Analysis
- **Codebase Size**: [files/lines of code]
- **Tech Stack**: [list technologies found]
- **Patterns Identified**: [architectural patterns]
- **Dependencies**: [critical dependencies]

### Requirements Summary
- **Functional Requirements**: [list]
- **Non-Functional Requirements**: [list]
- **Constraints**: [technical/business constraints]

### Risk Assessment
- **Technical Risks**: [identify potential issues]
- **Dependencies Risks**: [third-party concerns]
- **Timeline Risks**: [complexity assessment]
```

### 2. Planning Report
```markdown
## Planning Report - $PROJECT_NAME

### Architecture Overview
[Include diagrams using mermaid if needed]

### Component Design
- **Frontend Components**: [component tree]
- **API Endpoints**: [endpoint list with methods]
- **Database Changes**: [schema modifications]
- **Infrastructure**: [resources needed]

### Implementation Plan
| Phase | Task | Estimate | Dependencies |
|-------|------|----------|--------------|
| 1 | Setup | 2h | None |
| 2 | Frontend | 8h | Phase 1 |
| 3 | Backend | 6h | Phase 1 |
| 4 | Testing | 4h | Phase 2,3 |
| 5 | Deployment | 2h | Phase 4 |

### Success Metrics
- [ ] All tests passing
- [ ] Code coverage > 80%
- [ ] Performance benchmarks met
- [ ] Security scan passed
```

### 3. Build Completion Report
```markdown
## Build Completion Report - $PROJECT_NAME

### Implementation Summary
- **Files Created**: [count and list]
- **Files Modified**: [count and list]
- **Lines of Code**: [added/removed]
- **Test Coverage**: [percentage]

### Deliverables
- [ ] Frontend Components
- [ ] API Endpoints
- [ ] Database Migrations
- [ ] Infrastructure Configurations
- [ ] Documentation
- [ ] Tests

### Performance Metrics
- **Build Time**: [duration]
- **Bundle Size**: [kb/mb]
- **API Response Time**: [ms]
- **Resource Usage**: [metrics]

### Next Steps
- [ ] Code review
- [ ] Deploy to staging
- [ ] User acceptance testing
- [ ] Production deployment
```

## Example Usage

```bash
# Basic usage
/scout_plan_build user-authentication

# With options
/scout_plan_build payment-integration feature full production

# Infrastructure only
/scout_plan_build cdn-setup infrastructure infra staging

# Quick bugfix
/scout_plan_build fix-navigation bugfix frontend development
```

## Additional Context

Remember to:
- Follow the project's established coding standards
- Use the existing tech stack and patterns
- Implement proper error handling
- Follow security best practices
- Keep modules reusable and maintainable
- Write comprehensive tests
- Document all architectural decisions
- Consider performance from the start
- Implement proper logging and monitoring

When in doubt, ask for clarification before proceeding. Adapt this workflow to match the specific needs and conventions of the current project.