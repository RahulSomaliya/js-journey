import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The daily "No log from Mansi today" nudge (vercel.json: 21:00 IST, Mon–Fri).
// It must stay quiet before the active plan starts, on weekends and on plan-break days.
const m = vi.hoisted(() => ({ hasLogOn: vi.fn(), sendCoachEmail: vi.fn() }));
vi.mock('@/lib/db/queries', () => ({ hasLogOn: m.hasLogOn }));
vi.mock('@/lib/email', () => ({ sendCoachEmail: m.sendCoachEmail }));

import { GET } from '@/app/api/cron/daily/route';
import { NextRequest } from 'next/server';

// 15:30 UTC = 21:00 IST, when the Vercel cron fires
const runAt = async (date: string, auth = 'Bearer cron-secret') => {
  vi.setSystemTime(new Date(`${date}T15:30:00.000Z`));
  const res = await GET(new NextRequest('http://x/api/cron/daily', { headers: { authorization: auth } }));
  return { status: res.status, body: res.status === 200 ? await res.json() : null };
};

beforeEach(() => {
  process.env.CRON_SECRET = 'cron-secret';
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  m.hasLogOn.mockResolvedValue(false);
  m.sendCoachEmail.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('GET /api/cron/daily', () => {
  it('401 without the cron secret', async () => {
    expect((await runAt('2026-10-05', 'Bearer nope')).status).toBe(401);
    expect(m.hasLogOn).not.toHaveBeenCalled();
  });
  it('stays quiet before the React plan starts (Thu 1, Fri 2 Oct)', async () => {
    for (const d of ['2026-10-01', '2026-10-02']) {
      expect((await runAt(d)).body).toEqual({ today: d, skipped: 'before-start' });
    }
    expect(m.hasLogOn).not.toHaveBeenCalled();
    expect(m.sendCoachEmail).not.toHaveBeenCalled();
  });
  it('stays quiet on every Diwali break day', async () => {
    for (const d of ['2026-11-02', '2026-11-06', '2026-11-13']) {
      expect((await runAt(d)).body).toEqual({ today: d, skipped: 'break' });
    }
    expect(m.hasLogOn).not.toHaveBeenCalled();
    expect(m.sendCoachEmail).not.toHaveBeenCalled();
  });
  it('stays quiet on a weekend', async () => {
    expect((await runAt('2026-10-10')).body).toEqual({ today: '2026-10-10', skipped: 'weekend' });
    expect(m.sendCoachEmail).not.toHaveBeenCalled();
  });
  it('nudges on a study day with no log (first day, and the Monday back from Diwali)', async () => {
    for (const d of ['2026-10-05', '2026-11-16']) {
      expect((await runAt(d)).body).toEqual({ today: d, logged: false });
      expect(m.hasLogOn).toHaveBeenLastCalledWith(d);
    }
    expect(m.sendCoachEmail).toHaveBeenCalledTimes(2);
    expect(m.sendCoachEmail).toHaveBeenLastCalledWith('No log from Mansi today', 'No study log recorded for 2026-11-16.');
  });
  it('does not nudge when she logged', async () => {
    m.hasLogOn.mockResolvedValue(true);
    expect((await runAt('2026-10-06')).body).toEqual({ today: '2026-10-06', logged: true });
    expect(m.sendCoachEmail).not.toHaveBeenCalled();
  });
});
