import { daysBetween } from './dates';
import { formatKg, formatNumber } from './format';
import type { ExerciseConfig, Rules } from './settings';
import {
  fatigueDrop,
  firstStep,
  hasLoad,
  median,
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
 * Empfehlungslogik nach festen Regeln (doppelte Progression), die sich an deinem Verlauf orientiert:
 *
 * 1. Fortschritt muss nicht in jeder Einheit sein. Eine neue Bestleistung wird erst bestätigt,
 *    danach geht es weiter – wie oft, lernt die Logik daraus, ob du Steigerungen bisher gehalten hast.
 *    Eine auffällig starke Einheit („guter Tag“) wird immer erst bestätigt.
 * 2. Steigerungen kommen in der Größe, die zu dir passt: dein typischer Zuwachs pro Einheit,
 *    verteilt auf die schwächsten Sätze.
 * 3. Schaffst du in allen Sätzen das obere Ende des Bereichs, steigt das Gewicht. Packst du das neue
 *    Gewicht laut Schätzung nicht in allen Sätzen, wird Satz für Satz umgestellt: erst ein Satz
 *    schwerer, die übrigen bleiben beim alten Gewicht.
 * 4. Liegt die Mehrheit der Sätze deutlich unter dem Bereich, geht das Gewicht runter.
 * 5. Sonderfälle: Wiedereinstieg nach Pause, Plateau, stark gemischte Gewichte, Körpergewicht.
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
/** Bis zu diesem Gewichtsunterschied gelten Sätze als „Satz für Satz umstellen“. */
const MAX_RAMP_SPREAD = 0.25;
/** Ab so vielen Reps mehr pro Satz gilt eine Einheit als auffällig stark. */
const SPIKE_REPS = 1.5;
/** Ab so vielen Steigerungen im Verlauf wird daraus gelernt. */
const MIN_SAMPLES = 4;
const EPS = 1e-6;

/** Leistung pro Satz: Reps × Gewicht (ohne Gewicht zählen die Reps). */
function setLevel(session: ExerciseSession, n: number): number {
  const sets = session.sets.slice(0, n);
  const total = sets.reduce((sum, set) => sum + (set.reps ?? 0) * (set.weight && set.weight > 0 ? set.weight : 1), 0);
  return sets.length ? total / sets.length : 0;
}

const sessionTop = (session: ExerciseSession, n: number) => topWeight(session.sets.slice(0, n));

/** Wie oft hast du eine Steigerung beim nächsten Mal gehalten? */
function keptGains(sessions: ExerciseSession[], n: number): { jumps: number; kept: number } {
  const recent = sessions.slice(-16);
  let jumps = 0;
  let kept = 0;
  for (let index = 1; index < recent.length - 1; index += 1) {
    const [before, level, after] = [recent[index - 1], recent[index], recent[index + 1]];
    const top = sessionTop(level, n);
    if (!sameWeight(sessionTop(before, n), top) || !sameWeight(sessionTop(after, n), top)) continue;
    if (setLevel(level, n) <= setLevel(before, n) + EPS) continue;
    jumps += 1;
    if (setLevel(after, n) >= setLevel(level, n) - EPS) kept += 1;
  }
  return { jumps, kept };
}

/** Dein typischer Zuwachs in Reps pro Einheit beim selben Gewicht – mindestens 1, höchstens 1 pro Satz. */
function typicalGain(sessions: ExerciseSession[], n: number): number {
  const recent = sessions.slice(-12);
  const total = (session: ExerciseSession) => session.sets.slice(0, n).reduce((sum, set) => sum + (set.reps ?? 0), 0);
  const gains: number[] = [];
  for (let index = 1; index < recent.length; index += 1) {
    if (!sameWeight(sessionTop(recent[index - 1], n), sessionTop(recent[index], n))) continue;
    const gain = total(recent[index]) - total(recent[index - 1]);
    if (gain > 0) gains.push(gain);
  }
  if (gains.length < 3) return 1;
  return clamp(Math.round(median(gains) as number), 1, n);
}

/** Durchschnittliches RIR der Einheit – nur wenn es in allen Sätzen eingetragen wurde. */
function averageRir(session: ExerciseSession, n: number): number | null {
  const sets = session.sets.slice(0, n);
  if (!sets.length || sets.some((set) => set.rir === null || set.rir === undefined)) return null;
  return sets.reduce((sum, set) => sum + (set.rir as number), 0) / sets.length;
}

interface Tempo {
  /** diese Einheit erst bestätigen, bevor es weitergeht */
  hold: boolean;
  /** auffällig starke Einheit */
  spike: boolean;
  /** erste Einheit mit diesem Gewicht */
  fresh: boolean;
  /** letztes Mal weniger als zuvor */
  dip: boolean;
  /** laut RIR war noch Luft */
  easy: boolean;
  /** so oft muss ein neues Niveau bestätigt werden */
  needed: number;
  /** Reps, um die heute gesteigert wird */
  gain: number;
  jumps: number;
  kept: number;
}

/** Steigern oder erst bestätigen? Entscheidet die letzte Einheit im Vergleich zu deinem Verlauf. */
function tempoOf(sessions: ExerciseSession[], n: number, config: ExerciseConfig): Tempo {
  const last = sessions.at(-1) as ExerciseSession;
  const top = sessionTop(last, n);
  const peers: ExerciseSession[] = [];
  for (let index = sessions.length - 2; index >= 0 && peers.length < 4; index -= 1) {
    if (!sameWeight(sessionTop(sessions[index], n), top)) break;
    peers.push(sessions[index]);
  }

  const level = setLevel(last, n);
  const best = peers.length ? Math.max(...peers.map((session) => setLevel(session, n))) : null;
  const fresh = peers.length === 0 && sessions.length > 1;
  const newBest = fresh || (best !== null && level > best + EPS);
  const repeats = peers.filter((session) => setLevel(session, n) >= level - EPS).length;
  const spike = best !== null && (level - best) / (top ?? 1) >= SPIKE_REPS;
  const dip = best !== null && level < best - EPS;

  const { jumps, kept } = keptGains(sessions, n);
  const rate = kept / Math.max(1, jumps);
  let needed = jumps >= MIN_SAMPLES ? (rate >= 0.8 ? 0 : rate >= 0.4 ? 1 : 2) : 1;

  const rir = averageRir(last, n);
  const easy = rir !== null && rir >= (config.targetRir ?? 2) + 1;
  if (easy) needed = 0;
  else if (spike || (rir !== null && rir < 0.5 && newBest)) needed = Math.max(needed, 1);

  const hold = sessions.length > 1 && repeats < needed && (newBest || needed > 1);
  return { hold, spike: spike && !easy, fresh, dip, easy, needed, gain: typicalGain(sessions, n), jumps, kept };
}

function learnedNote(tempo: Tempo): string | undefined {
  if (tempo.jumps < MIN_SAMPLES) return undefined;
  return `Aus deinem Verlauf: ${tempo.kept} von ${tempo.jumps} Steigerungen hast du beim nächsten Mal gehalten.`;
}

/** Verteilt zusätzliche Reps auf die schwächsten Sätze, ohne die Obergrenze zu überschreiten. */
function addReps(reps: number[], amount: number, cap: number, eligible: number[] = reps.map((_, index) => index)): number[] {
  const result = [...reps];
  for (let added = 0; added < amount; added += 1) {
    const open = eligible.filter((index) => result[index] < cap);
    if (!open.length) break;
    const weakest = open.reduce((low, index) => (result[index] < result[low] ? index : low), open[0]);
    result[weakest] += 1;
  }
  return result;
}

const sumOf = (values: number[]) => values.reduce((sum, value) => sum + value, 0);
const repsLabel = (count: number) => (count === 1 ? '+1 Rep' : `+${count} Reps`);

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
  const loaded = last.sets.filter(hasLoad);
  const working = loaded.slice(0, n);
  const W = topWeight(working);

  if (W === null) return bodyweightRecommendation(sessions, config, rules, days, n, repCap, base);

  const repsAtW = working.filter((set) => sameWeight(set.weight, W)).map((set) => set.reps as number);
  const uniform = working.every((set) => sameWeight(set.weight, W));
  const e1rm = sessionE1rm(last.sets) as number;
  const drop = fatigueDrop(sessions);
  const tempo = tempoOf(sessions, n, config);

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

  /** Gewicht steigern: alle Sätze, wenn es laut Schätzung reicht, sonst erstmal nur die ersten. */
  const increase = (reps: number[], reason: string): Recommendation => {
    let weight = nextStepAbove(W, config.step, config.base);
    const partial = n > 1 && lastSetPredicted(weight) < config.repMin;
    if (!partial) {
      for (let i = 0; i < MAX_SEARCH_STEPS; i += 1) {
        const next = nextStepAbove(weight, config.step, config.base);
        if (lastSetPredicted(next) < config.repMin) break;
        weight = next;
      }
    }
    let heavy = n;
    if (partial) {
      heavy = 0;
      while (heavy < n - 1 && predicted(weight, heavy) >= config.repMin) heavy += 1;
      heavy = Math.max(1, heavy);
    }
    const sets = [
      ...plannedAt(weight).slice(0, heavy),
      ...reps.slice(heavy).map((value) => ({ reps: clamp(value, config.repMin, repCap), weight: W })),
    ];
    const jump = (weight - W) / W;
    const big = `Großer Sprung (+${Math.round(jump * 100)} %). Falls es zu schwer ist: unter Ziele eine kleinere Gewichtsstufe einstellen.`;
    const rest = n - heavy === 1 ? 'Der letzte Satz bleibt' : `Die übrigen ${n - heavy} Sätze bleiben`;
    return {
      ...base,
      kind: 'increase',
      weight,
      sets,
      headline: `+${formatKg(round2(weight - W))}`,
      reason,
      note: jump > BIG_STEP ? big : partial ? `${rest} erstmal bei ${formatKg(W)} – so stellst du Satz für Satz um.` : undefined,
    };
  };

  /** Muster mit leicht unterschiedlichen Gewichten behalten und Satz für Satz umstellen. */
  const rampRecommendation = (): Recommendation => {
    const pattern: PlannedSet[] = working.map((set) => ({ reps: clamp(set.reps as number, config.repMin, repCap), weight: set.weight }));
    while (pattern.length < n) pattern.push({ ...(pattern.at(-1) as PlannedSet) });
    const raw = pattern.map((_, index) => working[index]?.reps ?? pattern[index].reps) as number[];
    const heavy = pattern.flatMap((set, index) => (sameWeight(set.weight, W) ? [index] : []));
    const heavyReps = heavy.map((index) => raw[index]);
    const list = working.map((set) => `${set.reps} × ${formatNumber(set.weight)}`).join(' · ');
    const next = pattern.findIndex((set) => !sameWeight(set.weight, W));
    const previousWeight = (pattern[next] as PlannedSet).weight as number;

    // Das schwerere Gewicht war klar zu viel → wieder beim leichteren ansetzen
    if (heavyReps.some((reps) => reps < config.repMin - 1)) {
      const sets = pattern.map((set, index) =>
        sameWeight(set.weight, W) ? { reps: clamp(Math.floor(predicted(previousWeight, index) + 1e-9), config.repMin, repCap), weight: previousWeight } : set,
      );
      return {
        ...base,
        kind: 'decrease',
        weight: previousWeight,
        sets,
        headline: `−${formatKg(round2(W - previousWeight))}`,
        reason: `${formatKg(W)} lag klar unter ${config.repMin} Reps (${list}) – erstmal wieder ${formatKg(previousWeight)} sicher machen.`,
      };
    }

    // Die Umstellung ist schon behutsam – bestätigt wird hier nur nach einem Ausreißer
    if (tempo.hold && (tempo.spike || tempo.needed > 1)) {
      return {
        ...base,
        kind: 'hold',
        weight: W,
        sets: pattern,
        headline: 'Halten',
        reason: `Letztes Mal ${list} – dieses Niveau heute bestätigen, danach geht es weiter.`,
        note: learnedNote(tempo),
      };
    }

    // Schwerere Sätze sitzen → der nächste Satz geht eine Stufe hoch
    const target = Math.min(W, nextStepAbove(previousWeight, config.step, config.base));
    const heavyFull = heavyReps.every((reps) => reps >= repCap);
    if (heavyReps.every((reps) => reps >= config.repMin) && (predicted(target, next) >= config.repMin || heavyFull)) {
      const reps = clamp(Math.floor(predicted(target, next) + 1e-9), config.repMin, repCap);
      const sets = pattern.map((set, index) => (index === next ? { reps, weight: target } : set));
      return {
        ...base,
        kind: 'increase',
        weight: W,
        sets,
        headline: `+${formatKg(round2(target - previousWeight))}`,
        reason: `${formatKg(W)} sitzt (${list}) – heute geht auch Set ${next + 1} auf ${formatKg(target)}.`,
      };
    }

    // Sonst die schwereren Sätze weiter aufbauen
    const before = raw.map((value) => Math.min(value, repCap));
    const reps = addReps(before, Math.min(tempo.gain, heavy.length), repCap, heavy).map((value) => clamp(value, config.repMin, repCap));
    const added = sumOf(reps) - sumOf(before);
    return {
      ...base,
      kind: added ? 'reps' : 'hold',
      weight: W,
      sets: pattern.map((set, index) => ({ ...set, reps: reps[index] })),
      headline: added ? repsLabel(added) : 'Halten',
      reason: `Letztes Mal ${list} – die Sets mit ${formatKg(W)} weiter aufbauen, die übrigen bleiben.`,
    };
  };

  if (uniform) {
    const done = repsAtW.slice(0, n);
    const reps = fillSets(done, n, drop);
    const list = done.join(' · ');

    // 3. Alle Sätze am oberen Ende → mehr Gewicht (nach einem Ausreißer nach oben erst bestätigen)
    const atTop = config.repMax !== null && done.length >= n && done.every((value) => value >= (config.repMax as number));
    if (atTop && !(tempo.hold && (tempo.spike || tempo.needed > 1))) {
      return increase(reps, `Letztes Mal ${n === 1 ? 'das Set' : `alle ${n} Sets`} mit ${config.repMax}+ Reps bei ${formatKg(W)} geschafft – Zeit für mehr Gewicht.`);
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

    const current = reps.map((value) => clamp(value, config.repMin, repCap));
    const planned = (values: number[]) => values.map((value) => ({ reps: value, weight: W }));

    // 5. Letztes Mal weniger Sätze als geplant → erstmal wieder alle Sätze
    if (done.length < n) {
      return {
        ...base,
        kind: 'reps',
        weight: W,
        sets: planned(current),
        headline: 'Alle Sets',
        reason: `Letztes Mal ${done.length} von ${n} Sets mit ${formatKg(W)} (${list} Reps) – heute wieder alle ${n} Sets.`,
      };
    }

    // 6. Neues Niveau erst bestätigen (unter dem Bereich geht es zuerst in die Range)
    const inRange = reps.every((value) => value >= config.repMin);
    if (tempo.hold && inRange) {
      return {
        ...base,
        kind: 'hold',
        weight: W,
        sets: planned(current),
        headline: 'Halten',
        reason: tempo.fresh
          ? `Erste Einheit mit ${formatKg(W)} (${list} Reps) – erst einmal bestätigen, gesteigert wird danach.`
          : tempo.spike
            ? `Starke Einheit (${list} Reps), deutlich mehr als zuletzt – erst bestätigen, ob das dein neues Niveau ist.`
            : tempo.dip || tempo.needed > 1
              ? `Letztes Mal ${list} Reps – dieses Niveau heute nochmal festigen.`
              : `Letztes Mal neue Bestleistung (${list} Reps) – heute bestätigen, gesteigert wird danach.`,
        note: learnedNote(tempo),
      };
    }

    // 7. Bestätigt: gleiches Gewicht, Reps in deinem typischen Tempo steigern
    const before = reps.map((value) => Math.min(value, repCap));
    const target = addReps(before, tempo.gain, repCap).map((value) => clamp(value, config.repMin, repCap));
    const added = sumOf(target) - sumOf(before);
    if (!added) {
      return {
        ...base,
        kind: 'hold',
        weight: W,
        sets: planned(target),
        headline: 'Halten',
        reason: `Alle Sets am oberen Ende (${list} Reps) – ${formatKg(W)} halten.`,
      };
    }
    return {
      ...base,
      kind: 'reps',
      weight: W,
      sets: planned(target),
      headline: repsLabel(added),
      reason: !inRange
        ? `Letztes Mal ${list} Reps – heute in den Zielbereich ab ${config.repMin} Reps.`
        : tempo.easy
        ? `Laut RIR war letztes Mal noch Luft (${list} Reps) – heute ${added === 1 ? 'ein Rep' : `${added} Reps`} mehr.`
        : tempo.dip
          ? `Letztes Mal etwas weniger als zuvor (${list} Reps) – heute in kleinen Schritten wieder hin.`
          : `Gleiches Gewicht, ${list} Reps sitzen – heute ${added === 1 ? 'ein Rep' : `${added} Reps`} mehr.`,
      note: learnedNote(tempo),
    };
  }

  // 8. Sätze mit leicht unterschiedlichem Gewicht → Muster behalten und Satz für Satz umstellen
  const lightest = Math.min(...working.map((set) => set.weight as number));
  if ((W - lightest) / W <= MAX_RAMP_SPREAD) return rampRecommendation();

  // 9. Stark unterschiedliche Gewichte → einheitliches Gewicht über das 1RM
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
    reason: `Letztes Mal stark unterschiedliche Gewichte (${weights.map((value) => formatNumber(value)).join(' / ')} kg) – für ${n} gleiche Sets passt ${formatKg(uniformWeight)}.`,
  };
}

