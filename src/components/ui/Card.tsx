import type { ReactNode, MouseEvent } from 'react';
import { getTypeColor } from '../../lib/type-colors';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent) => void;
  type?: string;
  hover?: boolean;
}

export function Card({ children, className = '', onClick, type, hover = true }: CardProps) {
  const typeStyle = type ? { borderColor: `${getTypeColor(type)}40` } : undefined;
  const hoverTypeStyle = type ? `hover:!border-[${getTypeColor(type)}]` : '';

  return (
    <div
      className={`bg-bg-card border border-border rounded-xl p-3 transition-all duration-150 ${hover ? 'hover:border-border-hover' : ''} ${onClick ? 'cursor-pointer' : ''} ${hoverTypeStyle} ${className}`}
      style={typeStyle}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
