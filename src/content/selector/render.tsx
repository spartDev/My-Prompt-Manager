/**
 * The React side of the Prompt selector, in a chunk of its own: the controller imports it the
 * first time the selector opens, so a page where it never opens does not load React (ADR-002).
 */

import { createRoot } from 'react-dom/client';

import { InsertionFeedback, type InsertionFeedbackProps } from './InsertionFeedback';
import { PickerPopover, type PickerPopoverProps } from './PickerPopover';

/** What the shadow root shows: the open selector, the confirmation of the last Insertion, or neither. */
export interface SelectorLayerProps {
  popover: PickerPopoverProps | null;
  feedback: InsertionFeedbackProps | null;
}

export interface SelectorRoot {
  render: (props: SelectorLayerProps) => void;
  unmount: () => void;
}

/** Creates the React root of the selector in `container`, the element inside the shadow root. */
export function createSelectorRoot(container: HTMLElement): SelectorRoot {
  const root = createRoot(container);
  return {
    render: ({ popover, feedback }) => {
      root.render(
        <>
          {popover && <PickerPopover {...popover} />}
          {feedback && <InsertionFeedback {...feedback} />}
        </>
      );
    },
    unmount: () => {
      root.unmount();
    }
  };
}
