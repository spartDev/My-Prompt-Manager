<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Atlassian Integration — ADR-Specific

This reference covers Atlassian interactions specific to ADR writing and review.
Generic MCP bootstrap and Confluence query patterns are handled by the agent's
built-in Atlassian MCP tools and do not need to be documented here.

## Fetching an ADR from Confluence

When the user provides a Confluence URL for an ADR to review:

1. Resolve the page ID (including tiny URLs via base64 decoding).
2. Fetch the page content in markdown format.
3. Also fetch all comment threads — these often contain unresolved reviewer concerns
   that the review should address:

```text
mcp__confluence: getConfluencePageInlineComments cloudId:"{cloudId}" pageId:"{id}"
mcp__confluence: getConfluencePageFooterComments cloudId:"{cloudId}" pageId:"{id}"
mcp__confluence: getConfluenceCommentChildren cloudId:"{cloudId}" commentId:"{id}" commentType:"inline"
```

## Fetching Context from Jira

When an ADR is linked to a Jira ticket, fetch the ticket to extract:

- The problem statement (from the ticket description)
- Acceptance criteria (may imply decision drivers)
- Linked Confluence pages that may contain the ADR or related architecture docs

```text
mcp__confluence: getJiraIssue cloudId:"{cloudId}" issueIdOrKey:"{PROJ-123}"
```

## Confluence Tiny URLs

Confluence tiny links use the format `wiki/x/{encoded}`. Decode them with:

```bash
python3 -c "
import base64
encoded = '{encoded_part}'
padding = 4 - (len(encoded) % 4) if len(encoded) % 4 != 0 else 0
padded = encoded + '=' * padding
decoded = base64.b64decode(padded)
page_id_be = int.from_bytes(decoded, byteorder='big')
page_id_le = int.from_bytes(decoded, byteorder='little')
print(f'Big-endian: {page_id_be}')
print(f'Little-endian: {page_id_le}')
"
```

Try both byte orders with `getConfluencePage`. If both fail, search Confluence by
keywords from the decision topic. If still unresolved, ask the user for the numeric
page ID.

## Fact-Checking with Vendor Documentation

When an ADR makes claims about a specific technology's capabilities or limitations,
verify them against official documentation:

1. **Fetch vendor docs** using `Bash` with `curl` to retrieve relevant documentation
   pages.
2. **Query pricing APIs** using `Bash` when cost claims are made (see
   `cost-analysis.md` for vendor-specific approaches).
3. **Quote exact text** from documentation to support or refute claims in the ADR.
4. **Flag unverifiable claims** — if a claim cannot be confirmed from official sources,
   note it as "unverified" in the review.
