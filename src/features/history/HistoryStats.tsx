import { useState, type ReactNode } from 'react';
import { ChevronDown, Dumbbell, Flame, Target } from 'lucide-react';
import { cx } from '../../components/ui';
import { formatFull, formatMonthRange, formatShort } from '../../domain/dates';
import type { StreakStats } from '../../domain/streaks';

type StatKey = 'streak' | 'adherence' | 'total';

const days = (count: number) => (count === 1 ? '1 Tag' : `${count} Tage`);

/**
 * Drei Kennzahlen: Serie, Plantreue, Trainings gesamt.
 * Antippen klappt die Karte auf und zeigt die Details dazu.
 */
export function HistoryStats({
  streaks,
  today,
  strength,
  cardio,
  firstDate,
}: {
  streaks: StreakStats;
  today: string;
  strength: number;
  cardio: number;
  firstDate: string | null;
}) {
  const [open, setOpen] = useState<StatKey | null>(null);
  const tiles: { key: StatKey; icon: ReactNode; label: string; value: string; unit: string }[] = [
    { key: 'streak', icon: <Flame size={15} />, label: 'Serie', value: String(streaks.current), unit: streaks.current === 1 ? 'Tag' : 'Tage' },
    { key: 'adherence', icon: <Target size={15} />, label: 'Plantreue', value: streaks.adherence === null ? '–' : String(Math.round(streaks.adherence * 100)), unit: '%' },
    { key: 'total', icon: <Dumbbell size={15} />, label: 'Gesamt', value: String(strength + cardio), unit: '' },
  ];

  return (
    <section className="glass mx-4 rounded-[var(--radius-card)] p-1.5">
      <div className="grid grid-cols-3 gap-1.5">
        {tiles.map((tile) => {
          const active = open === tile.key;
          return (
            <button
              key={tile.key}
              type="button"
              onClick={() => setOpen(active ? null : tile.key)}
              aria-expanded={active}
              className={cx('relative rounded-2xl px-3 py-3 text-left transition active:scale-[0.98]', active ? 'bg-glass-3' : 'hover:bg-glass-2')}
            >
              <span className="absolute right-2.5 top-2.5 text-accent">{tile.icon}</span>
              <p className="eyebrow pr-4 text-[10px] tracking-[0.06em]">{tile.label}</p>
              <p className="display tabular mt-2 text-[24px] leading-none">
                {tile.value}
                {tile.unit && <span className="ml-1 text-[12px] text-ink-3">{tile.unit}</span>}
              </p>
              <ChevronDown size={13} className={cx('absolute bottom-2.5 right-2.5 text-ink-4 transition', active && 'rotate-180 text-ink-3')} />
            </button>
          );
        })}
      </div>

      {open && (
        <div className="animate-fade-in mx-1.5 mt-1.5 border-t border-line px-1.5 pb-1.5 pt-1">
          {open === 'streak' && (
            <>
              <DetailRow label="Aktuelle Serie" value={days(streaks.current)} hint={streaks.currentSince ? `seit ${formatFull(streaks.currentSince)}` : 'noch keine laufende Serie'} />
              <DetailRow
                label="Längste Serie"
                value={days(streaks.longest)}
                hint={streaks.longestFrom && streaks.longestTo ? formatMonthRange(streaks.longestFrom, streaks.longestTo) : '–'}
              />
              <p className="pt-1.5 text-[11.5px] text-ink-3">Geplante Trainingstage am Stück – Ruhetage unterbrechen nicht.</p>
            </>
          )}
          {open === 'adherence' && (
            <>
              <DetailRow
                label="Zeitraum"
                value="letzte 4 Wochen"
                hint={streaks.adherenceFrom ? `${formatShort(streaks.adherenceFrom)} – ${formatFull(today)}` : '–'}
              />
              <DetailRow label="Erledigt" value={`${streaks.doneDays} von ${streaks.plannedDays}`} hint="geplanten Tagen" />
            </>
          )}
          {open === 'total' && (
            <>
              <DetailRow label="Krafttraining" value={String(strength)} />
              <DetailRow label="Cardio" value={String(cardio)} />
              {firstDate && <p className="pt-1.5 text-[11.5px] text-ink-3">seit {formatFull(firstDate)}</p>}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function DetailRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-[13.5px] text-ink-2">{label}</span>
      <span className="text-right">
        <span className="tabular text-[14.5px] font-semibold">{value}</span>
        {hint && <span className="block text-[11.5px] text-ink-3">{hint}</span>}
      </span>
    </div>
  );
}
