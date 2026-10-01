import { roleFromBearer } from '@/lib/auth';
import { parseFeedQuery } from '@/lib/feed';
import { getJourneyFeed } from '@/lib/db/queries';
import { apiJson } from '@/lib/api';

// GET /api/player/feed?course=react-2023&cursor=&limit=30 → JourneyFeed (lib/player.ts):
// her updates newest first with Rahul's replies threaded, his standalone notes, and her
// unread count. Paginated in SQL with the opaque `nextCursor`; `notes` come on the FIRST
// page only (cursor empty) — later pages carry `notes: []` (lib/db/queries.ts getJourneyFeed).
// Bearer student token, never cached. Reading does NOT mark anything read: she marks what
// she has seen with POST /api/player/feed/read.
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  if (roleFromBearer(req.headers.get('authorization')) !== 'student') {
    return apiJson({ error: 'unauthorized: send Authorization: Bearer <student token>' }, 401);
  }
  const q = parseFeedQuery(new URL(req.url).searchParams);
  if (!q.ok) return apiJson({ error: q.error }, q.status);
  try {
    return apiJson(await getJourneyFeed(q.course, q.cursor, q.limit), 200);
  } catch (e) {
    console.error(`[player] feed for ${q.course} failed (cursor ${q.cursor ? q.cursor.id : 'first page'})`, e);
    return apiJson({ error: 'could not read the feed right now; retry later' }, 500);
  }
}
