import { roleFromBearer } from '@/lib/auth';
import { isCourseId, getCourse } from '@/lib/courses';
import { getSections, getLogs, latestCoachNote } from '@/lib/db/queries';
import { computeJourneyStatus } from '@/lib/status';
import { planRows } from '@/lib/journey-view';
import type { JourneyStatus } from '@/lib/player';
import { todayInTZ } from '@/lib/date';
import { TIME_ZONE } from '@/lib/config';
import { apiJson } from '@/lib/api';

// GET /api/player/status?course=react-2023 → JourneyStatus (lib/player.ts), for the
// Course Player's header chip, This week and (v3) her full plan. Bearer student token, like POST /sessions. The player
// also calls this once to validate her link when it is first connected.
// force-dynamic + no-store: must never be prerendered at build or served from a cache.
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  if (roleFromBearer(req.headers.get('authorization')) !== 'student') {
    return apiJson({ error: 'unauthorized: send Authorization: Bearer <student token>' }, 401);
  }
  const course = new URL(req.url).searchParams.get('course');
  if (!course) return apiJson({ error: 'course query parameter is required, e.g. ?course=react-2023' }, 400);
  // 404 + the words "unknown course" are a CONTRACT: the course player matches them (course-player
  // server/journey.ts isUnknownCourse) to show Mansi "course not recognised". Reworded or re-coded, her app
  // goes silent again about a wrong course id (her sign-off was lost that way, 2026-10-05). Same in lib/feed.ts.
  if (!isCourseId(course)) return apiJson({ error: `unknown course "${course}"` }, 404);

  // Catch DB failures here instead of letting them reach Next's default 500: that is an
  // HTML page, so the player's link check (course-player server/journey.ts checkLink →
  // describeFailure, which reads `error` from JSON) would show her trimmed HTML instead of
  // a reason, and our log would lack the course. Keep it a 5xx — a DB outage is transient.
  let sections: Awaited<ReturnType<typeof getSections>>;
  let logs: Awaited<ReturnType<typeof getLogs>>;
  let note: Awaited<ReturnType<typeof latestCoachNote>>;
  try {
    [sections, logs, note] = await Promise.all([getSections(course), getLogs(course), latestCoachNote(course)]);
  } catch (e) {
    console.error(`[player] status for ${course} failed`, e);
    return apiJson({ error: 'could not read status right now; retry later' }, 500);
  }
  const today = todayInTZ(TIME_ZONE);
  const config = getCourse(course).plan;
  const status = computeJourneyStatus({ today, sections, logs, config, coachNote: note });
  // v3 `plan`: her full plan (the player's "See full plan") = the coach page's plan list, from the rows
  // already loaded — no extra read.
  const body: JourneyStatus = { ...status, plan: planRows({ sections, logs, config, status, today }) };
  return apiJson(body, 200);
}
