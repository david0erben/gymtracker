import { useMemo, useState } from 'react';
import { Activity, Ban, Bike, CalendarCheck, CalendarDays, ChevronRight, Dumbbell, Flame, Footprints, SkipForward, Target, Trophy } from 'lucide-react';
import { streakStats } from '../../domain/streaks';
import { CARDIO_TYPES, formatDuration, formatPace, paceMinPerKm, speedKmh, type CardioEntry } from '../../domain/cardio';
import { cx, EmptyState, ScreenHeader, Segmented } from '../../components/ui';
import { addDays, formatMonth, formatWeekdayShort, parseDateKey, todayKey, weekStart } from '../../domain/dates';
import { formatNumber } from '../../domain/format';
import { DAY_KEYS, TRAINING_PLAN } from '../../domain/plan';
import type { DayKey, Workout } from '../../domain/types';
import { useStore } from '../../state/store';
import { AccountButton } from '../settings/AccountButton';
import { MonthCalendar, YearCalendar } from './Calendar';
import { WorkoutSheet } from './WorkoutSheet';
import { CardioSheet } from './CardioSheet';

type ListItem =
  | { kind: 'strength'; date: string; at: string; workout: Workout }
  | { kind: 'cardio'; date: string; at: string; entry: CardioEntry };

function summary(workout: Workout) {
  let sets = 0;
  let volume = 0;
  let skipped = 0;
  let excluded = 0;
  for (const entry of workout.exercises) {
    if (entry.skipped) skipped += 1;
    if (entry.excluded) excluded += 1;
    for (const set of entry.sets) {
      if (!set.reps) continue;
      sets += 1;
      volume += (set.weight ?? 0) * set.reps;
    }
  }
  return { exercises: workout.exercises.length - skipped, sets, volume, skipped, excluded };
}

