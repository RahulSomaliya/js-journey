import { isCourseId, sectionIdFor, COURSE_IDS, type CourseId } from '@/lib/courses';
import type { LectureDone, NewLog } from '@/lib/schedule';

// ---- API contract with the Course Player -------------------------------------
// Exact mirror of the "JS Journey" block in ~/Developer/course-player/shared/types.ts
// (v2, 2026-10-01: one learner; every sign-off is an update the coach reads and replies to).
// Change BOTH files together: the player's outbox drops a request for good on any 4xx,
// so a contract drift here loses her data.

/** What the player knows about her progress — the coach view renders these same numbers. */
export interface ProgressSnapshot {
  course: string; // Course.id
  /** epoch ms when the player computed it */
  takenAt: number;
  lecturesDone: number;
  lecturesTotal: number;
  videoSecondsDone: number;
  videoSecondsTotal: number;
  /** section numbers that are 100% done */
  sectionsDone: number[];
  /** the lecture "Continue" points at */
  current: { sectionNumber: number; lectureNumber: number; title: string } | null;
  /** local date "YYYY-MM-DD" -> seconds studied; last 120 days at most */
  days: Record<string, number>;
}

export interface JourneySession {
  /** uuid v4 made in the browser — JS Journey dedups on it, so retries are safe */
  id: string;
  course: string; // Course.id, e.g. "react-2023"
  startedAt: string; // ISO
  endedAt: string; // ISO
  /** local calendar date the session started on, "YYYY-MM-DD" */
  studyDate: string;
  /** wall-clock study minutes, rounded; 0 only for a note-only update (she studied away from the player) */
  minutes: number;
  /** section number she spent the most study time in (current section for a note-only update) */
  sectionNumber: number;
  lecturesCompleted: { section: number; lecture: number; title: string }[];
  /** sections that became 100% done during this session */
  finishedSections: number[];
  mood: string | null; // one of '😄' | '🙂' | '😐' | '😩' or null when skipped
  note: string | null;
  /** she ticked "I'm stuck" — the coach view flags the update */
  stuck: boolean;
  /** true when the player closed the session without her (app left open / closed without signing off) */
  autoClosed: boolean;
  /** progress right after this session — the coach's stats update with every update */
  progress: ProgressSnapshot | null;
}

export interface JourneyStatus {
  pace: 'ahead' | 'on-track' | 'behind';
  /** study days ahead (+) or behind (-) the plan */
  daysDelta: number;
  week: number;
  totalWeeks: number;
  targetDate: string; // "YYYY-MM-DD"
  deadline: string; // "YYYY-MM-DD"
  goal: { sectionNumber: number; title: string; due: string } | null;
  coachNote: { body: string; createdAt: string } | null;
  /** the plan break in progress, else the next one starting within 14 days, else null.
   *  Dates inclusive, "YYYY-MM-DD". Break days are not study days: no pace is lost on them. */
  planBreak: { label: string; start: string; end: string } | null;
  /** section number -> "YYYY-MM-DD" it is due by (the Friday of the plan week that finishes it) */
  sectionDue: Record<string, string>;
  /** sections her plan skips (React: [4], the JS review she no longer needs) */
  skippedSections: number[];
  /** the plan's study weekdays, ISO 1 = Mon … 7 = Sun (React: [1,2,3,4,5]). With planBreaks, the calendar
   *  the streak walks (web/src/lib/stats.ts streak = JS Journey lib/stats.ts): a missed study day ends it,
   *  a quiet weekend / break day does not. */
  studyWeekdays: number[];
  /** EVERY plan break, inclusive "YYYY-MM-DD" (planBreak is only the current / next one — a streak walking
   *  back through last month's break needs it too) */
  planBreaks: { label: string; start: string; end: string }[];
  /** v3: her full plan, week by week — exactly the coach page's plan list (lib/journey-view.ts planRows),
   *  so "See full plan" in the player and Rahul's "Plan" can never disagree. GET /api/player/status always
   *  sends it; optional because a status cached by the player before v3 (or from an older JS Journey) has
   *  none — the player hides "See full plan" then. The pages' Overview.status leaves it out (they print
   *  planRows(overview) directly). */
  plan?: PlanRow[];
}

