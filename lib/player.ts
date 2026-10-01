import { isCourseId, sectionIdFor, COURSE_IDS, type CourseId } from '@/lib/courses';
import type { LectureDone, NewLog } from '@/lib/schedule';

// ---- API contract with the Course Player -------------------------------------
// Exact mirror of JourneySession / JourneyStatus in
// ~/Developer/course-player/shared/types.ts. Change BOTH files together: the player's
// outbox drops a session for good on any 4xx, so a contract drift here loses her data.

export interface JourneySession {
  /** uuid v4 made in the browser — JS Journey dedups on it, so retries are safe */
  id: string;
  course: string; // Course.id, e.g. "react-2023"
  startedAt: string; // ISO
  endedAt: string; // ISO
  /** local calendar date the session started on, "YYYY-MM-DD" */
  studyDate: string;
  /** wall-clock study minutes, rounded, >= 1 */
  minutes: number;
  /** section number she spent the most study time in */
  sectionNumber: number;
  lecturesCompleted: { section: number; lecture: number; title: string }[];
  /** sections that became 100% done during this session */
  finishedSections: number[];
  mood: string | null; // one of '😄' | '🙂' | '😐' | '😩' or null when skipped
  note: string | null;
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
}

// ---- validation ---------------------------------------------------------------

export const PLAYER_MOODS = ['😄', '🙂', '😐', '😩'] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOTE_MAX = 10_000;
const LECTURES_MAX = 1_000;

export type ValidSession = JourneySession & { course: CourseId };
export type ParseResult = { ok: true; session: ValidSession } | { ok: false; error: string };

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isPosInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 1;

function isCalendarDate(x: unknown): x is string {
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

// Validates a POST /api/player/sessions body. Every message names the offending
// field — it ends up in the player's outbox `lastError`, which is what Rahul reads.
export function parseJourneySession(body: unknown): ParseResult {
  try {
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
    check(isPosInt(b.minutes) && b.minutes <= 1440, 'minutes must be a whole number from 1 to 1440');

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
    check(mood === null || (PLAYER_MOODS as readonly string[]).includes(mood), moodMsg);

    check(b.note === null || typeof b.note === 'string', 'note must be null or a string');
    check(b.note === null || b.note.length <= NOTE_MAX, `note is longer than ${NOTE_MAX} characters`);
    const note = b.note?.trim() || null;

    return {
      ok: true,
      session: {
        id: b.id.toLowerCase(),
        course,
        startedAt: b.startedAt,
        endedAt: b.endedAt,
        studyDate: b.studyDate,
        minutes: b.minutes,
        sectionNumber: b.sectionNumber,
        lecturesCompleted,
        finishedSections: finished,
        mood,
        note,
      },
    };
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: e.message };
    throw e;
  }
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
  };
}
