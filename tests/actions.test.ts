import { describe, it, expect, vi, beforeEach } from 'vitest';

// Server actions for the two web pages. Auth = the role cookie proxy.ts sets on /m and /r
// (server actions are reachable by direct POST, so EVERY action checks it). The queries
// are mocked; their SQL is pinned in tests/queries-sql.test.ts.
const m = vi.hoisted(() => ({
  role: 'coach' as string | undefined,
  revalidatePath: vi.fn(),
  replyToUpdate: vi.fn(),
  markUpdatesRead: vi.fn(),
  markCoachMessagesRead: vi.fn(),
  insertMessage: vi.fn(),
  insertLog: vi.fn(),
  afterLogWritten: vi.fn(),
  sendCoachEmail: vi.fn(),
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name === 'journey_role' && m.role ? { value: m.role } : undefined) }),
}));
vi.mock('next/cache', () => ({ revalidatePath: m.revalidatePath }));
vi.mock('@/lib/db/queries', () => ({
  replyToUpdate: m.replyToUpdate,
  markUpdatesRead: m.markUpdatesRead,
  markCoachMessagesRead: m.markCoachMessagesRead,
  insertMessage: m.insertMessage,
  insertLog: m.insertLog,
}));
vi.mock('@/lib/notify', () => ({ afterLogWritten: m.afterLogWritten }));
vi.mock('@/lib/email', () => ({ sendCoachEmail: m.sendCoachEmail }));

import { replyToUpdateAction, sendCoachNoteAction, markCoachMessagesReadAction } from '@/lib/actions/message';
import { signOffAction, markUpdatesReadAction } from '@/lib/actions/log';

const LOG_ID = '0b8f3c1e-7d2a-4f5b-9c3d-2e1f0a9b8c7d';
const MSG_ID = 'aa8f3c1e-7d2a-4f5b-9c3d-2e1f0a9b8c7d';
const form = (fields: Record<string, string | string[]>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) fd.append(k, x);
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T18:45:00.000Z')); // 00:15 IST Tue 6 Oct — the IST date, not UTC's 5 Oct
});

describe('coach: reply to an update', () => {
  beforeEach(() => { m.role = 'coach'; });
  it('stores the reply linked to the update (which marks it read, in one transaction) and refreshes both pages', async () => {
    m.replyToUpdate.mockResolvedValue('sent');
    expect(await replyToUpdateAction(form({ logId: LOG_ID, body: '  Cleanup runs before the next effect 💚  ' }))).toEqual({ ok: true });
    expect(m.replyToUpdate).toHaveBeenCalledWith(LOG_ID, 'Cleanup runs before the next effect 💚');
    expect(m.revalidatePath).toHaveBeenCalledWith('/m/[token]', 'page');
    expect(m.revalidatePath).toHaveBeenCalledWith('/r/[token]', 'page');
  });
  it('refuses a student, an empty reply, a bad id; a vanished update says so', async () => {
    m.role = 'student';
    expect(await replyToUpdateAction(form({ logId: LOG_ID, body: 'x' }))).toEqual({ ok: false, error: 'unauthorized' });
    m.role = 'coach';
    expect(await replyToUpdateAction(form({ logId: LOG_ID, body: '   ' }))).toMatchObject({ ok: false, error: expect.stringMatching(/empty/) });
    expect(await replyToUpdateAction(form({ logId: 'nope', body: 'x' }))).toMatchObject({ ok: false, error: expect.stringMatching(/update/) });
    expect(m.replyToUpdate).not.toHaveBeenCalled();
    m.replyToUpdate.mockResolvedValue('not-found');
    expect(await replyToUpdateAction(form({ logId: LOG_ID, body: 'x' }))).toMatchObject({ ok: false, error: expect.stringMatching(/refresh/) });
  });
});

describe('coach: mark updates read without replying', () => {
  beforeEach(() => { m.role = 'coach'; });
  it('one or several logId fields; idempotent (reports how many changed)', async () => {
    m.markUpdatesRead.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    expect(await markUpdatesReadAction(form({ logId: [LOG_ID, MSG_ID] }))).toEqual({ ok: true, marked: 2 });
    expect(m.markUpdatesRead).toHaveBeenCalledWith([LOG_ID, MSG_ID]);
    expect(await markUpdatesReadAction(form({ logId: LOG_ID }))).toEqual({ ok: true, marked: 0 });
    expect(m.revalidatePath).toHaveBeenCalledWith('/r/[token]', 'page');
  });
  it('refuses a student and junk ids', async () => {
    m.role = 'student';
    expect(await markUpdatesReadAction(form({ logId: LOG_ID }))).toEqual({ ok: false, error: 'unauthorized' });
    m.role = 'coach';
    expect(await markUpdatesReadAction(form({ logId: 'x' }))).toMatchObject({ ok: false });
    expect(await markUpdatesReadAction(form({}))).toMatchObject({ ok: false });
    expect(m.markUpdatesRead).not.toHaveBeenCalled();
  });
});

