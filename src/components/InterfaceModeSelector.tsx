import { FC } from 'react';

interface InterfaceModeSelectorProps {
  value: 'popup' | 'sidepanel';
  onChange: (mode: 'popup' | 'sidepanel') => void;
  disabled?: boolean;
  loading?: boolean;
}

const InterfaceModeSelector: FC<InterfaceModeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  loading = false
}) => {
  const handleModeSelect = (mode: 'popup' | 'sidepanel') => {
    if (!disabled && !loading) {
      onChange(mode);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
          Interface Mode
        </h3>
        {loading && (
          <div className="w-3 h-3 border-2 border-purple-200 dark:border-purple-800 border-t-purple-500 dark:border-t-purple-400 rounded-full animate-spin" />
        )}
      </div>
      
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
        Choose how the extension opens when you click the toolbar icon
      </p>

      <div className="grid grid-cols-2 gap-4">
        {/* Popup Mode Card */}
        <button
          onClick={() => { handleModeSelect('popup'); }}
          disabled={disabled || loading}
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
                ? 'border-purple-500 dark:border-purple-400 bg-purple-50/50 dark:bg-purple-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }
              ${!disabled && !loading ? 'hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-lg hover:scale-[1.02]' : ''}
            `}
          >
            {/* Selection indicator */}
            {value === 'popup' && (
              <div className="absolute top-2 right-2">
                <div className="w-5 h-5 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            )}

            {/* Visual Preview */}
            <div className="mb-3 flex justify-center">
              <svg
                className="w-20 h-20"
                viewBox="0 0 80 80"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Browser window background */}
                <rect x="10" y="20" width="60" height="40" rx="2" className="fill-gray-200 dark:fill-gray-700" />
                <rect x="10" y="20" width="60" height="6" className="fill-gray-300 dark:fill-gray-600" />
                <circle cx="16" cy="23" r="1.5" className="fill-red-400" />
                <circle cx="21" cy="23" r="1.5" className="fill-yellow-400" />
                <circle cx="26" cy="23" r="1.5" className="fill-green-400" />
                
                {/* Popup window */}
                <rect x="35" y="35" width="30" height="25" rx="3" className="fill-white dark:fill-gray-800 stroke-purple-500" strokeWidth="2" />
                <rect x="35" y="35" width="30" height="6" rx="3" className="fill-gradient-to-r from-purple-600 to-indigo-600" />
                <rect x="40" y="45" width="20" height="2" rx="1" className="fill-gray-300 dark:fill-gray-600" />
                <rect x="40" y="50" width="15" height="2" rx="1" className="fill-gray-300 dark:fill-gray-600" />
                <rect x="40" y="55" width="18" height="2" rx="1" className="fill-gray-300 dark:fill-gray-600" />
                
                {/* Shadow effect */}
                <rect x="37" y="37" width="30" height="25" rx="3" className="fill-black opacity-10" transform="translate(1, 1)" />
              </svg>
            </div>

            {/* Mode Icon */}
            <div className="flex justify-center mb-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
            </div>

            {/* Text Content */}
            <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-1">
              Popup Window
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Quick access • Auto-closes • Floating
            </p>
          </div>
        </button>

        {/* Side Panel Mode Card */}
        <button
          onClick={() => { handleModeSelect('sidepanel'); }}
          disabled={disabled || loading}
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
                ? 'border-purple-500 dark:border-purple-400 bg-purple-50/50 dark:bg-purple-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }
              ${!disabled && !loading ? 'hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-lg hover:scale-[1.02]' : ''}
            `}
          >
            {/* Selection indicator */}
            {value === 'sidepanel' && (
              <div className="absolute top-2 right-2">
                <div className="w-5 h-5 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            )}

            {/* Visual Preview */}
            <div className="mb-3 flex justify-center">
              <svg
                className="w-20 h-20"
                viewBox="0 0 80 80"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Browser window */}
                <rect x="10" y="20" width="45" height="40" rx="2" className="fill-gray-200 dark:fill-gray-700" />
                <rect x="10" y="20" width="45" height="6" className="fill-gray-300 dark:fill-gray-600" />
                <circle cx="16" cy="23" r="1.5" className="fill-red-400" />
                <circle cx="21" cy="23" r="1.5" className="fill-yellow-400" />
                <circle cx="26" cy="23" r="1.5" className="fill-green-400" />
                
                {/* Side panel */}
                <rect x="55" y="20" width="15" height="40" className="fill-white dark:fill-gray-800 stroke-purple-500" strokeWidth="2" />
                <rect x="55" y="20" width="15" height="6" className="fill-gradient-to-r from-purple-600 to-indigo-600" />
                <rect x="58" y="30" width="9" height="2" rx="1" className="fill-gray-300 dark:fill-gray-600" />
                <rect x="58" y="35" width="7" height="2" rx="1" className="fill-gray-300 dark:fill-gray-600" />
                <rect x="58" y="40" width="8" height="2" rx="1" className="fill-gray-300 dark:fill-gray-600" />
                <rect x="58" y="45" width="9" height="2" rx="1" className="fill-gray-300 dark:fill-gray-600" />
                <rect x="58" y="50" width="6" height="2" rx="1" className="fill-gray-300 dark:fill-gray-600" />
                <rect x="58" y="55" width="8" height="2" rx="1" className="fill-gray-300 dark:fill-gray-600" />
              </svg>
            </div>

            {/* Mode Icon */}
            <div className="flex justify-center mb-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10l-3-3m3 3l3-3m5 3V7m0 10l-3-3m3 3l3-3" />
                </svg>
              </div>
            </div>

            {/* Text Content */}
            <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-1">
              Side Panel
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Always visible • Multitasking • Docked
            </p>
          </div>
        </button>
      </div>

      {/* Additional Information */}
      <div className="mt-4">
        <button
          type="button"
          className="group relative inline-flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300"
          aria-describedby="interface-mode-tooltip"
        >
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </span>
          <span>Mode tips</span>
          <span
            id="interface-mode-tooltip"
            role="tooltip"
            className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-72 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 px-3 py-2 text-left text-xs text-blue-700 dark:text-blue-200 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            {value === 'popup'
              ? 'Popup mode opens a floating window that closes when you click outside. Perfect for quick actions.'
              : 'Side panel mode keeps the extension open alongside your browsing. Great for multitasking and reference.'}
          </span>
        </button>
      </div>
    </div>
  );
};

export default InterfaceModeSelector;
