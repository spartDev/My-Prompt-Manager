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
git status --porcelain
git fetch -q origin --tags
BASE=$(git rev-parse origin/main)
LAST=$(git describe --tags --abbrev=0 "$BASE")
for f in package.json package-lock.json manifest.json; do git show "$BASE:$f" | node -p "JSON.parse(require('fs').readFileSync(0)).version"; done
git log --no-merges --format='%h %s' "$LAST..$BASE"
git log --no-merges --format='%h %s' -E --grep='BREAKING[ -]CHANGE' "$LAST..$BASE"
```

`$BASE` is the `main` the version and the CHANGELOG are built from; steps 5 and 6 check that nothing landed after it. The versions are read at `$BASE`, not in the working tree, so the branch you start from does not matter.

Done when: `git status --porcelain` prints nothing, the three versions are equal to `$LAST` without its `v`, and you hold `$BASE` and a non-empty commit list. An empty list means nothing shipped since `$LAST`: tell the user there is nothing to release and stop. Uncommitted changes go back to the user to commit or set aside before anything else; three unequal versions are a bug to report.

## 2. Pick the version

The argument wins when given. Otherwise read the commit list as conventional commits:

- `!` after the type, or any commit in the breaking-change list → **major**
- any `feat` → **minor**
- anything else (`fix`, `perf`, `refactor`, `docs`, `chore`, `test`, `ci`, `build`) → **patch**

The version is always three integers, `X.Y.Z`. Chrome's `manifest.json` accepts only dot-separated integers, and `release.yml` requires the built manifest to equal the tag, so a suffixed version (`-beta.1`) cannot pass the workflow. A request for a pre-release goes back to the user as out of scope for this skill.

The new version must be three integers, move past `$LAST` and be untagged; this prints `ok` only then:

```bash
V=X.Y.Z
printf '%s\n' "$V" | grep -Eqx '(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)' && [ "$V" != "${LAST#v}" ] && [ "$(printf '%s\n' "${LAST#v}" "$V" | sort -V | tail -1)" = "$V" ] && ! git rev-parse -q --verify "refs/tags/v$V" >/dev/null && echo ok
```

Done when: the check prints `ok`, and the user confirms the version and the grouped change list you showed them. A version that fails the check goes back to the user.

## 3. Write the bump

Branch off `$BASE` as `release/vX.Y.Z`, then:

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

  [X.Y.Z]: https://github.com/spartDev/My-Prompt-Manager/compare/$LAST...vX.Y.Z
  ```

  The last line defines the heading's link and closes the section, as in every earlier release, so the extracted notes carry it too. Keep only the subsections that have entries. Write each entry in the user's terms and the domain terms of `CONTEXT.md` (Prompt, Library, Category…), one per user-visible change; leave out `test`, `ci` and `chore` commits unless the user would notice them.
- **`README.md`**: the version badge, the `prompt-library-extension-vX.Y.Z.zip` name, and the `### Version X.Y (Current)` heading of the Roadmap when the minor changes.

Done when: `node -p "[require('./package.json').version, require('./package-lock.json').version, require('./manifest.json').version].join(' ')"` prints `X.Y.Z` three times, and `grep -nF "${LAST#v}" README.md` (`$LAST` from step 1) finds only lines unrelated to the release, such as a dependency that happens to share the number.

## 4. Check

`npm test && npm run lint && npm run lint:changed && npm run typecheck && npm run build`. `npm run build` is enough to prove the bundle: CI's release workflow packages the zip itself. `npm run package` reruns `npm install`, so it stays out of an agent worktree.

Done when: all five pass.

## 5. Open the bump PR

Commit as `chore: bump version to X.Y.Z`, push, and open the PR on `.github/PULL_REQUEST_TEMPLATE.md` with the CHANGELOG section as its summary and a line `Base: <full $BASE SHA>`. Shell variables do not outlive a command, and step 6 runs after the merge, so it reads `BASE` back from that line.

Right before the hand-off, `git fetch -q origin main && git log --no-merges --format='%h %s' "$BASE..origin/main"` must print nothing. Commits there would ship in the release without a CHANGELOG entry. Rebase the bump branch on `origin/main` and set `BASE` to it, then go back through steps 1 to 4 on the new `$LAST..$BASE`: both logs, the version (a breaking footer can now call for a higher bump), every file of step 3 with that version, the checks. Commit the result, push, and update the PR's title and `Base:` line before checking this log again.

Done when: the PR's checks are green and that log is empty. **Hand-off: the user merges it, with nothing else merged in between.**

## 6. Tag

After the merge, tag the bump PR's own merge commit, not the tip of `main`: another PR may have landed since, and its changes are not in the CHANGELOG you confirmed.

```bash
SHA=$(gh pr view <bump PR number> --json mergeCommit -q .mergeCommit.oid)
git fetch -q origin main
EXTRA=$(git log --no-merges --format='%h %s' "$BASE..$SHA^1")
if [ -z "$EXTRA" ]; then git tag -a vX.Y.Z -m "Release vX.Y.Z" "$SHA"; else printf '%s\n' "$EXTRA"; fi
```

`EXTRA` lists what reached `main` between `$BASE` and the merge, and the tag exists only when it is empty. Anything it prints would ship unlisted: show the user, and leave the version untagged until they decide.

Confirm with the user before `git push origin vX.Y.Z`: the push publishes the GitHub Release. A tag run carries the tag as its branch, and GitHub takes a few seconds to register it, so wait for that run before watching it, in the background:

```bash
until RUN=$(gh run list --workflow release.yml --branch vX.Y.Z --limit 1 --json databaseId -q '.[0].databaseId') && [ -n "$RUN" ]; do sleep 5; done
gh run watch "$RUN" --exit-status
```

Done when: the run is green and `gh release view vX.Y.Z` shows the release.

## 7. Chrome Web Store

The store publish job of `release.yml` is commented out, so the upload is manual. Tell the user where the package is: the `chrome-webstore-package-vX.Y.Z` artifact of the run, to upload in the Chrome Web Store developer dashboard.

Done when: the user has the artifact link.