/** One row of the plan: a study week (its goal, due Friday, state) or a break where it falls. */
export type PlanRow =
  | {
      kind: 'week'; week: number; due: string; goal: string;
      /** past = a "keep going" week whose date passed with its section still open (not a miss: the plan
       *  only expected part of that section by then) */
      state: 'done' | 'current' | 'behind' | 'upcoming' | 'past';
    }
  | { kind: 'break'; label: string; start: string; end: string; now: boolean };

/** A coach reply to one of her updates, or a standalone coach note. */
export interface CoachMessage {
  id: string;
  body: string;
  createdAt: string; // ISO
  /** when Mansi saw it (player or her web page); null = unread for her */
  readAt: string | null;
}

/** One of her sign-offs, as the feed returns it. */
export interface StudentUpdate {
  id: string; // JourneySession.id for player updates; log row id for manual ones
  source: 'player' | 'manual';
  studyDate: string;
  createdAt: string; // ISO
  minutes: number;
  sectionNumber: number | null;
  sectionTitle: string | null;
  lectures: { section: number; lecture: number; title: string }[];
  mood: string | null;
  note: string | null;
  stuck: boolean;
  /** when Rahul read it; null = unread for the coach */
  coachReadAt: string | null;
  replies: CoachMessage[]; // oldest first
}

export interface JourneyFeed {
  /** newest first; at most `limit` (default 30) */
  updates: StudentUpdate[];
  /** standalone coach notes (not replies), newest first */
  notes: CoachMessage[];
  /** FIRST page only ([] on later pages): older updates — not in `updates` — that carry a coach reply
   *  she has not seen, newest first, replies threaded. "From Rahul" = the unread replies in `updates`
   *  AND these: built from `updates` alone, a reply to an update outside the first page was never shown
   *  or marked read while unreadForStudent kept counting it. Optional: a JS Journey deployed before it
   *  (or a feed cached before it) has none. */
  unreadReplies?: StudentUpdate[];
  /** coach replies + notes she has not seen yet */
  unreadForStudent: number;
  /** opaque cursor for the next page of updates, null at the end */
  nextCursor: string | null;
}

// ---- validation ---------------------------------------------------------------

export const PLAYER_MOODS = ['😄', '🙂', '😐', '😩'] as const;
export type PlayerMood = (typeof PLAYER_MOODS)[number];
/** the player's sign-off card labels (course-player web/src/screens/WrapUp.tsx) — the web sign-off uses the same */
export const MOOD_LABELS: Record<PlayerMood, string> = { '😄': 'Great', '🙂': 'Good', '😐': 'Okay', '😩': 'Tough' };
export const isPlayerMood = (x: string): x is PlayerMood => (PLAYER_MOODS as readonly string[]).includes(x);
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const NOTE_MAX = 10_000;
const LECTURES_MAX = 1_000;
const SNAPSHOT_DAYS_MAX = 400; // the player keeps ≤ 120; headroom so an off-by-a-few never drops a snapshot
/** How far ahead of the SERVER's clock a snapshot's takenAt may be (her Mac's clock drifting). The upsert
 *  is "newest takenAt wins" (lib/db/queries.ts upsertSnapshotQuery): one far-future row (a Mac set to 2100)
 *  would answer "stale" to every honest snapshot after it, for good — and a takenAt past the JS Date range
 *  (> 8.64e15, still a safe integer) threw a RangeError while the query was built → 500 → the outbox
 *  retried that session (her minutes + note) forever. Never drop this bound. */
export const SNAPSHOT_FUTURE_MS = 24 * 3_600_000;
const READ_IDS_MAX = 500;

/** An update needs study time or a note — a 0-minute update is a note-only one (she studied away from
 *  the player). The ONE rule for the player API (parseJourneySession), the web action (signOffAction)
 *  and the web form, which disables "Send to Rahul" until it holds (it used to start at 1h, so a single
 *  tap recorded an hour she never studied and emailed Rahul). */
