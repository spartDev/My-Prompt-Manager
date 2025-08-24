# Privacy Policy for My Prompt Manager

**Effective Date:** 24/08/2025  
**Last Updated:** 24/08/2025

## Introduction

My Prompt Manager ("we," "our," or "the extension") is a Chrome extension that helps users store, organize, and quickly access their personal collection of text prompts. This Privacy Policy explains how we handle your information when you use our Chrome extension.

**Key Privacy Commitment:** My Prompt Manager operates entirely on your local device. We do not collect, transmit, store, or share any of your personal data with external servers or third parties.

## Information We Collect and How We Use It

### Data Stored Locally on Your Device

My Prompt Manager stores the following information locally on your device using Chrome's storage API:

- **Your Prompts:** Text content, titles, and categories you create
- **Categories:** Custom category names and organization preferences
- **Settings:** Your preferences for theme, display options, and extension behavior
- **Usage Data:** Basic information like creation and modification timestamps for your prompts

**Important:** All this data remains exclusively on your device and is never transmitted to external servers.

### Data We Do NOT Collect

- Personal identifying information (name, email, etc.)
- Browsing history or website activity
- Usage analytics or telemetry
- Device information beyond what's necessary for extension functionality
- Any data from the websites you visit

## Why We Need Broad Permissions

Our extension requests the following permissions and here's why each is necessary:

### `<all_urls>` (Access to All Websites)
- **Purpose:** To detect AI platforms (Claude, ChatGPT, Perplexity, etc.) and inject our prompt library icon
- **What We Do:** Our content script only activates on recognized AI platforms to provide seamless prompt integration
- **What We Don't Do:** We do not read, store, or transmit any content from websites you visit

### `storage` Permission
- **Purpose:** To save your prompts, categories, and settings locally on your device
- **Implementation:** Uses Chrome's local storage API exclusively - no external servers involved

### `activeTab` and `tabs` Permissions
- **Purpose:** To interact with the current tab when you're on supported AI platforms
- **Scope:** Only used to inject our interface elements, never to access tab content

### `scripting` Permission
- **Purpose:** To inject our prompt library interface into AI platform pages
- **Function:** Enables the seamless integration that makes prompts easily accessible

## How Your Data is Protected

### Local Storage Only
- All your data is stored locally using Chrome's encrypted storage system
- Your prompts and settings never leave your device
- No network requests are made to external servers

### No Third-Party Access
- We do not share data with advertisers, analytics companies, or other third parties
- No tracking pixels, cookies, or external scripts are used
- Your data is completely private to you

### Data Security
- Chrome's storage API provides built-in encryption and security
- Your data is protected by Chrome's security model
- No passwords or sensitive authentication data is stored

## Your Data Rights and Control

### Complete Ownership
- You own all the prompts and data you create
- You can export your data at any time through the extension's settings
- You can delete individual prompts, categories, or all data instantly

### Data Portability
- Export functionality allows you to backup or transfer your prompts
- Data is exported in standard JSON format for compatibility
- No vendor lock-in - your data remains accessible

### Deletion Rights
- Delete individual prompts or categories at any time
- Clear all data through the extension settings
- Uninstalling the extension removes all stored data from your device

## Chrome Web Store Compliance

This extension complies with all Chrome Web Store policies:

- **Minimal Data Collection:** We collect only what's necessary for functionality
- **Transparent Permissions:** All permissions are clearly justified and necessary
- **No Deceptive Practices:** The extension does exactly what it promises
- **User Control:** Users maintain complete control over their data

## Children's Privacy

My Prompt Manager does not collect any personal information from users of any age. Since all data remains on the user's device and no personal information is processed, the extension is safe for users of all ages. However, we recommend parental supervision for children using any browser extensions.

## International Privacy Laws Compliance

### GDPR (European Union)
Since we don't collect or process personal data:
- No consent banners are necessary
- No data processing agreements are required  
- No data subject requests need to be handled
- No data breach notifications are applicable

### CCPA (California)
We do not sell, share, or process personal information as defined by CCPA:
- No personal information is collected
- No third-party sharing occurs
- No opt-out mechanisms are needed

### Other Jurisdictions
Our privacy-by-design approach ensures compliance with privacy laws worldwide by simply not collecting personal data.

## Third-Party Services

My Prompt Manager does not integrate with any third-party services, analytics platforms, or external APIs. The extension operates completely independently and offline.

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect changes in our practices or for legal compliance. When we do:

- We will update the "Last Updated" date at the top of this policy
- Significant changes will be communicated through the Chrome Web Store update notes
- Continued use of the extension after changes constitutes acceptance of the updated policy

## Data Retention

Since all data is stored locally on your device:
- Data persists as long as you keep the extension installed
- Uninstalling the extension automatically deletes all stored data
- You can manually delete specific data or clear all data at any time
- No data retention policies apply to external servers (because there are none)

## Technical Implementation Details

For transparency, here's how we implement privacy-by-design:

### Storage Implementation
- Uses `chrome.storage.local` API exclusively
- No cloud storage or external databases
- All operations are synchronous and local

### Content Script Behavior
- Activates only on recognized AI platforms
- Only injects UI elements, never reads page content
- Does not intercept or modify user input or website data
- Minimal DOM interaction focused solely on UI injection

### Network Activity
- Zero network requests to external servers
- No analytics, telemetry, or usage reporting
- No automatic updates that transmit user data

## Contact Information

If you have any questions about this Privacy Policy or our privacy practices:

**Developer:** Thomas Roux  
**Email:** thomas.roux@gmail.com  
**GitHub:** https://github.com/spartDev  
**Chrome Web Store:** https://chromewebstore.google.com/detail/my-prompt-manager

## Verification

You can verify our privacy claims by:

1. **Reviewing the Source Code:** Our code is available for inspection
2. **Network Monitoring:** Use browser dev tools to confirm no external requests
3. **Chrome Developer Tools:** Inspect the extension's storage to see only local data
4. **Community Feedback:** Check user reviews and community discussions

## Legal Basis for Processing (GDPR)

Since My Prompt Manager doesn't collect personal data as defined by GDPR, no legal basis for processing is required. The extension operates under the principle of data minimization by collecting no personal data whatsoever.

## Conclusion

My Prompt Manager is designed with privacy as a fundamental principle. By keeping all data local and making no external connections, we ensure that your prompts, ideas, and usage patterns remain completely private to you.

This privacy-first approach means you can use My Prompt Manager with complete confidence that your creative work and personal productivity data stays exactly where it belongs - with you.

---

*This privacy policy is effective as of the date noted above and applies to all versions of My Prompt Manager Chrome extension.*