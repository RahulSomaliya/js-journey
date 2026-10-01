import { NextRequest, NextResponse } from 'next/server';
import { hasLogOn } from '@/lib/db/queries';
import { sendCoachEmail } from '@/lib/email';
import { TIME_ZONE } from '@/lib/config';
import { ACTIVE_COURSE, getCourse } from '@/lib/courses';
import { nudgeSkipReason } from '@/lib/schedule';
import { todayInTZ } from '@/lib/date';

// Daily "No log from Mansi today" nudge (vercel.json: 21:00 IST, Mon–Fri). Quiet before
// the active plan starts, on weekends and on plan-break days (Diwali) — the rules live in
// nudgeSkipReason (lib/schedule.ts) and are checked before any DB read.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // fail closed: if the secret is unset, a header of literally "Bearer undefined" must NOT pass
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const today = todayInTZ(TIME_ZONE);
  const skipped = nudgeSkipReason(today, getCourse(ACTIVE_COURSE).plan);
  if (skipped) return NextResponse.json({ today, skipped });
  const logged = await hasLogOn(today);
  if (!logged) await sendCoachEmail('No log from Mansi today', `No study log recorded for ${today}.`);
  return NextResponse.json({ today, logged });
}
