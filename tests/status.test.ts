import { describe, it, expect } from 'vitest';
import { computeJourneyStatus, planExpectedMinutes, planPace } from '@/lib/status';
import { buildMilestones, coreSections, type LogEntry } from '@/lib/schedule';
import { addDays, isStudyDay } from '@/lib/date';
import { REACT_CURRICULUM } from '@/lib/curriculum';
import { REACT_PLAN } from '@/lib/config';
import type { ProgressSnapshot } from '@/lib/player';
import { REACT_SECTION_DUE, WEEK1_LOGS, WEEK1_SNAPSHOT } from './helpers';

const finished = (date: string, ...numbers: number[]): LogEntry[] =>
  numbers.map((n) => ({ id: `f${n}`, studyDate: date, minutes: 60, sectionId: 100 + n, finishedSection: true }));
// no snapshot: the logs-only reading (the v4 snapshot model has its own blocks at the end)
const status = (today: string, logs: LogEntry[], coachNote: { body: string; createdAt: string } | null = null) =>
  computeJourneyStatus({ today, sections: REACT_CURRICULUM, logs, config: REACT_PLAN, coachNote, snapshot: null });
const V4_FIELDS = { startDate: '2026-10-05', dailyGoalMinutes: 150, projection: null };
const DIWALI = { label: 'Diwali', start: '2026-11-01', end: '2026-11-15' };


describe('computeJourneyStatus (React plan)', () => {
  it('before the start: on track, week 1 of 10, goal = week 1 of the plan (the plan\'s slack is not "ahead")', () => {
    expect(status('2026-10-01', [])).toEqual({
      pace: 'on-track',
      daysDelta: 0,
      week: 1,
      totalWeeks: 10,
      targetDate: '2026-12-25', // Fri 11 Dec + the Diwali break's two study weeks
      deadline: '2027-01-01',
      goal: { sectionNumber: 5, title: 'Working With Components, Props, and JSX', due: '2026-10-09' },
      coachNote: null,
      planBreak: null, // Diwali is 31 days out
      sectionDue: REACT_SECTION_DUE,
      skippedSections: [4],
      studyWeekdays: [1, 2, 3, 4, 5],
      planBreaks: [DIWALI], // every break, always — the player's streak walks back through them
      ...V4_FIELDS, // no snapshot → no projection
    });
  });
  it('idle in week 3: behind, goal = this plan week\'s goal (spec: "Finish 12 … by Fri 23 Oct")', () => {
    const s = status('2026-10-20', finished('2026-10-06', 1, 2, 3));
    expect(s.pace).toBe('behind');
    expect(s.daysDelta).toBe(-7); // week 2's goal (through §09, 708 content-min) missed: 601 min short = 7.0 study days
    expect(s.week).toBe(3);
    expect(s.goal).toEqual({ sectionNumber: 12, title: 'Effects and Data Fetching', due: '2026-10-23' });
  });
  it('fast first week: ahead, and week 1\'s goal is met, so the goal moves on to week 2\'s', () => {
    const s = status('2026-10-09', finished('2026-10-08', 1, 2, 3, 5, 6, 7));
    expect(s.pace).toBe('ahead');
    expect(s.daysDelta).toBe(4); // through §07 (618) vs this week's goal through §05 (281): 337 min = 3.9 study days
    expect(s.goal).toEqual({ sectionNumber: 9, title: 'Part 2 - Intermediate React (2 Projects)', due: '2026-10-16' });
  });
  it('course complete: no goal, finish date banked against the target', () => {
    const all = REACT_CURRICULUM.filter((x) => x.kind === 'core').map((x) => x.sortOrder);
    const s = status('2026-12-02', finished('2026-12-01', ...all));
    expect(s.goal).toBeNull();
    expect(s.daysDelta).toBe(11); // all 3916 content-min vs this week's goal through §25 (2997): 10.7 study days
    expect(s.pace).toBe('ahead');
  });
  it('passes the latest coach note through', () => {
    const note = { body: 'So proud of you 💚', createdAt: '2026-10-04T10:00:00.000Z' };
    expect(status('2026-10-05', [], note).coachNote).toEqual(note);
  });
  it('credits sections finished mid-session that were not the session’s main section', () => {
    // §05 is the row's own section; §01–§03 finished on the way — week 1's goal is met
    const logs: LogEntry[] = [
      { id: 'p1', studyDate: '2026-10-08', minutes: 150, sectionId: 105, finishedSection: true, alsoFinishedIds: [101, 102, 103] },
    ];
    expect(status('2026-10-08', logs).goal?.sectionNumber).toBe(9);
  });
  it('goal.due always equals sectionDue of the goal section (the player shows both on one screen)', () => {
    for (const [today, logs] of [['2026-10-01', []], ['2026-10-20', finished('2026-10-06', 1, 2, 3)], ['2026-11-09', finished('2026-10-30', 1, 2, 3, 5)]] as const) {
      const s = status(today, [...logs]);
      expect(s.goal && s.sectionDue[String(s.goal.sectionNumber)]).toBe(s.goal?.due);
    }
  });
  it('sectionDue: every counted section → the Friday of the plan week that finishes it; §04 (skipped) has none', () => {
    const s = status('2026-10-01', []);
    expect(s.sectionDue).toEqual(REACT_SECTION_DUE);
    expect(s.sectionDue['4']).toBeUndefined();
    expect(s.skippedSections).toEqual([4]);
  });
  it('sectionDue is the fixed plan: it does not move when she is ahead or behind', () => {
    expect(status('2026-10-20', finished('2026-10-06', 1, 2, 3)).sectionDue).toEqual(REACT_SECTION_DUE);
    expect(status('2026-10-09', finished('2026-10-08', 1, 2, 3, 5, 6, 7)).sectionDue).toEqual(REACT_SECTION_DUE);
  });
});