export function canSignOff(minutes: number, note: string): boolean {
  return minutes > 0 || note.trim() !== '';
}

export type ValidSession = Omit<JourneySession, 'progress'> & { course: CourseId; progress: ValidSnapshot | null };
export type ValidSnapshot = ProgressSnapshot & { course: CourseId };
/** `progressIgnored`: the session itself is valid but its `progress` was not (see parseJourneySession) */
export type ParseResult = { ok: true; session: ValidSession; progressIgnored: string | null } | { ok: false; error: string };
export type SnapshotResult = { ok: true; snapshot: ValidSnapshot } | { ok: false; error: string };

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isPosInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 1;
const isCount = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0;
const isSeconds = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;

export function isCalendarDate(x: unknown): x is string {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  const [y, m, d] = x.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d; // rejects 2026-02-30
}
const isTimestamp = (x: unknown): x is string =>
  typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(x) && Number.isFinite(Date.parse(x));

class Invalid extends Error {}
function check(cond: boolean, message: string): asserts cond {
  if (!cond) throw new Invalid(message);
}
function validate<T>(run: () => T): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: run() };
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: e.message };
    throw e;
  }
}

// An optional v2 boolean: ABSENT = false, so a session a v1 player queued before the
// update (no stuck/autoClosed/progress fields) still lands instead of being 400-dropped
// by the outbox. A present-but-wrong type is a real contract bug and still fails.
function optionalFlag(b: Record<string, unknown>, key: 'stuck' | 'autoClosed'): boolean {
  const v = b[key];
  check(v === undefined || typeof v === 'boolean', `${key} must be true or false`);
  return v === true;
}

// Validates a POST /api/player/sessions body. Every message names the offending
// field — it ends up in the player's outbox `lastError`, which is what Rahul reads.
//
// `progress` is the one field that never fails the session: a session carries her
// study time and note, so an unusable snapshot is dropped (progressIgnored says why,
// the route logs it) instead of 400-ing the whole update — the outbox would discard
// it for good. PUT /api/player/progress validates the same snapshot strictly.
// `now` = the server clock (epoch ms) a snapshot's takenAt is checked against (parseProgressSnapshot).
export function parseJourneySession(body: unknown, now: number = Date.now()): ParseResult {
  const r = validate(() => {
    check(isRecord(body), 'body must be a JSON object (a JourneySession)');
    const b = body;

    check(typeof b.id === 'string' && UUID_RE.test(b.id), 'id must be a uuid string');
    check(typeof b.course === 'string', 'course must be a string');
    const course = b.course;
    check(isCourseId(course), `course "${course}" is not a JS Journey course (known: ${COURSE_IDS.join(', ')})`);

    check(isTimestamp(b.startedAt), 'startedAt must be an ISO timestamp');
    check(isTimestamp(b.endedAt), 'endedAt must be an ISO timestamp');
    check(Date.parse(b.endedAt) >= Date.parse(b.startedAt), `endedAt ${b.endedAt} is before startedAt ${b.startedAt}`);
    check(isCalendarDate(b.studyDate), 'studyDate must be a YYYY-MM-DD calendar date');
    check(isCount(b.minutes) && b.minutes <= 1440, 'minutes must be a whole number from 0 to 1440');
    const minutes = b.minutes;

    check(isPosInt(b.sectionNumber), 'sectionNumber must be a positive whole number');
    check(sectionIdFor(course, b.sectionNumber) !== null, `sectionNumber ${b.sectionNumber} is not a section of ${course}`);

    check(Array.isArray(b.finishedSections) && b.finishedSections.every(isPosInt), 'finishedSections must be an array of section numbers');
    const finished: number[] = b.finishedSections;
    const unknown = finished.filter((n) => sectionIdFor(course, n) === null);
    check(unknown.length === 0, `finishedSections ${unknown.join(', ')}: not a section of ${course}`);

    check(Array.isArray(b.lecturesCompleted), 'lecturesCompleted must be an array');
    const rawLectures: unknown[] = b.lecturesCompleted;
    check(rawLectures.length <= LECTURES_MAX, `lecturesCompleted has more than ${LECTURES_MAX} entries`);
    const lecturesCompleted: LectureDone[] = rawLectures.map((l, i) => {
      check(
        isRecord(l) && isPosInt(l.section) && isPosInt(l.lecture) && typeof l.title === 'string',
        `lecturesCompleted[${i}] must be { section, lecture, title }`,
      );
      return { section: l.section, lecture: l.lecture, title: l.title };
    });

    const moodMsg = `mood must be null or one of ${PLAYER_MOODS.join(' ')}`;
    check(b.mood === null || typeof b.mood === 'string', moodMsg);
    // U+FE0F (emoji presentation selector) is invisible and some keyboards add it
    const mood = b.mood === null ? null : b.mood.replaceAll('️', '');
    check(mood === null || isPlayerMood(mood), moodMsg);

    check(b.note === null || typeof b.note === 'string', 'note must be null or a string');
    check(b.note === null || b.note.length <= NOTE_MAX, `note is longer than ${NOTE_MAX} characters`);
    const note = b.note?.trim() || null;
    // a note-only update (she studied away from the player) is the ONLY 0-minute update
    check(canSignOff(minutes, note ?? ''), 'minutes may be 0 only for a note-only update (note is empty)');

    const stuck = optionalFlag(b, 'stuck');
    const autoClosed = optionalFlag(b, 'autoClosed');

    let progress: ValidSnapshot | null = null;
    let progressIgnored: string | null = null;
    if (b.progress !== undefined && b.progress !== null) {
      const p = parseProgressSnapshot(b.progress, now);
      if (!p.ok) progressIgnored = `progress ignored: ${p.error}`;
      else if (p.snapshot.course !== course) progressIgnored = `progress ignored: snapshot course "${p.snapshot.course}" is not the session's "${course}"`;
      else progress = p.snapshot;
    }

    const session: ValidSession = {
      id: b.id.toLowerCase(),
      course,
      startedAt: b.startedAt,
      endedAt: b.endedAt,
      studyDate: b.studyDate,
      minutes,
      sectionNumber: b.sectionNumber,
      lecturesCompleted,
      finishedSections: finished,
      mood,
      note,
      stuck,
      autoClosed,
      progress,
    };
    return { session, progressIgnored };
  });
  return r.ok ? { ok: true, ...r.value } : r;
}

