import { Resend } from 'resend';
import type { Section } from '@/lib/schedule';

export async function sendCoachEmail(subject: string, body: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.COACH_EMAIL;
  if (!key || !to) {
    console.warn('email skipped: missing RESEND_API_KEY/COACH_EMAIL');
    return;
  }
  const resend = new Resend(key);
  // resend.emails.send resolves with { data, error } and does NOT throw on API-level failures — inspect it.
  const { error } = await resend.emails.send({ from: "Mansi's JS Journey <onboarding@resend.dev>", to, subject, text: body });
  if (error) console.error('resend error', error);
}

// subject describes the DAY: on a 2nd+ session it carries the running total. A note-only
// update (0 minutes, v2) is "a note"; a stuck one is flagged first so it stands out in the inbox.
export function logEmailSubject(minutes: number, dayTotalMinutes: number, stuck = false): string {
  const h = (m: number) => (m / 60).toFixed(1);
  const base = minutes === 0
    ? 'Mansi sent you a note'
    : dayTotalMinutes > minutes
      ? `Mansi logged ${h(minutes)}h — ${h(dayTotalMinutes)}h total today`
      : `Mansi logged ${h(minutes)}h today`;
  return stuck ? `Stuck: ${base}` : base;
}

// `pace.label` = the pages' pace words (lib/journey-view.ts paceLabel over lib/status.ts planPace): the email
// once worded computePace's prorated status ("behind" every mid-week) next to a page saying "On track".
export function logEmailLine(
  log: { minutes: number; sectionId: number | null; finishedSection: boolean; source?: 'manual' | 'player'; lectureCount?: number; stuck?: boolean },
  pace: { label: string; contentPct: number },
  sections: Section[],
): string {
  const s = sections.find((x) => x.id === log.sectionId);
  const status = pace.label.charAt(0).toLowerCase() + pace.label.slice(1);
  const lectures = log.minutes > 0 ? `, ${log.lectureCount ?? 0} lecture${log.lectureCount === 1 ? '' : 's'}` : '';
  const via = log.source === 'player' ? ` via the Course Player${lectures}` : '';
  const what = log.minutes === 0 ? 'Mansi sent a note (no study time)' : `Mansi logged ${(log.minutes / 60).toFixed(1)}h`;
  const stuck = log.stuck ? ' She marked it "I\'m stuck" — reply on your coach page.' : '';
  return `${what} on ${s?.title ?? 'review'}${log.finishedSection ? ' (finished it ✓)' : ''}${via} — ${status}. ${pace.contentPct}% of the course done.${stuck}`;
}