describe('the plan calendar the player\'s streak walks', () => {
  it('Mon–Fri + every break, whatever today is (planBreak only names the current / next one)', () => {
    for (const today of ['2026-10-01', '2026-11-04', '2026-12-01']) {
      expect([status(today, []).studyWeekdays, status(today, []).planBreaks]).toEqual([[1, 2, 3, 4, 5], [DIWALI]]);
    }
    expect(status('2026-12-01', []).planBreak).toBeNull(); // the break is over, but the streak still walks back through it
  });
  it('the weekdays are the server\'s own study days (isStudyDay), so the two calendars cannot drift', () => {
    const week = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];
    expect(week.filter((d) => isStudyDay(d, [])).map((d) => week.indexOf(d) + 1)).toEqual(status('2026-10-01', []).studyWeekdays);
  });
});

describe('computeJourneyStatus over the Diwali break (Sun 1 – Sun 15 Nov)', () => {
  // on plan through week 4 (§01–§16 finished by Fri 30 Oct), nothing during the break
  const onPlan = finished('2026-10-30', ...REACT_CURRICULUM.filter((x) => x.kind === 'core' && x.sortOrder <= 16).map((x) => x.sortOrder));
  it('planBreak: null until 14 days out, then the break, through its last day, then null again', () => {
    expect(status('2026-10-17', onPlan).planBreak).toBeNull();
    expect(status('2026-10-18', onPlan).planBreak).toEqual(DIWALI);
    expect(status('2026-11-01', onPlan).planBreak).toEqual(DIWALI);
    expect(status('2026-11-15', onPlan).planBreak).toEqual(DIWALI);
    expect(status('2026-11-16', onPlan).planBreak).toBeNull();
  });
  it('mid-break she reads exactly as she did on the Friday before: on track, week 4, goal = week 5 (after the break)', () => {
    const mid = status('2026-11-09', onPlan);
    expect(mid).toEqual({
      pace: 'on-track',
      daysDelta: 0,
      week: 4,
      totalWeeks: 10,
      targetDate: '2026-12-25',
      deadline: '2027-01-01',
      goal: { sectionNumber: 18, title: 'Advanced State Management - The Context API', due: '2026-11-20' },
      coachNote: null,
      planBreak: DIWALI,
      sectionDue: REACT_SECTION_DUE,
      skippedSections: [4],
      studyWeekdays: [1, 2, 3, 4, 5],
      planBreaks: [DIWALI],
      ...V4_FIELDS,
    });
    expect({ ...status('2026-10-30', onPlan), planBreak: DIWALI }).toEqual(mid);
  });
});

