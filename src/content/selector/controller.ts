/**
 * Controller of the Prompt selector: the plain TypeScript side that the injector talks to.
 *
 * It owns the shadow host (ADR-002), opens the selector over an input field, keeps it placed while
 * the page scrolls or resizes, closes it (Escape, outside click, second click on the Prompts
 * button, input field gone), waits for the closing animation, then hands the chosen Prompt back
 * for Insertion. React is imported the first time the selector opens.
 *
 * After the Insertion it shows the confirmation in the same shadow host: a sweep over the input
 * field and a pill with Undo, which puts back the plain text the field held before.
 */

import { fillVariables } from '../../utils/promptVariables';
import type { Prompt } from '../types/index';
import { debug, error as logError } from '../utils/logger';
import { ThemeManager } from '../utils/theme-manager';

import { loadSelectorFont } from './font';
import type { FieldBox } from './InsertionFeedback';
import { focusAtEnd, readInputText } from './inputText';
import { DURATION, prefersReducedMotion } from './motion';
import { type AnchorRect, chooseSide, computePlacement, type Side } from './position';
import type { SelectorRoot } from './render';
import type { SelectorLibrary } from './selectorData';
import { createSelectorStore, type PendingInsertion, type SelectorStore } from './selectorMachine';
import { getSelectorCSS } from './selectorStyles';

export const SELECTOR_HOST_ID = 'mpm-prompt-selector';

/** Events that must not travel from the selector to the Platform's own listeners. */
const CONTAINED_EVENTS = ['keydown', 'keyup', 'keypress', 'beforeinput', 'input', 'paste', 'copy', 'cut'] as const;

/** Keys that do nothing on their own: pressing one is not the user going on to something else. */
const MODIFIER_KEYS: ReadonlySet<string> = new Set([
  'Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'OS', 'CapsLock', 'NumLock', 'ScrollLock', 'Fn', 'FnLock', 'Hyper', 'Super', 'Symbol', 'SymbolLock'
]);

/** How far from the input field, in pixels, the Prompts button still counts as part of the input area. */
const BUTTON_REACH = 120;

export interface SelectorCallbacks {
  /** Reads what the selector lists, each time it opens. */
  loadLibrary: () => Promise<SelectorLibrary>;
  /**
   * Inserts the chosen Prompt, once the selector has closed. `content` has its Variables filled in.
   * Resolves to whether the text arrived in the input field.
   */
  insert: (prompt: Prompt, content: string, target: HTMLElement) => boolean | Promise<boolean>;
  /** Undo: puts `text` back as the whole content of the input field. Resolves to whether it did. */
  restore: (text: string, target: HTMLElement) => boolean | Promise<boolean>;
  /** Called when the selector opens and when it has closed, with the button that opened it. */
  onOpenChange?: (open: boolean, trigger: HTMLElement | null) => void;
}

interface OpenSession {
  target: HTMLElement;
  trigger: HTMLElement | null;
  side: Side;
  /** Whether the focus goes back to the input field once the selector has closed. */
  restoreFocus: boolean;
  /** Where the input field was when the selector was last placed: it may be gone when the selector has closed. */
  field: FieldBox;
  teardown: () => void;
}

/** The confirmation shown after an Insertion, until it leaves. */
interface Feedback {
  id: number;
  kind: 'inserted' | 'failed' | 'undoFailed';
  title: string;
  /** The input field, or null when it was gone before the Prompt could be inserted. */
  target: HTMLElement | null;
  field: FieldBox;
  /** The plain text the field held before the Insertion: what Undo puts back. */
  previous: string;
  sweep: boolean;
  leaving: boolean;
  /** The pointer or the focus is on the pill: it stays. */
  held: boolean;
  stayTimer: number | null;
  leaveTimer: number | null;
  teardown: () => void;
}

const boxOf = (target: HTMLElement): FieldBox => {
  const rect = target.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height, radius: window.getComputedStyle(target).borderRadius };
};

