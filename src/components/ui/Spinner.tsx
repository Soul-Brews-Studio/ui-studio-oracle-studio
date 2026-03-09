interface SpinnerProps {
  size?: 'sm' | 'md';
  className?: string;
}

export function Spinner({ size = 'sm', className = '' }: SpinnerProps) {
  const sizeClass = size === 'sm' ? 'w-4 h-4 border-2' : 'w-6 h-6 border-2';
  return (
    <div className={`${sizeClass} border-border rounded-full border-t-accent animate-spin ${className}`} />
  );
}
