import { describe, it, expect } from 'vitest';
import {
  coreContentMinutes, contentMinutesPerWeek, totalWeeks, buildMilestones,
  finishedSectionIds, currentSection, studyWeeksElapsed, computePace, streak,
  currentWeek, phaseForWeek, sectionEffortMinutes,
} from '@/lib/schedule';
import type { ScheduleConfig, LogEntry } from '@/lib/schedule';
import { CURRICULUM } from '@/lib/curriculum';

const CFG: ScheduleConfig = {
  startDate: '2026-06-22', dailyHours: 2.5, studyDaysPerWeek: 5,
  multiplier: 2.5, graceWeeks: 1, timeZone: 'Asia/Kolkata',
};

describe('schedule engine', () => {
  it('coreContentMinutes = 4092', () => {
    expect(coreContentMinutes(CURRICULUM)).toBe(4092);
  });
  it('contentMinutesPerWeek = 300 (5.0h)', () => {
    expect(contentMinutesPerWeek(CFG)).toBe(300);
  });
  it('totalWeeks = 14', () => {
    expect(totalWeeks(CURRICULUM, CFG)).toBe(14);
  });
  it('buildMilestones: 14 weeks, week 1 ends 2026-06-26, week 14 ends 2026-09-25 at full core', () => {
    const ms = buildMilestones(CURRICULUM, CFG);
    expect(ms).toHaveLength(14);
    expect(ms[0].fridayDate).toBe('2026-06-26');
    expect(ms[0].cumulativeContentMinutes).toBe(300);
    expect(ms[13].fridayDate).toBe('2026-09-25');
    expect(ms[13].cumulativeContentMinutes).toBe(4092);
  });
  it('finishedSectionIds collects sections with a finished log', () => {
    const logs: LogEntry[] = [
      { id: 'a', studyDate: '2026-06-22', minutes: 150, sectionId: 1, finishedSection: true },
      { id: 'b', studyDate: '2026-06-23', minutes: 150, sectionId: 2, finishedSection: false },
    ];
    expect([...finishedSectionIds(logs)]).toEqual([1]);
  });
  it('currentSection = first unfinished core section', () => {
    const logs: LogEntry[] = [{ id: 'a', studyDate: '2026-06-22', minutes: 24, sectionId: 1, finishedSection: true }];
    expect(currentSection(CURRICULUM, logs)!.id).toBe(2);
  });
  it('studyWeeksElapsed counts completed Mon-Fri weeks', () => {
    expect(studyWeeksElapsed('2026-06-22', CFG)).toBe(0);
    expect(studyWeeksElapsed('2026-06-29', CFG)).toBe(1);
    expect(studyWeeksElapsed('2026-07-06', CFG)).toBe(2);
  });
  it('computePace: behind when nothing done after 2 weeks', () => {
    const r = computePace({ today: '2026-07-06', sections: CURRICULUM, logs: [], config: CFG });
    expect(r.idealContentMinutes).toBe(600);
    expect(r.contentMinutesDone).toBe(0);
    expect(r.status).toBe('behind');
    expect(r.contentMinutesTotal).toBe(4092);
  });
  it('computePace: on_track when done ~= ideal', () => {
    const logs: LogEntry[] = [
      { id: '1', studyDate: '2026-06-26', minutes: 750, sectionId: 1, finishedSection: true }, // s1 24
      { id: '2', studyDate: '2026-07-03', minutes: 750, sectionId: 2, finishedSection: true }, // s2 300
      { id: '3', studyDate: '2026-07-03', minutes: 1, sectionId: 3, finishedSection: true },   // s3 270 -> 594
    ];
    const r = computePace({ today: '2026-07-06', sections: CURRICULUM, logs, config: CFG });
    expect(r.contentMinutesDone).toBe(594);
    expect(r.idealContentMinutes).toBe(600);
    expect(r.status).toBe('on_track');
  });
  it('streak counts consecutive study-days back from today, skipping weekends', () => {
    const logs: LogEntry[] = [
      { id: '1', studyDate: '2026-06-24', minutes: 150, sectionId: 2, finishedSection: false },
      { id: '2', studyDate: '2026-06-25', minutes: 150, sectionId: 2, finishedSection: false },
    ];
    expect(streak(logs, '2026-06-25', CFG)).toBe(2);
  });
  it('idealEffortMinutes = idealContentMinutes * multiplier', () => {
    const r = computePace({ today: '2026-07-06', sections: CURRICULUM, logs: [], config: CFG });
    expect(r.idealEffortMinutes).toBe(1500); // 600 * 2.5
  });
  it('projectedFinishDate is set via plan-rate fallback when there is no recent data', () => {
    const r = computePace({ today: '2026-07-06', sections: CURRICULUM, logs: [], config: CFG });
    expect(r.projectedFinishDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('projectedFinishDate stays within a sane horizon with sparse early data (no multi-year blowup)', () => {
    const logs: LogEntry[] = [{ id: '1', studyDate: '2026-06-26', minutes: 60, sectionId: 1, finishedSection: true }];
    const r = computePace({ today: '2026-06-29', sections: CURRICULUM, logs, config: CFG });
    expect(r.projectedFinishDate! < '2027-06-01').toBe(true); // weeksElapsed=1 (<2) -> plan-rate fallback
  });
  it('currentWeek is 1-based from start', () => {
    expect(currentWeek('2026-06-22', CFG)).toBe(1);
    expect(currentWeek('2026-06-29', CFG)).toBe(2);
    expect(currentWeek('2026-09-25', CFG)).toBe(14);
  });
  it('phaseForWeek maps weeks to the four phases', () => {
    expect(phaseForWeek(1)!.name).toBe('Foundations');
    expect(phaseForWeek(7)!.n).toBe(3);
    expect(phaseForWeek(14)!.n).toBe(4);
  });
  it('sectionEffortMinutes sums minutes for one section', () => {
    const logs: LogEntry[] = [
      { id: '1', studyDate: '2026-06-24', minutes: 120, sectionId: 2, finishedSection: false },
      { id: '2', studyDate: '2026-06-25', minutes: 90, sectionId: 2, finishedSection: false },
      { id: '3', studyDate: '2026-06-25', minutes: 60, sectionId: 3, finishedSection: false },
    ];
    expect(sectionEffortMinutes(logs, 2)).toBe(210);
  });
});
