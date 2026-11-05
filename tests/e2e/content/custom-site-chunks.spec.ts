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
import path from 'node:path';

import { chunksReachableFrom, loadedByContentScriptLoader } from '../../../scripts/custom-site-chunks.mjs';
import { expect, test } from '../fixtures/extension';

// scripts/custom-site-chunks.mjs runs the same walk after the build and checks it against the manifest
// patterns without a browser; this spec checks what Chrome actually serves.
const DIST = path.resolve(process.cwd(), 'dist');

test.describe('Content script on a custom site', () => {
  test('every chunk the content-script loader imports is web-accessible from an origin that is not a built-in Platform', async ({
    context,
    extensionId
  }) => {
    const entries = loadedByContentScriptLoader(DIST);
    expect(entries, 'the content-script loader imports exactly one entry chunk').toHaveLength(1);

    const chunks = chunksReachableFrom(DIST, entries[0]);
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
