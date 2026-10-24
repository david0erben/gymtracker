import { DAY_KEYS, exerciseInfo, TRAINING_PLAN, type EquipmentId, type ExerciseCategory, type MuscleGroup, type PlannedExercise } from './plan';
import type { DayKey } from './types';

/**
 * Alles, was die Empfehlungen steuert, ist hier einstellbar: Trainingsziel-Profile,
 * Gewichtsabstufungen der Geräte, Regeln und das Kraftziel.
 */

export interface RepRange {
  min: number;
  max: number | null;
}

export interface ProgressionProfile {
  id: string;
  name: string;
  description: string;
  /** 'plan' = Wiederholungsbereiche aus dem Trainingsplan, 'category' = nach Übungstyp unten */
  repSource: 'plan' | 'category';
  compound: RepRange;
  isolation: RepRange;
  /** 'plan' = Satzzahl aus dem Trainingsplan, sonst feste Satzzahl */
  setsSource: 'plan' | 'fixed';
  sets: number;
  /** Ziel-RIR (nur Anzeige/Hinweis, optional) */
  targetRir: number | null;
}

export interface Equipment {
  id: EquipmentId;
  name: string;
  /** kleinste Gewichtsstufe in kg */
  step: number;
  /** Startgewicht des Rasters, z. B. 1,25 kg bei Kabelzügen mit Zusatzgewicht */
  base: number;
  /** Übung ohne Gewicht; Gewicht = Zusatzgewicht */
  bodyweight?: boolean;
}

export interface ExerciseOverride {
  profileId?: string;
  equipmentId?: EquipmentId;
  repMin?: number;
  repMax?: number | null;
  sets?: number;
  step?: number;
}

export interface Rules {
  /** Nach so vielen Tagen Pause gilt eine Übung als Wiedereinstieg */
  comebackDays: number;
  /** Faktor auf das letzte Gewicht beim Wiedereinstieg */
  comebackFactor: number;
  comebackEnabled: boolean;
  /** So viele Einheiten ohne Fortschritt gelten als Plateau */
  plateauSessions: number;
  plateauFactor: number;
  plateauEnabled: boolean;
  /** Abweichung, ab der ein Wert als Ausreißer gilt (0,3 = 30 %) */
  outlierThreshold: number;
}

export interface StrengthGoal {
  /** Ziel in Prozent, z. B. 5 */
  percent: number;
  months: number;
  /** YYYY-MM-DD */
  startDate: string;
}

export interface Settings {
  schemaVersion: 2;
  activeProfileId: string;
  profiles: ProgressionProfile[];
  equipment: Equipment[];
  exercises: Record<string, ExerciseOverride>;
  rules: Rules;
  goal: StrengthGoal | null;
  /**
   * Dauerhafte Gerätewechsel je Übung (Datum der ersten Einheit am neuen Gerät).
   * Die Kraftkurve rechnet ältere Werte auf das neue Niveau um.
   */
  levelShifts: Record<string, string[]>;
  /** Zusätzliche (oder weniger) Sets pro Woche je Muskel – nur wenn du das selbst einstellst, z. B. { Biceps: 2 } */
  volumeExtras: Partial<Record<MuscleGroup, number>>;
}

export const DEFAULT_PROFILES: ProgressionProfile[] = [
  {
    id: 'individual',
    name: 'Individuell',
    description: 'Deine eigenen Sets und Rep-Ranges aus dem Plan – genau so, wie du sie gewählt hast. Gesteigert wird nur innerhalb der Range und über das Gewicht.',
    repSource: 'plan',
    compound: { min: 6, max: 12 },
    isolation: { min: 10, max: 15 },
    setsSource: 'plan',
    sets: 3,
    targetRir: 2,
  },
  {
    id: 'hypertrophy',
    name: 'Hypertrophie',
    description: 'Vorschlag für Muskelaufbau: 3 Sets, Grundübungen 6–10 Reps, Isolationsübungen 10–15 Reps, 1–3 Reps im Tank.',
    repSource: 'category',
    compound: { min: 6, max: 10 },
    isolation: { min: 10, max: 15 },
    setsSource: 'fixed',
    sets: 3,
    targetRir: 2,
  },
  {
    id: 'strength',
    name: 'Maximalkraft',
    description: 'Vorschlag für Maximalkraft: 4 Sets, Grundübungen 3–6 Reps, Isolationsübungen 6–10 Reps, lange Pausen.',
    repSource: 'category',
    compound: { min: 3, max: 6 },
    isolation: { min: 6, max: 10 },
    setsSource: 'fixed',
    sets: 4,
    targetRir: 1,
  },
  {
    id: 'endurance',
    name: 'Kraftausdauer',
    description: 'Vorschlag für Kraftausdauer: 3 Sets, Grundübungen 12–20 Reps, Isolationsübungen 15–25 Reps, kurze Pausen.',
    repSource: 'category',
    compound: { min: 12, max: 20 },
    isolation: { min: 15, max: 25 },
    setsSource: 'fixed',
    sets: 3,
    targetRir: 2,
  },
];

