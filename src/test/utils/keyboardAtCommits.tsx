import { Profiler, type ReactElement, type ReactNode } from 'react';

/**
 * Where the keyboard is at the end of each commit of a tree (My-Prompt-Manager-ou48). React calls a
 * Profiler's onRender in the layout phase of every commit in its tree, once the layout effects of the
 * components under it have run and before any passive effect. A focus moved by a layout effect is in
 * place there; one moved by a passive effect is not yet, so the keyboard is still on the document: its
 * body, or an element the commit removed. No timing involved, so happy-dom sees it as Chrome would.
 */
export interface KeyboardAtCommits {
  /** The tree to watch, under the Profiler */
  wrap: (tree: ReactNode) => ReactElement;
  /** Starts reading the keyboard at each commit, from now on */
  start: () => void;
  /** The commits read since start() */
  commits: () => number;
  /** The commits since start() that ended with the keyboard on the document */
  onDocument: () => string[];
}

export const keyboardAtCommits = (): KeyboardAtCommits => {
  let watching = false;
  let commits = 0;
  const onDocument: string[] = [];
  const onRender = (): void => {
    if (!watching) { return; }
    commits += 1;
    const active = document.activeElement;
    if (active === null || active === document.body || !active.isConnected) {
      onDocument.push(`commit ${String(commits)}: ${active === null ? 'no element' : active === document.body ? 'the body' : `a removed <${active.tagName.toLowerCase()}>`}`);
    }
  };
  return {
    wrap: (tree) => <Profiler id="keyboard-at-commits" onRender={onRender}>{tree}</Profiler>,
    start: () => { watching = true; },
    commits: () => commits,
    onDocument: () => [...onDocument]
  };
};
