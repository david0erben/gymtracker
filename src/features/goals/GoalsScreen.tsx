import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronRight, Dumbbell, Flame, Gauge, Repeat, RotateCcw, SlidersHorizontal, Target, Trash2, TrendingUp, Zap } from 'lucide-react';
import { Button, cx, ScreenHeader, Segmented, Sheet } from '../../components/ui';
import { goalLine, strengthSeries } from '../../domain/analytics';
import { addMonths, formatFull, todayKey } from '../../domain/dates';
import { formatNumber, parseDecimal, parseInteger } from '../../domain/format';
import { DAY_KEYS, exerciseInfo, shortName, TRAINING_PLAN, type EquipmentId, type PlannedExercise } from '../../domain/plan';
import { defaultSettings, overrideFor, resolveExerciseConfig, slotKey, type ExerciseOverride, type ProgressionProfile, type Settings } from '../../domain/settings';
import type { DayKey } from '../../domain/types';
import { useStore } from '../../state/store';
import { AccountButton } from '../settings/AccountButton';
import { WeeklyVolume } from './WeeklyVolume';

const PROFILE_ICON: Record<string, ReactNode> = {
  individual: <SlidersHorizontal size={20} />,
  hypertrophy: <Dumbbell size={20} />,
  strength: <Zap size={20} />,
  endurance: <Flame size={20} />,
};

/** Übungen in Plan-Reihenfolge (einmalig) mit dem ersten Vorkommen im Plan. */
const PLANNED: PlannedExercise[] = (() => {
  const seen = new Set<string>();
  const list: PlannedExercise[] = [];
  for (const day of DAY_KEYS) {
    for (const exercise of TRAINING_PLAN[day].exercises) {
      if (seen.has(exercise.name)) continue;
      seen.add(exercise.name);
      list.push(exercise);
    }
  }
  return list;
})();

interface EditTarget {
  day: DayKey;
  planned: PlannedExercise;
}

