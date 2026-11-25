/**
 * The browser the scenes are taken in, launched so that a failure leaves nothing behind: no
 * Chromium still running (which would keep the command from ever exiting) and no temp profile.
 */

import { rmSync } from 'node:fs';

/** How long the extension may take to load and record its first install, past the launch */
export const EXTENSION_READY_TIMEOUT = 60_000;

export interface Closable {
  close(): Promise<void>;
}

export interface LaunchSteps<C extends Closable, R> {
  /** A new, empty folder the browser keeps its profile in */
  profile: string;
  launch: (profile: string) => Promise<C>;
  /** What must hold of the launched browser before it is used: the extension loaded */
  ready: (context: C) => Promise<R>;
  /** How long `ready` may take before the launch counts as failed */
  timeoutMs: number;
}

/**
 * Launches the browser on `profile` and waits for `ready`, at most `timeoutMs`. When the launch
 * throws, `ready` throws or the time runs out, closes the browser (if it was launched), deletes
 * the profile, and rethrows. The caller owns both once this resolves.
 */
export async function launchReady<C extends Closable, R>(steps: LaunchSteps<C, R>): Promise<{ context: C; ready: R }> {
  const removeProfile = (): void => {
    rmSync(steps.profile, { recursive: true, force: true });
  };
  let context: C;
  try {
    context = await steps.launch(steps.profile);
  } catch (error) {
    removeProfile();
    throw error;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`The extension did not load within ${String(steps.timeoutMs / 1000)} s`));
    }, steps.timeoutMs);
  });
  try {
    const ready = await Promise.race([steps.ready(context), timeout]);
    return { context, ready };
  } catch (error) {
    await context.close().catch(() => undefined);
    removeProfile();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
