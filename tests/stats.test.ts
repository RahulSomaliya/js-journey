import { describe, it, expect } from 'vitest';
import { computeStats, percentLabel, streak, STREAK_MIN_SECONDS, type StudyCalendar } from '@/lib/stats';
import { computeJourneyStatus } from '@/lib/status';
import { REACT_CURRICULUM } from '@/lib/curriculum';
import { REACT_PLAN } from '@/lib/config';
import type { LogEntry } from '@/lib/schedule';
import type { ProgressSnapshot } from '@/lib/player';

// The coach view shows "the same stats she sees" (spec-v2 decision 7): these mirror the
// Course Player's home row (course-player web/src/lib/stats.ts + screens/home/Stats.tsx).
const at = (iso: string) => new Date(iso);
const statusOn = (today: string, logs: LogEntry[] = []) =>
  computeJourneyStatus({ today, sections: REACT_CURRICULUM, logs, config: REACT_PLAN, coachNote: null });
const SNAP: ProgressSnapshot = {
  course: 'react-2023',
  takenAt: Date.parse('2026-10-07T09:55:00.000Z'),
  lecturesDone: 58,
  lecturesTotal: 410,
  videoSecondsDone: 24_180,
  videoSecondsTotal: 241_800,
  sectionsDone: [1, 2, 3],
  current: { sectionNumber: 5, lectureNumber: 4, title: 'Creating And Reusing a Component' },
  days: { '2026-10-07': 7200, '2026-10-06': 1800, '2026-10-05': 250, '2026-10-02': 3600 },
};
const stats = (now: string, snapshot: ProgressSnapshot | null, logs: LogEntry[] = [], today = now.slice(0, 10)) =>
  computeStats({ now: at(now), snapshot, logs, sections: REACT_CURRICULUM, status: statusOn(today, logs), startDate: REACT_PLAN.startDate });

describe('computeStats from the player snapshot', () => {
  const s = stats('2026-10-07T10:00:00.000Z', SNAP); // Wed 7 Oct, 15:30 IST
  it('Today = seconds studied on today\'s IST date', () => {
    expect(s.today).toEqual({ date: '2026-10-07', seconds: 7200 });
    expect(s.source).toBe('snapshot');
    expect(s.asOf).toBe('2026-10-07T09:55:00.000Z');
  });
  it(`Streak = study days in a row with ≥ ${STREAK_MIN_SECONDS / 60} min, ending today (a 4-min study day ends it)`, () => {
    expect(s.streak).toBe(2); // Wed 7 + Tue 6 Oct; Mon 5 Oct had 250 s
  });
  it('Complete = video seconds done ÷ course total, labelled like the player, + lectures', () => {
    expect(s.complete).toEqual({ percent: 10, label: '10%', lecturesDone: 58, lecturesTotal: 410 });
  });
  it('Due = the course target date + pace from JourneyStatus', () => {
    expect(s.due).toEqual({ date: '2026-12-25', pace: 'on-track', daysDelta: statusOn('2026-10-07').daysDelta, onBreak: null });
  });
  it('the 30-day series ends today and averages over all 30 days', () => {
    expect(s.last30.days).toHaveLength(30);
    expect(s.last30.days[0]).toEqual({ date: '2026-09-08', seconds: 0 });
    expect(s.last30.days[29]).toEqual({ date: '2026-10-07', seconds: 7200 });
    expect(s.last30.days.find((d) => d.date === '2026-10-02')?.seconds).toBe(3600);
    expect(s.last30.averageSeconds).toBeCloseTo((7200 + 1800 + 250 + 3600) / 30);
  });
  it('passes the lecture "Continue" points at', () => {
    expect(s.current).toEqual(SNAP.current);
  });
  it('a streak survives a day she has not studied yet (today is in progress until it ends)', () => {
    const next = stats('2026-10-08T04:00:00.000Z', SNAP); // Thu 8 Oct, 09:30 IST, nothing yet
    expect(next.today.seconds).toBe(0);
    expect(next.streak).toBe(2);
    expect(stats('2026-10-09T04:00:00.000Z', SNAP).streak).toBe(0); // Fri: Thu was missed
  });
});