export function GoalsScreen() {
  const settings = useStore((state) => state.settings);
  const updateSettings = useStore((state) => state.updateSettings);
  const [editExercise, setEditExercise] = useState<EditTarget | null>(null);
  const [section, setSection] = useState<'volume' | 'progression' | 'equipment'>('volume');

  const update = (patch: Partial<Settings>) => updateSettings((current) => ({ ...current, ...patch }));
  const activeProfile = settings.profiles.find((profile) => profile.id === settings.activeProfileId) ?? settings.profiles[0];

  return (
    <div className="pb-36">
      <ScreenHeader eyebrow="Planung" title="Ziele" right={<AccountButton />} />

      <div className="mb-4 px-4">
        <Segmented
          value={section}
          onChange={setSection}
          options={[
            { value: 'volume', label: 'Volumen' },
            { value: 'progression', label: 'Steigerung' },
            { value: 'equipment', label: 'Geräte' },
          ]}
        />
      </div>

      <div className="flex flex-col gap-4 px-4">
        {section === 'volume' && (
          <>
            <WeeklyVolume />
            <Section title="Pro Übung" text="Reps-Range, Sets und Gerät für jede Übung einzeln einstellen. Eigene Werte sind mit einem Punkt markiert.">
              {DAY_KEYS.map((day) => (
                <div key={day} className="mb-2 last:mb-0">
                  <p className="eyebrow mb-1 px-1">
                    {TRAINING_PLAN[day].short} · {TRAINING_PLAN[day].title}
                  </p>
                  <ul className="-mx-1">
                    {TRAINING_PLAN[day].exercises.map((planned) => {
                      const config = resolveExerciseConfig(planned, settings, day);
                      const custom = Object.keys(overrideFor(settings, planned.name, day)).length > 0;
                      return (
                        <li key={`${day}-${planned.name}`}>
                          <button
                            type="button"
                            onClick={() => setEditExercise({ day, planned })}
                            className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left hover:bg-glass-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[14px] font-medium">
                                {shortName(planned.name)}
                                {custom && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />}
                              </p>
                              <p className="text-[12px] text-ink-3">
                                {config.sets} Sets · {config.repMax === null ? `${config.repMin}+` : `${config.repMin}–${config.repMax}`} Reps · {config.equipment.name}
                              </p>
                            </div>
                            <ChevronRight size={17} className="shrink-0 text-ink-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </Section>
          </>
        )}

        {section === 'progression' && (
          <>
            <Section title="Trainingsziel" text="„Individuell“ nutzt genau deine Sets und Rep-Ranges. Die anderen drei sind Vorschläge, die für alle Übungen gelten.">
              <div className="grid grid-cols-2 gap-2">
                {settings.profiles.map((profile) => {
                  const active = profile.id === settings.activeProfileId;
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => update({ activeProfileId: profile.id })}
                      className={cx(
                        'flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-left transition active:scale-[0.98]',
                        active ? 'accent-gradient border-transparent text-on-accent shadow-[var(--shadow-glow)]' : 'border-line bg-white/[0.03] text-ink-2 hover:bg-glass-2',
                      )}
                      aria-pressed={active}
                    >
                      {PROFILE_ICON[profile.id] ?? <Target size={20} />}
                      <span className="text-[13.5px] font-semibold leading-tight">{profile.name}</span>
                    </button>
                  );
                })}
              </div>
              <ProfileEditor
                profile={activeProfile}
                onChange={(profile) => update({ profiles: settings.profiles.map((item) => (item.id === profile.id ? profile : item)) })}
              />
            </Section>

            {settings.activeProfileId === 'strength' && <GoalSection />}

            <RulesSection />
          </>
        )}

        {section === 'equipment' && (
          <Section title="Gewichtsabstufungen" text="Kleinste Gewichtsstufe pro Gerät. Gilt für alle Übungen an diesem Gerät – danach richten sich die Gewichtsempfehlungen und die −/+ Tasten.">
            <div className="flex flex-col gap-1.5">
              {settings.equipment.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white/[0.03] px-3.5 py-2">
                  <span className="flex-1 text-[14px] font-medium">{item.name}</span>
                  <label className="flex items-center gap-1 text-[12px] text-ink-3">
                    Stufe
                    <SmallNumber
                      decimal
                      value={item.step}
                      min={0.25}
                      onChange={(step) => step && update({ equipment: settings.equipment.map((entry) => (entry.id === item.id ? { ...entry, step } : entry)) })}
                    />
                    kg
                  </label>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Button
          variant="ghost"
          onClick={() => {
            if (!window.confirm('Alle Ziel- und Planungseinstellungen auf die Standardwerte zurücksetzen? Deine Trainingsdaten bleiben erhalten.')) return;
            const defaults = defaultSettings();
            updateSettings((current) => ({ ...defaults, levelShifts: current.levelShifts }));
          }}
        >
          <RotateCcw size={15} /> Einstellungen zurücksetzen
        </Button>
      </div>

      <ExerciseSheet target={editExercise} onClose={() => setEditExercise(null)} />
    </div>
  );
}

function Section({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <section className="glass rounded-[var(--radius-card)] p-4">
      <h2 className="display text-[20px]">{title}</h2>
      {text && <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{text}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Kleines Zahlenfeld, das beim Verlassen übernimmt. */
function SmallNumber({
  value,
  onChange,
  decimal = false,
  min = 0,
  placeholder = '–',
  className,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  decimal?: boolean;
  min?: number;
  placeholder?: string;
  className?: string;
}) {
  const display = value === null ? '' : formatNumber(value);
  const [text, setText] = useState(display);
  useEffect(() => setText(display), [display]);
  const commit = () => {
    if (text.trim() === '') {
      onChange(null);
      return;
    }
    const parsed = decimal ? parseDecimal(text) : parseInteger(text);
    if (parsed === null || parsed < min) setText(display);
    else onChange(parsed);
  };
  return (
    <input
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={text}
      placeholder={placeholder}
      onChange={(event) => setText(event.target.value.replace(/[^\d.,]/g, ''))}
      onBlur={commit}
      onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
      className={cx('number-input tabular h-9 w-14 rounded-xl border border-line bg-white/[0.05] text-[14px] font-semibold text-ink focus:border-accent/60', className)}
    />
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-accent' : 'bg-white/12')}
    >
      <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', checked ? 'left-[1.375rem]' : 'left-0.5')} />
    </button>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium">{label}</p>
        {hint && <p className="text-[12px] text-ink-3">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 text-[13px] text-ink-3">{children}</div>
    </div>
  );
}

function ProfileEditor({ profile, onChange }: { profile: ProgressionProfile; onChange: (profile: ProgressionProfile) => void }) {
  if (profile.id === 'individual') {
    return (
      <div className="mt-3 rounded-2xl border border-line bg-white/[0.03] px-3.5 py-3">
        <p className="text-[13px] leading-relaxed text-ink-2">{profile.description}</p>
        <p className="mt-2 text-[12.5px] text-ink-3">Einzelne Übungen änderst du unter Volumen → Pro Übung.</p>
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-2xl border border-line bg-white/[0.03] px-3.5 py-1.5">
      <p className="pt-2 text-[13px] text-ink-2">{profile.description}</p>
      <Row label="Grundübungen" hint="Reps, z. B. Bankdrücken">
        <SmallNumber value={profile.compound.min} min={1} onChange={(min) => min && onChange({ ...profile, compound: { ...profile.compound, min } })} />–
        <SmallNumber value={profile.compound.max} min={1} onChange={(max) => onChange({ ...profile, compound: { ...profile.compound, max } })} />
      </Row>
      <Row label="Isolationsübungen" hint="Reps, z. B. Curls">
        <SmallNumber value={profile.isolation.min} min={1} onChange={(min) => min && onChange({ ...profile, isolation: { ...profile.isolation, min } })} />–
        <SmallNumber value={profile.isolation.max} min={1} onChange={(max) => onChange({ ...profile, isolation: { ...profile.isolation, max } })} />
      </Row>
      <Row label="Sets" hint="pro Übung">
        <SmallNumber value={profile.sets} min={1} onChange={(sets) => sets && onChange({ ...profile, sets, setsSource: 'fixed' })} />
      </Row>
      <Row label="Ziel-RIR" hint="Reps in Reserve">
        <SmallNumber value={profile.targetRir} min={0} onChange={(targetRir) => onChange({ ...profile, targetRir })} />
      </Row>
    </div>
  );
}

function GoalSection() {
  const settings = useStore((state) => state.settings);
  const workouts = useStore((state) => state.workouts);
  const updateSettings = useStore((state) => state.updateSettings);
  const today = todayKey();
  const goal = settings.goal;

  const status = useMemo(() => {
    if (!goal) return null;
    let onTrack = 0;
    let total = 0;
    let progress = 0;
    for (const planned of PLANNED) {
      const series = strengthSeries(workouts, planned.name, settings.levelShifts[planned.name] ?? []);
      if (series.metric !== 'e1rm') continue;
      const line = goalLine(series.points, goal, today);
      if (!line) continue;
      total += 1;
      if (line.onTrack) onTrack += 1;
      progress += line.progress;
    }
    return { onTrack, total, progress: total ? progress / total : 0 };
  }, [goal, workouts, settings.levelShifts, today]);

  const setGoal = (patch: Partial<NonNullable<Settings['goal']>>) =>
    updateSettings((current) => ({ ...current, goal: { percent: 5, months: 6, startDate: today, ...(current.goal ?? {}), ...patch } }));

  return (
    <Section title="Kraftziel" text="Zum Beispiel +5 % in 6 Monaten. Das Ziel erscheint als Soll-Linie in der Analyse. Die Empfehlungen richten sich weiter nach deiner tatsächlichen Leistung.">
      {!goal ? (
        <Button variant="secondary" className="w-full" onClick={() => setGoal({})}>
          <Target size={16} /> Kraftziel festlegen
        </Button>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[15px]">
            <span className="text-ink-2">Kraft um</span>
            <SmallNumber decimal value={goal.percent} min={0.5} onChange={(percent) => percent && setGoal({ percent })} />
            <span className="text-ink-2">% steigern in</span>
            <SmallNumber value={goal.months} min={1} onChange={(months) => months && setGoal({ months })} />
            <span className="text-ink-2">Monaten</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[12.5px] text-ink-3">
            <label className="flex items-center gap-2">
              Start
              <input
                type="date"
                value={goal.startDate}
                max={today}
                onChange={(event) => event.target.value && setGoal({ startDate: event.target.value })}
                className="bg-transparent text-ink-2 outline-none [color-scheme:dark]"
              />
            </label>
            <span>Ziel bis {formatFull(addMonths(goal.startDate, goal.months))}</span>
          </div>
          {status && status.total > 0 && (
            <div className="mt-3 rounded-2xl border border-line bg-white/[0.03] p-3.5">
              <div className="flex items-center justify-between text-[13px]">
                <span className="inline-flex items-center gap-1.5 text-ink-2">
                  <TrendingUp size={15} className="text-success" /> {status.onTrack} von {status.total} Übungen im Plan
                </span>
                <span className="tabular font-semibold">{Math.round(status.progress * 100)} %</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full bg-success transition-all" style={{ width: `${Math.round(status.progress * 100)}%` }} />
              </div>
              <p className="mt-1.5 text-[11.5px] text-ink-3">Durchschnittlicher Fortschritt Richtung Ziel über alle Übungen mit Gewicht.</p>
            </div>
          )}
          <button type="button" onClick={() => updateSettings((current) => ({ ...current, goal: null }))} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-danger">
            <Trash2 size={13} /> Ziel entfernen
          </button>
        </>
      )}
    </Section>
  );
}

function RulesSection() {
  const rules = useStore((state) => state.settings.rules);
  const updateSettings = useStore((state) => state.updateSettings);
  const set = (patch: Partial<typeof rules>) => updateSettings((current) => ({ ...current, rules: { ...current.rules, ...patch } }));
  return (
    <Section title="Regeln" text="Sonderfälle, in denen die Empfehlung vom Normalfall abweicht.">
      <div className="divide-y divide-line">
        <div className="py-2">
          <div className="flex items-center gap-3">
            <Gauge size={18} className="shrink-0 text-accent-2" />
            <p className="flex-1 text-[14px] font-medium">Wiedereinstieg nach Pause</p>
            <Toggle checked={rules.comebackEnabled} onChange={(comebackEnabled) => set({ comebackEnabled })} label="Wiedereinstieg nach Pause" />
          </div>
          {rules.comebackEnabled && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[1.85rem] text-[13px] text-ink-3">
              Nach mehr als <SmallNumber value={rules.comebackDays} min={3} onChange={(comebackDays) => comebackDays && set({ comebackDays })} /> Tagen mit
              <SmallNumber value={Math.round(rules.comebackFactor * 100)} min={50} onChange={(value) => value && set({ comebackFactor: Math.min(100, value) / 100 })} /> % einsteigen
            </div>
          )}
        </div>
        <div className="py-2">
          <div className="flex items-center gap-3">
            <Repeat size={18} className="shrink-0 text-accent-2" />
            <p className="flex-1 text-[14px] font-medium">Plateau erkennen</p>
            <Toggle checked={rules.plateauEnabled} onChange={(plateauEnabled) => set({ plateauEnabled })} label="Plateau erkennen" />
          </div>
          {rules.plateauEnabled && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[1.85rem] text-[13px] text-ink-3">
              Nach <SmallNumber value={rules.plateauSessions} min={2} onChange={(plateauSessions) => plateauSessions && set({ plateauSessions })} /> Einheiten ohne Fortschritt mit
              <SmallNumber value={Math.round(rules.plateauFactor * 100)} min={50} onChange={(value) => value && set({ plateauFactor: Math.min(100, value) / 100 })} /> % neu anlaufen
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

function ExerciseSheet({ target, onClose }: { target: EditTarget | null; onClose: () => void }) {
  const settings = useStore((state) => state.settings);
  const updateSettings = useStore((state) => state.updateSettings);
  if (!target) return null;
  const { day, planned } = target;
  const config = resolveExerciseConfig(planned, settings, day);
  const info = exerciseInfo(planned.name);
  const slot = settings.exercises[slotKey(day, planned.name)] ?? {};
  const general = settings.exercises[planned.name] ?? {};

  const write = (key: string, patch: Partial<ExerciseOverride>) =>
    updateSettings((current) => {
      const next: ExerciseOverride = { ...(current.exercises[key] ?? {}), ...patch };
      for (const field of Object.keys(next) as (keyof ExerciseOverride)[]) if (next[field] === undefined) delete next[field];
      const exercises = { ...current.exercises, [key]: next };
      if (!Object.keys(next).length) delete exercises[key];
      return { ...current, exercises };
    });
  // Reps, Sets und Trainingsziel gelten nur für diesen Tag, das Gerät für die Übung insgesamt
  const setSlot = (patch: Partial<ExerciseOverride>) => write(slotKey(day, planned.name), patch);
  const setGeneral = (patch: Partial<ExerciseOverride>) => write(planned.name, patch);
  const custom = Object.keys(slot).length > 0 || Object.keys(general).length > 0;

  return (
    <Sheet open onClose={onClose} title={shortName(planned.name)}>
      <p className="text-[13px] text-ink-3">
        {TRAINING_PLAN[day].short} · {TRAINING_PLAN[day].title} · {info.primary.join(', ')} · {info.category === 'compound' ? 'Grundübung' : 'Isolationsübung'}
      </p>

      <div className="mt-4 rounded-2xl border border-line bg-white/[0.03] px-3.5 py-1">
        <Row label="Reps-Range" hint={slot.repMin !== undefined || slot.repMax !== undefined ? 'eigener Wert' : 'aus Trainingsziel'}>
          <SmallNumber value={config.repMin} min={1} onChange={(repMin) => setSlot({ repMin: repMin ?? undefined })} />–
          <SmallNumber value={config.repMax} min={1} placeholder="+" onChange={(repMax) => setSlot({ repMax })} />
        </Row>
        <Row label="Sets" hint={slot.sets !== undefined ? 'eigener Wert' : 'aus Trainingsziel'}>
          <SmallNumber value={config.baseSets} min={1} onChange={(sets) => setSlot({ sets: sets ?? undefined })} />
        </Row>
      </div>

      <p className="eyebrow mb-1.5 mt-4">Gerät</p>
      <div className="grid grid-cols-2 gap-1.5">
        {settings.equipment.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setGeneral({ equipmentId: item.id === info.equipment ? undefined : (item.id as EquipmentId) })}
            className={cx(
              'rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium transition',
              config.equipment.id === item.id ? 'border-accent/50 bg-accent/15 text-ink' : 'border-line bg-white/[0.03] text-ink-2',
            )}
          >
            {item.name}
          </button>
        ))}
      </div>

      <p className="eyebrow mb-1.5 mt-4">Trainingsziel für diese Übung</p>
      <div className="flex flex-wrap gap-1.5">
        {[{ id: undefined as string | undefined, name: 'Wie oben' }, ...settings.profiles].map((profile) => (
          <button
            key={profile.id ?? 'default'}
            type="button"
            onClick={() => setSlot({ profileId: profile.id })}
            className={cx(
              'h-9 rounded-full border px-3.5 text-[13px] font-semibold transition',
              slot.profileId === profile.id ? 'border-accent/50 bg-accent/20 text-ink' : 'border-line bg-glass text-ink-3',
            )}
          >
            {profile.name}
          </button>
        ))}
      </div>

      {custom && (
        <Button
          variant="ghost"
          className="mt-3 w-full"
          onClick={() =>
            updateSettings((current) => {
              const exercises = { ...current.exercises };
              delete exercises[slotKey(day, planned.name)];
              delete exercises[planned.name];
              return { ...current, exercises };
            })
          }
        >
          <RotateCcw size={15} /> Auf Standard zurücksetzen
        </Button>
      )}
    </Sheet>
  );
}
