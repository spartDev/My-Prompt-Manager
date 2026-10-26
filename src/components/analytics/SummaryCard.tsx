import { type FC, memo, type ReactNode } from 'react';

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

const SummaryCard: FC<SummaryCardProps> = memo(({
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
        return 'text-success';
      case 'down':
        return 'text-danger';
      default:
        return 'text-tertiary';
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-4 border border-default">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-1/2 mb-3" />
          <div className="h-8 bg-muted rounded w-3/4 mb-2" />
          <div className="h-3 bg-muted rounded w-1/3" />
        </div>
      </div>
    );
  }

  return (
    <article
      className="bg-card rounded-xl p-4 border border-default"
      aria-label={`${label}: ${String(value)}${subtitle ? `, ${subtitle}` : ''}`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-tertiary uppercase tracking-wider">
          {label}
        </span>
        <div className="w-8 h-8 bg-accent-subtle text-accent rounded-lg flex items-center justify-center shrink-0" data-testid="summary-icon">
          <div className="w-4 h-4" aria-hidden="true">
            {icon}
          </div>
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold ${trend ? getTrendColor() : 'text-primary'}`}>
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
        <p className="text-xs text-tertiary mt-1 truncate" title={subtitle}>
          {subtitle}
        </p>
      )}
    </article>
  );
});

SummaryCard.displayName = 'SummaryCard';

export default SummaryCard;
