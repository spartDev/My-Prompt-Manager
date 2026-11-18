/**
 * The content of the Welcome's three steps (My-Prompt-Manager-ojz.8): what the extension does, a
 * blank filled in before the user's eyes, and the Packs with the Platforms the extension works on.
 * Rendered through WelcomeHost, so the steps are seen as the user meets them.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MOTION } from '../../../theme/motion';
import { PACKS } from '../../../welcome/packs';
import type { WelcomeStep } from '../../../welcome/storage';
import WelcomeHost, { type WelcomeHostProps } from '../WelcomeHost';

/** The texts of the spec of record (epic My-Prompt-Manager-ojz, DESIGN, "Étape 1" to "Étape 3"), word for word */
const SPEC: Record<WelcomeStep, { title: string; text: string }> = {
  0: {
    title: 'Your best prompts, one tap away',
    text: 'Save the prompts you reuse and find them in a second, in this popup or right inside your AI chat.'
  },
  1: {
    title: 'Leave blanks, fill them later',
    text: 'Put {{name}} where the details change. When you use the prompt, you fill the blanks right in the text.'
  },
  2: {
    title: 'Start with a pack',
    text: 'Pick what fits your work. Everything stays editable.'
  }
};

/** What step 2 types into its blank, and the whole sentence a screen reader reads instead */
const NAME = 'Claire, Head of Sales';
const SENTENCE = 'Write a follow-up email to Claire, Head of Sales and end with one clear next step.';

const renderWelcome = (props: Partial<WelcomeHostProps> = {}) => {
  const saveStep = vi.fn<WelcomeHostProps['saveStep']>();
  const view = render(<WelcomeHost step={0} saveStep={saveStep} finishWelcome={vi.fn()} {...props} />);
  return { ...view, saveStep, user: userEvent.setup() };
};

const primary = (): HTMLElement => screen.getByTestId('welcome-primary');
/** What the blank of step 2 holds on screen */
const blank = (): string => screen.getByTestId('welcome-blank').textContent ?? '';
const packButton = (name: string): HTMLElement => screen.getByRole('button', { name: new RegExp(`^${name} \\d+ prompts$`) });
const promptCount = (ids: readonly string[]): number =>
  PACKS.filter((pack) => ids.includes(pack.id)).reduce((sum, pack) => sum + pack.prompts.length, 0);
const DEFAULTS = PACKS.filter((pack) => pack.defaultSelected).map((pack) => pack.id);

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

