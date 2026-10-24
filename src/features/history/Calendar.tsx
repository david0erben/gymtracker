import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx, IconButton } from '../../components/ui';
import { formatMonth, parseDateKey, toDateKey, todayKey } from '../../domain/dates';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function monthDays(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= count; day += 1) cells.push(toDateKey(new Date(year, month, day)));
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** Monatsansicht: ein leuchtender Punkt an jedem Trainingstag. */
export function MonthCalendar({
  month,
  onMonthChange,
  trainedDays,
  cardioDays,
  selected,
  onSelect,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  trainedDays: Map<string, number>;
  cardioDays: Set<string>;
  selected: string | null;
  onSelect: (day: string) => void;
}) {
  const date = parseDateKey(month);
  const year = date.getFullYear();
  const index = date.getMonth();
  const today = todayKey();
  const cells = monthDays(year, index);
  const count = cells.filter((day) => day && (trainedDays.has(day) || cardioDays.has(day))).length;
  const shift = (delta: number) => onMonthChange(toDateKey(new Date(year, index + delta, 1)));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <IconButton label="Vorheriger Monat" onClick={() => shift(-1)}>
          <ChevronLeft size={20} />
        </IconButton>
        <div className="text-center">
          <p className="display text-[18px] capitalize">{formatMonth(month)}</p>
          <p className="text-[12px] text-ink-3">
            {count} {count === 1 ? 'Trainingstag' : 'Trainingstage'}
          </p>
        </div>
        <IconButton label="Nächster Monat" onClick={() => shift(1)}>
          <ChevronRight size={20} />
        </IconButton>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
            {weekday}
          </span>
        ))}
        {cells.map((day, position) => {
          if (!day) return <span key={`empty-${position}`} />;
          const strength = trainedDays.has(day);
          const cardio = cardioDays.has(day);
          const trained = strength || cardio;
          const isToday = day === today;
          const isSelected = day === selected;
          return (
            <button
              key={day}
              type="button"
              disabled={!trained}
              onClick={() => onSelect(day)}
              className={cx(
                'relative mx-auto flex h-11 w-11 flex-col items-center justify-center rounded-full text-[15px] font-semibold tabular transition',
                trained ? 'text-ink hover:bg-glass-2' : 'text-ink-4',
                isToday && 'ring-1 ring-accent-2/70',
                isSelected && 'bg-accent/20 text-ink',
              )}
            >
              {parseDateKey(day).getDate()}
              {trained && (
                <span className="absolute bottom-1 flex gap-0.5">
                  {strength && <span className="h-1.5 w-1.5 rounded-full bg-success" />}
                  {cardio && <span className="h-1.5 w-1.5 rounded-full bg-accent-2" />}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Jahresansicht als Heatmap: jedes Kästchen ein Tag, leuchtend = trainiert. */
export function YearCalendar({
  year,
  onYearChange,
  trainedDays,
  cardioDays,
  onSelectMonth,
}: {
  year: number;
  onYearChange: (year: number) => void;
  trainedDays: Map<string, number>;
  cardioDays: Set<string>;
  onSelectMonth: (month: string) => void;
}) {
  const today = todayKey();
  const active = (day: string) => trainedDays.has(day) || cardioDays.has(day);
  const total = new Set([...trainedDays.keys(), ...cardioDays].filter((day) => day.startsWith(String(year)))).size;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <IconButton label="Vorheriges Jahr" onClick={() => onYearChange(year - 1)}>
          <ChevronLeft size={20} />
        </IconButton>
        <div className="text-center">
          <p className="display text-[18px]">{year}</p>
          <p className="text-[12px] text-ink-3">{total} Trainingstage</p>
        </div>
        <IconButton label="Nächstes Jahr" onClick={() => onYearChange(year + 1)}>
          <ChevronRight size={20} />
        </IconButton>
      </div>
      <div className="grid grid-cols-3 gap-x-4 gap-y-4 sm:grid-cols-4">
        {MONTHS_SHORT.map((label, month) => {
          const cells = monthDays(year, month);
          const count = cells.filter((day) => day && active(day)).length;
          return (
            <button key={label} type="button" onClick={() => onSelectMonth(toDateKey(new Date(year, month, 1)))} className="rounded-xl p-1 text-left transition hover:bg-glass">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[12px] font-semibold text-ink-2">{label}</span>
                <span className={cx('tabular text-[11px]', count ? 'text-success' : 'text-ink-4')}>{count || ''}</span>
              </div>
              <div className="grid grid-cols-7 gap-[3px]">
                {cells.map((day, position) =>
                  day ? (
                    <span
                      key={day}
                      title={day}
                      className={cx(
                        'aspect-square rounded-[3px]',
                        trainedDays.has(day) ? 'bg-success' : cardioDays.has(day) ? 'bg-accent-2' : day > today ? 'bg-white/[0.03]' : 'bg-white/[0.07]',
                      )}
                    />
                  ) : (
                    <span key={`empty-${position}`} />
                  ),
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
