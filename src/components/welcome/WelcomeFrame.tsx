import type { FC, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import { prefersReducedMotion } from '../../theme/motion';
import { cn } from '../../utils';
import { LAST_STEP, STEP_COUNT, type WelcomeAction, type WelcomeDirection } from '../../welcome/reducer';
import type { WelcomeStep } from '../../welcome/storage';
import { LogoIcon } from '../icons/HeaderIcons';

export interface WelcomeFrameProps {
  /** The step shown */
  step: WelcomeStep;
  /** How it was reached: the side its content slides in from, or at once ('none') at the opening */
  direction: WelcomeDirection;
  /** The label of the primary button */
  primaryLabel: string;
  /**
   * Every navigation the user asks for: the primary button and Enter are `next` (at the last step,
   * the caller finishes the Welcome), Back and ArrowLeft `back`, ArrowRight `next` before the last
   * step only, Skip `skip`, a dot `goTo`
   */
  onAction: (action: WelcomeAction) => void;
  /** The round close button: closes the popup or the side panel, the Welcome left unfinished */
  onClose: () => void;
  context?: 'popup' | 'sidepanel';
  /** The step's content, in the step slot; its title is a WelcomeTitle, which takes the keyboard after a step change */
  children: ReactNode;
}

const STEPS: readonly WelcomeStep[] = [0, 1, 2];

/** "Step 2 of 3": a dot's name, and what a step change announces */
const stepName = (step: WelcomeStep): string => `Step ${String(step + 1)} of ${String(STEP_COUNT)}`;

/**
 * A control that handles Enter itself (Skip, close, a dot, Back, a Pack toggle, the primary button):
 * Enter there keeps its own activation, so it is never the primary button's as well
 */
const OWN_ENTER =
  'button, a[href], input, select, textarea, summary, [role="button"], [role="checkbox"], [role="switch"], [role="link"], [contenteditable]:not([contenteditable="false"])';

const SLIDE: Record<Exclude<WelcomeDirection, 'none'>, string> = {
  forward: 'animate-welcome-step-forward',
  back: 'animate-welcome-step-back'
};

/** The title of a step: 25px, extra bold, centered. It takes the keyboard when the step changes */
export const WelcomeTitle: FC<{ children: ReactNode }> = ({ children }) => (
  <h1
    tabIndex={-1}
    data-welcome-title
    className="text-center text-[25px] leading-[1.12] font-extrabold tracking-[-0.03em] text-balance text-primary focus:outline-none"
  >
    {children}
  </h1>
);

/** The text of a step, under its title: 14px, dark grey, centered */
export const WelcomeText: FC<{ children: ReactNode }> = ({ children }) => (
  <p className="text-center text-sm leading-normal text-pretty text-secondary">{children}</p>
);

/**
 * Back, from the second step. It pops in when a step change brings it; when the Welcome opens on a
 * step that has it, or a step change keeps it, it is simply there
 */
const BackButton: FC<{ pop: boolean; onClick: () => void }> = ({ pop, onClick }) => {
  // Decided once, as Back appears
  const [pops] = useState(pop);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // Outlined in the field border color, 3:1 on the frame in both themes
        'h-12 flex-none rounded-full border-[1.5px] border-input px-5 text-[14.5px] font-bold text-primary hover:bg-card transition-welcome-press focus-secondary',
        pops && 'animate-welcome-back-pop'
      )}
    >
      Back
    </button>
  );
};

/**
 * The step slot, mounted anew at each step. Reached by a step change, it slides in from the side the
 * step comes from and gives the keyboard to the step's title; at the opening it shows at once and
 * moves no focus. It may shrink to the room left (min-h-0), so a step can scroll a part of itself
 * (the Packs) rather than the whole step
 */
const StepSlot: FC<{ direction: WelcomeDirection; animated: boolean; children: ReactNode }> = ({ direction, animated, children }) => {
  const slotRef = useRef<HTMLDivElement>(null);
  // Decided once, as the step mounts
  const [stepChanged] = useState(direction !== 'none');

  useEffect(() => {
    if (stepChanged) {
      slotRef.current?.querySelector<HTMLElement>('[data-welcome-title]')?.focus({ preventScroll: true });
    }
  }, [stepChanged]);

  return (
    <div
      ref={slotRef}
      data-testid="welcome-step"
      className={cn('my-auto flex min-h-0 w-full flex-col py-3', animated && direction !== 'none' && SLIDE[direction])}
    >
      {children}
    </div>
  );
};

/**
 * The frame of the Welcome (Atelier 1C 'Premier lancement'): it fills the popup or the side panel,
 * with no tab bar. A header (the logo in its violet square and the name; Skip and the round close
 * button), the step's content centered in the room left (it scrolls there when it is taller, so the
 * dots and the buttons always stay in view), three progress dots, each a button to its step, then
 * Back from the second step and the primary button in ink (the accent in dark) over the rest of the
 * width.
 *
 * Keyboard: Enter presses the primary button unless the keyboard is on another control, which keeps
 * its own Enter; ArrowLeft and ArrowRight change step (ArrowRight never finishes). A step change is
 * announced ("Step 2 of 3") and moves the keyboard to the new step's title.
 *
 * Motion: the screen fades in at the opening; a step slides 26px in from the side it comes from as
 * it fades in; the active dot widens; Back pops in. None of them disables, covers or delays the
 * primary button: a click lands while they play. Under prefers-reduced-motion none of them plays.
 *
 * Presentation and keyboard only: the state, its recording and the finish are WelcomeHost's.
 */
