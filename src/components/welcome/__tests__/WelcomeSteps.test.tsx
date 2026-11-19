/**
 * The content of the Welcome's three steps (My-Prompt-Manager-ojz.8): what the extension does, a
 * blank filled in before the user's eyes, and the Packs with the Platforms the extension works on.
 * Rendered through WelcomeHost, so the steps are seen as the user meets them.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SELECTOR_TRIGGER } from '../../../content/selector/inputText';
import { MOTION } from '../../../theme/motion';
import { packColors } from '../../../welcome/packColors';
import { PACKS } from '../../../welcome/packs';
import type { WelcomeStep } from '../../../welcome/storage';
import WelcomeHost, { type WelcomeHostProps } from '../WelcomeHost';

/**
 * The texts of the spec of record (epic My-Prompt-Manager-ojz, DESIGN, "Étape 1" to "Étape 3"), word for
 * word, but for step 1's "in this popup", now "here": the side panel is the default surface (decision D1,
 * My-Prompt-Manager-ojz.19); and for step 2, which says Variable, the product's word, where the spec said
 * "blanks", and promises the fill at an Insertion through //, which Copy never does (the owner's decisions
 * A2 and A3, My-Prompt-Manager-j2tu.1)
 */
const SPEC: Record<WelcomeStep, { title: string; text: string }> = {
  0: {
    title: 'Your best prompts, one tap away',
    text: 'Save the prompts you reuse and find them in a second, here or right inside your AI chat.'
  },
  1: {
    title: 'Add Variables, fill them in later',
    text: 'Put {{name}} where the details change. When you insert with //, you fill in each Variable right in the text.'
  },
  2: {
    title: 'Start with a pack',
    text: 'Pick what fits your work. Everything stays editable.'
  }
};

