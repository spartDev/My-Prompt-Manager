import { afterEach, beforeEach } from 'vitest';

import { M365_WORK_ACCOUNT_HOSTNAME, type PlatformDefinition, SUPPORTED_PLATFORMS } from '../../config/platforms';

/**
 * Gives Microsoft 365 Copilot its other host back, copilot.cloud.microsoft
 * (M365_WORK_ACCOUNT_HOSTNAME), in a Platform list: the one this test file loaded, or the one a
 * module loaded again after vi.resetModules. Returns what takes it away again.
 *
 * 2.0.0 ships M365 Copilot without it (ticket My-Prompt-Manager-totf); the code for a Platform
 * served on two hosts stays for ticket My-Prompt-Manager-j74b, and the tests that use this keep
 * proving it on the host j74b turns back on. Remove this helper once j74b has.
 */
export function giveTheWorkAccountHostBack(platforms: typeof SUPPORTED_PLATFORMS = SUPPORTED_PLATFORMS): () => void {
  // The Platform list is frozen, each Platform is not: the hostname helpers read it at each call
  const m365copilot = platforms.m365copilot as PlatformDefinition;
  const shipped = m365copilot.otherHostnames;
  m365copilot.otherHostnames = [M365_WORK_ACCOUNT_HOSTNAME];
  return () => {
    m365copilot.otherHostnames = shipped;
  };
}

/** giveTheWorkAccountHostBack for each test of the describe block that calls it, taken away after each */
export function withTheWorkAccountHost(): void {
  let takeBack: (() => void) | undefined;

  beforeEach(() => {
    takeBack = giveTheWorkAccountHostBack();
  });

  afterEach(() => {
    takeBack?.();
    takeBack = undefined;
  });
}
