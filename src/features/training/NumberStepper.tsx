import { Minus, Plus } from 'lucide-react';
import { KeypadField } from '../../components/Keypad';

/**
 * Wert mit − / + und direkter Eingabe: Zahl antippen öffnet das eigene Ziffernfeld,
 * der alte Wert steht grau da und wird beim Tippen ersetzt.
 */
export function NumberStepper({
  label,
  hint,
  value,
  onChange,
  onIncrement,
  onDecrement,
  decimal = false,
  placeholder = '–',
}: {
  label: string;
  hint?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  decimal?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center">
      <span className="display text-[13px] text-ink-2">{label}</span>
      <div className="mt-1.5 flex h-12 w-full items-center rounded-2xl border border-line bg-white/[0.04] transition has-[[data-active]]:border-accent/60 has-[[data-active]]:bg-accent/10">
        <StepButton label={`${label} verringern`} onClick={onDecrement}>
          <Minus size={16} strokeWidth={2.75} />
        </StepButton>
        <KeypadField label={label} value={value} onChange={onChange} decimal={decimal} placeholder={placeholder} className="h-full min-w-0 flex-1 text-[19px] font-bold" />
        <StepButton label={`${label} erhöhen`} onClick={onIncrement}>
          <Plus size={16} strokeWidth={2.75} />
        </StepButton>
      </div>
      {hint && <span className="mt-1 text-[11px] text-ink-3">{hint}</span>}
    </div>
  );
}

function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-full w-7 shrink-0 items-center justify-center rounded-2xl text-ink-2 transition hover:text-ink active:scale-90 active:bg-glass-3"
    >
      {children}
    </button>
  );
}
