import { roleFromBearer } from '@/lib/auth';
import { parseJourneySession, sessionToLog } from '@/lib/player';
import { insertPlayerLog } from '@/lib/db/queries';
import { afterLogWritten } from '@/lib/notify';
import { apiJson } from '@/lib/api';

// POST /api/player/sessions — the Course Player's outbox delivers one JourneySession
// (lib/player.ts) per call, server-to-server, `Authorization: Bearer <student token>`.
// Status codes drive the player's outbox (course-player docs/spec.md §2 "Outbox"):
//   2xx → delivered (201 stored, 200 duplicate retry) · 4xx → dropped for good, message
//   kept as lastError · 5xx → retried later. So: only return 4xx for input that can
//   never succeed; anything transient (DB down, React sections not seeded yet) is a 5xx.
// Not behind proxy.ts (its matcher only covers /m and /r) — auth happens here.
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

  const row = sessionToLog(parsed.session);
  let result: 'created' | 'duplicate';
  try {
    result = await insertPlayerLog(row);
  } catch (e) {
    console.error(`[player] storing session ${parsed.session.id} failed (${row.course} §${parsed.session.sectionNumber}, ${row.studyDate})`, e);
    return apiJson({ error: 'could not store the session right now; retry later' }, 500);
  }
  if (result === 'duplicate') return apiJson({ status: 'duplicate', id: parsed.session.id }, 200);

  console.log(`[player] stored session ${parsed.session.id}: ${row.course} §${parsed.session.sectionNumber}, ${row.minutes} min, ${row.studyDate}`);
  afterLogWritten(row);
  return apiJson({ status: 'created', id: parsed.session.id }, 201);
}
