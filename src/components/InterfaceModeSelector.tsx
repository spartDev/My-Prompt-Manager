import type { FC, KeyboardEvent, ReactNode } from 'react';
import { useId, useRef } from 'react';

interface InterfaceModeSelectorProps {
  value: 'popup' | 'sidepanel';
  onChange: (mode: 'popup' | 'sidepanel') => void;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * Selection indicator badge - displayed when a mode is selected.
 * Hoisted to module scope per Vercel rendering-hoist-jsx best practice.
 */
const SelectionIndicator: FC<{ selected: boolean }> = ({ selected }) =>
  selected ? (
    <div className="absolute top-2 right-2">
      <div className="w-5 h-5 bg-accent text-on-accent rounded-full flex items-center justify-center">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </div>
    </div>
  ) : null;

/**
 * Static SVG preview for popup window mode.
 * Hoisted to module scope to avoid recreation on each render.
 */
const POPUP_PREVIEW_SVG: ReactNode = (
  <svg
    className="w-20 h-20"
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Browser window background */}
    <rect x="10" y="20" width="60" height="40" rx="2" className="fill-(--border-color-default)" />
    <rect x="10" y="20" width="60" height="6" className="fill-(--border-color-strong)" />
    <circle cx="16" cy="23" r="1.5" className="fill-(--border-color-input)" />
    <circle cx="21" cy="23" r="1.5" className="fill-(--border-color-input)" />
    <circle cx="26" cy="23" r="1.5" className="fill-(--border-color-input)" />

    {/* Popup window */}
    <rect x="35" y="35" width="30" height="25" rx="3" className="fill-(--background-color-card) stroke-(--background-color-accent)" strokeWidth="2" />
    <rect x="35" y="35" width="30" height="6" rx="3" className="fill-(--background-color-accent)" />
    <rect x="40" y="45" width="20" height="2" rx="1" className="fill-(--border-color-strong)" />
    <rect x="40" y="50" width="15" height="2" rx="1" className="fill-(--border-color-strong)" />
    <rect x="40" y="55" width="18" height="2" rx="1" className="fill-(--border-color-strong)" />
  </svg>
);

/**
 * Static SVG preview for side panel mode.
 * Hoisted to module scope to avoid recreation on each render.
 */
const SIDE_PANEL_PREVIEW_SVG: ReactNode = (
  <svg
    className="w-20 h-20"
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Browser window */}
    <rect x="10" y="20" width="45" height="40" rx="2" className="fill-(--border-color-default)" />
    <rect x="10" y="20" width="45" height="6" className="fill-(--border-color-strong)" />
    <circle cx="16" cy="23" r="1.5" className="fill-(--border-color-input)" />
    <circle cx="21" cy="23" r="1.5" className="fill-(--border-color-input)" />
    <circle cx="26" cy="23" r="1.5" className="fill-(--border-color-input)" />

    {/* Side panel */}
    <rect x="55" y="20" width="15" height="40" className="fill-(--background-color-card) stroke-(--background-color-accent)" strokeWidth="2" />
    <rect x="55" y="20" width="15" height="6" className="fill-(--background-color-accent)" />
    <rect x="58" y="30" width="9" height="2" rx="1" className="fill-(--border-color-strong)" />
    <rect x="58" y="35" width="7" height="2" rx="1" className="fill-(--border-color-strong)" />
    <rect x="58" y="40" width="8" height="2" rx="1" className="fill-(--border-color-strong)" />
    <rect x="58" y="45" width="9" height="2" rx="1" className="fill-(--border-color-strong)" />
    <rect x="58" y="50" width="6" height="2" rx="1" className="fill-(--border-color-strong)" />
    <rect x="58" y="55" width="8" height="2" rx="1" className="fill-(--border-color-strong)" />
  </svg>
);

const MODES = ['popup', 'sidepanel'] as const;

