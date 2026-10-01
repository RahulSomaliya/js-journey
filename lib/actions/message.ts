'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ROLE_COOKIE } from '@/lib/auth';
import { insertMessage, markCoachMessagesRead, replyToUpdate } from '@/lib/db/queries';
import { NOTE_MAX, parseReadIds, UUID_RE } from '@/lib/player';
import type { ActionResult } from '@/lib/api';

// Messages between them: Rahul's replies + standalone notes, and her read marks. ("I'm stuck" is a
// flag on her update now — lib/actions/log.ts signOffAction — not a message.)
// Server actions are reachable by direct POST — every one checks the role cookie.

async function role(): Promise<string | undefined> {
  return (await cookies()).get(ROLE_COOKIE)?.value;
}

function messageBody(form: FormData): { ok: true; body: string } | { ok: false; error: string } {
  const body = String(form.get('body') ?? '').trim();
  if (!body) return { ok: false, error: 'The message is empty.' };
  if (body.length > NOTE_MAX) return { ok: false, error: `That message is too long (over ${NOTE_MAX} characters).` };
  return { ok: true, body };
}

// A standalone note from Rahul (no update link) — unread for her until she sees it.
export async function sendCoachNoteAction(form: FormData): Promise<ActionResult> {
  if ((await role()) !== 'coach') return { ok: false, error: 'unauthorized' };
  const b = messageBody(form);
  if (!b.ok) return b;
  await insertMessage({ author: 'coach', kind: 'encouragement', body: b.body });
  revalidatePath('/m/[token]', 'page');
  revalidatePath('/r/[token]', 'page');
  return { ok: true };
}

// Rahul's reply to ONE update (fields: logId = FeedUpdate.logId, body). Replying marks that
// update read — both writes in one transaction (queries.ts replyToUpdate).
export async function replyToUpdateAction(form: FormData): Promise<ActionResult> {
  if ((await role()) !== 'coach') return { ok: false, error: 'unauthorized' };
  const logId = String(form.get('logId') ?? '');
  if (!UUID_RE.test(logId)) return { ok: false, error: 'No update to reply to — refresh the page.' };
  const b = messageBody(form);
  if (!b.ok) return b;
  if ((await replyToUpdate(logId, b.body)) === 'not-found') return { ok: false, error: 'That update is gone — refresh the page.' };
  revalidatePath('/m/[token]', 'page');
  revalidatePath('/r/[token]', 'page');
  return { ok: true };
}

// Her web page marks Rahul's replies/notes read once they are on screen (the player does the
// same through POST /api/player/feed/read). Student only: his viewing must never mark hers.
// Revalidates ONLY the coach page — refreshing hers would drop the "new" marks while she reads.
export async function markCoachMessagesReadAction(ids: string[]): Promise<ActionResult<{ marked: number }>> {
  if ((await role()) !== 'student') return { ok: false, error: 'unauthorized' };
  const parsed = parseReadIds({ ids });
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const marked = await markCoachMessagesRead(parsed.ids);
  revalidatePath('/r/[token]', 'page');
  return { ok: true, marked };
}
