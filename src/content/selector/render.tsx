/**
 * The React side of the Prompt selector, in a chunk of its own: the controller imports it the
 * first time the selector opens, so a page where it never opens does not load React (ADR-002).
 */

import { createRoot } from 'react-dom/client';

import { PickerPopover, type PickerPopoverProps } from './PickerPopover';

export interface SelectorRoot {
  render: (props: PickerPopoverProps) => void;
  unmount: () => void;
}

/** Creates the React root of the selector in `container`, the element inside the shadow root. */
export function createSelectorRoot(container: HTMLElement): SelectorRoot {
  const root = createRoot(container);
  return {
    render: (props) => {
      root.render(<PickerPopover {...props} />);
    },
    unmount: () => {
      root.unmount();
    }
  };
}
