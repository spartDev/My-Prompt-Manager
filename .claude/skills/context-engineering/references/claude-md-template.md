<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# CLAUDE.md Template for Sanofi Repos

Copy the template below to `CLAUDE.md` at the repo root, fill in the bracketed sections, and commit. Symlink `AGENTS.md` to it if the repo supports that runtime.

Keep the finished file under **200 lines** total. If a section starts to balloon, move it into a dedicated skill under `standards/skills/<id>/` and reference it here instead.

---

```markdown
# [Project Name]

One-sentence description of what this repo does and who uses it.

## Tech Stack

- Language: [e.g. TypeScript 5.4, Python 3.12, Go 1.23]
- Framework: [e.g. Next.js 15, FastAPI, Gin]
- Data: [e.g. PostgreSQL 16, DynamoDB]
- Deploy target: [e.g. AWS ECS, Azure App Service, on-prem k8s]

## Commands

- Install: `[pnpm install | uv sync | go mod download]`
- Build: `[pnpm build | python -m build | go build ./...]`
- Test: `[pnpm test | pytest | go test ./...]`
- Lint: `[pnpm lint --fix | ruff check --fix | golangci-lint run]`
- Dev server: `[pnpm dev | uvicorn app:main --reload | go run .]`
- Type check: `[pnpm tsc --noEmit | pyright | go vet ./...]`

## Conventions

- [e.g. Functional components, named exports only]
- [e.g. Tests colocated next to source: `Button.tsx` → `Button.test.tsx`]
- [e.g. Use the repo's ValidationError class, do not throw raw Errors]
- [e.g. One pattern example per convention, point to a concrete file]

## Boundaries

- Never commit `.env` files or secrets
- Never push directly to `main`
- Never modify the database schema without an ADR (see `adr-writing` skill)
- Never add dependencies without a security review (see `dependency-audit` skill)
- Ask before touching [list of high-risk modules, e.g. billing, auth]

## Installed Standards

This repo installs `@sanofi-accelerator/ai-standards`. The following skills are
auto-loaded — do not inline their guidance here:

- `adr-writing` — write and review Architecture Decision Records
- `release-process` — cut releases, bump SemVer, write changelogs
- `creating-pull-requests` — PR hygiene and review workflow
- `tdd` — test-driven development discipline
- `code-review` — structured review grading
- `dependency-audit` — periodic dependency review
- [add others from registry.yaml that apply to this repo]

Trigger any of them by intent (e.g. "write an ADR for …", "cut a release", "review this PR").
The full catalog lives in `@sanofi-accelerator/ai-standards/registry.yaml`.

## Project-Specific Rules

[Anything that ISN'T covered by a standard skill. If a rule here is general
enough to apply to other Sanofi repos, propose promoting it into
standards/skills/ via a PR on `@sanofi-accelerator/ai-standards`.]

## Pointers

- Architecture decisions: `docs/adr/`
- Backstage catalog entry: `catalog-info.yaml`
- Runbook: [link]
- Team contact: [Slack channel or email]

## When You're Stuck

- Re-read this file.
- Check `docs/adr/` for a decision that covers the area.
- Ask — do not guess. Surface the ambiguity as described in the
  `context-engineering` skill's "Confusion Management" section.
```

---

## Filling in the sections

- **Tech Stack**: name concrete versions, not generic terms. "PostgreSQL 16" not "a relational database".
- **Commands**: the four or five commands the agent will actually run. One line each. If there is a Makefile or `justfile`, point to it here.
- **Conventions**: each bullet should be testable. "Use named exports" is testable; "write clean code" is not. For each convention, ideally name one existing file that exemplifies it.
- **Boundaries**: what the agent must NOT do. Explicit negatives prevent the most expensive mistakes.
- **Installed Standards**: list only the skills this repo actually uses. Do not list every skill in the catalog — context cost is real.
- **Project-Specific Rules**: the residual — things genuinely unique to this repo. If you find yourself writing guidance that would apply to any Sanofi repo, promote it to the standards catalog.

## Multi-runtime: symlinks, not copies

If the repo is used from Claude Code and an AGENTS.md-based agent (e.g. Codex):

```bash
ln -s CLAUDE.md AGENTS.md
git add CLAUDE.md AGENTS.md
```

Avoid three parallel copies — they drift. One file, many names.
