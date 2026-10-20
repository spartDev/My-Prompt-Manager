<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Review Mode Workflow

## R1. Fetch the ADR

Obtain the ADR content from the source provided by the user:

- **Confluence URL**: Resolve the page (including tiny URLs) and fetch content via MCP.
  Also fetch all inline and footer comments and their reply threads.
- **Local file path**: Read the file directly.
- **Jira ticket**: Fetch the ticket and look for linked Confluence pages containing the ADR.

If the user provides a Confluence URL, also fetch comments:

```text
mcp__confluence: getConfluencePageInlineComments cloudId:"{cloudId}" pageId:"{id}"
mcp__confluence: getConfluencePageFooterComments cloudId:"{cloudId}" pageId:"{id}"
mcp__confluence: getConfluenceCommentChildren cloudId:"{cloudId}" commentId:"{id}" commentType:"inline"
```

## R2. Run the MADR Review Checklist

Evaluate the ADR against the review checklist from the skill's SKILL.md (including S13 —
Architecture Manifesto Alignment). For each item, assign a verdict: Pass, Fail, or Partial.

For the manifesto check, fetch the Architecture Manifesto page:

```text
mcp__confluence: getConfluencePage cloudId:"{cloudId}" pageId:"60467430731" contentFormat:"markdown"
```

Compare the ADR's decision and consequences against the 10 manifesto principles. Flag
any principle where the decision creates tension (e.g., a decision that increases cost
creates tension with Principle 10 — Frugality).

Present the results as a table.

## R3. Fact-Check Technical Claims

For each technical claim in the ADR (capabilities, limitations, pricing, compatibility):

1. Identify the vendor/technology referenced.
2. Fetch the relevant official documentation using `Bash` with `curl`.
3. If cost claims are made, query pricing APIs using `Bash` where possible.
4. Compare the ADR's claim against the documentation.
5. Report: confirmed (with doc reference), refuted (with doc reference), or unverifiable.

This step is iterative. Findings in one pass may raise new questions requiring additional
research. Continue until all significant claims are verified or flagged.

## R4. Review Comment Threads (if Confluence)

For each inline or footer comment thread:

1. Summarize the exchange.
2. Assess coherence: Does the reply actually address the reviewer's question?
3. Flag threads where the reply talks past the question, deflects, or leaves the
   concern unresolved.
4. Draft suggested reply text for unresolved threads if the user requests it.

## R5. Produce the Review Output

Write a local review file at `docs/adr/ADR-NNN-slug-review.md` (matching the ADR's number
and slug) containing:

1. **Template Compliance** — MADR checklist results.
2. **Content Quality** — strengths and gaps.
3. **Technical Accuracy** — fact-check results with documentation references.
4. **Comment Thread Analysis** — coherence assessment (if Confluence source).
5. **Comparison Table** — if the ADR compares options, produce a color-coded summary table.
6. **Cost Analysis** — if infrastructure costs are relevant, produce a cost annex with data
   from vendor pricing APIs (see `cost-analysis.md` reference).
7. **Recommendations** — numbered list of specific, actionable improvements.

## R6. Offer Follow-Up Actions

After presenting the review, offer:

- Draft suggested text for specific sections that need improvement.
- Draft reply text for unresolved Confluence comment threads.
- Post the review as a footer comment on the Confluence page.
- Create a local ADR file incorporating the suggested improvements.
