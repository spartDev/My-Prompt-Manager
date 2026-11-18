/**
 * Shoots the Atelier 1C mockup's Welcome at the sizes of tests/e2e/welcome/welcome.visual.spec.ts, so each of its
 * screenshots has the mockup's same screen beside it (scripts/welcome-side-by-side.mjs).
 *
 * The mockup is the screen "empty" of the component MPM-C-Atelier (light) and MPM-C-Atelier-Sombre (dark), in the
 * private artifact https://claude.ai/code/artifact/cbc1341a-bc8d-4568-af95-49c3fd7477a2. It is not in the repository:
 * read project/support.js, project/MPM-C-Atelier.dc.html and project/MPM-C-Atelier-Sombre.dc.html into a folder with
 * the Artifact tool, as the design-system skill says (.claude/skills/design-system/SKILL.md). The script writes a host
 * page per theme and format beside copies of them in a temporary folder, serves it on a free port of 127.0.0.1, and
 * shoots with the playwright devDependency's Chromium. The mockup loads its font from Google Fonts: it needs the
 * network.
 *
 * Screens, as the spec names them, <screen>-<surface>-<theme>.png: step1, step2 and step3 in the popup (format popup,
 * drawn at the real popup's 400 x 500, not the mockup's 400 x 580) and the side panel (format side, 400 x 860); exit,
 * in the popup only, the mockup's Library after its own "Add 9 prompts", with its toast. Each is taken as the spec
 * takes ours: animations ended, the endless ones cancelled, the pointer on the header, step 2 while the blank holds
 * the whole name. The mockup's toast hides after 2.7 s with no hover hold, so the script keeps it for the screenshot.
 *
 * Usage: node scripts/welcome-mockup-shots.mjs <folder with the three mockup files> <out dir>
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { chromium } from 'playwright';

const MOCKUP_FILES = ['support.js', 'MPM-C-Atelier.dc.html', 'MPM-C-Atelier-Sombre.dc.html'];
const COMPONENTS = { light: 'MPM-C-Atelier', dark: 'MPM-C-Atelier-Sombre' };
const SIZES = {
  popup: { format: 'popup', width: 400, height: 500 },
  sidepanel: { format: 'side', width: 400, height: 860 }
};
const NAME = 'Claire, Head of Sales';
const BLANK_ATTEMPTS = 5;

const [mockupDir, outDir] = process.argv.slice(2);
if (!mockupDir || !outDir || MOCKUP_FILES.some((file) => !fs.existsSync(path.join(mockupDir, file)))) {
  process.stderr.write(`Usage: node scripts/welcome-mockup-shots.mjs <folder holding ${MOCKUP_FILES.join(', ')}> <out dir>\n`);
  process.exit(2);
}

/** The page that shows one theme of the mockup's Welcome in one format, at the size it is shot */
const hostPage = (component, { format, width, height }) => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Welcome mockup</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet><style>html,body{margin:0;background:#ECEAE4}</style></helmet>
<div style="width:${width}px;height:${height}px;overflow:hidden"><dc-import name="${component}" screen="empty" format="${format}" frame="{{ true }}" hint-size="100%,100%" style="width:100%;height:100%"></dc-import></div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props="{}">
class Component extends DCLogic {
  renderVals(){ return {}; }
}
</script>
</body>
</html>
`;

const site = fs.mkdtempSync(path.join(os.tmpdir(), 'welcome-mockup-'));
for (const file of MOCKUP_FILES) {
  fs.copyFileSync(path.join(mockupDir, file), path.join(site, file));
}
for (const [theme, component] of Object.entries(COMPONENTS)) {
  for (const [surface, size] of Object.entries(SIZES)) {
    fs.writeFileSync(path.join(site, `welcome-${theme}-${surface}.dc.html`), hostPage(component, size));
  }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const server = http.createServer((request, response) => {
  const name = path.basename(decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname));
  const file = path.join(site, name);
  if (!name || !fs.existsSync(file)) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'content-type': TYPES[path.extname(name)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(response);
});
await new Promise((resolve) => {
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
const port = typeof address === 'object' && address ? address.port : 0;

/** Resolves once every finite animation has ended, and two frames have been drawn since */
const animationsDone = (page) =>
  page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect && animation.effect.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined))
    );
    for (let frame = 0; frame < 2; frame++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });

const shoot = (page, file, { width, height }) => page.screenshot({ path: file, animations: 'disabled', clip: { x: 0, y: 0, width, height } });

/** Step 2 while the blank holds the whole name: shot just after the letter that completes it, again if it changed */
const shootWholeBlank = async (page, file, size) => {
  for (let attempt = 1; attempt <= BLANK_ATTEMPTS; attempt++) {
    await page.evaluate(
      (name) =>
        new Promise((resolve, reject) => {
          const blank = document.querySelector('span > span[style*="cBlink"]')?.parentElement;
          if (!blank) {
            reject(new Error('The mockup has no blank with a blinking caret'));
            return;
          }
          let complete = false;
          const observer = new MutationObserver(() => {
            if (!complete && blank.textContent === name) {
              complete = true;
              window.blankChanged = false;
              resolve();
            } else if (complete) {
              window.blankChanged = true;
              observer.disconnect();
            }
          });
          observer.observe(blank, { childList: true, characterData: true, subtree: true });
        }),
      NAME
    );
    await shoot(page, file, size);
    if ((await page.evaluate(() => window.blankChanged)) === false) {
      return;
    }
  }
  throw new Error(`${file}: no screenshot with the whole name in ${String(BLANK_ATTEMPTS)} cycles`);
};

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const theme of Object.keys(COMPONENTS)) {
    for (const [surface, size] of Object.entries(SIZES)) {
      const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.goto(`http://127.0.0.1:${String(port)}/welcome-${theme}-${surface}.dc.html`);
      await page.getByText('Your best prompts, one tap away').waitFor();
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      const file = (screen) => path.join(outDir, `${screen}-${surface}-${theme}.png`);
      for (const step of [1, 2, 3]) {
        await animationsDone(page);
        await page.mouse.move(size.width / 2, 4);
        if (step === 2) {
          await shootWholeBlank(page, file('step2'), size);
        } else {
          await shoot(page, file(`step${String(step)}`), size);
        }
        if (step < 3) {
          await page.getByText('Next', { exact: true }).click();
          await page.getByText(step === 1 ? 'Leave blanks, fill them later' : 'Start with a pack').waitFor();
        }
      }
      if (surface === 'popup') {
        await page.evaluate(() => {
          const setTimeoutOf = window.setTimeout;
          window.setTimeout = (callback, delay, ...rest) => (delay === 2700 ? 0 : setTimeoutOf(callback, delay, ...rest));
        });
        await page.getByText('Add 9 prompts', { exact: true }).click();
        await page.getByText('9 prompts added').waitFor();
        await page.waitForTimeout(100);
        await animationsDone(page);
        await page.mouse.move(size.width / 2, 4);
        await shoot(page, file('exit'), size);
      }
      await page.close();
      process.stdout.write(`${theme} ${surface}: done\n`);
    }
  }
} finally {
  await browser.close();
  server.close();
  fs.rmSync(site, { recursive: true, force: true });
}
