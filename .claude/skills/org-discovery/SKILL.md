---
name: org-discovery
description: >
  Search the GitHub organization for existing solutions, libraries, patterns, and expertise
  before building something new. Uses live gh CLI searches to find reusable repos, code,
  ADRs, and internal experts. Use when designing epics, planning new features, evaluating
  build-vs-reuse, or answering "has someone already built this?" questions. Also trigger
  when users ask about prior art, tech stack decisions, architecture reviews, "who has
  experience with X", "is there a shared library for X", or build-vs-buy evaluations.
  Do NOT use for searching within the current repo (use Grep/Glob instead).
allowed-tools: Bash Read Grep Glob
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Org Discovery

Search the GitHub organization to find existing solutions before building.

## Minimize shell invocations

**Batch all `gh` CLI calls into as few shell invocations as possible.**
Target 2-3 shell invocations for the entire workflow:

1. **One call** for all live searches (Step 2)
2. **One call** for deep dives (Step 3)
3. **One optional call** for fetching ADRs or docs discovered in Step 3

### Shell syntax rules

- Use `;` (not `&&`) between `gh` commands — so one failure doesn't kill
  the chain. A 403 rate-limit on one search must not abort the rest.
- Use `&` + `wait` to parallelize `gh api` calls (5000/hr limit — safe).
- Keep `gh search code` calls **sequential** with `sleep 1` between them
  (GitHub code search: 10 requests/minute for authenticated users).
- Always add `2>/dev/null` to `gh api` calls to suppress 404 noise.

## Prerequisites

- `gh` CLI authenticated with org access (`gh auth status`)
- Network access to GitHub API

## Configuration

The skill reads org name from `.claude/config/project.yaml`
under `github.base_url`. Extract the org from the URL (e.g.,
`https://github.com/Sanofi-Accelerator/sanofi-ai-standards` → `Sanofi-Accelerator`).

If no config exists, ask the user for their GitHub org name.

---

## Step 1: Understand the Ask

The user provides one of:
- A **feature description** (e.g., "I need per-conversation RAG with pgvector")
- A **design doc path** to analyze (read it and extract technologies/patterns)
- A **technology question** (e.g., "who already uses Docling in our org?")

### Extract search concepts

Extract 3-5 **search concepts** from the input:
- Technologies (pgvector, Docling, Redis, SST)
- Patterns (RAG, chunking, embedding, vector search)
- Domain terms (document processing, authentication, slide generation)
- Libraries (markItDown, Titan v2, Hono)

### Expand concepts with synonyms and alternatives

For each concept, also identify:
- **Generic category** — pgvector → "vector database", "vector search"
- **Related patterns** — pgvector → "embedding", "similarity search", "nearest neighbor"
- **Alternative implementations** — pgvector → "pinecone", "qdrant", "faiss"

Use the expanded terms to broaden search recall. Not every synonym needs its
own `gh search code` call — pick the 2-3 highest-value expansions per concept
to stay within rate limits.

### Adapt search strategy to the query type

| Query type | Search emphasis |
|------------|----------------|
| "Who uses X?" | Dependency files + PR authors + CODEOWNERS |
| "Is there a solution for Y?" | Repo search + README scanning + ADR hunting |
| "I'm designing feature Z" | Broad concept search + ADRs + design docs |
| "Tech stack decision" | Dependency files + ADRs + repo topics |

---

## Step 2: Live Search

**Batch everything into ONE shell command.** Use `;` between calls and
`sleep 1` between `gh search code` calls. Repo and issue searches use
the REST API (5000/hr) so they can run without sleeps.

### 2a. Repo and issue search (REST API — no rate limit concern)

Search for repos by name/description and issues/PRs for discussion context.
These are high-signal and cheap:

```bash
echo '=== REPO SEARCH ===' ; \
gh search repos --owner=<ORG> "keyword1 OR keyword2" --json fullName,description,updatedAt --limit 10 ; \
echo '=== ISSUE/PR SEARCH ===' ; \
gh search issues --owner=<ORG> "keyword1" --json repository,title,url,updatedAt --limit 10 ; \
gh search issues --owner=<ORG> "keyword2" --json repository,title,url,updatedAt --limit 10
```

Repo search catches projects whose name or description matches even if the
exact term isn't in any source file. Issue/PR search surfaces RFCs, discussions,
and decisions that never made it into code or docs.

### 2b. Code search per concept (rate-limited — sequential with sleeps)

For each of the top 3-5 concepts, search code and docs:

