# Privacy Policy Summary - My Prompt Manager

A summary of [the full privacy policy](./privacy-policy.md) for Release 2.0.0. Where the two differ, the full policy applies.

## What the developer receives

**Nothing.** There is no account and no server. The extension sends nothing to the developer or to anyone else: no telemetry, no analytics service, no crash reports, no ads.

## What stays on your device

- **Read where it works, not kept:** the keys you press and the text in the chat box, to notice `//` and for Undo, and the page's structure, to place the Prompts button.
- **Stored:** your Prompts, Categories and preferences, the Site settings and Custom sites, and the usage history that the Analytics section counts, in Chrome's local storage (`chrome.storage.local`), which Chrome does not sync. Short-lived state goes in `chrome.storage.session`, emptied when Chrome closes.
- **Analytics is local:** it is computed on your device from the usage history (which Prompt, its Category, the site and the time of each insertion, never the Prompt's text) and shows the last 30 days. Older entries are removed at each insertion, each time Chrome starts and when the extension is updated, and the history never holds more than 10,000. In 2.0.0 itself, older entries stay stored until an insertion made while the history holds 9,000 entries or more removes them.
- **Element picker:** its description of the element you pick is stored with the site. It holds the page's full address, the element's identifiers and attributes, and, for an element with little text, its first 50 characters, which can be the start of a draft in the chat box.

## What leaves your device

The extension itself sends nothing. These leave only through you:

- A Prompt you insert into a chat: the site then handles it as anything you type there.
- A Share code (one Prompt) or a configuration code (one Custom site, with the Element picker's description), made only when you click Share or Export, compressed but not encrypted.
- A Backup file of your Prompts and Categories, made only when you click Export in Settings.

What the extension shows inside a site's page, such as the titles and Categories of your Prompts in the Prompt selector, can be read by that site's own scripts, and any website can tell that the extension is installed.

## Permissions

- **`storage`:** keeps the data above on your device.
- **`activeTab`:** Chrome lets the extension act on the tab you are on when you click its toolbar icon. In side panel mode, that click adds the Prompts button to the tab, only on a site the extension already has access to; on any other site, it leaves the page untouched.
- **`tabs`:** reads tab addresses, to find the tabs that show a Platform or a site you added, and the current tab's title, to offer it when you add a site. Never sent anywhere.
- **`sidePanel`:** opens the extension in Chrome's side panel.
- **`scripting`:** adds the extension's own packaged script to the tabs of the Platforms and of the sites you allowed.
- **Host permissions:** the addresses of the seven Platforms: `https://claude.ai/*`, `https://chatgpt.com/*`, `https://gemini.google.com/*`, `https://www.perplexity.ai/*`, `https://chat.mistral.ai/*`, `https://copilot.microsoft.com/*`, `https://m365.cloud.microsoft/*`. The extension works on the first five. Microsoft Copilot is not supported in this version: Microsoft now redirects `copilot.microsoft.com` to copilot.com, and a work account to copilot.cloud.microsoft, two addresses this version does not run on.
- **Optional `https://*/*` and `http://*/*`:** never granted at install; Chrome asks you for one site at a time, when you add a site or use the Element picker on it.

## Your control

- Delete any Prompt or Category, clear the usage history in Analytics, or use Clear All Data in Settings.
- Export a Backup file in JSON at any time, and restore it from Settings.
- Uninstalling the extension makes Chrome delete what it stored in Chrome's storage. The Element picker's log in a page's own session storage goes when that tab closes.

**Full policy:** https://github.com/spartDev/My-Prompt-Manager/blob/main/privacy-policy.md
