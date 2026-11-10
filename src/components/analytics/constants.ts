/**
 * Analytics component constants
 * Centralizes magic numbers for chart dimensions, intervals, and display limits
 */

/** Refresh interval for time-based updates (60 seconds) */
export const REFRESH_INTERVAL_MS = 60_000;

/** Height of the Daily use and Time of day charts, in pixels */
export const CHART_HEIGHT = 180;

/** Rows of the Most used card in the Analytics tab, as in the Atelier 1C design */
export const MOST_USED_ROWS = 3;

/** Rows of the Most used card in the full-page Analytics view */
export const MOST_USED_ROWS_FULL = 10;

/** Rows of the Platforms and Categories cards in the full-page Analytics view */
export const RANKED_ROWS = 6;

/**
 * The chart events recharts may defer to the next animation frame: none. Recharts 3 defers mouse moves and does not
 * cancel the pending frame on mouseleave, so a leave in the frame of the last move leaves the Tooltip stuck open
 * (recharts#7876). Remove once a stable recharts includes the fix, recharts PR #7884 (My-Prompt-Manager-0vj).
 */
export const NO_THROTTLED_EVENTS: ReadonlyArray<keyof GlobalEventHandlersEventMap> = [];