const InterfaceModeSelector: FC<InterfaceModeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  loading = false
}) => {
  const labelId = useId();
  const modeRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const locked = disabled || loading;

  const handleModeSelect = (mode: 'popup' | 'sidepanel') => {
    if (!locked) {
      onChange(mode);
    }
  };

  // WAI-ARIA radio group: the arrows, Home and End move the focus and the selection
  const handleModeKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { nextIndex = (index + 1) % MODES.length; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { nextIndex = (index - 1 + MODES.length) % MODES.length; }
    if (e.key === 'Home') { nextIndex = 0; }
    if (e.key === 'End') { nextIndex = MODES.length - 1; }
    if (nextIndex === null) { return; }

    e.preventDefault();
    if (locked) { return; }
    modeRefs.current[nextIndex]?.focus();
    handleModeSelect(MODES[nextIndex]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <h3 id={labelId} className="font-medium text-primary text-sm">
          Interface Mode
        </h3>
        {loading && (
          <div className="w-3 h-3 text-accent border-2 border-current/30 border-t-current rounded-full animate-spin" />
        )}
      </div>
      
      <p className="text-xs text-secondary mb-4">
        Choose how the extension opens when you click the toolbar icon
      </p>

      <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-2 gap-4">
        {/* Popup Mode Card */}
        <button
          ref={(el) => { modeRefs.current[0] = el; }}
          onClick={() => { handleModeSelect('popup'); }}
          onKeyDown={(e) => { handleModeKeyDown(e, 0); }}
          aria-disabled={locked}
          tabIndex={value === 'popup' ? 0 : -1}
          className={`
            relative group cursor-pointer transition-all duration-200
            ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          role="radio"
          aria-checked={value === 'popup'}
          aria-label="Select popup window mode"
        >
          <div
            className={`
              relative overflow-hidden rounded-xl p-4 border-2 transition-all duration-200
              ${value === 'popup'
                ? 'border-accent bg-accent-selected'
                : 'border-default bg-card'
              }
              ${!disabled && !loading ? 'hover:border-accent hover:shadow-lg hover:scale-[1.02]' : ''}
            `}
          >
            <SelectionIndicator selected={value === 'popup'} />

            {/* Visual Preview */}
            <div className="mb-3 flex justify-center">
              {POPUP_PREVIEW_SVG}
            </div>

            {/* Mode Icon */}
            <div className="flex justify-center mb-2">
              <div className="w-8 h-8 bg-accent-subtle text-accent rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
            </div>

            {/* Text Content */}
            <h4 className="font-semibold text-sm text-primary mb-1">
              Popup Window
            </h4>
            <p className="text-xs text-secondary leading-relaxed">
              Quick access • Auto-closes • Floating
            </p>
          </div>
        </button>

        {/* Side Panel Mode Card */}
        <button
          ref={(el) => { modeRefs.current[1] = el; }}
          onClick={() => { handleModeSelect('sidepanel'); }}
          onKeyDown={(e) => { handleModeKeyDown(e, 1); }}
          aria-disabled={locked}
          tabIndex={value === 'sidepanel' ? 0 : -1}
          className={`
            relative group cursor-pointer transition-all duration-200
            ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          role="radio"
          aria-checked={value === 'sidepanel'}
          aria-label="Select side panel mode"
        >
          <div
            className={`
              relative overflow-hidden rounded-xl p-4 border-2 transition-all duration-200
              ${value === 'sidepanel'
                ? 'border-accent bg-accent-selected'
                : 'border-default bg-card'
              }
              ${!disabled && !loading ? 'hover:border-accent hover:shadow-lg hover:scale-[1.02]' : ''}
            `}
          >
            <SelectionIndicator selected={value === 'sidepanel'} />

            {/* Visual Preview */}
            <div className="mb-3 flex justify-center">
              {SIDE_PANEL_PREVIEW_SVG}
            </div>

            {/* Mode Icon */}
            <div className="flex justify-center mb-2">
              <div className="w-8 h-8 bg-accent-subtle text-accent rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10l-3-3m3 3l3-3m5 3V7m0 10l-3-3m3 3l3-3" />
                </svg>
              </div>
            </div>

            {/* Text Content */}
            <h4 className="font-semibold text-sm text-primary mb-1">
              Side Panel
            </h4>
            <p className="text-xs text-secondary leading-relaxed">
              Always visible • Multitasking • Docked
            </p>
          </div>
        </button>
      </div>

      {/* Additional Information */}
      <div className="mt-4 p-3 bg-accent-subtle border border-accent rounded-lg">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-accent mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <p className="text-xs text-accent-strong">
            {value === 'popup' 
              ? 'Popup mode opens a floating window that closes when you click outside. Perfect for quick actions.'
              : 'Side panel mode keeps the extension open alongside your browsing. Great for multitasking and reference.'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default InterfaceModeSelector;