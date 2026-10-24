import { median } from './strength';

/**
 * Teilt den Kraftverlauf einer Übung in Abschnitte mit gleichem Niveau:
 *
 * - Vorübergehend anderes Gerät (z. B. drei Wochen Pendulum Squat statt Beinpresse):
 *   das Niveau springt und kommt zurück. → Diese Einheiten sind Ausreißer.
 * - Dauerhafter Gerätewechsel (z. B. neues Studio): das Niveau springt und bleibt.
 *   → Abschnittsgrenze. Die Kraftkurve rechnet ältere Werte auf das neue Niveau um.
 */

export interface LevelShift {
  /** Index der ersten Einheit auf dem neuen Niveau */
  index: number;
  /** Faktor neues/altes Niveau */
  factor: number;
}

export interface SeriesClassification {
  shifts: LevelShift[];
  /** Indizes vorübergehender Abweichungen */
  temporary: Set<number>;
}

const SHIFT = 1.35;
const SAME = 1.3;
const SIDE = 3;
const WIDE = 5;
const BOUNDARY = 1.4;
const MAX_RUN = 4;
const MAX_EPISODE = 5;
const MAX_PAIR = 8;

const ratio = (a: number, b: number) => Math.max(a, b) / Math.min(a, b);

/** Läufe von 1–4 Einheiten, die von beiden Seiten deutlich abweichen, während davor und danach übereinstimmen. */
function temporaryRuns(values: number[]): Set<number> {
  const temporary = new Set<number>();
  let start = 1;
  while (start < values.length - 1) {
    let marked = 0;
    for (let length = 1; length <= MAX_RUN && start + length < values.length; length += 1) {
      const run = values.slice(start, start + length);
      const beforeValues = values
        .slice(0, start)
        .filter((_, index) => !temporary.has(index))
        .slice(-SIDE);
      const afterValues = values.slice(start + length, start + length + SIDE);
      if (beforeValues.length < 2 || afterValues.length < 2) break;
      const before = median(beforeValues) as number;
      const after = median(afterValues) as number;
      // Einzelwerte brauchen 35 % Abweichung, Läufe ab 2 Einheiten 30 % (mehrere Werte gleichzeitig daneben ist eindeutiger)
      const threshold = length === 1 ? SHIFT : SAME;
      if (ratio(before, after) <= SAME && run.every((value) => ratio(value, before) >= threshold && ratio(value, after) >= threshold)) {
        for (let index = 0; index < length; index += 1) temporary.add(start + index);
        marked = length;
        break;
      }
    }
    start += marked || 1;
  }
  return temporary;
}

/** Stellen, an denen das Niveau springt (mit bis zu 5 Einheiten je Seite, damit Schwankungen nicht zählen). */
function boundaries(values: number[]): number[] {
  const found: number[] = [];
  let index = 2;
  while (index <= values.length - 2) {
    const beforeWindow = values.slice(Math.max(0, index - WIDE), index);
    const afterWindow = values.slice(index, index + WIDE);
    const before = median(beforeWindow) as number;
    const after = median(afterWindow) as number;
    const fitting = afterWindow.filter((value) => ratio(value, after) <= SAME + 0.05).length;
    const consistent = afterWindow.length >= 3 ? fitting >= afterWindow.length - 1 : fitting === afterWindow.length;
    const firstFits = ratio(values[index], after) < ratio(values[index], before);
    if (before > 0 && after > 0 && ratio(before, after) >= BOUNDARY && consistent && firstFits) {
      found.push(index);
      index += SIDE;
    } else {
      index += 1;
    }
  }
  return found;
}

export function classifySeries(values: number[]): SeriesClassification {
  if (values.length < 5) return { shifts: [], temporary: new Set() };
  const temporary = temporaryRuns(values);
  const kept = values.map((_, index) => index).filter((index) => !temporary.has(index));
  const keptValues = kept.map((index) => values[index]);
  let found = boundaries(keptValues);

  // Sprung hin und wieder zurück: kurze Episoden sind vorübergehend, lange echte Phasen bleiben unverändert
  let changed = true;
  while (changed) {
    changed = false;
    for (let position = 0; position < found.length - 1; position += 1) {
      const first = found[position];
      const second = found[position + 1];
      // nur nah beieinanderliegende Sprünge bilden eine Episode
      if (second - first > MAX_PAIR) continue;
      const levelBefore = median(keptValues.slice(Math.max(0, first - WIDE), first)) as number;
      const levelAfter = median(keptValues.slice(second, second + WIDE)) as number;
      if (ratio(levelBefore, levelAfter) > SAME) continue;
      if (second - first <= MAX_EPISODE) {
        for (let index = first; index < second; index += 1) temporary.add(kept[index]);
      }
      found = found.filter((boundary) => boundary !== first && boundary !== second);
      changed = true;
      break;
    }
  }

  // Nach dem Entfernen vorübergehender Episoden die Faktoren neu berechnen
  const finalKept = values.map((_, index) => index).filter((index) => !temporary.has(index));
  const finalValues = finalKept.map((index) => values[index]);
  const shifts = found
    .map((position) => kept[position])
    .map((index) => {
      const position = finalKept.indexOf(index);
      return {
        index,
        factor:
          (median(finalValues.slice(position, position + WIDE)) as number) /
          (median(finalValues.slice(Math.max(0, position - WIDE), position)) as number),
      };
    })
    .filter((shift) => ratio(shift.factor, 1) >= BOUNDARY);

  // Nur der Wechsel zum aktuellen Niveau ist verlässlich: danach darf kein weiterer Sprung kommen
  // und die Einheiten seitdem müssen zusammenpassen. Frühere Phasen bleiben, wie sie sind.
  const last = shifts.at(-1);
  if (!last) return { shifts: [], temporary };
  const since = finalKept.filter((index) => index >= last.index).map((index) => values[index]);
  const level = median(since.slice(0, WIDE)) as number;
  const fitting = since.filter((value) => ratio(value, level) <= SHIFT).length;
  const stable = since.length >= 2 && fitting >= Math.max(2, Math.floor(since.length * 0.75));
  return { shifts: stable ? [last] : [], temporary };
}