describe('coach: standalone note', () => {
  it('stores a coach note (no update link), unread for her', async () => {
    m.role = 'coach';
    expect(await sendCoachNoteAction(form({ body: ' Proud of this week 💚 ' }))).toEqual({ ok: true });
    expect(m.insertMessage).toHaveBeenCalledWith({ author: 'coach', kind: 'encouragement', body: 'Proud of this week 💚' });
    expect(m.revalidatePath).toHaveBeenCalledWith('/m/[token]', 'page');
  });
  it('refuses a student, an empty or an absurdly long note', async () => {
    m.role = 'student';
    expect(await sendCoachNoteAction(form({ body: 'x' }))).toEqual({ ok: false, error: 'unauthorized' });
    m.role = 'coach';
    expect(await sendCoachNoteAction(form({ body: ' ' }))).toMatchObject({ ok: false });
    expect(await sendCoachNoteAction(form({ body: 'x'.repeat(10_001) }))).toMatchObject({ ok: false, error: expect.stringMatching(/long/) });
    expect(m.insertMessage).not.toHaveBeenCalled();
  });
});

describe('student: mark Rahul\'s messages read (her web page, when shown)', () => {
  it('marks them read and refreshes only the coach page (her own page keeps the "new" marks while she reads)', async () => {
    m.role = 'student';
    m.markCoachMessagesRead.mockResolvedValue(2);
    expect(await markCoachMessagesReadAction([MSG_ID, LOG_ID])).toEqual({ ok: true, marked: 2 });
    expect(m.markCoachMessagesRead).toHaveBeenCalledWith([MSG_ID, LOG_ID]);
    expect(m.revalidatePath).toHaveBeenCalledTimes(1);
    expect(m.revalidatePath).toHaveBeenCalledWith('/r/[token]', 'page');
  });
  it('refuses the coach (his reading must never mark hers) and junk ids', async () => {
    m.role = 'coach';
    expect(await markCoachMessagesReadAction([MSG_ID])).toEqual({ ok: false, error: 'unauthorized' });
    m.role = 'student';
    expect(await markCoachMessagesReadAction(['x'])).toMatchObject({ ok: false, error: expect.stringMatching(/uuid/) });
    expect(m.markCoachMessagesRead).not.toHaveBeenCalled();
  });
});

describe('student: manual sign-off (study away from the player) = one manual update', () => {
  beforeEach(() => { m.role = 'student'; });
  it('stores a manual update on today\'s IST date and triggers the coach email path', async () => {
    const res = await signOffAction(form({ minutes: '45', sectionId: '107', note: '  Built the form again from memory ', mood: '🙂', stuck: 'on', finishedSection: 'on' }));
    expect(res).toEqual({ ok: true });
    const row = {
      course: 'react-2023', studyDate: '2026-10-06', sectionId: 107, minutes: 45, note: 'Built the form again from memory', mood: '🙂',
      finishedSection: true, alsoFinishedIds: [], lecturesCompleted: null, source: 'manual', externalId: null, startedAt: null, endedAt: null,
      stuck: true, autoClosed: false,
    };
    expect(m.insertLog).toHaveBeenCalledWith(row);
    expect(m.afterLogWritten).toHaveBeenCalledWith(row);
  });
  it('a note-only update (0 minutes) needs the note', async () => {
    expect(await signOffAction(form({ minutes: '0', note: 'Read the useEffect docs on my phone' }))).toEqual({ ok: true });
    expect(m.insertLog.mock.calls[0][0]).toMatchObject({ minutes: 0, sectionId: null, stuck: false, mood: null });
    expect(await signOffAction(form({ minutes: '0' }))).toMatchObject({ ok: false, error: expect.stringMatching(/note/) });
  });
  it('refuses the coach, bad minutes, a mood the views do not know, a section of another course', async () => {
    m.role = 'coach';
    expect(await signOffAction(form({ minutes: '30' }))).toEqual({ ok: false, error: 'unauthorized' });
    m.role = 'student';
    for (const minutes of ['-1', '1441', '1.5', 'abc', '']) expect(await signOffAction(form({ minutes }))).toMatchObject({ ok: false });
    expect(await signOffAction(form({ minutes: '30', mood: '🚀' }))).toMatchObject({ ok: false, error: expect.stringMatching(/mood/) });
    expect(await signOffAction(form({ minutes: '30', sectionId: '7' }))).toMatchObject({ ok: false, error: expect.stringMatching(/section 7/) });
    expect(m.insertLog).not.toHaveBeenCalled();
  });
});
