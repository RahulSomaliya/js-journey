import { describe, it, expect } from 'vitest';
import { computeJourneyStatus } from '@/lib/status';
import { studyDaysAhead, buildDynamicSchedule, type LogEntry } from '@/lib/schedule';
import { REACT_CURRICULUM } from '@/lib/curriculum';
import { REACT_PLAN } from '@/lib/config';

const finished = (date: string, ...numbers: number[]): LogEntry[] =>
  numbers.map((n) => ({ id: `f${n}`, studyDate: date, minutes: 60, sectionId: 100 + n, finishedSection: true }));
const status = (today: string, logs: LogEntry[], coachNote: { body: string; createdAt: string } | null = null) =>
  computeJourneyStatus({ today, sections: REACT_CURRICULUM, logs, config: REACT_PLAN, coachNote });

describe('studyDaysAhead', () => {
  it('counts Mon–Fri days between the projected finish and the target, signed', () => {
    expect(studyDaysAhead('2026-12-22', '2026-12-25', [])).toBe(3); // Tue → Fri: Tue, Wed, Thu banked
    expect(studyDaysAhead('2026-12-25', '2026-12-25', [])).toBe(0);
    expect(studyDaysAhead('2026-12-28', '2026-12-25', [])).toBe(-1); // Mon after a Fri target = 1 study day late
    expect(studyDaysAhead('2027-01-05', '2026-12-25', [])).toBe(-7);
  });
  it('break days are not study days: Fri 30 Oct → Fri 20 Nov is 5 study days with Diwali, 15 without', () => {
    expect(studyDaysAhead('2026-10-30', '2026-11-20', REACT_PLAN.breaks)).toBe(5);
    expect(studyDaysAhead('2026-10-30', '2026-11-20', [])).toBe(15);
    expect(studyDaysAhead('2026-11-20', '2026-10-30', REACT_PLAN.breaks)).toBe(-5);
  });
  it('is exposed on the dynamic schedule next to the calendar-day delta', () => {
    const dyn = buildDynamicSchedule(REACT_CURRICULUM, [], REACT_PLAN, '2026-10-01');
    expect(dyn.projectedFinishDate).toBe('2026-12-22');
    expect(dyn.daysDelta).toBe(3); // calendar days (unchanged engine field)
    expect(dyn.studyDaysDelta).toBe(3);
  });
});

describe('computeJourneyStatus (React plan)', () => {
  it('before the start: on track, week 1 of 10, first goal = §01, plan slack shows as days ahead', () => {
    expect(status('2026-10-01', [])).toEqual({
      pace: 'on-track',
      daysDelta: 3, // 46 study-days of work in a 50-day plan: Tue 22 Dec vs Fri 25 Dec
      week: 1,
      totalWeeks: 10,
      targetDate: '2026-12-25', // Fri 11 Dec + the Diwali break's two study weeks
      deadline: '2027-01-01',
      goal: { sectionNumber: 1, title: 'Welcome, Welcome, Welcome!', due: '2026-10-06' },
      coachNote: null,
      planBreak: null, // Diwali is 31 days out
    });
  });
  it('idle in week 3: behind, re-anchored to today, goal is the next counted section (§04 is skipped)', () => {
    const s = status('2026-10-20', finished('2026-10-06', 1, 2, 3));
    expect(s.pace).toBe('behind');
    expect(s.daysDelta).toBe(-7); // projected Tue 5 Jan 2027 vs Fri 25 Dec
    expect(s.week).toBe(3);
    expect(s.goal).toEqual({ sectionNumber: 5, title: 'Working With Components, Props, and JSX', due: '2026-10-23' });
  });
  it('fast first week: ahead, goal anchored to the last finish', () => {
    const s = status('2026-10-09', finished('2026-10-08', 1, 2, 3, 5, 6, 7));
    expect(s.pace).toBe('ahead');
    expect(s.daysDelta).toBe(7); // projected Wed 16 Dec vs Fri 25 Dec
    expect(s.goal).toEqual({ sectionNumber: 8, title: "Practice Project - Eat-'N-Split (Optional)", due: '2026-10-12' });
  });
  it('course complete: no goal, finish date banked against the target', () => {
    const all = REACT_CURRICULUM.filter((x) => x.kind === 'core').map((x) => x.sortOrder);
    const s = status('2026-12-02', finished('2026-12-01', ...all));
    expect(s.goal).toBeNull();
    expect(s.daysDelta).toBe(18); // Tue 1 Dec vs Fri 25 Dec
    expect(s.pace).toBe('ahead');
  });
  it('passes the latest coach note through', () => {
    const note = { body: 'So proud of you 💚', createdAt: '2026-10-04T10:00:00.000Z' };
    expect(status('2026-10-05', [], note).coachNote).toEqual(note);
  });
  it('credits sections finished mid-session that were not the session’s main section', () => {
    const logs: LogEntry[] = [
      { id: 'p1', studyDate: '2026-10-06', minutes: 150, sectionId: 103, finishedSection: false, alsoFinishedIds: [101, 102] },
    ];
    expect(status('2026-10-06', logs).goal?.sectionNumber).toBe(3);
  });
});

describe('computeJourneyStatus over the Diwali break (Sun 1 – Sun 15 Nov)', () => {
  const DIWALI = { label: 'Diwali', start: '2026-11-01', end: '2026-11-15' };
  // on plan through week 4 (§01–§16 finished by Fri 30 Oct), nothing during the break
  const onPlan = finished('2026-10-30', ...REACT_CURRICULUM.filter((x) => x.kind === 'core' && x.sortOrder <= 16).map((x) => x.sortOrder));
  it('planBreak: null until 14 days out, then the break, through its last day, then null again', () => {
    expect(status('2026-10-17', onPlan).planBreak).toBeNull();
    expect(status('2026-10-18', onPlan).planBreak).toEqual(DIWALI);
    expect(status('2026-11-01', onPlan).planBreak).toEqual(DIWALI);
    expect(status('2026-11-15', onPlan).planBreak).toEqual(DIWALI);
    expect(status('2026-11-16', onPlan).planBreak).toBeNull();
  });
  it('mid-break she reads exactly as she did on the Friday before: on track, +3, week 4, next goal after the break', () => {
    const mid = status('2026-11-09', onPlan);
    expect(mid).toEqual({
      pace: 'on-track',
      daysDelta: 3,
      week: 4,
      totalWeeks: 10,
      targetDate: '2026-12-25',
      deadline: '2027-01-01',
      goal: { sectionNumber: 17, title: 'React Router - Building Single-Page Applications (SPA)', due: '2026-11-18' },
      coachNote: null,
      planBreak: DIWALI,
    });
    expect({ ...status('2026-10-30', onPlan), planBreak: DIWALI }).toEqual(mid);
  });
});
