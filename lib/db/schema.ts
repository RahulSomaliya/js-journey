import { pgTable, integer, text, uuid, timestamp, boolean, date, pgEnum, jsonb, index } from 'drizzle-orm/pg-core';
// relative, not '@/': drizzle-kit and scripts/seed.ts load this file without the path alias
import { COURSE_IDS } from '../course-ids';
import type { LectureDone } from '../schedule';
import type { ProgressSnapshot } from '../player';

export const sectionKind = pgEnum('section_kind', ['core', 'bonus', 'skip']);
export const messageAuthor = pgEnum('message_author', ['coach', 'student']);
export const messageKind = pgEnum('message_kind', ['encouragement', 'stuck']);
export const courseId = pgEnum('course_id', COURSE_IDS);
export const logSource = pgEnum('log_source', ['manual', 'player']);

// DEFAULT 'js' on both `course` columns exists ONLY so migration 0002 backfills the
// rows that predate multi-course (all JS). Every write path passes `course` explicitly
// (NewLog.course is required; scripts/seed.ts sets it) — a raw INSERT that omits it
// would land in the finished JS history, so don't write rows by hand without it.
export const sections = pgTable('sections', {
  id: integer('id').primaryKey(), // JS 1..21; React 101..131 = 100 + folder number (lib/curriculum.ts)
  course: courseId('course').notNull().default('js'),
  title: text('title').notNull(),
  videoMinutes: integer('video_minutes').notNull(),
  kind: sectionKind('kind').notNull(),
  sortOrder: integer('sort_order').notNull(), // the section's own number within its course
});

// append-only sessions: several rows per (study_date, section) are legitimate —
// each check-in / player session is its own row and read paths aggregate.
export const logEntries = pgTable('log_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  course: courseId('course').notNull().default('js'),
  studyDate: date('study_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  sectionId: integer('section_id').references(() => sections.id),
  minutes: integer('minutes').notNull(),
  note: text('note'),
  mood: text('mood'), // free-text emoji (UI constrains to 4 choices) — intentionally relaxed from spec's enum
  finishedSection: boolean('finished_section').notNull().default(false),
  source: logSource('source').notNull().default('manual'),
  // Course Player JourneySession.id — UNIQUE is the idempotency guarantee for player
  // retries (insertPlayerLog uses ON CONFLICT DO NOTHING on it). NULL for manual rows
  // (Postgres allows many NULLs under a unique constraint).
  externalId: text('external_id').unique(),
  lecturesCompleted: jsonb('lectures_completed').$type<LectureDone[]>(),
  // other sections finished during a player session — see LogEntry.alsoFinishedIds
  alsoFinishedIds: integer('also_finished_section_ids').array(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  // v2 coaching (migration 0003). Every row is an "update" Rahul reads: coach_read_at NULL =
  // unread for him. 0003 backfilled every row that existed then as read (old history must
  // not flood his inbox) — so NULL on an old row means "arrived after 0003", never "lost".
  stuck: boolean('stuck').notNull().default(false),
  autoClosed: boolean('auto_closed').notNull().default(false),
  coachReadAt: timestamp('coach_read_at', { withTimezone: true }),
}, (t) => [
  index('log_entries_course_study_date_idx').on(t.course, t.studyDate),
  // the feed / coach inbox page: WHERE course = ? AND (created_at, id) < cursor ORDER BY created_at DESC,
  // id DESC (lib/db/queries.ts updatesPageQuery). It only serves that query EXACTLY as written:
  //  * `id` must stay in it — else neither the ORDER BY nor the row-comparison cursor can use it;
  //  * NULLS FIRST must stay — drizzle's .desc() alone emits DESC NULLS LAST, which does not match
  //    `ORDER BY … DESC` (= NULLS FIRST) — the planner then ignores the index (NOT NULL doesn't help).
  // Either mistake = seq scan + sort of every row: measured on 20k rows, 236 buffers vs 6.
  index('log_entries_course_created_at_idx').on(t.course, t.createdAt.desc().nullsFirst(), t.id.desc().nullsFirst()),
]);

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  author: messageAuthor('author').notNull(),
  kind: messageKind('kind').notNull(),
  body: text('body').notNull(),
  sectionId: integer('section_id').references(() => sections.id),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  // v2 (0003): a coach message with log_entry_id is a REPLY to that update; without it, a
  // standalone note. student_read_at NULL = unread for Mansi (coach messages only — her own
  // 'stuck' messages never get one). 0003 backfilled every coach message that existed then.
  logEntryId: uuid('log_entry_id').references(() => logEntries.id),
  studentReadAt: timestamp('student_read_at', { withTimezone: true }),
}, (t) => [index('messages_log_entry_id_idx').on(t.logEntryId)]);

// The Course Player's latest ProgressSnapshot per course (v2, 0003) — what the coach view's
// stats are computed from (lib/stats.ts). ONE row per course, newest wins: updated_at is
// the snapshot's own takenAt (her Mac's clock, the only clock that orders her snapshots),
// and an upsert only replaces the row when the incoming takenAt is newer, so an outbox
// retry delivering an old snapshot late can never roll the numbers back.
export const progressSnapshots = pgTable('progress_snapshots', {
  course: courseId('course').primaryKey(),
  payload: jsonb('payload').$type<ProgressSnapshot>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});
