'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ROLE_COOKIE } from '@/lib/auth';
import { insertLog, getSections, getLogs } from '@/lib/db/queries';
import { computePace } from '@/lib/schedule';
import { PLAN } from '@/lib/config';
import { todayInTZ } from '@/lib/date';
import { sendCoachEmail, logEmailLine } from '@/lib/email';

export async function createLogAction(form: FormData): Promise<{ ok: boolean; error?: string }> {
  const role = (await cookies()).get(ROLE_COOKIE)?.value;
  if (role !== 'student') return { ok: false, error: 'unauthorized' };

  const minutes = Number(form.get('minutes'));
  const sectionId = form.get('sectionId') ? Number(form.get('sectionId')) : null;
  const note = (form.get('note') as string | null)?.trim() || null;
  const mood = (form.get('mood') as string | null) || null;
  const finishedSection = form.get('finishedSection') === 'on';
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) return { ok: false, error: 'invalid minutes' };

  const studyDate = todayInTZ(PLAN.timeZone);
  await insertLog({ studyDate, sectionId, minutes, note, mood, finishedSection });

  // fire-and-forget email (do not block UX on failure)
  try {
    const [sections, logs] = await Promise.all([getSections(), getLogs()]);
    const pace = computePace({ today: studyDate, sections, logs, config: PLAN });
    await sendCoachEmail(`Mansi logged ${(minutes / 60).toFixed(1)}h today`, logEmailLine({ minutes, sectionId, finishedSection }, pace, sections));
  } catch (e) {
    console.error('email failed', e);
  }

  revalidatePath('/m/[token]', 'page');
  revalidatePath('/r/[token]', 'page');
  return { ok: true };
}
