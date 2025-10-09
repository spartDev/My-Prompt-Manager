# Chrome Web Store Submission Guide

This document outlines the steps to package and submit the Prompt Library extension to the Chrome Web Store.

## Pre-Submission Checklist

### 1. Code Quality
- [ ] All TypeScript errors resolved
- [ ] Build completes successfully without warnings
- [ ] All components properly tested
- [ ] Error handling implemented throughout
- [ ] Performance optimized

### 2. Extension Requirements
- [ ] Manifest V3 compliance verified
- [ ] CSP (Content Security Policy) properly configured
- [ ] Permissions documented (storage, sidePanel, <all_urls>)
- [ ] No external network requests (except CDN for optional libraries)
- [ ] Extension works completely offline
- [ ] Content scripts properly inject on supported platforms
- [ ] Side panel functionality tested

### 3. Assets Ready
- [ ] Icon files created in all required sizes (16, 32, 48, 128px)
- [ ] Screenshots prepared for store listing
- [ ] Promotional images created (if needed)
- [ ] Privacy policy prepared (if collecting data)

### 4. Testing Complete
- [ ] Manual testing on latest Chrome
- [ ] Data persistence verified
- [ ] All requirements tested
- [ ] Edge cases handled
- [ ] Error scenarios tested

## Build for Production

1. **Clean Previous Build:**
   ```bash
   rm -rf dist/
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Build Production Version:**
   ```bash
   npm run build
   ```

4. **Verify Build:**
   - Check `dist/` folder contains all necessary files
   - Test the built extension in Chrome
   - Verify no console errors

## Package for Submission

1. **Create Submission Package:**
   ```bash
   npm run package
   # This automatically creates prompt-library-extension-v{version}.zip
   ```

   Or manually:
   ```bash
   cd dist/
   zip -r ../prompt-library-extension-v1.5.0.zip .
   cd ..
   ```

2. **Verify Package Contents:**
   The zip should contain:
   ```
   manifest.json
   src/popup.html
   assets/popup-[hash].js
   assets/popup-[hash].css
   public/icons/icon-16.png
   public/icons/icon-32.png
   public/icons/icon-48.png
   public/icons/icon-128.png
   ```

## Chrome Web Store Requirements

### Store Listing Information

**Basic Information:**
- **Name:** My Prompt Manager (or "Prompt Library" if preferred)
- **Summary:** Seamlessly manage and insert prompts directly in Claude, ChatGPT, Gemini, and other AI platforms
- **Description:** See detailed description below
- **Category:** Productivity / Developer Tools
- **Language:** English

**Detailed Description:**
```
My Prompt Manager is a powerful Chrome extension for AI power users who want seamless access to their personal prompt library directly within AI chat interfaces. Whether you're working with Claude, ChatGPT, Perplexity, Gemini, or custom AI platforms, this extension brings your prompts right where you need them.

KEY FEATURES:
✅ **Native AI Platform Integration** - Library icon appears directly in Claude, ChatGPT, Perplexity, Gemini, and Mistral chat interfaces
✅ **One-Click Insertion** - Click prompts to instantly insert them into chat inputs (no copy-paste needed)
✅ **Smart Organization** - Color-coded categories, fuzzy search, duplicate detection, and intelligent sorting
✅ **Custom Site Support** - Configure any AI platform with visual element picker and fingerprinting
✅ **Side Panel UI** - Modern Chrome side panel interface alongside popup for enhanced workflow
✅ **Dark Mode** - Automatic theme detection with manual toggle for comfortable use
✅ **Import/Export** - Backup and share your prompt library with full data portability
✅ **Advanced Search** - Real-time fuzzy search with Levenshtein distance matching
✅ **Privacy First** - 100% local storage, no external servers, complete offline functionality

SUPPORTED PLATFORMS:
• Claude.ai (claude.ai)
• ChatGPT (chat.openai.com)
• Perplexity (perplexity.ai)
• Google Gemini (gemini.google.com)
• Mistral LeChat (chat.mistral.ai)
• Custom sites via settings (any AI platform with text input)

PERFECT FOR:
• AI researchers managing complex prompt templates
• Content creators with reusable AI workflows
• Developers storing code generation prompts
• Data scientists with analysis prompt libraries
• Writers organizing creative AI interactions
• Anyone who frequently uses AI chat platforms

PRIVACY & SECURITY:
• All data stored locally using Chrome's secure storage API
• No external network requests or analytics
• No data collection or transmission to servers
• Open source and auditable code
• DOMPurify sanitization for XSS protection
• Secure element fingerprinting (no sensitive data captured)

HOW TO USE:
1. Install the extension and pin the icon
2. Add prompts via popup or side panel
3. Visit any supported AI platform (Claude, ChatGPT, etc.)
4. Look for the prompt library icon near the chat input
5. Click the icon to open your prompt selector
6. Select a prompt - it instantly inserts into the chat
7. For custom sites: Settings → Custom Sites → Add Site → Use Element Picker

