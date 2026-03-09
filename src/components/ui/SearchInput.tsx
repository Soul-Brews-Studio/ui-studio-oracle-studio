import { forwardRef } from 'react';
import { Spinner } from './Spinner';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onSubmit?: () => void;
  placeholder?: string;
  loading?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ value, onChange, onKeyDown, onSubmit, placeholder = 'Search...', loading, autoFocus, className = '' }, ref) {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && onSubmit) {
        e.preventDefault();
        onSubmit();
      }
      onKeyDown?.(e);
    };

    return (
      <div className={`flex items-center gap-2.5 px-4 py-3.5 border-b border-border-subtle ${className}`}>
        <svg className="text-accent shrink-0" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx={11} cy={11} r={8} />
          <line x1={21} y1={21} x2={16.65} y2={16.65} />
        </svg>
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent border-none text-text-primary text-[15px] outline-none caret-accent placeholder:text-white/25 [&::-webkit-search-cancel-button]:hidden [&::-webkit-clear-button]:hidden [&::-ms-clear]:hidden"
          style={{ WebkitAppearance: 'none' }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          spellCheck={false}
          autoComplete="off"
          inputMode="text"
          enterKeyHint="send"
        />
        {loading && <Spinner />}
      </div>
    );
  }
);
