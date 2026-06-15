'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ROLE_COOKIE } from '@/lib/auth';
import { insertMessage, resolveStuck } from '@/lib/db/queries';
import { sendCoachEmail } from '@/lib/email';

async function role() {
  return (await cookies()).get(ROLE_COOKIE)?.value;
}

export async function sendStuckAction(form: FormData) {
  if ((await role()) !== 'student') return { ok: false };
  const body = (form.get('body') as string)?.trim();
  const sectionId = form.get('sectionId') ? Number(form.get('sectionId')) : null;
  if (!body) return { ok: false };
  await insertMessage({ author: 'student', kind: 'stuck', body, sectionId });
  try { await sendCoachEmail('Mansi is stuck on something', body); } catch {}
  revalidatePath('/r/[token]', 'page');
  return { ok: true };
}

export async function sendCoachNoteAction(form: FormData) {
  if ((await role()) !== 'coach') return { ok: false };
  const body = (form.get('body') as string)?.trim();
  if (!body) return { ok: false };
  await insertMessage({ author: 'coach', kind: 'encouragement', body });
  revalidatePath('/m/[token]', 'page');
  return { ok: true };
}

export async function resolveStuckAction(form: FormData) {
  if ((await role()) !== 'coach') return { ok: false };
  await resolveStuck(form.get('id') as string);
  revalidatePath('/r/[token]', 'page');
  return { ok: true };
}
