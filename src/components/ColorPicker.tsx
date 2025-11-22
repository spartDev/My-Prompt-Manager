import { useState, useId, useEffect } from 'react';
import type { FC } from 'react';

import {
  PRESET_COLORS,
  isValidHexColor,
  getColorName
} from '../constants/colors';
import { MAX_HEX_COLOR_LENGTH } from '../constants/validation';

import { Dropdown, useDropdown, DropdownSeparator } from './Dropdown';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  compact?: boolean;  // Show only color swatch, no text
}

// Inner component to access dropdown context
const ColorPickerContent: FC<{
  value: string;
  onChange: (color: string) => void;
  customColor: string;
  setCustomColor: (color: string) => void;
  hexInputValue: string;
  setHexInputValue: (value: string) => void;
  showCustomInput: boolean;
  setShowCustomInput: (show: boolean) => void;
  colorInputId: string;
}> = ({
  value,
  onChange,
  customColor,
  setCustomColor,
  hexInputValue,
  setHexInputValue,
  showCustomInput,
  setShowCustomInput,
  colorInputId
}) => {
  const { close } = useDropdown();

  const handleColorSelect = (color: string) => {
    onChange(color);
    setCustomColor(color);
    setShowCustomInput(false);
    close(); // Close dropdown after selecting
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    // Only update customColor if it's valid hex color for the color picker
    if (isValidHexColor(color)) {
      setCustomColor(color);
      onChange(color);
      // Don't close dropdown immediately - let user continue picking colors
    }
  };

  const handleHexInputChange = (value: string) => {
    setHexInputValue(value);
  };

  const handleCustomColorSubmit = () => {
    // Validate and apply the custom hex color
    if (isValidHexColor(hexInputValue)) {
      setCustomColor(hexInputValue);
      onChange(hexInputValue);
      setShowCustomInput(false);
      close(); // Close dropdown after submitting custom color
    }
  };

  return (
    <div className="p-4">
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
              aria-current={value === color.value ? 'true' : undefined}
            >
              {value === color.value && (
                <svg
                  className="w-5 h-5 mx-auto"
                  fill="none"
                  stroke={color.textColor || '#FFFFFF'}
                  viewBox="0 0 24 24"
                  role="img"
                  aria-label="Selected"
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
      <DropdownSeparator className="my-4" />

      {/* Custom Color Section */}
      <div>
        <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
          Custom Color
        </h4>

        {!showCustomInput ? (
          <div className="space-y-3">
            {/* Button and Color Preview Side by Side */}
            <div className="flex items-center space-x-3">
              {/* Native Color Input (Hidden but functional) */}
              {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
              <label
                htmlFor={colorInputId}
                onClick={(e) => { e.stopPropagation(); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    document.getElementById(colorInputId)?.click();
                  }
                }}
                className="flex items-center space-x-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 cursor-pointer transition-colors"
                tabIndex={0}  // eslint-disable-line jsx-a11y/no-noninteractive-tabindex
                aria-label="Pick custom color"
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
                id={colorInputId}
                type="color"
                value={customColor}
                onChange={handleCustomColorChange}
                onClick={(e) => { e.stopPropagation(); }}
                className="sr-only"
              />

              {/* Color Preview showing current custom selection */}
              <div className="flex items-center space-x-2">
                <div
                  className="w-10 h-10 rounded-lg border-2 border-gray-200 dark:border-gray-700 flex-shrink-0"
                  style={{ backgroundColor: customColor }}
                  title={customColor !== value ? "New selection" : "Current color"}
                />
                {/* Apply button appears when custom color differs from current value */}
                {customColor !== value && (
                  <button
                    type="button"
                    onClick={() => {
                      handleColorSelect(customColor);
                    }}
                    className="px-2 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors"
                    title="Apply this color"
                  >
                    Apply
                  </button>
                )}
              </div>
            </div>

            {/* Manual Hex Input Option - Full Width */}
            <button
              type="button"
              onClick={() => {
                setShowCustomInput(true);
                setHexInputValue(value);
              }}
              className="w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors border border-gray-200 dark:border-gray-600 rounded-lg hover:border-purple-300 dark:hover:border-purple-500"
            >
              Enter Hex Code
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Button and Color Preview Side by Side */}
            <div className="flex items-center space-x-3">
              {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
              <label
                htmlFor={colorInputId}
                onClick={(e) => { e.stopPropagation(); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    document.getElementById(colorInputId)?.click();
                  }
                }}
                className="flex items-center space-x-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 cursor-pointer transition-colors"
                tabIndex={0}  // eslint-disable-line jsx-a11y/no-noninteractive-tabindex
                aria-label="Pick custom color"
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
                id={colorInputId}
                type="color"
                value={customColor}
                onChange={handleCustomColorChange}
                onClick={(e) => { e.stopPropagation(); }}
                className="sr-only"
              />

              {/* Color Preview */}
              <div
                className="w-10 h-10 rounded-lg border-2 border-gray-200 dark:border-gray-700 flex-shrink-0"
                style={{ backgroundColor: value }}
              />
            </div>

            {/* Hex Input - Compact with icons */}
            <div className="flex items-center gap-2 w-full">
              <input
                type="text"
                value={hexInputValue}
                onChange={(e) => {
                  handleHexInputChange(e.target.value.toUpperCase());
                }}
                placeholder="#000000"
                className="flex-1 min-w-0 px-3 py-2 text-sm border border-purple-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono"
                maxLength={MAX_HEX_COLOR_LENGTH}
              />
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleCustomColorSubmit}
                  disabled={!isValidHexColor(hexInputValue)}
                  className="p-2 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Apply"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomInput(false);
                    setCustomColor(value);
                    setHexInputValue(value);
                  }}
                  className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  title="Cancel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ColorPicker: FC<ColorPickerProps> = ({
  value,
  onChange,
  label = 'Color',
  disabled = false,
  className = '',
  compact = false
}) => {
  const [customColor, setCustomColor] = useState(value);
  const [hexInputValue, setHexInputValue] = useState(value);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const colorInputId = useId();

  // FIX: Sync internal states when value prop changes externally
  // This prevents stale state when parent updates the value (e.g., undo/redo, storage sync)
  // Without this, the "Apply" button may appear incorrectly with stale customColor
  useEffect(() => {
    setCustomColor(value);
    setHexInputValue(value);
  }, [value]);

  const currentColorName = getColorName(value);

  return (
    <div className={`relative ${className}`}>
      <div className="flex flex-col space-y-2">
        {label && (
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}

        {/* Color Picker Dropdown */}
        <Dropdown
          open={isOpen}
          onOpenChange={setIsOpen}
          closeOnSelect={false} // We handle closing manually in ColorPickerContent
          trigger={
            <button
              type="button"
              disabled={disabled}
              className={`flex items-center ${compact ? 'p-1' : 'px-3 py-2 space-x-2'} bg-white dark:bg-gray-700 border border-purple-200 dark:border-gray-600 rounded-lg hover:border-purple-400 dark:hover:border-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-fit`}
              title={compact ? currentColorName : undefined}
            >
              <div
                className={`${compact ? 'w-8 h-8' : 'w-6 h-6'} rounded-md border-2 border-white dark:border-gray-800 shadow-sm`}
                style={{ backgroundColor: value }}
              />
              {!compact && (
                <>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {currentColorName}
                  </span>
                  <svg
                    className="w-4 h-4 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>
          }
          className="w-72"
        >
          <ColorPickerContent
            value={value}
            onChange={onChange}
            customColor={customColor}
            setCustomColor={setCustomColor}
            hexInputValue={hexInputValue}
            setHexInputValue={setHexInputValue}
            showCustomInput={showCustomInput}
            setShowCustomInput={setShowCustomInput}
            colorInputId={colorInputId}
          />
        </Dropdown>
      </div>
    </div>
  );
};

export default ColorPicker;