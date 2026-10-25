import { useMemo, useState } from 'react';
import { Bike, Footprints, HeartPulse } from 'lucide-react';
import { cx, EmptyState, Segmented } from '../../components/ui';
import { inRange, rangeStart, trendPercent, type Range } from '../../domain/analytics';
import { CARDIO_TYPES, cardioWeeks, formatDuration, formatPace, paceMinPerKm, speedKmh, type CardioType } from '../../domain/cardio';
import { addDays, formatFull, parseDateKey, toDateKey, todayKey, weekStart } from '../../domain/dates';
import { formatNumber } from '../../domain/format';
import { useStore } from '../../state/store';
import { CARDIO_COLORS, CardioTrendChart, CardioWeekChart, TrendBadge } from './charts';

type Metric = 'speed' | 'hr';

/** Cardio-Auswertung: Umfang pro Woche und Entwicklung von Pace/Tempo und Puls. */
export function CardioSection({ range }: { range: Range }) {
  const cardio = useStore((state) => state.cardio);
  const today = todayKey();
  const start = rangeStart(range, today);
  const entries = useMemo(() => [...inRange(cardio, start)].sort((a, b) => a.date.localeCompare(b.date)), [cardio, start]);
  const [type, setType] = useState<CardioType>(() => {
    const runs = cardio.filter((entry) => entry.type === 'run').length;
    return runs >= cardio.length - runs ? 'run' : 'bike';
  });
  const [metric, setMetric] = useState<Metric>('speed');

  const weeks = useMemo(() => cardioWeeks(entries, start, today), [entries, start, today]);

  if (!cardio.length) {
    return (
      <div className="mt-4 px-4">
        <section className="glass rounded-[var(--radius-card)] p-4">
          <EmptyState icon={<HeartPulse size={24} />} title="Noch kein Cardio" text="Trag Laufen oder Radfahren an einem Cardio-Tag im Training ein – hier siehst du dann deine Entwicklung." />
        </section>
      </div>
    );
  }

  const minutes = entries.reduce((sum, entry) => sum + entry.durationMin, 0);
  const km = entries.reduce((sum, entry) => sum + (entry.distanceKm ?? 0), 0);
  // Schnitt der letzten 4 vollen Wochen
  const thisWeek = weekStart(today);
  const lastFour = weeks.filter((week) => week.week < thisWeek && week.week >= addDays(thisWeek, -28));
  const weeklyAvg = lastFour.length ? lastFour.reduce((sum, week) => sum + week.run + week.bike, 0) / lastFour.length : null;

  const typed = entries.filter((entry) => entry.type === type);
  const isRun = type === 'run';
  const speedPoints = typed
    .filter((entry) => speedKmh(entry) !== null)
    .map((entry) => ({ t: parseDateKey(entry.date).getTime(), value: (isRun ? paceMinPerKm(entry) : speedKmh(entry)) as number, speed: speedKmh(entry) as number }));
  const hrPoints = typed.filter((entry) => entry.avgHr).map((entry) => ({ t: parseDateKey(entry.date).getTime(), value: entry.avgHr as number }));
  const points = metric === 'speed' ? speedPoints : hrPoints;
  // Trend über die Geschwindigkeit: positiv = schneller (gilt auch für die Pace)
  const speedTrend = trendPercent(speedPoints.map((point) => ({ value: point.speed })));

  const latest = points.at(-1);
  const format = metric === 'hr' ? (value: number) => String(Math.round(value)) : isRun ? (value: number) => formatPace(value) : (value: number) => formatNumber(value, 1);
  const unit = metric === 'hr' ? 'bpm' : isRun ? '/km' : 'km/h';
  const label = metric === 'hr' ? 'Ø Puls' : isRun ? 'Pace' : 'Ø Tempo';

  const longest = typed.reduce<(typeof typed)[number] | null>((best, entry) => ((entry.distanceKm ?? 0) > (best?.distanceKm ?? 0) ? entry : best), null);
  const fastest = speedPoints.reduce<(typeof speedPoints)[number] | null>((best, point) => (point.speed > (best?.speed ?? 0) ? point : best), null);

  return (
    <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 px-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
      <section className="glass rounded-[var(--radius-card)] p-4">
        <p className="eyebrow">Umfang im Zeitraum</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[
            { label: 'Einheiten', value: String(entries.length) },
            { label: 'Zeit', value: minutes < 60 ? formatDuration(minutes) : `${Math.floor(minutes / 60)}:${String(Math.round(minutes % 60)).padStart(2, '0')} h` },
            { label: 'Strecke', value: `${formatNumber(km, 1)} km` },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-line bg-white/[0.03] px-3 py-2.5">
              <p className="eyebrow">{stat.label}</p>
              <p className="tabular mt-1 truncate text-[15px] font-semibold">{stat.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[15px] font-semibold">Minuten pro Woche</p>
        {weeklyAvg !== null && <p className="tabular text-[12.5px] text-ink-3">Ø {Math.round(weeklyAvg)} min in den letzten 4 Wochen</p>}
        <div className="-mx-2 mt-2">
          <CardioWeekChart data={weeks} />
        </div>
        <div className="mt-1 flex items-center gap-4 text-[11.5px] text-ink-3">
          {(Object.keys(CARDIO_TYPES) as CardioType[]).map((key) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: CARDIO_COLORS[key] }} /> {CARDIO_TYPES[key].label}
            </span>
          ))}
        </div>
      </section>

      <section className="glass rounded-[var(--radius-card)] p-4">
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-glass p-1">
          {(Object.keys(CARDIO_TYPES) as CardioType[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setType(key)}
              aria-pressed={type === key}
              className={cx(
                'flex h-10 items-center justify-center gap-2 rounded-xl text-[14px] font-semibold transition',
                type === key ? 'bg-glass-3 text-ink' : 'text-ink-3 hover:text-ink-2',
              )}
            >
              {key === 'run' ? <Footprints size={16} /> : <Bike size={16} />} {CARDIO_TYPES[key].label}
            </button>
          ))}
        </div>

        <Segmented
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'speed', label: isRun ? 'Pace' : 'Tempo' },
            { value: 'hr', label: 'Puls' },
          ]}
          className="mt-3"
        />

        {points.length === 0 ? (
          <EmptyState
            icon={<HeartPulse size={24} />}
            title="Keine Daten im Zeitraum"
            text={metric === 'hr' ? 'Trag beim Cardio den Ø Puls ein, dann siehst du hier den Verlauf.' : 'Trag Dauer und Kilometer ein, dann siehst du hier deine Pace.'}
          />
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-2">
              <p className="display tabular text-[40px] leading-none">
                {latest ? format(latest.value) : '–'}
                <span className="ml-1 text-[16px] text-ink-2">{unit}</span>
              </p>
              {metric === 'speed' && <TrendBadge value={speedTrend} suffix=" Tempo" />}
            </div>
            <p className="mt-1 text-[12.5px] text-ink-3">
              {label} der letzten Einheit{latest ? ` · ${formatFull(toDateKey(new Date(latest.t)))}` : ''}
            </p>
            <div className="-mx-2 mt-3">
              <CardioTrendChart data={points} format={format} unit={unit} label={label} invert={metric === 'speed' && isRun} />
            </div>
          </>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-line bg-white/[0.03] px-3 py-2.5">
            <p className="eyebrow">{isRun ? 'Beste Pace' : 'Bestes Tempo'}</p>
            <p className="tabular mt-1 truncate text-[15px] font-semibold">
              {fastest ? (isRun ? `${formatPace(60 / fastest.speed)} /km` : `${formatNumber(fastest.speed, 1)} km/h`) : '–'}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white/[0.03] px-3 py-2.5">
            <p className="eyebrow">Weiteste Strecke</p>
            <p className="tabular mt-1 truncate text-[15px] font-semibold">{longest?.distanceKm ? `${formatNumber(longest.distanceKm, 1)} km` : '–'}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

