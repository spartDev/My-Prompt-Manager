import { useCallback, useEffect, useRef, useState } from 'react';

import { DEFAULT_CATEGORY_COLOR } from '../constants/colors';
import { MOTION, motionDuration } from '../theme/motion';
import type { Category } from '../types';

export type CategorySheetMode = 'create' | 'edit';

type Phase = 'closed' | 'open' | 'closing';

interface SheetState {
  phase: Phase;
  mode: CategorySheetMode;
  /** The Category being edited; null when creating */
  category: Category | null;
  /** The draft: what the Category will be called and colored */
  name: string;
  color: string;
  /** Counts the openings: each one is a new sheet, with its own form state */
  session: number;
}

export interface UseCategorySheetOptions {
  /** Called once the sheet has left the page after closing */
  onClosed?: () => void;
}

export interface UseCategorySheetReturn {
  /** On the page: open, or playing its exit */
  isMounted: boolean;
  /** Open and taking input; false while it plays its exit */
  isOpen: boolean;
  mode: CategorySheetMode;
  category: Category | null;
  name: string;
  color: string;
  /** A new value at each opening, to key the sheet so each opening starts afresh */
  session: number;
  setName: (name: string) => void;
  setColor: (color: string) => void;
  /** Opens an empty sheet to create a Category, starting with this color */
  openCreate: (color: string) => void;
  /** Opens the sheet on a Category, its name and color filled in */
  openEdit: (category: Category) => void;
  /** Plays the exit, then takes the sheet off the page; saves nothing */
  close: () => void;
}

const CLOSED: SheetState = {
  phase: 'closed',
  mode: 'create',
  category: null,
  name: '',
  color: DEFAULT_CATEGORY_COLOR,
  session: 0
};

/**
 * The state of the Category sheet, apart from how it is drawn: whether it is open, closing or gone,
 * in which mode, and the draft name and color. Closing waits for the exit (MOTION.categorySheetOut;
 * nothing under prefers-reduced-motion) before taking the sheet off the page; opening again meanwhile
 * cancels that, so only one sheet is ever on the page.
 */
export function useCategorySheet({ onClosed }: UseCategorySheetOptions = {}): UseCategorySheetReturn {
  const [state, setState] = useState<SheetState>(CLOSED);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The phase as of the last call, so close() acts once, and only on an open sheet
  const phaseRef = useRef<Phase>('closed');
  const onClosedRef = useRef(onClosed);
  useEffect(() => {
    onClosedRef.current = onClosed;
  }, [onClosed]);

  const cancelExit = useCallback(() => {
    if (exitTimerRef.current !== null) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  // A sheet still playing its exit when the screen goes away leaves no timer behind
  useEffect(() => cancelExit, [cancelExit]);

  const openCreate = useCallback((color: string) => {
    cancelExit();
    phaseRef.current = 'open';
    setState(prev => ({ phase: 'open', mode: 'create', category: null, name: '', color, session: prev.session + 1 }));
  }, [cancelExit]);

  const openEdit = useCallback((category: Category) => {
    cancelExit();
    phaseRef.current = 'open';
    setState(prev => ({
      phase: 'open',
      mode: 'edit',
      category,
      name: category.name,
      color: category.color || DEFAULT_CATEGORY_COLOR,
      session: prev.session + 1
    }));
  }, [cancelExit]);

  const close = useCallback(() => {
    if (phaseRef.current !== 'open') {return;}
    phaseRef.current = 'closing';
    setState(prev => ({ ...prev, phase: 'closing' }));
    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null;
      phaseRef.current = 'closed';
      setState(prev => ({ ...CLOSED, session: prev.session }));
      onClosedRef.current?.();
    }, motionDuration(MOTION.categorySheetOut));
  }, []);

  const setName = useCallback((name: string) => {
    setState(prev => ({ ...prev, name }));
  }, []);

  const setColor = useCallback((color: string) => {
    setState(prev => ({ ...prev, color }));
  }, []);

  return {
    isMounted: state.phase !== 'closed',
    isOpen: state.phase === 'open',
    mode: state.mode,
    category: state.category,
    name: state.name,
    color: state.color,
    session: state.session,
    setName,
    setColor,
    openCreate,
    openEdit,
    close
  };
}
