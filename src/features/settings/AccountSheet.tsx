import { useRef, useState } from 'react';
import { CloudDownload, Download, HardDrive, LogOut, RefreshCw, Upload } from 'lucide-react';
import { Button, cx, Sheet } from '../../components/ui';
import { CLOUD_ENABLED } from '../../data/firebase';
import { importFromLegacy, logout } from '../../data/cloud';
import { exportPayload, normalizeAppData } from '../../data/legacy';
import { todayKey } from '../../domain/dates';
import { prepareImported, useStore } from '../../state/store';

export function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const workouts = useStore((state) => state.workouts);
  const bodyweight = useStore((state) => state.bodyweight);
  const settings = useStore((state) => state.settings);
  const cardio = useStore((state) => state.cardio);
  const replaceData = useStore((state) => state.replaceData);
  const showToast = useStore((state) => state.showToast);
  const fileInput = useRef<HTMLInputElement>(null);
  const account = useStore((state) => state.account);
  const sync = useStore((state) => state.sync);
  const [busy, setBusy] = useState(false);

  const syncLabel: Record<string, string> = {
    synced: 'Synchronisiert',
    syncing: 'Synchronisiere …',
    offline: 'Offline – wird nachgeholt',
    error: sync.message ?? 'Fehler bei der Synchronisierung',
    local: 'Nur lokal',
  };

  const loadLegacy = async () => {
    setBusy(true);
    try {
      const result = await importFromLegacy();
      showToast(result.workouts || result.bodyweight ? `${result.workouts} Trainings und ${result.bodyweight} Gewichte nachgeladen.` : 'Alles schon übernommen – nichts Neues gefunden.', 'success');
    } catch {
      showToast('Nachladen hat nicht geklappt. Bist du online?', 'error');
    } finally {
      setBusy(false);
    }
  };

  const sets = workouts.reduce((sum, workout) => sum + workout.exercises.reduce((inner, exercise) => inner + exercise.sets.filter((set) => !set.drop).length, 0), 0);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(exportPayload({ workouts, bodyweight, cardio, settings }), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gym-tracker-backup-${todayKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const data = prepareImported(normalizeAppData(JSON.parse(await file.text())), settings);
      if (!data.workouts.length && !data.bodyweight.length && !data.cardio.length) {
        showToast('In der Datei wurden keine Trainingsdaten gefunden.', 'error');
        return;
      }
      if (!window.confirm(`${data.workouts.length} Trainings und ${data.bodyweight.length} Körpergewichte importieren? Deine aktuellen Daten werden dabei ersetzt.`)) return;
      replaceData(data);
      showToast(`${data.workouts.length} Trainings importiert.`, 'success');
      onClose();
    } catch {
      showToast('Die Datei konnte nicht gelesen werden.', 'error');
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Konto & Daten">
      {CLOUD_ENABLED ? (
        <div className="rounded-2xl border border-line bg-glass p-4">
          <p className="eyebrow">Angemeldet als</p>
          <p className="mt-1 truncate text-[15px] font-semibold">{account.email}</p>
          <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-2">
            <span
              className={cx(
                'h-2 w-2 rounded-full',
                sync.state === 'synced' ? 'bg-success' : sync.state === 'error' ? 'bg-danger' : sync.state === 'offline' ? 'bg-ink-3' : 'bg-accent',
              )}
            />
            {syncLabel[sync.state]}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
            Deine Daten werden automatisch zwischen iPhone und MacBook abgeglichen. Ohne Netz wird lokal gespeichert und später synchronisiert.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-glass p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/12 text-accent">
              <HardDrive size={20} />
            </div>
            <div>
              <p className="text-[15px] font-semibold">Lokale Testversion</p>
              <p className="text-[13px] text-ink-3">Daten liegen nur in diesem Browser.</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { label: 'Trainings', value: workouts.length },
          { label: 'Sets', value: sets },
          { label: 'Gewichte', value: bodyweight.length },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-line bg-glass px-3 py-3">
            <p className="eyebrow">{stat.label}</p>
            <p className="display tabular mt-1 whitespace-nowrap text-[18px]">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Button onClick={exportJson}>
          <Download size={17} /> Backup exportieren (JSON)
        </Button>
        {CLOUD_ENABLED && (
          <Button onClick={loadLegacy} disabled={busy}>
            {busy ? <RefreshCw size={17} className="animate-spin" /> : <CloudDownload size={17} />} Aus altem Tracker nachladen
          </Button>
        )}
        <Button onClick={() => fileInput.current?.click()}>
          <Upload size={17} /> Backup importieren
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importJson(file);
            event.target.value = '';
          }}
        />
        {CLOUD_ENABLED && (
          <Button
            variant="ghost"
            onClick={() => {
              onClose();
              void logout();
            }}
          >
            <LogOut size={16} /> Abmelden
          </Button>
        )}
      </div>
    </Sheet>
  );
}