// Validates a ProgressSnapshot (PUT /api/player/progress, or a session's `progress`).
// Returns a normalised copy holding only the contract's fields — that copy is what is
// stored as progress_snapshots.payload, so stray keys never reach the database.
// `now` = the server clock (epoch ms): takenAt may be at most SNAPSHOT_FUTURE_MS ahead of it.
export function parseProgressSnapshot(body: unknown, now: number = Date.now()): SnapshotResult {
  const r = validate((): ValidSnapshot => {
    check(isRecord(body), 'body must be a JSON object (a ProgressSnapshot)');
    const b = body;
    check(typeof b.course === 'string', 'course must be a string');
    const course = b.course;
    check(isCourseId(course), `course "${course}" is not a JS Journey course (known: ${COURSE_IDS.join(', ')})`);
    check(isPosInt(b.takenAt) && Number.isSafeInteger(b.takenAt), 'takenAt must be epoch milliseconds');
    check(
      b.takenAt <= now + SNAPSHOT_FUTURE_MS,
      `takenAt ${b.takenAt} is more than 24 h ahead of the server clock (${now}) — check the Mac's date and time`,
    );
    check(isCount(b.lecturesDone), 'lecturesDone must be a whole number ≥ 0');
    check(isCount(b.lecturesTotal), 'lecturesTotal must be a whole number ≥ 0');
    check(b.lecturesDone <= b.lecturesTotal, `lecturesDone ${b.lecturesDone} is more than lecturesTotal ${b.lecturesTotal}`);
    check(isSeconds(b.videoSecondsDone), 'videoSecondsDone must be a number ≥ 0');
    check(isSeconds(b.videoSecondsTotal), 'videoSecondsTotal must be a number ≥ 0');

    check(Array.isArray(b.sectionsDone) && b.sectionsDone.every(isPosInt), 'sectionsDone must be an array of section numbers');
    const sectionsDone: number[] = b.sectionsDone;
    const unknown = sectionsDone.filter((n) => sectionIdFor(course, n) === null);
    check(unknown.length === 0, `sectionsDone ${unknown.join(', ')}: not a section of ${course}`);

    let current: ProgressSnapshot['current'] = null;
    if (b.current !== null) {
      const c = b.current;
      check(
        isRecord(c) && isPosInt(c.sectionNumber) && isPosInt(c.lectureNumber) && typeof c.title === 'string',
        'current must be null or { sectionNumber, lectureNumber, title }',
      );
      check(sectionIdFor(course, c.sectionNumber) !== null, `current.sectionNumber ${c.sectionNumber} is not a section of ${course}`);
      current = { sectionNumber: c.sectionNumber, lectureNumber: c.lectureNumber, title: c.title };
    }

    check(isRecord(b.days), 'days must be an object of "YYYY-MM-DD" -> seconds');
    const entries = Object.entries(b.days);
    check(entries.length <= SNAPSHOT_DAYS_MAX, `days has more than ${SNAPSHOT_DAYS_MAX} entries`);
    const days: Record<string, number> = {};
    for (const [key, seconds] of entries) {
      check(isCalendarDate(key), `days key "${key}" is not a YYYY-MM-DD date`);
      check(isSeconds(seconds) && seconds <= 86_400, `days["${key}"] must be seconds from 0 to 86400`);
      days[key] = seconds;
    }

    return {
      course,
      takenAt: b.takenAt,
      lecturesDone: b.lecturesDone,
      lecturesTotal: b.lecturesTotal,
      videoSecondsDone: b.videoSecondsDone,
      videoSecondsTotal: b.videoSecondsTotal,
      sectionsDone: [...new Set(sectionsDone)].sort((x, y) => x - y),
      current,
      days,
    };
  });
  return r.ok ? { ok: true, snapshot: r.value } : r;
}

