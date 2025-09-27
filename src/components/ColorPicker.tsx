import { useState, useRef, useEffect } from 'react';
import type { FC } from 'react';

import { 
  PRESET_COLORS, 
  isValidHexColor, 
  getColorName
} from '../constants/colors';
interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

const ColorPicker: FC<ColorPickerProps> = ({ 
  value, 
  onChange, 
  label = 'Color',
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customColor, setCustomColor] = useState(value);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => { document.removeEventListener('mousedown', handleClickOutside); };
    }
  }, [isOpen]);

  const handleColorSelect = (color: string) => {
    onChange(color);
    setCustomColor(color);
    setIsOpen(false);
    setShowCustomInput(false);
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setCustomColor(color);
    if (isValidHexColor(color)) {
      onChange(color);
    }
  };

  const handleCustomColorSubmit = () => {
    if (isValidHexColor(customColor)) {
      onChange(customColor);
      setIsOpen(false);
      setShowCustomInput(false);
    }
  };

  const currentColorName = getColorName(value);
  const isPresetColor = PRESET_COLORS.some(c => c.value.toLowerCase() === value.toLowerCase());

  return (
    <div className={`relative ${className}`}>
      <div className="flex flex-col space-y-2">
        {label && (
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        
        {/* Color Display Button */}
        <button
          ref={buttonRef}
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
          }}
          disabled={disabled}
          className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-gray-700 border border-purple-200 dark:border-gray-600 rounded-lg hover:border-purple-400 dark:hover:border-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-fit"
        >
          <div 
            className="w-6 h-6 rounded-md border-2 border-white dark:border-gray-800 shadow-sm"
            style={{ backgroundColor: value }}
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {currentColorName}
          </span>
          <svg 
            className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {isOpen && (
        <div 
          ref={dropdownRef}
          className="absolute mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-purple-100 dark:border-gray-700 p-4"
          style={{ zIndex: 10000 }}
        >
          {/* Preset Colors Grid */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
              Preset Colors
            </h4>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => { handleColorSelect(color.value); }}
                  className={`
                    w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 hover:shadow-md
                    ${value === color.value 
                      ? 'border-purple-500 dark:border-purple-400 ring-2 ring-purple-500/30' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600'
                    }
                  `}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                >
                  {value === color.value && (
                    <svg 
                      className="w-5 h-5 mx-auto" 
                      fill="none" 
                      stroke={color.textColor || '#FFFFFF'}
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={3} 
                        d="M5 13l4 4L19 7" 
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-700 my-4" />

          {/* Custom Color Section */}
          <div>
            <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
              Custom Color
            </h4>
            
            {!showCustomInput ? (
              <div className="flex items-center space-x-3">
                {/* Native Color Input (Hidden but functional) */}
                <label 
                  htmlFor="custom-color-input"
                  className="flex items-center space-x-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 cursor-pointer transition-colors"
                >
                  <svg 
                    className="w-5 h-5" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" 
                    />
                  </svg>
                  <span className="text-sm font-medium">Pick Custom Color</span>
                </label>
                <input
                  id="custom-color-input"
                  type="color"
                  value={customColor}
                  onChange={handleCustomColorChange}
                  className="sr-only"
                />

                {/* Manual Hex Input Option */}
                <button
                  type="button"
                  onClick={() => { setShowCustomInput(true); }}
                  className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                >
                  Enter Hex Code
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={customColor}
                  onChange={(e) => { setCustomColor(e.target.value.toUpperCase()); }}
                  placeholder="#000000"
                  className="flex-1 px-3 py-2 text-sm border border-purple-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono"
                  maxLength={7}
                />
                <button
                  type="button"
                  onClick={handleCustomColorSubmit}
                  disabled={!isValidHexColor(customColor)}
                  className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomInput(false);
                    setCustomColor(value);
                  }}
                  className="px-3 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Custom Color Preview */}
            {!isPresetColor && (
              <div className="mt-3 flex items-center space-x-3">
                <div 
                  className="w-full h-10 rounded-lg border-2 border-gray-200 dark:border-gray-700"
                  style={{ backgroundColor: value }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorPicker;