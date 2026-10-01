import { describe, it, expect } from 'vitest';
import {
  coreContentMinutes, contentMinutesPerWeek, totalWeeks, buildMilestones,
  finishedSectionIds, currentSection, studyWeeksElapsed, computePace, streak,
  currentWeek, phaseForWeek, sectionEffortMinutes, buildCurriculumRows, buildDynamicSchedule,
  finishedEffortRatio,
} from '@/lib/schedule';
import type { ScheduleConfig, LogEntry } from '@/lib/schedule';
import { CURRICULUM } from '@/lib/curriculum';
import { addStudyDays } from '@/lib/date';

const CFG: ScheduleConfig = {
  startDate: '2026-06-22', dailyHours: 2.5, studyDaysPerWeek: 5,
  multiplier: 2.5, graceWeeks: 1, timeZone: 'Asia/Kolkata', breaks: [],
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
    expect(ms[0].dueDate).toBe('2026-06-26');
    expect(ms[0].cumulativeContentMinutes).toBe(300);
    expect(ms[13].dueDate).toBe('2026-09-25');
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
  it('computePace: duplicate finished rows for one section do not inflate the trailing-window rate', () => {
    // same section finished on two rows (possible once sessions are append-only):
    // its videoMinutes must count ONCE in the 14-day window, so the projection matches the single-row case
    const one: LogEntry[] = [
      { id: 'a', studyDate: '2026-07-15', minutes: 150, sectionId: 1, finishedSection: true },
    ];
    const two: LogEntry[] = [
      ...one,
      { id: 'b', studyDate: '2026-07-15', minutes: 60, sectionId: 1, finishedSection: true },
    ];
    const today = '2026-07-20'; // weeksElapsed >= 2 -> trailing-window rate is trusted
    const rOne = computePace({ today, sections: CURRICULUM, logs: one, config: CFG });
    const rTwo = computePace({ today, sections: CURRICULUM, logs: two, config: CFG });
    expect(rTwo.projectedFinishDate).toBe(rOne.projectedFinishDate);
    // pin that the trailing-window path (not the plan-rate fallback) is what's being compared
    const rEmpty = computePace({ today, sections: CURRICULUM, logs: [], config: CFG });
    expect(rOne.projectedFinishDate).not.toBe(rEmpty.projectedFinishDate);
  });
  it('computePace: a stale duplicate finish inside the window does not re-credit an old section', () => {
    // section 1 genuinely finished BEFORE the window; a stray second finished row inside
    // the window (stale tab) must not credit its videoMinutes to the trailing rate
    const base: LogEntry[] = [
      { id: 'a', studyDate: '2026-06-26', minutes: 150, sectionId: 1, finishedSection: true },
    ];
    const withDup: LogEntry[] = [
      ...base,
      { id: 'b', studyDate: '2026-07-15', minutes: 30, sectionId: 1, finishedSection: true },
    ];
    const today = '2026-07-20'; // window starts 2026-07-07 — the 06-26 finish is outside it
    const rBase = computePace({ today, sections: CURRICULUM, logs: base, config: CFG });
    const rDup = computePace({ today, sections: CURRICULUM, logs: withDup, config: CFG });
    expect(rDup.projectedFinishDate).toBe(rBase.projectedFinishDate);
  });
  it('buildDynamicSchedule: a duplicate later finished row does not shift the anchor', () => {
    const one: LogEntry[] = [
      { id: 'a', studyDate: '2026-06-26', minutes: 150, sectionId: 1, finishedSection: true },
    ];
    const dup: LogEntry[] = [
      ...one,
      { id: 'b', studyDate: '2026-07-10', minutes: 30, sectionId: 1, finishedSection: true },
    ];
    const dOne = buildDynamicSchedule(CURRICULUM, one, CFG, '2026-07-13');
    const dDup = buildDynamicSchedule(CURRICULUM, dup, CFG, '2026-07-13');
    expect(dOne.anchorDate).toBe('2026-06-26');
    expect(dDup.anchorDate).toBe('2026-06-26');
    expect(dDup.currentDueDate).toBe(dOne.currentDueDate);
  });
  it('computePace: multiple same-day sessions on one section add their minutes to effort', () => {
    const logs: LogEntry[] = [
      { id: 'a', studyDate: '2026-07-15', minutes: 90, sectionId: 1, finishedSection: false },
      { id: 'b', studyDate: '2026-07-15', minutes: 45, sectionId: 1, finishedSection: false },
    ];
    const r = computePace({ today: '2026-07-20', sections: CURRICULUM, logs, config: CFG });
    expect(r.effortMinutes).toBe(135);
    expect(sectionEffortMinutes(logs, 1)).toBe(135);
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
    expect(currentWeek('2026-06-21', CFG)).toBe(0);
    expect(currentWeek('2026-06-22', CFG)).toBe(1);
    expect(currentWeek('2026-06-27', CFG)).toBe(1); // the weekend belongs to the week just studied
    expect(currentWeek('2026-06-29', CFG)).toBe(2);
    expect(currentWeek('2026-09-25', CFG)).toBe(14);
    expect(currentWeek('2026-10-01', CFG)).toBe(15);
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
  it('marks finished done, current in_progress, rest upcoming', () => {
    const logs: LogEntry[] = [
      { id: 'a', studyDate: '2026-06-22', minutes: 24, sectionId: 1, finishedSection: true },
      { id: 'b', studyDate: '2026-06-23', minutes: 60, sectionId: 2, finishedSection: false },
    ];
    const dyn = buildDynamicSchedule(CURRICULUM, logs, CFG, '2026-06-24');
    const rows = buildCurriculumRows(CURRICULUM, logs, dyn, '2026-06-24');
    const byId = Object.fromEntries(rows.map((r) => [r.section.id, r]));
    expect(byId[1].status).toBe('done');
    expect(byId[1].minutesLogged).toBe(24);
    expect(byId[2].status).toBe('in_progress');
    expect(byId[3].status).toBe('upcoming');
    expect(byId[2].targetDate).toBe(dyn.currentDueDate); // current section's dynamic date
  });
  it('gives bonus/skip sections a null targetDate', () => {
    const dyn = buildDynamicSchedule(CURRICULUM, [], CFG, '2026-06-24');
    const rows = buildCurriculumRows(CURRICULUM, [], dyn, '2026-06-24');
    expect(rows.find((r) => r.section.id === 4)!.targetDate).toBeNull(); // bonus
    expect(rows.find((r) => r.section.id === 6)!.targetDate).toBeNull(); // skip
  });
  it('returns one row per section, in sortOrder', () => {
    const dyn = buildDynamicSchedule(CURRICULUM, [], CFG, '2026-06-24');
    const rows = buildCurriculumRows(CURRICULUM, [], dyn, '2026-06-24');
    expect(rows).toHaveLength(CURRICULUM.length);
    expect(rows.map((r) => r.section.id)).toEqual(CURRICULUM.map((s) => s.id));
  });
});

describe('buildDynamicSchedule', () => {
  it('not started: current is S1, due is start + ceil(24/60)=1 study-day, ~on track', () => {
    const dyn = buildDynamicSchedule(CURRICULUM, [], CFG, '2026-06-22');
    expect(dyn.currentSection?.id).toBe(1);
    expect(dyn.anchorDate).toBe('2026-06-22');
    expect(dyn.currentDueDate).toBe(addStudyDays('2026-06-22', 1, []));
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
    expect(dyn.currentDueDate).toBe(addStudyDays('2026-06-26', 5, []));
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
    expect(dyn.currentDueDate).toBe(addStudyDays('2026-08-15', 5, [])); // fresh, from today
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

describe('sections finished mid-session (player rows carry alsoFinishedIds)', () => {
  const logs: LogEntry[] = [
    { id: 'm', studyDate: '2026-06-24', minutes: 30, sectionId: 1, finishedSection: true },
    // a player session spent mostly in S3 that also finished S2 on the way
    { id: 'p', studyDate: '2026-06-26', minutes: 150, sectionId: 3, finishedSection: false, alsoFinishedIds: [2] },
  ];
  it('finishedSectionIds / currentSection count them', () => {
    expect([...finishedSectionIds(logs)].sort((a, b) => a - b)).toEqual([1, 2]);
    expect(currentSection(CURRICULUM, logs)!.id).toBe(3);
  });
  it('computePace credits their content', () => {
    const r = computePace({ today: '2026-06-29', sections: CURRICULUM, logs, config: CFG });
    expect(r.contentMinutesDone).toBe(324); // 24 + 300
  });
  it('the dynamic anchor moves to the session that finished them', () => {
    const dyn = buildDynamicSchedule(CURRICULUM, logs, CFG, '2026-06-29');
    expect(dyn.anchorDate).toBe('2026-06-26');
    expect(dyn.currentSection?.id).toBe(3);
  });
  it('null alsoFinishedIds (manual rows from the DB) is fine', () => {
    const rows: LogEntry[] = [{ id: 'x', studyDate: '2026-06-24', minutes: 30, sectionId: 1, finishedSection: true, alsoFinishedIds: null }];
    expect([...finishedSectionIds(rows)]).toEqual([1]);
  });
});

describe('finishedEffortRatio', () => {
  it('is effort on finished core sections ÷ their video minutes (null until one is finished)', () => {
    expect(finishedEffortRatio(CURRICULUM, [])).toBeNull();
    const logs: LogEntry[] = [
      { id: 'a', studyDate: '2026-06-22', minutes: 40, sectionId: 1, finishedSection: false },
      { id: 'b', studyDate: '2026-06-23', minutes: 20, sectionId: 1, finishedSection: true }, // S1: 60 / 24
      { id: 'c', studyDate: '2026-06-24', minutes: 500, sectionId: 2, finishedSection: false }, // S2 unfinished: ignored
    ];
    expect(finishedEffortRatio(CURRICULUM, logs)).toBeCloseTo(2.5);
  });
});


describe('a finished course', () => {
  it('computePace reports the real finish date (last section finished), not today', () => {
    const logs: LogEntry[] = CURRICULUM.filter((s) => s.kind === 'core').map((s, i) => ({
      id: `f${s.id}`, studyDate: i < 10 ? '2026-08-01' : '2026-09-24', minutes: s.videoMinutes, sectionId: s.id, finishedSection: true,
    }));
    const r = computePace({ today: '2026-10-14', sections: CURRICULUM, logs, config: CFG });
    expect(r.contentPct).toBe(100);
    expect(r.projectedFinishDate).toBe('2026-09-24');
  });
});