export class PromptSelectorController {
  private readonly store: SelectorStore = createSelectorStore();
  private host: HTMLElement | null = null;
  private root: SelectorRoot | null = null;
  private session: OpenSession | null = null;
  private feedback: Feedback | null = null;
  private feedbacks = 0;
  /** Counts the destructions, so an Insertion still being written when the controller is removed ends silently. */
  private destructions = 0;
  private closeTimer: number | null = null;
  /** Counts the openings, so one still loading when another starts (or when it is closed) is dropped. */
  private openings = 0;
  /** The opening still loading its Library and React, if any: a second click cancels it. */
  private loading: number | null = null;
  /** The button of the opening that is loading: the latest one, if the Platform replaced it meanwhile. */
  private loadingTrigger: HTMLElement | null = null;
  private readonly onThemeChange = (theme: 'light' | 'dark'): void => {
    this.host?.setAttribute('data-theme', theme);
  };

  constructor(private readonly callbacks: SelectorCallbacks) {
    // A host already in the page belongs to an earlier instance of the content script (the
    // extension was updated or reloaded): open or not, it is dead, so it goes
    document.getElementById(SELECTOR_HOST_ID)?.remove();
    this.store.subscribe(() => { this.onStateChange(); });
  }

  /** True from the opening until the closing animation has run. */
  get isOpen(): boolean {
    return this.session !== null;
  }

  /** Opens the selector over `target`, or closes it when it is open: a second click on the button. */
  toggle(target: HTMLElement, trigger: HTMLElement | null): void {
    // Clicked again while the first click's opening was still loading: that opening is dropped,
    // or the selector would show up after the click meant to close it
    if (this.loading !== null) {
      this.openings++;
      this.loading = null;
      return;
    }
    if (this.session && this.store.getState().phase !== 'closing') {
      this.close();
      return;
    }
    void this.open(target, trigger);
  }

  /**
   * Opens the selector over `target`: reads the Library, loads React on the first opening, then
   * shows the list. An opening that was superseded or cancelled while it loaded shows nothing.
   */
  async open(target: HTMLElement, trigger: HTMLElement | null): Promise<void> {
    const opening = ++this.openings;
    this.loading = opening;
    this.loadingTrigger = trigger;
    try {
      this.finishClose();
      // The user moved on: the confirmation of the last Insertion goes, and with it its Undo
      this.clearFeedback();

      const [library, { createSelectorRoot }] = await Promise.all([this.callbacks.loadLibrary(), import('./render')]);
      // Opened again, closed or destroyed while these loaded: this opening is no longer wanted
      if (opening !== this.openings || !target.isConnected) {
        return;
      }

      const container = this.mount();
      this.root ??= createSelectorRoot(container);

      const current = this.loadingTrigger;
      const side = chooseSide(this.anchor({ target, trigger: current }), this.viewport());
      this.session = { target, trigger: current, side, restoreFocus: true, field: boxOf(target), teardown: this.listen(target) };
      this.store.dispatch({ type: 'open', library });
      this.render();
      this.callbacks.onOpenChange?.(true, current);
      debug('Prompt selector opened', { promptCount: library.prompts.length, side });
    } catch (err) {
      logError('Failed to open the prompt selector', err instanceof Error ? err : new Error(String(err)));
      // Only its own mess: a later opening may be showing a healthy selector by now
      if (opening === this.openings) {
        this.finishClose();
      }
    } finally {
      if (this.loading === opening) {
        this.loading = null;
      }
    }
  }

  /**
   * Tells the open selector that the Platform replaced the Prompts button (it re-rendered its
   * toolbar): the new button is the one that closes it, that is not "outside", and that says it is open.
   */
  setTrigger(trigger: HTMLElement | null): void {
    // Replaced while the selector was still loading: the opening takes the new button when it shows
    if (this.loading !== null) {
      this.loadingTrigger = trigger;
      return;
    }
    if (!this.session || this.session.trigger === trigger) {
      return;
    }
    this.session.trigger = trigger;
    this.callbacks.onOpenChange?.(true, trigger);
  }

