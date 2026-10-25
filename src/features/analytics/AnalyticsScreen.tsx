import { useMemo, useState } from 'react';
import { ChartSpline, ChevronDown, Target } from 'lucide-react';
import { cx, EmptyState, ScreenHeader, Segmented, Sheet } from '../../components/ui';
import { goalLine, inRange, movingAverage, rangeStart, strengthSeries, trendPercent, weeklyVolume, type Range, type VolumeMetric } from '../../domain/analytics';
import { formatShort, todayKey } from '../../domain/dates';
import { formatNumber, formatSet } from '../../domain/format';
import { exerciseInfo, MUSCLE_GROUPS, plannedName, shortName, strengthDays, type MuscleGroup, type TrainingPlan } from '../../domain/plan';
import type { Workout } from '../../domain/types';
import { useActivePlan, useStore } from '../../state/store';
import { AccountButton } from '../settings/AccountButton';
import { CardioSection } from './CardioSection';
import { Sparkline, StrengthChart, TrendBadge, VolumeChart } from './charts';

const RANGES: { value: Range; label: string }[] = [
  { value: '3m', label: '3 M' },
  { value: '6m', label: '6 M' },
  { value: '1y', label: '1 J' },
  { value: 'all', label: 'Alle' },
];

interface ExerciseChoice {
  name: string;
  label: string;
  /** Wochentag im aktuellen Plan, leer bei Übungen aus einem anderen Plan */
  day: string;
}

/** Übungen des aktuellen Plans in Plan-Reihenfolge, danach weitere Übungen mit Verlauf (z. B. aus dem anderen Plan). */
function exerciseChoices(plan: TrainingPlan, workouts: Workout[]): ExerciseChoice[] {
  const seen = new Set<string>();
  const list: ExerciseChoice[] = [];
  for (const day of strengthDays(plan)) {
    for (const exercise of plan.days[day].exercises) {
      if (seen.has(exercise.name)) continue;
      seen.add(exercise.name);
      list.push({ name: exercise.name, label: plannedName(exercise), day: plan.days[day].short });
    }
  }
  const others = new Set<string>();
  for (const workout of workouts) for (const entry of workout.exercises) if (!seen.has(entry.name) && entry.sets.length) others.add(entry.name);
  const rest = [...others].sort((a, b) => shortName(a).localeCompare(shortName(b), 'en')).map((name) => ({ name, label: shortName(name), day: '' }));
  return [...list, ...rest];
}

export function AnalyticsScreen() {
  const [mode, setMode] = useState<'strength' | 'volume' | 'cardio'>('strength');
  const [range, setRange] = useState<Range>('6m');

  return (
    <div className="pb-36">
      <ScreenHeader eyebrow="Fortschritt" title="Analyse" right={<AccountButton />} />
      <div className="flex flex-col gap-2 px-4 sm:flex-row">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'strength', label: 'Kraft' },
            { value: 'volume', label: 'Volumen' },
            { value: 'cardio', label: 'Cardio' },
          ]}
          className="sm:w-96"
        />
        <Segmented value={range} onChange={setRange} options={RANGES} className="sm:ml-auto sm:w-80" />
      </div>
      {mode === 'strength' && <StrengthSection range={range} />}
      {mode === 'volume' && <VolumeSection range={range} />}
      {mode === 'cardio' && <CardioSection range={range} />}
    </div>
  );
}

