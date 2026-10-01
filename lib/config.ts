import type { ScheduleConfig } from '@/lib/schedule';

// Every date in the app is an IST calendar date (Mansi studies in India).
export const TIME_ZONE = 'Asia/Kolkata';

// JavaScript course — COMPLETED (22 Jun → Sep 2026). Frozen history: changing a value here
// rewrites the JS course's plan numbers (GET /api/player/status?course=js) after the fact.
export const JS_PLAN: ScheduleConfig = {
  startDate: '2026-06-22', // Monday (IST). Week 1 = Mon 22 Jun .. Fri 26 Jun.
  dailyHours: 2.5,
  studyDaysPerWeek: 5,
  multiplier: 2.5,
  graceWeeks: 1,
  timeZone: TIME_ZONE,
  breaks: [],
};

// Ultimate React Course (2023) — ACTIVE. Multiplier 1.75 × watch time (JS used
// 2.5×, which Rahul found too loose; she now learns with Claude alongside).
// Pinned in tests/courses.test.ts: 10 study weeks → target Fri 25 Dec 2026, deadline
// Fri 1 Jan 2027 (Fri 11 Dec / Fri 18 Dec before the Diwali break was added).
export const REACT_PLAN: ScheduleConfig = {
  startDate: '2026-10-05', // Monday (IST)
  dailyHours: 2.5,
  studyDaysPerWeek: 5,
  multiplier: 1.75,
  graceWeeks: 1,
  timeZone: TIME_ZONE,
  // Rahul, 1 Oct 2026: Diwali brings home chores and time off — no study expected.
  // 15 calendar days, 10 of them Mon–Fri: the plan moves two study weeks later.
  // Adding a break = append here; every date, pace number and the daily nudge follow.
  breaks: [{ label: 'Diwali', start: '2026-11-01', end: '2026-11-15' }],
};