export const DEFAULT_EQUIPMENT: Equipment[] = [
  { id: 'dumbbell', name: 'Dumbbells', step: 2.5, base: 0 },
  { id: 'barbell', name: 'Barbell', step: 2.5, base: 0 },
  { id: 'smith', name: 'Smith Machine', step: 2.5, base: 0 },
  { id: 'cable', name: 'Cable', step: 1.25, base: 0 },
  { id: 'machine', name: 'Machine (Stack)', step: 5, base: 0 },
  { id: 'plates', name: 'Machine (Plates)', step: 5, base: 0 },
  { id: 'bodyweight', name: 'Bodyweight (+ Load)', step: 2.5, base: 0, bodyweight: true },
];

export const DEFAULT_RULES: Rules = {
  comebackDays: 14,
  comebackFactor: 0.9,
  comebackEnabled: true,
  plateauSessions: 3,
  plateauFactor: 0.9,
  plateauEnabled: true,
  outlierThreshold: 0.3,
};

export function defaultSettings(): Settings {
  return {
    schemaVersion: 2,
    activeProfileId: 'individual',
    profiles: DEFAULT_PROFILES.map((profile) => ({ ...profile })),
    equipment: DEFAULT_EQUIPMENT.map((item) => ({ ...item })),
    exercises: {},
    rules: { ...DEFAULT_RULES },
    goal: null,
    levelShifts: {},
    volumeExtras: {},
  };
}

/** Ergänzt fehlende Felder (z. B. nach App-Updates), ohne Nutzerwerte zu überschreiben. */
export function normalizeSettings(raw: unknown): Settings {
  const defaults = defaultSettings();
  if (!raw || typeof raw !== 'object') return defaults;
  const value = raw as Partial<Settings> & { schemaVersion?: number };
  // Ab Version 2 gibt es „Individuell“ als Standard – ältere Profile werden ersetzt
  const current = value.schemaVersion === 2;
  const profiles = current && Array.isArray(value.profiles) && value.profiles.length ? value.profiles : defaults.profiles;
  const equipment = defaults.equipment.map((item) => {
    const stored = Array.isArray(value.equipment) ? value.equipment.find((entry) => entry.id === item.id) : undefined;
    // Name und Art kommen immer aus den Standards, gespeichert werden nur die Stufen
    return stored ? { ...item, step: stored.step ?? item.step, base: stored.base ?? item.base } : item;
  });
  return {
    schemaVersion: 2,
    activeProfileId: current && profiles.some((profile) => profile.id === value.activeProfileId)
      ? (value.activeProfileId as string)
      : 'individual',
    profiles,
    equipment,
    exercises: value.exercises && typeof value.exercises === 'object' ? value.exercises : {},
    rules: { ...defaults.rules, ...(value.rules ?? {}) },
    goal: value.goal ?? null,
    levelShifts: value.levelShifts && typeof value.levelShifts === 'object' ? value.levelShifts : {},
    volumeExtras: value.volumeExtras && typeof value.volumeExtras === 'object' ? value.volumeExtras : {},
  };
}

/** Effektive Einstellungen einer Übung nach Profil, Plan und Überschreibungen. */
export interface ExerciseConfig {
  name: string;
  category: ExerciseCategory;
  repMin: number;
  repMax: number | null;
  sets: number;
  /** Sets laut Plan/Trainingsziel, ohne Zusatz-Sets aus dem Wochenvolumen */
  baseSets: number;
  /** Zusatz-Sets aus dem Wochenvolumen (kann auch negativ sein) */
  extraSets: number;
  targetRir: number | null;
  step: number;
  base: number;
  bodyweight: boolean;
  equipment: Equipment;
  profile: ProgressionProfile;
}

/**
 * Einstellungen einer Übung: Gerät gilt für die Übung insgesamt (Schlüssel = Name),
 * Reps, Sets und Trainingsziel können pro Trainingstag abweichen (Schlüssel = „tag:Name“).
 */
export function overrideFor(settings: Settings, name: string, day?: DayKey): ExerciseOverride {
  return { ...(settings.exercises[name] ?? {}), ...(day ? (settings.exercises[slotKey(day, name)] ?? {}) : {}) };
}

