import { TYPE_COLORS } from '../../lib/type-colors';

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  onClear: () => void;
  searching?: boolean;
  matchCount: number;
  visibleTypes: Set<string>;
  onToggleType: (type: string) => void;
}

const OVERLAY_BG = 'rgba(10, 10, 20, 0.7)';

export function PlanetsHUD({
  query,
  onQueryChange,
  onClear,
  searching = false,
  matchCount,
  visibleTypes,
  onToggleType,
}: Props) {
  return (
    <>
      <form
        onSubmit={(e) => e.preventDefault()}
        className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 z-10 items-center"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search to highlight planets..."
          className="w-[320px] px-4 py-2.5 rounded-[10px] text-sm text-text-primary border border-white/[0.08] outline-none backdrop-blur-xl transition-colors duration-200 focus:border-accent placeholder:text-text-muted [&::-webkit-search-cancel-button]:hidden [&::-webkit-clear-button]:hidden [&::-ms-clear]:hidden"
          style={{ background: OVERLAY_BG, WebkitAppearance: 'none' }}
        />
        {query && (
          <button
            type="button"
            onClick={onClear}
            className="px-3.5 py-2 rounded-[10px] text-xs text-text-secondary cursor-pointer border border-white/[0.08] backdrop-blur-xl transition-all duration-200 hover:border-accent hover:text-accent"
            style={{ background: OVERLAY_BG }}
          >
            Clear
          </button>
        )}
        {searching && (
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        )}
        {query && matchCount > 0 && (
          <span
            className="text-[11px] font-mono text-text-muted px-2 py-1 rounded-md backdrop-blur-xl border border-white/[0.08]"
            style={{ background: OVERLAY_BG }}
          >
            {matchCount} match{matchCount === 1 ? '' : 'es'}
          </span>
        )}
      </form>

      <div
        className="absolute bottom-4 left-4 flex gap-1 rounded-[10px] px-2 py-1.5 text-[11px] text-text-secondary backdrop-blur-xl border border-white/[0.08] z-10"
        style={{ background: OVERLAY_BG }}
      >
        {Object.entries(TYPE_COLORS).map(([type, color]) => {
          const active = visibleTypes.has(type);
          return (
            <button
              key={type}
              onClick={() => onToggleType(type)}
              className={`flex items-center gap-[5px] px-2 py-1 rounded-md cursor-pointer border-none transition-all duration-150 ${active ? 'opacity-100' : 'opacity-30'}`}
              style={{ background: active ? `${color}15` : 'transparent' }}
            >
              <span
                className="w-[7px] h-[7px] rounded-full"
                style={{ background: color }}
              />
              {type}
            </button>
          );
        })}
      </div>
    </>
  );
}