function bodyweightRecommendation(
  sessions: ExerciseSession[],
  config: ExerciseConfig,
  rules: Rules,
  days: number,
  n: number,
  repCap: number,
  base: Pick<Recommendation, 'last' | 'daysSinceLast'>,
): Recommendation {
  const last = sessions.at(-1) as ExerciseSession;
  const reps = last.sets.map((set) => set.reps as number);
  const at = (index: number) => reps[index] ?? reps.at(-1) ?? config.repMin;
  const before = Array.from({ length: n }, (_, index) => Math.min(at(index), repCap));
  const current = before.map((value) => clamp(value, config.repMin, repCap));
  const planned = (values: number[]) => values.map((value) => ({ reps: value, weight: null }));

  if (rules.comebackEnabled && days > rules.comebackDays) {
    return {
      ...base,
      kind: 'comeback',
      weight: null,
      sets: planned(current),
      headline: 'Wiedereinstieg',
      reason: `Letzte Einheit vor ${days} Tagen – heute erstmal die Reps von damals.`,
    };
  }

  const allTop = config.repMax !== null && reps.length >= n && reps.slice(0, n).every((value) => value >= repCap);
  if (allTop && config.bodyweight) {
    const weight = firstStep(config.step, config.base);
    return {
      ...base,
      kind: 'increase',
      weight,
      sets: Array.from({ length: n }, () => ({ reps: config.repMin, weight })),
      headline: `+${formatKg(weight)}`,
      reason: `Alle Sets am oberen Ende (${config.repMax} Reps) – Zeit für Zusatzgewicht.`,
    };
  }

  const tempo = tempoOf(sessions, n, config);
  const list = reps.slice(0, n).join(' · ');
  const hold = tempo.hold && before.every((value) => value >= config.repMin);
  const target = hold ? current : addReps(before, tempo.gain, repCap).map((value) => clamp(value, config.repMin, repCap));
  const added = sumOf(target) - sumOf(before);
  if (!added) {
    return {
      ...base,
      kind: 'hold',
      weight: null,
      sets: planned(current),
      headline: 'Halten',
      reason: hold ? `Letztes Mal neue Bestleistung (${list} Reps) – heute bestätigen, gesteigert wird danach.` : `Alle Sets am oberen Ende (${list} Reps).`,
      note: learnedNote(tempo),
    };
  }
  return {
    ...base,
    kind: 'reps',
    weight: null,
    sets: planned(target),
    headline: repsLabel(added),
    reason: `Letztes Mal ${list} Reps – heute ${added === 1 ? 'ein Rep' : `${added} Reps`} mehr.`,
    note: learnedNote(tempo),
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
  return target < weight - 0.01 ? Math.max(firstStep(config.step, config.base), target) : nextStepBelow(weight, config.step, config.base);
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
  const lowest = firstStep(config.step, config.base);
  let weight = nextStepBelow(startAbove, config.step, config.base);
  for (let i = 0; i < MAX_SEARCH_STEPS && weight > lowest + 0.01; i += 1) {
    if (estimate(weight) >= aim) return weight;
    weight = nextStepBelow(weight, config.step, config.base);
  }
  return Math.max(weight, lowest);
}

/**
 * Plateau: Die letzten `count` Einheiten lagen alle beim selben Gewicht wie die Einheit davor
 * und haben deren Wiederholungssumme nicht übertroffen. Eine Einheit, die eine Bestleistung
 * genau bestätigt, ist geplant und zählt nicht als Stillstand.
 */
export function isPlateau(sessions: ExerciseSession[], n: number, count: number, confirmed = false): boolean {
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
  if (rest[0] === reference && !confirmed) return isPlateau(sessions, n, count + 1, true);
  return rest.every((total) => total <= reference);
}

export function snapshotOf(recommendation: Recommendation): RecommendationSnapshot {
  const weights = recommendation.sets.map((set) => set.weight);
  return {
    kind: recommendation.kind,
    weight: recommendation.weight,
    reps: recommendation.sets.map((set) => set.reps),
    ...(weights.some((weight) => !sameWeight(weight, recommendation.weight)) ? { weights } : {}),
  };
}
