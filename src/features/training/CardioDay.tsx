import { useState } from 'react';
import { Bike, Check, CircleCheck, Footprints, HeartPulse, Trash2 } from 'lucide-react';
import { cx } from '../../components/ui';
import { createId } from '../../data/legacy';
import { CARDIO_TYPES, formatDuration, formatPace, paceMinPerKm, speedKmh, type CardioDayKey, type CardioEntry, type CardioType } from '../../domain/cardio';
import { formatShort, todayKey } from '../../domain/dates';
import { formatNumber } from '../../domain/format';
import { round2 } from '../../domain/strength';
import { useStore } from '../../state/store';
import { NumberStepper } from './NumberStepper';
import { TrainingHeader } from './TrainingHeader';

const TYPE_ICON: Record<CardioType, React.ReactNode> = {
  run: <Footprints size={17} />,
  bike: <Bike size={17} />,
};

/** Cardio-Tag (Mittwoch/Sonntag): eine Einheit Laufen oder Radfahren eintragen. */
export function CardioDay({ day }: { day: CardioDayKey }) {
  const cardio = useStore((state) => state.cardio);
  const saveCardio = useStore((state) => state.saveCardio);
  const deleteCardio = useStore((state) => state.deleteCardio);
  const showToast = useStore((state) => state.showToast);
  const today = todayKey();

  const lastOf = (type: CardioType) => [...cardio].reverse().find((entry) => entry.type === type);
  const initialType: CardioType = cardio.at(-1)?.type ?? 'run';
  const [date, setDate] = useState(today);
  const [type, setType] = useState<CardioType>(initialType);
  const [duration, setDuration] = useState<number | null>(lastOf(initialType)?.durationMin ?? 30);
  const [distance, setDistance] = useState<number | null>(lastOf(initialType)?.distanceKm ?? null);
  const [heartRate, setHeartRate] = useState<number | null>(lastOf(initialType)?.avgHr ?? null);

  const chooseType = (next: CardioType) => {
    setType(next);
    const last = lastOf(next);
    setDuration(last?.durationMin ?? 30);
    setDistance(last?.distanceKm ?? null);
    setHeartRate(last?.avgHr ?? null);
  };

  const draft = { durationMin: duration ?? 0, distanceKm: distance };
  const pace = paceMinPerKm(draft);
  const speed = speedKmh(draft);
  const doneToday = cardio.some((entry) => entry.date === today);

  const save = () => {
    if (!duration || duration < 1) {
      showToast('Trag mindestens die Dauer ein.', 'error');
      return;
    }
    const entry: CardioEntry = {
      id: createId(),
      date,
      completedAt: new Date().toISOString(),
      type,
      durationMin: duration,
      distanceKm: distance && distance > 0 ? distance : null,
      avgHr: heartRate && heartRate > 0 ? heartRate : null,
    };
    saveCardio(entry);
    showToast(`${CARDIO_TYPES[type].label} gespeichert.`, 'success', { label: 'Rückgängig', run: () => deleteCardio(entry.id) });
  };

  const recent = [...cardio].reverse().slice(0, 6);

  return (
    <div className="pb-36" data-day={day}>
      <TrainingHeader date={date} onDateChange={setDate} title="Cardio" />

      {doneToday && date === today && (
        <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-success/25 bg-success/[0.07] px-4 py-3 text-[13.5px] text-success">
          <CircleCheck size={18} className="shrink-0" />
          <span>Cardio für heute ist eingetragen.</span>
        </div>
      )}

      <section className="glass mx-4 mt-5 rounded-[var(--radius-card)] p-4">
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-glass p-1">
          {(Object.keys(CARDIO_TYPES) as CardioType[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => chooseType(key)}
              aria-pressed={type === key}
              className={cx(
                'flex h-10 items-center justify-center gap-2 rounded-xl text-[14px] font-semibold transition',
                type === key ? 'bg-glass-3 text-ink' : 'text-ink-3 hover:text-ink-2',
              )}
            >
              {TYPE_ICON[key]} {CARDIO_TYPES[key].label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <NumberStepper
            label="Minuten"
            value={duration}
            onChange={setDuration}
            onIncrement={() => setDuration((duration ?? 0) + 5)}
            onDecrement={() => setDuration(Math.max(5, (duration ?? 5) - 5))}
          />
          <NumberStepper
            label="Km"
            decimal
            value={distance}
            onChange={setDistance}
            onIncrement={() => setDistance(round2((distance ?? 0) + 0.5))}
            onDecrement={() => setDistance(distance && distance > 0.5 ? round2(distance - 0.5) : null)}
          />
          <NumberStepper
            label="Ø Puls"
            value={heartRate}
            onChange={setHeartRate}
            onIncrement={() => setHeartRate((heartRate ?? 130) + 1)}
            onDecrement={() => setHeartRate(heartRate && heartRate > 40 ? heartRate - 1 : null)}
          />
        </div>

        <div className="mt-1 flex items-baseline justify-center gap-2">
          <span className="eyebrow">{type === 'run' ? 'Pace' : 'Ø Tempo'}</span>
          <span className="display tabular text-[22px]">{type === 'run' ? formatPace(pace) : speed === null ? '–' : formatNumber(speed, 1)}</span>
          <span className="text-[13px] text-ink-3">{type === 'run' ? '/km' : 'km/h'}</span>
        </div>

        <button
          type="button"
          onClick={save}
          aria-label="Cardio speichern"
          className="accent-gradient mt-3 flex h-13 w-full items-center justify-center rounded-2xl text-on-accent shadow-[var(--shadow-glow)] transition active:scale-[0.98]"
        >
          <Check size={26} strokeWidth={3} />
        </button>
      </section>

      {recent.length > 0 && (
        <section className="glass mx-4 mt-4 rounded-[var(--radius-card)] p-2">
          <p className="eyebrow px-3 pb-1 pt-3">Letzte Einheiten</p>
          <ul>
            {recent.map((entry) => {
              const entryPace = paceMinPerKm(entry);
              const entrySpeed = speedKmh(entry);
              return (
                <li key={entry.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-ink-2">{TYPE_ICON[entry.type]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium">
                      {CARDIO_TYPES[entry.type].label} · {formatDuration(entry.durationMin)}
                      {entry.distanceKm ? ` · ${formatNumber(entry.distanceKm, 1)} km` : ''}
                    </p>
                    <p className="tabular flex items-center gap-2 text-[12.5px] text-ink-3">
                      {formatShort(entry.date)}
                      {entry.type === 'run' && entryPace !== null && <span>{formatPace(entryPace)} /km</span>}
                      {entry.type === 'bike' && entrySpeed !== null && <span>{formatNumber(entrySpeed, 1)} km/h</span>}
                      {entry.avgHr && (
                        <span className="inline-flex items-center gap-1">
                          <HeartPulse size={12} /> {entry.avgHr}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Einheit löschen"
                    onClick={() => {
                      const removed = deleteCardio(entry.id);
                      showToast('Einheit gelöscht.', 'default', removed ? { label: 'Rückgängig', run: () => saveCardio(removed) } : undefined);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-4 hover:bg-glass-2 hover:text-danger"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
