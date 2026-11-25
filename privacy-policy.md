# Privacy Policy for My Prompt Manager

**Effective Date:** 24/08/2025  
**Last Updated:** 25/11/2026

This policy describes My Prompt Manager 2.0.0: what the extension stores, where, for how long, and what can leave your device. Every statement in it can be checked in the source code (see [Check it yourself](#check-it-yourself)).

## In short

- **No account, no server.** My Prompt Manager has no sign-in and no server of its own. It sends nothing to the developer or to anyone else: no telemetry, no usage analytics, no crash reports, no ads.
- **Everything stays on your device.** What the extension keeps is in Chrome's storage on your computer, which Chrome does not sync, but for a short log that the Element picker leaves in the page you use it on, where that site can read it (see [The page's own session storage](#the-pages-own-session-storage)).
- **Analytics is local.** The Analytics section counts your insertions on your device, from a usage history kept in that same local storage. Nothing about your use is sent anywhere.
- **You decide what leaves.** The extension itself sends nothing. A Prompt you insert in a chat goes to that site, as anything you type there does. What the extension shows inside a site's page, such as the titles and Categories of your Prompts in the Prompt selector, can be read by that site's own scripts (see [The chat sites](#the-chat-sites)). A Share code, a configuration code or a Backup file leaves your device only where you put it.

## What the extension stores on your device

### Chrome's local storage

The extension keeps its data in `chrome.storage.local`, on your computer, until you delete it or uninstall the extension. It never uses `chrome.storage.sync`, so Chrome Sync does not copy any of it to your Google account or your other devices.

- **Your Library:** each Prompt's title, content and Category, when it was created and last changed, whether it is pinned, how many times you inserted it and when you last did; your Categories, with their names and colors.
- **Your preferences:** the theme, the sort order, whether the extension opens in the side panel or as a popup, and whether Notifications show.
- **Site settings:** which Platforms you turned on or off, the Custom sites you added (address, name, on or off, when you added it, and where the Prompts button goes on each, with the Element picker's description of the element: see [Element picker](#element-picker)), and the Debug mode switch.
- **The sites you allowed:** the addresses of the sites you gave the extension access to.
- **The Prompts button's placement on the Platforms:** for a Platform where the button could not find its usual place in the chat box, a note of it, and, if you then showed the button where to go with the Element picker, that element's description.
- **Your usage history:** see [Usage history and Analytics](#usage-history-and-analytics).
- **What's new and the Welcome:** the Release you installed, the last Release whose What's new you closed, and where you are in the Welcome (its step and the Packs you selected) or that you finished it.

### Chrome's session storage

Short-lived state is kept in `chrome.storage.session`, which Chrome empties when it closes: where the Prompts button was placed in each open tab of a Platform, the progress of the Element picker (the tab and window it works in), and a Review on its way from the full-page Analytics view to the side panel (which Prompts to review).

### The page's own session storage

While you use the Element picker on a site, it keeps a log of its last 50 picks and warnings (the element's selector and tag, the site's address and the page's address, the time) in that page's `sessionStorage`. That storage belongs to the site: the site's own scripts can read it, and the browser empties it when the tab closes. Apart from the page's own addresses and elements, which the site already knows, it tells the site's scripts that you used the Element picker there, when, and on which element.

## Usage history and Analytics

Each time you insert a Prompt into a chat, the extension adds one entry to its usage history: the Prompt's ID (not its text), its Category, the Platform it went into (or the address of the Custom site), and the time. It also adds one to the Prompt's use count and updates its last use. The usage history is stored in `chrome.storage.local` like the rest, and only the Analytics section reads it.

Analytics counts only the entries of the last 30 days. It is computed on your device; no analytics service is involved and nothing is sent anywhere.

### How long the usage history is kept

The usage history is not emptied on a schedule: entries older than 30 days stay in storage. Only an insertion made while the history holds 9,000 entries or more first removes the entries older than 30 days; older entries then pile up again until the history holds 9,000 once more. The history never holds more than 10,000 entries: when it would, the oldest go first. Deleting a Prompt does not remove its entries. **Clear history** in Analytics removes the whole history at once, older entries included, but Analytics offers it only while the last 30 days have entries; **Clear All Data** in Settings, which deletes your Library too, always removes it.

## Element picker

The Element picker lets you show where the Prompts button goes: on a Custom site, or on a Platform where the button could not find its usual place. When you click an element, the extension's script in that page describes the element so that the button can find it again, and passes the description to the rest of the extension, inside Chrome. The description holds:

- the element's tag, type and role, its identifiers and labels (`id`, `name`, `data-testid`, `data-id`, `aria-label`, `placeholder`), up to 10 of its other attributes (`data-`, `aria-` and a few framework ones) with their whole values, up to 5 of its class names, the tag, `id` and `data-testid` of the element that holds it, its position among its siblings, and a CSS selector that points to it;
- the full address of the page you picked on, including any part after `?` or `#`;
- when the element's text is under 200 characters, its first 50 characters. If you pick the chat box, or the box around it, while it holds a draft, these can be the first 50 characters of your draft. To keep a draft out of it, pick while the chat box is empty. A page that copies your draft into one of the chat box's attributes puts it in the description whole, in those attributes and in the CSS selector; picking while the chat box is empty keeps it out there too.

Values that look sensitive (containing words such as password, token, key, account, session or card) are left out of those identifiers, of the other attributes kept and of the text. The CSS selector is not filtered by value: it can hold the element's `id`, or the value of one of its `data-` attributes, even one that contains session, auth, api, csrf or nonce. An element whose attributes contain password, token, key, account, card or a few other such words cannot be picked at all, nor can fields that the page marks as password, e-mail, phone, payment or one-time-code fields. When you click on a site whose address matches a short list of patterns (addresses containing .bank, .gov, .tax, medical, healthcare or insurance, and those of some banks, brokers, crypto exchanges and payment services), the picker turns itself off instead of describing the element; the list does not recognize every such site.

The description is stored in `chrome.storage.local`: with the Custom site in the Site settings, or with the Platform's placement. It stays on your device, with one exception that you control: a Custom site's configuration code (see [Share codes, configuration codes and Backup files](#share-codes-configuration-codes-and-backup-files)) contains it whole, so whoever has the code can read that page address and that text.

## What the extension reads on a site

The extension has access to the seven Platforms listed under [Permissions](#permissions), and works on five of them: Microsoft Copilot is not supported in this version (see the host permissions there). It also works on the sites you add and allow. On any page that opens at Copilot's two addresses, its script still loads and looks for a chat box, as on the other Platforms. On each of these sites, while the site is turned on in Settings:

- it reads the page's structure to find the chat box and its toolbar, and places the Prompts button there;
- of what you write, it reads only the chat box: the text just before your cursor, to notice `//`, and the text in the box around an Insertion, to check that the Prompt went in and to put the earlier text back if you click Undo. It keeps this in memory, never stores it, and never sends it;
- when you use the Element picker, it describes the element you click, as above.

On a site you turned off, the extension's script stays idle. It does not read your browsing history, and it does not run on sites you have not allowed.

## What leaves your device

### Network

The extension makes no network request of its own. The only requests in its code read files from its own package (its content script and a font). There is no account, no server, no remote code: every script is in the package, and the extension's pages may run only the package's own scripts (`script-src 'self'`). The help links in Settings (the GitHub repository, its issues and its documentation) open GitHub in a new tab when you click them.

### The chat sites

When you insert a Prompt, it goes into the site's chat box as if you had typed it. From there, the site handles it as it handles anything you type in its chat box, under its own privacy policy. The Prompts button, the Prompt selector and the confirmation of an Insertion are drawn inside the site's page, so the site's own scripts can read what they show, as they can read anything in that page: while the Prompt selector is open, the titles and Categories of the Prompts it lists and what you type in its search field, and, while you fill in a Prompt's Variables, that Prompt's whole text.

### Any site you visit

Any website can tell that My Prompt Manager is installed: so that its script can load on the Platforms and on the sites you add, the extension lets every page load some of its files (the parts of that script and its font), and a page can ask Chrome for one of them to see whether it is there. Those files are the extension's own code and font: they hold nothing about you.

### Share codes, configuration codes and Backup files

These are made only when you ask for one, and they leave your device only through you.

- **Share code:** made when you click Share on a Prompt, and copied to your clipboard. It holds the Prompt's title, content and Category name, compressed into text but not encrypted: whoever has the code can read the Prompt.
- **Configuration code:** made when you click Export on a Custom site, and copied to your clipboard (or shown in a field for you to copy, when Chrome blocks the clipboard). It holds the site's address and name and where the Prompts button goes, including the Element picker's description of the element (the page address, up to 50 characters of the element's text, and its attributes, as above). It is compressed, not encrypted.
- **Backup file:** made when you click Export in Settings, and saved as a file on your computer: where you choose, or in your downloads. It holds your Prompts (with their use counts and dates) and your Categories, in JSON. It does not hold the usage history, your preferences, the Site settings or the Custom sites. A Backup is restored only from a file you pick.

The extension writes to your clipboard only when you click Copy, Share or Export, and never reads your clipboard: you paste a code into its field yourself.

## Permissions

The extension asks for these permissions in its `manifest.json`, and uses each for the following only.

| Permission | What the extension uses it for |
| --- | --- |
| `storage` | Keeps what [What the extension stores on your device](#what-the-extension-stores-on-your-device) lists, in `chrome.storage.local`, and short-lived state in `chrome.storage.session`. The extension sends nothing it stores anywhere. |
| `activeTab` | When you click the extension's icon in Chrome's toolbar, Chrome lets the extension act on the tab you are on until you leave it. With the extension set to open in the side panel, that click adds the Prompts button to the tab if it is missing there, and only on a site the extension already has access to through its host permissions (the Platforms below and the sites you allowed). On any other site, the click leaves the page untouched. |
| `tabs` | Lets the extension read the address of your open tabs, to know which show a Platform or a site you added: each time a tab loads a page, to add the extension's script if the page is on one of them, to add the Prompts button to the tabs already open when the extension is installed or updated or when you add a site, to send them a theme change, to bring the right tab forward when you use the Element picker, and to remember where the button was placed in each tab until the tab leaves the site or closes. It also reads the address and title of the tab you are on, to offer that site when you add one in Settings. Tab addresses and titles are never sent anywhere. |
| `sidePanel` | Opens the extension in Chrome's side panel, so your Library stays open beside the chat (Settings can switch it to a popup), and lets the Review buttons of the full-page Analytics view open the side panel on the Prompts to review. |
| `scripting` | Adds the extension's own script, the one that shows the Prompts button and opens the Prompt selector on `//`, to a tab: to the tabs already open when the extension is installed or updated or when you add a site, to the tab where you start the Element picker, to each page you open on a Custom site (which the manifest cannot list), and to the current tab when you click the toolbar icon in side panel mode. Only on the Platforms and the sites you allowed. The script is part of the extension's package: no code is downloaded. |

Host permissions: each is there so that the extension can show the Prompts button in that Platform's chat box, open the Prompt selector on `//`, and insert the Prompt you pick. Microsoft Copilot is not supported in this version: Microsoft now redirects `copilot.microsoft.com` to copilot.com, and a work account from either Copilot to copilot.cloud.microsoft, two addresses this version does not run on.

| Host permission | Platform | In this version |
| --- | --- | --- |
| `https://claude.ai/*` | Claude | Works |
| `https://chatgpt.com/*` | ChatGPT | Works |
| `https://gemini.google.com/*` | Google Gemini | Works |
| `https://www.perplexity.ai/*` | Perplexity | Works |
| `https://chat.mistral.ai/*` | Mistral LeChat | Works |
| `https://copilot.microsoft.com/*` | Microsoft Copilot | Not supported: Microsoft now redirects this address to copilot.com, which this version does not run on. |
| `https://m365.cloud.microsoft/*` | Microsoft 365 Copilot | Not supported: Microsoft redirects a work account from here to copilot.cloud.microsoft, which this version does not run on. |

Optional host permissions: never granted at install, and asked for one site at a time. Chrome asks you first, and the extension works on that site only if you accept.

| Optional host permission | When the extension asks for it |
| --- | --- |
| `https://*/*` | When you add a site in Settings, by hand or from a configuration code, or start the Element picker on a site that is not a Platform. |
| `http://*/*` | When you start the Element picker on a site served over `http` rather than `https`. |

The extension does not ask for access to all sites: beyond the addresses of the seven Platforms, its host permissions cover only the sites you allow one by one.

## Your control over your data

- **Delete:** delete any Prompt or Category at any time, clear the usage history with **Clear history** in Analytics (offered while the last 30 days have entries), or use **Clear All Data** in Settings, which removes everything the extension keeps in `chrome.storage.local` except the What's new and Welcome records (so that What's new and the Welcome do not show again).
- **Export:** save a Backup file of your Prompts and Categories whenever you like, in JSON, and restore it from Settings.
- **Site access:** removing a Custom site, or Clear All Data, leaves the extension idle on that site but does not take back the access Chrome gave it there. To take it back, use the extension's Site access in Chrome's extension details (`chrome://extensions`).
- **Uninstall:** uninstalling the extension makes Chrome delete its local and session storage, and with them everything listed above, but for the Element picker's log in a page's own session storage, which goes when that tab closes. Backup files and codes you made stay wherever you put them.

## Children's Privacy

Nothing the extension stores reaches the developer, whatever the user's age: the developer receives no information from anyone through the extension.

## Privacy laws

The developer does not receive, hold or process any data from the extension: there is no server and no account. What the extension stores stays on your device, where you can export it or delete it at any time, as described above.

## Changes to This Privacy Policy

When this policy changes, its "Last Updated" date changes. Every earlier version is in the history of this file in the extension's public repository: https://github.com/spartDev/My-Prompt-Manager/commits/main/privacy-policy.md

## Contact Information

If you have any questions about this Privacy Policy or our privacy practices:

**Developer:** Thomas Roux  
**Email:** thomas.roux@gmail.com  
**GitHub:** https://github.com/spartDev  
**Chrome Web Store:** https://chromewebstore.google.com/detail/my-prompt-manager

## Check it yourself

The extension's source code is public: https://github.com/spartDev/My-Prompt-Manager. You can check this policy against it, against Chrome's DevTools (the Network panel of the extension's pages and service worker, and its storage under Application), and against the extension's details in `chrome://extensions`.

| Statement | Where to look |
| --- | --- |
| The permissions and host permissions | `manifest.json` |
| The files any website can load, which tell it the extension is installed | `manifest.json` (`web_accessible_resources`) |
| The Prompt selector, drawn inside the site's page | `src/content/selector/controller.ts` |
| The Library and preferences in `chrome.storage.local` | `src/services/storage.ts` |
| The Site settings and Custom sites | `src/services/siteSettings.ts` |
| The Prompts button's placement on the Platforms | `src/services/iconPlacementRepairs.ts` |
| The usage history, and how long it is kept | `src/services/UsageTracker.ts` |
| The Element picker and its description of an element | `src/content/modules/element-picker.ts`, `src/content/utils/element-fingerprint.ts` |
| Share codes and configuration codes | `src/services/promptEncoder.ts`, `src/services/configurationEncoder.ts` |
| Backup files | `src/components/settings/DataStorageSection.tsx` |
| Clear All Data | `src/services/clearStorage.ts` |
| Where the script is added to a tab, and the only two network requests | `src/background/background.ts`, `src/content/selector/font.ts` |
