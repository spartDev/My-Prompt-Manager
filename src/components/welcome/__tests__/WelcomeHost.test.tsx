/**
 * The Welcome's frame and navigation (My-Prompt-Manager-ojz.7): header, step slot, progress dots,
 * Back and the primary button, driven by the pure reducer of src/welcome/reducer.ts, with the mouse
 * and the keyboard; each step change recorded, so a Welcome closed early resumes there; no
 * animation ever holding the primary button.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PACKS } from '../../../welcome/packs';
import type { WelcomeStep } from '../../../welcome/storage';
import WelcomeHost, { type WelcomeHostProps } from '../WelcomeHost';

const DEFAULTS = PACKS.filter((pack) => pack.defaultSelected).map((pack) => pack.id);

const renderWelcome = (props: Partial<WelcomeHostProps> = {}) => {
  const saveStep = vi.fn<WelcomeHostProps['saveStep']>();
  const finishWelcome = vi.fn<WelcomeHostProps['finishWelcome']>();
  const view = render(<WelcomeHost step={0} saveStep={saveStep} finishWelcome={finishWelcome} {...props} />);
  return { ...view, saveStep, finishWelcome, user: userEvent.setup() };
};

const welcome = (): HTMLElement => screen.getByTestId('welcome');
/** The step shown, 1 to 3 */
const shownStep = (): number => Number(welcome().getAttribute('data-welcome-step')) + 1;
const primary = (): HTMLElement => screen.getByTestId('welcome-primary');
const back = (): HTMLElement | null => screen.queryByRole('button', { name: 'Back' });
const skip = (): HTMLElement | null => screen.queryByRole('button', { name: 'Skip' });
const dot = (step: number): HTMLElement => screen.getByRole('button', { name: `Step ${String(step)} of 3` });

