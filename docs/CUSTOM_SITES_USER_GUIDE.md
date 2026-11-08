# Custom Websites: Non-Technical Guide

The Custom Websites section lets you bring My Prompt Manager to any AI site that isn't supported out of the box. This guide walks you through both ways to add a site—manually and with a shared configuration—without assuming any technical background.

> [Image placeholder: the AI sites group, with custom sites after the AI platforms and the "Add a custom site" row last]

## Before You Start
- Open the extension settings and scroll to **AI sites**. Custom sites are listed after the AI platforms.
- Check that the site you want to add is open in another browser tab. This helps the extension fill in details for you.
- Decide whether you want to configure the site yourself or import settings that someone else shared.

## Option 1: Add Manually
Use this path when you want to make the integration from scratch.

1. Click **Add a custom site**, the last row of **AI sites**.
2. Choose **Add manually** when the options appear.
3. Fill in the form:
   - **Website URL** – copy the address of the page where you chat with the AI. You can paste just the main site (for example, `https://example.ai`).
   - **Display Name** – the label you’ll see in the list (for instance, “Example AI”).
   - **Prompt Icon Placement** – leave it on automatic unless you need the icon in a very specific spot.
   - **Custom Selector (optional)** – use **Pick Element** if you want to choose the exact input box on the page.
   - **Offsets & Z-Index (optional)** – fine-tune the position if the icon needs nudging left/right/up/down or if it needs to sit on top of other page elements.
   - **Description (optional)** – add a note that helps you remember what this setup does.
4. Click **Add Site**. The extension will ask Chrome for permission if it needs access to the page.
5. Refresh the AI site tab and look for the prompt library icon near the chat input.

> [Image placeholder: Manual configuration form highlighting URL, Display Name, and Pick Element button]

### Tips for Manual Setup
- If the site uses multiple subdomains (for example, `chat.example.ai` and `app.example.ai`), add the primary one first. You can come back and add more.
- The **Pick Element** button opens a helper window so you can click directly on the chat box. Follow the on-screen instructions and press **Escape** if you want to cancel.
- If the icon doesn’t appear right away, reload the page or make sure the site is turned on in **AI sites**.

## Option 2: Import Configuration
Choose this when someone shares a configuration code with you.

1. Click **Add a custom site**.
2. Pick **Import configuration**.
3. Paste the code into the text box.
4. Select **Preview configuration** to review the details—hostname, display name, and any warnings.
5. If everything looks good, click **Import**. The extension will request any permissions it needs.
6. You’ll see a confirmation once the site is imported. The new site appears in **AI sites** and is turned on automatically.

> [Image placeholder: Import configuration option with pasted code and preview button]

### Troubleshooting Imports
- **Invalid code** – Double-check that the code is complete and hasn’t been altered by formatting tools.
- **Site already built-in** – Some hostnames are already covered by the extension. You’ll get a message if you try to import one of those.
- **Permission denied** – Chrome may show a popup asking for site access. You need to allow it so My Prompt Manager can work on that site.

## Managing Your Custom Sites
- **Turn a site on or off** with the switch on its row.
- Open the **⋯** menu at the end of its row to:
  - **Export configuration**, which copies a code you can share with teammates.
  - **Remove** the site if you no longer need it. You can always add it back later.

> [Image placeholder: a custom site row, its switch, and its ⋯ menu with Export configuration and Remove]

## Frequently Asked Questions
**Will this affect the original website?**
No. The extension only adds the prompt library icon and doesn’t change the site’s content.

**Can I add the same site twice?**
If the hostname matches a site you already added, you’ll see a warning. You can replace it instead.

**Do I need to keep the settings tab open?**
No. Once the site is added, the extension remembers it. Just keep the extension enabled in Chrome.

---
If you run into any trouble, open the settings again and check for error messages at the top of the Custom Sites section. You can also remove and reimport a configuration if you suspect something went wrong during setup.
