import 'server-only';
import { and, desc, eq, inArray, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import { db } from './index';
import { sections, logEntries, messages, progressSnapshots } from './schema';
import type { Section, LogEntry, NewLog } from '@/lib/schedule';
import type { CourseId } from '@/lib/courses';
import type { ProgressSnapshot, ValidSnapshot, JourneyFeed, CoachMessage } from '@/lib/player';
import { assembleFeed, assemblePage, toCoachMessage, type FeedCursor, type FeedUpdate } from '@/lib/feed';
import { getCourse } from '@/lib/courses';
import { buildOverview, type Overview } from '@/lib/overview';

// Every section/log read is scoped to ONE course: the schedule engine assumes the
// sections and logs it gets belong together (mixing JS rows into the React pace
// would credit finished JS content to the React plan).
export async function getSections(course: CourseId): Promise<Section[]> {
  const rows = await db.select().from(sections).where(eq(sections.course, course)).orderBy(sections.sortOrder);
  return rows.map((r) => ({ id: r.id, title: r.title, videoMinutes: r.videoMinutes, kind: r.kind, sortOrder: r.sortOrder }));
}

export async function getLogs(course: CourseId): Promise<LogEntry[]> {
  // createdAt tiebreaker: same-day sessions must order newest-first so logs[0] is truly the latest
  const rows = await db.select().from(logEntries)
    .where(eq(logEntries.course, course))
    .orderBy(desc(logEntries.studyDate), desc(logEntries.createdAt));
  return rows.map((r) => ({
    id: r.id, studyDate: r.studyDate, minutes: r.minutes, sectionId: r.sectionId,
    finishedSection: r.finishedSection, note: r.note, mood: r.mood, createdAt: r.createdAt.toISOString(),
    alsoFinishedIds: r.alsoFinishedIds, source: r.source, lecturesCompleted: r.lecturesCompleted,
    startedAt: r.startedAt?.toISOString() ?? null, endedAt: r.endedAt?.toISOString() ?? null,
  }));
}

function toRow(input: NewLog): typeof logEntries.$inferInsert {
  return {
    course: input.course, studyDate: input.studyDate, sectionId: input.sectionId, minutes: input.minutes,
    note: input.note, mood: input.mood, finishedSection: input.finishedSection,
    alsoFinishedIds: input.alsoFinishedIds.length ? input.alsoFinishedIds : null,
    lecturesCompleted: input.lecturesCompleted, source: input.source, externalId: input.externalId,
    startedAt: input.startedAt ? new Date(input.startedAt) : null,
    endedAt: input.endedAt ? new Date(input.endedAt) : null,
    stuck: input.stuck, autoClosed: input.autoClosed,
  };
}

export async function insertLog(input: NewLog): Promise<void> {
  // append-only: every submit is its own session row; totals are summed at read time
  await db.insert(logEntries).values(toRow(input));
}

export type SnapshotWrite = 'stored' | 'stale';
export interface PlayerLogResult { log: 'created' | 'duplicate'; progress: SnapshotWrite | null; }

// Course Player sessions: idempotent on the session id (UNIQUE external_id). A retry
// from the player's outbox hits the conflict, inserts nothing and reports 'duplicate'.
// The session's progress snapshot is upserted in the SAME transaction (neon-http batch):
// a failure leaves neither, so the 5xx retry can never find the row stored without its
// snapshot — or report 'duplicate' for a session whose coach email never went out.
export async function insertPlayerLog(input: NewLog, progress: ValidSnapshot | null): Promise<PlayerLogResult> {
  if (!input.externalId) throw new Error(`insertPlayerLog: player row without externalId (course ${input.course}, ${input.studyDate})`);
  const insert = db.insert(logEntries).values(toRow(input))
    .onConflictDoNothing({ target: logEntries.externalId })
    .returning({ id: logEntries.id });
  if (!progress) {
    const rows = await insert;
    return { log: rows.length > 0 ? 'created' : 'duplicate', progress: null };
  }
  const [rows, upserted] = await db.batch([insert, upsertSnapshotQuery(progress)]);
  return { log: rows.length > 0 ? 'created' : 'duplicate', progress: upserted.length > 0 ? 'stored' : 'stale' };
}

// ---- progress snapshots (v2): the player's exact numbers for the coach's stats ---------

// Newest wins: updated_at = the snapshot's takenAt, and the conflict update only fires when
// the stored one is OLDER — an outbox retry delivering an old snapshot late is a no-op
// ('stale'), and the same snapshot twice is too. See progressSnapshots in schema.ts.
// TRAP: newest-wins trusts her Mac's clock. One stored far-future row would make every later honest
// snapshot 'stale' for good, so takenAt MUST stay bounded by the server clock
// (lib/player.ts SNAPSHOT_FUTURE_MS, enforced in parseProgressSnapshot) — never upsert an unvalidated one.
export function upsertSnapshotQuery(s: ValidSnapshot) {
  return db.insert(progressSnapshots)
    .values({ course: s.course, payload: s, updatedAt: new Date(s.takenAt) })
    .onConflictDoUpdate({
      target: progressSnapshots.course,
      set: { payload: sql`excluded.payload`, updatedAt: sql`excluded.updated_at` },
      setWhere: sql`${progressSnapshots.updatedAt} < excluded.updated_at`,
    })
    .returning({ course: progressSnapshots.course });
}
export async function upsertProgressSnapshot(s: ValidSnapshot): Promise<SnapshotWrite> {
  const rows = await upsertSnapshotQuery(s);
  return rows.length > 0 ? 'stored' : 'stale';
}
export async function getProgressSnapshot(course: CourseId): Promise<ProgressSnapshot | null> {
  const [row] = await db.select({ payload: progressSnapshots.payload }).from(progressSnapshots)
    .where(eq(progressSnapshots.course, course)).limit(1);
  return row?.payload ?? null;
}

/** Plan status + the stats row she sees, for both v2 pages (lib/overview.ts). 4 reads, in parallel. */
export async function loadOverview(course: CourseId, now: Date = new Date()): Promise<Overview> {
  const [sections, logs, note, snapshot] = await Promise.all([getSections(course), getLogs(course), latestCoachNote(), getProgressSnapshot(course)]);
  return buildOverview({
    now, sections, logs, config: getCourse(course).plan, snapshot,
    coachNote: note ? { body: note.body, createdAt: note.createdAt } : null,
  });
}

export async function hasLogOn(studyDate: string): Promise<boolean> {
  const rows = await db.select({ id: logEntries.id }).from(logEntries).where(eq(logEntries.studyDate, studyDate)).limit(1);
  return rows.length > 0;
}

// One aggregate row for a finished course (the JS line on /m, the ?course=js header on /r) — summed in
// SQL so the student page doesn't pull every JS row just to print three numbers.
export interface CourseSummary { minutes: number; sessions: number; studyDays: number; firstDate: string | null; lastDate: string | null; }
export async function getCourseSummary(course: CourseId): Promise<CourseSummary> {
  const [row] = await db.select({
    minutes: sql<number>`coalesce(sum(${logEntries.minutes}), 0)::int`,
    sessions: sql<number>`count(*)::int`,
    studyDays: sql<number>`count(distinct ${logEntries.studyDate})::int`,
    firstDate: sql<string | null>`min(${logEntries.studyDate})::text`,
    lastDate: sql<string | null>`max(${logEntries.studyDate})::text`,
  }).from(logEntries).where(eq(logEntries.course, course));
  return row;
}

export interface Message { id: string; createdAt: string; author: 'coach' | 'student'; kind: 'encouragement' | 'stuck'; body: string; sectionId: number | null; resolvedAt: string | null; }
function toMessage(r: typeof messages.$inferSelect): Message {
  return { id: r.id, createdAt: r.createdAt.toISOString(), author: r.author, kind: r.kind, body: r.body, sectionId: r.sectionId, resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null };
}
// the latest STANDALONE note (JourneyStatus.coachNote) — a reply to one update is not "a note"
export async function latestCoachNote(): Promise<Message | null> {
  const rows = await db.select().from(messages)
    .where(and(eq(messages.author, 'coach'), eq(messages.kind, 'encouragement'), isNull(messages.logEntryId)))
    .orderBy(desc(messages.createdAt)).limit(1);
  return rows[0] ? toMessage(rows[0]) : null;
}
export interface NewMessage { author: 'coach' | 'student'; kind: 'encouragement' | 'stuck'; body: string; sectionId?: number | null; }
export async function insertMessage(input: NewMessage): Promise<void> {
  await db.insert(messages).values({ author: input.author, kind: input.kind, body: input.body, sectionId: input.sectionId ?? null });
}

// ---- v2 feed: her updates (log rows) + Rahul's replies and notes -------------------------
// Every list is paginated / bounded IN SQL (keyset on (created_at, id), index
// log_entries_course_created_at_idx); replies come in the same round trip as their page.

export type UpdateFilter = 'all' | 'unread' | 'read';
export interface UpdatesQuery {
  course: CourseId;
  /** unread/read = by Rahul (coach_read_at) — the coach inbox and its history */
  filter: UpdateFilter;
  cursor: FeedCursor | null;
  limit: number;
}

function updatesWhere(a: UpdatesQuery): SQL | undefined {
  return and(
    eq(logEntries.course, a.course),
    a.filter === 'unread' ? isNull(logEntries.coachReadAt) : a.filter === 'read' ? isNotNull(logEntries.coachReadAt) : undefined,
    // row comparison = strictly after the cursor row in (created_at DESC, id DESC) order;
    // the cursor's timestamp text carries microseconds (lib/feed.ts FeedCursor)
    a.cursor ? sql`(${logEntries.createdAt}, ${logEntries.id}) < (${a.cursor.createdAt}::timestamptz, ${a.cursor.id}::uuid)` : undefined,
  );
}
const newestFirst = [desc(logEntries.createdAt), desc(logEntries.id)];

// an UpdateRow (lib/feed.ts) — every update list selects exactly this
const updateColumns = {
  id: logEntries.id, externalId: logEntries.externalId, source: logEntries.source, studyDate: logEntries.studyDate,
  createdAt: logEntries.createdAt,
  cursorKey: sql<string>`to_char(${logEntries.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
  minutes: logEntries.minutes, sectionNumber: sections.sortOrder, sectionTitle: sections.title,
  lecturesCompleted: logEntries.lecturesCompleted, mood: logEntries.mood, note: logEntries.note,
  stuck: logEntries.stuck, autoClosed: logEntries.autoClosed, coachReadAt: logEntries.coachReadAt,
};

export function updatesPageQuery(a: UpdatesQuery) {
  return db.select(updateColumns).from(logEntries)
    .leftJoin(sections, eq(sections.id, logEntries.sectionId))
    .where(updatesWhere(a))
    .orderBy(...newestFirst)
    .limit(a.limit + 1); // the extra row only says "there is a next page"
}

const messageColumns = {
  id: messages.id, body: messages.body, createdAt: messages.createdAt,
  studentReadAt: messages.studentReadAt, logEntryId: messages.logEntryId,
};

export function repliesForPageQuery(a: UpdatesQuery) {
  const pageIds = db.select({ id: logEntries.id }).from(logEntries).where(updatesWhere(a)).orderBy(...newestFirst).limit(a.limit + 1);
  return db.select(messageColumns).from(messages)
    .where(and(eq(messages.author, 'coach'), inArray(messages.logEntryId, pageIds)));
}

/** One page of updates (newest first) with their replies threaded (oldest first). */
export async function listUpdates(a: UpdatesQuery): Promise<{ updates: FeedUpdate[]; nextCursor: string | null }> {
  const [rows, replies] = await db.batch([updatesPageQuery(a), repliesForPageQuery(a)]);
  return assemblePage(rows, replies, a.limit);
}

// Standalone notes are few: every unread one (she must see them all) + the `recent` newest.
export function notesQuery(recent: number) {
  const standalone = and(eq(messages.author, 'coach'), isNull(messages.logEntryId));
  const recentIds = db.select({ id: messages.id }).from(messages).where(standalone).orderBy(desc(messages.createdAt)).limit(recent);
  return db.select(messageColumns).from(messages)
    .where(and(standalone, or(isNull(messages.studentReadAt), inArray(messages.id, recentIds))))
    .orderBy(desc(messages.createdAt), desc(messages.id));
}
export const RECENT_NOTES = 10;

// Her unread replies live on ANY update — Rahul can reply from his history, or to an unread update
// older than her first page. "From Rahul" is built from the first feed page, so the first page also
// carries every update with a reply she has not seen (JourneyFeed.unreadReplies); without it such a
// reply was never shown nor marked read, while unreadForStudentQuery kept counting it.
// Unread replies are few (she reads them on every app open); the cap only bounds the read.
export const UNREAD_REPLY_UPDATES_MAX = 50;
const unreadReplyUpdatesWhere = (course: CourseId) => and(
  eq(logEntries.course, course),
  inArray(logEntries.id, db.select({ id: messages.logEntryId }).from(messages)
    .where(and(eq(messages.author, 'coach'), isNull(messages.studentReadAt), isNotNull(messages.logEntryId)))),
);
export function unreadReplyUpdatesQuery(course: CourseId) {
  return db.select(updateColumns).from(logEntries)
    .leftJoin(sections, eq(sections.id, logEntries.sectionId))
    .where(unreadReplyUpdatesWhere(course))
    .orderBy(...newestFirst)
    .limit(UNREAD_REPLY_UPDATES_MAX);
}
export function repliesForUnreadReplyUpdatesQuery(course: CourseId) {
  const ids = db.select({ id: logEntries.id }).from(logEntries).where(unreadReplyUpdatesWhere(course))
    .orderBy(...newestFirst).limit(UNREAD_REPLY_UPDATES_MAX);
  return db.select(messageColumns).from(messages)
    .where(and(eq(messages.author, 'coach'), inArray(messages.logEntryId, ids)));
}

export function unreadForStudentQuery() {
  return db.select({ n: sql<number>`count(*)::int` }).from(messages)
    .where(and(eq(messages.author, 'coach'), isNull(messages.studentReadAt)));
}

/** GET /api/player/feed and her web page — ONE round trip. Notes and unreadReplies ride on the FIRST
 *  page only (cursor null): they are not paginated, so later pages carry `[]` instead of repeating them. */
export async function getJourneyFeed(course: CourseId, cursor: FeedCursor | null, limit: number): Promise<JourneyFeed> {
  const a: UpdatesQuery = { course, filter: 'all', cursor, limit };
  if (cursor === null) {
    const [rows, replies, unread, notes, unreadReplyRows, unreadReplyReplies] = await db.batch([
      updatesPageQuery(a), repliesForPageQuery(a), unreadForStudentQuery(), notesQuery(RECENT_NOTES),
      unreadReplyUpdatesQuery(course), repliesForUnreadReplyUpdatesQuery(course),
    ]);
    return assembleFeed({ rows, replies, unreadForStudent: unread[0]?.n ?? 0, first: { notes, unreadReplyRows, unreadReplyReplies } }, limit);
  }
  const [rows, replies, unread] = await db.batch([updatesPageQuery(a), repliesForPageQuery(a), unreadForStudentQuery()]);
  return assembleFeed({ rows, replies, unreadForStudent: unread[0]?.n ?? 0, first: null }, limit);
}

/** Standalone notes for the coach page (same rule as the feed: unread + the recent ones). */
export async function getCoachNotes(): Promise<CoachMessage[]> {
  return (await notesQuery(RECENT_NOTES)).map(toCoachMessage);
}

export async function countUnreadUpdates(course: CourseId): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(logEntries)
    .where(and(eq(logEntries.course, course), isNull(logEntries.coachReadAt)));
  return row?.n ?? 0;
}

// ---- read state (both idempotent: only still-unread rows change, so a repeat — an outbox
// retry, a double click — keeps the FIRST read time and reports 0) -----------------------

export function markCoachMessagesReadQuery(ids: string[]) {
  return db.update(messages).set({ studentReadAt: sql`now()` })
    .where(and(inArray(messages.id, ids), eq(messages.author, 'coach'), isNull(messages.studentReadAt)))
    .returning({ id: messages.id });
}
/** her side (player "Got it" / her web page): returns how many were newly marked read */
export async function markCoachMessagesRead(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  return (await markCoachMessagesReadQuery(ids)).length;
}

export function markUpdatesReadQuery(logIds: string[]) {
  return db.update(logEntries).set({ coachReadAt: sql`now()` })
    .where(and(inArray(logEntries.id, logIds), isNull(logEntries.coachReadAt)))
    .returning({ id: logEntries.id });
}
/** his side ("Mark read" without replying): returns how many were newly marked read */
export async function markUpdatesRead(logIds: string[]): Promise<number> {
  if (logIds.length === 0) return 0;
  return (await markUpdatesReadQuery(logIds)).length;
}

export function replyStatements(logId: string, body: string) {
  return [
    db.insert(messages).values({ author: 'coach', kind: 'encouragement', body, logEntryId: logId }),
    db.update(logEntries).set({ coachReadAt: sql`now()` }).where(and(eq(logEntries.id, logId), isNull(logEntries.coachReadAt))),
  ] as const;
}
/** A coach reply to one update: the message (linked by log_entry_id) and the update marked
 *  read, in ONE transaction. 'not-found' when the update does not exist (stale page). */
export async function replyToUpdate(logId: string, body: string): Promise<'sent' | 'not-found'> {
  const [found] = await db.select({ id: logEntries.id }).from(logEntries).where(eq(logEntries.id, logId)).limit(1);
  if (!found) return 'not-found';
  await db.batch(replyStatements(logId, body));
  return 'sent';
}