describe('IST midnight edge', () => {
  const snap = { ...SNAP, days: { '2026-10-05': 3600 } };
  it('23:59:59 IST is still that day (UTC would already be the same date, but…)', () => {
    const s = stats('2026-10-05T18:29:59.000Z', snap);
    expect(s.today).toEqual({ date: '2026-10-05', seconds: 3600 });
    expect(s.streak).toBe(1);
  });
  it('00:00 IST is the next day even though it is still 5 Oct in UTC', () => {
    const s = stats('2026-10-05T18:30:00.000Z', snap, [], '2026-10-06');
    expect(s.today).toEqual({ date: '2026-10-06', seconds: 0 });
    expect(s.streak).toBe(1); // today (Tue) is still in progress: Monday's study keeps it alive
    expect(s.last30.days[29].date).toBe('2026-10-06');
  });
  it('a study day missed ends the streak at IST midnight, not UTC midnight', () => {
    const mon = { ...SNAP, days: { '2026-10-12': 3600 } };
    expect(stats('2026-10-13T18:29:59.000Z', mon, [], '2026-10-13').streak).toBe(1); // Tue 23:59:59 IST: Tue in progress
    expect(stats('2026-10-13T18:30:00.000Z', mon, [], '2026-10-14').streak).toBe(0); // Wed 00:00 IST (Tue in UTC): Tue missed
  });
  it('the weekend before IST Monday 00:00 is skipped, not missed', () => {
    const fri = { ...SNAP, days: { '2026-10-09': 3600 } };
    expect(stats('2026-10-11T18:30:00.000Z', fri, [], '2026-10-12').streak).toBe(1); // Mon 00:00 IST, Sun in UTC
  });
});

// The streak counts STUDY days (her plan: Mon–Fri, Diwali 1–15 Nov off). Walking back from today:
// ≥ 5 min adds 1 (weekends + break days too); a plan study day under 5 min ends it — except today,
// still in progress; a weekend / break day under 5 min is skipped. SAME TABLE as course-player
// web/src/lib/stats.test.ts (lib/stats.ts mirrors its rule) — change both together.
const PLAN: StudyCalendar = { studyWeekdays: [1, 2, 3, 4, 5], breaks: [{ start: '2026-11-01', end: '2026-11-15' }] };
const M = 900; // a real study day
const STREAK_CASES: { name: string; days: Record<string, number>; today: string; want: number }[] = [
  { name: 'weekend gap: Thu + Fri, then Monday studied', days: { '2026-10-08': M, '2026-10-09': M, '2026-10-12': M }, today: '2026-10-12', want: 3 },
  { name: 'weekend gap: Monday not studied yet (today in progress)', days: { '2026-10-08': M, '2026-10-09': M }, today: '2026-10-12', want: 2 },
  { name: 'a Sunday with nothing is skipped', days: { '2026-10-08': M, '2026-10-09': M }, today: '2026-10-11', want: 2 },
  { name: 'weekend study adds', days: { '2026-10-09': M, '2026-10-10': 600, '2026-10-11': 300, '2026-10-12': M }, today: '2026-10-12', want: 4 },
  { name: 'missed Wednesday breaks it', days: { '2026-10-12': M, '2026-10-13': M, '2026-10-15': M }, today: '2026-10-15', want: 1 },
  { name: 'a study day under 5 min breaks it', days: { '2026-10-12': M, '2026-10-13': 299, '2026-10-14': M }, today: '2026-10-14', want: 1 },
  { name: 'yesterday (a study day) missed → 0', days: { '2026-10-12': M }, today: '2026-10-14', want: 0 },
  { name: 'today in progress under 5 min neither adds nor breaks', days: { '2026-10-12': M, '2026-10-13': 120 }, today: '2026-10-13', want: 1 },
  { name: 'today at 5 min adds', days: { '2026-10-12': M, '2026-10-13': 300 }, today: '2026-10-13', want: 2 },
  { name: 'Diwali gap: Thu 29 + Fri 30 Oct, then Mon 16 Nov', days: { '2026-10-29': M, '2026-10-30': M, '2026-11-16': M }, today: '2026-11-16', want: 3 },
  { name: 'during Diwali the streak holds', days: { '2026-10-29': M, '2026-10-30': M }, today: '2026-11-04', want: 2 },
  { name: 'study on a break day adds', days: { '2026-10-30': M, '2026-11-03': 1200 }, today: '2026-11-04', want: 2 },
  { name: 'missing the last study day before the break still breaks it', days: { '2026-10-29': M }, today: '2026-11-04', want: 0 },
  { name: 'crosses month ends', days: { '2026-09-30': M, '2026-10-01': M }, today: '2026-10-01', want: 2 },
  { name: 'fresh profile', days: {}, today: '2026-10-01', want: 0 },
];

describe('streak (study days)', () => {
  it.each(STREAK_CASES)('$name → $want', ({ days, today, want }) => {
    expect(streak(days, today, PLAN)).toBe(want);
  });
  it('nothing studied at all on a plan with no study days → 0 (the walk stops at the oldest study day)', () => {
    expect(streak({}, '2026-10-14', { studyWeekdays: [], breaks: [] })).toBe(0);
    expect(streak({ '2026-10-05': M, '2026-10-09': M }, '2026-10-14', { studyWeekdays: [], breaks: [] })).toBe(2);
  });
  it('computeStats walks the calendar JourneyStatus carries (the player gets the same one)', () => {
    const snap = { ...SNAP, days: { '2026-10-29': M, '2026-10-30': M } };
    expect(stats('2026-11-04T06:00:00.000Z', snap).streak).toBe(2); // mid-Diwali: held, not 0
    expect(stats('2026-11-16T06:00:00.000Z', { ...snap, days: { ...snap.days, '2026-11-16': M } }).streak).toBe(3);
  });
});