// ONE pace model (2026-10-01 review): the pill used computePace (prorated daily, ±half week) for the word
// and the dynamic projection for the number, so the typical fixture read a bare "Behind" while the plan
// list said week 3 was on schedule. Both of those swing for a student who is EXACTLY on plan (probe:
// projection +3 on day 1 = the plan's slack, −5 on Thu 24 Dec; prorated "behind" every Wed/Thu).
describe('planPace without a snapshot — the weekly goals over whole sections from the logs', () => {
  const core = coreSections(REACT_CURRICULUM);
  const milestones = buildMilestones(REACT_CURRICULUM, REACT_PLAN);
  // finishes each week's goal ON its Friday, nothing early
  const onPlanUpTo = (today: string): LogEntry[] => milestones.filter((m) => m.dueDate <= today).flatMap((m, i, done) => {
    const from = i === 0 ? 0 : (core.find((c) => c.id === done[i - 1].throughSectionId)?.sortOrder ?? 0);
    const to = core.find((c) => c.id === m.throughSectionId)?.sortOrder ?? 0;
    return core.filter((c) => c.sortOrder > from && c.sortOrder <= to).map((c) => ({ id: `p${c.id}`, studyDate: m.dueDate, minutes: 150, sectionId: c.id, finishedSection: true }));
  });
  const pace = (today: string, logs: LogEntry[]) => planPace({ today, sections: REACT_CURRICULUM, logs, config: REACT_PLAN, snapshot: null });

  it('exactly on plan reads On track on EVERY study day — mid-week, the first day, the last week', () => {
    for (let d = '2026-10-05'; d <= '2026-12-31'; d = addDays(d, 1)) {
      if (isStudyDay(d, REACT_PLAN.breaks)) expect([d, pace(d, onPlanUpTo(d))]).toEqual([d, { pace: 'on-track', daysDelta: 0 }]);
    }
  });
  it('behind = a PAST Friday\'s goal is unmet; the Friday itself is not behind yet, the Saturday is', () => {
    const upToWeek1 = onPlanUpTo('2026-10-09');
    expect(pace('2026-10-16', upToWeek1)).toEqual({ pace: 'on-track', daysDelta: 0 }); // week 2 due today
    expect(pace('2026-10-17', upToWeek1)).toEqual({ pace: 'behind', daysDelta: -5 }); // §06–§09 = 427 min ≈ 5 study days
    expect(pace('2026-10-19', [...upToWeek1, ...finished('2026-10-18', 6, 7)])).toEqual({ pace: 'behind', daysDelta: -1 }); // §08–§09 = 90 min
  });
  it('a sliver short still says Behind by 1 day — never a bare "Behind" (and ahead needs ≥ half a study day)', () => {
    const allButNine = [...onPlanUpTo('2026-10-09'), ...finished('2026-10-16', 6, 7, 8)]; // §09 = 1 min
    expect(pace('2026-10-17', allButNine)).toEqual({ pace: 'behind', daysDelta: -1 });
    expect(pace('2026-10-14', [...onPlanUpTo('2026-10-09'), ...finished('2026-10-13', 6, 7, 8, 9, 10)])).toEqual({ pace: 'ahead', daysDelta: 2 }); // §10 = 159 min past the goal
    expect(pace('2026-10-14', [...onPlanUpTo('2026-10-09'), ...finished('2026-10-13', 6, 7, 8, 9)])).toEqual({ pace: 'on-track', daysDelta: 0 });
  });
  it('a section finished out of order does not count towards a goal until the ones before it are done (same rule as the plan list)', () => {
    expect(pace('2026-10-10', finished('2026-10-08', 1, 2, 5))).toEqual({ pace: 'behind', daysDelta: -3 }); // §03 open: through §02 only, 249 min short = 2.9 days
  });
  it('pace and daysDelta never disagree: behind ⇔ < 0, ahead ⇔ > 0', () => {
    const cases: [string, LogEntry[]][] = [
      ['2026-10-01', []], ['2026-10-21', finished('2026-10-08', 1, 2, 3, 5)], ['2026-10-09', finished('2026-10-08', 1, 2, 3, 5, 6, 7)],
      ['2026-11-09', finished('2026-10-21', 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12)], ['2027-01-04', []],
    ];
    for (const [today, logs] of cases) {
      const p = status(today, logs);
      expect([today, p.pace]).toEqual([today, p.daysDelta < 0 ? 'behind' : p.daysDelta > 0 ? 'ahead' : 'on-track']);
    }
  });
});

