import type { FC, ReactNode } from 'react';

import { cn } from '../utils';

export interface SectionHeaderProps {
  /** The Section's title, the page's one h1 */
  title: string;
  /** The Eyebrow: the Section's context over its title (version, count, period) */
  eyebrow: ReactNode;
  /** Announce Eyebrow changes to screen readers, when it carries live data such as a count */
  eyebrowLive?: boolean;
  /** Before the Eyebrow and title, such as the full-page Analytics view's back button */
  leading?: ReactNode;
  /** The Section's actions, on the right: the side panel's close button, Full Dashboard */
  children?: ReactNode;
  className?: string;
}

/**
 * The Section header of every Section but the Library (Atelier 1C, after Settings): an Eyebrow
 * over a 27px extrabold title, the Section's actions on the right. Seamless on bg-app, its line
 * shows once the content scrolls under it (scroll-edge-top).
 */
const SectionHeader: FC<SectionHeaderProps> = ({ title, eyebrow, eyebrowLive = false, leading, children, className }) => (
  <header
    className={cn(
      'shrink-0 bg-app flex items-start justify-between gap-3 px-5 pt-4 pb-2 border-b border-transparent scroll-edge-top',
      className
    )}
  >
    <div className="flex items-center gap-3 min-w-0">
      {leading}
      <div className="min-w-0">
        <p
          className="text-[12.5px] font-semibold text-tertiary"
          aria-live={eyebrowLive ? 'polite' : undefined}
          aria-atomic={eyebrowLive ? true : undefined}
        >
          {eyebrow}
        </p>
        <h1 className="text-[27px] font-extrabold leading-[1.05] tracking-[-0.035em] text-primary">{title}</h1>
      </div>
    </div>
    {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
  </header>
);

export default SectionHeader;
