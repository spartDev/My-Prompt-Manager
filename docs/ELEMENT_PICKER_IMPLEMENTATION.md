# Element Picker Implementation

The Element picker lets the user click the element of a page where the Prompts button goes: on a Custom site, and on a Platform whose Toolbar the chain no longer finds ("Place the icon"). Its safeguards against sensitive fields are in [ELEMENT_PICKER_SECURITY.md](./ELEMENT_PICKER_SECURITY.md).

## Problem solved

Chrome closes the action popup when it loses focus, so the popup cannot stay open while the user clicks in the page. In popup mode the picker therefore runs from a separate window, which stays open. The side panel stays open on its own.

## How a pick starts

`startElementPicker` in `src/hooks/usePickerWindow.ts` first asks for the host permission when the tab needs it (see [PROGRAMMATIC_INJECTION.md](./PROGRAMMATIC_INJECTION.md)), then:

- **In the side panel**: sends `START_ELEMENT_PICKER` for the active tab.
- **In the action popup**: sends `OPEN_PICKER_WINDOW` and closes itself. The service worker opens `src/popup.html` in a window of type `popup` (400 x 600, at 100, 100), with the URL parameters `picker=true`, `originalTabId`, `originalUrl` and `originalHostname`. The window opens on Settings (`src/App.tsx`, which skips the launch screen there). It does not start the picker: the user opens the form again and clicks Pick Element, and the window then sends `START_ELEMENT_PICKER` for `originalTabId`.
- **From "Place the icon"** (`src/hooks/useIconPlacementRepairs.ts`): sends `START_ELEMENT_PICKER` with the Platform's tab and a `repairHostname`, then closes the action popup.

"Add a custom site", in the "AI sites" group of `src/components/settings/SiteIntegrationSection.tsx`, is disabled on a site already integrated, except in the picker window. There, Manual Configuration opens `src/components/settings/AddCustomSiteForm.tsx` with the original tab's URL and a name filled in. The form's Custom Positioning card holds the Pick Element button, and a site saved with a selector gets the positioning mode `custom`.

## Key components

### Background script (`src/background/background.ts`)

- Manages picker sessions and window tracking: a session is kept in `chrome.storage.session` under `pickerSession:<tabId>`, and the picker window and its tab under `pickerWindow`, so a pick, and the picker window closing, survive the service worker stopping while the user hovers the page. A session is stored only once the picker is active in its tab, so a start that fails stores none; its changes run one after the other, a pick takes it in one step, and a stop removes only the sessions it saw. A stop also marks the starts still in flight (for the picker window closing, those in flight once it has read that the window closed was the picker window): each stores no session, and one that already sent its activation ends its picker, so a picker window closed before the page answered leaves no picker active. Of two starts on one tab, the session stored is the one of the last activation sent that the page answered, the one the page holds, whatever the order the answers come back in. Each start names its activation with its attempt, and the service worker's deactivations name the one they end: the page holds one picker per tab, so a deactivation sent for an earlier start leaves the picker of a later one active. It is forgotten when the page unloads (the content script sends `PICKER_CANCELLED` on `pagehide`, as it does on Escape; naming the start whose picker it cancels; it stops the starts still in flight in that tab, each ending its own picker, and ends that start's session or one of an activation sent no later than the latest of those it stopped, never one a later start stored in the tab since), and when the tab closes.
- Injects the content script into a tab that has none before it activates the picker.
- Brokers the messages between the extension pages and the content script, opens the picker window and focuses it again after a pick.

### Element picker module (`src/content/modules/element-picker.ts`)

- Highlights the element under the pointer: purple when it can be picked, red when it is blocked.
- Shows the hovered element's information in a box.
- On a click, builds the element's fingerprint (`src/content/utils/element-fingerprint.ts`), the identifier the content script places the button by, and a CSS selector as its fallback. The selector is the element's ID; else `tag[data-x="<value>"]` for its first `data-*` attribute the fingerprint keeps, a test id or a switch, if that selector is unique (the later ones are not tried); else its first two simple class names, if they are unique; else a path of up to five levels with `:nth-of-type`, which stops at the first ancestor whose ID it may use. An ID, the element's or an ancestor's, and a `data-*` attribute are used only when they pass the rules the fingerprint applies, so the selector holds no token, session id or draft the page copied into an attribute (`src/utils/pickedValues.ts`, and [ELEMENT_PICKER_SECURITY.md](./ELEMENT_PICKER_SECURITY.md), section 3).
- Sends `ELEMENT_SELECTED` with the fingerprint, the selector, the element type, the element information and the hostname, then deactivates.

### Settings (`src/hooks/usePickerWindow.ts`)

Reads the picker mode and the original tab from the URL parameters, starts the pick as above, and listens for `ELEMENT_PICKER_RESULT` to fill in the form's selector and fingerprint.

## Message flow

```
Pick Element in the form
→ side panel: START_ELEMENT_PICKER
  action popup: OPEN_PICKER_WINDOW, the window opens, Pick Element in it, START_ELEMENT_PICKER
→ service worker: injects the content script if needed, sends ACTIVATE_ELEMENT_PICKER { source: 'background', attempt }
→ the user clicks an element
→ content script: ELEMENT_SELECTED
→ service worker: ELEMENT_PICKER_RESULT to every extension page, then focuses the picker window
  (for "Place the icon": stores the pick as the Platform's override, and sends no result)
→ the form fills in its selector
```

Escape and `pagehide` send `PICKER_CANCELLED`; the service worker ends a picker with `DEACTIVATE_ELEMENT_PICKER`.

## Testing by hand

1. Run `npm run build` and load `dist/` unpacked in `chrome://extensions`.
2. Open a site that is not a Platform. On a Platform, "Add a custom site" is disabled ("Current site (claude.ai) is already integrated").
3. Open the extension, then Settings, "AI sites", "Add a custom site", Manual Configuration.
4. In Custom Positioning, click Pick Element. In the action popup, a window opens and the popup closes: open the form again in that window and click Pick Element there.
5. Click an element of the page: the selector shows in the form, and the window stays open.

Automated: `src/content/modules/__tests__/element-picker.test.ts`, `src/background/__tests__/background.placement.test.ts`, and `tests/e2e/content/element-picker.spec.ts` on the built extension. What a pick keeps: `src/content/modules/__tests__/element-picker-privacy.test.ts`, and `tests/e2e/content/custom-site-pick-privacy.spec.ts`, which picks on a Custom site with the real picker, from Pick Element to Export.
