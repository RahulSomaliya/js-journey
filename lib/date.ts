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
export function isWeekend(iso: string): boolean {
  const d = dayOfWeek(iso);
  return d === 0 || d === 6;
}
export function fridayOfWeek(startMondayIso: string, week: number): string {
  return addDays(startMondayIso, (week - 1) * 7 + 4);
}
// Count Mon–Fri in [startIso, endIso) — end exclusive. 0 if end <= start.
export function weekdaysBetween(startIso: string, endIso: string): number {
  const days = diffDays(startIso, endIso);
  if (days <= 0) return 0;
  let count = 0;
  for (let i = 0; i < days; i++) if (!isWeekend(addDays(startIso, i))) count++;
  return count;
}
// Advance n study-days (Mon–Fri) forward from an ISO date. n = 0 returns iso.
export function addStudyDays(iso: string, n: number): string {
  let d = iso;
  let added = 0;
  while (added < n) {
    d = addDays(d, 1);
    if (!isWeekend(d)) added += 1;
  }
  return d;
}
export function todayInTZ(timeZone: string, now: Date = new Date()): string {
  // en-CA yields YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
