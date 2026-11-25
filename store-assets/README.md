# Store images

The images of the Chrome Web Store listing, one folder per Release: `store-assets/<version>/`. `npm run store:images` makes them from the Release's real UI; nothing here is drawn by hand.

| File | Store slot | Size |
|---|---|---|
| `screenshot-1-trigger.png` | Screenshot 1: `//` opens the Prompt selector | 1280 x 800 |
| `screenshot-2-variables.png` | Screenshot 2: Variables, then the Insertion and its Undo | 1280 x 800 |
| `screenshot-3-platforms.png` | Screenshot 3: the Prompts button in each Platform's composer | 1280 x 800 |
| `screenshot-4-library.png` | Screenshot 4: the side panel's Library | 1280 x 800 |
| `screenshot-5-packs.png` | Screenshot 5: the Welcome's Packs | 1280 x 800 |
| `small-promo-tile.png` | Small promo tile | 440 x 280 |
| `marquee.png` | Marquee promo tile | 1400 x 560 |

All are 24-bit PNGs with no alpha channel, as the Store asks. Upload the screenshots in their number order in the Developer Dashboard, under Store listing.

**Hold screenshot 5 while My-Prompt-Manager-1c88 is open.** Screenshot 5 shows the 2.0.0 Welcome, which names Copilot among the Platforms where `//` works, and the listing says 2.0.0 does not support Copilot. While ticket 1c88 is open, upload screenshots 1 to 4, the small promo tile and the marquee, and hold screenshot 5. Upload it as the fifth screenshot once 1c88 shows that Copilot works at the address the Welcome names, or once a Release changes the Welcome and `npm run store:images` has remade the image. Google asks for at least one screenshot and allows up to five, so four are fine.

## Make the images of a Release

1. Set the Release in `package.json` and `manifest.json`, then build it: `npm run build`. The script never builds. It stops and says so when `dist/` is missing, of another version, or older than a file the build reads: `src/`, `public/`, `manifest.json`, `vite.config.ts`, `package.json`, `tailwind.config.js`, `postcss.config.js`, `tsconfig.json`, or the installed packages (`node_modules/.package-lock.json`).
2. `npm run store:images`. It writes the seven files to `store-assets/<version>/` and prints each one's size and sha256. It took 9 s on an Apple-silicon Mac (2026-11-25, `time npm run store:images`).
   - `npm run store:images -- --out <dir>` writes them elsewhere, to compare two runs.
   - `--texts <file>` writes, for each image, the text the script puts in it and the text of the UI in its scenes, to check the images' claims with `grep`. It reads the pages' text, not the pixels. It leaves out placeholders drawn by CSS or by an attribute, such as the composers' "Ask anything". It includes text that is off screen or hidden, such as Prompts below the fold, a tab cut at the edge, or text for screen readers.
   - `--headed` shows the browser while it takes the scenes.
   - If the extension does not load (a broken build), the script stops within a minute, closes Chromium and deletes its temp profile.
3. Check them: `sips -g pixelWidth -g pixelHeight -g hasAlpha store-assets/<version>/*.png` gives the sizes above and `hasAlpha: no`. Then look at each one.
4. Commit the folder. Keep the folders of earlier Releases: they are what the Store showed then.

On macOS with the same Playwright version, two runs on the same build write the same bytes, so a changed file means a changed image. Make the images on macOS. On Linux they change: the side panel shows "Ctrl K" where macOS shows "⌘K" (`src/utils/modifierKey.ts`), and the composers' text falls back from the system font (`-apple-system`, Helvetica Neue) to another one. A Playwright update can also change pixels, through its Chromium.

## How they are made

`scripts/store-images.ts` loads `dist/` into Playwright's Chromium the way the e2e tests do: a new profile with no account. It seeds `chrome.storage.local` with a demo Library (`scripts/store-images/demoLibrary.ts`):

- eight English Prompts in Product, Engineering, Writing and Hiring;
- two of them Pinned and two with Variables, with usage counts;
- no person or account named.

Then it takes each scene from the real UI (`scripts/store-images/scenes.ts`):

- **The Platforms' composers.** They are the sanitized copies in `tests/fixtures/composers/`, served at each Platform's own address. The built content script runs on them as it does on the Platform: it places the Prompts button, opens the Prompt selector on `//`, shows the Variables step and inserts the Prompt. Around each copy, `scripts/store-images/composers.ts` draws a plain card in neutral colors with simple button glyphs: no Platform's styles, logo or mark.
- **The `//` in the field.** The selector removes the `//` it was opened with. For screenshot 1, the tile and the marquee, the script writes `//` back at the end of the field, in the page, after the selector opened, so the image shows the keys that opened it.
- **The Library and the Welcome.** The side panel's Library and the Welcome are the built `sidepanel.html` and `popup.html`.

Then it sets the scenes in the compositions (`scripts/store-images/layouts.ts`, in px at the final size) with the copy of `scripts/store-images/copy.ts`, in Schibsted Grotesk from the build. Finally it takes each image at its exact size.

## What to change, and where

- **The words:** `scripts/store-images/copy.ts`. Check each claim against the code before it goes on an image, and against the Platforms as their users reach them today. `--texts` lists the text of each image and of its UI, with the limits said above.
- **The layout of an image:** its function in `scripts/store-images/layouts.ts`.
- **The demo Library:** `scripts/store-images/demoLibrary.ts`. `scripts/__tests__/store-images.test.ts` checks it stays admitted as it is, with its Categories, Pinned Prompts and Variables.
- **The Platforms the images show and name:** the list in `scripts/store-images/platforms.ts`. It gives screenshot 3's composers and both Platform lists of the copy (screenshot 3's subline, the marquee's). A Platform is shown only while the Release runs where its users land.
  - **Copilot.** Its entry is there, with `shown: false`, until ticket My-Prompt-Manager-1c88 settles copilot.microsoft.com: that address now sends users to copilot.com, a host 2.0.0 does not run on. Once Copilot works there, `shown: true` brings back its composer, and both lists read again as the owner wrote them ("…, Perplexity and Copilot").
  - **Microsoft 365 Copilot.** It has no composer of its own: in 2.0.0 a work account lands at copilot.cloud.microsoft, where the extension does not run (CHANGELOG.md, 2.0.0, Known limitations).
  - **A new Platform.** It also needs a composer fixture and its button glyphs in `scripts/store-images/composers.ts`.
- **Screenshot 5 names Copilot.** It shows the Welcome as 2.0.0 ships it, and that Welcome names Copilot among the Platforms (`welcomePlatformNames`, `src/welcome/platforms.ts`). The image follows what My-Prompt-Manager-1c88 decides for the Welcome: it changes when the Welcome does. Until then, hold it at upload (see above).
- **A change to the UI:** nothing to change here, because the next run takes the new UI. Look at the images, though: a taller selector or a wider card can need a scene's size or scale changed in `scenes.ts` or `layouts.ts`.