  /** Starts closing. `restoreFocus` false leaves the focus where it is (the input field is gone, or the user clicked elsewhere). */
  close(restoreFocus = true): void {
    this.openings++;
    this.loading = null;
    if (!this.session) {
      return;
    }
    this.session.restoreFocus = restoreFocus;
    this.store.dispatch({ type: 'close' });
  }

  /** Removes the selector and its host from the page. */
  destroy(): void {
    this.destructions++;
    this.openings++;
    this.loading = null;
    if (this.session) {
      this.session.restoreFocus = false;
    }
    // Nothing is inserted from a selector that is being removed (the site was disabled)
    this.finishClose(true);
    this.clearFeedback();
    this.root?.unmount();
    this.root = null;
    ThemeManager.getInstance().removeObserver(this.onThemeChange);
    this.host?.remove();
    this.host = null;
  }

  /** Creates the shadow host once and returns the element React renders into. */
  private mount(): HTMLElement {
    if (this.host?.isConnected && this.host.shadowRoot?.firstElementChild) {
      return this.host.shadowRoot.querySelector<HTMLElement>('[data-mpm-root]') as HTMLElement;
    }

    // A host left by an earlier instance of the content script (extension reloaded)
    document.getElementById(SELECTOR_HOST_ID)?.remove();
    this.root?.unmount();
    this.root = null;

    const host = document.createElement('div');
    host.id = SELECTOR_HOST_ID;
    // The host takes no room and no pointer; the popover inside is fixed to the window, above the page
    for (const [property, value] of [
      ['all', 'initial'],
      ['position', 'fixed'],
      ['top', '0'],
      ['left', '0'],
      ['width', '0'],
      ['height', '0'],
      ['z-index', '2147483647'],
      ['pointer-events', 'none']
    ]) {
      host.style.setProperty(property, value, 'important');
    }

    const themeManager = ThemeManager.getInstance();
    host.setAttribute('data-theme', themeManager.getCurrentTheme());
    themeManager.addObserver(this.onThemeChange);

    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = getSelectorCSS();
    const container = document.createElement('div');
    container.setAttribute('data-mpm-root', '');
    shadow.append(style, container);

    // Keys typed in the selector never reach the Platform: Enter there must not send the message.
    // React listens on the container inside the shadow root, so it has handled the event by now.
    for (const type of CONTAINED_EVENTS) {
      host.addEventListener(type, (event) => { event.stopPropagation(); });
    }

    document.body.appendChild(host);
    this.host = host;
    void loadSelectorFont();
    return container;
  }

  /**
   * What the popover is placed against: the input field, grown to take in the Prompts button when
   * the button sits right above or below it, so the popover never covers the button that closes it.
   */
  private anchor(session: Pick<OpenSession, 'target' | 'trigger'>): AnchorRect {
    const field = session.target.getBoundingClientRect();
    const anchor = { top: field.top, bottom: field.bottom, left: field.left };
    if (session.trigger?.isConnected) {
      const button = session.trigger.getBoundingClientRect();
      const near = button.width > 0 && button.top < field.bottom + BUTTON_REACH && button.bottom > field.top - BUTTON_REACH;
      if (near) {
        anchor.top = Math.min(anchor.top, button.top);
        anchor.bottom = Math.max(anchor.bottom, button.bottom);
      }
    }
    return anchor;
  }

  private viewport(): { width: number; height: number } {
    return { width: document.documentElement.clientWidth || window.innerWidth, height: window.innerHeight };
  }