const reduceMotion = () =>
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Welcome frame', () => {
  describe('the common frame', () => {
    it('fills the screen with the header (logo, name, Skip, close), the step, three dots and the primary button', () => {
      renderWelcome();

      expect(welcome().tagName).toBe('MAIN');
      expect(within(welcome()).getByText('My Prompt Manager')).toBeInTheDocument();
      expect(skip()).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /^Step \d of 3$/ })).toHaveLength(3);
      expect(primary()).toHaveTextContent('Next');
      expect(primary()).toHaveAttribute('type', 'button');
    });

    it('names the close button for the side panel there', () => {
      renderWelcome({ context: 'sidepanel' });

      expect(screen.getByRole('button', { name: 'Close side panel' })).toBeInTheDocument();
    });

    it('marks the active dot as the current step, a wide accent pill; the others are short', () => {
      renderWelcome({ step: 1 });

      expect(dot(2)).toHaveAttribute('aria-current', 'step');
      expect(dot(1)).not.toHaveAttribute('aria-current');
      expect(dot(3)).not.toHaveAttribute('aria-current');
      const pill = (step: number) => dot(step).firstElementChild as HTMLElement;
      expect(pill(2).className).toContain('w-[22px]');
      expect(pill(2).className).toContain('bg-accent');
      expect(pill(1).className).toContain('w-[7px]');
      expect(pill(1).className).toContain('bg-step-dot');
    });

    // WCAG 2.5.8: the 7px pills sat in 13px-wide buttons, too close for the spacing exception. The
    // boxes are measured in the real extension by tests/e2e/welcome/welcome-a11y.spec.ts
    it('makes each dot a target of 24 x 24px at least, its pill centered in it', () => {
      renderWelcome({ step: 1 });

      for (const step of [1, 2, 3]) {
        expect(dot(step)).toHaveClass('h-6', 'min-w-6', 'justify-center');
      }
    });

    it('draws the primary button in ink (the accent in dark), 48px high, taking the rest of the width; Back outlined at 3:1', () => {
      renderWelcome({ step: 1 });

      expect(primary().className).toContain('bg-welcome-primary');
      expect(primary().className).toContain('text-on-welcome-primary');
      expect(primary().className).toContain('h-12');
      expect(primary().className).toContain('flex-1');
      expect(primary().className).toContain('active:scale-97');
      expect(back()?.className).toContain('h-12');
      expect(back()?.className).toContain('border-input');
    });
  });

  describe('AC2: navigation with the mouse', () => {
    it('Back is absent at step 1, shown at steps 2 and 3, and goes one step back', async () => {
      const { user } = renderWelcome();
      expect(back()).not.toBeInTheDocument();

      await user.click(primary());
      expect(shownStep()).toBe(2);
      expect(back()).toBeInTheDocument();

      await user.click(primary());
      expect(shownStep()).toBe(3);
      expect(back()).toBeInTheDocument();

      await user.click(back() as HTMLElement);
      expect(shownStep()).toBe(2);
      await user.click(back() as HTMLElement);
      expect(shownStep()).toBe(1);
      expect(back()).not.toBeInTheDocument();
    });

    it.each([1, 2] as const)('Skip goes from step %i to step 3 and finishes nothing', async (from) => {
      const onFinish = vi.fn();
      const { user, finishWelcome, saveStep } = renderWelcome({ step: (from - 1) as WelcomeStep, onFinish });

      await user.click(skip() as HTMLElement);

      expect(shownStep()).toBe(3);
      expect(onFinish).not.toHaveBeenCalled();
      expect(finishWelcome).not.toHaveBeenCalled();
      expect(saveStep.mock.calls).toEqual([[2]]);
    });

    it('Skip is not offered at step 3, where it would do nothing', () => {
      renderWelcome({ step: 2 });

      expect(skip()).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });

    it.each([
      [1, 3],
      [3, 1],
      [2, 1],
      [1, 2]
    ] as const)('a click on a dot goes from step %i to its step %i', async (from, to) => {
      const { user, saveStep } = renderWelcome({ step: (from - 1) as WelcomeStep });

      await user.click(dot(to));

      expect(shownStep()).toBe(to);
      expect(dot(to)).toHaveAttribute('aria-current', 'step');
      expect(saveStep.mock.calls).toEqual([[to - 1]]);
    });

    it('the dot of the step shown changes nothing', async () => {
      const { user, saveStep } = renderWelcome({ step: 1 });

      await user.click(dot(2));

      expect(shownStep()).toBe(2);
      expect(saveStep).not.toHaveBeenCalled();
    });

    it('the primary button at step 3 finishes with the selected Packs, and changes no step', async () => {
      const onFinish = vi.fn();
      const { user, saveStep, finishWelcome } = renderWelcome({ step: 2, onFinish });

      await user.click(primary());

      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(onFinish).toHaveBeenCalledWith(DEFAULTS);
      expect(shownStep()).toBe(3);
      expect(saveStep).not.toHaveBeenCalled();
      // A caller's onFinish replaces finishWelcome: what the last step adds is its own (My-Prompt-Manager-ojz.9)
      expect(finishWelcome).not.toHaveBeenCalled();
    });

    it('without onFinish, the primary button at step 3 calls finishWelcome', async () => {
      const { user, finishWelcome } = renderWelcome({ step: 2 });

      await user.click(primary());

      expect(finishWelcome).toHaveBeenCalledTimes(1);
    });

    it('close calls window.close and writes nothing: no step, no finish', async () => {
      const close = vi.spyOn(window, 'close').mockImplementation(() => undefined);
      const onFinish = vi.fn();
      const { user, saveStep, finishWelcome } = renderWelcome({ step: 1, onFinish });

      await user.click(screen.getByRole('button', { name: 'Close' }));

      expect(close).toHaveBeenCalledTimes(1);
      expect(saveStep).not.toHaveBeenCalled();
      expect(finishWelcome).not.toHaveBeenCalled();
      expect(onFinish).not.toHaveBeenCalled();
      expect(shownStep()).toBe(2);
    });
  });

  describe('AC2: navigation with the keyboard', () => {
    it('Enter presses the primary button when the keyboard is on no other control', async () => {
      const onFinish = vi.fn();
      const { user } = renderWelcome({ onFinish });

      await user.keyboard('{Enter}');
      expect(shownStep()).toBe(2);
      // The keyboard is now on the step's title, which is no control: Enter goes on
      await user.keyboard('{Enter}');
      expect(shownStep()).toBe(3);
      await user.keyboard('{Enter}');
      expect(onFinish).toHaveBeenCalledTimes(1);
    });

    it('Enter on the primary button presses it once', async () => {
      const { user } = renderWelcome();
      primary().focus();

      await user.keyboard('{Enter}');

      expect(shownStep()).toBe(2);
    });

    it('Enter on another control keeps its own activation: Skip skips, Back goes back, a dot goes to its step', async () => {
      const { user } = renderWelcome({ step: 1 });

      (back() as HTMLElement).focus();
      await user.keyboard('{Enter}');
      expect(shownStep()).toBe(1);

      dot(3).focus();
      await user.keyboard('{Enter}');
      expect(shownStep()).toBe(3);

      dot(1).focus();
      await user.keyboard('{Enter}');
      expect(shownStep()).toBe(1);

      (skip() as HTMLElement).focus();
      await user.keyboard('{Enter}');
      expect(shownStep()).toBe(3);
    });

    it('a held Enter (a repeat) presses the primary button no more', () => {
      renderWelcome();

      fireEvent.keyDown(document.body, { key: 'Enter', repeat: true });

      expect(shownStep()).toBe(1);
    });

    it('ArrowRight and ArrowLeft change step; ArrowRight at step 3 finishes nothing, ArrowLeft at step 1 does nothing', async () => {
      const onFinish = vi.fn();
      const { user, saveStep } = renderWelcome({ onFinish });

      await user.keyboard('{ArrowLeft}');
      expect(shownStep()).toBe(1);
      await user.keyboard('{ArrowRight}');
      expect(shownStep()).toBe(2);
      await user.keyboard('{ArrowRight}');
      expect(shownStep()).toBe(3);
      await user.keyboard('{ArrowRight}');
      expect(shownStep()).toBe(3);
      expect(onFinish).not.toHaveBeenCalled();
      await user.keyboard('{ArrowLeft}');
      expect(shownStep()).toBe(2);

      expect(saveStep.mock.calls).toEqual([[1], [2], [1]]);
    });

    it('arrows work wherever the keyboard is in the Welcome, a button included', async () => {
      const { user } = renderWelcome();
      (skip() as HTMLElement).focus();

      await user.keyboard('{ArrowRight}');

      expect(shownStep()).toBe(2);
    });

    it.each([
      ['Meta', { metaKey: true }],
      ['Control', { ctrlKey: true }],
      ['Alt', { altKey: true }],
      ['Shift', { shiftKey: true }]
    ])('with %s held, Enter and the arrows do nothing', (_name, modifier) => {
      renderWelcome({ step: 1 });

      fireEvent.keyDown(document.body, { key: 'Enter', ...modifier });
      fireEvent.keyDown(document.body, { key: 'ArrowRight', ...modifier });
      fireEvent.keyDown(document.body, { key: 'ArrowLeft', ...modifier });

      expect(shownStep()).toBe(2);
    });

    it('a key another handler took (defaultPrevented) is left to it', () => {
      renderWelcome();
      const taken = (event: KeyboardEvent) => { event.preventDefault(); };
      document.body.addEventListener('keydown', taken);

      fireEvent.keyDown(document.body, { key: 'Enter' });
      fireEvent.keyDown(document.body, { key: 'ArrowRight' });

      document.body.removeEventListener('keydown', taken);
      expect(shownStep()).toBe(1);
    });
  });

  describe('each step change is recorded, so a Welcome closed early resumes there', () => {
    it('records each new step once, without Packs, so those already recorded are kept', async () => {
      const { user, saveStep } = renderWelcome();

      await user.click(primary());
      await user.click(primary());
      await user.click(back() as HTMLElement);

      expect(saveStep.mock.calls).toEqual([[1], [2], [1]]);
    });

    it('resumes at the stored step', () => {
      renderWelcome({ step: 1 });

      expect(shownStep()).toBe(2);
      expect(back()).toBeInTheDocument();
    });

    it('resumes with the stored Packs, which the last step finishes with', async () => {
      const onFinish = vi.fn();
      const { user } = renderWelcome({ step: 2, packs: ['engineering'], onFinish });

      await user.click(primary());

      expect(onFinish).toHaveBeenCalledWith(['engineering']);
    });

    it('records nothing at the opening', () => {
      const { saveStep, finishWelcome } = renderWelcome({ step: 2 });

      expect(saveStep).not.toHaveBeenCalled();
      expect(finishWelcome).not.toHaveBeenCalled();
    });

    // App hides the failure Notification of a refused add there (My-Prompt-Manager-ojz.20)
    it('says each step change to onStepChange, the new step with it; not a Pack toggled, the finish or the opening', async () => {
      const onStepChange = vi.fn<NonNullable<WelcomeHostProps['onStepChange']>>();
      const onFinish = vi.fn();
      const { user } = renderWelcome({ step: 2, onStepChange, onFinish });
      expect(onStepChange).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: /^Engineering / }));
      await user.click(primary());
      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(onStepChange).not.toHaveBeenCalled();

      await user.click(back() as HTMLElement);
      await user.click(dot(1));
      fireEvent.keyDown(document, { key: 'ArrowRight' });

      expect(onStepChange.mock.calls).toEqual([[1], [0], [1]]);
    });
  });

  describe('AC3: no animation ever holds the primary button', () => {
    it('a click during the opening fade and during each step slide takes effect at once, with no timer', () => {
      vi.useFakeTimers();
      const onFinish = vi.fn();
      renderWelcome({ onFinish });

      // The opening fade is on, and nothing waits for it
      expect(welcome().className).toContain('animate-welcome-in');
      fireEvent.click(primary());
      expect(shownStep()).toBe(2);

      // The step slides in, the fade still on: the next click lands at once too
      expect(screen.getByTestId('welcome-step').className).toContain('animate-welcome-step-forward');
      expect(welcome().className).toContain('animate-welcome-in');
      fireEvent.click(primary());
      expect(shownStep()).toBe(3);

      fireEvent.click(primary());
      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('the primary button is never disabled, inert or out of pointer reach while an animation plays', () => {
      renderWelcome();
      const check = () => {
        expect(primary()).toBeEnabled();
        for (let node: HTMLElement | null = primary(); node; node = node.parentElement) {
          expect(node.inert, `${node.tagName} inert`).toBe(false);
          expect(node.className).not.toMatch(/pointer-events-none/);
        }
      };

      check();
      fireEvent.click(primary());
      check();
      fireEvent.click(back() as HTMLElement);
      check();
    });

    it('keeps the primary button above Back while Back pops in, so the pop never takes a click meant for it', () => {
      renderWelcome();

      fireEvent.click(primary());

      expect(back()?.className).toContain('animate-welcome-back-pop');
      // Positioned and later in the document: painted, and hit, above the scaled Back
      expect(primary().className).toMatch(/(^|\s)relative(\s|$)/);
    });
  });

  describe('motion', () => {
    it('slides a step in from the side it comes from', () => {
      renderWelcome();

      fireEvent.click(primary());
      expect(screen.getByTestId('welcome-step').className).toContain('animate-welcome-step-forward');

      fireEvent.click(back() as HTMLElement);
      expect(screen.getByTestId('welcome-step').className).toContain('animate-welcome-step-back');

      fireEvent.click(dot(3));
      expect(screen.getByTestId('welcome-step').className).toContain('animate-welcome-step-forward');
    });

    it('shows the step of the opening at once, without a slide, and Back without a pop', () => {
      renderWelcome({ step: 1 });

      expect(screen.getByTestId('welcome-step').className).not.toMatch(/animate-welcome-step/);
      expect(back()?.className).not.toContain('animate-welcome-back-pop');
    });

    it('pops Back only when a step change brings it, not when it stays', () => {
      renderWelcome({ step: 1 });

      fireEvent.click(primary());

      expect(back()?.className).not.toContain('animate-welcome-back-pop');
    });

    it('widens the active dot on the spring', () => {
      renderWelcome();

      expect((dot(1).firstElementChild as HTMLElement).className).toContain('transition-welcome-dot');
    });
  });

  describe('AC4: reduced motion', () => {
    it('no fade, slide or pop: a step change shows the next step at once, and nothing floats', () => {
      reduceMotion();
      renderWelcome();

      expect(welcome().className).not.toMatch(/animate-/);
      fireEvent.click(primary());

      expect(shownStep()).toBe(2);
      expect(screen.getByTestId('welcome-step').className).not.toMatch(/animate-/);
      expect(back()?.className).not.toMatch(/animate-/);
      expect(welcome().querySelector('[class*="animate-"]')).toBeNull();
    });
  });

  describe('accessibility the frame owes', () => {
    it('announces the step change and moves the keyboard to the new step\'s title', async () => {
      const { user } = renderWelcome();
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('Step 1 of 3');

      await user.click(primary());

      expect(status).toHaveTextContent('Step 2 of 3');
      expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    });

    it('moves no focus at the opening', () => {
      renderWelcome({ step: 1 });

      expect(document.body).toHaveFocus();
    });

    it('leaves no key handler once gone', () => {
      const { unmount, finishWelcome, saveStep } = renderWelcome({ step: 2 });

      unmount();
      act(() => {
        fireEvent.keyDown(document.body, { key: 'Enter' });
        fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
      });

      expect(finishWelcome).not.toHaveBeenCalled();
      expect(saveStep).not.toHaveBeenCalled();
    });
  });
});
