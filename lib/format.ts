import { TIME_ZONE } from '@/lib/config';
import { diffDays, todayInTZ } from '@/lib/date';

// Human duration: 105 -> "1h 45m", 60 -> "1h", 45 -> "45m", 0 -> "0m".
export function fmtDur(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm}m`;
  if (mm === 0) return `${h}h`;
  return `${h}h ${mm}m`;
}

// '2026-06-22' -> 'Mon 22 Jun'. Fixed English names, not Intl: ICU versions differ ("Sep" vs "Sept"
// in newer Node), and a client component rendering a date must print the same text in the server's
// Node as in her browser, or React throws a hydration mismatch.
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
}

// A section's number inside its course, as both views print it: 7 -> "§07".
export function sectionTag(sectionNumber: number): string {
  return `§${String(sectionNumber).padStart(2, '0')}`;
}

// Seconds the way the Course Player prints them (its formatDuration): whole minutes, rounded
// DOWN — the stats row and chart show her numbers, so 1h 55m 59s must read "1h 55m" in both apps.
export function fmtSeconds(seconds: number): string {
  return fmtDur(Math.floor(Math.max(0, seconds) / 60));
}

// '2026-09-22' -> '22 Sep' (chart axis)
export function fmtShortDate(iso: string): string {
  return fmtDate(iso).slice(4);
}

// Clock times are IST on purpose (TIME_ZONE): the server renders these pages in UTC and Rahul may
// read them anywhere — a machine-local time would print a different hour than she lived.
// 12 h, always (Rahul, 2026-10-05: never 24 h). Intl only reads the IST hour/minute as NUMBERS (h23); the
// "am"/"pm" is ours — Intl's day-period text differs between ICU builds (Node "pm" vs a browser "PM"/"p.m."),
// and a client component printing it would mismatch on hydration. Same shape as the player's formatTimeOfDay.
const IST_CLOCK = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hourCycle: 'h23', timeZone: TIME_ZONE });

// '2026-10-21T13:25:00.000Z' -> '6:55 pm' · '2026-10-20T19:00:00.000Z' -> '12:30 am'
export function fmtTime(iso: string): string {
  const parts = IST_CLOCK.formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === 'hour')?.value);
  const m = parts.find((p) => p.type === 'minute')?.value;
  if (!Number.isInteger(h) || m === undefined) throw new Error(`fmtTime: cannot read an IST time from "${iso}"`);
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

// When a message or update was sent, relative to `today` (IST): 'Today 6:55 pm', 'Yesterday 7:40 pm',
// 'Fri 7:55 pm' within the week, else 'Mon 5 Oct' (the player's formatMessageTime, in IST).
export function fmtWhen(iso: string, today: string): string {
  const day = todayInTZ(TIME_ZONE, new Date(iso));
  const ago = diffDays(day, today);
  if (ago <= 0) return `Today ${fmtTime(iso)}`;
  if (ago === 1) return `Yesterday ${fmtTime(iso)}`;
  if (ago < 7) return `${fmtDate(day).slice(0, 3)} ${fmtTime(iso)}`;
  return fmtDate(day);
}

// 1 lecture / 3 lectures
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
