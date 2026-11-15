import { type CSSProperties, type FC, type ReactNode, useId } from 'react';

import { MOTION, prefersReducedMotion } from '../../theme/motion';
import { parseExample } from '../../whatsNew/releaseNotes';
import type { FeatureItem, ReleaseNoteItem, WhatsNewDestination } from '../../whatsNew/types';
import { WhatsNewIconGlyph } from '../icons/WhatsNewIcons';

export interface WhatsNewTileProps {
  item: ReleaseNoteItem;
  /** The full-width first tile: the first Feature, with its example sentence. Ignored for a Critical fix */
  hero?: boolean;
  /** The tile's place in the grid, from 0: it rises tileStagger after the one before */
  position: number;
  /** Among the Feature tiles that open something, in display order, from 1 (the hero is 1); unset otherwise */
  tileNumber?: number;
  /** Called with the Feature's destination when its tile is pressed */
  onOpen: (destination: WhatsNewDestination, item: FeatureItem) => void;
}

/** The delay of a tile's rise: the first after tileDelay, each next one tileStagger later; none under reduced motion */
export const tileRiseDelay = (position: number): string | undefined =>
  prefersReducedMotion() ? undefined : `${String(MOTION.tileDelay + position * MOTION.tileStagger)}ms`;

const TILE = 'flex flex-col gap-2 w-full h-full p-[13px] rounded-tile bg-subtle text-left animate-tile-rise';
const PRESSABLE = 'group cursor-pointer transition-tile hover:bg-accent-selected active:scale-[.97] focus-primary';

/** A {{word}} of the hero example. On the hovered hero (bg-accent-selected too) it turns to bg-card, so it stays a pill */
const VARIABLE_PILL =
  'inline-flex px-[9px] py-px rounded-full bg-accent-selected text-accent font-bold transition-colors duration-(--duration-color) group-hover:bg-card';

const Example: FC<{ example: string }> = ({ example }) => (
  <span className="block text-sm leading-[1.7] text-primary">
    {parseExample(example).map((segment, index) =>
      segment.kind === 'variable' ? (
        // The pieces of a sentence never move: the index is a stable key
        // biome-ignore lint/suspicious/noArrayIndexKey: segments of a fixed sentence
        <span key={index} className={VARIABLE_PILL}>
          {segment.name}
        </span>
      ) : (
        // biome-ignore lint/suspicious/noArrayIndexKey: segments of a fixed sentence
        <span key={index}>{segment.text}</span>
      )
    )}
  </span>
);

const FixedPill: FC = () => (
  <span className="inline-flex items-center shrink-0 px-2 py-0.5 rounded-full bg-success-subtle text-success text-[11px] leading-[1.3] font-bold">
    Fixed
  </span>
);

const IconSquare: FC<{ item: FeatureItem }> = ({ item }) => (
  <span className="flex items-center justify-center shrink-0 min-w-8 h-8 px-1 rounded-tile-icon bg-card text-accent shadow-tile-icon">
    <WhatsNewIconGlyph icon={item.icon} />
  </span>
);

/** The ids of the title and the description, which name a Feature button; a plain tile has none */
interface TextIds {
  title?: string;
  description?: string;
}

const Description: FC<{ text: string; hero: boolean; id?: string }> = ({ text, hero, id }) => (
  <span id={id} className={`block ${hero ? 'text-[12.5px]' : 'text-xs'} leading-[1.4] text-secondary`}>
    {text}
  </span>
);

const content = (item: ReleaseNoteItem, hero: boolean, ids: TextIds): ReactNode => {
  if (item.kind === 'feature' && hero) {
    return (
      <>
        {item.example && <Example example={item.example} />}
        <span className="flex flex-col gap-0.5">
          <span id={ids.title} className="block text-[15px] leading-[1.3] font-bold text-primary">
            {item.title}
          </span>
          <Description id={ids.description} text={item.description} hero />
        </span>
      </>
    );
  }
  return (
    <>
      <span className="flex items-center gap-2">
        {item.kind === 'feature' ? <IconSquare item={item} /> : <FixedPill />}
        <span id={ids.title} className="text-[13.5px] leading-[1.2] font-bold text-primary">
          {item.title}
        </span>
      </span>
      <Description id={ids.description} text={item.description} hero={false} />
    </>
  );
};

/**
 * One tile of What's new. A Feature with a destination is a button named by its title then its
 * description (aria-labelledby, so the two are read as two phrases); a Feature without one (it lives on Platforms) and a Critical fix are plain tiles that
 * take no focus.
 */
export const WhatsNewTile: FC<WhatsNewTileProps> = ({ item, hero = false, position, tileNumber, onOpen }) => {
  const isHero = hero && item.kind === 'feature';
  const style: CSSProperties = { animationDelay: tileRiseDelay(position) };
  const kind = isHero ? 'hero' : item.kind;
  const id = useId();

  if (item.kind === 'feature' && item.destination !== undefined) {
    const { destination } = item;
    const ids = { title: `${id}-title`, description: `${id}-description` };
    return (
      <button
        type="button"
        className={`${TILE} ${PRESSABLE}`}
        style={style}
        data-whats-new-tile={kind}
        data-whats-new-tile-index={tileNumber}
        // Named by the title and the description alone: the hero's example illustrates, it does not name
        aria-labelledby={`${ids.title} ${ids.description}`}
        onClick={() => {
          onOpen(destination, item);
        }}
      >
        {content(item, isHero, ids)}
      </button>
    );
  }

  return (
    <div className={TILE} style={style} data-whats-new-tile={kind}>
      {content(item, isHero, {})}
    </div>
  );
};
