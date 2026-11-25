/**
 * A screenshot Chromium has finished painting. Once in about a dozen runs, the marquee came out with a
 * band at its bottom that repeated the top of its scene, most likely a tile painted late. Two
 * screenshots in a row that agree byte for byte are taken as the page at rest. For the composed
 * images only, which are still pages. The scenes' pages are shot once: shot again and again, a
 * composer page never gave two equal screenshots in five, likely because of what Playwright does
 * around each screenshot (the caret hidden, animations stopped).
 */

/** What steadyScreenshot needs of a Playwright page */
export interface Shooting<O> {
  screenshot(options: O): Promise<Buffer>;
}

/** Screenshots taken at most, before the page counts as never at rest */
export const STEADY_ATTEMPTS = 5;

/** Takes screenshots of `page` with `options` until two in a row are the same, and returns it */
export async function steadyScreenshot<O>(page: Shooting<O>, options: O): Promise<Buffer> {
  let previous = await page.screenshot(options);
  for (let attempt = 1; attempt < STEADY_ATTEMPTS; attempt++) {
    const next = await page.screenshot(options);
    if (next.equals(previous)) {
      return next;
    }
    previous = next;
  }
  throw new Error(`The page changed between each of ${String(STEADY_ATTEMPTS)} screenshots`);
}
