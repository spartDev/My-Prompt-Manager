<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Sanofi Baseline Review Rules

These rules apply to Sanofi Accelerator frontend and full-stack projects using the standard tech stack (React, TanStack, Drizzle ORM, Tailwind, Sanofi Elements). For backend-only or infrastructure projects, apply only the TypeScript, Git, and Security sections. Project-specific rules from CLAUDE.md or AGENTS.md always take precedence.

## Component Library

| Rule | Severity |
|------|----------|
| Icons MUST use `@sanofi-accelerator/elements` IconName | Critical |
| Never use `lucide-react`, `react-icons`, `heroicons`, or other icon libraries | Critical |
| Loading states MUST use the project's LoadingSpinner component | Important |
| Buttons MUST use the project's extended Button component, not raw HTML | Important |
| Check project's `@/components/ui/` first, then `@sanofi-accelerator/elements` | Important |

## Styling

| Rule | Severity |
|------|----------|
| Use Tailwind CSS with semantic color tokens (CSS variables) | Important |
| Never hardcode color values (no `#hex`, no `rgb()`) | Important |
| Never use inline `style={}` attributes | Important |
| Use `cn()` utility for conditional class composition | Nit |

## TypeScript

| Rule | Severity |
|------|----------|
| No `any` types — use `unknown` and narrow, or define proper types | Critical |
| Use `type` imports for type-only references (`import type { X }`) | Important |
| Explicit return types on exported functions | Important |
| Interfaces for object shapes, type aliases for unions/primitives | Nit |

## Data Layer (Drizzle ORM)

| Rule | Severity |
|------|----------|
| SQL table/column names in `snake_case` | Important |
| TypeScript code uses `camelCase` | Important |
| Primary keys are UUIDs with `defaultRandom()` | Important |
| Boolean columns prefixed with `is_`, `has_`, `can_` | Nit |
| Use transactions for multi-step database operations | Important |
| Always filter by `deletedAt IS NULL` for soft-delete tables | Critical |

## Query Keys

| Rule | Severity |
|------|----------|
| Query keys MUST use centralized factories (e.g., `@/lib/queries/keys.ts`) | Critical |
| Never use inline string arrays as query keys | Critical |
| Mutations must invalidate affected query keys using factories | Important |
| Cross-domain invalidations required where data dependencies exist | Important |

## Git Conventions

| Rule | Severity |
|------|----------|
| Commit messages follow conventional commit format | Important |
| Branch names follow `type/TICKET-ID-description` pattern | Nit |
| Each PR maps to a single Jira ticket | Important |

## Security (Sanofi-specific)

| Rule | Severity |
|------|----------|
| No secrets, API keys, or tokens in source code | Critical |
| No `console.log` or `debugger` statements in production code | Important |
| Server-side operations use `createServerFn` pattern | Important |
| Auth checks via session context on protected routes | Critical |
