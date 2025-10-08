/**
 * Test Platform Manager
 *
 * Test helper class for testing platform strategies with specific hostnames
 * Extends PlatformManager to allow hostname injection for testing
 */

import { PlatformManager } from '../../content/platforms/platform-manager';
import type { PlatformManagerOptions } from '../../content/types/platform';

/**
 * TestPlatformManager allows testing strategies with arbitrary hostnames
 * Use this class in tests to simulate different platforms
 *
 * @example
 * const manager = new TestPlatformManager('gemini.google.com');
 * await manager.initializeStrategies();
 * const strategies = manager.getStrategies();
 * expect(strategies[0].name).toBe('Gemini');
 */
export class TestPlatformManager extends PlatformManager {
  constructor(hostname: string, options?: PlatformManagerOptions) {
    super(options);
    // Override hostname for testing
    this['hostname'] = hostname;
  }
}
