---
name: code-to-figma
description: >-
  Push code/UI to Figma via html-to-design (Chrome + capture.js + plugin-figma-figma MCP). Guides the user
  through choosing what to capture, new vs existing Figma file, preparing a capture page from
  TSX/JSX or HTML, mandatory human review, then serve, Chrome, and poll. Triggers: code to Figma,
  push code to Figma, html-to-design, figmaCaptureId, capture HTML, code-to-canvas. Do NOT use for
  Figma-to-code or file:// URLs.
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Code to Figma

Figma ingests pages through **`capture.js`** on **`mcp.figma.com`** (html-to-design). There is **no file upload API**. **`file://` does not work** — the page must be served over **HTTP**. Use **Google Chrome** on the user's machine.

## Prerequisites

**Required MCP:** `plugin-figma-figma` — the **Figma plugin** MCP server (not installed by ai-standards). Must expose **`generate_figma_design`** and **`create_new_file`**.

- **Cursor:** install the plugin with `/add-plugin figma` in agent chat, then Connect/OAuth in MCP settings
- **Claude Code:** `claude plugin install figma@claude-plugins-official`

If `plugin-figma-figma` is missing or any MCP call fails, **STOP** and ask the user to install/connect the Figma plugin before continuing.

Also required:

- Network access to **`https://mcp.figma.com`**
- **Google Chrome** (or give the user the URL to open manually)

---

## Invocation

Use this skill when the user asks to push code/UI to Figma, mentions html-to-design, or references `figmaCaptureId` / capture HTML.

Optional hints from the user (still ask for anything missing):

| Hint | Meaning |
| ---- | ------- |
| `<component-or-tsx-or-html-path>` | Component name, `.tsx`/`.jsx` path, or `.html` path |
| `--figma-url <url>` | Existing Figma design file |
| `--new-file` | Create a new Figma file |

Follow the workflow below **in order**. Do not skip user questions or the review gate.

---

## Workflow overview

Follow these steps **in order**. Do not skip user questions or the review gate.

| Step | What | Stop if |
| ---- | ---- | ------- |
| 1 | What to capture | User has not named component(s) or file path(s) |
| 2 | Figma destination | User has not chosen new vs existing file |
| 3 | Prepare capture page | Entry missing or needs edits — author first |
| 4 | **Human review** | User has not explicitly approved the push |
| 5–8 | Push to Figma | Only after step 4 approval |

---

## Step 1 — What to capture?

Ask the user:

> **Which component(s) or page(s) do you want to push to Figma?**

Accept any of:

