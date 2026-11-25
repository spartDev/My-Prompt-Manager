# Chrome Web Store Listing - My Prompt Manager 2.0

The text of the store listing since Release 2.0.0, in English. Each heading names the Developer Dashboard field its text goes in, except the summary, which is not pasted (see Summary). The copy agrees with the store images of ticket My-Prompt-Manager-tuh.9, so submit the listing with four screenshots for now, 1 to 4, and the small promo tile and the marquee. Add screenshot 5, the Welcome's Packs step, once ticket My-Prompt-Manager-1c88 is resolved: it shows the real 2.0.0 Welcome, which names Copilot (`src/components/welcome/PackPicker.tsx:10`), while this listing says Copilot is not supported. Four is enough: Google asks for "At least one 1280x800 px or 640x400 px screenshot, up to 5 total" ([Complete your listing information](https://developer.chrome.com/docs/webstore/cws-dashboard-listing#graphic-assets)).

- **First, the privacy policy.** Before you submit, check that the privacy policy agrees with this listing (ticket My-Prompt-Manager-nare). At 2.0.0, `privacy-policy.md:37` and `privacy-policy-short.md:8` justify `<all_urls>`, which `manifest.json` does not declare, and `privacy-policy-short.md:17` says "No Analytics", while this listing describes Analytics and its usage history. Google wants the Privacy practices to be "consistent with the privacy policy URL that you provide" ([Privacy practices](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy#certify_your_data_use_practices)).
- **Second, the Data usage answers.** This listing does not hold them yet: the checkboxes of the Privacy practices tab that disclose the data the extension collects, and its certifications. Do not submit before ticket My-Prompt-Manager-cdfa drafts them here. Google asks for them with every update ("Every item will need to provide these data collection disclosures and limited use certification in order to be updated or published", [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq#1_what_is_required_from_developers_to_publishupdate_a_chrome_web_store_item)), data kept on the computer included ("Extensions are required to disclose how they handle user data, even when data is processed or stored locally on a user's device", [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq#3_does_an_extension_need_to_disclose_user_data_handling_if_the_data_is_only_processed_or_stored_locally_on_a_users_device)).
- **Third, activeTab.** Before you submit, record in ticket My-Prompt-Manager-79h7 whether 2.0.0 keeps `activeTab`, which `manifest.json:13` declares and no feature needs (activeTab, below). If it stays, paste its justification with the others. If it goes, make no listing-only submission, since Google says "If there are permissions listed here that you don't require, remove them from your manifest and upload a new version of your extension before continuing" ([Privacy practices](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy#list_and_justify_any_permissions)): the listing waits for the Release that drops it (With a later Release, below).
- **Now, for the published 2.0.0:** paste the text and upload the images on the Dashboard tabs ([Update your Chrome Web Store item](https://developer.chrome.com/docs/webstore/update#uploading-new-listing-metadata): "If you're changing anything about the Chrome Web Store listing for your item, its distribution, or details of your privacy policy, you must update the information on the developer dashboard"): four screenshots, 1 to 4, the small promo tile and the marquee, holding screenshot 5 while ticket My-Prompt-Manager-1c88 is open. Then click Submit for review ([Submitting the update](https://developer.chrome.com/docs/webstore/update#submitting-the-update)). No new package is needed: one is required only "If you're changing any code, the manifest, or other assets packaged with your extension" ([Uploading an updated ZIP file](https://developer.chrome.com/docs/webstore/update#uploading-an-updated-zip-file)). Google reviews the listing like any submission ([Review process](https://developer.chrome.com/docs/webstore/review-process#review-time): "all item submissions ... are subject to the same review process"). The store keeps the old listing until the review passes: a refused submission leaves "the description text, image assets, privacy disclosures, and published CRX all" unchanged ([Rejection](https://developer.chrome.com/docs/webstore/review-process#rejection)). Push no Release tag while it waits: a draft awaiting review cannot change unless its review is cancelled ([Manage your item](https://developer.chrome.com/docs/webstore/update#manage_your_item): "Cancel review: Use when your item is awaiting review. This review will be cancelled letting you make changes to your draft").
- **With a later Release:** paste what changed and save the draft without submitting it, before `release.yml` makes the Submission, which sends the draft, listing included (`docs/CHROME_WEBSTORE_GUIDE.md`, Version Updates). Until that review passes, the published item stays as it is: "When you submit an update for review, it doesn't yet affect your published item" ([Submitting the update](https://developer.chrome.com/docs/webstore/update#submitting-the-update)).

## Summary (not pasted)

Not pasted: the Dashboard cannot edit the summary. It is the `description` of `manifest.json`, so this text goes live with the first Release whose `manifest.json` carries it (ticket My-Prompt-Manager-tuh.11).

```text
Write a prompt once, then type // to insert it in Claude, ChatGPT, Gemini, Mistral or Perplexity. Stays on your device.
```

119 characters. The limit is 132 ([Creating a great listing page](https://developer.chrome.com/docs/webstore/best-listing#item_summary): "132 characters or less").

The store shows the `description` field of the uploaded package's `manifest.json` ([manifest `description`](https://developer.chrome.com/docs/extensions/reference/manifest/description): "no more than 132 characters"; [Prepare your extension](https://developer.chrome.com/docs/webstore/prepare#manifest): "After uploading your item, you won't be able to edit the metadata of your manifest in the developer dashboard"). The 2.0.0 package carries "Personal prompt library for AI platforms. Store, organize, and instantly insert your best prompts with one click." (113 characters). The summary names the five Platforms this version works on, the most that the [Keyword spam](https://developer.chrome.com/docs/webstore/program-policies/spam-faq#keyword-spam) policy allows in a list. It names no Copilot: copilot.microsoft.com now redirects to copilot.com, and a work account lands on copilot.cloud.microsoft, two hosts that 2.0.0 does not declare (tickets My-Prompt-Manager-1c88 and My-Prompt-Manager-j74b).

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
Works on Claude, ChatGPT, Gemini, Mistral and Perplexity. Turn each one on or off in Settings.
Microsoft Copilot is not supported in this version: it now opens at copilot.com, or at copilot.cloud.microsoft with a work account.
Another AI site? Add it as a custom site, and show where the Prompts button goes with the Element picker.

A home for every prompt you write
• Categories in 12 colors.
• Filter your Library: All, Pinned, Most Used, or one Category.
• Search with Cmd+K on a Mac, Ctrl+K elsewhere, in titles, text and Category names. A search that finds nothing offers to create a new one.
• Pin the prompts you want first, copy one in a click, or share one as a Share code.
• Open it in Chrome's side panel or as a popup, in light or dark mode, or following your system.

Not sure where to start? Pick a Pack
The first time you open the extension after installing it, the Welcome shows how it works in three short steps and offers four Packs of ready-made prompts: Product, Engineering, Writing and Hiring. The Packs you pick go into your Library, each in a Category named after it, and everything stays editable.

Analytics
See the prompts you use most, your busiest weekday, and the AI chats and Categories you use. Tidy up lists the prompts you never used and the duplicate pairs, each with a Review button that opens them in your Library.

Stays on your device. No account, no cloud.
• Your Library, settings and usage history stay in Chrome's local storage on your computer. They are not synced, and there is no account and no server. The extension itself sends nothing anywhere.
• Export a Backup file of your Library whenever you like, and restore it from Settings.
```

2,532 characters. Google's documentation names no character limit for the detailed description ([Complete your listing information](https://developer.chrome.com/docs/webstore/cws-dashboard-listing#product_details), [Creating a great listing page](https://developer.chrome.com/docs/webstore/best-listing#item_description)); the Dashboard field is commonly reported to take 16,000 characters, which Google does not document. The summary, the description and the single purpose name the same five Platforms, the most that the [Keyword spam](https://developer.chrome.com/docs/webstore/program-policies/spam-faq#keyword-spam) policy allows in a list of supported sites ("When listing supported websites or brands in the description, do not list more than five"). No Platform name appears five times.

## Category and language

- **Category:** Workflow & Planning, "Extensions to help users perform their tasks more efficiently" ([Choose your extension's category well](https://developer.chrome.com/docs/webstore/best-practices#choose-category-well)). Productivity, the category of 1.x, was replaced in mid 2023.
- **Language:** English

## Privacy practices

### Single purpose

```text
Keep a personal Library of prompts and insert them into the chat box of AI chat sites, such as Claude, ChatGPT, Gemini, Mistral and Perplexity, and of the sites the user adds.
```

### Permission justifications

One field per permission that `manifest.json` declares under `permissions`.

#### storage

Keeps your Library on your computer: your prompts, Categories and settings, which sites the extension works on, and the history of your insertions that Analytics counts. They are kept in Chrome's local storage, which is not synced. Chrome's session storage, emptied when Chrome closes, holds short-lived state: where the Prompts button was placed in each tab, the progress of the Element picker, and a Review on its way to the side panel. The extension sends nothing it stores anywhere.

#### activeTab

> This note is not pasted; the paragraph after it is, while `manifest.json` declares activeTab. 2.0.0 does not need activeTab: the content script is injected only after a check of the host permission for the tab's site (`src/background/background.ts:495-497`). A script that only looks whether the content script is already in the tab can run before that check, as when the Element picker starts (`:1542`, which runs `:571`), but the injection that follows still stops at it. Google says activeTab is not required "When the extension has access to broad host permissions or host permissions for the specific domains that are relevant to the extension's operations" ([Excessive permissions](https://developer.chrome.com/docs/webstore/troubleshooting#excessive-permissions)), and asks to remove a permission that is not required ([Privacy practices](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy#list_and_justify_any_permissions)), so its review may refuse the listing over it. Dropping it needs the owner's decision (ticket My-Prompt-Manager-79h7): `src/test/guardrails/manifestHosts.test.ts:33` pins the five permissions of 1.9.0. This heading goes when activeTab does.

When you click the extension's icon in Chrome's toolbar, with the extension set to open in the side panel, the extension adds its Prompts button to the tab you are on if it is missing there. It acts only on that tab, at your click, and only on the AI chat sites it works on and the sites you gave it access to.

#### tabs

Lets the extension see the address of your open tabs, to know which ones show an AI chat site or a site you added. It uses this to add the Prompts button to the tabs already open when you install or update the extension or add a site, to apply a theme change to them, to bring the right tab forward when you use the Element picker, and to remember where the Prompts button was placed in each tab until the tab leaves the site or closes. It also reads the address and title of the tab you are on, to offer that site when you add one in Settings. The extension never sends tab addresses anywhere.

#### sidePanel

The extension opens in Chrome's side panel when you click its icon, so your Library stays open beside the chat; Settings, Appearance, Open in switches it to a popup. The Review buttons of the full-page Analytics view open the side panel on the prompts to review.

#### scripting

Adds the extension's own script, the one that shows the Prompts button and opens your prompts on //, to a tab: to the tabs already open when you install or update the extension or add a site, to the tab where you start the Element picker, to each page you open on a site you added (which the manifest cannot list), and to the current tab when you click the extension's icon in Chrome's toolbar in side panel mode. It is added only to the AI chat sites the extension works on and the sites you gave it access to, and it stays idle on a site you turned off. The script is part of the extension package: no code is downloaded.

### Host permission justification

The Dashboard has a single field for all the hosts. Paste this paragraph, then the line under each heading, one line per host:

On each of these sites the extension looks for the chat box and its toolbar, to place the Prompts button there. For // and Undo, it reads only the chat box: the text just before your cursor, to notice //, and the text in the box, to put it back on Undo. When you use the Element picker to choose where the Prompts button goes, on a site you add or on one of these sites where the button could not find its usual place, it also reads the element you click, its place in the page, and the page's address. The extension sends nothing it reads anywhere. On a site you add, what the Element picker reads goes into the configuration code you can export to share it: the page's address and what identifies the element you picked, that is attributes such as its id, label, class names and data- attributes, each kept whole, so a draft of yours that the page copied into one can go too; its parent's id and its place among its siblings; and up to 50 characters of its text.

> Shorter fallback, if the field's counter stops short: paste the paragraph above, then this one line in place of the seven Platform lines, then the lines of the two optional hosts.
>
> Claude (claude.ai), ChatGPT (chatgpt.com), Google Gemini (gemini.google.com), Perplexity (www.perplexity.ai), Mistral LeChat (chat.mistral.ai), Microsoft Copilot (copilot.microsoft.com) and Microsoft 365 Copilot (m365.cloud.microsoft): on each, to show the Prompts button and open your prompts on // in the chat box, then insert the prompt you pick. Microsoft now redirects copilot.microsoft.com to copilot.com, and a work account from either Copilot to copilot.cloud.microsoft, two hosts this version does not run on.

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

Microsoft Copilot: to show the Prompts button and open your prompts on // in the chat box, then insert the prompt you pick. Microsoft now redirects this address to copilot.com, which this version does not run on.

#### `https://m365.cloud.microsoft/*`

Microsoft 365 Copilot: to show the Prompts button and open your prompts on // in the chat box, then insert the prompt you pick. Microsoft redirects a work account from here to copilot.cloud.microsoft, which this version does not run on.

#### Optional `https://*/*`

Never granted at install. Asked only when you add a site yourself in Settings, or use the Element picker on a site, and then only for that one site: Chrome asks you first, and the extension works there only if you accept.

#### Optional `http://*/*`

Never granted at install. Asked only when you use the Element picker on a site served over http rather than https, and then only for that one site: Chrome asks you first, and the extension works there only if you accept.

### Remote code

No, I am not using remote code. Every script is in the package, and `manifest.json` allows only the package's own scripts (`script-src 'self'`).
