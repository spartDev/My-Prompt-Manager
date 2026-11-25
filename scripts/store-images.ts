/**
 * npm run store:images: the Chrome Web Store images of the Release in package.json, from its real
 * UI: five screenshots (1280 x 800), the small promo tile (440 x 280) and the marquee
 * (1400 x 560), written as 24-bit PNGs with no alpha channel to store-assets/<version>/.
 *
 * It builds nothing: it loads the build in dist/ into Chromium (npm run build first), seeds a demo
 * Library, takes the real UI from it (scripts/store-images/scenes.ts) and sets it in the owner's
 * compositions (scripts/store-images/layouts.ts). store-assets/README.md says how to make the
 * images of the next Release.
 *
 *   npm run store:images                       write store-assets/<version>/
 *   npm run store:images -- --out /tmp/shots   write somewhere else, to compare two runs
 *   npm run store:images -- --dist /tmp/dist   take another build
 *   npm run store:images -- --texts /tmp/t.txt write the text of each image and of its UI, to grep its claims
 *   npm run store:images -- --headed           watch the browser take the scenes
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LogoIcon } from '../src/components/icons/HeaderIcons';

import { parseStoreImagesArgs } from './store-images/args';
import { distProblem } from './store-images/dist';
import { type Assets, storeImages } from './store-images/layouts';
import { flattenPng, pngInfo } from './store-images/png';
import { captureScenes } from './store-images/scenes';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** A path as the report prints it: from the repository when it is in it */
const shown = (file: string): string => (file.startsWith(`${ROOT}${path.sep}`) ? path.relative(ROOT, file) : file);

const releaseOf = (root: string): string => {
  const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string };
  return version;
};

/** The font, the icon and the mark the images draw, all from the build and the sources it was built from */
const assetsOf = (dist: string): Assets => {
  const manifest = JSON.parse(readFileSync(path.join(dist, 'manifest.json'), 'utf8')) as { icons: Record<string, string> };
  return {
    font: readFileSync(path.join(dist, 'fonts', 'SchibstedGrotesk-latin.woff2')),
    icon: readFileSync(path.join(dist, manifest.icons['128'])),
    mark: renderToStaticMarkup(createElement(LogoIcon))
  };
};

async function main(): Promise<void> {
  const options = parseStoreImagesArgs(process.argv.slice(2), path.join(ROOT, 'dist'));
  const problem = distProblem(ROOT, options.dist);
  if (problem) {
    process.stderr.write(`store:images: ${problem}\n`);
    process.exitCode = 1;
    return;
  }
  const version = releaseOf(ROOT);
  const out = options.out ?? path.join(ROOT, 'store-assets', version);
  process.stdout.write(`Store images of ${version}, from ${shown(options.dist)}\n`);

  const scenes = await captureScenes(
    { root: ROOT, dist: options.dist, version, headless: options.headless, onScene: (name) => { process.stdout.write(`  scene: ${name}\n`); } },
    Date.now()
  );
  const images = storeImages(scenes, assetsOf(options.dist));

  mkdirSync(out, { recursive: true });
  const texts: string[] = [];
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    for (const image of images) {
      await page.setViewportSize({ width: image.width, height: image.height });
      await page.setContent(image.html, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const words = (await page.locator('body').innerText()).split('\n').map((line) => line.trim()).filter(Boolean);
      texts.push([image.file, `  image: ${words.join(' | ')}`, ...image.scenes.map((scene) => `  ui: ${scene.text}`)].join('\n'));
      const png = flattenPng(await page.screenshot({ type: 'png', caret: 'hide', animations: 'disabled' }), image.ground);
      const info = pngInfo(png);
      if (info.width !== image.width || info.height !== image.height || info.hasAlpha) {
        throw new Error(`${image.file} came out ${String(info.width)} x ${String(info.height)}${info.hasAlpha ? ' with alpha' : ''}`);
      }
      const file = path.join(out, image.file);
      writeFileSync(file, png);
      const sha256 = createHash('sha256').update(png).digest('hex');
      process.stdout.write(`  ${shown(file)}  ${String(info.width)} x ${String(info.height)}, no alpha, sha256 ${sha256}\n`);
    }
  } finally {
    await browser.close();
  }
  if (options.texts) {
    writeFileSync(options.texts, `${texts.join('\n\n')}\n`);
    process.stdout.write(`The text of each image and of its UI: ${shown(options.texts)}\n`);
  }
  process.stdout.write(`Check them with: sips -g pixelWidth -g pixelHeight -g hasAlpha ${shown(out)}/*.png\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`store:images: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    process.exitCode = 1;
  });
}