export function HistoryScreen() {
  const workouts = useStore((state) => state.workouts);
  const cardio = useStore((state) => state.cardio);
  const today = todayKey();
  const [view, setView] = useState<'month' | 'year'>('month');
  const [month, setMonth] = useState(`${today.slice(0, 7)}-01`);
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [filter, setFilter] = useState<DayKey | 'all' | 'cardio'>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [openWorkout, setOpenWorkout] = useState<Workout | null>(null);
  const [openCardio, setOpenCardio] = useState<CardioEntry | null>(null);

  const trainedDays = useMemo(() => {
    const map = new Map<string, number>();
    for (const workout of workouts) map.set(workout.date, (map.get(workout.date) ?? 0) + 1);
    return map;
  }, [workouts]);
  const cardioDays = useMemo(() => new Set(cardio.map((entry) => entry.date)), [cardio]);

  const stats = useMemo(() => {
    const thisWeek = weekStart(today);
    const eightWeeksAgo = addDays(thisWeek, -56);
    const dates = [...workouts, ...cardio].map((item) => item.date);
    const week = dates.filter((date) => date >= thisWeek).length;
    const recent = dates.filter((date) => date >= eightWeeksAgo && date < thisWeek).length;
    return { week, average: recent / 8, total: dates.length };
  }, [workouts, cardio, today]);

  const streaks = useMemo(
    () => streakStats(workouts.map((workout) => workout.date), cardio.map((entry) => entry.date), today),
    [workouts, cardio, today],
  );

  const list = useMemo(() => {
    const items: ListItem[] = [
      ...(filter === 'cardio' ? [] : workouts.filter((workout) => filter === 'all' || workout.trainingDay === filter).map((workout) => ({ kind: 'strength' as const, date: workout.date, at: workout.completedAt, workout }))),
      ...(filter === 'all' || filter === 'cardio' ? cardio.map((entry) => ({ kind: 'cardio' as const, date: entry.date, at: entry.completedAt, entry })) : []),
    ]
      .filter((item) => !selectedDate || item.date === selectedDate)
      .sort((a, b) => (a.date === b.date ? b.at.localeCompare(a.at) : a.date < b.date ? 1 : -1));
    const groups: { month: string; items: ListItem[] }[] = [];
    for (const item of items) {
      const key = `${item.date.slice(0, 7)}-01`;
      const group = groups.at(-1);
      if (group && group.month === key) group.items.push(item);
      else groups.push({ month: key, items: [item] });
    }
    return groups;
  }, [workouts, cardio, filter, selectedDate]);

  return (
    <div className="pb-36">
      <ScreenHeader eyebrow="Dein Training" title="Verlauf" right={<AccountButton />} />

      <div className="grid grid-cols-3 gap-2 px-4 lg:grid-cols-6">
        {[
          { icon: <Flame size={15} />, label: 'Serie', value: String(streaks.current), unit: streaks.current === 1 ? 'Tag' : 'Tage' },
          { icon: <Trophy size={15} />, label: 'Rekord', value: String(streaks.longest), unit: streaks.longest === 1 ? 'Tag' : 'Tage' },
          { icon: <Target size={15} />, label: 'Plantreue', value: streaks.adherence === null ? '–' : String(Math.round(streaks.adherence * 100)), unit: '%' },
          { icon: <CalendarCheck size={15} />, label: 'Woche', value: String(stats.week), unit: '' },
          { icon: <Activity size={15} />, label: 'Ø Woche', value: formatNumber(stats.average, 1), unit: '' },
          { icon: <Dumbbell size={15} />, label: 'Gesamt', value: String(stats.total), unit: '' },
        ].map((stat) => (
          <div key={stat.label} className="glass relative rounded-2xl px-3 py-3">
            <span className="absolute right-2 top-2.5 text-accent">{stat.icon}</span>
            <p className="eyebrow truncate pr-4 text-[10px] tracking-[0.04em]">{stat.label}</p>
            <p className="display tabular mt-2 text-[22px] leading-none">
              {stat.value}
              {stat.unit && <span className="ml-1 text-[12px] text-ink-3">{stat.unit}</span>}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-2 px-5 text-[11.5px] text-ink-3">
        Serie = geplante Trainingstage am Stück · Plantreue = letzte 4 Wochen ({streaks.doneDays} von {streaks.plannedDays} Tagen)
      </p>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 px-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <section className="glass rounded-[var(--radius-card)] p-4 lg:sticky lg:top-4">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'month', label: 'Monat' },
              { value: 'year', label: 'Jahr' },
            ]}
            className="mb-4"
          />
          {view === 'month' ? (
            <MonthCalendar
              month={month}
              onMonthChange={(value) => {
                setMonth(value);
                setSelectedDate(null);
              }}
              trainedDays={trainedDays}
              cardioDays={cardioDays}
              selected={selectedDate}
              onSelect={(day) => setSelectedDate(selectedDate === day ? null : day)}
            />
          ) : (
            <YearCalendar
              year={year}
              onYearChange={setYear}
              trainedDays={trainedDays}
              cardioDays={cardioDays}
              onSelectMonth={(value) => {
                setMonth(value);
                setView('month');
              }}
            />
          )}
        </section>

        <section>
          <div className="no-scrollbar -mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4">
            {(['all', ...DAY_KEYS, 'cardio'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cx(
                  'h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold transition',
                  filter === key ? 'border-accent/50 bg-accent/20 text-ink' : 'border-line bg-glass text-ink-3 hover:text-ink-2',
                )}
              >
                {key === 'all' ? 'Alle' : key === 'cardio' ? 'Cardio' : `${TRAINING_PLAN[key].short} · ${TRAINING_PLAN[key].tag}`}
              </button>
            ))}
          </div>

          {selectedDate && (
            <button type="button" onClick={() => setSelectedDate(null)} className="mb-2 text-[13px] font-medium text-accent-2">
              Alle Tage anzeigen
            </button>
          )}

          {list.length === 0 ? (
            <EmptyState icon={<CalendarDays size={24} />} title="Keine Trainings" text="Für diese Auswahl gibt es noch keine gespeicherten Trainings." />
          ) : (
            list.map((group) => (
              <div key={group.month} className="mb-4">
                <p className="eyebrow mb-2 px-1 capitalize">{formatMonth(group.month)}</p>
                <div className="flex flex-col gap-2">
                  {group.items.map((item) => {
                    if (item.kind === 'cardio') {
                      const entry = item.entry;
                      const pace = paceMinPerKm(entry);
                      const speed = speedKmh(entry);
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => setOpenCardio(entry)}
                          className="glass flex items-center gap-3.5 rounded-[1.4rem] px-3.5 py-3 text-left transition hover:bg-glass-2 active:scale-[0.99]"
                        >
                          <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-accent-2/10 text-accent-2">
                            <span className="display text-[18px] leading-none">{parseDateKey(entry.date).getDate()}</span>
                            <span className="mt-0.5 text-[10.5px] font-semibold uppercase">{formatWeekdayShort(entry.date)}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold">
                              {entry.type === 'run' ? <Footprints size={15} className="text-accent-2" /> : <Bike size={15} className="text-accent-2" />}
                              {CARDIO_TYPES[entry.type].label}
                            </p>
                            <p className="tabular text-[12.5px] text-ink-3">
                              {formatDuration(entry.durationMin)}
                              {entry.distanceKm ? ` · ${formatNumber(entry.distanceKm, 1)} km` : ''}
                              {entry.type === 'run' && pace !== null ? ` · ${formatPace(pace)} /km` : ''}
                              {entry.type === 'bike' && speed !== null ? ` · ${formatNumber(speed, 1)} km/h` : ''}
                              {entry.avgHr ? ` · ♥ ${entry.avgHr}` : ''}
                            </p>
                          </div>
                          <ChevronRight size={18} className="shrink-0 text-ink-4" />
                        </button>
                      );
                    }
                    const workout = item.workout;
                    const info = summary(workout);
                    const date = parseDateKey(workout.date);
                    return (
                      <button
                        key={workout.id}
                        type="button"
                        onClick={() => setOpenWorkout(workout)}
                        className="glass flex items-center gap-3.5 rounded-[1.4rem] px-3.5 py-3 text-left transition hover:bg-glass-2 active:scale-[0.99]"
                      >
                        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/[0.06]">
                          <span className="display text-[18px] leading-none">{date.getDate()}</span>
                          <span className="mt-0.5 text-[10.5px] font-semibold uppercase text-ink-3">{formatWeekdayShort(workout.date)}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold">{TRAINING_PLAN[workout.trainingDay]?.title ?? workout.trainingDayLabel}</p>
                          <p className="tabular text-[12.5px] text-ink-3">
                            {info.exercises} Übungen · {info.sets} Sets · {formatNumber(Math.round(info.volume))} kg
                          </p>
                          {(info.skipped > 0 || info.excluded > 0) && (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {info.skipped > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-3">
                                  <SkipForward size={11} /> {info.skipped} ausgelassen
                                </span>
                              )}
                              {info.excluded > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-3">
                                  <Ban size={11} /> {info.excluded} nicht gewertet
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <ChevronRight size={18} className="shrink-0 text-ink-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      {openWorkout && <WorkoutSheet workout={openWorkout} onClose={() => setOpenWorkout(null)} />}
      {openCardio && <CardioSheet entry={openCardio} onClose={() => setOpenCardio(null)} />}
    </div>
  );
}