ADVANCED FEATURES:
• **Element Fingerprinting**: Robust element identification that survives UI updates
• **Hybrid Positioning**: CSS Anchor API + Floating UI for optimal icon placement
• **Keyboard Navigation**: Arrow keys, Enter/Escape for quick selection
• **Bulk Operations**: Multi-select, bulk delete, and category reassignment
• **Data Compression**: LZ-string compression for efficient storage
• **Levenshtein Distance**: Smart duplicate detection and fuzzy search

TECHNICAL DETAILS:
• Manifest V3 compliant
• React 18 + TypeScript
• 470+ automated tests
• Lazy-loaded positioning libraries (optimal bundle size)
• Content Security Policy compliant
• Accessible keyboard navigation (WCAG 2.1)

PERMISSIONS:
• storage - Save prompts locally
• sidePanel - Open side panel UI
• <all_urls> - Inject library icon on AI platforms

Version 1.5.0 - Continuously updated with new platform support and features!

Start supercharging your AI workflow today with My Prompt Manager!
```

**Screenshots Required:**
1. **Native Integration**: Library icon in Claude/ChatGPT chat interface
2. **Prompt Selector**: Dropdown showing prompts with search and categories
3. **Side Panel**: Modern side panel UI with prompt library
4. **Popup Interface**: Main popup with prompt cards and categories
5. **Custom Sites**: Element picker for configuring custom AI platforms
6. **Dark Mode**: Extension in dark theme showing theme toggle
7. **Category Management**: Category editor with colors and organization
8. **Settings**: Settings page showing platform toggles and custom sites

### Required Assets

**Icons:**
- 16x16px - Toolbar icon
- 32x32px - Extension management page
- 48x48px - Extension management page  
- 128x128px - Chrome Web Store

**Screenshots:**
- Minimum 1280x800 pixels
- Maximum 2560x1600 pixels
- PNG or JPEG format
- Show actual extension usage

**Promotional Images (Optional):**
- Small promo tile: 440x280px
- Large promo tile: 920x680px
- Marquee promo tile: 1400x560px

## Submission Process

### 1. Developer Account Setup
1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. Sign in with Google account
3. Pay $5 one-time registration fee (if not already registered)
4. Complete developer profile

### 2. Upload Extension
1. Click "Add a new item"
2. Upload the zip file created earlier
3. Wait for automatic analysis to complete
4. Address any warnings or errors

### 3. Complete Store Listing
1. **Item Details:**
   - Fill in description and summary
   - Select category (Productivity)
   - Add screenshots (5 recommended)
   - Add promotional images (optional)

2. **Privacy Practices:**
   - Data handling disclosure
   - Privacy policy URL (if applicable)
   - Permissions justification

3. **Pricing & Distribution:**
   - Free extension
   - Select countries/regions
   - Mature content rating (Everyone)

### 4. Review Requirements

**Content Policy Compliance:**
- [ ] No misleading functionality
- [ ] Clear and accurate descriptions
- [ ] Appropriate category selection
- [ ] No spam or repetitive content

**Technical Requirements:**
- [ ] Manifest V3 format
- [ ] Secure coding practices
- [ ] No obfuscated code
- [ ] Proper error handling

**Privacy Requirements:**
- [ ] Minimal permissions requested
- [ ] Clear data usage disclosure
- [ ] No unauthorized data collection
- [ ] Privacy policy (if collecting data)

### 5. Submit for Review
1. Review all information for accuracy
2. Click "Submit for review"
3. Extension enters review queue
4. Review typically takes 1-3 business days

## Post-Submission

### Review Process
- **Automated Review:** Initial checks for technical compliance
- **Manual Review:** Human reviewer examines functionality and compliance
- **Possible Outcomes:**
  - ✅ **Approved:** Extension goes live on Chrome Web Store
  - ❌ **Rejected:** Review feedback provided, fixes required

### If Rejected
1. Read rejection reason carefully
2. Make necessary changes to code/listing
3. Increment version number in manifest.json
4. Rebuild and repackage
5. Resubmit with changes noted

### After Approval
- Extension appears in Chrome Web Store
- Users can install via store link
- Monitor user reviews and feedback
- Plan updates and improvements

## Maintenance

### Version Updates
1. Increment version in `manifest.json`
2. Build and test new version
3. Package updated extension
4. Upload to developer dashboard
5. Update store listing if needed
6. Submit for review

### Monitoring
- Check Chrome Web Store reviews regularly
- Monitor usage statistics
- Address user feedback
- Fix reported bugs promptly

## Support Resources

- [Chrome Web Store Developer Policies](https://developer.chrome.com/docs/webstore/program-policies/)
- [Extension Development Guide](https://developer.chrome.com/docs/extensions/)
- [Chrome Web Store Help](https://support.google.com/chrome_webstore/)
- [Developer Dashboard](https://chrome.google.com/webstore/devconsole/)

## Contact Information

For submission-related questions or issues:
- Developer Email: [your-email@domain.com]
- Support URL: [your-support-url]
- Homepage: [your-project-homepage]

---

**Note:** Remember to update the author field in manifest.json and replace placeholder URLs with actual values before submission.