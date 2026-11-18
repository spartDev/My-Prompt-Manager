/**
 * The frame records the Packs selected as soon as they change, so a Welcome closed on its last step
 * resumes with them. The step contents with their Pack toggles are My-Prompt-Manager-ojz.8's: a
 * stand-in gives the toggle here.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PACKS } from '../../../welcome/packs';
import WelcomeHost from '../WelcomeHost';
import type { WelcomeStepProps } from '../WelcomeSteps';

vi.mock('../WelcomeSteps', async (importOriginal) => {
  const original = await importOriginal<typeof import('../WelcomeSteps')>();
  const StandIn = ({ state, onTogglePack }: WelcomeStepProps) => (
    <div>
      <h1 tabIndex={-1} data-welcome-title>
        Step {state.step + 1}
      </h1>
      <button type="button" aria-pressed={state.selectedPacks.includes('hiring')} onClick={() => { onTogglePack('hiring'); }}>
        Hiring
      </button>
    </div>
  );
  return { ...original, WelcomeStepContent: StandIn };
});

const DEFAULTS = PACKS.filter((pack) => pack.defaultSelected).map((pack) => pack.id);

describe('Welcome frame: the Packs selected', () => {
  it('records the step with the new selection when a Pack is toggled, and finishes with it', async () => {
    const saveStep = vi.fn();
    const onFinish = vi.fn();
    const user = userEvent.setup();
    render(<WelcomeHost step={2} saveStep={saveStep} finishWelcome={vi.fn()} onFinish={onFinish} />);

    await user.click(screen.getByRole('button', { name: 'Hiring' }));
    expect(screen.getByRole('button', { name: 'Hiring' })).toHaveAttribute('aria-pressed', 'true');
    expect(saveStep.mock.calls).toEqual([[2, [...DEFAULTS, 'hiring']]]);

    await user.click(screen.getByRole('button', { name: 'Hiring' }));
    expect(saveStep.mock.calls).toEqual([
      [2, [...DEFAULTS, 'hiring']],
      [2, DEFAULTS]
    ]);

    await user.click(screen.getByTestId('welcome-primary'));
    expect(onFinish).toHaveBeenCalledWith(DEFAULTS);
  });

  it('a Pack toggle is no step change: the step stays, nothing slides and the keyboard stays on the toggle', async () => {
    const user = userEvent.setup();
    render(<WelcomeHost step={2} saveStep={vi.fn()} finishWelcome={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Hiring' }));

    expect(screen.getByTestId('welcome')).toHaveAttribute('data-welcome-step', '2');
    expect(screen.getByTestId('welcome-step').className).not.toMatch(/animate-welcome-step/);
    expect(screen.getByRole('button', { name: 'Hiring' })).toHaveFocus();
  });

  it('Enter on a Pack toggle toggles it, and does not press the primary button', async () => {
    const onFinish = vi.fn();
    const user = userEvent.setup();
    render(<WelcomeHost step={2} saveStep={vi.fn()} finishWelcome={vi.fn()} onFinish={onFinish} />);
    screen.getByRole('button', { name: 'Hiring' }).focus();

    await user.keyboard('{Enter}');

    expect(screen.getByRole('button', { name: 'Hiring' })).toHaveAttribute('aria-pressed', 'true');
    expect(onFinish).not.toHaveBeenCalled();
  });
});
