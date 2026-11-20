# Release workflow

How a Release goes from a tag to the Chrome Web Store, through `.github/workflows/release.yml`. Preparing the Release (the version in `package.json`, `package-lock.json` and `manifest.json`, the CHANGELOG section, the bump PR, the tag) is the `release` skill: `.claude/skills/release/SKILL.md`. The one-time Google Cloud, Developer Dashboard and GitHub setup is [`GITHUB_ENVIRONMENTS.md`](GITHUB_ENVIRONMENTS.md).

Terms (`CONTEXT.md`, section Releases): a **Submission** is a Release sent to the Chrome Web Store, waiting for its **Store review**; its **Publication** is the moment the store starts installing it and offering it as an update.

## Two kinds of run

| | Tag push `vX.Y.Z` | Manual run (the rehearsal) |
| --- | --- | --- |
| Version | the tag's; `package.json` must say the same | `package.json`'s |
| Validation, build, attested zip, Release notes | yes | yes |
| GitHub Release, with the zip attached | yes | no |
| Submission to the Chrome Web Store | yes, after the owner approves `chrome-webstore`; never for a tag with `-alpha`, `-beta` or `-rc` | never |
| Store status call (read-only) | no | yes, on `main` only, after the owner approves `chrome-webstore` |

A tag with `-alpha`, `-beta` or `-rc` makes a pre-release GitHub Release and no Submission. In practice it cannot pass validation: Chrome's manifest version takes integers only, and the build must carry the tag's version.

Runs go one at a time (concurrency group `release-process`): a run waiting for the owner's approval holds the next one, and GitHub keeps only the latest of the runs waiting behind it.

## The jobs

```text
🔍 Release Validation (validate-release)        version, npm run lint, npm run test:coverage, audit
├── 🏗️ Release Build (build-release)            npm run build, the zip, its attestation
│   ├── 🏷️ GitHub Release (create-github-release)       tag push only
│   │   └── 🚀 Chrome Web Store Submission (chrome-web-store-submission)
│   │                                           tag push without a suffix; chrome-webstore
│   └── 🔎 Chrome Web Store Status (chrome-web-store-status)
│                                               manual run on main; chrome-webstore, read-only
└── 📝 Release Notes (release-notes)            the version's section of CHANGELOG.md
📊 Release Summary (release-summary)            always; fails when a job failed or was cancelled
```

The GitHub Release also waits for the Release Notes job. Only Release Build (for its attestation) and the two store jobs hold `id-token: write`. Two jobs write to the repository: Release Build its attestation (`attestations: write`), and the GitHub Release job the Release and its zip (`contents: write`).

## The zip

One file, `prompt-library-extension-vX.Y.Z.zip`: the contents of `dist/`, with `manifest.json` at its root as the store requires, zipped from Release Build's own `npm run build` (no `npm install`, no second build). That file is:

- attested by `actions/attest-build-provenance`;
- the artifact `chrome-extension-release-vX.Y.Z` of the run (90 days);
- attached to the GitHub Release under its own name, once: the GitHub Release job fails rather than put another zip in its place (see Rerunning);
- uploaded to the store. Each store job first checks that its copy has the SHA-256 Release Build computed.

To check a Release's zip:

```bash
gh release download vX.Y.Z --repo spartDev/My-Prompt-Manager --pattern 'prompt-library-extension-v*.zip'
unzip -Z1 prompt-library-extension-vX.Y.Z.zip | grep -x manifest.json
gh attestation verify prompt-library-extension-vX.Y.Z.zip --repo spartDev/My-Prompt-Manager
```

`npm run package` makes a zip of the same name locally; it reinstalls and rebuilds first, so the workflow does not use it.

## The Submission

