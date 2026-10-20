---
paths:
  - "**/*.py"
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Python Coding Guidelines

Follow these Python-specific practices when writing code:

## Style and Structure

- Follow the PEP 8 style guide. Ruff is the recommended enforcer, but PEP 8 is the standard regardless of which tool you use.
- Prefer explicit over implicit
- Keep functions focused and single-purpose
- Use context managers for resource management

## Type Hints and Documentation

- Use type hints for function parameters and return values
- Write descriptive Google-style docstrings for public functions and classes
- Document complex logic and non-obvious decisions

## Code Quality

- No unnecessary complexity or premature abstractions
- Error handling should be appropriate and not overly broad
- Avoid backwards-compatibility hacks (unused variables, re-exports) unless explicitly needed
