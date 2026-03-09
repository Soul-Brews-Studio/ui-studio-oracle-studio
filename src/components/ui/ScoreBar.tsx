interface ScoreBarProps {
  score: number; // 0-100
  className?: string;
}

export function ScoreBar({ score, className = '' }: ScoreBarProps) {
  return (
    <div className={`h-[3px] rounded-sm bg-white/5 mt-1.5 ${className}`}>
      <div className="h-full rounded-sm bg-accent" style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
    </div>
  );
}
