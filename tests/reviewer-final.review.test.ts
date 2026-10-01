import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildDynamicSchedule, computePace, planTimeline, buildMilestones, streak, type LogEntry,
} from '@/lib/schedule';
import { computeJourneyStatus } from '@/lib/status';
import { REACT_CURRICULUM, CURRICULUM } from '@/lib/curriculum';
import { REACT_PLAN, JS_PLAN } from '@/lib/config';
import { parseJourneySession } from '@/lib/player';
import { roleFromBearer } from '@/lib/auth';

// Adversarial probes (final reviewer). Each scenario is one the break agent's tests did not pin.
const finishThrough = (n: number, date: string): LogEntry[] => REACT_CURRICULUM
  .filter((s) => s.kind === 'core' && s.sortOrder <= n)
  .map((s) => ({ id: `f${s.id}`, studyDate: date, minutes: s.videoMinutes, sectionId: s.id, finishedSection: true }));
const status = (today: string, logs: LogEntry[]) => {
  const s = computeJourneyStatus({ today, sections: REACT_CURRICULUM, logs, config: REACT_PLAN, coachNote: null });
  return { pace: s.pace, daysDelta: s.daysDelta, goal: s.goal, week: s.week };
};

describe('BEHIND and OVERDUE going into Diwali — the break must not add to it', () => {
  // finished through §12 on Wed 21 Oct, then idle: §13 overdue before the break
  const logs = finishThrough(12, '2026-10-21');
  it('Fri 30 Oct (overdue, re-anchored to today) reads exactly like every break day', () => {
    const fri = status('2026-10-30', logs);
    expect(fri.pace).toBe('behind');
    for (const d of ['2026-10-31', '2026-11-01', '2026-11-04', '2026-11-09', '2026-11-15']) {
      expect(status(d, logs)).toEqual(fri);
    }
  });
  it('studying on a break day never reads worse than staying idle', () => {
    const idle = status('2026-11-09', logs);
    const studied = status('2026-11-09', [
      ...logs, { id: 'b1', studyDate: '2026-11-09', minutes: 120, sectionId: 113, finishedSection: true },
    ]);
    expect(studied.daysDelta).toBeGreaterThanOrEqual(idle.daysDelta);
  });
  it('a log on a break day does not break or shrink the streak (break days are skipped)', () => {
    const daily: LogEntry[] = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-11-04']
      .map((d, i) => ({ id: `s${i}`, studyDate: d, minutes: 60, sectionId: 113, finishedSection: false }));
    expect(streak(daily, '2026-11-15', REACT_PLAN)).toBe(5);
  });
});

describe('plan math, recomputed by hand', () => {
  it('React: 3916 core content-min, 429/wk, 10 weeks, Fri 25 Dec target, Fri 1 Jan deadline', () => {
    expect(planTimeline(REACT_CURRICULUM, REACT_PLAN)).toEqual({ weeks: 10, target: '2026-12-25', deadline: '2027-01-01' });
    const thru = buildMilestones(REACT_CURRICULUM, REACT_PLAN).map((m) => [m.dueDate, m.throughSectionId - 100]);
    expect(thru).toEqual([
      ['2026-10-09', 5], ['2026-10-16', 9], ['2026-10-23', 12], ['2026-10-30', 16], ['2026-11-20', 18],
      ['2026-11-27', 22], ['2026-12-04', 25], ['2026-12-11', 28], ['2026-12-18', 28], ['2026-12-25', 31],
    ]);
  });
  it('JS history: an empty breaks list keeps every milestone on a Friday 7 days apart', () => {
    const ms = buildMilestones(CURRICULUM, JS_PLAN);
    ms.forEach((m, i) => expect(m.dueDate).toBe(new Date(Date.UTC(2026, 5, 26 + 7 * i)).toISOString().slice(0, 10)));
    expect(computePace({ today: '2026-10-01', sections: CURRICULUM, logs: [], config: JS_PLAN }).studyDaysElapsed).toBeGreaterThan(0);
  });
  it('the dynamic projection on the first day back starts counting on Mon 16 Nov, not during Diwali', () => {
    const dyn = buildDynamicSchedule(REACT_CURRICULUM, finishThrough(16, '2026-10-30'), REACT_PLAN, '2026-11-16');
    for (const due of Object.values(dyn.perSectionDue)) expect(due >= '2026-11-16').toBe(true);
  });
});

describe('player boundary', () => {
  afterEach(() => { vi.unstubAllEnvs(); });
  it('bearer parsing: lower-case scheme ok, a token with spaces or an empty token is not', () => {
    vi.stubEnv('STUDENT_TOKEN', 'stu-tok');
    expect(roleFromBearer('bearer stu-tok')).toBe('student');
    expect(roleFromBearer('Bearer ')).toBeNull();
    expect(roleFromBearer('Bearer stu-tok extra')).toBeNull();
    expect(roleFromBearer('Basic stu-tok')).toBeNull();
  });
  it('a session the player can legitimately build (sectionNumber with lecture 1, finished = main) validates', () => {
    const r = parseJourneySession({
      id: '3f1c2a9e-8b7d-4c6e-9a1b-2c3d4e5f6a7b', course: 'react-2023',
      startedAt: '2026-11-16T04:00:00.000Z', endedAt: '2026-11-16T04:00:00.000Z', studyDate: '2026-11-16',
      minutes: 1, sectionNumber: 1, lecturesCompleted: [{ section: 1, lecture: 1, title: 'x' }],
      finishedSections: [1, 1], mood: '🙂', note: '   ',
    });
    expect(r.ok).toBe(true);
  });
});
