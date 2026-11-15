import type { FC, ReactNode } from 'react';

import type { WhatsNewIcon } from '../../whatsNew/types';

interface WhatsNewIconGlyphProps {
  icon: WhatsNewIcon;
  className?: string;
}

/**
 * One glyph per icon of the closed set of `WhatsNewIcon`, as the paths of a 24px stroke icon, but
 * `search`, drawn as its shortcut key: the Record keeps the set and the glyphs in step, so a new icon
 * key does not compile until it has its glyph.
 */
const GLYPHS: Record<Exclude<WhatsNewIcon, 'search'>, ReactNode> = {
  // A pair of braces: a {{Variable}}
  variables: (
    <>
      <path d="M8 4c-2 0-3 1-3 3v2c0 1.2-.8 2.4-2 3 1.2.6 2 1.8 2 3v2c0 2 1 3 3 3" />
      <path d="M16 4c2 0 3 1 3 3v2c0 1.2.8 2.4 2 3-1.2.6-2 1.8-2 3v2c0 2-1 3-3 3" />
    </>
  ),
  // A slash in a key: the / command
  slash: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M14.5 7.5l-5 9" />
    </>
  ),
  // The star of a Pinned Prompt
  pin: (
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
  ),
  // Two overlapping cards: a Prompt that looks like another
  lookalike: (
    <>
      <rect x="8" y="8" width="13" height="13" rx="2.5" />
      <path d="M16 8V5.5A2.5 2.5 0 0013.5 3h-8A2.5 2.5 0 003 5.5v8A2.5 2.5 0 005.5 16H8" />
    </>
  ),
  // A broom: Tidy up
  broom: (
    <>
      <path d="M20.5 3.5l-8 8" />
      <path d="M10.5 9.5l4 4-1.2 1.6C11.8 17.2 9 19.5 4.5 20.5c.6-4.5 2.8-7.3 4.4-8.8z" />
      <path d="M8 17l2-2" />
    </>
  ),
  // A tag: a Category
  category: (
    <>
      <path d="M3 11.2V4a1 1 0 011-1h7.2a1 1 0 01.7.3l8.8 8.8a1 1 0 010 1.4l-7.2 7.2a1 1 0 01-1.4 0L3.3 11.9a1 1 0 01-.3-.7z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  // A turning-back arrow: Undo
  undo: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 010 11H11" />
    </>
  ),
  // A wrench: a repair
  wrench: (
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.8-3.8a6 6 0 01-7.9 7.9l-6.9 6.9a2.1 2.1 0 01-3-3l6.9-6.9a6 6 0 017.9-7.9z" />
  )
};

/** The glyph of a Feature tile's icon square, hidden from screen readers: the tile's text names it */
export const WhatsNewIconGlyph: FC<WhatsNewIconGlyphProps> = ({ icon, className = 'w-[17px] h-[17px]' }) => {
  if (icon === 'search') {
    // The search shortcut as a key chip, as the mockup draws it, rather than a magnifier
    return (
      <span aria-hidden="true" data-icon-glyph="kbd" className="text-[11px] leading-none font-extrabold tracking-tight">
        ⌘K
      </span>
    );
  }
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
      data-icon-glyph="svg"
    >
      {GLYPHS[icon]}
    </svg>
  );
};
