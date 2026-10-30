# Coding Standards

Conventions the linter and type checker don't enforce. Each section names the doc to read when your change goes deeper.

## Prompt text is Verbatim

Prompt text is checked once, at Admission (`src/services/promptAdmission.ts`), and is Verbatim from then on: read, show, copy and insert it exactly as stored. Any new route that brings text into the Library goes through Admission. Reasons and edge cases: `docs/adr/ADR-001-store-and-deliver-prompts-verbatim.md`.

## Logging

Log through the logger of the surface you are in: `Logger` from `src/utils` (`Logger.error`, `Logger.warn`…) in the popup, side panel and background; the `error`, `warn`, `info` and `debug` functions of `src/content/utils/logger.ts` in content scripts. Lint rejects `console.*` everywhere else.

## Forms

Validate and submit forms with React 19's `useActionState`. Patterns: `docs/REACT_19_MIGRATION.md`.

## Colors

Color with the token classes of `src/theme/tokens.css` (`bg-card`, `text-secondary`, `border-input`…). They follow the theme on their own, so one class covers light and dark. A raw palette class (`bg-purple-600`) or a `dark:` color variant bypasses the tokens. Design system: `docs/DESIGN_GUIDELINES.md`.

## Going deeper

- Changing how the popup, background and content scripts exchange messages or store data → `docs/ARCHITECTURE.md`
- Adding or changing a service or hook → `docs/SERVICES_AND_HOOKS.md`
- Building or reusing a component → `docs/COMPONENTS.md`
- Writing tests → `docs/TESTING.md`
- Changing custom-site element detection → `docs/ELEMENT_FINGERPRINTING_DESIGN.md`
- Changing something an ADR decided → `docs/adr/`
- Adding an AI platform → the `add-platform` skill