// POST /api/player/feed/read body: { ids: uuid[] } — coach message ids she has seen.
export function parseReadIds(body: unknown): { ok: true; ids: string[] } | { ok: false; error: string } {
  const r = validate(() => {
    check(isRecord(body) && Array.isArray(body.ids), 'body must be { "ids": [message id, …] }');
    const ids: unknown[] = body.ids;
    check(ids.length <= READ_IDS_MAX, `ids has more than ${READ_IDS_MAX} entries`);
    ids.forEach((id, i) => check(typeof id === 'string' && UUID_RE.test(id), `ids[${i}] must be a uuid string`));
    return [...new Set((ids as string[]).map((id) => id.toLowerCase()))];
  });
  return r.ok ? { ok: true, ids: r.value } : r;
}

function sectionIdOrThrow(course: CourseId, n: number): number {
  const id = sectionIdFor(course, n);
  // parseJourneySession already rejected unknown numbers — reaching this is a bug
  if (id === null) throw new Error(`section ${n} of ${course} vanished after validation`);
  return id;
}

// One player session = ONE log row, keyed on the section she spent the most time in.
// Sections finished on the way (often the previous one) ride along in alsoFinishedIds
// so the schedule credits them (lib/schedule.ts sectionsFinishedBy).
export function sessionToLog(s: ValidSession): NewLog {
  const others = [...new Set(s.finishedSections.filter((n) => n !== s.sectionNumber))].sort((a, b) => a - b);
  return {
    course: s.course,
    studyDate: s.studyDate,
    sectionId: sectionIdOrThrow(s.course, s.sectionNumber),
    minutes: s.minutes,
    note: s.note,
    mood: s.mood,
    finishedSection: s.finishedSections.includes(s.sectionNumber),
    alsoFinishedIds: others.map((n) => sectionIdOrThrow(s.course, n)),
    lecturesCompleted: s.lecturesCompleted,
    source: 'player',
    externalId: s.id.toLowerCase(),
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    stuck: s.stuck,
    autoClosed: s.autoClosed,
  };
}
