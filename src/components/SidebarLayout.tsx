import { Link, useLocation } from 'react-router-dom';

const DEFAULT_TYPES = [
  { key: 'all', label: 'All' },
  { key: 'principle', label: 'Principles' },
  { key: 'learning', label: 'Learnings' },
  { key: 'retro', label: 'Retros' }
];

interface FilterItem {
  key: string;
  label: string;
}

interface NavItem {
  path: string;
  label: string;
}

interface SidebarLayoutProps {
  children: React.ReactNode;
  activeType?: string;
  onTypeChange?: (type: string) => void;
  filters?: FilterItem[];
  filterTitle?: string;
  linkBase?: string;
  navItems?: NavItem[];
  navTitle?: string;
}

export const TOOLS_NAV: NavItem[] = [
  { path: '/evolution', label: 'Evolution' },
  { path: '/traces', label: 'Traces' },
  { path: '/superseded', label: 'Superseded' },
  { path: '/handoff', label: 'Handoff' },
  { path: '/schedule', label: 'Schedule' },
];

export function SidebarLayout({
  children,
  activeType = 'all',
  onTypeChange,
  filters = DEFAULT_TYPES,
  linkBase = '/feed',
  navItems,
}: SidebarLayoutProps) {
  const location = useLocation();

  return (
    <div className="max-w-[900px] mx-auto px-6 py-8 max-md:px-3 max-md:py-4">
      {/* Horizontal pill bar */}
      <div className="flex items-center gap-1.5 mb-6 flex-wrap">
        {navItems && navItems.length > 0 && (
          <>
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-1.5 rounded-lg text-[13px] transition-all duration-150 ${
                  location.pathname === item.path
                    ? 'bg-bg-card text-accent font-medium'
                    : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'
                }`}
              >
                {item.label}
              </Link>
            ))}
            {filters.length > 0 && <span className="w-px h-4 bg-border mx-1" />}
          </>
        )}
        {filters.length > 0 && filters.map(t => (
          onTypeChange ? (
            <button
              key={t.key}
              type="button"
              onClick={() => onTypeChange(t.key)}
              className={`px-3 py-1.5 rounded-lg text-[13px] border-none cursor-pointer font-[inherit] transition-all duration-150 ${
                activeType === t.key
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'bg-transparent text-text-secondary hover:bg-bg-card hover:text-text-primary'
              }`}
            >
              {t.label}
            </button>
          ) : (
            <Link
              key={t.key}
              to={t.key === 'all' ? linkBase : `${linkBase}?type=${t.key}`}
              className={`px-3 py-1.5 rounded-lg text-[13px] transition-all duration-150 ${
                activeType === t.key
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'
              }`}
            >
              {t.label}
            </Link>
          )
        ))}
      </div>

      {/* Full-width content */}
      <div className="min-w-0">
        {children}
      </div>
    </div>
  );
}
