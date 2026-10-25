import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, cx, Sheet } from '../../components/ui';
import { CARDIO_TYPES, formatPace, paceMinPerKm, speedKmh, type CardioEntry, type CardioType } from '../../domain/cardio';
import { formatFull } from '../../domain/dates';
import { formatNumber } from '../../domain/format';
import { KeypadField } from '../../components/Keypad';
import { useStore } from '../../state/store';

/** Cardio-Einheit ansehen, korrigieren oder löschen. */
export function CardioSheet({ entry, onClose }: { entry: CardioEntry | null; onClose: () => void }) {
  const saveCardio = useStore((state) => state.saveCardio);
  const deleteCardio = useStore((state) => state.deleteCardio);
  const showToast = useStore((state) => state.showToast);
  const [edited, setEdited] = useState<CardioEntry | null>(entry);
  useEffect(() => setEdited(entry), [entry]);
  if (!entry || !edited) return null;

  const dirty = JSON.stringify(edited) !== JSON.stringify(entry);
  const pace = paceMinPerKm(edited);
  const speed = speedKmh(edited);

  return (
    <Sheet
      open
      onClose={onClose}
      title={CARDIO_TYPES[edited.type].label}
      footer={
        <div className="flex gap-2">
          <Button
            variant="danger"
            aria-label="Einheit löschen"
            onClick={() => {
              if (!window.confirm(`Cardio vom ${formatFull(entry.date)} löschen?`)) return;
              const removed = deleteCardio(entry.id);
              onClose();
              showToast('Einheit gelöscht.', 'default', removed ? { label: 'Rückgängig', run: () => saveCardio(removed) } : undefined);
            }}
          >
            <Trash2 size={17} />
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            disabled={!dirty || edited.durationMin <= 0}
            onClick={() => {
              saveCardio(edited);
              showToast('Einheit aktualisiert.', 'success');
              onClose();
            }}
          >
            Änderungen speichern
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-glass p-1">
        {(Object.keys(CARDIO_TYPES) as CardioType[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setEdited({ ...edited, type: key })}
            className={cx('h-9 rounded-xl text-[13px] font-semibold', edited.type === key ? 'bg-glass-3 text-ink' : 'text-ink-3')}
          >
            {CARDIO_TYPES[key].label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-col divide-y divide-line rounded-2xl border border-line bg-glass px-4">
        <Field label="Datum">
          <input
            type="date"
            value={edited.date}
            onChange={(event) => event.target.value && setEdited({ ...edited, date: event.target.value })}
            className="bg-transparent text-right text-[15px] font-semibold outline-none [color-scheme:dark]"
          />
        </Field>
        <Field label="Dauer (min)">
          <Cell label="Minuten" value={edited.durationMin} onChange={(value) => setEdited({ ...edited, durationMin: value ?? 0 })} />
        </Field>
        <Field label="Distanz (km)">
          <Cell decimal label="Km" value={edited.distanceKm} onChange={(value) => setEdited({ ...edited, distanceKm: value })} />
        </Field>
        <Field label="Ø Puls">
          <Cell label="Ø Puls" value={edited.avgHr} onChange={(value) => setEdited({ ...edited, avgHr: value })} />
        </Field>
      </div>
      <p className="mt-3 text-center text-[13px] text-ink-3">
        {edited.type === 'run' ? `Pace ${formatPace(pace)} /km` : speed === null ? 'Ø Tempo –' : `Ø ${formatNumber(speed, 1)} km/h`}
      </p>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 py-3">
      <span className="text-[14px] text-ink-2">{label}</span>
      {children}
    </label>
  );
}

function Cell({ value, onChange, decimal = false, label }: { value: number | null; onChange: (value: number | null) => void; decimal?: boolean; label?: string }) {
  return (
    <KeypadField
      value={value}
      onChange={onChange}
      decimal={decimal}
      allowEmpty
      label={label}
      className="h-9 w-20 rounded-lg border border-line bg-white/[0.04] text-[15px] font-semibold data-[active]:border-accent/60"
    />
  );
}
