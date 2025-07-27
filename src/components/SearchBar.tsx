import { SearchBarProps } from '../types/components';

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onClear,
  placeholder = 'Search...'
}) => {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
        <svg
          className="h-5 w-5 text-purple-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); }}
        placeholder={placeholder}
        className="w-full pl-12 pr-12 py-3 bg-white/60 backdrop-blur-sm border border-purple-200 rounded-xl focus:outline-none focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 text-sm placeholder-gray-500 shadow-sm hover:bg-white/80 transition-all duration-200"
      />
      
      {value && (
        <button
          onClick={onClear as () => void}
          className="absolute inset-y-0 right-0 pr-4 flex items-center hover:text-purple-600 transition-colors"
        >
          <svg
            className="h-4 w-4 text-gray-400 hover:text-purple-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

export default SearchBar;