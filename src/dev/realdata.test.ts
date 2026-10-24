import { readFileSync, existsSync } from 'node:fs';
import { it } from 'vitest';
import { normalizeAppData } from '../data/legacy';
import { applyDataFixes } from '../data/fixes';
import { analyzeHistory, applyOutlierFlags } from '../domain/outliers';
import { DAY_KEYS, TRAINING_PLAN } from '../domain/plan';
import { recommend } from '../domain/progression';
import { defaultSettings, resolveExerciseConfig } from '../domain/settings';
import { exerciseSessions } from '../domain/strength';
import { formatSet } from '../domain/format';

const FILE = 'gym-tracker-backup-2026-10-24.json';

it.skipIf(!existsSync(FILE))('Analyse echter Daten', () => {
  const raw = normalizeAppData(JSON.parse(readFileSync(FILE, 'utf-8')));
  const data = { ...raw, workouts: applyDataFixes(raw.workouts) };
  const { findings, shifts } = analyzeHistory(data.workouts);
  console.log(`\n=== ${shifts.length} Gerätewechsel ===`);
  for (const shift of shifts) console.log(`${shift.date}  WECHSEL  ${shift.exercise.padEnd(38)} Faktor ${shift.factor.toFixed(2)}`);
  console.log(`\n=== ${findings.length} Ausreißer ===`);
  for (const f of findings) {
    console.log(`${f.date}  ${f.reason.padEnd(8)} ${f.exercise.padEnd(38)} ${f.value} kg (erwartet ~${f.reference.toFixed(1)}, ${(f.deviation * 100).toFixed(0)} %)`);
  }
  const workouts = applyOutlierFlags(data.workouts, findings);
  const settings = defaultSettings();
  const days: Record<string, string> = { monday: '2026-10-26', tuesday: '2026-10-27', thursday: '2026-10-29', friday: '2026-10-30', saturday: '2026-10-24' };
  for (const day of DAY_KEYS) {
    console.log(`\n=== ${TRAINING_PLAN[day].label} (${days[day]}) ===`);
    for (const planned of TRAINING_PLAN[day].exercises) {
      const config = resolveExerciseConfig(planned, settings);
      const sessions = exerciseSessions(workouts, planned.name);
      const rec = recommend(sessions, config, settings.rules, days[day]);
      const last = rec.last ? rec.last.sets.map((s) => formatSet(s.reps, s.weight)).join(', ') : '–';
      console.log(`${planned.name.padEnd(38)} ${rec.kind.padEnd(9)} ${rec.sets.map((s) => formatSet(s.reps, s.weight)).join(' | ').padEnd(34)} ← ${last}`);
      console.log(`${''.padEnd(38)} ${rec.headline}: ${rec.reason}`);
    }
  }
});
