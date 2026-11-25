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

> This note is not pasted; the paragraph after it is, while `manifest.json` declares activeTab. 2.0.0 does not need activeTab: the content script is injected only after a check of the host permission for the tab's site (`src/background/background.ts:495-497`). A script that looks whether the content script is already in the tab, and removes what an earlier version left there, can run before that check, as when the Element picker starts (`:1542`, which runs `:571`), but the injection that follows still stops at it. Google says activeTab is not required "When the extension has access to broad host permissions or host permissions for the specific domains that are relevant to the extension's operations" ([Excessive permissions](https://developer.chrome.com/docs/webstore/troubleshooting#excessive-permissions)), and asks to remove a permission that is not required ([Privacy practices](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy#list_and_justify_any_permissions)), so its review may refuse the listing over it. Dropping it needs the owner's decision (ticket My-Prompt-Manager-79h7): `src/test/guardrails/manifestHosts.test.ts:33` pins the five permissions of 1.9.0. This heading goes when activeTab does.

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

### Data usage

The Data usage field of the Privacy practices tab: nine checkboxes for the data the extension handles, then three certifications. Nothing is pasted: the owner ticks the boxes. Drafted on 2026-11-25 (ticket My-Prompt-Manager-cdfa). One decision is the owner's before any box is ticked, under "Does data kept only on the device count?" below. The ticks assume the recommendation there (Reading A).

#### What Google's pages say

Read on 2026-11-25. The footer date of each page is Google's own and is older than some of the text it holds, so the text, not the footer, is what is quoted.