  /**
   * Renders what the shadow root shows now: the open selector where its input field is, and the
   * confirmation of the last Insertion. Called again when the page scrolls or resizes.
   */
  private render(): void {
    if (!this.root) {
      return;
    }
    const session = this.session;
    if (session?.target.isConnected) {
      session.field = boxOf(session.target);
    }
    const feedback = this.feedback;
    if (feedback?.target?.isConnected) {
      feedback.field = boxOf(feedback.target);
    }
    this.root.render({
      popover: session ? { store: this.store, placement: computePlacement(this.anchor(session), this.viewport(), session.side) } : null,
      feedback: feedback && {
        id: feedback.id,
        kind: feedback.kind,
        title: feedback.title,
        field: feedback.field,
        viewport: this.viewport(),
        sweep: feedback.sweep,
        leaving: feedback.leaving,
        onUndo: () => { void this.undo(feedback); },
        onHold: (held) => { this.holdFeedback(feedback, held); }
      }
    });
  }

  /** Listeners that live as long as the selector is open. Returns their removal. */
  private listen(target: HTMLElement): () => void {
    const onPointerDown = (event: Event): void => {
      const path = event.composedPath();
      // Read at each click: the Platform may have replaced the button since the selector opened
      const trigger = this.session?.trigger;
      if ((this.host && path.includes(this.host)) || (trigger && path.includes(trigger))) {
        return;
      }
      // The user clicked elsewhere: the focus is theirs
      this.close(false);
    };

    let frame: number | null = null;
    const onMove = (): void => {
      frame ??= window.requestAnimationFrame(() => {
        frame = null;
        this.render();
      });
    };

    // The Platform replaced its input field (it navigated inside the page): nothing to insert into
    const watch = window.setInterval(() => {
      if (!target.isConnected) {
        debug('Input field gone while the prompt selector was open, closing');
        this.close(false);
      }
    }, 250);

    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      window.clearInterval(watch);
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }

  /** When the state turns to closing, waits for the closing animation, once, before the selector is removed. */
  private onStateChange(): void {
    if (this.store.getState().phase !== 'closing' || this.closeTimer !== null) {
      return;
    }
    // Unmount once the closing animation has run
    this.closeTimer = window.setTimeout(() => { this.finishClose(); }, prefersReducedMotion() ? 0 : DURATION.close);
  }

  /**
   * Ends the open session, if any: the selector leaves the page, then the pending Insertion is
   * performed, unless `discard` drops it.
   */
  private finishClose(discard = false): void {
    if (this.closeTimer !== null) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    const session = this.session;
    if (!session) {
      return;
    }

    const state = this.store.getState();
    const pending = state.pending;
    const prompt = pending ? state.library.prompts.find((candidate) => candidate.id === pending.promptId) : undefined;

    this.session = null;
    session.teardown();
    this.store.dispatch({ type: 'close' });
    this.store.dispatch({ type: 'closed' });
    this.callbacks.onOpenChange?.(false, session.trigger);

    if (discard) {
      this.render();
      return;
    }
    if (pending && prompt && session.target.isConnected) {
      // A click elsewhere while the selector was closing already put the focus where the user wants it
      void this.insert(prompt, pending, session.target, !session.restoreFocus);
    } else if (pending && prompt) {
      // The Platform replaced its input field while the selector closed: the Prompt has nowhere to go
      this.showFeedback({ kind: 'failed', title: prompt.title, target: null, field: session.field, previous: '' });
    } else if (session.restoreFocus && session.target.isConnected) {
      session.target.focus({ preventScroll: true });
    }
    this.render();
  }

