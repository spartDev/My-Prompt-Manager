# Programmatic Content Script Injection

How the content script reaches a tab: what `manifest.json` grants, when the service worker injects the script itself (`ContentScriptInjector` in `src/background/background.ts`), and how a Custom site gets its host permission. Before this design the manifest held `<all_urls>` in `host_permissions` and in the content script's `matches`. Now it holds the Platforms' hosts, and the extension asks for any other site at run time.

## The manifest

- `host_permissions` and the `matches` of the one content script list the same seven hosts: claude.ai, chatgpt.com, gemini.google.com, www.perplexity.ai, chat.mistral.ai, copilot.microsoft.com and m365.cloud.microsoft. Chrome injects `src/content/index.ts` into them at `document_idle`, in the top frame only (`all_frames: false`). The seven Platforms of `src/config/platforms.ts` are on by default.
- `permissions`: `storage`, `activeTab`, `tabs`, `sidePanel`, `scripting`.
- `optional_host_permissions`: `https://*/*` and `http://*/*`. A Custom site's origin is requested from these at run time.
- `web_accessible_resources`, for `https://*/*` and `http://*/*`, lists by name pattern the chunks the content script imports. Chrome serves a chunk to a Custom site's page only if it is listed there, while crxjs lists every chunk for the Platforms' hosts itself. `npm run build` checks the list: `postbuild` runs `scripts/custom-site-chunks.mjs`, which fails on a chunk no pattern matches. `tests/e2e/content/custom-site-chunks.spec.ts` asks Chrome for each chunk.

**The hosts and permissions are pinned.** `src/test/guardrails/manifestHosts.test.ts` holds `host_permissions`, the `matches` and `permissions` equal to those of 1.9.0, the Release on the Chrome Web Store. If an update adds a host, or a permission that shows a warning, Chrome disables the extension for every user until each one accepts the change (ticket My-Prompt-Manager-totf). A change to these lists therefore needs the owner's decision. A new host is reached through the optional host permission the user grants, as ticket My-Prompt-Manager-j74b, still open, plans for copilot.cloud.microsoft.

## ContentScriptInjector

The service worker holds one `ContentScriptInjector`, named `injector`. It tracks tabs in `injectedTabs` (a `Set<number>`) and the injections in progress in `injectionPromises` (a `Map<number, Promise<void>>`).

### What calls it

