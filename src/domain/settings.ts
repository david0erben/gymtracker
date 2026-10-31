import { exerciseInfo, planById, strengthDays, type EquipmentId, type ExerciseCategory, type MuscleGroup, type PlannedExercise, type TrainingPlan } from './plan';
import type { DayKey } from './types';

/**
 * Alles, was die Empfehlungen steuert, ist hier einstellbar: Trainingsziel-Profile,
 * Gewichtsabstufungen der Geräte, Regeln und das Kraftziel.
 */

export interface RepRange {
  min: number;
  max: number | null;
}

/** Wöchentliches Set-Ziel für eine Muskelgruppe (oder mehrere zusammen, z. B. die ganze Brust). */
export interface VolumeTarget {
  id: string;
  label: string;
  muscles: MuscleGroup[];
  min: number;
  max: number;
}

export interface ProgressionProfile {
  id: string;
  name: string;
  description: string;
  /** Wochenplan dieses Profils (Tage und Übungen) */
  planId?: string;
  /** 'plan' = Wiederholungsbereiche aus dem Trainingsplan, 'category' = nach Übungstyp unten */
  repSource: 'plan' | 'category';
  compound: RepRange;
  isolation: RepRange;
  /** 'plan' = Sets aus dem Plan, 'fixed' = feste Zahl, 'volume' = verteilt nach Wochenzielen */
  setsSource: 'plan' | 'fixed' | 'volume';
  sets: number;
  /** Wöchentliche Set-Ziele je Muskelgruppe (nur bei setsSource 'volume') */
  volumeTargets?: VolumeTarget[];
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
  /** Eigene Gewichtsstufe dieser Übung (sonst vom Gerät) */
  step?: number;
  /** Eigenes Startgewicht dieser Übung (sonst vom Gerät) */
  base?: number;
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
  schemaVersion: 5;
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
    planId: 'classic',
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
    planId: 'hypertrophy',
    description:
      'Eigener Wochenplan mit 4 Trainingstagen. Sets und Reps genau wie im Plan – gesteigert wird innerhalb der Range und über das Gewicht.',
    repSource: 'plan',
    compound: { min: 7, max: 10 },
    isolation: { min: 7, max: 10 },
    setsSource: 'plan',
    sets: 2,
    targetRir: 2,
    volumeTargets: [
      { id: 'chest', label: 'Chest', muscles: ['Upper Chest', 'Mid Chest', 'Lower Chest'], min: 8, max: 12 },
      { id: 'lats', label: 'Lats', muscles: ['Lats'], min: 8, max: 12 },
      { id: 'side-delts', label: 'Side Delts', muscles: ['Side Delts'], min: 8, max: 12 },
      { id: 'quads', label: 'Quads', muscles: ['Quads'], min: 8, max: 12 },
      { id: 'hamstrings', label: 'Hamstrings', muscles: ['Hamstrings'], min: 6, max: 10 },
      { id: 'upper-back', label: 'Upper Back', muscles: ['Upper Back'], min: 6, max: 10 },
      { id: 'triceps', label: 'Triceps', muscles: ['Triceps'], min: 4, max: 8 },
      { id: 'biceps', label: 'Biceps', muscles: ['Biceps'], min: 4, max: 8 },
      { id: 'rear-delts', label: 'Rear Delts', muscles: ['Rear Delts'], min: 2, max: 6 },
      { id: 'calves', label: 'Calves', muscles: ['Calves'], min: 4, max: 4 },
      { id: 'abs', label: 'Abs', muscles: ['Abs'], min: 6, max: 6 },
    ],
  },
  {
    id: 'strength',
    name: 'Maximalkraft',
    planId: 'classic',
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
    planId: 'classic',
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
    schemaVersion: 5,
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
  const version = value.schemaVersion ?? 0;
  // Ältere Profile (vor Version 5) werden durch die aktuellen ersetzt; „Individuell“ ist dein Plan und bleibt gleich
  const profiles = version >= 5 && Array.isArray(value.profiles) && value.profiles.length ? value.profiles : defaults.profiles;
  const current = version >= 2;
  const equipment = defaults.equipment.map((item) => {
    const stored = Array.isArray(value.equipment) ? value.equipment.find((entry) => entry.id === item.id) : undefined;
    // Name und Art kommen immer aus den Standards, gespeichert werden nur die Stufen
    return stored ? { ...item, step: stored.step ?? item.step, base: stored.base ?? item.base } : item;
  });
  return {
    schemaVersion: 5,
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

export function activeProfile(settings: Settings): ProgressionProfile {
  return settings.profiles.find((profile) => profile.id === settings.activeProfileId) ?? settings.profiles[0];
}

/** Wochenplan des gewählten Trainingsziels. */
export function activePlan(settings: Settings): TrainingPlan {
  return planById(activeProfile(settings).planId);
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
  return { ...(settings.exercises[name] ?? {}), ...(day ? (settings.exercises[slotKey(day, name, activePlan(settings).id)] ?? {}) : {}) };
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
  const extraSets = day ? (extraSetsMap(settings)[slotKey(day, planned.name, activePlan(settings).id)] ?? 0) : 0;

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
    base: override.base ?? equipment.base,
    bodyweight: Boolean(equipment.bodyweight),
    equipment,
    profile,
  };
}

/* ---------- Wochenvolumen: Zusatz-Sets je Muskel auf Übungen verteilen ---------- */

/** Schlüssel einer Übung an einem Trainingstag – je Plan getrennt (bisheriger Plan ohne Präfix wie früher). */
export function slotKey(day: DayKey, name: string, planId = 'classic'): string {
  return planId === 'classic' ? `${day}:${name}` : `${planId}/${day}:${name}`;
}

function baseSetsFor(planned: PlannedExercise, settings: Settings, day?: DayKey): number {
  const override = overrideFor(settings, planned.name, day);
  const profile =
    settings.profiles.find((item) => item.id === (override.profileId ?? settings.activeProfileId)) ?? settings.profiles[0];
  if (override.sets !== undefined) return override.sets;
  if (profile.setsSource === 'plan') return planned.targetSets;
  if (profile.setsSource === 'volume')
    return day ? (volumeAllocation(profile)[slotKey(day, planned.name, planById(profile.planId).id)] ?? planned.targetSets) : planned.targetSets;
  return profile.sets;
}

const allocationCache = new WeakMap<ProgressionProfile, Record<string, number>>();
const MAX_SETS_PER_EXERCISE = 4;
const BASE_SETS = 2;

/**
 * Verteilt Sets auf die Übungen deines Plans, sodass jede Muskelgruppe ihr Wochenziel erreicht
 * (angepeilt wird die Mitte der Ziel-Range, mindestens das untere Ende).
 * - Jede Übung mit Ziel-Muskel startet mit 2 Sets, höchstens 4 Sets pro Übung und Training.
 * - Fehlende Sets gehen bevorzugt an gezielte Übungen (Isolation, ein Hauptmuskel).
 * - Übungen ohne Ziel (z. B. Back Extensions) behalten die Sets aus deinem Plan.
 * - Eine Übung zählt pro Ziel nur einmal (Dips zählen für Chest und Triceps je einmal).
 */
export function volumeAllocation(profile: ProgressionProfile): Record<string, number> {
  const cached = allocationCache.get(profile);
  if (cached) return cached;
  const targets = profile.volumeTargets ?? [];
  const slots: { key: string; planned: PlannedExercise; order: number; targets: VolumeTarget[] }[] = [];
  const plan = planById(profile.planId);
  let order = 0;
  for (const day of strengthDays(plan)) {
    for (const planned of plan.days[day].exercises) {
      order += 1;
      const primary = exerciseInfo(planned.name).primary;
      slots.push({ key: slotKey(day, planned.name, plan.id), planned, order, targets: targets.filter((target) => target.muscles.some((muscle) => primary.includes(muscle))) });
    }
  }
  const sets: Record<string, number> = {};
  for (const slot of slots) sets[slot.key] = slot.targets.length ? BASE_SETS : slot.planned.targetSets;
  const volume = (target: VolumeTarget) => slots.reduce((sum, slot) => (slot.targets.includes(target) ? sum + sets[slot.key] : sum), 0);
  const aim = (target: VolumeTarget) => Math.max(target.min, Math.round((target.min + target.max) / 2));
  const specific = (a: (typeof slots)[number], b: (typeof slots)[number]) => {
    if (a.targets.length !== b.targets.length) return a.targets.length - b.targets.length;
    const categoryA = exerciseInfo(a.planned.name).category;
    const categoryB = exerciseInfo(b.planned.name).category;
    if (categoryA !== categoryB) return categoryA === 'isolation' ? -1 : 1;
    if (sets[a.key] !== sets[b.key]) return sets[a.key] - sets[b.key];
    return a.order - b.order;
  };

  // Auffüllen bis zum Ziel
  for (let round = 0; round < 300; round += 1) {
    const needs = targets.filter((target) => volume(target) < aim(target)).sort((a, b) => aim(b) - volume(b) - (aim(a) - volume(a)));
    let progressed = false;
    for (const target of needs) {
      const candidate = slots
        .filter((slot) => slot.targets.includes(target) && sets[slot.key] < MAX_SETS_PER_EXERCISE)
        .filter((slot) => slot.targets.every((other) => other === target || volume(other) < other.max))
        .sort(specific)[0];
      if (candidate) {
        sets[candidate.key] += 1;
        progressed = true;
        break;
      }
    }
    if (!progressed) break;
  }

  // Über dem Maximum? Sets dort abziehen, wo es am wenigsten anderen Zielen schadet
  for (const target of targets) {
    for (let round = 0; round < 50 && volume(target) > target.max; round += 1) {
      const candidate = slots
        .filter((slot) => slot.targets.includes(target) && sets[slot.key] > 1)
        .filter((slot) => slot.targets.every((other) => other === target || volume(other) > other.min))
        .sort((a, b) => sets[b.key] - sets[a.key] || b.order - a.order)[0];
      if (!candidate) break;
      sets[candidate.key] -= 1;
    }
  }

  allocationCache.set(profile, sets);
  return sets;
}

interface Slot {
  day: DayKey;
  planned: PlannedExercise;
  order: number;
}

function slotsFor(plan: TrainingPlan, muscle: MuscleGroup): Slot[] {
  const slots: Slot[] = [];
  let order = 0;
  for (const day of strengthDays(plan)) {
    for (const planned of plan.days[day].exercises) {
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
    const plan = activePlan(settings);
    const slots = slotsFor(plan, muscle);
    if (!slots.length) continue;
    if (amount > 0) {
      for (let index = 0; index < amount; index += 1) {
        const slot = slots[index % slots.length];
        const key = slotKey(slot.day, slot.planned.name, plan.id);
        result[key] = (result[key] ?? 0) + 1;
      }
    } else {
      for (let index = 0; index < -amount; index += 1) {
        const candidates = slots
          .map((slot) => ({ slot, key: slotKey(slot.day, slot.planned.name, plan.id) }))
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