  /**
   * Hands the chosen Prompt back for Insertion, with its Variables filled in when the user filled
   * some, then confirms it: the focus is in the input field with the caret at the end, and the
   * pill offers Undo. A failed Insertion is said, with nothing to undo. Never throws.
   */
  private async insert(prompt: Prompt, pending: PendingInsertion, target: HTMLElement, movedOnAlready: boolean): Promise<void> {
    const destructions = this.destructions;
    const previous = readInputText(target);
    // Where the field is now: the Platform may replace it while it takes the text
    const lastField = boxOf(target);
    // What the user does while the Platform takes the text: a paste, a drop or a composed
    // character in the field comes after the snapshot above, so Undo would discard it; a key or
    // a click, wherever it lands, types in the field or takes the focus where they want it (Tab
    // is pressed on whatever holds the focus by then). Only the user's own actions are trusted
    // events, and the events an Insertion sends are none of these
    let movedOn = movedOnAlready;
    const inField = (event: Event): boolean => event.composedPath().includes(target);
    const onUserAction = (event: Event): void => {
      // Shift, Control and the like held on their own change neither the focus nor the text
      if (event instanceof KeyboardEvent && MODIFIER_KEYS.has(event.key)) {
        return;
      }
      if (event.isTrusted && (event.type === 'pointerdown' || event.type === 'keydown' || inField(event))) {
        movedOn = true;
      }
    };
    const USER_ACTIONS = ['keydown', 'paste', 'drop', 'compositionstart', 'pointerdown'] as const;
    for (const type of USER_ACTIONS) {
      document.addEventListener(type, onUserAction, true);
    }
    let inserted = false;
    try {
      // A Prompt inserted as saved arrives Verbatim; filling its Variables in is the user's own change
      const content = pending.values === null ? prompt.content : fillVariables(prompt.content, pending.values);
      inserted = await this.callbacks.insert(prompt, content, target);
    } catch (err) {
      logError('Failed to insert the chosen prompt', err instanceof Error ? err : new Error(String(err)), { promptId: prompt.id });
    } finally {
      for (const type of USER_ACTIONS) {
        document.removeEventListener(type, onUserAction, true);
      }
    }
    // The controller was removed meanwhile (the site was disabled, the page navigated): nothing
    // of it comes back, not even the focus
    if (destructions !== this.destructions) {
      return;
    }
    // The selector was opened again while the Platform took the text, or is loading to open: the
    // user has moved on, so neither the focus nor a confirmation with Undo comes after them
    if (this.session || this.loading !== null) {
      return;
    }
    // The user has already gone on: the focus and the caret are theirs, and Undo is stale
    if (inserted && movedOn) {
      return;
    }
    if (target.isConnected) {
      if (inserted) {
        focusAtEnd(target);
      } else if (!movedOn) {
        // A failure is still said to a user who has gone on, but the focus stays where they put it
        target.focus({ preventScroll: true });
      }
    }
    // A field that is gone holds no Prompt, whatever the Platform's strategy reported
    const there = target.isConnected;
    this.showFeedback({
      kind: inserted && there ? 'inserted' : 'failed',
      title: prompt.title,
      target: there ? target : null,
      field: there ? boxOf(target) : lastField,
      previous
    });
  }

  /** Shows the confirmation of an Insertion; an earlier one still on screen goes at once. */
  private showFeedback(shown: Pick<Feedback, 'kind' | 'title' | 'target' | 'field' | 'previous'>): void {
    this.clearFeedback();
    if (!this.root || !this.host?.isConnected || (shown.field.width === 0 && shown.field.height === 0)) {
      return;
    }
    const feedback: Feedback = {
      ...shown,
      id: ++this.feedbacks,
      sweep: shown.kind === 'inserted' && !prefersReducedMotion(),
      leaving: false,
      held: false,
      stayTimer: null,
      leaveTimer: null,
      teardown: () => { /* set below */ }
    };
    feedback.teardown = this.listenFeedback(feedback);
    this.feedback = feedback;
    this.stayFeedback(feedback);
    this.render();
  }

