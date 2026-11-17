import type { IconPlacementRepairs } from '../../services/iconPlacementRepairs';

/**
 * The repairs without the write count of each entry (`written`): for a test about what a repair
 * holds, not about which one is newest.
 */
export function withoutWritten<T>(repairs: T): T {
  if (typeof repairs !== 'object' || repairs === null) {
    return repairs;
  }
  return Object.fromEntries(
    Object.entries(repairs as IconPlacementRepairs).map(([hostname, { written: _written, ...repair }]) => [hostname, repair])
  ) as T;
}