export function resolveExerciseConfig(planned: PlannedExercise, settings: Settings, day?: DayKey): ExerciseConfig {
  const info = exerciseInfo(planned.name);
  const override = overrideFor(settings, planned.name, day);
  const profile =
    settings.profiles.find((item) => item.id === (override.profileId ?? settings.activeProfileId)) ??
    settings.profiles[0];
  const equipment =
    settings.equipment.find((item) => item.id === (override.equipmentId ?? info.equipment)) ??
    settings.equipment[0];

  const categoryRange = info.category === 'compound' ? profile.compound : profile.isolation;
  const range = profile.repSource === 'plan' ? planned.repRange : categoryRange;

  const baseSets = baseSetsFor(planned, settings, day);
  const extraSets = day ? (extraSetsMap(settings)[slotKey(day, planned.name)] ?? 0) : 0;

  return {
    name: planned.name,
    category: info.category,
    repMin: override.repMin ?? range.min,
    repMax: override.repMax !== undefined ? override.repMax : range.max,
    sets: Math.max(1, baseSets + extraSets),
    baseSets,
    extraSets,
    targetRir: profile.targetRir,
    step: override.step ?? equipment.step,
    base: equipment.base,
    bodyweight: Boolean(equipment.bodyweight),
    equipment,
    profile,
  };
}

/* ---------- Wochenvolumen: Zusatz-Sets je Muskel auf Übungen verteilen ---------- */

export function slotKey(day: DayKey, name: string): string {
  return `${day}:${name}`;
}

function baseSetsFor(planned: PlannedExercise, settings: Settings, day?: DayKey): number {
  const override = overrideFor(settings, planned.name, day);
  const profile =
    settings.profiles.find((item) => item.id === (override.profileId ?? settings.activeProfileId)) ?? settings.profiles[0];
  return override.sets ?? (profile.setsSource === 'plan' ? planned.targetSets : profile.sets);
}

interface Slot {
  day: DayKey;
  planned: PlannedExercise;
  order: number;
}

function slotsFor(muscle: MuscleGroup): Slot[] {
  const slots: Slot[] = [];
  let order = 0;
  for (const day of DAY_KEYS) {
    for (const planned of TRAINING_PLAN[day].exercises) {
      order += 1;
      if (exerciseInfo(planned.name).primary.includes(muscle)) slots.push({ day, planned, order });
    }
  }
  // Gezielte Übungen zuerst: Isolation vor Grundübung, wenige Hauptmuskeln vor vielen, dann Planreihenfolge
  return slots.sort((a, b) => {
    const infoA = exerciseInfo(a.planned.name);
    const infoB = exerciseInfo(b.planned.name);
    if (infoA.category !== infoB.category) return infoA.category === 'isolation' ? -1 : 1;
    if (infoA.primary.length !== infoB.primary.length) return infoA.primary.length - infoB.primary.length;
    return a.order - b.order;
  });
}

const extrasCache = new WeakMap<Settings, Record<string, number>>();

/**
 * Verteilt gewünschte Zusatz-Sets pro Woche reihum auf die Übungen, in denen der Muskel
 * Hauptmuskel ist. „Biceps +2“ → je +1 Set bei den zwei gezieltesten Biceps-Übungen.
 * Weniger Sets werden bei den Übungen mit den meisten Sets abgezogen, nie unter 1 Set.
 */
export function extraSetsMap(settings: Settings): Record<string, number> {
  const cached = extrasCache.get(settings);
  if (cached) return cached;
  const result: Record<string, number> = {};
  for (const [muscle, amount] of Object.entries(settings.volumeExtras ?? {}) as [MuscleGroup, number][]) {
    if (!amount) continue;
    const slots = slotsFor(muscle);
    if (!slots.length) continue;
    if (amount > 0) {
      for (let index = 0; index < amount; index += 1) {
        const slot = slots[index % slots.length];
        const key = slotKey(slot.day, slot.planned.name);
        result[key] = (result[key] ?? 0) + 1;
      }
    } else {
      for (let index = 0; index < -amount; index += 1) {
        const candidates = slots
          .map((slot) => ({ slot, key: slotKey(slot.day, slot.planned.name) }))
          .map((item) => ({ ...item, total: baseSetsFor(item.slot.planned, settings, item.slot.day) + (result[item.key] ?? 0) }))
          .filter((item) => item.total > 1)
          .sort((a, b) => b.total - a.total);
        if (!candidates.length) break;
        result[candidates[0].key] = (result[candidates[0].key] ?? 0) - 1;
      }
    }
  }
  extrasCache.set(settings, result);
  return result;
}
