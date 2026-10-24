import { daysBetween } from './dates';
import { formatKg, formatNumber } from './format';
import type { ExerciseConfig, Rules } from './settings';
import {
  fatigueDrop,
  hasLoad,
  nextStepAbove,
  nextStepBelow,
  predictedReps,
  round2,
  sameWeight,
  sessionE1rm,
  snapNearest,
  topWeight,
  type ExerciseSession,
} from './strength';
import type { RecommendationKind, RecommendationSnapshot, SetEntry } from './types';

/**
 * Empfehlungslogik nach festen Regeln (doppelte Progression):
 *
 * 1. Gleiches Gewicht in allen Sätzen, Wiederholungen von Einheit zu Einheit steigern.
 * 2. Schaffst du in allen Sätzen das obere Ende des Bereichs, steigt das Gewicht – auf das
 *    schwerste Gewicht, mit dem du laut Schätzung noch alle Sätze am unteren Ende schaffst.
 * 3. Liegt die Mehrheit der Sätze deutlich unter dem Bereich, geht das Gewicht runter.
 * 4. Sonderfälle: Wiedereinstieg nach Pause, Plateau, gemischte Gewichte, Körpergewicht.
 *
 * Schätzungen laufen über das 1RM (Epley, mit RIR falls eingetragen) und den typischen
 * Wiederholungsverlust von Satz zu Satz, gelernt aus deinen eigenen Daten.
 */

export interface PlannedSet {
  reps: number;
  weight: number | null;
}

export interface Recommendation {
  kind: RecommendationKind;
  weight: number | null;
  sets: PlannedSet[];
  /** Kurz, für die Plakette, z. B. „+2,5 kg“ */
  headline: string;
  /** Ein Satz Begründung */
  reason: string;
  /** Optionaler Zusatzhinweis */
  note?: string;
  /** Letztes Mal unterschiedliche Gewichte – Empfehlung vereinheitlicht nur */
  mixed?: boolean;
  last: ExerciseSession | null;
  daysSinceLast: number | null;
}

const MAX_SEARCH_STEPS = 40;
/** Ab diesem relativen Sprung gibt es einen Hinweis auf eine kleinere Gewichtsstufe. */
const BIG_STEP = 0.15;

