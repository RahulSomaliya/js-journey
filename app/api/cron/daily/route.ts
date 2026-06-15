import { NextRequest, NextResponse } from 'next/server';
import { hasLogOn } from '@/lib/db/queries';
import { sendCoachEmail } from '@/lib/email';
import { PLAN } from '@/lib/config';
import { todayInTZ, isWeekend } from '@/lib/date';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // fail closed: if the secret is unset, a header of literally "Bearer undefined" must NOT pass
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const today = todayInTZ(PLAN.timeZone);
  if (isWeekend(today)) return NextResponse.json({ skipped: 'weekend' });
  const logged = await hasLogOn(today);
  if (!logged) await sendCoachEmail('No log from Mansi today', `No study log recorded for ${today}.`);
  return NextResponse.json({ today, logged });
}
