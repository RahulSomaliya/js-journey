import { Resend } from 'resend';
import type { PaceResult, Section } from '@/lib/schedule';

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

// subject describes the DAY: on a 2nd+ session it carries the running total
export function logEmailSubject(minutes: number, dayTotalMinutes: number): string {
  const h = (m: number) => (m / 60).toFixed(1);
  return dayTotalMinutes > minutes
    ? `Mansi logged ${h(minutes)}h — ${h(dayTotalMinutes)}h total today`
    : `Mansi logged ${h(minutes)}h today`;
}

export function logEmailLine(
  log: { minutes: number; sectionId: number | null; finishedSection: boolean; source?: 'manual' | 'player'; lectureCount?: number },
  pace: PaceResult,
  sections: Section[],
): string {
  const s = sections.find((x) => x.id === log.sectionId);
  const status = pace.status === 'on_track' ? 'on track' : pace.status;
  const via = log.source === 'player' ? ` via the Course Player, ${log.lectureCount ?? 0} lecture${log.lectureCount === 1 ? '' : 's'}` : '';
  return `Mansi logged ${(log.minutes / 60).toFixed(1)}h on ${s?.title ?? 'review'}${log.finishedSection ? ' (finished it ✓)' : ''}${via} — ${status}. ${pace.contentPct}% of the course done.`;
}