export function recommend(
  sessions: ExerciseSession[],
  config: ExerciseConfig,
  rules: Rules,
  today: string,
): Recommendation {
  const n = Math.max(1, config.sets);
  const last = sessions.at(-1) ?? null;

  if (!last) {
    return {
      kind: 'first',
      weight: null,
      sets: Array.from({ length: n }, () => ({ reps: config.repMin, weight: null })),
      headline: 'Erste Einheit',
      reason: 'Noch keine Daten – trag ein, was du schaffst. Ab dann gibt es Empfehlungen.',
      last: null,
      daysSinceLast: null,
    };
  }

  const days = daysBetween(last.date, today);
  const base = { last, daysSinceLast: days };
  const repCap = config.repMax ?? Number.POSITIVE_INFINITY;
  const W = topWeight(last.sets);

  if (W === null) return bodyweightRecommendation(last, config, rules, days, n, repCap, base);

  const loaded = last.sets.filter(hasLoad);
  const repsAtW = loaded.filter((set) => sameWeight(set.weight, W)).map((set) => set.reps as number);
  const uniform = loaded.every((set) => sameWeight(set.weight, W));
  const e1rm = sessionE1rm(last.sets) as number;
  const drop = fatigueDrop(sessions);

  const predicted = (weight: number, index: number) => predictedReps(e1rm, weight) - drop * index;
  const lastSetPredicted = (weight: number) => predicted(weight, n - 1);
  const averagePredicted = (weight: number) => {
    let sum = 0;
    for (let index = 0; index < n; index += 1) sum += predicted(weight, index);
    return sum / n;
  };
  // Ziel-Reps bleiben immer innerhalb deiner Range – angepasst wird über das Gewicht
  const plannedAt = (weight: number): PlannedSet[] => {
    const sets: PlannedSet[] = [];
    for (let index = 0; index < n; index += 1) {
      const estimate = Math.floor(predicted(weight, index) + 1e-9);
      const reps = Math.min(repCap, Math.max(config.repMin, estimate));
      const previous = sets[index - 1]?.reps ?? Number.POSITIVE_INFINITY;
      sets.push({ reps: Math.min(reps, previous), weight });
    }
    return sets;
  };

  // Gewicht, das einem gleichmäßigen Training entspricht (bei gemischten Gewichten über das 1RM)
  const uniformWeight = uniform
    ? W
    : heaviestReaching(config.repMin, nextStepAbove(W, config.step, config.base), averagePredicted, config);

  // 1. Wiedereinstieg nach längerer Pause
  if (rules.comebackEnabled && days > rules.comebackDays) {
    const weight = lighter(uniformWeight, rules.comebackFactor, config);
    const reference = uniform ? fillSets(repsAtW, n, drop) : plannedAt(uniformWeight).map((set) => set.reps);
    return {
      ...base,
      kind: 'comeback',
      weight,
      sets: reference.map((reps) => ({ reps: clamp(reps, config.repMin, repCap), weight })),
      headline: 'Wiedereinstieg',
      reason: `Letzte Einheit vor ${days} Tagen – heute mit ${formatKg(weight)} (≈ ${Math.round((weight / uniformWeight) * 100)} %) wieder einsteigen.`,
    };
  }

  // 2. Plateau: mehrere Einheiten mit gleichem Gewicht ohne Fortschritt
  if (uniform && rules.plateauEnabled && isPlateau(sessions, n, rules.plateauSessions)) {
    const weight = lighter(W, rules.plateauFactor, config);
    return {
      ...base,
      kind: 'deload',
      weight,
      sets: plannedAt(weight),
      headline: 'Neuanlauf',
      reason: `Seit ${rules.plateauSessions} Einheiten kein Fortschritt bei ${formatKg(W)} – mit ${formatKg(weight)} neu anlaufen und wieder hocharbeiten.`,
    };
  }

  if (uniform) {
    const done = repsAtW.slice(0, n);
    const reps = fillSets(done, n, drop);

    // 3. Alle Sätze am oberen Ende → schwerstes Gewicht, mit dem alle Sätze noch im Bereich liegen
    if (config.repMax !== null && done.length >= n && done.every((value) => value >= (config.repMax as number))) {
      let weight = nextStepAbove(W, config.step, config.base);
      for (let i = 0; i < MAX_SEARCH_STEPS; i += 1) {
        const next = nextStepAbove(weight, config.step, config.base);
        if (lastSetPredicted(next) < config.repMin) break;
        weight = next;
      }
      const jump = (weight - W) / W;
      return {
        ...base,
        kind: 'increase',
        weight,
        sets: plannedAt(weight),
        headline: `+${formatKg(round2(weight - W))}`,
        reason: `Letztes Mal ${n === 1 ? 'das Set' : `alle ${n} Sets`} mit ${config.repMax}+ Reps bei ${formatKg(W)} geschafft – Zeit für mehr Gewicht.`,
        note:
          jump > BIG_STEP
            ? `Großer Sprung (+${Math.round(jump * 100)} %). Falls es zu schwer ist: unter Ziele eine kleinere Gewichtsstufe einstellen.`
            : undefined,
      };
    }

    // 4. Mehrheit der Sätze deutlich unter dem Bereich → leichter
    const below = reps.filter((value) => value < config.repMin - 1).length;
    if (below > n / 2) {
      const weight = heaviestReaching(config.repMin, W, averagePredicted, config);
      return {
        ...base,
        kind: 'decrease',
        weight,
        sets: plannedAt(weight),
        headline: `−${formatKg(round2(W - weight))}`,
        reason: `Bei ${formatKg(W)} lagen ${below} von ${n} Sets klar unter ${config.repMin} Reps – mit ${formatKg(weight)} sauber in den Zielbereich.`,
      };
    }

    // 5. Normalfall: gleiches Gewicht, je eine Wiederholung mehr
    const sets = reps.map((value, index) => ({
      reps: clamp(index < done.length ? value + 1 : value, config.repMin, repCap),
      weight: W,
    }));
    const allCapped = done.every((value) => value >= repCap);
    return {
      ...base,
      kind: 'reps',
      weight: W,
      sets,
      headline: allCapped ? 'Halten' : '+1 Rep',
      reason:
        done.length < n
          ? `Letztes Mal ${done.length} von ${n} Sets mit ${formatKg(W)} (${done.join(' · ')} Reps) – heute alle ${n} Sets, je ein Rep mehr.`
          : `Gleiches Gewicht wie letztes Mal (${done.join(' · ')} Reps) – heute je ein Rep mehr.`,
    };
  }

  // 6. Letztes Mal unterschiedliche Gewichte → einheitliches Gewicht über das 1RM
  const weights = [...new Set(loaded.map((set) => set.weight as number))].sort((a, b) => a - b);
  const main = mostFrequentWeight(loaded);
  const kind: RecommendationKind = uniformWeight > main + 0.01 ? 'increase' : uniformWeight < main - 0.01 ? 'decrease' : 'reps';
  return {
    ...base,
    kind,
    weight: uniformWeight,
    sets: plannedAt(uniformWeight),
    mixed: true,
    headline: 'Gleichmäßig',
    reason: `Letztes Mal unterschiedliche Gewichte (${weights.map((value) => formatNumber(value)).join(' / ')} kg) – für ${n} gleiche Sets passt ${formatKg(uniformWeight)}.`,
  };
}

