import { useRef } from 'react';
import { CalendarDays } from 'lucide-react';
import { cx } from '../../components/ui';
import { formatLong, relativeDay, todayKey } from '../../domain/dates';
import { todaysWeekDay, WEEK, weekDayInfo, type TrainingPlan, type WeekDayKey } from '../../domain/plan';
import { doneSetCount, draftKey, type DraftSession } from '../../state/drafts';
import { useActivePlan, useStore } from '../../state/store';
import { AccountButton } from '../settings/AccountButton';

/** Kopf des Trainings-Tabs: Datum (antippen zum Nachtragen), Titel und Wochenleiste. */
export function TrainingHeader({ date, onDateChange, title }: { date?: string; onDateChange?: (date: string) => void; title: string }) {
  const today = todayKey();
  const dateInput = useRef<HTMLInputElement>(null);
  const day = useStore((state) => state.selectedDay);
  const selectDay = useStore((state) => state.selectDay);
  const drafts = useStore((state) => state.drafts);
  const plan = useActivePlan();

  return (
    <>
      <header className="safe-top px-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {date && onDateChange ? (
              <>
                <button
                  type="button"
                  onClick={() => dateInput.current?.showPicker?.() ?? dateInput.current?.click()}
                  className="eyebrow -ml-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 hover:text-ink-2"
                >
                  <CalendarDays size={13} />
                  {date === today ? formatLong(today) : `${relativeDay(date)} · nachgetragen`}
                </button>
                <input
                  ref={dateInput}
                  type="date"
                  className="pointer-events-none absolute h-0 w-0 opacity-0"
                  value={date}
                  max={today}
                  onChange={(event) => event.target.value && onDateChange(event.target.value)}
                  tabIndex={-1}
                  aria-hidden
                />
              </>
            ) : (
              <p className="eyebrow inline-flex items-center gap-1.5 py-0.5">
                <CalendarDays size={13} />
                {formatLong(today)}
              </p>
            )}
            <h1 className="display mt-1 text-[36px] leading-none">{title}</h1>
          </div>
          <AccountButton />
        </div>
      </header>
      <DayStrip plan={plan} day={day} onSelect={selectDay} drafts={drafts} />
    </>
  );
}

function DayStrip({
  plan,
  day,
  onSelect,
  drafts,
}: {
  plan: TrainingPlan;
  day: WeekDayKey;
  onSelect: (day: WeekDayKey) => void;
  drafts: Partial<Record<string, DraftSession>>;
}) {
  const todays = todaysWeekDay();
  return (
    <div className="flex gap-1 px-3">
      {WEEK.map((key) => {
        const info = weekDayInfo(plan, key);
        const selected = key === day;
        const inProgress = info.kind === 'strength' && doneSetCount(drafts[draftKey(plan.id, key)]) > 0;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            aria-pressed={selected}
            aria-label={`${info.short} – ${info.title}`}
            className={cx(
              'relative flex min-w-0 flex-1 flex-col items-center rounded-2xl border px-0.5 pb-2 pt-2 transition active:scale-95',
              selected ? 'accent-gradient border-transparent text-on-accent shadow-[var(--shadow-glow)]' : 'glass text-ink-2',
            )}
          >
            <span className={cx('display text-[17px]', !selected && 'text-ink')}>{info.short}</span>
            <span className={cx('mt-0.5 max-w-full truncate text-[10px] font-medium', selected ? 'text-on-accent/70' : 'text-ink-3')}>{info.tag}</span>
            {key === todays && <span className={cx('absolute left-1/2 top-1 h-1 w-1 -translate-x-1/2 rounded-full', selected ? 'bg-on-accent' : 'bg-accent-2')} />}
            {inProgress && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-success" />}
          </button>
        );
      })}
    </div>
  );
}
