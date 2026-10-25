import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { Check, Delete } from 'lucide-react';
import { formatNumber, parseDecimal, parseInteger } from '../domain/format';
import { cx } from './ui';

/**
 * Eigenes Ziffernfeld statt der iOS-Tastatur: Zahlenfelder sind Buttons, ein Tipp öffnet
 * unten das Ziffernfeld im App-Stil. Die Eingabe startet leer (alter Wert grau),
 * Tippen ersetzt den Wert.
 */

interface KeypadRequest {
  id: string;
  label?: string;
  decimal: boolean;
  allowEmpty: boolean;
  /** bisheriger Wert als Text – grau, solange noch nichts getippt ist */
  current: string;
  anchor: HTMLElement;
  onInput: (text: string) => void;
  onClear: () => void;
  onClose: (text: string) => void;
}

interface KeypadState {
  request: KeypadRequest | null;
  text: string;
  /** Wert bewusst geleert */
  cleared: boolean;
  open: (request: KeypadRequest) => void;
  close: () => void;
  press: (key: string) => void;
}

const MAX_DIGITS = 6;

export const useKeypad = create<KeypadState>((set, get) => ({
  request: null,
  text: '',
  cleared: false,
  open: (request) => {
    get().close();
    set({ request, text: '', cleared: false });
  },
  close: () => {
    const { request, text } = get();
    if (!request) return;
    set({ request: null, text: '', cleared: false });
    request.onClose(text);
  },
  press: (key) => {
    const { request, text } = get();
    if (!request) return;
    if (key === 'clear') {
      if (!request.allowEmpty) return;
      set({ text: '', cleared: true });
      request.onClear();
      return;
    }
    let next: string;
    if (key === 'back') next = text.slice(0, -1);
    else if (key === ',') {
      if (!request.decimal || text.includes(',')) return;
      next = `${text || '0'},`;
    } else {
      next = text === '0' ? key : text + key;
      if (next.replace(',', '').length > MAX_DIGITS) return;
      if (next.includes(',') && next.split(',')[1].length > 2) return;
    }
    set({ text: next, cleared: false });
    request.onInput(next);
  },
}));

/** Nächster scrollbarer Container (z. B. in einem Sheet), sonst das Fenster. */
function scrollParent(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
}

/** Das Ziffernfeld selbst – einmal in der App eingebunden. */
export function Keypad() {
  const request = useKeypad((state) => state.request);
  const text = useKeypad((state) => state.text);
  const cleared = useKeypad((state) => state.cleared);
  const press = useKeypad((state) => state.press);
  const close = useKeypad((state) => state.close);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!request) return;
    // Tipp außerhalb schließt (Scrollen nicht – das löst keinen Klick aus)
    const onClick = (event: MouseEvent) => {
      if (panel.current && !panel.current.contains(event.target as Node)) close();
    };
    // Mit Hardware-Tastatur (Mac) geht es weiter wie gewohnt
    const onKey = (event: KeyboardEvent) => {
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === ',' || event.key === '.') press(',');
      else if (event.key === 'Backspace') press('back');
      else if (event.key === 'Enter' || event.key === 'Escape' || event.key === 'Tab') close();
      else return;
      event.preventDefault();
    };
    document.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [request, press, close]);

  // Platz unter dem Inhalt schaffen und das Feld über dem Ziffernfeld halten
  useLayoutEffect(() => {
    if (!request || !panel.current) return;
    const height = panel.current.offsetHeight;
    document.documentElement.style.setProperty('--keypad-space', `${height}px`);
    const rect = request.anchor.getBoundingClientRect();
    const limit = window.innerHeight - height - 16;
    if (rect.bottom > limit) {
      const delta = rect.bottom - limit;
      const scroller = scrollParent(request.anchor);
      (scroller ?? window).scrollBy({ top: delta, behavior: 'smooth' });
    }
    return () => {
      document.documentElement.style.removeProperty('--keypad-space');
    };
  }, [request]);

  if (!request) return null;

  const left = request.decimal ? ',' : request.allowEmpty ? 'clear' : null;
  const shown = text || (cleared ? '' : request.current);

  return createPortal(
    <div
      ref={panel}
      role="group"
      aria-label={request.label ? `Ziffernfeld: ${request.label}` : 'Ziffernfeld'}
      className="glass-strong animate-sheet-up safe-bottom fixed inset-x-0 bottom-0 z-[60] mx-auto max-w-xl rounded-t-[1.75rem] border-b-0 px-3 pt-3 shadow-[0_-16px_40px_-16px_rgb(0_0_0_/_0.9)]"
    >
      <div className="flex items-baseline justify-between gap-3 px-2 pb-2.5">
        <span className="eyebrow truncate">{request.label ?? 'Eingabe'}</span>
        <span className={cx('display tabular text-[26px] leading-none', !text && 'text-ink-3')}>
          {shown || '–'}
          <span className="keypad-caret ml-0.5 inline-block h-[0.9em] w-[2px] translate-y-[0.1em] rounded bg-accent" />
        </span>
      </div>
      <div className="grid grid-cols-4 grid-rows-4 gap-2 pb-2">
        {['1', '2', '3'].map((digit) => (
          <Key key={digit} onPress={() => press(digit)}>
            {digit}
          </Key>
        ))}
        <Key label="Löschen" onPress={() => press('back')} muted>
          <Delete size={22} />
        </Key>
        {['4', '5', '6'].map((digit) => (
          <Key key={digit} onPress={() => press(digit)}>
            {digit}
          </Key>
        ))}
        <button
          type="button"
          aria-label="Fertig"
          onClick={close}
          className="accent-gradient row-span-3 flex items-center justify-center rounded-2xl shadow-[var(--shadow-glow)] transition active:scale-95"
        >
          <Check size={28} strokeWidth={3} />
        </button>
        {['7', '8', '9'].map((digit) => (
          <Key key={digit} onPress={() => press(digit)}>
            {digit}
          </Key>
        ))}
        {left ? (
          <Key label={left === 'clear' ? 'Wert leeren' : 'Komma'} onPress={() => press(left)} muted>
            {left === 'clear' ? '–' : ','}
          </Key>
        ) : (
          <span />
        )}
        <Key onPress={() => press('0')} className="col-span-2">
          0
        </Key>
      </div>
    </div>,
    document.body,
  );
}

