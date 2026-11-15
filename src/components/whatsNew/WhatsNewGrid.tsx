import type { FC } from 'react';

import type { FeatureItem, ReleaseNoteItem, WhatsNewDestination } from '../../whatsNew/types';
import { WhatsNewTile } from './WhatsNewTile';

export interface WhatsNewGridProps {
  /** The items of one Release's notes, in the order of the registry */
  items: readonly ReleaseNoteItem[];
  /** Called with the destination of the Feature tile pressed */
  onOpen: (destination: WhatsNewDestination, item: FeatureItem) => void;
}

interface PlacedTile {
  item: ReleaseNoteItem;
  hero: boolean;
  wide: boolean;
  tileNumber?: number;
}

/**
 * The display order of What's new: the hero (the first Feature, full width), the other Features,
 * then the Critical fixes; with an odd number of tiles under the hero, the last one spans both
 * columns. No Feature, no hero. The Feature tiles that open something are numbered from 1 in this
 * order, for the number keys of the sheet.
 */
export const placeTiles = (items: readonly ReleaseNoteItem[]): PlacedTile[] => {
  const features = items.filter((item) => item.kind === 'feature');
  const fixes = items.filter((item) => item.kind === 'critical-fix');
  const [hero, ...otherFeatures] = features;
  const small: ReleaseNoteItem[] = [...otherFeatures, ...fixes];

  const placed: PlacedTile[] = [
    ...(hero === undefined ? [] : [{ item: hero, hero: true, wide: true }]),
    ...small.map((item, index) => ({ item, hero: false, wide: small.length % 2 === 1 && index === small.length - 1 }))
  ];

  let opening = 0;
  return placed.map((tile) =>
    tile.item.kind === 'feature' && tile.item.destination !== undefined ? { ...tile, tileNumber: ++opening } : tile
  );
};

/** The two-column grid of What's new tiles */
export const WhatsNewGrid: FC<WhatsNewGridProps> = ({ items, onOpen }) => (
  <ul className="grid grid-cols-2 gap-2" data-whats-new-grid="">
    {placeTiles(items).map((tile, position) => (
      <li key={`${tile.item.kind}-${tile.item.title}`} className={tile.wide ? 'col-span-2' : undefined}>
        <WhatsNewTile item={tile.item} hero={tile.hero} position={position} tileNumber={tile.tileNumber} onOpen={onOpen} />
      </li>
    ))}
  </ul>
);
