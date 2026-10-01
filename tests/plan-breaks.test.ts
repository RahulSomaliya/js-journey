import { describe, it, expect } from 'vitest';
import {
  computePace, buildDynamicSchedule, currentWeek, planBreakFor, nudgeSkipReason,
  type LogEntry, type PlanBreak,
} from '@/lib/schedule';
import { REACT_CURRICULUM } from '@/lib/curriculum';
import { REACT_PLAN } from '@/lib/config';

// Diwali: Sun 1 Nov – Sun 15 Nov 2026 (inclusive) — no study days inside it.
// The scenario below: she is on plan through week 4 (§01–§16 = 1618 of the 1716
// content-min due by Fri 30 Oct), then studies nothing over Diwali.
const NO_BREAK = { ...REACT_PLAN, breaks: [] };
const onPlanByOct30: LogEntry[] = REACT_CURRICULUM
  .filter((s) => s.kind === 'core' && s.sortOrder <= 16)
  .map((s) => ({ id: `f${s.id}`, studyDate: '2026-10-30', minutes: s.videoMinutes, sectionId: s.id, finishedSection: true }));
const paceOn = (today: string, config = REACT_PLAN) =>
  computePace({ today, sections: REACT_CURRICULUM, logs: onPlanByOct30, config });
const dynOn = (today: string, config = REACT_PLAN) =>
  buildDynamicSchedule(REACT_CURRICULUM, onPlanByOct30, config, today);
const verdict = (p: ReturnType<typeof paceOn>) => ({
  status: p.status, idealContentMinutes: p.idealContentMinutes, gapMinutes: p.gapMinutes,
  daysOffPace: p.daysOffPace, studyDaysElapsed: p.studyDaysElapsed,
});

describe('pace over a plan break — she is never behind because of Diwali', () => {
  it('the Saturday before Diwali: 20 study days in, 1618 of 1716 content-min → on track', () => {
    expect(verdict(paceOn('2026-10-31'))).toEqual({
      status: 'on_track', idealContentMinutes: 1716, gapMinutes: -98, daysOffPace: -1, studyDaysElapsed: 20,
    });
  });
  it('pace is frozen through the whole break (and on the Monday back, before that day counts)', () => {
    const before = verdict(paceOn('2026-10-31'));
    for (const d of ['2026-11-01', '2026-11-02', '2026-11-09', '2026-11-13', '2026-11-15', '2026-11-16']) {
      expect(verdict(paceOn(d))).toEqual(before);
    }
  });
  it('without the break the same idle fortnight would read behind (the break is what protects her)', () => {
    expect(paceOn('2026-11-13', NO_BREAK).status).toBe('behind');
  });
  it('after the break, idle study days count again', () => {
    const p = paceOn('2026-11-20'); // Mon 16 – Thu 19 Nov elapsed: 20 + 4 study days
    expect(p.studyDaysElapsed).toBe(24);
    expect(p.idealContentMinutes).toBe(2059);
    expect(p.status).toBe('behind');
  });
  it('the trailing-rate projection does not decay during the break', () => {
    expect(paceOn('2026-11-09').projectedFinishDate).toBe(paceOn('2026-10-31').projectedFinishDate);
  });
  it('the plan-rate projection skips the break: 64 open days from Thu 1 Oct → Sat 19 Dec (not Fri 4 Dec)', () => {
    const p = (config = REACT_PLAN) => computePace({ today: '2026-10-01', sections: REACT_CURRICULUM, logs: [], config });
    expect(p().projectedFinishDate).toBe('2026-12-19');
    expect(p(NO_BREAK).projectedFinishDate).toBe('2026-12-04');
  });
});

describe('the dynamic projection over a plan break', () => {
  it('Fri 30 Oct: §17 (180 min = 3 study days) is due Wed 18 Nov, projected Tue 22 Dec vs Fri 25 Dec', () => {
    const dyn = dynOn('2026-10-30');
    expect(dyn.currentSection?.sortOrder).toBe(17);
    expect(dyn.currentDueDate).toBe('2026-11-18');
    expect(dyn.projectedFinishDate).toBe('2026-12-22');
    expect(dyn.originalTargetDate).toBe('2026-12-25');
  });
  it('does not drift during the break: nothing is overdue, the projection holds', () => {
    for (const d of ['2026-11-02', '2026-11-09', '2026-11-13', '2026-11-15', '2026-11-16']) {
      const dyn = dynOn(d);
      expect(dyn.isCurrentOverdue).toBe(false);
      expect(dyn.projectedFinishDate).toBe('2026-12-22');
    }
  });
  it('without the break the same idle fortnight would be overdue and projected past the target', () => {
    const dyn = dynOn('2026-11-13', NO_BREAK);
    expect(dyn.isCurrentOverdue).toBe(true);
    expect(dyn.projectedFinishDate > dyn.originalTargetDate).toBe(true);
  });
});

