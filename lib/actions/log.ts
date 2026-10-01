'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ROLE_COOKIE } from '@/lib/auth';
import { insertLog, markUpdatesRead } from '@/lib/db/queries';
import { ACTIVE_COURSE, getCourse } from '@/lib/courses';
import { TIME_ZONE } from '@/lib/config';
import { todayInTZ } from '@/lib/date';
import { afterLogWritten } from '@/lib/notify';
import { canSignOff, isPlayerMood, NOTE_MAX, UUID_RE } from '@/lib/player';
import type { ActionResult } from '@/lib/api';
import type { NewLog } from '@/lib/schedule';

// Updates (log rows): her manual sign-off, and Rahul marking updates read.
// Server actions are reachable by direct POST — every one checks the role cookie.

async function role(): Promise<string | undefined> {
  return (await cookies()).get(ROLE_COOKIE)?.value;
}

// Manual sign-off — her web page's "I studied away from the player" form: ONE manual update,
// the same thing a player sign-off is (Rahul reads it, it emails him, it can be stuck).
// Fields: minutes (0–1440; 0 = a note-only update, which needs a note), note, mood (one of
// PLAYER_MOODS — both apps show the same four), stuck / finishedSection ('on'), sectionId
// (optional; must belong to the ACTIVE course — a stale pre-React tab is refused).
export async function signOffAction(form: FormData): Promise<ActionResult> {
  if ((await role()) !== 'student') return { ok: false, error: 'unauthorized' };

  const rawMinutes = String(form.get('minutes') ?? '');
  const minutes = /^\d+$/.test(rawMinutes) ? Number(rawMinutes) : NaN;
  if (!(minutes >= 0 && minutes <= 1440)) return { ok: false, error: 'Minutes must be a whole number from 0 to 1440.' };
  const note = String(form.get('note') ?? '').trim() || null;
  if (note && note.length > NOTE_MAX) return { ok: false, error: `That note is too long (over ${NOTE_MAX} characters).` };
  if (!canSignOff(minutes, note ?? '')) return { ok: false, error: 'Add a note to send an update without study time.' };
  const mood = String(form.get('mood') ?? '').replaceAll('️', '') || null; // U+FE0F, like the player API
  if (mood !== null && !isPlayerMood(mood)) return { ok: false, error: `Unknown mood ${mood}.` };
  const course = ACTIVE_COURSE;
  const sectionId = form.get('sectionId') ? Number(form.get('sectionId')) : null;
  if (sectionId != null && !getCourse(course).curriculum.some((s) => s.id === sectionId)) {
    return { ok: false, error: `section ${sectionId} is not part of ${getCourse(course).shortTitle} — refresh the page` };
  }

  const row: NewLog = {
    course, studyDate: todayInTZ(TIME_ZONE), sectionId, minutes, note, mood,
    finishedSection: form.get('finishedSection') === 'on',
    alsoFinishedIds: [], lecturesCompleted: null, source: 'manual', externalId: null, startedAt: null, endedAt: null,
    stuck: form.get('stuck') === 'on', autoClosed: false,
  };
  await insertLog(row);
  afterLogWritten(row); // revalidate both views + coach email (after the response)
  return { ok: true };
}

// "Mark read" without replying — one or more `logId` fields (log row ids: FeedUpdate.logId).
// Idempotent: `marked` counts only updates that were still unread.
export async function markUpdatesReadAction(form: FormData): Promise<ActionResult<{ marked: number }>> {
  if ((await role()) !== 'coach') return { ok: false, error: 'unauthorized' };
  const ids = form.getAll('logId').map(String);
  if (ids.length === 0 || !ids.every((id) => UUID_RE.test(id))) return { ok: false, error: 'No update to mark read — refresh the page.' };
  const marked = await markUpdatesRead(ids);
  revalidatePath('/r/[token]', 'page');
  return { ok: true, marked };
}
