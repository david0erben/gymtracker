import { useMemo, useState } from 'react';
import { Check, Minus, Plus, Scale, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { cx, EmptyState, ScreenHeader, Segmented } from '../../components/ui';
import { inRange, rangeStart, type Range } from '../../domain/analytics';
import { addDays, formatFull, parseDateKey, relativeDay, todayKey } from '../../domain/dates';
import { formatNumber, parseDecimal } from '../../domain/format';
import { round2 } from '../../domain/strength';
import { useStore } from '../../state/store';
import { TrendChart } from '../analytics/charts';
import { AccountButton } from '../settings/AccountButton';

export function BodyScreen() {
  const entries = useStore((state) => state.bodyweight);
  const addBodyweight = useStore((state) => state.addBodyweight);
  const deleteBodyweight = useStore((state) => state.deleteBodyweight);
  const showToast = useStore((state) => state.showToast);
  const today = todayKey();
  const last = entries.at(-1);

  const [date, setDate] = useState(today);
  const [text, setText] = useState(last ? formatNumber(last.weight) : '');
  const [range, setRange] = useState<Range>('1y');

  const value = parseDecimal(text);
  const step = (delta: number) => {
    const base = value ?? last?.weight ?? 80;
    setText(formatNumber(round2(Math.max(20, base + delta))));
  };

  const save = () => {
    if (value === null || value < 20 || value > 400) {
      showToast('Bitte ein gültiges Gewicht eingeben, z. B. 82,5.', 'error');
      return;
    }
    addBodyweight(date, value);
    showToast(`${formatNumber(value)} kg gespeichert.`, 'success');
  };

  const visible = useMemo(() => inRange(entries, rangeStart(range, today)), [entries, range, today]);
  const chartData = visible.map((entry) => ({ t: parseDateKey(entry.date).getTime(), value: entry.weight }));
  const reference = entries.filter((entry) => entry.date <= addDays(today, -30)).at(-1);
  const delta30 = last && reference && last.date > addDays(today, -30) ? last.weight - reference.weight : null;
  const deltaRange = visible.length >= 2 ? visible.at(-1)!.weight - visible[0].weight : null;

  return (
    <div className="pb-36">
      <ScreenHeader eyebrow="Körpergewicht" title="Körper" right={<AccountButton />} />

      <section className="glass mx-4 rounded-[var(--radius-card)] p-4">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Neuer Eintrag</p>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(event) => event.target.value && setDate(event.target.value)}
            className="rounded-lg bg-transparent text-right text-[13px] font-medium text-ink-2 outline-none [color-scheme:dark]"
            aria-label="Datum"
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={() => step(-0.1)} aria-label="0,1 kg weniger" className="flex h-14 w-12 items-center justify-center rounded-2xl border border-line bg-white/[0.04] text-ink-2 active:scale-95">
            <Minus size={18} />
          </button>
          <div className="flex h-14 flex-1 items-center justify-center rounded-2xl border border-line bg-white/[0.04] focus-within:border-accent/60">
            <input
              inputMode="decimal"
              aria-label="Körpergewicht in kg"
              value={text}
              placeholder="82,5"
              onChange={(event) => setText(event.target.value.replace(/[^\d.,]/g, ''))}
              onKeyDown={(event) => event.key === 'Enter' && save()}
              className="number-input display tabular w-28 text-[28px]"
            />
            <span className="text-[15px] font-semibold text-ink-3">kg</span>
          </div>
          <button type="button" onClick={() => step(0.1)} aria-label="0,1 kg mehr" className="flex h-14 w-12 items-center justify-center rounded-2xl border border-line bg-white/[0.04] text-ink-2 active:scale-95">
            <Plus size={18} />
          </button>
        </div>
        <button
          type="button"
          onClick={save}
          aria-label="Körpergewicht speichern"
          className="accent-gradient mt-3 flex h-13 w-full items-center justify-center rounded-2xl shadow-[var(--shadow-glow)] transition active:scale-[0.98]"
        >
          <Check size={26} strokeWidth={3} />
        </button>
      </section>

      {entries.length === 0 ? (
        <EmptyState icon={<Scale size={24} />} title="Noch keine Einträge" text="Trag dein Gewicht regelmäßig ein, um den Verlauf zu sehen." />
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 px-4">
            <Stat label="Aktuell" value={last ? `${formatNumber(last.weight)} kg` : '–'} hint={last ? relativeDay(last.date, today) : undefined} />
            <Stat label="30 Tage" value={delta30 === null ? '–' : `${delta30 > 0 ? '+' : ''}${formatNumber(delta30, 1)} kg`} trend={delta30} />
            <Stat label="Zeitraum" value={deltaRange === null ? '–' : `${deltaRange > 0 ? '+' : ''}${formatNumber(deltaRange, 1)} kg`} trend={deltaRange} />
          </div>

          <section className="glass mx-4 mt-4 rounded-[var(--radius-card)] p-4">
            <Segmented
              value={range}
              onChange={setRange}
              options={[
                { value: '3m', label: '3 M' },
                { value: '6m', label: '6 M' },
                { value: '1y', label: '1 J' },
                { value: 'all', label: 'Alle' },
              ]}
            />
            <div className="-mx-2 mt-3">
              {chartData.length >= 2 ? <TrendChart data={chartData} unit="kg" label="Körpergewicht" /> : <p className="px-2 py-10 text-center text-[13px] text-ink-3">Zu wenige Einträge im Zeitraum.</p>}
            </div>
          </section>

          <section className="glass mx-4 mt-4 rounded-[var(--radius-card)] p-2">
            <p className="eyebrow px-3 pb-1 pt-3">Alle Einträge</p>
            <ul>
              {[...entries].reverse().map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 rounded-2xl px-3 py-2">
                  <span className="flex-1 text-[14px] text-ink-2">{formatFull(entry.date)}</span>
                  <span className="tabular text-[15px] font-semibold">{formatNumber(entry.weight)} kg</span>
                  <button
                    type="button"
                    aria-label={`Eintrag vom ${formatFull(entry.date)} löschen`}
                    onClick={() => {
                      const removed = deleteBodyweight(entry.id);
                      showToast('Eintrag gelöscht.', 'default', removed ? { label: 'Rückgängig', run: () => addBodyweight(removed.date, removed.weight) } : undefined);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-4 hover:bg-glass-2 hover:text-danger"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint, trend }: { label: string; value: string; hint?: string; trend?: number | null }) {
  return (
    <div className="glass rounded-2xl px-3 py-3">
      <p className="eyebrow">{label}</p>
      <p className="tabular mt-1 flex items-center gap-1 whitespace-nowrap text-[16px] font-semibold">
        {trend !== undefined && trend !== null && trend !== 0 && (trend > 0 ? <TrendingUp size={14} className="text-ink-3" /> : <TrendingDown size={14} className="text-ink-3" />)}
        <span className={cx(trend === undefined && 'display text-[18px]')}>{value}</span>
      </p>
      {hint && <p className="mt-0.5 text-[11.5px] text-ink-3">{hint}</p>}
    </div>
  );
}
