'use server';
import { cookies } from 'next/headers';
import { ROLE_COOKIE } from '@/lib/auth';
import { insertLog } from '@/lib/db/queries';
import { ACTIVE_COURSE, getCourse } from '@/lib/courses';
import { TIME_ZONE } from '@/lib/config';
import { todayInTZ } from '@/lib/date';
import { afterLogWritten } from '@/lib/notify';
import type { NewLog } from '@/lib/schedule';

// Manual check-in — the fallback for study away from the Course Player (player
// sessions arrive on their own via /api/player/sessions). Always logs against the
// ACTIVE course; a section from another course (e.g. a stale pre-React tab) is refused.
export async function createLogAction(form: FormData): Promise<{ ok: boolean; error?: string }> {
  const role = (await cookies()).get(ROLE_COOKIE)?.value;
  if (role !== 'student') return { ok: false, error: 'unauthorized' };

  const minutes = Number(form.get('minutes'));
  const sectionId = form.get('sectionId') ? Number(form.get('sectionId')) : null;
  const note = (form.get('note') as string | null)?.trim() || null;
  const mood = (form.get('mood') as string | null) || null;
  const finishedSection = form.get('finishedSection') === 'on';
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) return { ok: false, error: 'invalid minutes' };
  const course = ACTIVE_COURSE;
  if (sectionId != null && !getCourse(course).curriculum.some((s) => s.id === sectionId)) {
    return { ok: false, error: `section ${sectionId} is not part of ${getCourse(course).shortTitle} — refresh the page` };
  }

  const row: NewLog = {
    course, studyDate: todayInTZ(TIME_ZONE), sectionId, minutes, note, mood, finishedSection,
    alsoFinishedIds: [], lecturesCompleted: null, source: 'manual', externalId: null, startedAt: null, endedAt: null,
  };
  await insertLog(row);
  afterLogWritten(row); // revalidate both views + coach email (after the response)
  return { ok: true };
}
