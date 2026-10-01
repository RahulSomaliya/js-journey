// Shared test data (not a test file: vitest only collects *.test.ts).

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
