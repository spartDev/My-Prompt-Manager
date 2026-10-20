<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Cost Analysis

Use this reference when an ADR involves infrastructure, cloud services, or tooling with
variable pricing — applies to both write mode (Cost Annex) and review mode (cost verification).

## Methodology

1. **Identify the cost-bearing components** from the ADR's considered options. For each
   option, list every service, license, or resource that incurs cost.

2. **Research pricing for each component** — search for the official pricing page or API
   of whatever vendor or tool is being evaluated. Use `Bash` with `curl` or `WebFetch`
   to retrieve the relevant pricing data. Always cite the source URL and retrieval date
   (pricing pages change without notice).

3. **Build comparison tables** showing costs across configurations (e.g., instance sizes,
   worker counts, number of environments). Each row should trace back to a cited source.

4. **Model multi-scenario projections** (e.g., 5, 10, 15 teams) to show how costs scale.
   Choose scenarios that match the decision drivers in the ADR.

5. **Provide both wide-format and long-format tables** — wide for readability, long for
   Confluence Chart macro compatibility.

6. **Include a Confluence Chart macro snippet** if the user intends to publish to Confluence:

   ```text
   {chart:type=bar|title=Cost Comparison|yLabel=Monthly Cost (USD)}
   || || Option A || Option B ||
   | Scenario 1 | 1000 | 2000 |
   {chart}
   ```

## Source Requirements

- Every cost figure must cite its origin (pricing page URL, API query, or vendor quote).
- When a pricing API is available, prefer it over static page scraping.
- When no public pricing exists (e.g., enterprise-negotiated rates), note the figure as
  "estimate — confirm with vendor" and flag it in the review.