/** Step 3's caption before the Platform pills, and the name of their list (My-Prompt-Manager-ojz.19) */
const CAPTION = 'Type // in the chat on';

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

    it('step 2 says Variable, never blank, and promises the fill at an Insertion through //, nothing for Copy', () => {
      const { container } = renderWelcome({ step: 1 });

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveAccessibleName(SPEC[1].title);
      // "blank" and "blanks" nowhere in what the step renders, assistive text included, nor in a name
      expect(container.textContent).not.toMatch(/\bblanks?\b/i);
      for (const element of container.querySelectorAll('[aria-label], [title]')) {
        expect(`${element.getAttribute('aria-label') ?? ''} ${element.getAttribute('title') ?? ''}`).not.toMatch(/\bblanks?\b/i);
      }
      // The fill is the selector's (src/content/selector/PickerFill.tsx), reached with //; Copy copies the content as saved
      const text = screen.getByText(SPEC[1].text, { exact: true }).textContent ?? '';
      expect(text).toContain('with //');
      expect(text).toContain('each Variable');
      expect(text).not.toMatch(/\bcop(y|ies)\b/i);
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
        // The Pack's color in light, lifted toward white in dark (My-Prompt-Manager-ojz.11)
        expect(dot?.className).toContain('bg-[var(--pack-mark)]');
        expect(dot?.className).toContain('dark:bg-[var(--pack-mark-dark)]');
        expect(button.style.getPropertyValue('--pack-mark')).toBe(pack.color);
        expect(button.style.getPropertyValue('--pack-mark-dark')).toBe(packColors(pack.color).dark.mark);
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

    it('a selected Pack is tinted, bordered in its color and checked; an unselected one is a card outlined at 3:1', () => {
      renderWelcome({ step: 2 });

      for (const pack of PACKS) {
        const button = packButton(pack.name);
        const check = button.querySelector<HTMLElement>('[data-pack-check]');
        const colors = packColors(pack.color);
        if (pack.defaultSelected) {
          expect(button.style.getPropertyValue('--pack-tint')).toBe(colors.tint);
          expect(button.style.getPropertyValue('--pack-text')).toBe(colors.light.text);
          expect(button.style.getPropertyValue('--pack-text-dark')).toBe(colors.dark.text);
          expect(button.className).toContain('bg-[var(--pack-tint)]');
          expect(button.className).toContain('border-[color:var(--pack-mark)]');
          expect(button.className).toContain('dark:border-[color:var(--pack-mark-dark)]');
          expect(button.className).toContain('text-[var(--pack-text)]');
          expect(button.className).toContain('dark:text-[var(--pack-text-dark)]');
          expect(check?.className).toContain('animate-welcome-check');
          expect(check?.className).toContain('text-on-pack-check');
          expect(check?.className).toContain('bg-[var(--pack-mark)]');
          expect(check).toHaveAttribute('aria-hidden', 'true');
        } else {
          expect(button.className).toContain('bg-card');
          expect(button.className).toContain('border-input');
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

  // A short side panel cuts the Packs: Writing, selected by default, can be wholly below the grid's edge.
  // The cue is drawn by CSS on the grid's own scroll; tests/e2e/welcome/welcome-a11y.spec.ts measures it
  describe('step 3: a Pack beyond the grid\'s edge is never out of view unseen', () => {
    it('the grid scrolls on its own timeline inside the edges that draw the cue, with room for a Pack\'s focus outline (3px past it): 6px of padding, and 4px of scroll padding for a Pack the keyboard reaches', () => {
      renderWelcome({ step: 2 });

      const grid = screen.getByRole('group', { name: 'Packs' });
      expect(grid).toHaveClass('welcome-packs-scroll', 'overflow-y-auto', 'scroll-py-1', 'p-1.5', '-m-1.5');
      expect(grid.parentElement).toHaveClass('welcome-packs-edges', 'relative', 'min-h-0');
      expect(within(grid).getAllByRole('button')).toHaveLength(PACKS.length);
    });
  });

  describe('step 3: the Platforms the extension works on', () => {
    it('lists them as pills, by their short names, linked Platforms once', () => {
      renderWelcome({ step: 2 });

      const list = screen.getByRole('list', { name: CAPTION });
      expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        'Claude',
        'ChatGPT',
        'Mistral',
        'Gemini',
        'Perplexity',
        'Copilot'
      ]);
    });

    // My-Prompt-Manager-ojz.19, decision D1: the Welcome says how a Prompt gets into the chat
    it('says what to do there in a visible caption before the pills, so the row reads as one sentence ending in the Platform names', () => {
      renderWelcome({ step: 2 });

      // The caption is the element whose whole text is the sentence (its "//" set apart in weight)
      const caption = screen.getByText((_content, element) => element?.tagName === 'SPAN' && element.textContent === CAPTION);
      expect(caption).toBeVisible();
      const list = screen.getByRole('list', { name: CAPTION });
      // Before the first pill, in the same row
      const firstPill = within(list).getAllByRole('listitem')[0];
      expect(caption.compareDocumentPosition(firstPill) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(caption.parentElement).toBe(list.parentElement);
      // In the step's secondary text color, which follows the theme on its own
      expect(caption).toHaveClass('text-secondary');
    });

    it('names the list with that caption: its accessible name is the caption itself, not a label of its own', () => {
      renderWelcome({ step: 2 });

      const list = screen.getByRole('list', { name: CAPTION });
      expect(list).not.toHaveAttribute('aria-label');
      const caption = document.getElementById(list.getAttribute('aria-labelledby') ?? '');
      expect(caption).toBeVisible();
      expect(caption?.textContent).toBe(CAPTION);
      expect(list.contains(caption)).toBe(false);
      expect(screen.queryByRole('list', { name: 'Works on' })).not.toBeInTheDocument();
    });

    it('names the characters that really open the Prompt selector in the chat', () => {
      expect(CAPTION.startsWith(`Type ${SELECTOR_TRIGGER} `)).toBe(true);
    });
  });
});
