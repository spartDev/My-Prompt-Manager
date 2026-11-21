# Chrome Web Store Listing - My Prompt Manager 2.0

The text of the store listing for Release 2.0.0, in English. Paste each part into the field of the Chrome Web Store Developer Dashboard that its heading names, and save the draft without submitting it, before `release.yml` makes the Submission (`docs/CHROME_WEBSTORE_GUIDE.md`, Version Updates). The copy agrees with the store images: five screenshots, the small promo tile and the marquee.

## Summary

```text
Write a prompt once, then type // to insert it in Claude, ChatGPT, Gemini, Mistral, Perplexity or Copilot. Stays on your device.
```

128 characters. The limit is 132 ([Creating a great listing page](https://developer.chrome.com/docs/webstore/best-listing#item_summary): "132 characters or less").

The Dashboard cannot edit the summary. The store shows the `description` field of the uploaded package's `manifest.json` ([manifest `description`](https://developer.chrome.com/docs/extensions/reference/manifest/description): "no more than 132 characters"; [Prepare your extension](https://developer.chrome.com/docs/webstore/prepare#manifest): "After uploading your item, you won't be able to edit the metadata of your manifest in the developer dashboard"). The 2.0.0 package carries "Personal prompt library for AI platforms. Store, organize, and instantly insert your best prompts with one click." (113 characters). The summary above reaches the store with the first Release whose `manifest.json` description carries it.

## Detailed description

Store listing tab, Description. Plain text: the store shows no Markdown. Paste what is between the fences.

```text
Stop retyping your prompts. My Prompt Manager keeps the prompts you reuse in one Library and brings them into your AI chats: type // in the chat box, pick a prompt, and it goes in where your cursor is.

Your prompts, one // away
• Type // at the start of the chat box, or after a space or a line break, and your prompts open right there. The Prompts button in the chat box opens them too.
• Browse All, Pinned, Recent (the last five you inserted) or one Category, or search your whole Library.
• Each insertion is confirmed above the chat box, with Undo to put back the text that was there.

Write it once. Reuse it everywhere.
• Variables: write {{name}} where the details change. When you insert the prompt in a chat, you fill in each Variable first.
• The rest arrives exactly as you saved it, line breaks included.

One Library for every AI chat
Works on Claude, ChatGPT, Google Gemini, Mistral LeChat, Perplexity, Microsoft Copilot and Microsoft 365 Copilot (m365.cloud.microsoft). Turn each one on or off in Settings.
Another AI site? Add it as a custom site, and show where the Prompts button goes with the Element picker.

A home for every prompt you write
• Categories in 12 colors.
• Filter pills: All, Pinned, Most Used, or one Category.
• Search with Cmd+K on a Mac, Ctrl+K elsewhere, in titles, text and Category names. A search that finds nothing offers to create a new one.
• Pin the prompts you want first, copy one in a click, or share one as a Share code.
• Open it as a popup or in Chrome's side panel, in light or dark mode, or following your system.

Not sure where to start? Pick a Pack
The first time you open the extension after installing it, the Welcome shows how it works in three short steps and offers four Packs of ready-made prompts: Product, Engineering, Writing and Hiring. The Packs you pick go into your Library, each in a Category named after it, and everything stays editable.

Analytics
See the prompts you use most, your busiest weekday, and the AI chats and Categories you use. Tidy up lists the prompts you never used and the duplicate pairs, each with a Review button that opens them in your Library.

Stays on your device. No account, no cloud.
• Your Library, settings and usage history stay in Chrome's local storage on your computer. They are not synced, and there is no account, no server and no tracking. The extension itself sends nothing anywhere: a prompt leaves your computer only when you send it in a chat.
• Export a Backup file of your Library whenever you like, and restore it from Settings.
```

2,548 characters. Google's documentation names no character limit for the detailed description ([Complete your listing information](https://developer.chrome.com/docs/webstore/cws-dashboard-listing#product_details), [Creating a great listing page](https://developer.chrome.com/docs/webstore/best-listing#item_description)); the Dashboard field is commonly reported to take 16,000 characters, which Google does not document. Across the summary and the description, Copilot appears three times (Microsoft Copilot and Microsoft 365 Copilot) and every other Platform name twice, under the five instances of one keyword that the [Keyword spam](https://developer.chrome.com/docs/webstore/program-policies/spam-faq#keyword-spam) policy advises.

## Category and language

- **Category:** Workflow & Planning, "Extensions to help users perform their tasks more efficiently" ([Choose your extension's category well](https://developer.chrome.com/docs/webstore/best-practices#choose-category-well)). Productivity, the category of 1.x, was replaced in mid 2023.
- **Language:** English

## Privacy practices

### Single purpose

```text
Keep a personal Library of prompts and insert them into AI chat sites: Claude, ChatGPT, Google Gemini, Mistral LeChat, Perplexity, Microsoft Copilot, Microsoft 365 Copilot, and the sites the user adds.
```

### Permission justifications

One field per permission that `manifest.json` declares under `permissions`.

#### storage

Keeps your Library on your computer: your prompts, Categories and settings, which sites the extension works on, and the history of insertions that Analytics counts (the last 30 days). They are kept in Chrome's local storage, which is not synced. Chrome's session storage, emptied when Chrome closes, holds short-lived state: where the Prompts button was placed in each tab, the progress of the Element picker, and a Review on its way to the side panel. Nothing stored is sent anywhere.

#### activeTab

When you click the extension's icon in the toolbar, with the extension set to open in the side panel, the extension loads its Prompts button in the tab you are on if it is missing there, for example in a tab opened before an update. activeTab limits this to the tab you clicked from, at the moment of your click, and the extension does it only on the AI chat sites it works on and the sites you added.

#### tabs

Lets the extension see the address of your open tabs, to know which ones show an AI chat site or a site you added. It uses this to add the Prompts button to the tabs already open when you install or update the extension or add a site, to apply a theme change to them, to bring the right tab forward when you use the Element picker, and to remember where the Prompts button was placed in each tab until the tab leaves the site or closes. Tab addresses are never sent anywhere.

#### sidePanel

Lets you open the extension in Chrome's side panel instead of a popup (Settings, Appearance, Open in), so your Library stays open beside the chat. The Review buttons of the full-page Analytics view open the side panel on the prompts to review.

#### scripting

Adds the extension's own script, the one that shows the Prompts button and opens your prompts on //, to a tab: to the tabs already open when you install or update the extension, to each page you open on a site you added (which the manifest cannot list), and to the current tab when you click the toolbar icon in side panel mode. It runs only on the AI chat sites the extension works on and the sites you added and turned on. The script is part of the extension package: no code is downloaded.

### Host permission justification

The Dashboard has one field for every host. Paste this paragraph, then the line under each heading, one line per host:

On each of these sites the extension looks for the chat box and its toolbar, to place the Prompts button there. Of what you write, it reads only the chat box: the text just before your cursor, to notice //, and the text in the box, to put it back on Undo. Nothing it reads leaves your computer.

#### `https://claude.ai/*`

Claude: shows the Prompts button and opens your prompts on // in the chat box, then inserts the prompt you pick.

#### `https://chatgpt.com/*`

ChatGPT: shows the Prompts button and opens your prompts on // in the chat box, then inserts the prompt you pick.

#### `https://gemini.google.com/*`

Google Gemini: shows the Prompts button and opens your prompts on // in the chat box, then inserts the prompt you pick.

#### `https://www.perplexity.ai/*`

Perplexity: shows the Prompts button and opens your prompts on // in the chat box, then inserts the prompt you pick.

#### `https://chat.mistral.ai/*`

Mistral LeChat: shows the Prompts button and opens your prompts on // in the chat box, then inserts the prompt you pick.

#### `https://copilot.microsoft.com/*`

Microsoft Copilot: shows the Prompts button and opens your prompts on // in the chat box, then inserts the prompt you pick.

#### `https://m365.cloud.microsoft/*`

Microsoft 365 Copilot: shows the Prompts button and opens your prompts on // in the chat box, then inserts the prompt you pick.

#### Optional `https://*/*`

Never granted at install. Asked only when you add a site yourself in Settings, or use the Element picker on a site, and then only for that one site: Chrome asks you first, and the extension works there only if you accept.

#### Optional `http://*/*`

Never granted at install. Asked only when you use the Element picker on a site served over http rather than https, and then only for that one site: Chrome asks you first, and the extension works there only if you accept.

### Remote code

No, I am not using remote code. Every script is in the package, and `manifest.json` allows only the package's own scripts (`script-src 'self'`).
