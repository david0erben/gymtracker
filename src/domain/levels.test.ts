import { describe, expect, it } from 'vitest';
import { classifySeries } from './levels';

describe('classifySeries', () => {
  it('erkennt einen dauerhaften Gerätewechsel', () => {
    const result = classifySeries([88, 86, 92, 90, 87, 25, 40, 40]);
    expect(result.shifts).toHaveLength(1);
    // die erste, noch tastende Einheit am neuen Gerät gehört schon zum neuen Abschnitt
    expect(result.shifts[0].index).toBe(5);
    expect(result.shifts[0].factor).toBeCloseTo(40 / 90, 1);
  });

  it('wertet eine kurze Episode mit Rückkehr als vorübergehend', () => {
    const result = classifySeries([280, 300, 290, 280, 28, 35, 28, 290, 300, 310]);
    expect(result.shifts).toHaveLength(0);
    expect([...result.temporary].sort()).toEqual([4, 5, 6]);
  });

  it('lässt normales Schwanken in Ruhe', () => {
    const result = classifySeries([100, 118, 104, 125, 96, 120, 110, 130, 122, 128]);
    expect(result.shifts).toHaveLength(0);
    expect(result.temporary.size).toBe(0);
  });

  it('erkennt zwei Ausreißer in Folge vor der Rückkehr', () => {
    const result = classifySeries([200, 205, 210, 20, 25, 210, 215, 220]);
    expect(result.shifts).toHaveLength(0);
    expect([...result.temporary].sort()).toEqual([3, 4]);
  });

  it('erkennt einen Wechsel auch mit nur zwei Einheiten danach', () => {
    const result = classifySeries([40, 42, 41, 40, 43, 105, 112]);
    expect(result.shifts.map((shift) => shift.index)).toEqual([5]);
  });
});
