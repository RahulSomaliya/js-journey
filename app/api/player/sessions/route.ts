import { roleFromBearer } from '@/lib/auth';
import { parseJourneySession, sessionToLog } from '@/lib/player';
import { insertPlayerLog, type PlayerLogResult } from '@/lib/db/queries';
import { afterLogWritten } from '@/lib/notify';
import { apiJson } from '@/lib/api';

// POST /api/player/sessions — the Course Player's outbox delivers one JourneySession
// (lib/player.ts) per call, server-to-server, `Authorization: Bearer <student token>`.
// Status codes drive the player's outbox (course-player docs/spec.md §2 "Outbox"):
//   2xx → delivered (201 stored, 200 duplicate retry) · 4xx → not retried: the player keeps
//   the update as `rejected` with this message and shows her "Didn't reach Rahul" (v3 — before
//   v3 it was dropped for good) · 5xx → retried later. So: only return 4xx for input that can
//   never succeed; anything transient (DB down, React sections not seeded yet) is a 5xx.
// Not behind proxy.ts (its matcher only covers /m and /r) — auth happens here.
// v2: the row stores stuck / autoClosed, and `progress` is upserted into progress_snapshots
// in the same transaction (newest takenAt wins). An unusable `progress` is dropped, not
// 400'd — see parseJourneySession — and the answer says `progress: 'ignored'`.
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  if (roleFromBearer(req.headers.get('authorization')) !== 'student') {
    return apiJson({ error: 'unauthorized: send Authorization: Bearer <student token>' }, 401);
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiJson({ error: 'body must be valid JSON (a JourneySession)' }, 400);
  }
  const parsed = parseJourneySession(body);
  if (!parsed.ok) return apiJson({ error: parsed.error }, 400);

  const { session, progressIgnored } = parsed;
  if (progressIgnored) console.error(`[player] session ${session.id} (${session.course}, ${session.studyDate}): ${progressIgnored}`);

  const row = sessionToLog(session);
  let result: PlayerLogResult;
  try {
    result = await insertPlayerLog(row, session.progress);
  } catch (e) {
    console.error(`[player] storing session ${session.id} failed (${row.course} §${session.sectionNumber}, ${row.studyDate})`, e);
    return apiJson({ error: 'could not store the session right now; retry later' }, 500);
  }
  const progress = progressIgnored ? 'ignored' : result.progress;
  if (result.log === 'duplicate') return apiJson({ status: 'duplicate', id: session.id, progress }, 200);

  console.log(`[player] stored session ${session.id}: ${row.course} §${session.sectionNumber}, ${row.minutes} min, ${row.studyDate}${row.stuck ? ', stuck' : ''}`);
  afterLogWritten(row);
  return apiJson({ status: 'created', id: session.id, progress }, 201);
}
