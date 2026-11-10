import type { FC } from 'react';

import { MOTION } from '../../theme/motion';

export interface StatCardProps {
  /** What is counted: "Top platform" */
  label: string;
  /** The one that comes first */
  name: string;
  /** Its Insertions in the period */
  count: number;
  /** Its place among the cards rising together: each rises cardStagger after the one before */
  delayIndex: number;
}

/**
 * A stat card of Analytics (Atelier 1C): Top platform, Top category. A label, the name that comes
 * first and its Insertions.
 */
const StatCard: FC<StatCardProps> = ({ label, name, count, delayIndex }) => (
  <div
    className="p-3.5 rounded-group bg-card border border-default animate-card-rise min-w-0"
    style={{ animationDelay: `${String(MOTION.cardDelay + delayIndex * MOTION.cardStagger)}ms` }}
  >
    <h2 className="text-xs font-semibold text-tertiary">{label}</h2>
    <p className="mt-1 text-[19px] font-extrabold tracking-[-0.02em] text-primary truncate" title={name}>{name}</p>
    <p className="text-xs text-secondary">{String(count)} {count === 1 ? 'use' : 'uses'}</p>
  </div>
);

export default StatCard;
