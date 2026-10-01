// All dates are ISO 'YYYY-MM-DD' strings interpreted as calendar dates (no time/tz drift).
function toUTCDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fmt(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
export function addDays(iso: string, days: number): string {
  const d = toUTCDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fmt(d);
}
export function diffDays(a: string, b: string): number {
  return Math.round((toUTCDate(b).getTime() - toUTCDate(a).getTime()) / 86_400_000);
}
export function dayOfWeek(iso: string): number {
  return toUTCDate(iso).getUTCDay(); // 0=Sun..6=Sat
}
/** ISO weekday: 1 = Mon … 7 = Sun (JourneyStatus.studyWeekdays) */
export function isoWeekday(iso: string): number {
  return dayOfWeek(iso) || 7;
}
/** The plan's study weekdays (ISO): Mon–Fri. The ONE source for isStudyDay below and for
 *  JourneyStatus.studyWeekdays, which the player's streak walks — two lists would let her Mac and
 *  Rahul's page disagree on which days a streak may skip. */
export const STUDY_WEEKDAYS: readonly number[] = [1, 2, 3, 4, 5];
/** An inclusive run of calendar days with no study — a plan break (ScheduleConfig.breaks). */
export interface DayRange { start: string; end: string; }
export function inBreak(iso: string, breaks: readonly DayRange[]): boolean {
  return breaks.some((b) => iso >= b.start && iso <= b.end); // ISO strings compare lexically
}
// A study day is Mon–Fri outside every plan break. `breaks` is REQUIRED on every
// study-day helper on purpose: a call that forgot it would silently count Diwali as
// study time and show her "behind" for a break the plan promised her.
export function isStudyDay(iso: string, breaks: readonly DayRange[]): boolean {
  return STUDY_WEEKDAYS.includes(isoWeekday(iso)) && !inBreak(iso, breaks);
}
// Count study days in [startIso, endIso) — end exclusive. 0 if end <= start.
export function studyDaysBetween(startIso: string, endIso: string, breaks: readonly DayRange[]): number {
  const days = diffDays(startIso, endIso);
  let count = 0;
  for (let i = 0; i < days; i++) if (isStudyDay(addDays(startIso, i), breaks)) count++;
  return count;
}
// Advance n study days forward from an ISO date (the start itself never counts). n = 0 returns iso.
export function addStudyDays(iso: string, n: number, breaks: readonly DayRange[]): string {
  let d = iso;
  let added = 0;
  while (added < n) {
    d = addDays(d, 1);
    if (isStudyDay(d, breaks)) added += 1;
  }
  return d;
}
// Advance n calendar days forward, not counting break days (weekends DO count) — for
// rates measured per calendar day, like computePace's projected finish.
export function addOpenDays(iso: string, n: number, breaks: readonly DayRange[]): string {
  let d = iso;
  let added = 0;
  while (added < n) {
    d = addDays(d, 1);
    if (!inBreak(d, breaks)) added += 1;
  }
  return d;
}
export function todayInTZ(timeZone: string, now: Date = new Date()): string {
  // en-CA yields YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
