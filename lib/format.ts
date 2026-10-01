// Human duration: 105 -> "1h 45m", 60 -> "1h", 45 -> "45m", 0 -> "0m".
export function fmtDur(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm}m`;
  if (mm === 0) return `${h}h`;
  return `${h}h ${mm}m`;
}

// '2026-06-22' -> 'Mon 22 Jun'
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(dt);
}

// Inclusive day range: 'Sun 1 Nov – Sun 15 Nov' (a single day prints once)
export function fmtDateRange(start: string, end: string): string {
  return start === end ? fmtDate(start) : `${fmtDate(start)} – ${fmtDate(end)}`;
}

// A section's number inside its course, as both views print it: 7 -> "§07".
export function sectionTag(sectionNumber: number): string {
  return `§${String(sectionNumber).padStart(2, '0')}`;
}

// One study session in a line, e.g. "From the player · 1h 42m · 9 lectures · §07 · 🙂".
// Manual rows (source unset on old data) read "Check-in · …" and never mention lectures.
export function sessionSummary(
  log: { source?: 'manual' | 'player'; minutes: number; lecturesCompleted?: { length: number } | null; mood?: string | null },
  sectionNumber: number | null,
): string {
  const player = log.source === 'player';
  const parts = [player ? 'From the player' : 'Check-in', fmtDur(log.minutes)];
  const lectures = log.lecturesCompleted?.length ?? 0;
  if (player && lectures > 0) parts.push(`${lectures} lecture${lectures === 1 ? '' : 's'}`);
  if (sectionNumber != null) parts.push(sectionTag(sectionNumber));
  if (log.mood) parts.push(log.mood);
  return parts.join(' · ');
}
