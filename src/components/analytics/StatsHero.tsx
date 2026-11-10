import { type FC, useState } from 'react';

import { useCountUp } from '../../hooks/useCountUp';
import { busiestWeekday, type WeekdayUsage } from '../../services/usageInsights';
import { MOTION } from '../../theme/motion';

export interface StatsHeroProps {
  /** Insertions in the period */
  total: number;
  /** Insertions per weekday, Monday to Sunday */
  weekdays: WeekdayUsage[];
  /** The full-page view: from the md width up, the total at the left and taller bars at the right */
  wide?: boolean;
}

/** The chart's text alternative: every count, then the busiest day */
const chartSummary = (weekdays: WeekdayUsage[], busiest: WeekdayUsage | null): string => {
  const counts = weekdays.map(weekday => `${weekday.name} ${String(weekday.count)}`).join(', ');
  return busiest
    ? `Prompts used per weekday: ${counts}. ${busiest.name} is the busiest.`
    : `Prompts used per weekday: none yet.`;
};

/**
 * The dark card at the top of Analytics (Atelier 1C): Insertions in the period, counting up, and a
 * bar per weekday that grows from the bottom. Hovering a bar shows its count above it and in the line
 * under the total.
 */
const StatsHero: FC<StatsHeroProps> = ({ total, weekdays, wide = false }) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const shown = useCountUp(total, MOTION.countUp);
  const busiest = busiestWeekday(weekdays);
  const max = Math.max(1, ...weekdays.map(weekday => weekday.count));
  const hoveredDay = hovered === null ? null : weekdays[hovered];

  const subtitle = hoveredDay
    ? `${String(hoveredDay.count)} on ${hoveredDay.name}s`
    : busiest ? `${busiest.name} is your busiest day.` : 'No Prompts used yet.';

  return (
    <section
      aria-labelledby="stats-hero-label"
      data-testid="stats-hero"
      className={`mt-3.5 px-[18px] pt-[18px] pb-3.5 rounded-hero bg-inverse text-on-inverse-strong shadow-hero ${wide ? 'md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-end md:gap-10 md:px-7 md:pt-7 md:pb-6' : ''}`}
    >
      <div className="min-w-0">
        <h2 id="stats-hero-label" className="text-[13px] font-semibold text-on-inverse">Prompts used</h2>
        <p className={`mt-1.5 text-[46px] leading-none font-extrabold tracking-[-0.045em] ${wide ? 'md:text-[64px]' : ''}`}>
          <span aria-hidden="true" data-testid="stats-total">{shown}</span>
          <span className="sr-only">{total}</span>
        </p>
        <p className="mt-1 text-[13px] text-on-inverse" data-testid="stats-hero-subtitle">{subtitle}</p>
      </div>

      <figure
        role="img"
        aria-label={chartSummary(weekdays, busiest)}
        className={`m-0 mt-4 grid grid-cols-7 gap-2 h-[94px] ${wide ? 'md:mt-0 md:h-[132px]' : ''}`}
      >
        {weekdays.map((weekday, index) => {
          const isHovered = hovered === index;
          const isBusiest = busiest?.day === weekday.day;
          const bar = isHovered ? 'bg-inverse-bar-hover' : isBusiest ? 'bg-inverse-mark' : 'bg-inverse-bar';
          const label = isHovered || isBusiest ? 'text-on-inverse-strong' : 'text-on-inverse-muted';
          return (
            <div
              key={weekday.day}
              aria-hidden="true"
              data-testid="stats-bar"
              onMouseEnter={() => { setHovered(index); }}
              onMouseLeave={() => { setHovered(current => (current === index ? null : current)); }}
              className="flex flex-col items-center gap-1.5 min-h-0"
            >
              <div className="flex-1 w-full min-h-0 flex items-end justify-center">
                <div
                  className={`relative w-full ${wide ? 'max-w-[26px] md:max-w-[34px]' : 'max-w-[26px]'} rounded-full origin-bottom animate-bar-grow transition-colors duration-(--duration-track) ${bar}`}
                  style={{
                    height: `max(6px, ${String(Math.round((weekday.count / max) * 100))}%)`,
                    animationDelay: `${String(MOTION.barDelay + index * MOTION.barStagger)}ms`
                  }}
                >
                  <span
                    className={`absolute left-1/2 bottom-[calc(100%+5px)] -translate-x-1/2 text-[11.5px] font-bold text-on-inverse-strong pointer-events-none transition-opacity duration-(--duration-color) ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                  >
                    {weekday.count}
                  </span>
                </div>
              </div>
              <span className={`text-[11px] font-semibold transition-colors duration-(--duration-color) ${label}`}>{weekday.day}</span>
            </div>
          );
        })}
      </figure>
    </section>
  );
};

export default StatsHero;
