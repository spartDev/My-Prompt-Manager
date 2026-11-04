# Renovate

`renovate.json` is the reference for every value: schedule, limits, priorities, groups, automerge, release ages. This page keeps only what the file cannot say: why some rules exist, and how to check a change.

## Check a change to renovate.json

```bash
npm run lint:renovate
```

It runs Renovate's `renovate-config-validator --strict` on `renovate.json` as a repository config, from a pinned Renovate version, through `npx`: nothing is added to `package.json` dependencies. Exit 0 means valid; an unknown or deprecated option (`matchPackagePatterns`, `stabilityDays`…) exits 1. The first run downloads Renovate (about 3 minutes), later runs take about 25 seconds. The lines `RE2 not usable` and the `re2` stack trace are noise: Renovate falls back to `RegExp`. Renovate needs Node `^24.11`; a newer Node prints an `EBADENGINE` warning and still works.

The version in the script is pinned by hand (Renovate does not update `npx` arguments). Bump it when the validator rejects an option that the current Renovate docs list.

## Why the rules exist

- **Groups**: packages that must move together (React and its types, Vite and its plugins, Vitest and its coverage, Tailwind and PostCSS) share a group so that one PR carries a consistent set.
- **`vite ecosystem (major)` group**: `@vitejs/plugin-react` follows Vite's major (6.x needs `vite ^8`), so neither can be installed alone. Their majors land in one PR.
- **Majors need approval**: a major PR opens only once ticked in the Dependency Dashboard issue (`dependencyDashboardApproval`), so majors land when someone has time to read the migration guide.
- **`constraints.npm: ^11` and the disabled `renovate-config` npm rule**: npm 12 breaks lockfile updates (npm/cli#9800, `EALLOWREMOTE`). The disabled rule keeps Renovate from bumping its own constraint. Remove both together, see beads `My-Prompt-Manager-67o`.
- **Automerge**: only devDependency patches and GitHub Actions. Runtime dependencies, `@types/chrome` and `@crxjs/vite-plugin` change what runs in the extension and get a human merge.
- **`minimumReleaseAge`**: a release must be some days old before Renovate proposes it, so a broken or yanked release is caught upstream first (longer for `react` and `react-dom`).

## How a Renovate PR merges

Renovate PRs pass the same gate as any PR: `✅ Quality Gate Summary`, the only required check of `main` (`.github/workflows/README.md`). Automerge waits for it. An unresolved review thread (Codex included) also blocks the merge, even on a green, automerge PR.

The CI `Security & Dependencies` job runs `npm audit --audit-level=moderate` on the whole tree. A new transitive advisory therefore fails every Renovate PR at once: fix it on `main`, not PR by PR.

## Resources

- [Configuration options](https://docs.renovatebot.com/configuration-options/)
- [Config validation](https://docs.renovatebot.com/config-validation/)