  /**
   * Listeners that live as long as the confirmation: it leaves when the user types in the input
   * field or sends the message, and when the field is gone; it follows the field when the page
   * scrolls or resizes. Returns their removal.
   */
  private listenFeedback(feedback: Feedback): () => void {
    const target = feedback.target;
    const inField = (event: Event): boolean => target !== null && event.composedPath().includes(target);
    const leave = (): void => { this.dismissFeedback(feedback); };

    const onInput = (event: Event): void => {
      if (inField(event)) {
        leave();
      }
    };
    // Enter sends the message on the Platforms; a click on their send button empties the field,
    // which the watch below sees
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Enter' && !event.isComposing && inField(event)) {
        leave();
      }
    };

    let frame: number | null = null;
    const onMove = (): void => {
      frame ??= window.requestAnimationFrame(() => {
        frame = null;
        this.render();
      });
    };

    // What the field holds now, read before the user can do anything: a field that changes
    // without a key (the send button empties it) is seen from the first tick on. An editor may lay
    // the inserted text out again right after the Insertion (paragraphs for line breaks), so only
    // the characters other than spaces and line breaks are compared; one that has not shown the
    // text yet gives its baseline at the first tick where it has
    const characters = (text: string): string => text.replace(/\s+/g, '');
    let baseline: string | null = target ? characters(readInputText(target)) || null : null;
    const watch = window.setInterval(() => {
      if (!target) {
        return;
      }
      if (!target.isConnected) {
        leave();
        return;
      }
      const now = characters(readInputText(target));
      if (baseline === null) {
        baseline = now || null;
      } else if (now !== baseline) {
        leave();
      }
    }, 250);

    document.addEventListener('input', onInput, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);

    return () => {
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      window.clearInterval(watch);
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }

  /** Starts the time the confirmation stays; it does not run while the pill is hovered or focused. */
  private stayFeedback(feedback: Feedback): void {
    if (feedback.stayTimer !== null) {
      window.clearTimeout(feedback.stayTimer);
      feedback.stayTimer = null;
    }
    if (!feedback.held && !feedback.leaving) {
      feedback.stayTimer = window.setTimeout(() => { this.dismissFeedback(feedback); }, DURATION.insertedStay);
    }
  }

  private holdFeedback(feedback: Feedback, held: boolean): void {
    if (this.feedback !== feedback) {
      return;
    }
    feedback.held = held;
    this.stayFeedback(feedback);
  }

  /** The confirmation fades out, then is removed. */
  private dismissFeedback(feedback: Feedback): void {
    if (this.feedback !== feedback || feedback.leaving) {
      return;
    }
    feedback.leaving = true;
    feedback.teardown();
    this.stayFeedback(feedback);
    feedback.leaveTimer = window.setTimeout(() => { this.clearFeedback(); }, prefersReducedMotion() ? 0 : DURATION.close);
    this.render();
  }

  /** Removes the confirmation at once. */
  private clearFeedback(): void {
    const feedback = this.feedback;
    if (!feedback) {
      return;
    }
    this.feedback = null;
    feedback.teardown();
    for (const timer of [feedback.stayTimer, feedback.leaveTimer]) {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    }
    this.render();
  }

  /**
   * Undo: the input field takes back the plain text it held before the Insertion, with the focus
   * and the caret at its end. The use of the Prompt stays counted. When the Platform refuses, the
   * pill says so. Never throws.
   */
  private async undo(feedback: Feedback): Promise<void> {
    const target = feedback.target;
    if (this.feedback !== feedback || feedback.leaving || feedback.kind !== 'inserted' || !target?.isConnected) {
      return;
    }
    this.clearFeedback();
    let restored = false;
    try {
      restored = await this.callbacks.restore(feedback.previous, target);
    } catch (err) {
      logError('Failed to undo the insertion', err instanceof Error ? err : new Error(String(err)));
    }
    if (!target.isConnected) {
      return;
    }
    focusAtEnd(target);
    // The inserted text is still there: the user is told, or Undo would seem to have worked
    if (!restored && !this.session) {
      this.showFeedback({ kind: 'undoFailed', title: feedback.title, target, field: boxOf(target), previous: feedback.previous });
    }
  }
}
