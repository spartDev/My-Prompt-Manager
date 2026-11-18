/**
 * Sets each Welcome screenshot of tests/e2e/welcome/welcome.visual.spec.ts beside the mockup's same screen, shot by
 * scripts/welcome-mockup-shots.mjs: the extension on the left, the mockup on the right, one caption line above.
 *
 * Each PNG of <ours> needs a file of the same name in <mockup>; the image is written under that name in <out>, so
 * scripts/pr-assets.sh pairs <screen>-<surface>-light.png with -dark.png. An exit screen also gets
 * notification-<surface>-<theme>.png, the top 90 px of both halves: the mockup's Library is the Atelier 1C
 * redesign, which has not shipped, so only the Notification at the top compares like for like.
 *
 * Usage: node scripts/welcome-side-by-side.mjs <ours dir> <mockup dir> <out dir>
 */
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

const SCREENS = {
  step1: 'Welcome step 1',
  step2: 'Welcome step 2 (blank filled)',
  step3: 'Welcome step 3 (Packs)'
};
const SIZES = { popup: 'popup 400×500', sidepanel: 'side panel 400×860' };
const MOCKUPS = { light: 'MPM-C-Atelier', dark: 'MPM-C-Atelier-Sombre' };
const NOTIFICATION_HEIGHT = 90;

const [oursDir, mockupDir, outDir] = process.argv.slice(2);
if (!oursDir || !mockupDir || !outDir) {
  process.stderr.write('Usage: node scripts/welcome-side-by-side.mjs <ours dir> <mockup dir> <out dir>\n');
  process.exit(2);
}

const dataUrl = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;

/** The caption line of one pair: the screen, its size and theme, and what each half is */
const captionOf = (screen, surface, theme, cropped) => {
  const where = `${SIZES[surface]} · ${theme}`;
  if (screen !== 'exit') {
    return `${SCREENS[screen]} · ${where} — left: extension · right: mockup ${MOCKUPS[theme]}`;
  }
  return cropped
    ? `Exit, the Notification (top ${String(NOTIFICATION_HEIGHT)} px) · ${where} — left: extension · right: mockup`
    : `Exit · ${where} — right: the mockup's Library, Atelier 1C, not shipped: compare the Notification only`;
};

/** The sheet of one pair; with a height, each half shows only its top */
const sheetOf = (caption, ours, mockup, height) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#D9D6DF}
  #sheet{display:inline-flex;flex-direction:column;gap:10px;padding:12px 14px 14px}
  p{margin:0;font:600 13px/1.3 -apple-system,system-ui,sans-serif;color:#1D1530;white-space:nowrap}
  .row{display:flex;gap:16px;align-items:flex-start}
  .half{outline:1px solid rgba(0,0,0,.25);overflow:hidden${height ? `;height:${String(height)}px` : ''}}
  img{display:block}
</style></head><body><div id="sheet"><p>${caption}</p><div class="row"><div class="half"><img src="${dataUrl(ours)}"></div><div class="half"><img src="${dataUrl(mockup)}"></div></div></div></body></html>`;

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 400 } });
  const compose = async (file, html) => {
    await page.setContent(html);
    await page.evaluate(async () => {
      await Promise.all([...document.images].map((image) => image.decode()));
    });
    const sheet = page.locator('#sheet');
    const box = await sheet.boundingBox();
    if (!box) {
      throw new Error(`${file}: the sheet has no box`);
    }
    await page.setViewportSize({ width: Math.ceil(box.width), height: Math.ceil(box.height) });
    await sheet.screenshot({ path: path.join(outDir, file) });
    process.stdout.write(`${file}: ${String(Math.ceil(box.width))}x${String(Math.ceil(box.height))}\n`);
  };

  for (const name of fs.readdirSync(oursDir).filter((file) => file.endsWith('.png'))) {
    const [screen, surface, theme] = path.basename(name, '.png').split('-');
    if (!(screen in SCREENS || screen === 'exit') || !(surface in SIZES) || !(theme in MOCKUPS)) {
      throw new Error(`${name}: not a name of the visual spec, <screen>-<surface>-<theme>.png`);
    }
    const ours = path.join(oursDir, name);
    const mockup = path.join(mockupDir, name);
    if (!fs.existsSync(mockup)) {
      throw new Error(`${name}: no file of that name in ${mockupDir}`);
    }
    await compose(name, sheetOf(captionOf(screen, surface, theme, false), ours, mockup));
    if (screen === 'exit') {
      await compose(
        `notification-${surface}-${theme}.png`,
        sheetOf(captionOf(screen, surface, theme, true), ours, mockup, NOTIFICATION_HEIGHT)
      );
    }
  }
} finally {
  await browser.close();
}
