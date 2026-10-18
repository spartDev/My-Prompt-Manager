---
name: engineering-docs
description: >
  Search the Sanofi Engineering Portal (code.sanofi.com) for authoritative guidance on
  engineering standards, processes, and patterns. Fetches the portal index from llms.txt,
  identifies the most relevant pages for the user's question, and retrieves their content.
  Use when users ask about Sanofi engineering standards, CI/CD, GitHub, AWS, certificates,
  networking, languages, testing, secrets, observability, open-source policy, or any
  "how do we do X at Sanofi?" question.
  Do NOT use for GitHub org code search — use org-discovery instead.
allowed-tools: WebFetch(https://code.sanofi.com/*)
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Engineering Docs Search

Search the Sanofi Engineering Portal at [code.sanofi.com](https://code.sanofi.com) to answer questions about engineering standards and practices.

## Workflow

### Step 1 — Load the portal index

Fetch the portal's llms.txt index to get the full list of available pages:

```
WebFetch: https://code.sanofi.com/llms.txt
```

This returns a structured list of all pages with their titles and `.md` URLs, organized by section (Onboarding, Build, Test, Deploy, Integrate, Run, etc.).

### Step 2 — Identify relevant pages

From the index, select the **3–5 most relevant pages** for the user's question by matching:

- **Keywords** — language, tool, service, or concept names from the question
- **Section** — e.g., "Deploy" for AWS/cloud questions, "Build" for CI/CD/language questions, "Test" for testing/security questions
- **Specificity** — prefer the most specific page over a parent index page

**Selection rules:**
- Pick leaf pages (e.g., `/build/ci-cd/actions/index.md`) over category pages (e.g., `/build/ci-cd/index.md`) unless the category page itself has the answer
- When the question is broad (e.g., "how do I set up Python?"), pick the setup guide; when narrow (e.g., "uv virtual environments"), pick the specific sub-page
- Maximum 5 pages per invocation to keep responses focused

### Step 3 — Fetch page content

Fetch each selected page URL using `WebFetch`. The URLs follow the pattern:
```
https://code.sanofi.com/<section>/<topic>/index.md
```

Fetch pages in parallel when possible.

### Step 4 — Synthesize the answer

From the fetched content:

1. **Answer the question directly** using the authoritative content from the portal
2. **Quote key guidance** verbatim when it is a policy or constraint (e.g., "All repositories must use `npm ci` in CI/CD")
3. **Link back** to the source pages so the user can read the full context
4. **Note gaps** if the portal doesn't cover the question — suggest checking Confluence or the team repo

## Output format

```
## Answer

<direct answer to the question>

## From the Engineering Portal

### [Page Title](https://code.sanofi.com/...)
<key guidance from this page>

### [Page Title](https://code.sanofi.com/...)
<key guidance from this page>

---
Sources: [Page 1](url), [Page 2](url)
```

## When to stop

- If the index fetch fails (network issue, portal down), tell the user and suggest browsing https://code.sanofi.com directly
- If no pages in the index match the question, say so clearly rather than returning unrelated content
- Never fabricate portal content — only report what was fetched
