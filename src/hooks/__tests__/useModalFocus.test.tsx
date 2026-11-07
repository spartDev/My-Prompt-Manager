import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type FC, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { describe, expect, it, vi } from 'vitest';

import { useModalFocus } from '../useModalFocus';

interface ConfirmationProps {
  onClose: () => void;
  /** True while the confirmed action runs: every button is disabled */
  busy?: boolean;
}

/** A confirmation wired the way ConfirmDialog wires it: Cancel takes the focus first */
const Confirmation: FC<ConfirmationProps> = ({ onClose, busy = false }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useModalFocus({ isOpen: true, onClose, containerRef: panelRef, initialFocusRef: cancelRef });

  return (
    <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Confirmation">
      <button type="button" onClick={onClose} disabled={busy}>Confirm</button>
      <button ref={cancelRef} type="button" onClick={onClose} disabled={busy}>Cancel</button>
    </div>
  );
};

/**
 * A warning wired the way StorageWarning wires it: it pauses beneath its confirmation, inert,
 * and the confirmation is a portal, outside the warning's DOM
 */
const Warning: FC<{ onClose: () => void }> = ({ onClose }) => {
  const [confirming, setConfirming] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  useModalFocus({ isOpen: !confirming, onClose, containerRef: panelRef, initialFocusRef: continueRef });

  return (
    <div inert={confirming}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Warning">
        <button ref={continueRef} type="button" onClick={onClose}>Continue</button>
        <button type="button" onClick={() => { setConfirming(true); }}>Clear</button>
      </div>
      {confirming && createPortal(<Confirmation onClose={() => { setConfirming(false); }} />, document.body)}
    </div>
  );
};

/** A page with a button that opens the warning, and one after it that the trap must not reach */
const Page: FC<{ onWarningClose?: () => void }> = ({ onWarningClose }) => {
  const [open, setOpen] = useState(false);
  const close = () => { setOpen(false); onWarningClose?.(); };

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); }}>Save</button>
      {open && <Warning onClose={close} />}
      <button type="button">After</button>
    </>
  );
};

const button = (name: string) => screen.getByRole('button', { name });

describe('useModalFocus', () => {
  it('moves the focus in on open, keeps Tab and Shift+Tab inside, and gives it back to the opener on Escape', async () => {
    const user = userEvent.setup();
    const onWarningClose = vi.fn();
    render(<Page onWarningClose={onWarningClose} />);

    await user.click(button('Save'));

    expect(button('Continue')).toHaveFocus();
    await user.tab();
    expect(button('Clear')).toHaveFocus();
    await user.tab();
    expect(button('Continue')).toHaveFocus();
    await user.tab({ shift: true });
    expect(button('Clear')).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(onWarningClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button('Save')).toHaveFocus();
  });

  it('holds the focus on the panel while every control is disabled', async () => {
    const user = userEvent.setup();
    render(<Confirmation onClose={vi.fn()} busy />);

    await user.tab();

    expect(screen.getByRole('dialog', { name: 'Confirmation' })).toHaveFocus();
  });

  // StorageWarning beneath its Clear All Data confirmation: the warning pauses, and the
  // confirmation gives the focus back to the button that opened it, not to the warning's opener
  it('pauses beneath a confirmation, and resumes where the confirmation leaves the focus', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(button('Save'));

    await user.click(button('Clear'));
    const confirmation = screen.getByRole('dialog', { name: 'Confirmation' });
    expect(within(confirmation).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.tab();
    expect(within(confirmation).getByRole('button', { name: 'Confirm' })).toHaveFocus();
    await user.tab();
    expect(within(confirmation).getByRole('button', { name: 'Cancel' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Confirmation' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Warning' })).toBeInTheDocument();
    expect(button('Clear')).toHaveFocus();
    await user.tab();
    expect(button('Continue')).toHaveFocus();
  });

  it('keeps its opener through a confirmation, and gives the focus back to it on close', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(button('Save'));
    await user.click(button('Clear'));
    await user.keyboard('{Escape}');
    expect(button('Clear')).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button('Save')).toHaveFocus();
  });
});
