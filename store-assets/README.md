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

## Make the images of a Release

1. Set the Release in `package.json` and `manifest.json`, then build it: `npm run build`. The script never builds: it stops and says so when `dist/` is missing, of another version, or older than a file of `src/`, `public/`, `manifest.json`, `vite.config.ts` or `package.json`.
2. `npm run store:images`. It writes the seven files to `store-assets/<version>/` and prints each one's size and sha256. `npm run store:images -- --out <dir>` writes them elsewhere, to compare two runs; `--headed` shows the browser while it takes the scenes. It takes about a minute.
3. Check them: `sips -g pixelWidth -g pixelHeight -g hasAlpha store-assets/<version>/*.png` gives the sizes above and `hasAlpha: no`. Then look at each one.
4. Commit the folder. Keep the folders of earlier Releases: they are what the Store showed then.

Two runs on the same build write the same bytes, so a changed file means a changed image.

## How they are made

`scripts/store-images.ts` loads `dist/` into Playwright's Chromium, in a new profile with no account, the way the e2e tests do, and seeds `chrome.storage.local` with a demo Library: eight English Prompts in Product, Engineering, Writing and Hiring, two Pinned, two with Variables, usage counts, no person or account named (`scripts/store-images/demoLibrary.ts`). Then it takes each scene from the real UI (`scripts/store-images/scenes.ts`):

- The Platforms' composers are the sanitized copies in `tests/fixtures/composers/`, served at each Platform's own address, so the built content script runs on them as it does on the Platform: it places the Prompts button, opens the Prompt selector on `//`, shows the Variables step and inserts the Prompt. Around each copy, `scripts/store-images/composers.ts` draws a plain card in neutral colors with simple button glyphs: no Platform's styles, logo or mark.
- The selector removes the `//` it was opened with. For screenshot 1, the tile and the marquee, the script writes `//` back at the end of the field, in the page, after the selector opened, so the image shows the keys that opened it.
- The side panel's Library and the Welcome are the built `sidepanel.html` and `popup.html`.

Then it sets the scenes in the compositions (`scripts/store-images/layouts.ts`, in px at the final size) with the copy of `scripts/store-images/copy.ts`, in Schibsted Grotesk from the build, and takes each image at its exact size.

## What to change, and where

- The words: `scripts/store-images/copy.ts`. Check each claim against the code before it goes on an image.
- The layout of an image: its function in `scripts/store-images/layouts.ts`.
- The demo Library: `scripts/store-images/demoLibrary.ts`; `scripts/__tests__/store-images.test.ts` checks it stays admitted as it is, with its Categories, Pinned Prompts and Variables.
- A Platform added or removed: `IMAGE_PLATFORMS`, `PLATFORM_LABELS` and the button glyphs in `scripts/store-images/composers.ts`, and the Platforms named in `copy.ts`. Screenshot 3 shows the six Platforms its subline names, as the Welcome names them (`welcomePlatformNames`, src/welcome/platforms.ts: Copilot and Microsoft 365 Copilot are linked, and named once, Copilot). Microsoft 365 Copilot has no composer of its own there: in 2.0.0 a work account lands at copilot.cloud.microsoft, where the extension does not run (CHANGELOG.md, 2.0.0, Known limitations).
- A UI change needs no change here: the next run takes the new UI. Look at the images, though: a taller selector or a wider card can need a scene's size or scale changed in `scenes.ts` or `layouts.ts`.
