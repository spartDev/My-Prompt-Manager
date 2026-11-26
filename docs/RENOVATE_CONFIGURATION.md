# Renovate

`renovate.json` is the reference for every value: schedule, limits, priorities, groups, automerge, release ages. This page keeps only what the file cannot say: why some rules exist, and how to check a change.

## Check a change to renovate.json

```bash
npm run lint:renovate
```

It runs Renovate's `renovate-config-validator --strict` on `renovate.json` as a repository config, from a pinned Renovate version, through `npx`: nothing is added to `package.json` dependencies. Exit 0 means valid; an unknown or deprecated option (`matchPackagePatterns`, `stabilityDays`…) exits 1. The first run downloads Renovate (about 3 minutes), later runs take about 25 seconds. The lines `RE2 not usable` and the `re2` stack trace are noise: Renovate falls back to `RegExp`. Renovate needs Node `^24.11`; a newer Node prints an `EBADENGINE` warning and still works.

The version in the script is pinned by hand (Renovate does not update `npx` arguments). Bump it when the validator rejects an option that the current Renovate docs list.

### See which PRs would automerge

A valid config can still automerge the wrong PR. A dry run on a copy of the repo shows each branch Renovate would open and whether it automerges:

```bash
dir=$(mktemp -d)
mkdir -p "$dir/.github" && cp -R .github/workflows "$dir/.github/" && cp renovate.json "$dir/"
# in $dir, set a few version comments back (# v7.0.1 to # v7.0.0 after actions/checkout) so that updates exist
cd "$dir"
RENOVATE_PLATFORM=local RENOVATE_DRY_RUN=lookup RENOVATE_GITHUB_COM_TOKEN=$(gh auth token) LOG_LEVEL=trace LOG_FORMAT=json \
  npx -y --package renovate@44.197.1 renovate > renovate.log
jq -cR 'fromjson? | select(.msg == "generateBranchConfig") | {branch: .config[0].branchName, automerge: (.config | all(.automerge)), files: (.config | map(.packageFile) | unique)}' renovate.log
```

Each line is one branch, so one PR. Renovate automerges a branch only when every update in it automerges (`all(.automerge)` is its rule). The copy keeps the edited version comments out of the checkout. The token lets it look up action tags on GitHub; Renovate redacts it from the log. On a Node newer than `^24.11` it logs `Unsupported node environment` and exits 1 after a complete run.

## Why the rules exist

- **Groups**: packages that must move together (React and its types, Vite and its plugins, Vitest and its coverage, Tailwind and PostCSS) share a group so that one PR carries a consistent set.
- **`vite ecosystem (major)` group**: `@vitejs/plugin-react` follows Vite's major (6.x needs `vite ^8`), so neither can be installed alone. Their majors land in one PR.
- **Majors need approval and a human merge**: a major PR opens only once ticked in the Dependency Dashboard issue (`dependencyDashboardApproval`), so majors land when someone has time to read the migration guide, and it never automerges, GitHub Actions majors included. The majors rule comes after the GitHub Actions rule (`automerge: true`) so that its `automerge: false` wins: placed before it, a ticked action major automerged (#466). Keep it there.
- **`constraints.npm: ^11` and the disabled `renovate-config` npm rule**: npm 12 breaks lockfile updates (npm/cli#9800, `EALLOWREMOTE`). The disabled rule keeps Renovate from bumping its own constraint. Remove both together, see beads `My-Prompt-Manager-67o`.
- **`lexical`, `@lexical/*` and `@preact/signals-core` are disabled**: the Perplexity and Microsoft 365 Copilot e2e stand-ins serve their CommonJS production build from `node_modules`, at the version perplexity.ai serves (0.41.0). Lexical 0.53 moved its files to `dist/` as ES modules and added `@lexical/internal`, which broke the fixture (PR #606). To move, follow `docs/TESTING.md` (bump the pins together, adapt `LEXICAL_SCRIPTS`), then remove the rule.
- **Automerge**: only devDependency patches and the non-major GitHub Actions updates outside `release.yml`. Runtime dependencies, `@types/chrome` and `@crxjs/vite-plugin` change what runs in the extension and get a human merge. Renovate applies `packageRules` in order and a later rule wins, so their `automerge: false` rules come after the devDependency patch rule (both are devDependencies): keep it that way.
- **`release.yml` gets a human merge**: its store jobs run with a Google identity that can publish to the Chrome Web Store, and the owner's approval of the `chrome-webstore` environment trusts `main`'s code (`docs/GITHUB_ENVIRONMENTS.md`). `main` requires no approving review, so an automerged bump would put a new release of `actions/checkout`, `actions/setup-node`, `actions/download-artifact` or `google-github-actions/auth` in those jobs unread: #242, #406 and #466 were merged that way. The `github actions (release.yml)` rule matches the file (`matchFileNames`) and sets `automerge: false`; it comes after the GitHub Actions rule so that it wins: keep it there. It also gives the file its own group, because Renovate automerges a branch only when every update in it automerges: in the shared `github actions` group, one `release.yml` update would hold every other workflow's bump for review. A bump of an action that `release.yml` and other workflows use therefore opens two PRs: `renovate/github-actions`, automerged, and `renovate/github-actions-release`, merged by hand.
- **`minimumReleaseAge`**: a release must be some days old before Renovate proposes it, so a broken or yanked release is caught upstream first (longer for `react` and `react-dom`).

## How a Renovate PR merges

Renovate PRs pass the same gate as any PR: `✅ Quality Gate Summary`, the only required check of `main` (`.github/workflows/README.md`). Automerge waits for it. An unresolved review thread (Codex included) also blocks the merge, even on a green, automerge PR.

The CI `Security & Dependencies` job runs `npm audit --audit-level=moderate` on the whole tree. A new transitive advisory therefore fails every Renovate PR at once: fix it on `main`, not PR by PR.

## Resources

- [Configuration options](https://docs.renovatebot.com/configuration-options/)
- [Config validation](https://docs.renovatebot.com/config-validation/)