```bash
echo '=== CONCEPT: pgvector ===' ; \
gh search code --owner=<ORG> "pgvector" --json repository,path,textMatches --limit 10 ; sleep 1 ; \
gh search code --owner=<ORG> "pgvector" --path=docs --json repository,path --limit 5 ; sleep 1 ; \
echo '=== CONCEPT: chunking ===' ; \
gh search code --owner=<ORG> "chunking" --json repository,path,textMatches --limit 10 ; sleep 1 ; \
echo '=== CONCEPT: embedding ===' ; \
gh search code --owner=<ORG> "embedding" --json repository,path,textMatches --limit 10 ; sleep 1
```

### 2c. Dependency search

Search dependency manifests for the primary technology terms. Cover the
org's most common ecosystems:

```bash
echo '=== DEPENDENCY SEARCH ===' ; \
gh search code --owner=<ORG> "pgvector" --filename=package.json --json repository,path --limit 5 ; sleep 1 ; \
gh search code --owner=<ORG> "pgvector" --filename=pyproject.toml --json repository,path --limit 5 ; sleep 1 ; \
gh search code --owner=<ORG> "pgvector" --filename=requirements.txt --json repository,path --limit 5 ; sleep 1 ; \
gh search code --owner=<ORG> "pgvector" --filename=go.mod --json repository,path --limit 5 ; sleep 1 ; \
gh search code --owner=<ORG> "pgvector" --filename=pom.xml --json repository,path --limit 5
```

### 2d. AI-ready repos

```bash
echo '=== AI-READY REPOS ===' ; \
gh search code --owner=<ORG> "AGENTS" --filename=AGENTS.md --json repository,path --limit 30 ; sleep 1 ; \
gh search code --owner=<ORG> "CLAUDE" --filename=CLAUDE.md --json repository,path --limit 30
```

### 2e. Process results

- Deduplicate results by repository
- Track how many search concepts each repo matched (used for relevance scoring)
- Note which repos have AGENTS.md or CLAUDE.md (AI-ready) — prioritize for deep dives
- **Prioritize ADR and design doc hits.** An ADR about "Vector DB Selection"
  is worth more than finding the word "vector" in a source file — it tells
  you WHY a team chose a technology and what alternatives were evaluated.
  Surface these prominently in the report.

---

## Step 3: Deep Dive Top Matches

For the top 3-5 matching repos (prioritize AI-ready ones and those matching
the most concepts), fetch context.

**Batch all deep dive calls into ONE shell command.** `gh api` calls use
the REST API (5000/hr limit) — safe to parallelize with `&` + `wait`.

```bash
ORG="<ORG>"

for REPO in repo1 repo2 repo3; do
  (
    echo "=== $REPO ===" ;
    echo "--- Repo Metadata ---" ;
    gh api repos/$ORG/$REPO --jq '{description,pushed_at,archived,stargazers_count,open_issues_count,topics,language}' 2>/dev/null ;
    echo "--- AGENTS.md ---" ;
    gh api repos/$ORG/$REPO/contents/AGENTS.md --jq '.content' 2>/dev/null | base64 --decode | head -400 ;
    echo "--- CLAUDE.md ---" ;
    gh api repos/$ORG/$REPO/contents/CLAUDE.md --jq '.content' 2>/dev/null | base64 --decode | head -400 ;
    echo "--- README.md ---" ;
    gh api repos/$ORG/$REPO/contents/README.md --jq '.content' 2>/dev/null | base64 --decode | head -80 ;
    echo "--- docs/ ---" ;
    gh api repos/$ORG/$REPO/contents/docs --jq '.[].name' 2>/dev/null ;
    echo "--- docs/adr/ ---" ;
    gh api repos/$ORG/$REPO/contents/docs/adr --jq '.[].name' 2>/dev/null ;
    echo "--- docs/epics/ ---" ;
    gh api repos/$ORG/$REPO/contents/docs/epics --jq '.[].name' 2>/dev/null ;
    echo "--- CODEOWNERS ---" ;
    gh api repos/$ORG/$REPO/contents/CODEOWNERS --jq '.content' 2>/dev/null | base64 --decode ;
    echo "--- Tech Stack ---" ;
    gh api repos/$ORG/$REPO/contents/package.json --jq '.content' 2>/dev/null | base64 --decode | head -30 ;
    gh api repos/$ORG/$REPO/contents/sst.config.ts --jq '.name' 2>/dev/null ;
    gh api repos/$ORG/$REPO/contents/pyproject.toml --jq '.name' 2>/dev/null ;
    gh api repos/$ORG/$REPO/contents/.github/workflows --jq '.[].name' 2>/dev/null ;
    echo "--- Recent PRs ---" ;
    gh pr list --repo $ORG/$REPO --state merged --limit 5 --json author,title 2>/dev/null ;
    echo ""
  ) &
done
wait
```

