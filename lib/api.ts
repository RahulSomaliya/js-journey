// JSON for the Course Player API (app/api/player/*). `no-store` on EVERY answer: these
// are per-request truth (her newest sessions, today's pace) — a cached status would
// show the player a stale goal, and a cached POST answer would hide a failed write.
export function apiJson(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

// What every server action returns (lib/actions/*): the page shows `error` as-is, so it is
// written for Mansi / Rahul, never a stack trace. Extra fields ride on success only.
export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };
