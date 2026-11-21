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
- [ ] Each permission and host permission of `manifest.json` justified in `chrome-web-store-listing.md`, and nothing else
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

A Release's zip is made, attested and submitted by `.github/workflows/release.yml` on the push of its tag (see [`RELEASE_WORKFLOW.md`](RELEASE_WORKFLOW.md)): the contents of `dist/`, `manifest.json` at the root, named `prompt-library-extension-vX.Y.Z.zip`. Make one locally only to try it by hand:

1. **Create the package:**
   ```bash
   npm run package
   # reinstalls, rebuilds, then creates prompt-library-extension-v{version}.zip
   ```

   Or from an existing build:
   ```bash
   cd dist/
   zip -r ../prompt-library-extension-vX.Y.Z.zip .
   cd ..
   ```

2. **Verify Package Contents:**
   The store requires `manifest.json` at the root of the zip, not under a `dist/` folder. The zip should contain:
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

The text pasted into the Developer Dashboard is in [`chrome-web-store-listing.md`](../chrome-web-store-listing.md): the detailed description, the category and language, and the Privacy practices (single purpose, one justification per permission and per host permission of `manifest.json`, remote code). The summary is not pasted: the store shows the `description` of the package's `manifest.json`, which the Dashboard cannot edit.

**Screenshots** (the five store images, with their headlines):
1. **`//`**: "Stop retyping your prompts", a Platform composer with `//` typed and the Prompt selector open
2. **Variables**: "Write it once. Reuse it everywhere.", the selector's Variables step, then the Insertion with its Undo confirmation
3. **Platforms**: "One Library for every AI chat", the Prompts button in the composer of each Platform
4. **Library**: "A home for every prompt you write", the side panel Library with the Library filter, Categories and cards, and the line "Stays on your device. No account, no cloud."
5. **Packs**: "Not sure where to start? Pick a Pack", the Welcome's Packs step

**Promotional images:** the small promo tile, "Your prompts, one // away", and the marquee, "Write it once. Reuse it everywhere."

### Required Assets

**Icons:**
- 16x16px - Toolbar icon
- 32x32px - Extension management page
- 48x48px - Extension management page  
- 128x128px - Chrome Web Store

**Screenshots:**
- At least one, up to five
- 1280x800 or 640x400 pixels; 1280x800 is preferred, and the store shows every screenshot downscaled to 640x400
- JPEG or 24-bit PNG, with no alpha
- Square corners, no padding (full bleed)
- The real UI of the Release

**Promotional Images (Optional):**
- Small promo tile: 440x280px. An item without one is shown after the items that have one
- Marquee promo tile: 1400x560px. An item without one cannot be featured in the marquee
- JPEG or 24-bit PNG, with no alpha

Sizes from Google's [Complete your listing information](https://developer.chrome.com/docs/webstore/cws-dashboard-listing#graphic-assets) and [Supplying Images](https://developer.chrome.com/docs/webstore/images#screenshots), which name the format "PNG or JPEG"; the Dashboard's upload fields ask for JPEG or 24-bit PNG with no alpha.

## Submission Process

### 1. Developer Account Setup
1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. Sign in with Google account
3. Pay $5 one-time registration fee (if not already registered)
4. Complete developer profile

### 2. Upload Extension
The Chrome Web Store API cannot create an item, so the first version of an item is uploaded by hand; every later Release goes through `release.yml` (see [Version Updates](#version-updates)).

1. Click "Add a new item"
2. Upload the zip file created earlier
3. Wait for automatic analysis to complete
4. Address any warnings or errors

### 3. Complete Store Listing
1. **Item Details:**
   - Fill in the description (the summary is the `description` of `manifest.json`, which the Dashboard cannot edit)
   - Select category (Workflow & Planning)
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

### 5. Submit for Store review
1. Review all information for accuracy
2. Click "Submit for review"
3. The Submission enters the Store review queue
4. Store review typically takes 1-3 business days

## Post-Submission

### Store review
- **Automated checks:** technical compliance
- **Manual examination:** a Google reviewer examines functionality and compliance
- **Possible Outcomes:**
  - ✅ **Approved:** the Publication follows at once (`release.yml` submits with the default publish type)
  - ❌ **Refused:** Google's e-mail to the publisher account gives the reasons

### If Refused
A refused Release is never submitted again:
1. Read the reasons carefully
2. Fix the code or the listing
3. Release the fix as the next version, with a new tag (the `release` skill). Its CHANGELOG section and its What's new notes carry over the refused Release's notes too: What's new shows only the installed Release's notes, and no user installed the refused one
4. `release.yml` submits it like any Release

### After Approval
- Extension appears in Chrome Web Store
- Users can install via store link
- Monitor user reviews and feedback
- Plan updates and improvements

## Maintenance

### Version Updates
1. Bump the version and write its CHANGELOG section in a bump PR (the `release` skill, `.claude/skills/release/SKILL.md`)
2. If the store listing changes with this Release, edit it in the Developer Dashboard first, and save it without submitting it: the API changes the package, not the listing, and the Submission sends the item's draft, listing included, to Store review. Once the Submission is in Store review its draft cannot change unless the Submission is cancelled, and `release.yml` never submits a cancelled version again
3. Tag the bump's merge commit `vX.Y.Z` and push the tag
4. `release.yml` validates, builds and attests the zip, creates the GitHub Release, then, once the owner approves the `chrome-webstore` environment, uploads the zip and submits it for Store review through the Chrome Web Store API V2 ([`RELEASE_WORKFLOW.md`](RELEASE_WORKFLOW.md); setup in [`GITHUB_ENVIRONMENTS.md`](GITHUB_ENVIRONMENTS.md))

### Listing-only Updates
New text or images with no new Release, as for the 2.0 listing on the published 2.0.0 (`chrome-web-store-listing.md`):
1. Edit the listing on the Developer Dashboard tabs and upload the images; no package is needed ([Update your Chrome Web Store item](https://developer.chrome.com/docs/webstore/update#uploading-new-listing-metadata))
2. Click Submit for review. Google reviews it like any submission, and the store keeps the published listing until it passes ([Review process](https://developer.chrome.com/docs/webstore/review-process#rejection))
3. Push no Release tag while it waits: a draft awaiting review cannot change unless its review is cancelled ([Manage your item](https://developer.chrome.com/docs/webstore/update#manage_your_item))

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