---
name: release
description: Release a new version of the Chrome extension, from the bump PR to the tag that publishes it.
argument-hint: "[patch | minor | major | X.Y.Z]"
disable-model-invocation: true
---

# Release

A release is two hand-offs: a **bump PR** that the user merges, then an annotated tag on `main` whose push runs `.github/workflows/release.yml` (validation, build, GitHub Release, Chrome Web Store package). Each step ends on its own criterion; stop at the two hand-offs and wait for the user.

## 1. Read the state

```bash
git fetch -q origin --tags
LAST=$(git describe --tags --abbrev=0 origin/main)
node -p "[require('./package.json').version, require('./package-lock.json').version, require('./manifest.json').version].join(' ')"
git log --no-merges --format='%h %s' "$LAST..origin/main"
```

Done when: the three versions are equal to `$LAST` without its `v`, and you hold the commit list. Three unequal versions are a bug to report before going further.

## 2. Pick the version

The argument wins when given. Otherwise read the commit list as conventional commits:

- `!` after the type, or `BREAKING CHANGE` in a body → **major**
- any `feat` → **minor**
- anything else (`fix`, `perf`, `refactor`, `docs`, `chore`, `test`, `ci`, `build`) → **patch**

A version with `-alpha`, `-beta` or `-rc` makes the workflow mark the GitHub Release as a pre-release.

Done when: the user confirms the version and the grouped change list you showed them.

## 3. Write the bump

Branch off `origin/main` as `release/vX.Y.Z`, then:

- **`package.json` and `package-lock.json`**: `npm version X.Y.Z --no-git-tag-version`. It edits both files in place and installs nothing, which keeps a worktree's symlinked `node_modules` intact.
- **`manifest.json`**: set `"version"` to `X.Y.Z`.
- **`CHANGELOG.md`**: insert the section right under `## [Unreleased]`. The workflow extracts the release notes with an `awk` on the heading `## [X.Y.Z]`, up to the next `## [`, so the heading shape is fixed:

  ```markdown
  ## [X.Y.Z] - YYYY-MM-DD

  ### ✨ Added
  -  <what the user can now do> ([#N](https://github.com/spartDev/My-Prompt-Manager/pull/N))

  ### 🔄 Changed
  ### 🐛 Fixed
  ### 🔒 Security
  ### 📚 Documentation
  ```

  Keep only the subsections that have entries. Write each entry in the user's terms and the domain terms of `CONTEXT.md` (Prompt, Library, Category…), one per user-visible change; leave out `test`, `ci` and `chore` commits unless the user would notice them.
- **`README.md`**: the version badge, the `prompt-library-extension-vX.Y.Z.zip` name, and the `### Version X.Y (Current)` heading of the Roadmap when the minor changes.

Done when: `node -p` from step 1 prints `X.Y.Z` three times, and `grep -rn "$OLD_VERSION" README.md` finds no stale version.

## 4. Check

`npm test && npm run lint && npm run lint:changed && npm run typecheck && npm run build`. `npm run build` is enough to prove the bundle: CI's release workflow packages the zip itself. `npm run package` reruns `npm install`, so it stays out of an agent worktree.

Done when: all five pass.

## 5. Open the bump PR

Commit as `chore: bump version to X.Y.Z`, push, and open the PR on `.github/PULL_REQUEST_TEMPLATE.md` with the CHANGELOG section as its summary.

Done when: the PR's checks are green. **Hand-off: the user merges it.**

## 6. Tag

After the merge, on the merge commit of `main`:

```bash
git fetch -q origin main
git tag -a vX.Y.Z -m "Release vX.Y.Z" origin/main
```

Confirm with the user before `git push origin vX.Y.Z`: the push publishes the GitHub Release. Then watch the run in the background with `gh run watch "$(gh run list --workflow release.yml --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status`.

Done when: the run is green and `gh release view vX.Y.Z` shows the release.

## 7. Chrome Web Store

The store publish job of `release.yml` is commented out, so the upload is manual. Tell the user where the package is: the `chrome-webstore-package-vX.Y.Z` artifact of the run, to upload in the Chrome Web Store developer dashboard.

Done when: the user has the artifact link.
