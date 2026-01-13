import { FC, ReactNode } from 'react';

export interface SummaryCardProps {
  /** Label for the metric */
  label: string;
  /** The primary value to display */
  value: string | number;
  /** Optional subtitle or secondary info */
  subtitle?: string;
  /** Icon to display */
  icon: ReactNode;
  /** Optional trend indicator (positive, negative, or neutral) */
  trend?: 'up' | 'down' | 'neutral';
  /** Loading state */
  loading?: boolean;
}

const SummaryCard: FC<SummaryCardProps> = ({
  label,
  value,
  subtitle,
  icon,
  trend,
  loading = false
}) => {
  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-500 dark:text-green-400';
      case 'down':
        return 'text-red-500 dark:text-red-400';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-4 border border-purple-100 dark:border-gray-700">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3" />
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        </div>
      </div>
    );
  }

  return (
    <article
      className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-4 border border-purple-100 dark:border-gray-700 hover:bg-white/90 dark:hover:bg-gray-800/90 transition-all duration-200"
      aria-label={`${label}: ${String(value)}${subtitle ? `, ${subtitle}` : ''}`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {label}
        </span>
        <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center shrink-0">
          <div className="w-4 h-4 text-white" aria-hidden="true">
            {icon}
          </div>
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold text-gray-900 dark:text-gray-100 ${trend ? getTrendColor() : ''}`}>
          {value}
        </span>
        {trend && (
          <span className={getTrendColor()} aria-hidden="true">
            {trend === 'up' && '↑'}
            {trend === 'down' && '↓'}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate" title={subtitle}>
          {subtitle}
        </p>
      )}
    </article>
  );
};

export default SummaryCard;
