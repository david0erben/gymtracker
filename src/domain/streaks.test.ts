import { describe, expect, it } from 'vitest';
import { CLASSIC_PLAN, HYPERTROPHY_PLAN } from './plan';
import { planTimeline, streakStats } from './streaks';
import type { Workout } from './types';

describe('streakStats', () => {
  // Mo 05.10. bis Fr 23.10.2026 an allen Krafttagen trainiert, Sa 24.10. ist heute
  const october = ['05', '06', '08', '09', '10', '12', '13', '15', '16', '17', '19', '20', '22', '23'].map((day) => `2026-10-${day}`);

  it('zählt geplante Tage am Stück, Ruhetage unterbrechen nicht', () => {
    const stats = streakStats(['2026-09-21', ...october], [], '2026-10-24');
    expect(stats.current).toBe(14);
    expect(stats.longest).toBe(14);
  });

  it('ein verpasster geplanter Tag beendet die Serie', () => {
    const stats = streakStats(october.filter((date) => date !== '2026-10-15'), [], '2026-10-24');
    // nach dem ausgelassenen Do 15.10.: 16., 17., 19., 20., 22., 23.
    expect(stats.current).toBe(6);
    expect(stats.longest).toBe(7);
    expect([stats.longestFrom, stats.longestTo]).toEqual(['2026-10-05', '2026-10-13']);
    expect(stats.currentSince).toBe('2026-10-16');
  });

  it('berechnet die Plantreue', () => {
    const stats = streakStats(october.filter((date) => date !== '2026-10-15'), [], '2026-10-24', 14);
    // 11.–23.10.: 9 geplante Krafttage (heute noch offen), 8 erledigt
    expect(stats.plannedDays).toBe(9);
    expect(stats.doneDays).toBe(8);
  });

  it('Cardio-Tage zählen erst ab der ersten Cardio-Einheit', () => {
    const stats = streakStats(october, ['2026-10-21'], '2026-10-24');
    // Mi 21.10. Cardio, So 18.10. lag vor dem Cardio-Start
    expect(stats.current).toBe(15);
  });

  it('im Hypertrophie-Plan ist Donnerstag Ruhetag und bricht keine Serie', () => {
    // Mo 19., Di 20., Fr 23., Sa 24.10. nach dem Hypertrophie-Plan
    const dates = ['2026-10-19', '2026-10-20', '2026-10-23', '2026-10-24'];
    const workouts = dates.map((date) => ({ date, planId: 'hypertrophy' }) as Workout);
    const stats = streakStats(dates, [], '2026-10-24', 28, planTimeline(workouts, HYPERTROPHY_PLAN));
    expect(stats.current).toBe(4);
    // nach dem bisherigen Plan fehlt der Donnerstag
    expect(streakStats(dates, [], '2026-10-24', 28, () => CLASSIC_PLAN).current).toBe(2);
  });

  it('der Plan gilt ab dem ersten Training damit, davor der bisherige', () => {
    const workouts = [
      { date: '2026-10-15', planId: undefined },
      { date: '2026-10-19', planId: 'hypertrophy' },
    ] as Workout[];
    const planAt = planTimeline(workouts, HYPERTROPHY_PLAN);
    expect(planAt('2026-10-15').id).toBe('classic');
    expect(planAt('2026-10-17').id).toBe('classic');
    expect(planAt('2026-10-22').id).toBe('hypertrophy');
    expect(planAt('2026-10-30').id).toBe('hypertrophy');
  });
});
