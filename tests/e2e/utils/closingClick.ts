/**
 * A click whose handler closes its own page (My-Prompt-Manager-ojz.27)
 *
 * Go back on the full-page Analytics view and the Welcome's close button call `window.close()` in their
 * click handler. `locator.click()` resolves only once Chromium has answered the mouse-up, and Chromium
 * may drop the page before it answers: the click then rejects with "Target page, context or browser has
 * been closed" although it landed and the page closed. That failed "the back button closes the
 * full-page view" in 5 of 80 CI runs.
 *
 * The close is what such a test proves, so a test clicks such a control through `clickToClose`, which
 * waits for the close: a click that rejects is forgiven once the page has closed. While the page stays
 * open, it throws the click's own error, else the timeout of the wait for "close".
 */

import type { Locator, Page } from '@playwright/test';

/** Clicks `control`, whose click closes `page`, and resolves once `page` has closed */
export const clickToClose = async (page: Page, control: Locator): Promise<void> => {
  // Started before the click, so a close that comes at once is not missed; its failure is read below
  const closed = page.waitForEvent('close').then(
    () => undefined,
    (error: unknown) => error,
  );
  const clickError = await control.click().then(
    () => undefined,
    (error: unknown) => error,
  );
  const stillOpen = await closed;
  if (stillOpen !== undefined) {
    throw clickError ?? stillOpen;
  }
};