- **`.tsx` / `.jsx` file paths`** (most common — e.g. `src/components/MyCard.tsx`)
- Component or UI names (resolve to TSX/JSX or HTML in the project)
- Explicit **`.html`** paths (e.g. `docs/preview.html`)
- "Everything in …" — then discover and list candidates

If unclear, discover and present options:

```bash
find . \( -name '*.tsx' -o -name '*.jsx' -o -name '*.html' \) \
  -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/build/*' 2>/dev/null
```

**Multiple components:** confirm whether each gets its own capture page and capture run, or one combined page. Process **one capture at a time** unless the user explicitly wants a single multi-subject page.

Record for each target:

| Field | TSX/JSX (default) | Static HTML |
| ----- | ----------------- | ----------- |
| Display name | Component or page name | Page name |
| Source | `.tsx` / `.jsx` path | — |
| Capture entry | `index.html` or app preview route (create if missing) | `.html` path |
| Server root | App root or component fixture directory | HTML directory |
| Serve command | `capture:serve`, `npm run dev`, or project preview | `npx serve`, `python3 -m http.server` |

When the user gives a **`.tsx` path**, treat it as the source of truth and ensure a capture entry exists that **mounts** it (see [references/tsx-capture-setup.md](references/tsx-capture-setup.md)). Do not default to searching only for `.html` files.

---

## Step 2 — New Figma file or existing?

Ask the user:

> **Should this go into a new Figma file or an existing one?**

| Choice | What you need |
| ------ | ------------- |
| **Existing file** | Figma design URL → parse **`fileKey`**, optional **`nodeId`** (`node-id=X-Y` → `X:Y`) |
| **New file** | Suggest a **`fileName`** from the component/page name; confirm with user |

Do not mint a capture ID until steps 1–3 are done and step 4 is approved.

---

## Step 3 — Prepare capture page

Figma captures **rendered DOM**, not source files. Prepare the right entry for the target type.

### TSX / JSX (most common)

1. Identify or create a **capture entry** (`index.html` or an in-app preview route) that mounts the component via the project's bundler (usually Vite).
2. Add a **post-mount capture hook** in the capture-page TSX — load `capture.js` in `useEffect` **after** React renders (never in static `index.html` with `defer` alone).
3. Import production styles; wrap UI in `#figma-capture-root` when using `figmaselector`.
4. **Multi-viewport** (optional) — see [references/multi-viewport-capture-layout.md](references/multi-viewport-capture-layout.md).
5. Add or reuse **`capture:serve`** (`vite build && vite preview`) when no app preview exists.

Full pattern: [references/tsx-capture-setup.md](references/tsx-capture-setup.md). Example fixture: `test-fixtures/code-to-figma/`.

Do **not** duplicate TSX markup into a standalone static `.html` file unless the project cannot mount the component.

### Static HTML

For each target, ensure a capture-ready `.html` file exists:

- Confirm paths for CSS, fonts, and images work from the chosen server root
- Add bootstrap script + `capture.js` with the `defer` attribute (see _Authoring reference_ below)
- **Layer A** — subject markup faithful to the intended UI
- **Layer B** (optional) — labels, canvas, separators for readability in Figma

Tell the user what you created or changed (paths, summary, viewport layout, serve command).

---

## Step 4 — Human review (mandatory)

**Do not mint a capture ID, serve HTTP, open Chrome, or call `plugin-figma-figma` to push until the user explicitly approves.**

Present a review summary:

```markdown
## Ready to push to Figma — please review

**Target(s):** [names]
**Source:** [tsx path, or — for static HTML]
**Capture entry:** [index.html path or app preview URL]
**Server root:** [directory]
**Serve:** [e.g. npm run capture:serve]
**Destination:** [new file: <fileName> | existing: <figma URL>]

**Preview:** [URL without captureId, e.g. http://127.0.0.1:8765/]

Reply **approve** (or **yes**, **go**, **push**) to proceed, or describe changes first.
```

**STOP** and wait. If the user requests edits, return to step 3 and re-present review.

Only proceed when the user gives **explicit approval** to push.

---

## Step 5 — Mint capture ID (single-use)

After approval:

- **New file:** call **`create_new_file`** (load `figma-create-new-file` skill; resolve `planKey` via **`whoami`**), then **`generate_figma_design`** with the returned **`fileKey`**.
- **Existing file:** call **`generate_figma_design`** with **`fileKey`** (optional **`nodeId`**).

**Do not** pass `captureId` on the initial call. Copy the returned UUID. Handle **claim URL** if returned.

---

## Step 6 — Serve over HTTP

Check `package.json` for project scripts first.

| Target type | Preferred serve |
| ----------- | --------------- |
| **TSX / JSX** | `npm run capture:serve` or project `dev` / `preview` — **prefer production preview** (`build` + `preview`) |
| **Static HTML** | `npx --yes serve -l 8765 .` or `python3 -m http.server 8765` |

```bash
cd <server-root>
npm run capture:serve
# or: npm run dev / npm run preview
```

For Vite, bind **`127.0.0.1`** so Chrome resolves the server reliably.

---

## Step 7 — Open Chrome

**TSX / JSX** — query param only; the component sets hash and loads `capture.js` after mount:

```bash
open -a "Google Chrome" 'http://127.0.0.1:<port>/?figmaCaptureId=<UUID>'
```

**Static HTML** — query param or hash URL (see _Authoring reference_). Quote the URL on macOS (`&` breaks unquoted shells).

If using `npx serve` on a `.html` file, prefer the **extensionless** path — `serve` may strip query params on `.html` redirects.

**Keep the server running** until capture completes.

**Do not** use IDE Browser MCP for `http://localhost` — it often cannot reach host loopback.

---

## Step 8 — Poll until complete

Wait **~10–12 seconds** after load (longer for React preview), then call **`generate_figma_design`** with **`captureId`** and **`fileKey`** every **~5s** until **`completed`** (up to **~10** polls).

If stuck **`pending`**: verify Chrome loaded the page, React painted content (not blank `#root`), `capture.js` returned 200, capture ID was not reused.

**Empty Figma frames** — almost always `capture.js` ran before React mounted; fix per [references/tsx-capture-setup.md](references/tsx-capture-setup.md) and re-capture with a new ID.

---

## Step 9 — Report

Share the Figma link. For new files, note **`file_key`** for future captures. If multiple targets were queued, ask whether to continue with the next.

---

## Authoring reference

Use when creating or editing **static HTML** capture pages. For **TSX**, use [references/tsx-capture-setup.md](references/tsx-capture-setup.md) instead.

### Requirements

1. **Relative assets** — paths work from the HTTP server root
2. **Figma bootstrap** — read `figmaCaptureId` from query string, set location hash
3. **`capture.js`** — `https://mcp.figma.com/mcp/html-to-design/capture.js` (load with `defer`, after DOM is ready)
4. **Document height** — prefer `height: auto` unless full-viewport capture is intentional
5. **Optional root** — `#figma-capture-root` for subtree-only capture (`figmaselector` when supported)

### Minimal HTML shell (static only)

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Capture — Figma</title>
    <!-- link production stylesheets here -->
  </head>
  <body>
    <script>
      (function () {
        var params = new URLSearchParams(globalThis.location.search);
        var captureId = params.get('figmaCaptureId');
        if (!captureId) return;
        var endpoint =
          'https://mcp.figma.com/mcp/capture/' + captureId + '/submit';
        var delay = '8000';
        globalThis.location.hash =
          '#figmacapture=' +
          encodeURIComponent(captureId) +
          '&figmaendpoint=' +
          encodeURIComponent(endpoint) +
          '&figmadelay=' +
          delay;
      })();
    </script>

    <div id="figma-capture-root">
      <!-- subject UI to capture -->
    </div>

    <script
      defer
      src="https://mcp.figma.com/mcp/html-to-design/capture.js"
    ></script>
  </body>
</html>
```

### Optional presentation CSS (Layer B)

```css
:root {
  --figma-capture-page-bg: #f5f5f5;
  --figma-capture-label-color: #333;
  --figma-capture-divider: rgba(0, 0, 0, 0.12);
}
body {
  margin: 0;
  background: var(--figma-capture-page-bg);
}
.figma-capture-strip-label {
  font: 600 11px/1.2 system-ui, sans-serif;
  color: var(--figma-capture-label-color);
  margin: 0 0 0.75rem;
}
.figma-capture-viewport {
  box-sizing: border-box;
  overflow: visible;
}
```

### Multi-viewport layout

When one file shows the subject at multiple fixed widths: [references/multi-viewport-capture-layout.md](references/multi-viewport-capture-layout.md). Pick widths from the user or project.

### Capture goals

- **Layer A — Subject:** UI matches intended implementation; code is source of truth
- **Layer B — Presentation:** Optional non-semantic chrome; must not change subject layout