After the GitHub Release, the Submission job waits for the owner to approve the `chrome-webstore` environment (the run's page, **Review deployments**). Then it:

1. trades the job's GitHub OIDC token for a Google access token with the `chromewebstore` scope (`google-github-actions/auth`, Workload Identity Federation: no store secret in GitHub);
2. runs `node scripts/chrome-web-store.mjs submit`, which calls the [Chrome Web Store API V2](https://developer.chrome.com/docs/webstore/using-api) directly:
   - **check**: `fetchStatus`, and the rules below;
   - **upload**: the zip to the `upload` URI;
   - **poll**: while the upload is in progress (`IN_PROGRESS`, which the reference also spells `UPLOAD_IN_PROGRESS`), `fetchStatus` every 10 s, up to 30 times;
   - **publish**: with `publishType` `DEFAULT_PUBLISH`, so the Release is published as soon as the Store review approves it;
   - **status**: `fetchStatus` again, into the job summary.

The job ends at the Submission. The Store review result arrives by Google's e-mail to the publisher account; on approval the Publication happens with no further step.

What the check decides, from the store's answer:

| The store reports | The job |
| --- | --- |
| this version published | sends nothing, ends green |
| this version submitted, in Store review or approved and staged | sends nothing, ends green |
| another version in Store review or staged | fails and says so; it never cancels a Submission |
| a published version higher than the zip's | fails, uploads nothing |
| a refused or cancelled Submission of this version or a higher one | fails, uploads nothing |
| an earlier upload still in progress, or a last upload in a state other than `SUCCEEDED`, `FAILED` or `NOT_FOUND` | fails, uploads nothing |
| no published version, or anything else the API reference does not describe | fails, uploads nothing |
| a published version lower than the zip's, nothing pending | uploads and submits |

Every failure is red, with Google's message verbatim in the job summary. The access token never appears in a log line or the summary.

The store publishes with the visibility last published from the Developer Dashboard. After a visibility change in the Dashboard, publish once by hand there before the next tag.

## The rehearsal

```bash
gh workflow run release.yml --repo spartDev/My-Prompt-Manager --ref main
```

(or Actions, **🚀 Release & Chrome Web Store**, **Run workflow**). It takes its version from `package.json`, so it never names another Release, and runs the validation, the build and the attested zip, and the Release notes extraction. On `main` it also runs the status job: approve `chrome-webstore`, and its log and the summary show the published version and what a Submission of this zip would do. It creates and changes no GitHub Release, and submits nothing.

On another branch the status job is skipped (the environment admits `main` and tags `v*` only) and everything else runs: that is how a change to `release.yml` is tried before it merges.

## Rerunning

On a tag run, only **Re-run failed jobs**, never **Re-run all jobs**. Re-run all jobs builds a new zip (zip stores the files' times) and attests it, while the GitHub Release and the store may already hold the first one. The GitHub Release job's first step, **🔒 Check the Release holds no other zip**, lists the Releases, drafts included, and fails before anything changes when the Release of the tag holds a zip of that name whose digest (the SHA-256 GitHub computed at its upload) is not this run's, or has none, or when the listing fails.

- **A failed run**: fix the cause, then **Re-run failed jobs**. A rerun of the Submission for a version already submitted or published sends nothing and ends green; a rerun of the GitHub Release updates the Release of the tag.
- **The publish call failed after the upload succeeded**: the upload is a draft in the Developer Dashboard. A rerun uploads the zip again; if the store refuses that, submit the draft from the Dashboard's **Package** tab.
- **Another version is in Store review**: wait for its result, or cancel it in the Developer Dashboard, then rerun. The workflow never cancels a Submission.

## A Release refused at Store review

It is never submitted again. Fix it, then release the fix as the next version, with a new tag. That version's CHANGELOG section and its What's new notes (`src/whatsNew/releaseNotes.ts`) carry over the refused Release's notes as well as its own: What's new shows only the installed Release's notes (`src/whatsNew/decide.ts`), and no user ever installed the refused one.

## Troubleshooting

| Failure | Fix |
| --- | --- |
| `Version mismatch between package.json (A) and release (B)` | the tag and `package.json` differ: tag the bump's merge commit, as the `release` skill does |
| lint or tests fail in Release Validation | run `npm run lint` and `npm test` locally on the tagged commit |
| `Manifest version (A) doesn't match release (B)` | `manifest.json` was not bumped with `package.json` |
| `... has no manifest.json at its root` | the zip step changed: it must zip the contents of `dist/`, not the folder |
| `Repository variables not set: ...` | [`GITHUB_ENVIRONMENTS.md`](GITHUB_ENVIRONMENTS.md), step 9 |
| 🔑 Authenticate to Google Cloud fails | [`GITHUB_ENVIRONMENTS.md`](GITHUB_ENVIRONMENTS.md), Troubleshooting |
| the store refuses a call | the job summary holds Google's message verbatim |
| `The GitHub Release of vX.Y.Z already holds another prompt-library-extension-vX.Y.Z.zip` | two rare causes first: an earlier upload of this run was cut off (an empty zip of that name, state `starter`): delete it, then Re-run failed jobs; or the tag has a second Release, such as a leftover draft: delete the leftover, then Re-run failed jobs. Otherwise the tag run was rerun with Re-run all jobs; the GitHub Release keeps the first run's zip. If the first run's Submission submitted it, nothing is left to redo. If that Submission uploaded it but its publish call failed, the zip is a draft in the Developer Dashboard, which this run can no longer submit: submit it from the Dashboard's **Package** tab. If it uploaded nothing, delete the zip from the GitHub Release, then Re-run failed jobs: the new zip, attested by this attempt, is attached and then submitted |
| `Could not list the GitHub Releases, so whether vX.Y.Z already holds a ... is unknown` | a GitHub API call failed (an outage, a rate limit); nothing was changed: Re-run failed jobs |

## Checklist

- [ ] The bump PR is merged, its checks green (`release` skill, steps 1 to 5).
- [ ] The tag is the bump's merge commit, pushed (`release` skill, step 6).
- [ ] The run's GitHub Release holds `prompt-library-extension-vX.Y.Z.zip`.
- [ ] The owner approved `chrome-webstore`; the Submission job is green and its summary says the version is in Store review.
- [ ] Google's e-mail reports the Store review; on approval the Developer Dashboard shows the version published.
