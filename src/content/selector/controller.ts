/**
 * Controller of the Prompt selector: the plain TypeScript side that the injector talks to.
 *
 * It owns the shadow host (ADR-002), opens the selector over an input field, keeps it placed while
 * the page scrolls or resizes, closes it (Escape, outside click, second click on the Prompts
 * button, input field gone), waits for the closing animation, then hands the chosen Prompt back
 * for Insertion. React is imported the first time the selector opens.
 */

import { fillVariables } from '../../utils/promptVariables';
import type { Prompt } from '../types/index';
import { debug, error as logError } from '../utils/logger';
import { ThemeManager } from '../utils/theme-manager';

import { loadSelectorFont } from './font';
import { DURATION, prefersReducedMotion } from './motion';
import { type AnchorRect, chooseSide, computePlacement, type Side } from './position';
import type { SelectorRoot } from './render';
import type { SelectorLibrary } from './selectorData';
import { createSelectorStore, type PendingInsertion, type SelectorStore } from './selectorMachine';
import { getSelectorCSS } from './selectorStyles';

export const SELECTOR_HOST_ID = 'mpm-prompt-selector';

/** Events that must not travel from the selector to the Platform's own listeners. */
const CONTAINED_EVENTS = ['keydown', 'keyup', 'keypress', 'beforeinput', 'input', 'paste', 'copy', 'cut'] as const;

/** How far from the input field, in pixels, the Prompts button still counts as part of the input area. */
const BUTTON_REACH = 120;

export interface SelectorCallbacks {
  /** Reads what the selector lists, each time it opens. */
  loadLibrary: () => Promise<SelectorLibrary>;
  /** Inserts the chosen Prompt, once the selector has closed. `content` has its Variables filled in. */
  insert: (prompt: Prompt, content: string, target: HTMLElement) => void | Promise<void>;
  /** Called when the selector opens and when it has closed, with the button that opened it. */
  onOpenChange?: (open: boolean, trigger: HTMLElement | null) => void;
}

interface OpenSession {
  target: HTMLElement;
  trigger: HTMLElement | null;
  side: Side;
  /** Whether the focus goes back to the input field once the selector has closed. */
  restoreFocus: boolean;
  teardown: () => void;
}

export class PromptSelectorController {
  private readonly store: SelectorStore = createSelectorStore();
  private host: HTMLElement | null = null;
  private root: SelectorRoot | null = null;
  private session: OpenSession | null = null;
  private closeTimer: number | null = null;
  /** Counts the openings, so one still loading when another starts (or when it is closed) is dropped. */
  private openings = 0;
  /** The opening still loading its Library and React, if any: a second click cancels it. */
  private loading: number | null = null;
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

  async open(target: HTMLElement, trigger: HTMLElement | null): Promise<void> {
    const opening = ++this.openings;
    this.loading = opening;
    try {
      this.finishClose();

      const [library, { createSelectorRoot }] = await Promise.all([this.callbacks.loadLibrary(), import('./render')]);
      // Opened again, closed or destroyed while these loaded: this opening is no longer wanted
      if (opening !== this.openings || !target.isConnected) {
        return;
      }

      const container = this.mount();
      this.root ??= createSelectorRoot(container);

      const side = chooseSide(this.anchor({ target, trigger }), this.viewport());
      this.session = { target, trigger, side, restoreFocus: true, teardown: this.listen(target, trigger) };
      this.store.dispatch({ type: 'open', library });
      this.render();
      this.callbacks.onOpenChange?.(true, trigger);
      debug('Prompt selector opened', { promptCount: library.prompts.length, side });
    } catch (err) {
      logError('Failed to open the prompt selector', err instanceof Error ? err : new Error(String(err)));
      this.finishClose();
    } finally {
      if (this.loading === opening) {
        this.loading = null;
      }
    }
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
    this.openings++;
    if (this.session) {
      this.session.restoreFocus = false;
    }
    this.finishClose();
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

  private render(): void {
    if (!this.session || !this.root) {
      return;
    }
    const placement = computePlacement(this.anchor(this.session), this.viewport(), this.session.side);
    this.root.render({ store: this.store, placement });
  }

  /** Listeners that live as long as the selector is open. Returns their removal. */
  private listen(target: HTMLElement, trigger: HTMLElement | null): () => void {
    const onPointerDown = (event: Event): void => {
      const path = event.composedPath();
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

  private onStateChange(): void {
    if (this.store.getState().phase !== 'closing' || this.closeTimer !== null) {
      return;
    }
    // Unmount once the closing animation has run
    this.closeTimer = window.setTimeout(() => { this.finishClose(); }, prefersReducedMotion() ? 0 : DURATION.close);
  }

  /** Ends the open session, if any: the selector leaves the page, then the pending Insertion is performed. */
  private finishClose(): void {
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

    if (pending && prompt && session.target.isConnected) {
      void this.insert(prompt, pending, session.target);
    } else if (session.restoreFocus && session.target.isConnected) {
      session.target.focus({ preventScroll: true });
    }
  }

  private async insert(prompt: Prompt, pending: PendingInsertion, target: HTMLElement): Promise<void> {
    try {
      // A Prompt inserted as saved arrives Verbatim; filling its Variables in is the user's own change
      const content = pending.values === null ? prompt.content : fillVariables(prompt.content, pending.values);
      await this.callbacks.insert(prompt, content, target);
    } catch (err) {
      logError('Failed to insert the chosen prompt', err instanceof Error ? err : new Error(String(err)), { promptId: prompt.id });
    }
  }
}
