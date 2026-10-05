import { isCourseId, type CourseId } from '@/lib/courses';
import { UUID_RE, type CoachMessage, type JourneyFeed, type StudentUpdate } from '@/lib/player';
import type { LectureDone, LogSource } from '@/lib/schedule';

// The update feed (her sign-offs + Rahul's replies), pure parts: cursor codec, page
// assembly, query parsing. The SQL lives in lib/db/queries.ts (listUpdates); this file
// stays DB-free so tests and the page fixtures (lib/fixtures.ts) can use it.

export const FEED_LIMIT_DEFAULT = 30;
export const FEED_LIMIT_MAX = 100;

/** Keyset position = (created_at, id) of the last row shown. `createdAt` is Postgres's own
 *  text with MICROseconds: a JS Date keeps only ms, so a cursor built from one would sit
 *  between two rows of the same millisecond and skip or repeat them. */
export interface FeedCursor { createdAt: string; id: string; }

const CURSOR_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

// base64url via btoa/atob (not Node's Buffer) so client components can import this file too.
// The payload is ASCII only (timestamp + uuid), which is all btoa accepts.
export function encodeCursor(c: FeedCursor): string {
  return btoa(`${c.createdAt}~${c.id}`).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
/** null for anything encodeCursor did not make (the route answers 400) */
export function decodeCursor(s: string): FeedCursor | null {
  // the charset + length check rejects everything atob could throw on except a bad length
  if (!s || s.length > 200 || s.length % 4 === 1 || !/^[A-Za-z0-9_-]+$/.test(s)) return null;
  const [createdAt, id, ...rest] = atob(s.replaceAll('-', '+').replaceAll('_', '/')).split('~');
  if (rest.length || !CURSOR_TS_RE.test(createdAt ?? '') || !UUID_RE.test(id ?? '')) return null;
  return { createdAt, id };
}

/** One update as the coach pages need it: the contract's StudentUpdate plus the log row id
 *  (what the coach actions take — StudentUpdate.id is the player's session id for player
 *  rows) and autoClosed. The API strips both with toStudentUpdate. */
export interface FeedUpdate extends StudentUpdate { logId: string; autoClosed: boolean; }

/** a log row as listUpdates selects it (sections joined for number + title) */
export interface UpdateRow {
  id: string;
  externalId: string | null;
  source: LogSource;
  studyDate: string;
  createdAt: Date;
  /** created_at as UTC text with microseconds — the cursor key */
  cursorKey: string;
  minutes: number;
  sectionNumber: number | null;
  sectionTitle: string | null;
  lecturesCompleted: LectureDone[] | null;
  mood: string | null;
  note: string | null;
  stuck: boolean;
  autoClosed: boolean;
  coachReadAt: Date | null;
}
/** a coach message row (a reply when logEntryId is set, else a standalone note) */
export interface MessageRow { id: string; body: string; createdAt: Date; studentReadAt: Date | null; logEntryId: string | null; }

export function toCoachMessage(r: MessageRow): CoachMessage {
  return { id: r.id, body: r.body, createdAt: r.createdAt.toISOString(), readAt: r.studentReadAt?.toISOString() ?? null };
}

// `rows` = up to limit + 1 log rows, newest first (the extra row only says "there is more").
// `replies` = coach messages for those rows, any order — threaded oldest first.
export function assemblePage(rows: UpdateRow[], replies: MessageRow[], limit: number): { updates: FeedUpdate[]; nextCursor: string | null } {
  const shown = rows.slice(0, limit);
  const byLog = new Map<string, MessageRow[]>();
  for (const r of replies) {
    if (!r.logEntryId) continue;
    byLog.set(r.logEntryId, [...(byLog.get(r.logEntryId) ?? []), r]);
  }
  const updates = shown.map((r): FeedUpdate => ({
    id: r.externalId ?? r.id,
    logId: r.id,
    source: r.source,
    studyDate: r.studyDate,
    createdAt: r.createdAt.toISOString(),
    minutes: r.minutes,
    sectionNumber: r.sectionNumber,
    sectionTitle: r.sectionTitle,
    lectures: r.lecturesCompleted ?? [],
    mood: r.mood,
    note: r.note,
    stuck: r.stuck,
    autoClosed: r.autoClosed,
    coachReadAt: r.coachReadAt?.toISOString() ?? null,
    replies: (byLog.get(r.id) ?? [])
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
      .map(toCoachMessage),
  }));
  const last = shown[shown.length - 1];
  return { updates, nextCursor: rows.length > limit && last ? encodeCursor({ createdAt: last.cursorKey, id: last.id }) : null };
}

/** the exact StudentUpdate contract shape (no coach-only fields) */
export function toStudentUpdate(u: FeedUpdate): StudentUpdate {
  return {
    id: u.id, source: u.source, studyDate: u.studyDate, createdAt: u.createdAt, minutes: u.minutes,
    sectionNumber: u.sectionNumber, sectionTitle: u.sectionTitle, lectures: u.lectures, mood: u.mood, note: u.note,
    stuck: u.stuck, coachReadAt: u.coachReadAt, replies: u.replies,
  };
}

/** What lib/db/queries.ts getJourneyFeed reads in ONE batch, for assembleFeed. */
export interface FeedParts {
  /** updatesPageQuery: up to limit + 1 rows, newest first */
  rows: UpdateRow[];
  /** their coach replies */
  replies: MessageRow[];
  unreadForStudent: number;
  /** FIRST page only (cursor null), else null: the standalone notes, and every update that carries a
   *  coach reply she has not seen (unreadReplyUpdatesQuery) with all its replies */
  first: { notes: MessageRow[]; unreadReplyRows: UpdateRow[]; unreadReplyReplies: MessageRow[] } | null;
}

/** GET /api/player/feed and her /m page: one page of updates; the first page also carries the notes
 *  and `unreadReplies` (the updates OUTSIDE this page with a reply she has not seen — "From Rahul" must
 *  reach a reply however old the update it answers; see JourneyFeed.unreadReplies). */
export function assembleFeed(p: FeedParts, limit: number): JourneyFeed {
  const page = assemblePage(p.rows, p.replies, limit);
  const onPage = new Set(page.updates.map((u) => u.logId));
  const older = p.first ? assemblePage(p.first.unreadReplyRows, p.first.unreadReplyReplies, p.first.unreadReplyRows.length).updates : [];
  return {
    updates: page.updates.map(toStudentUpdate),
    notes: p.first ? p.first.notes.map(toCoachMessage) : [],
    unreadReplies: older.filter((u) => !onPage.has(u.logId)).map(toStudentUpdate),
    unreadForStudent: p.unreadForStudent,
    nextCursor: page.nextCursor,
  };
}

export type FeedQuery =
  | { ok: true; course: CourseId; cursor: FeedCursor | null; limit: number }
  | { ok: false; status: 400 | 404; error: string };

// GET /api/player/feed?course=react-2023&cursor=&limit=30 — empty cursor/limit = defaults.
export function parseFeedQuery(params: URLSearchParams): FeedQuery {
  const course = params.get('course');
  if (!course) return { ok: false, status: 400, error: 'course query parameter is required, e.g. ?course=react-2023' };
  // 404 + "unknown course" is matched by the course player (see app/api/player/status/route.ts) — keep both.
  if (!isCourseId(course)) return { ok: false, status: 404, error: `unknown course "${course}"` };
  const rawLimit = params.get('limit') || String(FEED_LIMIT_DEFAULT);
  const limit = /^\d+$/.test(rawLimit) ? Number(rawLimit) : NaN;
  if (!(limit >= 1 && limit <= FEED_LIMIT_MAX)) return { ok: false, status: 400, error: `limit must be a whole number from 1 to ${FEED_LIMIT_MAX}` };
  const rawCursor = params.get('cursor');
  const cursor = rawCursor ? decodeCursor(rawCursor) : null;
  if (rawCursor && !cursor) return { ok: false, status: 400, error: 'cursor is not one this feed returned (use nextCursor as given)' };
  return { ok: true, course, cursor, limit };
}
