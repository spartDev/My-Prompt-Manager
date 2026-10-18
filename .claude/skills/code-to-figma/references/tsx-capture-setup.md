<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# TSX / React capture setup

Use when the user gives a **`.tsx` or `.jsx` component** (the most common case). Figma still ingests **rendered HTML** via `capture.js` — you serve a page that mounts the component, not the raw source file.

## Resolution flow

When the user names a component file (e.g. `MyCard.tsx`):

1. **Source** — the component or capture-page TSX (source of truth for UI).
2. **Capture entry** — an HTML shell that mounts it (create if missing):
   - Prefer `index.html` beside the TSX in the same directory, or the project's existing Vite/Next entry for a preview route.
3. **Server root** — directory where the dev/build server runs (component folder or app root).
4. **Serve command** — from `package.json` (see below).

Do **not** duplicate the component as static HTML markup unless the project has no bundler and no practical way to mount the TSX.

## Capture entry (`index.html`)

Minimal Vite-style shell — no early `capture.js`; the TSX loads it **after** React mounts:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Capture — Figma</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/<your-capture-page>.tsx"></script>
  </body>
</html>
```

## Capture hook in TSX (post-mount)

**Critical:** `capture.js` must run **after** the component has rendered. Do not put `capture.js` with `defer` in `index.html` for React — it will often capture an empty `#root`.

In the capture-page TSX, after `createRoot(...).render(...)`:

```tsx
import { useEffect } from "react";

const CAPTURE_SCRIPT_URL =
  "https://mcp.figma.com/mcp/html-to-design/capture.js";

function startFigmaCaptureAfterMount() {
  const params = new URLSearchParams(globalThis.location.search);
  const captureId = params.get("figmaCaptureId");
  if (!captureId) return;

  const endpoint = `https://mcp.figma.com/mcp/capture/${captureId}/submit`;
  globalThis.location.hash =
    `#figmacapture=${encodeURIComponent(captureId)}` +
    `&figmaendpoint=${encodeURIComponent(endpoint)}` +
    "&figmadelay=2000" +
    "&figmaselector=" +
    encodeURIComponent("#figma-capture-root");

  const script = document.createElement("script");
  script.src = CAPTURE_SCRIPT_URL;
  document.body.appendChild(script);
}

function App() {
  useEffect(() => {
    startFigmaCaptureAfterMount();
  }, []);
  return <YourCapturePage />;
}
```

Wrap captured UI in `#figma-capture-root` (or omit `figmaselector` to capture `body`).

## Serving

| Situation | Command |
| --------- | ------- |
| **Standalone fixture** (TSX + `index.html` in one folder) | `npm run capture:serve` — `vite build && vite preview` |
| **Existing Vite/React app** | Reuse `npm run dev` or add `"capture:serve": "vite build && vite preview --port 8765 --strictPort"` |
| **Next.js / other** | Use the project's preview command; discover from `package.json` |

**Prefer production preview** (`build` + `preview`) for capture — more reliable than dev HMR.

Bind to **`127.0.0.1`** in Vite config so Chrome and `open` resolve consistently:

```ts
preview: { host: "127.0.0.1", port: 8765, strictPort: true },
```

## Chrome URL (step 7)

Query param only — the TSX sets the hash and loads `capture.js` after mount:

```bash
open -a "Google Chrome" 'http://127.0.0.1:8765/?figmaCaptureId=<UUID>'
```

Wait **~10s** after load before polling (2s `figmadelay` + React hydration + serialization).

## Existing app route

If the component already renders in the app (Storybook, `/preview`, etc.):

1. Add the post-mount capture hook to that preview page or a thin wrapper route.
2. Serve via the app's dev/preview command.
3. Open the preview URL with `?figmaCaptureId=<UUID>`.

## Example fixture

`test-fixtures/code-to-figma/` — `demo-component-capture.tsx`, `index.html`, `capture:serve` script.

## Troubleshooting empty Figma frames

- **Blank Figma page** — `capture.js` ran before React painted. Move script injection to `useEffect` after mount; use `capture:serve` not raw `serve` on dev-only assets.
- **Pending forever** — Chrome did not load the page; verify `127.0.0.1:<port>` returns 200; do not reuse a consumed capture ID.
- **Static `.html` duplicate** — outdated; rebuild from TSX, do not maintain parallel markup.
