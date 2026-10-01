import { describe, it, expect } from 'vitest';
import { FIXTURE_NOW, fixtureFeed, fixtureInbox, fixtureOverview, fixtureSnapshot, fixtureUpdates, type Scenario } from '@/lib/fixtures';
import { decodeCursor } from '@/lib/feed';
import { parseProgressSnapshot } from '@/lib/player';

// The fixtures the page agent renders /m and /r with: built through the real pure code, so
// these checks are about the SCENARIOS being what docs/v2-data-layer.md promises.
const ALL: Scenario[] = ['typical', 'behind', 'diwali', 'empty'];

describe('lib/fixtures', () => {
  it('every snapshot passes the real API validation', () => {
    for (const s of ALL) {
      const snap = fixtureSnapshot(s);
      // validated at the scenario's own clock: takenAt may be at most 24 h ahead of the server's
      if (snap) expect(parseProgressSnapshot(snap, FIXTURE_NOW[s].getTime())).toMatchObject({ ok: true });
    }
  });
  it('typical: week 3, on track, 2 unread updates for Rahul (one stuck, one auto-closed), 2 unread for her', () => {
    const o = fixtureOverview('typical');
    expect([o.today, o.status.week, o.stats.source, o.stats.today.seconds > 0, o.stats.streak > 0]).toEqual(['2026-10-21', 3, 'snapshot', true, true]);
    const inbox = fixtureInbox('typical');
    expect(inbox.unreadCount).toBe(2);
    expect(inbox.unread.map((u) => [u.stuck, u.autoClosed])).toEqual([[true, false], [false, true]]);
    expect(inbox.unread[0].note?.length).toBeGreaterThan(400);
    expect(fixtureFeed('typical').unreadForStudent).toBe(2);
    expect(fixtureUpdates('typical').some((u) => u.source === 'manual' && u.minutes === 0)).toBe(true);
  });
  it('behind: pace behind, streak 0, nothing unread', () => {
    const o = fixtureOverview('behind');
    expect([o.status.pace, o.stats.streak]).toEqual(['behind', 0]);
    expect(fixtureInbox('behind').unreadCount).toBe(0);
    expect(fixtureFeed('behind').unreadForStudent).toBe(0);
  });
  it('diwali: on the break — no pace in the Due stat, the break instead; This week says back Mon 16 Nov', () => {
    const o = fixtureOverview('diwali');
    expect([o.stats.due.pace, o.stats.due.onBreak]).toEqual([null, { label: 'Diwali' }]);
    // the streak holds through the break and weekends: 15 Oct → 30 Oct is 12 study days (the note-only
    // Wed 14 Oct, 0 player minutes, ended the run before it) — a calendar-day streak read 0 all of Diwali
    expect(o.stats.streak).toBe(12);
  });
  it('empty: before the start, no data anywhere (stats from sessions = zeros)', () => {
    const o = fixtureOverview('empty');
    expect([o.stats.source, o.stats.today.seconds, o.stats.streak, o.stats.complete.label]).toEqual(['sessions', 0, 0, '0%']);
    expect(fixtureFeed('empty')).toEqual({ updates: [], notes: [], unreadReplies: [], unreadForStudent: 0, nextCursor: null });
  });
  it('a small page limit yields a real cursor (pagination UI can be exercised)', () => {
    const f = fixtureFeed('typical', 5);
    expect(f.updates).toHaveLength(5);
    expect(decodeCursor(f.nextCursor ?? '')).not.toBeNull();
    expect(fixtureInbox('diwali', 4).history.nextCursor).not.toBeNull();
  });
});