// v4 (2026-10-12, spec-v4 "The pace is wrong"): Monday of week 2 she was on 07 lecture 1 with 06 done, and
// both apps said "Behind by 3 days". Root cause: "finished" came from session logs alone (no session ever
// reported 01 — one article in it is unticked) and only WHOLE sections in order counted, so the loop stopped
// at 01 and credited nothing: 281 content-min owed for week 1 ÷ 85.8 a study day = "Behind by 3 days".
describe('v4 pace — content from her latest snapshot, prorated to the START of today', () => {
  const v4 = (today: string, snapshot: ProgressSnapshot | null, logs: LogEntry[] = WEEK1_LOGS) =>
    computeJourneyStatus({ today, sections: REACT_CURRICULUM, logs, config: REACT_PLAN, coachNote: null, snapshot });

  it('Mon 12 Oct (today\'s case): Ahead by 2 days, not "Behind by 3 days"', () => {
    // done     = the snapshot's counted lecture content: 27 360 s of 01–03 + 05–06 = 456 min
    //            (04 is skipped by the plan; 01's unticked lecture is a 0-second article — content counts)
    // expected = week 1's goal (through 05: 31 + 1 + 75 + 174 = 281 min) + week 2's content × 0/5 —
    //            Monday morning holds her to last week's goal exactly; today is not over yet
    // per day  = week 2's content (06–09: 175 + 162 + 89 + 1 = 427 min) ÷ 5 study days = 85.4 min
    // delta    = (456 − 281) ÷ 85.4 = 2.05 → +2
    const s = v4('2026-10-12', WEEK1_SNAPSHOT);
    expect([s.pace, s.daysDelta]).toEqual(['ahead', 2]);
    expect(s.goal).toEqual({ sectionNumber: 9, title: 'Part 2 - Intermediate React (2 Projects)', due: '2026-10-16' });
  });
  it('without a snapshot the logs-only reading stays (it is exactly what she saw: Behind by 3 days)', () => {
    expect(planPace({ today: '2026-10-12', sections: REACT_CURRICULUM, logs: WEEK1_LOGS, config: REACT_PLAN, snapshot: null }))
      .toEqual({ pace: 'behind', daysDelta: -3 });
  });
  it('the contract fields: startDate, dailyGoalMinutes (2.5 h a study day), the projection', () => {
    const s = v4('2026-10-12', WEEK1_SNAPSHOT);
    expect(s.startDate).toBe('2026-10-05');
    expect(s.dailyGoalMinutes).toBe(150);
    // rate = 456 min ÷ 5 elapsed study days (Mon 5 – Fri 9; today has no study yet) = 91.2 → "about 1h 31m"
    // left = 3918 counted outline min − 456 = 3462 → ⌈3462 ÷ 91.2⌉ = 38 study days, today the first:
    // Mon 12 Oct … (Diwali skipped) … Wed 16 Dec; target Fri 25 Dec is 7 study days later
    expect(s.projection).toEqual({ finish: '2026-12-16', studyDaysLeft: 38, minutesPerStudyDay: 91, vsTarget: 7 });
  });
  it('expected grows through the week: the same progress reads less ahead each day she adds nothing', () => {
    const deltas = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']
      .map((d) => v4(d, WEEK1_SNAPSHOT).daysDelta);
    // (456 − (281 + 427 × k/5)) ÷ 85.4 for k = 0..5 study days of week 2 before today: 2.05, 1.05, 0.05, −0.95, −1.95, −2.95
    expect(deltas).toEqual([2, 1, 0, -1, -2, -3]);
  });
  it('|delta| < 1 is On track, and the words come from daysDelta alone', () => {
    const s = v4('2026-10-14', WEEK1_SNAPSHOT);
    expect([s.pace, s.daysDelta]).toEqual(['on-track', 0]);
    const behind = v4('2026-10-15', WEEK1_SNAPSHOT);
    expect([behind.pace, behind.daysDelta]).toEqual(['behind', -1]);
  });
  it('a student exactly on the prorated plan reads On track on every study day (content, not whole sections)', () => {
    const core = coreSections(REACT_CURRICULUM);
    const total = core.reduce((sum, c) => sum + c.videoMinutes, 0);
    for (let d = '2026-10-05'; d <= '2026-12-31'; d = addDays(d, 1)) {
      if (!isStudyDay(d, REACT_PLAN.breaks)) continue;
      // her content = the plan's own expectation for this morning (planExpected), no doneLectures: videoSecondsDone
      const minutes = Math.min(total, planExpectedMinutes(d, REACT_CURRICULUM, REACT_PLAN));
      const snap = { ...WEEK1_SNAPSHOT, doneLectures: undefined, sectionsDone: [], videoSecondsDone: minutes * 60 };
      expect([d, v4(d, snap, []).pace, v4(d, snap, []).daysDelta]).toEqual([d, 'on-track', 0]);
    }
  });
  it('without doneLectures: videoSecondsDone minus the plan-skipped sections she finished', () => {
    const noLectures = { ...WEEK1_SNAPSHOT, doneLectures: undefined };
    expect(v4('2026-10-12', noLectures).daysDelta).toBe(2); // 27 360 s = 456 min, as above
    // 04 (skipped, 112 min) finished too: its minutes are not plan content
    const with04 = { ...noLectures, videoSecondsDone: 27_360 + 6_746, sectionsDone: [2, 3, 4, 5, 6] };
    expect(v4('2026-10-12', with04).daysDelta).toBe(2);
  });
  it('a "keep going" week (React 29 = 7.9 h spans weeks 9–10) expects part of that section, not nothing', () => {
    // weeks 9 + 10 are ONE stretch: 28 done by Fri 11 Dec (3407 min), the rest (509 min) over its 10 study days
    expect(planExpectedMinutes('2026-12-14', REACT_CURRICULUM, REACT_PLAN)).toBeCloseTo(3407, 5); // Mon of week 9
    expect(planExpectedMinutes('2026-12-21', REACT_CURRICULUM, REACT_PLAN)).toBeCloseTo(3407 + 509 / 2, 5); // Mon of week 10
    expect(planExpectedMinutes('2026-12-26', REACT_CURRICULUM, REACT_PLAN)).toBe(3916); // past the target
    expect(planExpectedMinutes('2026-10-01', REACT_CURRICULUM, REACT_PLAN)).toBe(0); // before the start
  });
  it('a plan break holds the expectation still (Diwali = the Friday before)', () => {
    expect(planExpectedMinutes('2026-11-09', REACT_CURRICULUM, REACT_PLAN)).toBe(planExpectedMinutes('2026-10-31', REACT_CURRICULUM, REACT_PLAN));
    expect(planExpectedMinutes('2026-11-16', REACT_CURRICULUM, REACT_PLAN)).toBe(1618); // Mon back: week 4's goal through 16
  });
});