describe('Welcome steps', () => {
  describe('AC1: the titles and texts of the spec, word for word', () => {
    it.each([0, 1, 2] as const)('step %i', (step) => {
      renderWelcome({ step });

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(new RegExp(`^${SPEC[step].title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
      expect(screen.getByText(SPEC[step].text, { exact: true })).toBeInTheDocument();
    });

    it('shows {{name}} literally, the way a Variable is written', () => {
      renderWelcome({ step: 1 });

      expect(screen.getByText(SPEC[1].text).textContent).toContain('{{name}}');
    });

    it('keeps each title the one the step change gives the keyboard to', () => {
      renderWelcome();

      fireEvent.click(primary());

      expect(screen.getByRole('heading', { level: 1, name: SPEC[1].title })).toHaveFocus();
    });
  });

  describe('step 1: three Prompt cards that float', () => {
    it('draws them as a decoration, hidden from assistive technology', () => {
      renderWelcome();

      const illustration = screen.getByTestId('welcome-cards');
      expect(illustration).toHaveAttribute('aria-hidden', 'true');
      expect(illustration.querySelectorAll('[data-welcome-card]')).toHaveLength(3);
    });

    it('each card floats at its own pace, the dark one in the middle with a dashed blank', () => {
      renderWelcome();

      const cards = [...screen.getByTestId('welcome-cards').querySelectorAll<HTMLElement>('[data-welcome-card]')];
      expect(cards.map((card) => card.dataset.welcomeCard)).toEqual(['left', 'right', 'center']);
      expect(cards[0].className).toContain('animate-welcome-float-left');
      expect(cards[1].className).toContain('animate-welcome-float-right');
      expect(cards[2].className).toContain('animate-welcome-float-center');
      expect(cards[2].className).toContain('bg-inverse');
      expect(cards[2].querySelector('.border-dashed')).not.toBeNull();
    });

    it('nothing floats under reduced motion', () => {
      reduceMotion();
      renderWelcome();

      for (const card of screen.getByTestId('welcome-cards').querySelectorAll('[data-welcome-card]')) {
        expect(card.className).not.toMatch(/animate-/);
      }
    });
  });

  describe('AC2: step 2 types a name into the blank', () => {
    it(`types "${NAME}" one letter every ${String(MOTION.welcomeTypeLetter)}ms, holds it whole about 1.2s, then types it again`, () => {
      vi.useFakeTimers();
      renderWelcome({ step: 1 });
      expect(blank()).toBe('');

      for (let letters = 1; letters <= NAME.length; letters++) {
        act(() => {
          vi.advanceTimersByTime(MOTION.welcomeTypeLetter - 1);
        });
        expect(blank(), `${String(letters - 1)} letters, 1ms before the next`).toBe(NAME.slice(0, letters - 1));
        act(() => {
          vi.advanceTimersByTime(1);
        });
        expect(blank(), `${String(letters)} letters`).toBe(NAME.slice(0, letters));
      }

      // Whole: how long it stays so, to the millisecond
      let held = 0;
      while (blank() === NAME && held < 5000) {
        act(() => {
          vi.advanceTimersByTime(1);
        });
        held += 1;
      }
      expect(held).toBeGreaterThanOrEqual(1100);
      expect(held).toBeLessThanOrEqual(1300);

      // Then again, from the first letter
      expect(blank()).toBe('');
      act(() => {
        vi.advanceTimersByTime(MOTION.welcomeTypeLetter);
      });
      expect(blank()).toBe('C');
    });

    it('leaves no timer once unmounted', () => {
      vi.useFakeTimers();
      const { unmount } = renderWelcome({ step: 1 });
      act(() => {
        vi.advanceTimersByTime(MOTION.welcomeTypeLetter * 5);
      });
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      unmount();

      expect(vi.getTimerCount()).toBe(0);
    });

    it.each([
      ['Next', () => primary()],
      ['Back', () => screen.getByRole('button', { name: 'Back' })],
      ['Skip', () => screen.getByRole('button', { name: 'Skip' })],
      ['the first dot', () => screen.getByRole('button', { name: 'Step 1 of 3' })]
    ])('leaves no timer once the step is left with %s', (_how, control) => {
      vi.useFakeTimers();
      renderWelcome({ step: 1 });
      act(() => {
        vi.advanceTimersByTime(MOTION.welcomeTypeLetter * 3);
      });
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      fireEvent.click(control());

      expect(screen.queryByTestId('welcome-blank')).not.toBeInTheDocument();
      expect(vi.getTimerCount()).toBe(0);
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(vi.getTimerCount()).toBe(0);
    });

    it('starts over, from an empty blank, when the step is shown again', () => {
      vi.useFakeTimers();
      renderWelcome({ step: 1 });
      act(() => {
        vi.advanceTimersByTime(MOTION.welcomeTypeLetter * 6);
      });
      expect(blank()).toBe(NAME.slice(0, 6));

      fireEvent.click(primary());
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));

      expect(blank()).toBe('');
    });

    it('gives the whole sentence to assistive technology and hides the typing from it', () => {
      renderWelcome({ step: 1 });

      const sentence = screen.getByText(SENTENCE, { exact: true });
      expect(sentence.closest('[aria-hidden="true"]')).toBeNull();
      expect(sentence.className).toContain('sr-only');
      expect(screen.getByTestId('welcome-blank').closest('[aria-hidden="true"]')).not.toBeNull();
    });

    it('a caret blinks after the letters typed', () => {
      renderWelcome({ step: 1 });

      const caret = screen.getByTestId('welcome-blank').querySelector('[data-welcome-caret]');
      expect(caret?.className).toContain('animate-welcome-caret');
    });

    it('under reduced motion shows the whole name at once: no timer, no caret', () => {
      reduceMotion();
      vi.useFakeTimers();
      renderWelcome({ step: 1 });

      expect(blank()).toBe(NAME);
      expect(vi.getTimerCount()).toBe(0);
      expect(screen.getByTestId('welcome-blank').querySelector('[data-welcome-caret]')).toBeNull();
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(blank()).toBe(NAME);
      expect(screen.getByText(SENTENCE, { exact: true })).toBeInTheDocument();
    });
  });

  describe('AC4: step 3 offers the Packs as toggle buttons, and the primary button says what it adds', () => {
    it('shows every Pack with its color dot, its name and its number of Prompts', () => {
      renderWelcome({ step: 2 });

      const group = screen.getByRole('group', { name: 'Packs' });
      expect(within(group).getAllByRole('button')).toHaveLength(PACKS.length);
      for (const pack of PACKS) {
        const button = packButton(pack.name);
        expect(within(group).getByText(pack.name)).toBeInTheDocument();
        expect(button).toHaveTextContent(`${String(pack.prompts.length)} prompts`);
        const dot = button.querySelector<HTMLElement>('[data-pack-dot]');
        expect(dot).toHaveAttribute('aria-hidden', 'true');
        expect(dot).toHaveStyle({ backgroundColor: pack.color });
      }
    });

    it('aria-pressed follows the selection, the Packs selected by default first pressed', async () => {
      const { user } = renderWelcome({ step: 2 });

      for (const pack of PACKS) {
        expect(packButton(pack.name), pack.name).toHaveAttribute('aria-pressed', String(pack.defaultSelected));
      }

      const unselected = PACKS.find((pack) => !pack.defaultSelected);
      const selected = PACKS.find((pack) => pack.defaultSelected);
      if (!unselected || !selected) {
        throw new Error('the Packs have one selected by default and one not');
      }
      await user.click(packButton(unselected.name));
      await user.click(packButton(selected.name));

      expect(packButton(unselected.name)).toHaveAttribute('aria-pressed', 'true');
      expect(packButton(selected.name)).toHaveAttribute('aria-pressed', 'false');
    });

    it('a selected Pack is tinted, bordered in its color and checked; an unselected one is a plain card', () => {
      renderWelcome({ step: 2 });

      for (const pack of PACKS) {
        const button = packButton(pack.name);
        const check = button.querySelector<HTMLElement>('[data-pack-check]');
        if (pack.defaultSelected) {
          expect(button).toHaveStyle({ borderColor: pack.color });
          expect(button.className).toContain('bg-[var(--pack-bg)]');
          expect(check?.className).toContain('animate-welcome-check');
          expect(check).toHaveAttribute('aria-hidden', 'true');
        } else {
          expect(button.className).toContain('bg-card');
          expect(button.className).toContain('border-default');
          expect(check).toBeNull();
        }
        expect(button.className).toContain('active:scale-95');
      }
    });

    it(`labels the primary button "Add N prompts" with the Prompts of the Packs selected, "Start empty" with none`, async () => {
      const { user } = renderWelcome({ step: 2 });
      const label = (text: string) => new RegExp(`^${text}$`);

      expect(primary()).toHaveTextContent(label(`Add ${String(promptCount(DEFAULTS))} prompts`));

      await user.click(packButton('Engineering'));
      expect(primary()).toHaveTextContent(label(`Add ${String(promptCount([...DEFAULTS, 'engineering']))} prompts`));

      for (const id of [...DEFAULTS, 'engineering']) {
        const name = PACKS.find((pack) => pack.id === id)?.name ?? id;
        await user.click(packButton(name));
      }
      expect(primary()).toHaveTextContent(label('Start empty'));

      await user.click(packButton('Hiring'));
      expect(primary()).toHaveTextContent(label(`Add ${String(promptCount(['hiring']))} prompts`));
    });

    it('labels the primary button Next on the first two steps', () => {
      renderWelcome({ step: 0 });
      expect(primary()).toHaveTextContent(/^Next$/);

      fireEvent.click(primary());
      expect(primary()).toHaveTextContent(/^Next$/);
    });

    it('a Pack toggled records the step with the new selection, so a Welcome closed there resumes with it', async () => {
      const { user, saveStep } = renderWelcome({ step: 2 });

      await user.click(packButton('Hiring'));

      expect(saveStep.mock.calls).toEqual([[2, [...DEFAULTS, 'hiring']]]);
    });

    it('resumes with the stored selection, pressed and counted', () => {
      renderWelcome({ step: 2, packs: ['engineering'] });

      expect(packButton('Engineering')).toHaveAttribute('aria-pressed', 'true');
      expect(packButton('Product')).toHaveAttribute('aria-pressed', 'false');
      expect(primary()).toHaveTextContent(new RegExp(`^Add ${String(promptCount(['engineering']))} prompts$`));
    });
  });

  describe('step 3: the Platforms the extension works on', () => {
    it('lists them as pills, by their short names, linked Platforms once', () => {
      renderWelcome({ step: 2 });

      const list = screen.getByRole('list', { name: 'Works on' });
      expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        'Claude',
        'ChatGPT',
        'Mistral',
        'Gemini',
        'Perplexity',
        'Copilot'
      ]);
    });
  });
});
