import { revalidatePath } from 'next/cache';
import { roleFromBearer } from '@/lib/auth';
import { parseProgressSnapshot } from '@/lib/player';
import { upsertProgressSnapshot } from '@/lib/db/queries';
import { apiJson } from '@/lib/api';

// PUT /api/player/progress — the player's ProgressSnapshot (after a sign-off, on Quit,
// debounced while she studies): the numbers the coach view's stats show (lib/stats.ts).
// Latest wins by the snapshot's takenAt: an older or repeated one answers 200 "stale" and
// changes nothing, so outbox retries and out-of-order deliveries are harmless.
export const dynamic = 'force-dynamic';

export async function PUT(req: Request): Promise<Response> {
  if (roleFromBearer(req.headers.get('authorization')) !== 'student') {
    return apiJson({ error: 'unauthorized: send Authorization: Bearer <student token>' }, 401);
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiJson({ error: 'body must be valid JSON (a ProgressSnapshot)' }, 400);
  }
  const parsed = parseProgressSnapshot(body);
  if (!parsed.ok) return apiJson({ error: parsed.error }, 400);
  const s = parsed.snapshot;
  let status: Awaited<ReturnType<typeof upsertProgressSnapshot>>;
  try {
    status = await upsertProgressSnapshot(s);
  } catch (e) {
    // the raw epoch ms, not new Date().toISOString(): a catch block that can throw (RangeError) loses
    // this JSON 500 to Next's HTML one — parseProgressSnapshot bounds takenAt, but keep this throw-free
    console.error(`[player] storing the progress snapshot for ${s.course} (takenAt ${s.takenAt}) failed`, e);
    return apiJson({ error: 'could not store the snapshot right now; retry later' }, 500);
  }
  if (status === 'stored') revalidatePath('/r/[token]', 'page');
  return apiJson({ status }, 200);
}
