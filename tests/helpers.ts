// Shared test data (not a test file: vitest only collects *.test.ts).
import type { ProgressSnapshot } from '@/lib/player';
import type { LogEntry } from '@/lib/schedule';

// The React plan's weekly goals (tests/courses.test.ts pins buildMilestones), per section:
// JourneyStatus.sectionDue. §04 is skipped by the plan, so it has no due date.
const dueFor = (from: number, to: number, date: string): [string, string][] =>
  Array.from({ length: to - from + 1 }, (_, i) => String(from + i)).filter((n) => n !== '4').map((n) => [n, date]);
export const REACT_SECTION_DUE: Record<string, string> = Object.fromEntries([
  ...dueFor(1, 5, '2026-10-09'), ...dueFor(6, 9, '2026-10-16'), ...dueFor(10, 12, '2026-10-23'), ...dueFor(13, 16, '2026-10-30'),
  // Diwali break Sun 1 – Sun 15 Nov: no study week
  ...dueFor(17, 18, '2026-11-20'), ...dueFor(19, 22, '2026-11-27'), ...dueFor(23, 25, '2026-12-04'), ...dueFor(26, 28, '2026-12-11'),
  ...dueFor(29, 31, '2026-12-25'), // week 9 closes no new section (§29 alone is 7.9 h)
]);

// ---- Mansi's real first week, as it stood on Mon 12 Oct 2026 (spec-v4 "The pace is wrong") ----
// Both apps said "Behind by 3 days": the pace read finished sections from session LOGS only, and no
// session ever reported section 01 (its article "Read Before You Start!" is still unticked, so the player
// never counts 01 as 100 % done) — the loop stopped at 01 and credited nothing. She is on 07 lecture 1.
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
export const WEEK1_SNAPSHOT: ProgressSnapshot = {
  course: 'react-2023',
  takenAt: Date.parse('2026-10-11T15:00:00.000Z'),
  lecturesDone: 60,
  lecturesTotal: 410,
  videoSecondsDone: 27_360, // = the lectures below: 01 1850 + 02 56 + 03 4497 + 05 10450 + 06 10507 (seconds)
  videoSecondsTotal: 241_826,
  sectionsDone: [2, 3, 5, 6],
  current: { sectionNumber: 7, lectureNumber: 1, title: 'Section Overview' },
  days: { '2026-10-05': 7200, '2026-10-06': 9000, '2026-10-07': 8400, '2026-10-08': 9000, '2026-10-09': 7800, '2026-10-10': 3600 },
  doneLectures: { '1': [1, 2, 3, 5], '2': [1, 2], '3': range(9), '5': range(24), '6': range(21) },
};
/** her week-1 sign-offs: 02/03 finished on the way, 05 and 06 on their own days — never 01 */
export const WEEK1_LOGS: LogEntry[] = [
  { id: 'w1', studyDate: '2026-10-05', minutes: 120, sectionId: 103, finishedSection: false, alsoFinishedIds: [102] },
  { id: 'w2', studyDate: '2026-10-06', minutes: 150, sectionId: 105, finishedSection: false, alsoFinishedIds: [103] },
  { id: 'w3', studyDate: '2026-10-08', minutes: 150, sectionId: 105, finishedSection: true },
  { id: 'w4', studyDate: '2026-10-09', minutes: 130, sectionId: 106, finishedSection: true },
];
