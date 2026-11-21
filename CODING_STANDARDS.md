# Coding Standards

Conventions the linter and type checker don't enforce. Each section names the doc to read when your change goes deeper.

## Prompt text is Verbatim

Prompt text is checked once, at Admission (`src/services/promptAdmission.ts`), and is Verbatim from then on: read, show, copy and insert it exactly as stored. Any new route that brings text into the Library goes through Admission. Reasons and edge cases: `docs/adr/ADR-001-store-and-deliver-prompts-verbatim.md`.

## Logging

Log through the logger of the surface you are in: `Logger` from `src/utils` (`Logger.error`, `Logger.warn`…) in the popup, side panel and background; the `error`, `warn`, `info` and `debug` functions of `src/content/utils/logger.ts` in content scripts. Lint rejects `console.*` everywhere else.

## Forms

Validate and submit forms with React 19's `useActionState`, as `src/components/PromptEditor.tsx` does; its unit tests in `src/components/__tests__/PromptEditor.test.tsx` show how to test one.

## Colors

Color with the token classes of `src/theme/tokens.css` (`bg-card`, `text-secondary`, `border-input`…). They follow the theme on their own, so one class covers light and dark. A raw palette class (`bg-purple-600`) or a `dark:` color variant bypasses the tokens. Design system: `docs/DESIGN_GUIDELINES.md`.

## Docs that state a number

A change to a count, limit or version updates every doc that states it: `grep` the old value across `README.md`, `docs/` and the agent guidance before you commit. `README.md`'s Chrome version is checked against `manifest.json`; the others are not.

## Going deeper

- Changing how the popup, background and content scripts exchange messages or store data → `docs/ARCHITECTURE.md`
- Adding or changing a service or hook → `docs/SERVICES_AND_HOOKS.md`
- Building or reusing a component → `docs/COMPONENTS.md`
- Writing tests → `docs/TESTING.md`
- Changing a Platform's content script (`src/content`: the Prompts button's placement, Insertion) → `docs/PLATFORM_INTEGRATION.md`
- Changing the Prompt selector or its `//` trigger (`src/content/selector/`) → `docs/ARCHITECTURE.md` (Content Script Architecture), then `docs/adr/ADR-002-render-the-prompt-selector-with-react-in-a-shadow-root.md`
- Changing the manifest's hosts or permissions, or how the content script is injected → `docs/PROGRAMMATIC_INJECTION.md`
- Changing custom-site element detection → `docs/ELEMENT_FINGERPRINTING_DESIGN.md`
- Changing the Element picker → `docs/ELEMENT_PICKER_IMPLEMENTATION.md` (its flow) and `docs/ELEMENT_PICKER_SECURITY.md` (its safeguards)
- Changing something an ADR decided → `docs/adr/`
- Adding an AI platform → the `add-platform` skill
