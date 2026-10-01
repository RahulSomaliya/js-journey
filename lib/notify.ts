import 'server-only';
import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSections, getLogs } from '@/lib/db/queries';
import { computePace, type NewLog } from '@/lib/schedule';
import { planPace } from '@/lib/status';
import { paceLabel } from '@/lib/journey-view';
import { getCourse } from '@/lib/courses';
import { sendCoachEmail, logEmailLine, logEmailSubject } from '@/lib/email';

// Everything a NEW update (log row) triggers — shared by the manual sign-off (lib/actions/log.ts
// signOffAction) and Course Player sessions (app/api/player/sessions). Not called for a
// duplicate player retry: that would email Rahul twice for one session. A stuck update is
// flagged in the subject and the line (lib/email.ts).
export function afterLogWritten(row: NewLog): void {
  revalidatePath('/m/[token]', 'page');
  revalidatePath('/r/[token]', 'page');
  // after the response: the player's outbox flush on Quit waits ≤ 3 s, and Mansi's
  // check-in confetti shouldn't wait on Resend either
  after(async () => {
    try {
      const [sections, logs] = await Promise.all([getSections(row.course), getLogs(row.course)]);
      const args = { today: row.studyDate, sections, logs, config: getCourse(row.course).plan };
      // the pace words are the pages' (planPace) — computePace only for "% of the course done"
      const pace = { label: paceLabel(planPace(args)).label, contentPct: computePace(args).contentPct };
      // subject reflects the DAY, not just this session — logs already include the new row
      const dayTotal = logs.filter((l) => l.studyDate === row.studyDate).reduce((s, l) => s + l.minutes, 0);
      await sendCoachEmail(
        logEmailSubject(row.minutes, dayTotal, row.stuck),
        logEmailLine({ ...row, lectureCount: row.lecturesCompleted?.length ?? 0 }, pace, sections),
      );
    } catch (e) {
      // the row is already stored; a failed email must not fail the log — but say which one
      console.error(`[notify] coach email failed for ${row.source} log ${row.externalId ?? ''} (${row.course}, ${row.studyDate})`, e);
    }
  });
}