function Key({ children, onPress, label, muted = false, className }: { children: ReactNode; onPress: () => void; label?: string; muted?: boolean; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onPress}
      className={cx(
        'display flex h-[3.25rem] items-center justify-center rounded-2xl border border-line text-[24px] transition active:scale-95 active:bg-glass-3',
        muted ? 'bg-white/[0.03] text-ink-2' : 'bg-surface-2 text-ink',
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Zahlenfeld, das statt der System-Tastatur das eigene Ziffernfeld öffnet.
 * `live`: Wert wird schon beim Tippen übernommen (sonst erst beim Schließen).
 */
export function KeypadField({
  value,
  onChange,
  label,
  decimal = false,
  min = 0,
  allowEmpty = false,
  live = true,
  placeholder = '–',
  className,
  suffix,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  label?: string;
  decimal?: boolean;
  min?: number;
  allowEmpty?: boolean;
  live?: boolean;
  placeholder?: string;
  className?: string;
  suffix?: ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLButtonElement>(null);
  const active = useKeypad((state) => state.request?.id === id);
  const text = useKeypad((state) => (state.request?.id === id ? state.text : ''));
  const cleared = useKeypad((state) => state.request?.id === id && state.cleared);
  const display = value === null ? '' : formatNumber(value);

  const latest = useRef({ onChange, decimal, min, live });
  latest.current = { onChange, decimal, min, live };
  const parse = (raw: string) => {
    const parsed = latest.current.decimal ? parseDecimal(raw) : parseInteger(raw);
    return parsed !== null && parsed >= latest.current.min ? parsed : null;
  };

  // Feld verschwindet (z. B. Tageswechsel) – Ziffernfeld mit schließen
  useEffect(
    () => () => {
      if (useKeypad.getState().request?.id === id) useKeypad.getState().close();
    },
    [id],
  );

  const open = () => {
    if (!ref.current) return;
    useKeypad.getState().open({
      id,
      label,
      decimal,
      allowEmpty,
      current: display,
      anchor: ref.current,
      onInput: (raw) => {
        if (!latest.current.live || !raw) return;
        const parsed = parse(raw);
        if (parsed !== null) latest.current.onChange(parsed);
      },
      onClear: () => latest.current.onChange(null),
      onClose: (raw) => {
        if (latest.current.live || !raw) return;
        const parsed = parse(raw);
        if (parsed !== null) latest.current.onChange(parsed);
      },
    });
  };

  const shown = active ? text || (cleared ? '' : display) : display;
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      data-active={active || undefined}
      onClick={open}
      className={cx('tabular inline-flex items-center justify-center', className)}
    >
      <span className={cx(active && !text && 'text-ink-3', !shown && 'text-ink-4')}>{shown || placeholder}</span>
      {active && <span className="keypad-caret ml-0.5 inline-block h-[0.9em] w-[2px] rounded bg-accent" />}
      {suffix}
    </button>
  );
}
