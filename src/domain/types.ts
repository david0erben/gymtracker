/**
 * Kern-Datenmodell. Bewusst kompatibel zum alten Gym Tracker (Datenversion 2):
 * alte Workouts lassen sich unverändert lesen, neue Felder sind alle optional.
 */

export type DayKey = 'monday' | 'tuesday' | 'thursday' | 'friday' | 'saturday';

export interface SetEntry {
  reps: number | null;
  /** Gewicht in kg. `null` = ohne Gewicht (Körpergewicht). */
  weight: number | null;
  /** Reps in Reserve, optional. */
  rir?: number | null;
}

export type RecommendationKind =
  | 'first'
  | 'increase'
  | 'reps'
  | 'decrease'
  | 'comeback'
  | 'deload';

/** Was beim Training empfohlen war – wird mit dem Workout gespeichert. */
export interface RecommendationSnapshot {
  kind: RecommendationKind;
  weight: number | null;
  reps: number[];
}

export interface ExerciseEntry {
  name: string;
  sets: SetEntry[];
  skipped?: boolean;
  /**
   * Kraftwerte nicht vergleichbar (anderes Gerät/Studio, Tippfehler).
   * Zählt nicht für Kraftkurve und Empfehlungen, aber weiter für Sätze pro Muskelgruppe.
   */
  excluded?: boolean;
  excludedBy?: 'auto' | 'user';
  recommendation?: RecommendationSnapshot;
}

export interface Workout {
  id: string;
  /** Lokales Datum, YYYY-MM-DD */
  date: string;
  /** ISO-Zeitstempel */
  completedAt: string;
  trainingDay: DayKey;
  trainingDayLabel: string;
  exercises: ExerciseEntry[];
}

export interface BodyweightEntry {
  id: string;
  date: string;
  weight: number;
}