function bodyweightRecommendation(
  last: ExerciseSession,
  config: ExerciseConfig,
  rules: Rules,
  days: number,
  n: number,
  repCap: number,
  base: Pick<Recommendation, 'last' | 'daysSinceLast'>,
): Recommendation {
  const reps = last.sets.map((set) => set.reps as number);
  const at = (index: number) => reps[index] ?? reps.at(-1) ?? config.repMin;

  if (rules.comebackEnabled && days > rules.comebackDays) {
    return {
      ...base,
      kind: 'comeback',
      weight: null,
      sets: Array.from({ length: n }, (_, index) => ({ reps: clamp(at(index), config.repMin, repCap), weight: null })),
      headline: 'Wiedereinstieg',
      reason: `Letzte Einheit vor ${days} Tagen – heute erstmal die Reps von damals.`,
    };
  }

  const allTop = config.repMax !== null && reps.length >= n && reps.slice(0, n).every((value) => value >= repCap);
  if (allTop && config.bodyweight) {
    const weight = round2(config.base + config.step);
    return {
      ...base,
      kind: 'increase',
      weight,
      sets: Array.from({ length: n }, () => ({ reps: config.repMin, weight })),
      headline: `+${formatKg(weight)}`,
      reason: `Alle Sets am oberen Ende (${config.repMax} Reps) – Zeit für Zusatzgewicht.`,
    };
  }

  return {
    ...base,
    kind: 'reps',
    weight: null,
    sets: Array.from({ length: n }, (_, index) => ({ reps: clamp(at(index) + 1, config.repMin, repCap), weight: null })),
    headline: '+1 Rep',
    reason: `Letztes Mal ${reps.join(' · ')} Reps – heute je ein Rep mehr.`,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Fehlende Sätze (weniger gemacht als geplant) mit dem typischen Wiederholungsverlust auffüllen. */
function fillSets(done: number[], n: number, drop: number): number[] {
  const reps = done.slice(0, n);
  while (reps.length < n) reps.push(Math.max(1, Math.round((reps.at(-1) ?? 1) - drop)));
  return reps;
}

function mostFrequentWeight(sets: SetEntry[]): number {
  const counts = new Map<number, number>();
  for (const set of sets) counts.set(set.weight as number, (counts.get(set.weight as number) ?? 0) + 1);
  let best = 0;
  let bestCount = -1;
  for (const [weight, count] of counts) {
    if (count > bestCount || (count === bestCount && weight > best)) {
      best = weight;
      bestCount = count;
    }
  }
  return best;
}

/** Leichteres Gewicht auf dem Geräteraster, mindestens eine Stufe unter `weight`. */
function lighter(weight: number, factor: number, config: ExerciseConfig): number {
  const target = snapNearest(weight * factor, config.step, config.base);
  return target < weight - 0.01 ? Math.max(0, target) : nextStepBelow(weight, config.step, config.base);
}

/**
 * Schwerstes Gewicht unterhalb von `startAbove`, bei dem die Schätzung `estimate` mindestens
 * `aim` Wiederholungen ergibt.
 */
function heaviestReaching(
  aim: number,
  startAbove: number,
  estimate: (weight: number) => number,
  config: ExerciseConfig,
): number {
  let weight = nextStepBelow(startAbove, config.step, config.base);
  for (let i = 0; i < MAX_SEARCH_STEPS && weight > config.step; i += 1) {
    if (estimate(weight) >= aim) return weight;
    weight = nextStepBelow(weight, config.step, config.base);
  }
  return Math.max(weight, config.step);
}

/**
 * Plateau: Die letzten `count` Einheiten lagen alle beim selben Gewicht wie die Einheit davor
 * und haben deren Wiederholungssumme nicht übertroffen.
 */
export function isPlateau(sessions: ExerciseSession[], n: number, count: number): boolean {
  if (count < 1 || sessions.length < count + 1) return false;
  const window = sessions.slice(-(count + 1));
  const W = topWeight(window[0].sets);
  if (W === null) return false;
  const totals: number[] = [];
  for (const session of window) {
    if (!sameWeight(topWeight(session.sets), W)) return false;
    const reps = session.sets
      .filter((set) => hasLoad(set) && sameWeight(set.weight, W))
      .slice(0, n)
      .map((set) => set.reps as number);
    if (reps.length < n) return false;
    totals.push(reps.reduce((sum, value) => sum + value, 0));
  }
  const [reference, ...rest] = totals;
  return rest.every((total) => total <= reference);
}

export function snapshotOf(recommendation: Recommendation): RecommendationSnapshot {
  return {
    kind: recommendation.kind,
    weight: recommendation.weight,
    reps: recommendation.sets.map((set) => set.reps),
  };
}