function StrengthSection({ range }: { range: Range }) {
  const workouts = useStore((state) => state.workouts);
  // Das Kraftziel gibt es nur im Trainingsziel „Maximalkraft“
  const goal = useStore((state) => (state.settings.activeProfileId === 'strength' ? state.settings.goal : null));
  const levelShifts = useStore((state) => state.settings.levelShifts);
  const plan = useActivePlan();
  const today = todayKey();
  const start = rangeStart(range, today);
  const choices = useMemo(() => exerciseChoices(plan, workouts), [plan, workouts]);
  const [selected, setSelected] = useState(choices[0].name);
  const [picker, setPicker] = useState(false);

  const overview = useMemo(
    () =>
      choices.map(({ name, label, day }) => {
        const series = strengthSeries(workouts, name, levelShifts[name] ?? []);
        const points = inRange(series.points, start);
        return { name, label, day, series, points, trend: trendPercent(points) };
      }),
    [choices, workouts, start, levelShifts],
  );

  const current = overview.find((item) => item.name === selected) ?? overview[0];
  const points = current.points;
  const line = goal && current.series.metric === 'e1rm' ? goalLine(current.series.points, goal, today) : null;
  const unit = current.series.metric === 'e1rm' ? 'kg' : 'Reps';
  const best = points.reduce((max, point) => (point.value > max ? point.value : max), 0);
  const heaviest = points.reduce<{ reps: number | null; weight: number | null } | null>(
    (top, point) => (!top || (point.best.weight ?? 0) > (top.weight ?? 0) ? point.best : top),
    null,
  );

  return (
    <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 px-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
      <section className="glass rounded-[var(--radius-card)] p-4">
        <button type="button" onClick={() => setPicker(true)} className="flex w-full items-center justify-between gap-3 rounded-2xl text-left">
          <div className="min-w-0">
            <p className="eyebrow">{exerciseInfo(current.name).primary.join(' · ')}</p>
            <p className="line-clamp-2 text-[18px] font-semibold leading-snug">{current.label}</p>
          </div>
          <span className="flex h-9 shrink-0 items-center gap-1 rounded-xl border border-line bg-glass-2 px-3 text-[13px] font-medium text-ink-2">
            Übung <ChevronDown size={15} />
          </span>
        </button>

        {points.length === 0 ? (
          <EmptyState icon={<ChartSpline size={24} />} title="Keine Daten im Zeitraum" text="Wähle einen längeren Zeitraum oder eine andere Übung." />
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-2">
              <p className="display tabular text-[40px] leading-none">
                {formatNumber(points.at(-1)?.value ?? 0, 1)}
                <span className="ml-1 text-[16px] text-ink-2">{unit}</span>
              </p>
              <TrendBadge value={trendPercent(points)} suffix=" im Zeitraum" />
            </div>
            <p className="mt-1 text-[12.5px] text-ink-3">
              {current.series.metric === 'e1rm' ? 'Geschätztes 1RM der letzten Einheit (Epley, inkl. RIR)' : 'Reps gesamt der letzten Einheit'}
            </p>

            {line && (
              <div className={cx('mt-3 flex items-center gap-2 rounded-2xl border px-3 py-2 text-[12.5px]', line.onTrack ? 'border-success/20 bg-success/[0.06] text-success' : 'border-danger/20 bg-danger/[0.06] text-danger')}>
                <Target size={15} className="shrink-0" />
                <span>
                  Ziel +{formatNumber(goal?.percent ?? 0, 1)} %: {line.onTrack ? 'im Plan' : 'hinter dem Plan'} ({line.delta >= 0 ? '+' : ''}
                  {formatNumber(line.delta, 1)} Pkt.) · Soll heute {formatNumber(line.expected, 1)} kg
                </span>
              </div>
            )}

            <div className="-mx-2 mt-3">
              <StrengthChart points={points} metric={current.series.metric} goal={line} shifts={current.series.shifts.filter((shift) => !start || shift.date >= start)} />
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2">
              {[
                { label: current.series.metric === 'e1rm' ? 'Best-1RM' : 'Bestwert', value: `${formatNumber(best, 1)} ${unit}` },
                { label: 'Top-Set', value: heaviest ? formatSet(heaviest.reps, heaviest.weight) : '–' },
                { label: 'Einheiten', value: String(points.length) },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-line bg-white/[0.03] px-3 py-2.5">
                  <p className="eyebrow">{stat.label}</p>
                  <p className="tabular mt-1 truncate text-[15px] font-semibold">{stat.value}</p>
                </div>
              ))}
            </div>
            {current.series.shifts.length > 0 && (
              <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
                Gerätewechsel am {current.series.shifts.map((shift) => formatShort(shift.date)).join(', ')}: Werte davor sind auf das aktuelle Gerät umgerechnet, damit der Trend vergleichbar bleibt.
              </p>
            )}
            {line && <p className="mt-2 text-[11.5px] text-ink-3">Gestrichelt: Soll-Linie deines Ziels bis {new Date(line.end.t).toLocaleDateString('de-DE')}.</p>}
          </>
        )}
      </section>

      <section className="glass rounded-[var(--radius-card)] p-2">
        <p className="eyebrow px-3 pb-1 pt-3">Alle Übungen</p>
        <ul>
          {overview.map((item) => (
            <li key={item.name}>
              <button
                type="button"
                onClick={() => {
                  setSelected(item.name);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={cx('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-glass-2', item.name === current.name && 'bg-glass-2')}
              >
                <span className="w-6 shrink-0 text-[11px] font-semibold text-ink-3">{item.day}</span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{item.label}</span>
                <Sparkline values={item.points.map((point) => point.value)} positive={item.trend === null ? null : item.trend >= 0} />
                <span className={cx('tabular w-14 shrink-0 text-right text-[12.5px] font-semibold', item.trend === null ? 'text-ink-4' : item.trend >= 0 ? 'text-success' : 'text-danger')}>
                  {item.trend === null ? '–' : `${item.trend >= 0 ? '+' : ''}${formatNumber(item.trend, 1)} %`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <Sheet open={picker} onClose={() => setPicker(false)} title="Übung wählen">
        {[
          ...strengthDays(plan).map((day) => ({
            key: day,
            title: `${plan.days[day].short} · ${plan.days[day].title}`,
            items: plan.days[day].exercises.map((exercise) => ({ name: exercise.name, label: plannedName(exercise) })),
          })),
          { key: 'other', title: 'Weitere Übungen mit Verlauf', items: choices.filter((choice) => !choice.day) },
        ]
          .filter((group) => group.items.length)
          .map((group) => (
            <div key={group.key} className="mb-3">
              <p className="eyebrow mb-1.5">{group.title}</p>
              <div className="flex flex-col gap-1">
                {group.items.map((exercise) => (
                  <button
                    key={`${group.key}-${exercise.name}`}
                    type="button"
                    onClick={() => {
                      setSelected(exercise.name);
                      setPicker(false);
                    }}
                    className={cx('flex h-11 items-center rounded-xl px-3 text-left text-[14.5px] transition hover:bg-glass-2', exercise.name === current.name ? 'bg-accent/15 text-ink' : 'text-ink-2')}
                  >
                    {exercise.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
      </Sheet>
    </div>
  );
}

function VolumeSection({ range }: { range: Range }) {
  const workouts = useStore((state) => state.workouts);
  const today = todayKey();
  const start = rangeStart(range, today);
  const [metric, setMetric] = useState<VolumeMetric>('sets');
  const [muscle, setMuscle] = useState<MuscleGroup>('Upper Chest');

  const weeks = useMemo(() => weeklyVolume(workouts, start, today), [workouts, start, today]);
  const unit = metric === 'sets' ? 'Sets' : 'kg';

  const series = (group: MuscleGroup) => weeks.map((week) => (metric === 'sets' ? week.sets[group] : week.tonnage[group]));
  const summaryFor = (group: MuscleGroup) => {
    const values = series(group);
    const recent = values.slice(-4);
    const previous = values.slice(-8, -4);
    const avg = recent.reduce((sum, value) => sum + value, 0) / Math.max(1, recent.length);
    const prevAvg = previous.reduce((sum, value) => sum + value, 0) / Math.max(1, previous.length);
    const trend = prevAvg > 0 ? ((avg - prevAvg) / prevAvg) * 100 : null;
    return { values, avg, trend };
  };

  const selectedValues = series(muscle);
  const averages = movingAverage(selectedValues, 4);
  const chartData = weeks.map((week, index) => ({ t: week.t, value: Math.round(selectedValues[index] * 10) / 10, avg: Math.round(averages[index] * 10) / 10 }));
  const selectedSummary = summaryFor(muscle);

  return (
    <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 px-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
      <section className="glass rounded-[var(--radius-card)] p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="eyebrow">Volumen pro Woche</p>
            <p className="text-[18px] font-semibold">{muscle}</p>
          </div>
          <Segmented
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'sets', label: 'Sets' },
              { value: 'tonnage', label: 'Weight' },
            ]}
            className="w-44"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-2">
          <p className="display tabular text-[40px] leading-none">
            {formatNumber(selectedSummary.avg, 1)}
            <span className="ml-1 text-[16px] text-ink-2">{metric === 'sets' ? 'Sets/Wo.' : 'kg/Wo.'}</span>
          </p>
          <TrendBadge value={selectedSummary.trend} suffix=" vs. 4 Wo. davor" />
        </div>
        <p className="mt-1 text-[12.5px] text-ink-3">Schnitt der letzten 4 Wochen · nur Übungen, in denen der Muskel Hauptmuskel ist</p>
        <div className="-mx-2 mt-3">
          <VolumeChart data={chartData} unit={unit} />
        </div>
        <div className="mt-1 flex items-center gap-4 text-[11.5px] text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-success/60" /> pro Woche
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1 w-4 rounded bg-accent" /> Ø 4 Wochen
          </span>
        </div>
      </section>

      <section className="glass rounded-[var(--radius-card)] p-2">
        <p className="eyebrow px-3 pb-1 pt-3">Alle Muskelgruppen · Ø 4 Wochen</p>
        <ul>
          {MUSCLE_GROUPS.map((group) => {
            const summary = summaryFor(group);
            return (
              <li key={group}>
                <button
                  type="button"
                  onClick={() => {
                    setMuscle(group);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={cx('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-glass-2', group === muscle && 'bg-glass-2')}
                >
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{group}</span>
                  <Sparkline values={movingAverage(summary.values, 4)} positive={summary.trend === null ? null : summary.trend >= 0} />
                  <span className="tabular w-16 shrink-0 text-right text-[13px] font-semibold">
                    {formatNumber(summary.avg, 1)}
                    <span className="ml-0.5 text-[11px] font-medium text-ink-3">{metric === 'sets' ? ' S.' : ' kg'}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
