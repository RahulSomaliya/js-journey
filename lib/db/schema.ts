import { pgTable, integer, text, uuid, timestamp, boolean, date, pgEnum, jsonb, index } from 'drizzle-orm/pg-core';
// relative, not '@/': drizzle-kit and scripts/seed.ts load this file without the path alias
import { COURSE_IDS } from '../course-ids';
import type { LectureDone } from '../schedule';

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
}, (t) => [index('log_entries_course_study_date_idx').on(t.course, t.studyDate)]);

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  author: messageAuthor('author').notNull(),
  kind: messageKind('kind').notNull(),
  body: text('body').notNull(),
  sectionId: integer('section_id').references(() => sections.id),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});
