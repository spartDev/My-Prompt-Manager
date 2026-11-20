# Chrome Web Store setup: Google Cloud, Developer Dashboard and GitHub

`release.yml` submits each Release to the Chrome Web Store through the Chrome Web Store API V2 (`scripts/chrome-web-store.mjs`). It holds no store secret: the job that calls the store runs in the GitHub environment `chrome-webstore`, which only the owner approves, and trades its GitHub OIDC token for a short-lived Google access token through Workload Identity Federation. That token belongs to a Google Cloud service account that the Developer Dashboard links to the publisher. This guide builds each piece, once, in order:

1. a Google Cloud project with the Chrome Web Store API enabled;
2. a service account, with no role of its own;
3. a workload identity pool and an OIDC provider that admit only tokens from this repository's `chrome-webstore` environment;
4. the binding that lets those tokens act as the service account;
5. the service account, added to the publisher in the Developer Dashboard;
6. the `chrome-webstore` environment: the owner as its only required reviewer, deployments from `main` and tags `v*` only;
7. four repository variables, none of them secret.

Only the owner can run it: it needs the owner's Google account, publisher and repository admin rights. The path the workflow then follows is in [`RELEASE_WORKFLOW.md`](RELEASE_WORKFLOW.md).

**Before you start**

- [gcloud](https://cloud.google.com/sdk/docs/install), signed in as the owner: `gcloud auth login`.
- [gh](https://cli.github.com/), signed in as the owner, with admin rights on the repository: `gh auth status`.
- The owner's Google account has 2-step verification on: the store requires it to publish or update an item.
- Pools, providers and IAM bindings take up to 5 minutes to apply. Wait that long before the rehearsal of step 10.

Every block below runs as is in a terminal, or with `!` in a Claude Code session. A `!` command does not keep the shell's variables, so each block starts by reading the values file of step 0.

## 0. The values file

Write the names once, outside the repository. Fill in `PROJECT_ID` at step 1 and the two store IDs at step 7; the others can stay as they are.

```sh
mkdir -p ~/.config/my-prompt-manager
cat > ~/.config/my-prompt-manager/cws-setup.sh <<'EOF'
PROJECT_ID="<project-id>"        # step 1
PUBLISHER_ID="<publisher-id>"    # step 7
EXTENSION_ID="<extension-id>"    # step 7
REPO="spartDev/My-Prompt-Manager"
SA_NAME="chrome-webstore-release"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
POOL_ID="github"
PROVIDER_ID="my-prompt-manager"
EOF
```

Edit the file with any editor when a step asks for a value. None of these values is a secret, but none belongs in the repository either.

## 1. The Google Cloud project

Reuse the project created in 2025 for the store API, if it still exists. List the projects with their creation date, and check which one has the Chrome Web Store API enabled:

```sh
gcloud projects list --format="table(projectId, name, createTime)"
gcloud services list --enabled --project "<project-id>" --filter="config.name=chromewebstore.googleapis.com"
```

If none is left, create one (a project ID is 6 to 30 lowercase letters, digits and hyphens, unique across Google Cloud):

```sh
gcloud projects create "<project-id>" --name "My Prompt Manager releases"
```

Put the project ID in `PROJECT_ID` in the values file.

## 2. Enable the APIs

The Chrome Web Store API, and the APIs Workload Identity Federation goes through: IAM, Resource Manager, Service Account Credentials (which mints the access token) and Security Token Service (which trades the GitHub token).

```sh
. ~/.config/my-prompt-manager/cws-setup.sh
gcloud services enable \
  chromewebstore.googleapis.com \
  iam.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  --project "$PROJECT_ID"
```

## 3. The service account

It needs no Google Cloud role: its access to the store comes from the Developer Dashboard (step 6).

```sh
. ~/.config/my-prompt-manager/cws-setup.sh
gcloud iam service-accounts create "$SA_NAME" \
  --project "$PROJECT_ID" \
  --display-name "Chrome Web Store releases (GitHub Actions)"
gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID" --format "value(email)"
```

The second command prints the account's e-mail: the same as `SA_EMAIL` in the values file.

## 4. The workload identity pool and its provider

The provider admits a GitHub token only when it comes from this repository, named by its numeric ID (a deleted repository's name can be taken again, its ID cannot), and from a job in the `chrome-webstore` environment. Any other token is refused before it reaches the service account.

```sh
. ~/.config/my-prompt-manager/cws-setup.sh
REPO_ID="$(gh api "repos/$REPO" --jq .id)"
gcloud iam workload-identity-pools create "$POOL_ID" \
  --project "$PROJECT_ID" \
  --location global \
  --display-name "GitHub Actions"
gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
  --project "$PROJECT_ID" \
  --location global \
  --workload-identity-pool "$POOL_ID" \
  --display-name "My Prompt Manager releases" \
  --issuer-uri "https://token.actions.githubusercontent.com" \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.environment=assertion.environment" \
  --attribute-condition "assertion.repository_id == '${REPO_ID}' && assertion.environment == 'chrome-webstore'"
```

## 5. Let the provider act as the service account

The binding names one subject: the `sub` claim GitHub gives a job of this repository in the `chrome-webstore` environment. Its form depends on the repository's OIDC settings; read them:

```sh
. ~/.config/my-prompt-manager/cws-setup.sh
gh api "repos/$REPO/actions/oidc/customization/sub"
gh api "repos/$REPO/actions/oidc/customization/sub" --jq '.sub_claim_prefix + ":environment:chrome-webstore"'
```

The first line prints the settings, the second the subject the binding below names.

- `use_default` must be `true`. With `false`, the repository builds its subject from a template of its own (`include_claim_keys`) and the subject printed is wrong: turn the template off (`gh api -X PUT "repos/$REPO/actions/oidc/customization/sub" -F use_default=true`), then read the settings again.
- `use_immutable_subject` gives the form of the subject:
  - `false`, GitHub's default form for a repository created before 2026-07-15: `repo:spartDev/My-Prompt-Manager:environment:chrome-webstore`, and `sub_claim_prefix` is `repo:spartDev/My-Prompt-Manager`;
  - `true`, the immutable form, for a repository created after 2026-07-15, one that opted in, and one renamed or transferred after that date: the owner's and the repository's numeric IDs follow their names, `repo:spartDev@<owner-id>/My-Prompt-Manager@<repo-id>:environment:chrome-webstore`, and `sub_claim_prefix` is the part before `:environment:`.

Either way the subject is `sub_claim_prefix` followed by `:environment:chrome-webstore`. Grant it `roles/iam.workloadIdentityUser` on the service account:

```sh
. ~/.config/my-prompt-manager/cws-setup.sh
POOL_NAME="$(gcloud iam workload-identity-pools describe "$POOL_ID" --project "$PROJECT_ID" --location global --format "value(name)")"
SUBJECT="$(gh api "repos/$REPO/actions/oidc/customization/sub" --jq '.sub_claim_prefix'):environment:chrome-webstore"
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project "$PROJECT_ID" \
  --role "roles/iam.workloadIdentityUser" \
  --member "principal://iam.googleapis.com/${POOL_NAME}/subject/${SUBJECT}"
```

`POOL_NAME` has the form `projects/<project-number>/locations/global/workloadIdentityPools/github`.

**A rename or a transfer of the repository** changes the subject: the new name, and after 2026-07-15 the immutable form too. The binding then names a subject GitHub no longer gives, and 🔑 Authenticate to Google Cloud fails with `Permission 'iam.serviceAccounts.getAccessToken' denied`. Update `REPO` in the values file, run this step again, then remove the old binding, `<old-subject>` being the one it named:

```sh
. ~/.config/my-prompt-manager/cws-setup.sh
POOL_NAME="$(gcloud iam workload-identity-pools describe "$POOL_ID" --project "$PROJECT_ID" --location global --format "value(name)")"
gcloud iam service-accounts remove-iam-policy-binding "$SA_EMAIL" \
  --project "$PROJECT_ID" \
  --role "roles/iam.workloadIdentityUser" \
  --member "principal://iam.googleapis.com/${POOL_NAME}/subject/<old-subject>"
```

The provider of step 4 needs no change: it names the repository by its ID, which a rename or a transfer keeps.

## 6. Add the service account in the Developer Dashboard

In the [Developer Dashboard](https://chrome.google.com/webstore/devconsole), signed in as the publisher's owner, open the **Account** section, and add the service account's e-mail (printed at step 3) under service accounts. A publisher holds one service account at a time.

This link is what lets the service account manage the publisher's items; without it every call answers 403.

## 7. The publisher ID and the extension ID

- **Publisher ID**: in the Developer Dashboard, **Publisher > Settings**. With more than one publisher, switch to this one first.
- **Extension ID**: the item's 32 letters, on its **Package** tab in the Developer Dashboard, or on `chrome://extensions` with Developer mode on.

Put both in the values file.

## 8. The GitHub environment `chrome-webstore`

The owner is its only required reviewer, and may approve the runs they start (`prevent_self_review` stays false). Only `main` and tags `v*` may deploy to it: a manual run on another branch skips the store job.

```sh
. ~/.config/my-prompt-manager/cws-setup.sh
OWNER_ID="$(gh api user --jq .id)"
gh api -X PUT "repos/$REPO/environments/chrome-webstore" --input - <<EOF
{
  "reviewers": [{ "type": "User", "id": ${OWNER_ID} }],
  "prevent_self_review": false,
  "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true }
}
EOF
```

```sh
. ~/.config/my-prompt-manager/cws-setup.sh
gh api -X POST "repos/$REPO/environments/chrome-webstore/deployment-branch-policies" -f name=main -f type=branch
gh api -X POST "repos/$REPO/environments/chrome-webstore/deployment-branch-policies" -f name='v*' -f type=tag
```

Check it: one reviewer, the owner, and the two policies.

```sh
. ~/.config/my-prompt-manager/cws-setup.sh
gh api "repos/$REPO/environments/chrome-webstore" \
  --jq '{reviewers: [.protection_rules[] | select(.type == "required_reviewers") | .reviewers[].reviewer.login], deployment_branch_policy}'
gh api "repos/$REPO/environments/chrome-webstore/deployment-branch-policies" --jq '.branch_policies[] | "\(.type) \(.name)"'
```

The environment holds no secret.

## 9. The four repository variables

| Variable | Value |
| --- | --- |
| `CWS_WORKLOAD_IDENTITY_PROVIDER` | the provider's full name, `projects/<project-number>/locations/global/workloadIdentityPools/github/providers/my-prompt-manager` |
| `CWS_SERVICE_ACCOUNT` | the service account's e-mail |
| `CWS_PUBLISHER_ID` | the publisher ID |
| `CWS_EXTENSION_ID` | the extension ID |

```sh
. ~/.config/my-prompt-manager/cws-setup.sh
PROVIDER_NAME="$(gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --project "$PROJECT_ID" --location global --workload-identity-pool "$POOL_ID" --format "value(name)")"
gh variable set CWS_WORKLOAD_IDENTITY_PROVIDER --repo "$REPO" --body "$PROVIDER_NAME"
gh variable set CWS_SERVICE_ACCOUNT --repo "$REPO" --body "$SA_EMAIL"
gh variable set CWS_PUBLISHER_ID --repo "$REPO" --body "$PUBLISHER_ID"
gh variable set CWS_EXTENSION_ID --repo "$REPO" --body "$EXTENSION_ID"
gh variable list --repo "$REPO"
```

`release.yml` reads them as `vars.*`. A store job whose variables are missing fails at its first step and names them.

## 10. Rehearse

A manual run of `release.yml` on `main` is the rehearsal: it builds and attests the zip, extracts the Release notes, and makes one read-only status call to the store. It creates no GitHub Release and submits nothing.

```sh
. ~/.config/my-prompt-manager/cws-setup.sh
gh workflow run release.yml --repo "$REPO" --ref main
```

The **🔎 Chrome Web Store Status** job then waits for approval: open the run in GitHub, **Review deployments**, tick `chrome-webstore`, **Approve and deploy**. Its log and the run's summary show the published version, and what a Submission of the zip would do (for the version already published: send nothing). Every job ends green; the GitHub Release and the Submission are skipped.

## Troubleshooting

| Where it fails | What it says | Cause |
| --- | --- | --- |
| 🔑 Authenticate to Google Cloud | the credential is rejected by the attribute condition | the job is not in the `chrome-webstore` environment, or the repository ID in the condition is wrong (step 4) |
| 🔑 Authenticate to Google Cloud | `Permission 'iam.serviceAccounts.getAccessToken' denied` | the binding of step 5 is missing, not applied yet (wait 5 minutes), or names another subject: after a rename or a transfer of the repository, or since `use_immutable_subject` turned `true` (step 5) |
| 🔑 Authenticate to Google Cloud | an API is not enabled | step 2 |
| the store call, HTTP 403 | `The caller does not have permission` | the service account is not added in the Developer Dashboard (step 6), or the publisher ID is not this publisher's |
| the store call, HTTP 403 | `SERVICE_DISABLED` | the Chrome Web Store API is off in the project (step 2) |
| the store call, HTTP 404 | not found | the publisher ID or the extension ID is wrong (step 7) |

The job summary holds Google's message verbatim. If Google refuses the federated token itself for the Chrome Web Store API, stop: the fallback is a JSON key for the service account, decided with the owner, and this guide does not set it up.

## Later: the old repository secrets

The repository secrets `CHROME_CLIENT_ID`, `CHROME_EXTENSION_ID` and `CHROME_WEB_STORE_API_KEYS` (set in 2025 for the old API) stay as a fallback until 2.0.0 is published through `release.yml`. Nothing reads them. Then, with the owner's go:

```sh
gh secret delete CHROME_CLIENT_ID --repo spartDev/My-Prompt-Manager
gh secret delete CHROME_EXTENSION_ID --repo spartDev/My-Prompt-Manager
gh secret delete CHROME_WEB_STORE_API_KEYS --repo spartDev/My-Prompt-Manager
```

## References

- [Use the Chrome Web Store API](https://developer.chrome.com/docs/webstore/using-api): the publishing workflow, the publisher ID and the item ID.
- [Chrome Web Store API reference](https://developer.chrome.com/docs/webstore/api).
- [Use a service account with the Chrome Web Store API](https://developer.chrome.com/docs/webstore/service-accounts).
- [Introducing a new Chrome Web Store API](https://developer.chrome.com/blog/cws-api-v2): V2, and the end of V1 on 2026-10-15.
- [google-github-actions/auth](https://github.com/google-github-actions/auth): Workload Identity Federation through a service account, and its security considerations.
- [GitHub: OpenID Connect reference](https://docs.github.com/en/actions/reference/security/oidc) (the `sub` claim, its default and immutable forms), [the REST API for a repository's OIDC subject](https://docs.github.com/en/rest/actions/oidc), [OpenID Connect claims](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/about-security-hardening-with-openid-connect) and [deployment environments](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment).
