import { revalidatePath } from 'next/cache';
import { roleFromBearer } from '@/lib/auth';
import { parseReadIds } from '@/lib/player';
import { markCoachMessagesRead } from '@/lib/db/queries';
import { apiJson } from '@/lib/api';

// POST /api/player/feed/read { ids } — she pressed "Got it" on Rahul's replies/notes.
// Idempotent: only coach messages still unread change, so the player's outbox can retry
// freely (a repeat answers marked: 0 and keeps the first read time). Unknown ids are
// ignored, not a 4xx — the outbox would drop the whole request for good.
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  if (roleFromBearer(req.headers.get('authorization')) !== 'student') {
    return apiJson({ error: 'unauthorized: send Authorization: Bearer <student token>' }, 401);
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiJson({ error: 'body must be valid JSON ({ "ids": [...] })' }, 400);
  }
  const parsed = parseReadIds(body);
  if (!parsed.ok) return apiJson({ error: parsed.error }, 400);
  let marked: number;
  try {
    marked = await markCoachMessagesRead(parsed.ids);
  } catch (e) {
    console.error(`[player] marking ${parsed.ids.length} coach message(s) read failed (${parsed.ids.join(', ')})`, e);
    return apiJson({ error: 'could not mark them read right now; retry later' }, 500);
  }
  if (marked > 0) revalidatePath('/r/[token]', 'page'); // the coach page shows what she has seen
  return apiJson({ status: 'ok', marked }, 200);
}
