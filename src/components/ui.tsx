import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 rounded-2xl px-4 font-semibold transition active:scale-[0.98] disabled:opacity-40',
        variant === 'primary' && 'accent-gradient h-13 text-[15px] text-on-accent shadow-[var(--shadow-glow)]',
        variant === 'secondary' && 'h-11 border border-line bg-glass-2 text-[14px] text-ink hover:bg-glass-3',
        variant === 'ghost' && 'h-10 text-[14px] text-ink-2 hover:text-ink',
        variant === 'danger' && 'h-11 border border-danger/30 bg-danger/10 text-[14px] text-danger',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cx(
        'inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-2 transition hover:bg-glass-2 hover:text-ink active:scale-95',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('glass rounded-[var(--radius-card)]', className)}>{children}</div>;
}

/** Kreisförmiger Fortschritt, z. B. 2/3 Sätze. */
export function ProgressRing({
  value,
  max,
  size = 46,
  stroke = 4,
  children,
  complete,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  complete?: boolean;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = max > 0 ? Math.min(1, value / max) : 0;
  const id = `ring-${size}-${stroke}`;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffa30a" />
            <stop offset="50%" stopColor="#fe8c35" />
            <stop offset="100%" stopColor="#ff743e" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(255 255 255 / 0.09)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={complete ? 'var(--color-success)' : `url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 400ms cubic-bezier(0.2,0.8,0.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

/** Bottom Sheet für Dialoge – auf dem iPhone mit dem Daumen gut erreichbar. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  // Portal: Sheets liegen immer über Navigation und Inhalt
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Schließen" className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-strong animate-sheet-up safe-bottom relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-[2rem] sm:rounded-[2rem]">
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="display text-[22px]">{title}</h2>
          <IconButton label="Schließen" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        <div className="no-scrollbar overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-line px-5 pb-2 pt-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cx('flex rounded-2xl border border-line bg-glass p-1', className)} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
          className={cx(
            'h-9 flex-1 rounded-xl px-3 text-[13px] font-semibold transition',
            option.value === value ? 'bg-glass-3 text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-glass-2 text-accent-2">{icon}</div>
      <p className="text-[16px] font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-[14px] text-ink-3">{text}</p>
    </div>
  );
}

export function ScreenHeader({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <header className="safe-top flex items-end justify-between gap-3 px-5 pb-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="display truncate text-[34px] leading-[1.05]">{title}</h1>
      </div>
      {right}
    </header>
  );
}