describe('study weeks over a plan break', () => {
  it('currentWeek counts STUDY weeks: the break keeps week 4, week 5 starts Mon 16 Nov, week 10 ends Fri 25 Dec', () => {
    expect(currentWeek('2026-10-04', REACT_PLAN)).toBe(0);
    expect(currentWeek('2026-10-05', REACT_PLAN)).toBe(1);
    expect(currentWeek('2026-10-30', REACT_PLAN)).toBe(4);
    expect(currentWeek('2026-11-09', REACT_PLAN)).toBe(4);
    expect(currentWeek('2026-11-15', REACT_PLAN)).toBe(4);
    expect(currentWeek('2026-11-16', REACT_PLAN)).toBe(5);
    expect(currentWeek('2026-12-25', REACT_PLAN)).toBe(10);
  });
});

describe('planBreakFor — the break in progress, else the next one within 14 days', () => {
  const DIWALI = { label: 'Diwali', start: '2026-11-01', end: '2026-11-15' };
  it('React plan: shows from Sun 18 Oct (14 days out) through Sun 15 Nov', () => {
    expect(planBreakFor('2026-10-01', REACT_PLAN.breaks)).toBeNull();
    expect(planBreakFor('2026-10-17', REACT_PLAN.breaks)).toBeNull(); // 15 days out
    expect(planBreakFor('2026-10-18', REACT_PLAN.breaks)).toEqual(DIWALI);
    expect(planBreakFor('2026-11-01', REACT_PLAN.breaks)).toEqual(DIWALI);
    expect(planBreakFor('2026-11-15', REACT_PLAN.breaks)).toEqual(DIWALI);
    expect(planBreakFor('2026-11-16', REACT_PLAN.breaks)).toBeNull();
  });
  it('the break in progress wins over a nearer upcoming one; upcoming = the earliest, whatever the array order', () => {
    const breaks: PlanBreak[] = [
      { label: 'Wedding', start: '2026-11-20', end: '2026-11-22' },
      DIWALI,
      { label: 'Trip', start: '2026-11-25', end: '2026-11-27' },
    ];
    expect(planBreakFor('2026-11-14', breaks)?.label).toBe('Diwali');
    expect(planBreakFor('2026-11-16', breaks)?.label).toBe('Wedding');
    expect(planBreakFor('2026-11-23', breaks)?.label).toBe('Trip');
    expect(planBreakFor('2026-11-28', breaks)).toBeNull();
  });
  it('returns exactly { label, start, end }', () => {
    expect(Object.keys(planBreakFor('2026-11-05', REACT_PLAN.breaks) ?? {}).sort()).toEqual(['end', 'label', 'start']);
  });
});

describe('nudgeSkipReason — when the daily "no log" email stays quiet', () => {
  it('before the plan starts (React starts Mon 5 Oct)', () => {
    expect(nudgeSkipReason('2026-10-01', REACT_PLAN)).toBe('before-start');
    expect(nudgeSkipReason('2026-10-02', REACT_PLAN)).toBe('before-start');
    expect(nudgeSkipReason('2026-10-05', REACT_PLAN)).toBeNull();
  });
  it('on weekends', () => {
    expect(nudgeSkipReason('2026-10-10', REACT_PLAN)).toBe('weekend');
    expect(nudgeSkipReason('2026-10-11', REACT_PLAN)).toBe('weekend');
  });
  it('on every break day, weekend or not', () => {
    for (const d of ['2026-11-01', '2026-11-02', '2026-11-07', '2026-11-13', '2026-11-15']) {
      expect(nudgeSkipReason(d, REACT_PLAN)).toBe('break');
    }
    expect(nudgeSkipReason('2026-10-30', REACT_PLAN)).toBeNull();
    expect(nudgeSkipReason('2026-11-16', REACT_PLAN)).toBeNull();
  });
});