- [Fill out the privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy) (footer "Last updated 2020-06-12 UTC"). Its text never names a checkbox: it says only "Use the first group of checkboxes to disclose which types of data your extension collects. Use the second group of checkboxes to certify that you comply with each of the disclosure statements." The nine names and the three certifications below are read from the page's own screenshot of the field ([image](https://developer.chrome.com/static/docs/webstore/cws-dashboard-privacy/image/screenshot-data-certifi-1955439870c37.png)), so they are as old as that screenshot. Compare them with the live Dashboard before ticking; if a name or an example differs there, change its row here.
- [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) (footer "Last updated 2016-04-23 UTC", though it holds recent entries). Cited by question title, because the numbering restarts in each part.
- [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use), [Privacy Policies](https://developer.chrome.com/docs/webstore/program-policies/privacy) and [Disclosure Requirements](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements) (footers "Last updated 2022-11-01 UTC").
- [Chrome Web Store policy updates](https://developer.chrome.com/blog/cws-policy-updates-2026) (2026-07-01): the Limited Use and Disclosure Requirements policies were updated, enforced from 2026-08-01. The pages above are the ones that are live now.

The screenshot's heading is "What personal and sensitive data do you plan to collect from users now or in the future?", and under the boxes: "The content of this form will be displayed publicly on the item detail page. By publishing your item, you are certifying that these disclosures reflect the most up-to-date content of your privacy policy." and "You must certify all three disclosures to comply with our Developer Program Policies".

#### Does data kept only on the device count?

**Not settled by the docs, for the checkboxes.** Google settles that local data must be disclosed, and never says in so many words that a checkbox is ticked for data that does not leave the device.

What the docs say:

- User Data FAQ, ["Does an extension need to disclose user data handling if the data is only processed or stored locally on a user's device?"](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq#3_does_an_extension_need_to_disclose_user_data_handling_if_the_data_is_only_processed_or_stored_locally_on_a_users_device): "Yes. Extensions are required to disclose how they handle user data, even when data is processed or stored locally on a user's device and is not transmitted to external servers or third parties."
- User Data FAQ, "What does 'handle' mean": "Generally, by "handle" we mean collecting, transmitting, using, or sharing user data." Its examples include "Collecting web browsing activity and any information about the website content or resources a user requests or interacts with, including the domains or URLs the browser interacts with".
- User Data FAQ, "Simplifying privacy practices", [first entry](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq#1_what_is_required_from_developers_to_publishupdate_a_chrome_web_store_item): the Privacy practices tab was updated "to allow developers to easily provide information about their data collection and data usage in a simple and standardized way. Every item will need to provide these data collection disclosures and limited use certification in order to be updated or published."
- Same part, [third entry](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq#3_what_happens_if_there_are_inconsistencies_between_my_items_privacy_policy_the_disclosures_provided_through_the_developer_dashboard_and_the_behavior_of_my_item): "Any discrepancies between the developer dashboard disclosures, your privacy policy, and the behavior of your item would be a violation of the Chrome Web Store developer program policies. This can result in the suspension of all the items owned by the publisher, deactivation of the existing user-base, and ban of the entire publisher entity (including related accounts)."
- User Data FAQ, "My extension or app handles user data, but only stores information locally ... Do I still need to post a privacy policy?": "Yes."

The two readings:

- **Reading A, tick what the extension handles.** A box is ticked when the extension reads, stores or uses that type of data, whether or not it leaves the device. For: the only text that speaks of local data asks for disclosure with no exception for the Dashboard, and the Dashboard tab is the standardized disclosure ("these data collection disclosures"). Against: the form's own question says "collect from users", and it puts a public line on the listing for data that never leaves the device.
- **Reading B, tick only what leaves the device** for the developer or a third party. Nothing leaves here, so all nine stay unticked and the privacy policy carries the whole disclosure of local data. For: "collecting" is one word of four in the FAQ's definition of "handle", and the privacy policy is the document the FAQ says local-only extensions must post. Against: nothing in the docs says the boxes may be left empty for local data, and the penalty for a mismatch is suspension of the publisher's items.

**Recommended: Reading A.** An unticked box that a reviewer finds the code contradicts is the suspension case above, while an extra ticked box costs a public line on the listing that the policy explains. **The owner decides; the decision is recorded in the ticket notes of My-Prompt-Manager-cdfa.** What "disclose" means for a box, under either reading: ticking it is the public declaration on the item page; the privacy policy says how the data is used and shared ([Privacy Policies](https://developer.chrome.com/docs/webstore/program-policies/privacy): it "must, together with any in-Product disclosures, comprehensively disclose: How your Product collects, uses and shares user data"); and the Disclosure Requirements ask for more (see "Open points").

#### The nine checkboxes

The answers are those of Reading A. Under Reading B every box is unticked. Lines are those of the code at Release 2.0.0.

| Checkbox, with Google's example | Answer | What the code does |
| --- | --- | --- |
| **Personally identifiable information**: name, address, email address, age, or identification number | No | No sign-in, no form that asks for any of them, no cookie read: `manifest.json:11-17` declares only `storage`, `activeTab`, `tabs`, `sidePanel` and `scripting`. The text of a Prompt is the user's free text, which the extension never parses (see "Not a checkbox"). |
| **Health information**: heart rate data, medical history, symptoms, diagnoses, or procedures | No | Nothing reads or asks for it. The Element picker turns itself off on a site whose address matches healthcare, medical or insurance (`src/content/modules/element-picker.ts:52-75`, `:628-637`). |
| **Financial and payment information**: transactions, credit card numbers, credit ratings, financial statements, or payment history | No | Nothing reads or asks for it. The Element picker refuses banks, brokers and payment services (`element-picker.ts:52-75`) and card, CVV and one-time-code fields (`:29-49`), and the fingerprint leaves out values that look sensitive (`src/content/utils/element-fingerprint.ts:166`, `:373-378`). |
| **Authentication information**: passwords, credentials, security question, or personal identification number (PIN) | No | No cookie, token or password is read: no `cookies` or `identity` permission (`manifest.json:11-17`). A password field cannot be picked (`element-picker.ts:30`, `:38`, `:40`). |
| **Personal communications**: emails, text or chat messages, social media posts, or conference calls | **Yes** | The script reads the text of the chat box: the text before the caret, to notice `//` (`src/content/selector/inputText.ts:142-146`, called at `src/content/core/injector.ts:444`), and the whole text, to keep it for Undo and to see that the user edited it (`inputText.ts:133-135`, `src/content/selector/controller.ts:464`, `:616-631`). It is kept in memory in the page and never stored or sent: the script's only messages carry the usage record (`injector.ts:1766-1773`), the Element picker's pick (`element-picker.ts:675-684`) and the button's placement (`src/content/core/placement-repair.ts:182`). The least certain tick: Reading A counts it because the FAQ speaks of data "processed or stored locally", and a reading that ticks only what is stored would leave it out. |
| **Location**: region, IP address, GPS coordinates, or information about things near the user's device | No | No geolocation call, no IP address, no network request of the extension's own: its only two `fetch` calls read files of its own package (`src/background/background.ts:718`, `src/content/selector/font.ts:23`). A site's hostname is Web history, not Location. |
| **Web history**: the list of web pages a user has visited, as well as associated data such as page title and time of visit | **Yes** | (1) `tabs` reads the address of a tab each time a page finishes loading, to decide whether to add the script (`background.ts:773-777`, `:305-321`), the addresses of all tabs at install, update, startup and when access is granted (`:1114`, `:1185`, `:1283`), and the address and title of the tab you are on while the Site settings are open (`src/hooks/usePickerWindow.ts:124-129`). Of these, only what the user saves when adding a site is kept (`src/components/settings/AddCustomSiteForm.tsx:80-86`); the others are compared and dropped (`injectedTabs` holds tab ids, `background.ts:270`, `:324`). (2) The usage history stores the Platform of each insertion, which on a Custom site is its hostname, with the time (`injector.ts:1762-1764`, `src/types/index.ts:16-17` and `:19-24`, `src/services/UsageTracker.ts:62-67`, `:216`), and Analytics shows it (`src/components/analytics/AnalyticsDashboard.tsx:213-219`). (3) The Element picker's fingerprint keeps the page's full address, `?` and `#` included, and the time (`element-fingerprint.ts:196-200`, `src/types/index.ts:249-250`), stored with the Custom site (`src/services/siteSettings.ts:375`) and in its exported configuration code (`src/services/configurationEncoder.ts:79`). (4) The picker's log of its last 50 picks, with the page address, in the page's own `sessionStorage` (`element-picker.ts:260-282`). |
| **User activity**: network monitoring, clicks, mouse position, scroll, or keystroke logging | **Yes** | In the pages it runs on, the script listens to key presses and typed characters, to notice a `/` (`injector.ts:432-434`, `:459-461`); while the Prompt selector is open, to pointer, key, scroll and resize events (`controller.ts:381-383`, `:633-636`); and, while the Element picker is on, to mouse moves, clicks and keys (`element-picker.ts:543-545`). No keystroke is logged. What is kept of the user's activity is one record per insertion (which Prompt, its Category, where, when: `UsageTracker.ts:62-67`) and the picker's log. |
| **Website content**: text, images, sounds, videos, or hyperlinks | **Yes** | The Element picker reads the clicked element's identifiers and attributes and, when its text is under 200 characters, its first 50 characters (`element-fingerprint.ts:368-382`), and keeps them with the Custom site and in the exported configuration code (`siteSettings.ts:375`, `configurationEncoder.ts:100-106`). The script also reads the page's structure to find the chat box and its Toolbar, and keeps none of it. No image, sound, video or link is read. |

Web history is the one the Limited Use page restricts: "Collection and use of web browsing activity is prohibited, except to the extent required for a user-facing feature described prominently in the Product's Chrome Web Store page and in the Product's user interface." The features that need it are the Custom sites and the Element picker (Settings) and the Platforms ranking of Analytics, and the listing's description names them ("Another AI site? Add it as a custom site, and show where the Prompts button goes with the Element picker", "the AI chats and Categories you use").

#### The three certifications

The three statements, as the screenshot words them. All three are true, and Google requires all three.

| Certification | Answer | Why, and the code |
| --- | --- | --- |
| I do not sell user data to third parties | Yes, certify | The extension makes no network request of its own (`background.ts:718` and `font.ts:23` read files of the package), has no analytics or advertising library (none in `package.json`), and runs no remote code (`manifest.json:83-85`, `script-src 'self'`). The only data that goes to another party is a Prompt the user inserts into the chat box of the site they are on, and a Share code, a configuration code or a Backup file the user exports. |
| I do not use or transfer user data for purposes that are unrelated to my item's single purpose | Yes, certify | Every read above serves the single purpose written under Single purpose: the `//` read, the Undo snapshot, the tab addresses (to place the Prompts button), the Element picker, and the usage history (Analytics, Most Used, Recent). Nothing is transferred. Inserting a Prompt into the chat box is the single purpose itself. Analytics is the one a reviewer could question: it ranks and tidies the Library, and the Library is the single purpose. |
| I do not use or transfer user data to determine creditworthiness or for lending purposes | Yes, certify | No data leaves the device, and no code ranks, scores or profiles anyone. |

#### Not a checkbox

- **The text of a Prompt.** The User Data FAQ ("What are examples of user data?") lists "User-generated content" and "Form data", and the Dashboard has no box for either. A Prompt is the user's own text, saved in `chrome.storage.local` and typed in the extension's own editor, not Website content and not a message exchanged with anyone; once inserted it is a chat message, which is what the Personal communications tick covers. The extension cannot tell what a Prompt holds, so the other boxes stay unticked: the extension asks for none of it.
- **Other things the code reads.** In the console only: the page address in each message the content script writes (always for an error, in Debug mode for the rest, `src/content/utils/logger.ts:102-111`, `:133-141`), and the user agent (its first 100 characters in an error, `logger.ts:102-111`; the whole of it in the Debug mode start-up message, `src/content/index.ts:59-63`, and in the popup's error report, `src/components/ErrorBoundary.tsx:68-76`). One key of the page's own `localStorage`, `prompt-library-debug`, read for Debug mode (`logger.ts:36`, `element-picker.ts:289`). The clipboard is written, never read (no `readText` in `src`). No box names a user agent.

#### Limited Use disclosure, proposed for the privacy policy

Google asks for it in the [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use) page: "An affirmative statement that your use of the data complies with the Limited Use restrictions must be disclosed on a website belonging to your extension; for example, a link on a homepage to a dedicated page or privacy policy noting: "The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements."" The User Data FAQ (["What disclosures do I need to display on my project home page?"](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq#1_what_disclosures_do_i_need_to_display_on_my_project_home_page)) adds that it goes "on your project's homepage or on a page one click away from the homepage; for example, in your privacy policy" and "should be written by you, the developer, and should clearly describe the app's compliance".

Not in `privacy-policy.md` yet: it waits for pull request #620 to merge, then the owner adds this under its own heading, and links the policy from the README (`manifest.json:6` makes the repository the homepage, and `README.md` has no link to the policy). Google's sentence is kept word for word, then the four elements of the requirements, in this extension's terms:

```text
## Chrome Web Store User Data Policy: Limited Use

The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

For My Prompt Manager, that means:

- **Allowed use.** The extension uses the data it reads only to provide its single purpose: keeping your Library of Prompts and inserting them into the chat box of AI chat sites and of the sites you add. That data is the addresses and titles of your tabs, the text of the chat box, what the Element picker describes, and the record of your insertions (the usage history and each Prompt's use count) that Analytics, Most Used and Recent show you. The addresses of the sites you use are used only for the features that show them to you: your Custom sites, the Element picker, and the Platforms ranking in Analytics.
- **Allowed transfer.** The extension transfers no data to the developer or to any third party. Data leaves your device only through you: a Prompt you insert goes into the chat box of the site you are on, and a Share code, a configuration code or a Backup file goes only where you put it.
- **No advertising.** The extension does not use or transfer your data for personalized, re-targeted or interest-based advertising, and shows no ads.
- **No human reading.** The developer never receives your data, so no one at the developer reads it.

The extension does not sell your data, and does not use it to determine creditworthiness or for lending.
```

#### Side by side with the privacy policy

Against `privacy-policy.md` as pull request #620 has it (`origin/docs/My-Prompt-Manager-nare`, 0807214b), and its `privacy-policy-short.md`.

| Data type | What the policy says | Proposed answer | Agree |
| --- | --- | --- | --- |
| Personally identifiable, Health, Financial, Authentication | Says nothing of them, except that the Element picker leaves out sensitive values and fields and turns itself off on some sites (`:55`). | No | Yes |
| Personal communications | The script reads "only the chat box: the text just before your cursor, to notice `//`, and the text in the box around an Insertion ... It keeps this in memory, never stores it, and never sends it" (`:64`). | Yes | Yes |
| Location | Says nothing. | No | Yes |
| Web history | Tab addresses read by `tabs` (`:101`); the usage history's Platform "or the address of the Custom site", with the time (`:39`); Custom sites and the sites you allowed (`:23-24`); the picker's "full address of the page you picked on, including any part after `?` or `#`" (`:52`), stored (`:57`) and in the configuration code (`:88`); the picker's log in the page (`:35`). | Yes | Yes |
| User activity | The usage history (`:39-45`) and Analytics (`:12`). The key and mouse listeners are not named. | Yes | Facts agree; the listeners are a gap |
| Website content | "up to 50 characters of the element's text" (`:53`), "the page's structure" (`:63`). | Yes | Yes |
| Prompt text | Title, content and Category (`:21`). | Not a checkbox | Yes |
| Limited Use disclosure | Absent. | Proposed above | Gap, closes when the owner adds it |

No statement in the policy about these nine types contradicts an answer above. What does need the owner's attention:

1. **The words "collect" and "analytics".** `privacy-policy.md` at #620 never uses the word "collect" (a grep finds no match), so the "collects no information" of the old policy that the ticket cites is gone, and it says the developer "receives" nothing (`:135`, `:139`). `privacy-policy-short.md:5` is headed "What the developer collects" and answers "Nothing", and `privacy-policy.md:10` says "no usage analytics". Each is true of what the developer receives, but a reviewer who reads them next to a Dashboard that ticks User activity and Web history (Reading A) sees "nothing" against four boxes. Fix, once #620 has merged: one paragraph in the policy that names the four types and says they stay on the device, and a line in the short policy that says the same.
2. **`README.md:331` and `:338`**, the repository homepage (`manifest.json:6`), say "No Analytics: Zero tracking or telemetry" and "No user tracking or analytics". The product has an Analytics section and a usage history, so under either reading this contradicts the behavior. #620 does not touch the README.
3. **Not in the policy:** the script's key and mouse listeners (`injector.ts:459-461`, `element-picker.ts:543-545`), and the console logging of the page address and the user agent (`logger.ts:102-111`, `ErrorBoundary.tsx:68-76`). Neither is a statement the policy gets wrong; both are things a reader who ticked User activity would look for.

#### Open points for the owner

- **The decision above** (Reading A or B). Under Reading B, only the Limited Use disclosure and the policy wording are left to do.
- **A disclosure inside the extension.** The Disclosure Requirements say: "If your Product handles any user data, then prior to installation, it must: Prominently disclose what user data will be collected and how it will be used. Obtain the user's affirmative and informed consent for such use." The User Data FAQ ("How do I satisfy the prominent disclosure requirement?") adds: "The prominent disclosure and consent must occur within the Product's user interface. Disclosures in the Chrome Web Store description or inline installation page do not satisfy this requirement." Nothing in the Welcome, the Settings or the other screens says what the extension reads or keeps (a search of `src/components` for "privacy", "your device", "local storage" and "no account" finds none). Whether this applies to data that stays on the device is not settled by the docs, and a screen that asks consent is a behavior change, so it belongs to a follow-up ticket, not to this one.
- **A practice that is new in 2.0.0.** The `//` trigger, a listener for the characters typed in a chat box, and the read of the chat box's text, are not in 1.9.0: at the `v1.9.0` tag there is no `src/content/selector/inputText.ts`, no `beforeinput` listener, and a search of `src/content/platforms` for `.value`, `.textContent` and `.innerText` finds none; its only `keydown` listeners are the open selector's keyboard navigation (`src/content/ui/keyboard-navigation.ts:83`) and the Element picker's. The usage history with a Custom site's hostname and the fingerprint's page address are older (`UsageTracker.ts`, `injector.ts` and `element-fingerprint.ts:198` at `v1.9.0`). The Disclosure Requirements say: "If an extension introduces different user data practices after installation, the extension must prominently disclose data practice changes." Whether What's new is the place for it is the owner's call; the same follow-up ticket.