- `chrome.tabs.onUpdated`, with `status: 'complete'` and a URL: `injectIfNeeded(tabId)`. `chrome.tabs.onRemoved` calls `cleanup(tabId)`, which forgets the tab.
- `chrome.runtime.onInstalled`, at an install and at an update: `injectIntoOpenTabs` (see [Site settings](#site-settings)).
- `chrome.action.onClicked`: `forceInjectContentScript(tab.id)`. Chrome fires this event only in side panel mode, the default, where `updateActionBehavior` sets the action's popup to `""`. A second `onClicked` listener opens the side panel. In popup mode Chrome opens the popup instead, and the click injects nothing.
- A `REQUEST_INJECTION` message: `forceInjectContentScript`. `handleRequestInjection` answers `success: true` once the call returns, even when the injection failed, because `forceInjectContentScript` reports a failure in its result instead of throwing.
- The Element picker: `forceInjectContentScript`, when the tab has no content script yet.

### What `injectIfNeeded` checks, in order

1. A second call for a tab that is already being injected gets the pending promise (`injectionPromises`).
2. A tab in `injectedTabs` is trusted on a Platform. On a Custom site, the page marker is read again, since a reload clears it.
3. `isRestrictedUrl` skips `chrome://`, `chrome-extension://`, `moz-extension://`, `edge-extension://`, `about:`, `data:`, `file://` and `ftp://` pages.
4. `shouldInjectForSite` checks the host permission first: `hasPermissionForHostname` asks `chrome.permissions.contains` for `https://<host>/*`, then `http://<host>/*`. Then it checks the Site settings: `isHostnameEnabled(await readSiteSettings(), hostname)` of `src/services/siteSettings.ts`, the same rule the content script applies when it starts.
5. `injectContentScript` checks the permission again and throws `No permission to inject into <host>` without it. It probes the tab (`canInjectIntoTab`), and when the probe fails (a restricted URL, a tab still loading, or a test script Chrome refuses) throws its own message, `Cannot inject into tab <id> for <host> - tab access denied`, not one of Chrome's. It reads the page marker (`isContentScriptInjected`), and only then runs `chrome.scripting.executeScript` with the loader file. The marker is `window.__promptLibraryInjected`, which `src/content/index.ts` sets. When the marker is missing, `isContentScriptInjected` also removes the icons and Prompt selectors an earlier injection left behind.

`_injectIfNeededInternal` swallows every failure. `forceInjectContentScript` skips steps 1, 2 and 4: it forgets the tab and calls `injectContentScript`, so the permission check, the probe and the marker still apply, and the probe's `canInjectIntoTab` refuses a restricted URL as step 3 does. It returns `{ success, error }`.

Whatever the caller, the click included, `injectContentScript` requires the host permission that `chrome.permissions.contains` reports. The click therefore injects on a Platform, or on a Custom site whose origin the user granted. Elsewhere it fails with the permission error.

### Site settings

The service worker decides whether a tab gets the content script from the Site settings, read with
`readSiteSettings()` and `isHostnameEnabled()` of `src/services/siteSettings.ts`, the same rule the
content script applies when it starts. The content script then follows the key in storage
(`onSiteSettingsChanged()`): it starts on its site when a change turns the site on, stops when one
turns it off, and starts over when the Custom site of its hostname changes. No surface sends the tabs
a message for it.

That needs a content script in the tab. A Platform's tabs get one from the manifest when they load,
on or off. A tab left open across an extension update while its Platform was off keeps only the old
script, which no longer receives storage changes. It gets a fresh one from a click on the extension
icon in side panel mode, or from an icon placement repair pick. Chrome runs the manifest's content
scripts only in pages loaded after the extension, so at a first install and at an update the service
worker injects one into each open tab of a site that is on (`injectIntoOpenTabs`, from
`chrome.runtime.onInstalled`): a chat open before the install answers `//` without a reload, as the
Welcome tells a new user it will.

Adding a Custom site asks the service worker to inject into its open tabs (`REQUEST_INJECTION` from
`AddCustomSiteForm`). Importing a site configuration does not, so its open tabs get the script on
their next page load. A Custom site that was off when its tab loaded has no script unless one was
injected since: in side panel mode (the default) a click on the extension icon injects one into its
tab, and so does the Element picker. Turning its switch back on injects nothing: a tab with no
content script starts on the next page load.

## Host permission for a Custom site

Each request goes through `src/hooks/useSitePermissions.ts`. `requestPermissionForOrigin` calls `chrome.permissions.request` and returns `false` on a refusal. After a grant it sends `REQUEST_PERMISSION`: the service worker requests the origins again, records them under `grantedPermissions` in `chrome.storage.local` (nothing reads that list), and runs `injectIfNeeded` on the matching tabs.

- **Adding a site** (`src/components/settings/AddCustomSiteForm.tsx`) requests `https://<host>/*`. On a refusal the form shows "Permission denied. Cannot add custom site without permission." and saves nothing.
- **Importing a configuration** (`handleConfirmImport` in `src/components/settings/SiteIntegrationSection.tsx`) requests the site's permission too. On a refusal it shows "Permission denied. Please allow access to the site and try again."
- **The Element picker** (`src/hooks/usePickerWindow.ts`) checks, then requests, `<protocol>//<host>/*` for a tab outside `BUILT_IN_ORIGINS`. That list holds claude.ai, chatgpt.com, www.perplexity.ai and chat.mistral.ai; the other three Platforms pass the check through the manifest's grant. On a refusal it throws "Permission denied. Please grant access to use the element picker on this site."
- **An icon placement repair pick** (`src/hooks/useIconPlacementRepairs.ts`) asks for no permission: it starts the picker on a Platform's tab.

Nothing watches for a permission the user revokes in Chrome: each injection asks `chrome.permissions.contains` again.

## The loader file

`injectContentScript` runs the loader the manifest names, the first file of its first content script (crxjs writes it as `assets/index.ts-loader-<hash>.js`). `getContentScriptFilename` fetches that file first. When the fetch fails it logs a warning and throws `STALE_BUILD_ERROR`, which asks the user to reload the extension in `chrome://extensions`.

Chrome reads the manifest once, when it loads the extension. A rebuild writes the loader under a
new hashed name, so until the extension is reloaded the manifest names a file that is gone; the
error asks for that reload (`tests/e2e/content/picker-stale-build.spec.ts`).

## Errors

`classifyInjectionError` sorts a failure by its message. `injectContentScript` logs by type, then rethrows every type:

| Type | The message holds | `injectContentScript` |
|---|---|---|
| `orphaned_tab` | `tab access denied`, within 10 s of the service worker's start (`ORPHANED_TAB_DETECTION_WINDOW_MS`) | logs nothing; adds the tab to `orphanedTabs` |
| `permission` | `No permission to inject into` | logs nothing |
| `tab_access_denied` | `tab access denied`, after those 10 s | `Logger.warn` |
| `network` | `interrupted by user` | logs nothing |
| `tab_closed` | `No tab with id` (the tab closed during the injection) | logs nothing |
| `security` | `violates CSP` | `Logger.error` |
| `unknown` | anything else, `STALE_BUILD_ERROR` included | `Logger.error` |

`forceInjectContentScript` classifies the error again for its `error` text. For `permission`, `orphaned_tab`, `tab_access_denied` and `tab_closed` it returns a message of its own and logs nothing more. For the other types it returns the error's message and logs it with `Logger.error`, so a `network` failure is logged once, and a `security` or `unknown` one twice.

## Tests

- `src/background/__tests__/background.injector.test.ts`: injection with and without the permission, restricted URLs, a Custom site on, off or malformed, `cleanup`, and the error classification.
- `src/background/__tests__/background.update.test.ts`: the injection into open tabs at an install and at an update, a Platform the user turned off left out, and a tab that already has the script left as it is.
- `src/test/guardrails/manifestHosts.test.ts`: the pinned hosts and permissions.
- `src/components/settings/__tests__/AddCustomSiteForm.test.tsx`: the permission request when a Custom site is added, and its refusal.
- On the built extension: `tests/e2e/content/injection.spec.ts` (the manifest's content script on the Platforms' stand-ins), `tests/e2e/content/custom-site-chunks.spec.ts` and `tests/e2e/content/picker-stale-build.spec.ts`.

No test covers the `onUpdated` and `onClicked` listeners, or the guard against concurrent injections.
