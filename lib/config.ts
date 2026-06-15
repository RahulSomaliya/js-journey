export const PLAN = {
  startDate: '2026-06-22', // Monday (IST). Week 1 = Mon 22 Jun .. Fri 26 Jun.
  dailyHours: 2.5,
  studyDaysPerWeek: 5,
  multiplier: 2.5,
  graceWeeks: 1,
  timeZone: 'Asia/Kolkata',
} as const;

export type Plan = typeof PLAN;
