<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Package Manager Command Map

This reference maps generic operations to their npm and pnpm equivalents. The `dependency-audit` skill uses this to stay package-manager agnostic.

## Supported Package Managers

| PM | Supported | Lockfile | Monorepo config |
|----|-----------|----------|-----------------|
| npm | Yes | `package-lock.json` | `"workspaces"` in `package.json` |
| pnpm | Yes | `pnpm-lock.yaml` | `pnpm-workspace.yaml` |
| yarn | **No** — explicitly unsupported | — | — |
| bun | **No** — not yet supported | — | — |

## Detection

Detect the package manager by checking (in order):

1. `packageManager` field in `package.json` (corepack standard) — extract the name before `@`
2. `pnpm-lock.yaml` exists → pnpm
3. `package-lock.json` exists → npm (default fallback)
4. `yarn.lock` exists → **Yarn detected. STOP. Unsupported.**

---

## Command Equivalences

### Audit

| Operation | npm | pnpm |
|-----------|-----|------|
| Audit (JSON) | `npm audit --json` | `pnpm audit --json` |
| Audit (human) | `npm audit` | `pnpm audit` |
| Audit fix | `npm audit fix` | `pnpm audit --fix` |
| Audit (high+ only) | `npm audit --audit-level=high` | `pnpm audit --audit-level high` |

### Dependency Management

| Operation | npm | pnpm |
|-----------|-----|------|
| Outdated (JSON) | `npm outdated <pkg> --json` | `pnpm outdated <pkg> --json` |
| Update package | `npm update <pkg>` | `pnpm update <pkg>` |
| Update scoped | `npm update "@scope/*"` | `pnpm update "@scope/*"` |
| List depth 0 | `npm ls --depth=0` | `pnpm ls --depth 0` |

### Install

| Operation | npm | pnpm |
|-----------|-----|------|
| Install (allow lockfile changes) | `npm install` | `pnpm install --no-frozen-lockfile` |
| Install (frozen, CI) | `npm ci` | `pnpm install --frozen-lockfile` |
| Run script | `npm run <script>` | `pnpm run <script>` |

### Monorepo / Workspaces

| Operation | npm | pnpm |
|-----------|-----|------|
| Recursive update | `npm update <pkg> --workspaces` | `pnpm --recursive update <pkg>` |
| Recursive run | `npm run <script> --workspaces --if-present` | `pnpm --recursive run --if-present <script>` |
| Filter workspace | `npm -w <workspace> <cmd>` | `pnpm --filter <workspace> <cmd>` |

### Overrides (Transitive Dependency Pinning)

| Aspect | npm | pnpm |
|--------|-----|------|
| Location | `"overrides"` in `package.json` | `"pnpm.overrides"` in `package.json` (or `pnpm-workspace.yaml` in pnpm 9+) |
| Format | `{ "pkg": "^1.2.3" }` | `{ "pkg": "^1.2.3" }` |
| `>=` fix needed after audit fix | No (npm uses safe ranges) | **Yes** — `pnpm audit --fix` writes `>=` ranges that must be changed to `^` |

### Peer Dependency Conflict Resolution

| PM | Flag |
|----|------|
| npm | `--legacy-peer-deps` |
| pnpm | `--no-strict-peer-dependencies` |
