import { describe, it, expect } from 'vitest';
import {
  coreContentMinutes, contentMinutesPerWeek, totalWeeks, buildMilestones,
  finishedSectionIds, currentSection, studyWeeksElapsed, computePace, streak,
  currentWeek, phaseForWeek, sectionEffortMinutes, buildCurriculumRows, buildDynamicSchedule,
} from '@/lib/schedule';
import type { ScheduleConfig, LogEntry } from '@/lib/schedule';
import { CURRICULUM } from '@/lib/curriculum';
import { addStudyDays } from '@/lib/date';

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
  it('idealContentMinutes prorates by weekday within week 1', () => {
    const r = computePace({ today: '2026-06-24', sections: CURRICULUM, logs: [], config: CFG });
    expect(r.idealContentMinutes).toBe(120); // Mon + Tue completed -> 2 * 60
    expect(r.notStarted).toBe(false);
  });
  it('notStarted is true (and ideal 0) before the start date', () => {
    const r = computePace({ today: '2026-06-15', sections: CURRICULUM, logs: [], config: CFG });
    expect(r.notStarted).toBe(true);
    expect(r.idealContentMinutes).toBe(0);
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

describe('buildCurriculumRows', () => {
  const ms = buildMilestones(CURRICULUM, CFG);
  it('marks a finished section done, current section in_progress, and rest upcoming (early date)', () => {
    const logs: LogEntry[] = [
      { id: 'a', studyDate: '2026-06-22', minutes: 24, sectionId: 1, finishedSection: true },
      { id: 'b', studyDate: '2026-06-23', minutes: 60, sectionId: 2, finishedSection: false },
    ];
    const rows = buildCurriculumRows(CURRICULUM, logs, ms, '2026-06-24');
    const byId = Object.fromEntries(rows.map((r) => [r.section.id, r]));
    expect(byId[1].status).toBe('done');
    expect(byId[1].minutesLogged).toBe(24);
    expect(byId[2].status).toBe('in_progress');
    expect(byId[3].status).toBe('upcoming');
  });
  it('marks an unfinished, non-current core section overdue once its target Friday has passed', () => {
    const logs: LogEntry[] = [
      { id: 'a', studyDate: '2026-06-22', minutes: 24, sectionId: 1, finishedSection: true },
    ];
    // far-future "today" → every later core section's target Friday is in the past
    const rows = buildCurriculumRows(CURRICULUM, logs, ms, '2026-12-31');
    const s3 = rows.find((r) => r.section.id === 3)!;
    expect(s3.status).toBe('overdue');
    expect(s3.targetFriday).not.toBeNull();
  });
  it('gives bonus/skip sections a null targetFriday', () => {
    const rows = buildCurriculumRows(CURRICULUM, [], ms, '2026-06-24');
    expect(rows.find((r) => r.section.id === 4)!.targetFriday).toBeNull(); // bonus
    expect(rows.find((r) => r.section.id === 6)!.targetFriday).toBeNull(); // skip
  });
  it('returns one row per section, in sortOrder', () => {
    const rows = buildCurriculumRows(CURRICULUM, [], ms, '2026-06-24');
    expect(rows).toHaveLength(CURRICULUM.length);
    expect(rows.map((r) => r.section.id)).toEqual(CURRICULUM.map((s) => s.id));
  });
});

describe('buildDynamicSchedule', () => {
  it('not started: current is S1, due is start + ceil(24/60)=1 study-day, ~on track', () => {
    const dyn = buildDynamicSchedule(CURRICULUM, [], CFG, '2026-06-22');
    expect(dyn.currentSection?.id).toBe(1);
    expect(dyn.anchorDate).toBe('2026-06-22');
    expect(dyn.currentDueDate).toBe(addStudyDays('2026-06-22', 1));
    expect(dyn.isCurrentOverdue).toBe(false);
    expect(Math.abs(dyn.daysDelta)).toBeLessThanOrEqual(2);
  });

  it('finished S1 & S2 early: current is S3, due anchored to last completion, ahead', () => {
    const logs: LogEntry[] = [
      { id: 'a', studyDate: '2026-06-24', minutes: 24, sectionId: 1, finishedSection: true },
      { id: 'b', studyDate: '2026-06-26', minutes: 300, sectionId: 2, finishedSection: true },
    ];
    const dyn = buildDynamicSchedule(CURRICULUM, logs, CFG, '2026-06-29');
    expect(dyn.currentSection?.id).toBe(3);
    expect(dyn.anchorDate).toBe('2026-06-26'); // latest completion
    // S3 = 270 video-min / 60 per study-day = 4.5 → ceil 5 study-days from the anchor
    expect(dyn.currentDueDate).toBe(addStudyDays('2026-06-26', 5));
    expect(dyn.isCurrentOverdue).toBe(false);
    expect(dyn.daysDelta).toBeGreaterThan(0); // ahead of the original target
  });

  it('idle past the deadline re-anchors to today and reports behind', () => {
    const logs: LogEntry[] = [
      { id: 'a', studyDate: '2026-06-24', minutes: 24, sectionId: 1, finishedSection: true },
    ];
    const dyn = buildDynamicSchedule(CURRICULUM, logs, CFG, '2026-08-15'); // long after S2 was due
    expect(dyn.currentSection?.id).toBe(2);
    expect(dyn.isCurrentOverdue).toBe(true);
    expect(dyn.currentDueDate).toBe(addStudyDays('2026-08-15', 5)); // fresh, from today
    expect(dyn.daysDelta).toBeLessThan(0); // behind
  });

  it('all core finished: no current section, finish = last completion', () => {
    const logs: LogEntry[] = CURRICULUM.filter((s) => s.kind === 'core').map((s) => ({
      id: `f${s.id}`, studyDate: '2026-07-10', minutes: s.videoMinutes, sectionId: s.id, finishedSection: true,
    }));
    const dyn = buildDynamicSchedule(CURRICULUM, logs, CFG, '2026-07-11');
    expect(dyn.currentSection).toBeNull();
    expect(dyn.currentDueDate).toBeNull();
    expect(dyn.projectedFinishDate).toBe('2026-07-10');
  });
});