const WelcomeFrame: FC<WelcomeFrameProps> = ({ step, direction, primaryLabel, onAction, onClose, context = 'popup', children }) => {
  // Read once: a setting changed while the Welcome is open never starts the opening fade late
  const [animated] = useState(() => !prefersReducedMotion());
  const closeName = context === 'sidepanel' ? 'Close side panel' : 'Close';

  // The latest step and handler, for the one key listener
  const latest = useRef({ step, onAction });
  useEffect(() => {
    latest.current = { step, onAction };
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return;
      }
      const { step: current, onAction: act } = latest.current;
      const target = event.target instanceof Element ? event.target : null;
      if (event.key === 'Enter') {
        // A held Enter does not run through the steps and the finish
        if (event.repeat || target?.closest(OWN_ENTER)) {
          return;
        }
        event.preventDefault();
        act({ type: 'next' });
      } else if (event.key === 'ArrowRight' && current !== LAST_STEP) {
        event.preventDefault();
        act({ type: 'next' });
      } else if (event.key === 'ArrowLeft' && current !== 0) {
        event.preventDefault();
        act({ type: 'back' });
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <main
      data-testid="welcome"
      data-welcome-step={step}
      className={cn('flex h-full w-full flex-col bg-subtle text-primary', animated && 'animate-welcome-in')}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col px-[18px] pt-4 pb-[18px]">
        <header className="flex flex-none items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 text-[13px] font-bold text-primary">
            <span aria-hidden="true" className="grid size-6 flex-none place-items-center rounded-lg bg-accent text-on-accent [&>svg]:size-[13px]">
              <LogoIcon />
            </span>
            My Prompt Manager
          </span>
          <div className="flex flex-none items-center gap-1.5">
            {step !== LAST_STEP && (
              <button
                type="button"
                onClick={() => {
                  onAction({ type: 'skip' });
                }}
                className="h-[30px] rounded-full px-2.5 text-[13px] font-semibold text-secondary hover:bg-card transition-welcome-press focus-interactive"
              >
                Skip
              </button>
            )}
            <button
              type="button"
              aria-label={closeName}
              title={closeName}
              onClick={onClose}
              className="grid size-8 flex-none place-items-center rounded-full border border-default bg-card text-secondary hover:bg-accent-subtle hover:text-primary active:scale-90 transition-welcome-press focus-interactive"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[15px]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </header>

        {/* The step slot: centered in the room left, scrolling there when taller. Clipped sideways for
            the slide, at the screen's edge rather than the content's (-mx/px), so a card's shadow fades
            out in the side margins instead of being cut along the content's edge */}
        <div className="-mx-[18px] flex min-h-0 flex-1 flex-col overflow-x-clip overflow-y-auto px-[18px]">
          {/* Keyed by the step: each step change mounts it anew, which plays its slide and moves the keyboard */}
          <StepSlot key={step} direction={direction} animated={animated}>
            {children}
          </StepSlot>
        </div>

        <div role="group" aria-label="Steps" className="my-[5.5px] flex flex-none justify-center">
          {STEPS.map((dot) => (
            <button
              key={dot}
              type="button"
              aria-label={stepName(dot)}
              aria-current={dot === step ? 'step' : undefined}
              onClick={() => {
                onAction({ type: 'goTo', step: dot });
              }}
              // 24px high for the pointer and the finger; the 7px pill inside is what shows
              className="flex h-6 items-center rounded-full px-[3px] focus-interactive"
            >
              <span
                aria-hidden="true"
                className={cn('block h-[7px] rounded-full transition-welcome-dot', dot === step ? 'w-[22px] bg-accent' : 'w-[7px] bg-step-dot')}
              />
            </button>
          ))}
        </div>

        <div className="flex flex-none gap-2">
          {step !== 0 && (
            <BackButton
              pop={animated && direction !== 'none'}
              onClick={() => {
                onAction({ type: 'back' });
              }}
            />
          )}
          <button
            type="button"
            data-testid="welcome-primary"
            onClick={() => {
              onAction({ type: 'next' });
            }}
            // relative: painted, and hit, above Back while Back's pop scales it past its box. Ink in
            // light, the accent in dark, where the dark ink hardly stands out from the frame
            className="relative h-12 min-w-0 flex-1 rounded-full bg-welcome-primary px-4 text-[14.5px] font-bold text-on-welcome-primary shadow-welcome-primary hover:bg-welcome-primary/90 active:scale-97 transition-welcome-press focus-primary"
          >
            {primaryLabel}
          </button>
        </div>

        <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {stepName(step)}
        </p>
      </div>
    </main>
  );
};

export default WelcomeFrame;