describe('Diwali break (Sun 1 – Sun 15 Nov)', () => {
  const snap = { ...SNAP, days: { '2026-10-30': 5400, '2026-10-29': 5400 } };
  it('the Friday before: pace as usual, no break line yet', () => {
    const s = stats('2026-10-30T06:00:00.000Z', snap);
    expect(s.due.pace).not.toBeNull();
    expect(s.due.onBreak).toBeNull();
  });
  it('during the break: no pace to keep, the break instead (its "back on" day is weekView\'s — one rule, addDays(end, 1))', () => {
    const s = stats('2026-11-04T06:00:00.000Z', snap);
    expect(s.due).toEqual({ date: '2026-12-25', pace: null, daysDelta: expect.any(Number), onBreak: { label: 'Diwali' } });
    expect(s.today.seconds).toBe(0);
  });
  it('first day back: pace returns; the 30-day chart keeps the break as empty days', () => {
    const s = stats('2026-11-16T06:00:00.000Z', snap);
    expect(s.due.pace).not.toBeNull();
    expect(s.due.onBreak).toBeNull();
    expect(s.last30.days.filter((d) => d.date >= '2026-11-01' && d.date <= '2026-11-15').every((d) => d.seconds === 0)).toBe(true);
    expect(s.last30.days.find((d) => d.date === '2026-10-30')?.seconds).toBe(5400);
  });
});

describe('computeStats without a snapshot: falls back to her sessions', () => {
  const logs: LogEntry[] = [
    { id: 'a', studyDate: '2026-10-06', minutes: 90, sectionId: 103, finishedSection: true, alsoFinishedIds: [101, 102], source: 'player',
      lecturesCompleted: [{ section: 3, lecture: 1, title: 'a' }, { section: 3, lecture: 2, title: 'b' }] },
    { id: 'b', studyDate: '2026-10-07', minutes: 30, sectionId: 105, finishedSection: false, source: 'player',
      lecturesCompleted: [{ section: 3, lecture: 2, title: 'b' }, { section: 5, lecture: 1, title: 'c' }] },
    { id: 'c', studyDate: '2026-10-07', minutes: 0, sectionId: 105, finishedSection: false, source: 'manual', note: 'read the docs' },
    { id: 'd', studyDate: '2026-10-07', minutes: 20, sectionId: 105, finishedSection: false, source: 'manual' },
  ];
  const s = stats('2026-10-07T10:00:00.000Z', null, logs);
  it('Today / Streak / chart from session minutes per IST study date', () => {
    expect(s.source).toBe('sessions');
    expect(s.asOf).toBeNull();
    expect(s.today).toEqual({ date: '2026-10-07', seconds: 50 * 60 });
    expect(s.streak).toBe(2);
    expect(s.last30.days[28]).toEqual({ date: '2026-10-06', seconds: 90 * 60 });
  });
  it('Complete from finished sections (incl. those finished mid-session) over the course\'s video minutes; lectures = distinct completed', () => {
    // §01 31 + §02 1 + §03 75 = 107 of 4028 video minutes
    expect(s.complete).toEqual({ percent: (107 / 4028) * 100, label: '2%', lecturesDone: 3, lecturesTotal: null });
  });
  it('no "Continue" lecture without the player', () => {
    expect(s.current).toBeNull();
  });
  it('before the plan starts there is no pace yet (weekView already says so — the Due stat must too)', () => {
    // Sat 3 Oct: the stats row used to read "Due Fri 25 Dec · On track" for a course that had not begun
    expect(stats('2026-10-03T06:00:00.000Z', null, []).due.pace).toBeNull();
    expect(stats('2026-10-05T06:00:00.000Z', null, []).due.pace).not.toBeNull(); // Mon 5 Oct: day 1
  });
  it('nothing at all: zeros, not errors', () => {
    const empty = stats('2026-10-01T06:00:00.000Z', null, []);
    expect(empty.today.seconds).toBe(0);
    expect(empty.streak).toBe(0);
    expect(empty.complete).toEqual({ percent: 0, label: '0%', lecturesDone: 0, lecturesTotal: null });
    expect(empty.last30.averageSeconds).toBe(0);
  });
});

describe('percentLabel (the player\'s Complete figure)', () => {
  it('floors, says <1% for a sliver, caps at 100%', () => {
    expect([0, 0.4, 1, 9.99, 99.9, 100, 100.2].map(percentLabel)).toEqual(['0%', '<1%', '1%', '9%', '99%', '100%', '100%']);
  });
});
