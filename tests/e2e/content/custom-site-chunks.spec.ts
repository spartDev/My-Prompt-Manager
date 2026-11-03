/**
 * The content script has to be loadable on a custom site: any http or https origin the user adds.
 *
 * The background injector runs a small loader there (the content script crxjs writes into the
 * manifest), which imports the content entry chunk, and that chunk imports the chunks it shares
 * with the rest of the extension (the Admission module, the bundler runtime, floating-ui, ...).
 * Chrome serves those to a web page's origin only if web_accessible_resources allows it, and for
 * custom sites the manifest allows them by pattern (`https://*` / `http://*`). A chunk that is
 * renamed, split or added without updating that list breaks every custom site, while the
 * built-in Platforms keep working because crxjs lists every chunk for their origins. This has
 * happened before (#48, #65, and with Vite 8, whose Rolldown loads the content chunk through a
 * `src-content-index.ts-*` facade), and the platform specs cannot see it, so this one asks Chrome
 * for each chunk from an origin that is none of the built-in Platforms.
 */
import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '../fixtures/extension';

const DIST = path.resolve(process.cwd(), 'dist');
const ASSETS = path.join(DIST, 'assets');

/** The chunks a built chunk imports: `from"./x.js"`, `import"./x.js"` and `import("./x.js")`, in any quotes, minified or not. */
const importsOf = (file: string): string[] => {
  const source = fs.readFileSync(path.join(ASSETS, file), 'utf-8');
  const found = [...source.matchAll(/(?:from|import)\s*\(?\s*["'`]\.\/([^"'`]+\.js)["'`]/g)].map((match) => match[1]);
  return [...new Set(found)];
};

/** The chunks the content-script loader imports, as `chrome.runtime.getURL("assets/x.js")`. */
const loadedByContentScriptLoader = (): string[] => {
  const manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf-8')) as {
    content_scripts: { js: string[] }[];
  };
  const loader = fs.readFileSync(path.join(DIST, manifest.content_scripts[0].js[0]), 'utf-8');
  return [...loader.matchAll(/getURL\(\s*["'`]assets\/([^"'`]+\.js)["'`]\s*\)/g)].map((match) => match[1]);
};

/** Every chunk reachable from `entry` through imports, entry included. */
const chunksReachableFrom = (entry: string): string[] => {
  const seen = new Set<string>([entry]);
  const queue = [entry];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const imported of importsOf(current)) {
      if (!seen.has(imported)) {
        seen.add(imported);
        queue.push(imported);
      }
    }
  }
  return [...seen];
};

test.describe('Content script on a custom site', () => {
  test('every chunk the content-script loader imports is web-accessible from an origin that is not a built-in Platform', async ({
    context,
    extensionId
  }) => {
    const entries = loadedByContentScriptLoader();
    expect(entries, 'the content-script loader imports exactly one entry chunk').toHaveLength(1);

    const chunks = chunksReachableFrom(entries[0]);
    // The point of the test is lost if the scan finds nothing to check beyond the entry
    expect(chunks.length).toBeGreaterThan(1);

    const page = await context.newPage();
    await page.route('https://custom-site.example/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!DOCTYPE html><title>Custom site</title><p>Custom site</p>' })
    );
    await page.goto('https://custom-site.example/');

    for (const chunk of chunks) {
      // no-cors: a blocked web-accessible resource rejects, an allowed one resolves; nothing is executed
      const outcome = await page.evaluate(async (url) => {
        try {
          await fetch(url, { mode: 'no-cors' });
          return 'reachable';
        } catch (error) {
          return String(error);
        }
      }, `chrome-extension://${extensionId}/assets/${chunk}`);

      expect(outcome, `${chunk} must be web-accessible from a custom site`).toBe('reachable');
    }
  });
});