This runs all repo deep dives **in parallel** (one subshell per repo).

### Follow internal references

Scan the fetched AGENTS.md/README.md content for links to other docs:
- Markdown links: `[text](docs/adr/...)`, `[text](docs/epics/...)`
- File references: `@docs/...`, `references/...`
- ADR mentions: `ADR-001`, `docs/adr/*.md`

If filenames from docs/adr/ listings match search concepts (e.g.,
`vector-db-selection.md`, `rag-pipeline-design.md`), fetch those in one
more batched call. ADRs capture WHY decisions were made, not just what
was built.

---

## Step 4: Synthesize Report

### Relevance scoring

Before writing the report, score each discovered repo:

| Signal | Weight |
|--------|--------|
| Number of search concepts matched (out of total) | High |
| Match location: ADR/design doc > dependency file > source code > README mention | High |
| Activity: `pushed_at` within last 6 months | Medium |
| AI-ready: has AGENTS.md or CLAUDE.md | Medium |
| Compatible tech stack (same framework/language as current project) | Medium |
| Archived or stale (no commits in 12+ months) | Negative |

Use these scores to order repos within each section (highest relevance first)
and to decide which section a repo belongs in.

### Report template

```markdown
# Org Discovery Report
> Query: "{user's original ask}"
> Org: {org name} | Date: {now}

## Direct Solutions
Repos that solve the exact problem or a very close variant.

For each:
- **[repo-name](url)** — {what it does}
  - Relevance: {N}/{total} concepts matched | Last active: {date} | Stack: {language/framework}
  - Why it matters: {specific connection to the user's ask}

### Example entry
- **[rag-service](https://github.com/Org/rag-service)** — Document ingestion and retrieval pipeline using pgvector
  - Relevance: 4/5 concepts matched | Last active: 2 weeks ago | Stack: Python/FastAPI
  - Why it matters: Implements the exact chunking + embedding + vector search pipeline described in the ask. Has ADR on chunk size selection.

## Reusable Components
Repos with partial overlap — specific files, constructs, or patterns
that could be copied or adapted.
For each: name, specific file/path, what to reuse, compatibility notes.

## Related Work
Repos touching the same domain or technology, useful for learning
how similar problems were approached.
For each: name, what's relevant, key differences.
Flag any archived or stale repos with a warning.

## Internal Expertise
People and teams who have worked on similar technology.
From CODEOWNERS and recent PR authors on matching repos.
Include the repo context so the user knows what to ask them about.

## Key Discussions
Notable issues, PRs, or RFCs found during search that provide
decision context — especially those discussing alternatives or tradeoffs.

## Recommendations
- What to reuse vs. build from scratch (with rationale)
- Who to talk to before starting
- ADRs or design docs to read first
- Risks of not reusing (duplicate effort, inconsistency)
- Any tech stack compatibility concerns
```

---

## Integration with /design-epic

When used as part of the `/design-epic` workflow, this skill runs before
designing. The report output should be incorporated into the design
document's "Alternatives Evaluated" section, citing specific repos and
patterns discovered.

---

## Troubleshooting

### gh not installed or not authenticated
Run `gh auth status` to verify authentication. If not authenticated:
```bash
gh auth login
```
If `gh` is not installed, the user needs to install it first:
```bash
brew install gh  # macOS
```

### Rate limiting (HTTP 403 / 422)

| API              | Limit                  | Used by                              |
|------------------|------------------------|--------------------------------------|
| Code Search      | 10 req/min (authed)    | `gh search code`                     |
| REST API         | 5,000 req/hr (authed)  | `gh api`, `gh search repos/issues`, `gh pr list` |

**Code search** is the bottleneck. The `sleep 1` between calls keeps you
safely under 10/min for 3-5 concepts. If you have more concepts, increase
to `sleep 2` or split into two batched shell calls.

**REST API** is effectively unlimited for our use case. Parallelize freely
with `&` + `wait` (Step 3 deep dives). Repo search, issue search, and
`gh api` calls all use this pool.

If you hit a 403 despite sleeps, check remaining quota:
```bash
gh api rate_limit --jq '.resources.code_search'
```

Wait until `reset` timestamp, then resume. Because we use `;` (not `&&`),
a 403 on one search does NOT abort the rest.

### No results found
- Broaden search terms (use synonyms and generic categories from Step 1)
- Check if the org name is correct
- Try searching with different term variations (e.g., "vector" vs "pgvector")
- Search issues/PRs — discussion may exist even without code
- The org may genuinely not have existing work in this area — that's a valid finding worth stating explicitly
