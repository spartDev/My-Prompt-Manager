# Documentation Archive

This directory contains historical documentation that provides context about the project's origins and initial requirements.

## Contents

### `requirements.md`
**Original Requirements Document** - Created during initial project planning (July 2024)

Contains the original 6 core requirements with acceptance criteria:
1. Save prompts to personal library
2. Organize prompts into categories
3. Quick copy prompts
4. Edit and delete prompts
5. Search through prompt library
6. Data persistence across browser sessions

**Status**: ✅ All requirements have been implemented and exceeded

**Value**: Useful reference for understanding:
- Original feature scope and user stories
- Initial acceptance criteria
- Requirements validation for testing
- Historical context for feature evolution

### `product.md`
**Product Overview** - High-level product description

Contains:
- Product vision and core features
- Target user personas
- Key value propositions
- Marketing-focused descriptions

**Value**: Non-technical overview for:
- Understanding product positioning
- Marketing and user communication
- Onboarding new team members
- Product roadmap context

### One-off reports and plans (archived 2026-11, My-Prompt-Manager-uxu.10)

Linked from nowhere and out of date; kept for history, not as a reference for current code. Their paths and numbers describe the code of the day they were written.

- `ACCESSIBLE_COLOR_CONTRAST_GUIDE.md`: a generic WCAG contrast guide (October 2025). Current rule: `docs/DESIGN_GUIDELINES.md` and `src/theme/categoryChip.ts`.
- `ANALYTICS_IMPLEMENTATION_PLAN.md`: the analytics plan; most of the `src/` paths it cites never existed under those names.
- `AUDIT_AREAS.md`, `AUDIT_SERVICES_CORE_BUSINESS_LOGIC.md`: one-off code audits.
- `PR_156_PERFORMANCE_ANALYSIS.md`: the performance analysis of PR #156.

### The React 19 migration log (archived 2026-11, My-Prompt-Manager-xds.4)

- `REACT_19_MIGRATION.md`: the log of the move to React 19 (commits, patterns, pitfalls). Its section "Why No Unit Tests for React 19 Hooks?" is wrong: `src/components/__tests__/PromptEditor.test.tsx` unit-tests the `useActionState` editor in happy-dom. The patterns live in the code now, `src/components/PromptEditor.tsx` (`useActionState`) and `src/App.tsx` (`useOptimistic`), and the rule in `CODING_STANDARDS.md`.

### Reports and plans no pointer reached (archived 2026-11, My-Prompt-Manager-zgcb)

No route led to them and no agent read them in 21 days, but they turned up in agents' searches of `docs/`. Their paths and numbers describe the code of the day they were written.

- `POSITIONING_SOLUTION_ANALYSIS.md`: the comparison of three ways to position a Custom site's icon, which chose Floating UI. Current placement: `docs/PLATFORM_INTEGRATION.md` and `src/content/core/anchored-overlay.ts`.
- `ELEMENT_FINGERPRINTING_IMPLEMENTATION.md`: the completion report of element fingerprinting. Current design: `docs/ELEMENT_FINGERPRINTING_DESIGN.md`; code: `src/content/utils/element-fingerprint.ts`.
- `weakmap-to-map-icon-cleanup-fix.md`, formerly `docs/fixes/`: the November 2025 fix that moved the injector's icon cleanups from a `WeakMap` to a `Map` (`iconCleanups` in `src/content/core/injector.ts`).
- `color-scheme-theme-detection.md`, formerly `docs/improvements/`: the November 2025 change that read Microsoft 365 Copilot's theme from its `color-scheme` property instead of parsing its background color.
- `2025-01-15-team-libraries-design.md`, formerly `docs/plans/`: a design for Team Libraries shared through a synced folder. Never built.
- `2026-01-12-usage-analytics-dashboard-design.md`, formerly `docs/plans/`: the design of Analytics, since built (`src/components/analytics/`).

## Current Documentation

For up-to-date technical documentation, see:

- **`/CLAUDE.md`** - Quick reference for development
- **`/docs/ARCHITECTURE.md`** - Complete system design
- **`/docs/COMPONENTS.md`** - Component catalog
- **`/docs/SERVICES_AND_HOOKS.md`** - Business logic layer
- **`/docs/PLATFORM_INTEGRATION.md`** - Platform integration guide
- **`/docs/TESTING.md`** - Testing strategies
- **`/docs/DESIGN_GUIDELINES.md`** - Design system

## Note

These archived documents are preserved for historical reference only. Do not use them as technical specifications for current development work. Always refer to the main documentation in `/docs/` and `/CLAUDE.md` for current, accurate information.
