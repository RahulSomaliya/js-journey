import 'server-only';
import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSections, getLogs } from '@/lib/db/queries';
import { computePace, type NewLog } from '@/lib/schedule';
import { getCourse } from '@/lib/courses';
import { sendCoachEmail, logEmailLine, logEmailSubject } from '@/lib/email';

// Everything a NEW log row triggers — shared by the manual check-in (lib/actions/log.ts)
// and Course Player sessions (app/api/player/sessions). Not called for a duplicate
// player retry: that would email Rahul twice for one session.
export function afterLogWritten(row: NewLog): void {
  revalidatePath('/m/[token]', 'page');
  revalidatePath('/r/[token]', 'page');
  // after the response: the player's outbox flush on Quit waits ≤ 3 s, and Mansi's
  // check-in confetti shouldn't wait on Resend either
  after(async () => {
    try {
      const [sections, logs] = await Promise.all([getSections(row.course), getLogs(row.course)]);
      const pace = computePace({ today: row.studyDate, sections, logs, config: getCourse(row.course).plan });
      // subject reflects the DAY, not just this session — logs already include the new row
      const dayTotal = logs.filter((l) => l.studyDate === row.studyDate).reduce((s, l) => s + l.minutes, 0);
      await sendCoachEmail(
        logEmailSubject(row.minutes, dayTotal),
        logEmailLine({ ...row, lectureCount: row.lecturesCompleted?.length ?? 0 }, pace, sections),
      );
    } catch (e) {
      // the row is already stored; a failed email must not fail the log — but say which one
      console.error(`[notify] coach email failed for ${row.source} log ${row.externalId ?? ''} (${row.course}, ${row.studyDate})`, e);
    }
  });
}
