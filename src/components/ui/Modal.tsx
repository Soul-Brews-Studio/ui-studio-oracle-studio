import type { ReactNode, MouseEvent } from 'react';
import { useEffect } from 'react';

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
  className?: string;
}

export function Modal({ onClose, children, maxWidth = '640px', className = '' }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-black/85 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
      onClick={handleOverlayClick}
    >
      <div
        className={`bg-bg-card border border-border rounded-xl shadow-2xl w-full overflow-hidden flex flex-col animate-[slideUp_0.2s_ease-out] ${className}`}
        style={{ maxWidth, maxHeight: '72vh' }}
      >
        {children}
      </div>
    </div>
  );
}
