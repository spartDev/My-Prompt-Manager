import type { FC } from 'react';
import { useRef } from 'react';

import { useAnimatedPresence } from '../../hooks/useAnimatedPresence';
import { useWhatsNew } from '../../hooks/useWhatsNew';
import { MOTION } from '../../theme/motion';
import type { FeatureItem, ReleaseNotes, WhatsNewDestination } from '../../whatsNew/types';
import { WhatsNewGrid } from './WhatsNewGrid';
import WhatsNewSheet from './WhatsNewSheet';

export interface WhatsNewHostProps {
  /** Called after What's new has closed on a Feature tile, with that tile's destination */
  onOpen: (destination: WhatsNewDestination, item: FeatureItem) => void;
}

/**
 * What's new over the Library: the sheet and its tile grid while useWhatsNew gives Release notes,
 * then their exit (MOTION.whatsNewSheetOut). Every close (Got it, the backdrop, Escape, Enter, a
 * tile) calls the hook's close() at once, so the Release is marked seen before the exit ends, and
 * only once even when two closing events land in the same task. A tile closes, then opens its
 * destination through onOpen. Shows nothing while the decision loads or when there is nothing to
 * show; Debug mode stays in the hook.
 */
const WhatsNewHost: FC<WhatsNewHostProps> = ({ onOpen }) => {
  const { notes, close } = useWhatsNew();
  const presence = useAnimatedPresence(notes, MOTION.whatsNewSheetOut);

  // The Release notes already closed: a second close of the same notes does nothing
  const closedRef = useRef<ReleaseNotes | null>(null);
  const closeOnce = (): boolean => {
    if (notes === null || closedRef.current === notes) {
      return false;
    }
    closedRef.current = notes;
    close();
    return true;
  };

  const handleOpen = (destination: WhatsNewDestination, item: FeatureItem): void => {
    if (closeOnce()) {
      onOpen(destination, item);
    }
  };

  if (presence.shown === null) {
    return null;
  }

  return (
    <WhatsNewSheet version={presence.shown.version} open={!presence.exiting} onClose={() => { closeOnce(); }}>
      <WhatsNewGrid items={presence.shown.items} onOpen={handleOpen} />
    </WhatsNewSheet>
  );
};

export default WhatsNewHost;