describe('v4 "finished" = snapshot sectionsDone ∪ logs (planGoal, never logs alone)', () => {
  it('a section the snapshot reports done counts for the goal even when no log ever said so', () => {
    // logs report nothing; the snapshot has 01–09 done → week 2's goal is met, the goal moves to week 3's
    const snap = { ...WEEK1_SNAPSHOT, sectionsDone: [1, 2, 3, 5, 6, 7, 8, 9], doneLectures: undefined, videoSecondsDone: 708 * 60 };
    const s = computeJourneyStatus({ today: '2026-10-14', sections: REACT_CURRICULUM, logs: [], config: REACT_PLAN, coachNote: null, snapshot: snap });
    expect(s.goal?.sectionNumber).toBe(12);
  });
});

describe('v4 projection — where her CURRENT pace lands', () => {
  const proj = (today: string, snapshot: ProgressSnapshot | null) =>
    computeJourneyStatus({ today, sections: REACT_CURRICULUM, logs: [], config: REACT_PLAN, coachNote: null, snapshot }).projection;
  it('null without a snapshot, and until 2 elapsed study days have study', () => {
    expect(proj('2026-10-12', null)).toBeNull();
    const day1 = { ...WEEK1_SNAPSHOT, days: { '2026-10-05': 7200 } };
    expect(proj('2026-10-06', day1)).toBeNull(); // Tue morning: one study day with study
    expect(proj('2026-10-06', { ...day1, days: { ...day1.days, '2026-10-06': 600 } })).not.toBeNull(); // Tue counts once ≥ 5 min
    expect(proj('2026-10-06', { ...day1, days: { ...day1.days, '2026-10-06': 299 } })).toBeNull();
  });
  it('today counts in the rate only with ≥ 5 min; then the finish counts from tomorrow', () => {
    const studied = { ...WEEK1_SNAPSHOT, days: { ...WEEK1_SNAPSHOT.days, '2026-10-12': 1800 } };
    // 456 ÷ 6 = 76 a study day → ⌈3462 ÷ 76⌉ = 46 study days AFTER Mon 12 Oct (Tue 13 is the first) → Tue 29 Dec;
    // Fri 25 + Mon 28 Dec lie between the target and it → 2 study days after the target
    expect(proj('2026-10-12', studied)).toEqual({ finish: '2026-12-29', studyDaysLeft: 46, minutesPerStudyDay: 76, vsTarget: -2 });
  });
  it('weekend study adds to what she covered, never to the days divided by', () => {
    const sat = proj('2026-10-10', WEEK1_SNAPSHOT); // Sat: 5 elapsed study days, Saturday's hour is in the content already
    expect(sat?.minutesPerStudyDay).toBe(91);
    expect(sat?.finish).toBe('2026-12-16'); // the next study day (Mon 12 Oct) is day 1
  });
  it('null once the counted content is all done — nothing left to project', () => {
    const all = { ...WEEK1_SNAPSHOT, doneLectures: undefined, videoSecondsDone: 3916 * 60, sectionsDone: coreSections(REACT_CURRICULUM).map((c) => c.sortOrder) };
    expect(proj('2026-12-01', all)).toBeNull();
  });
});
