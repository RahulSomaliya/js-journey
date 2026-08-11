import { pgTable, integer, text, uuid, timestamp, boolean, date, pgEnum } from 'drizzle-orm/pg-core';

export const sectionKind = pgEnum('section_kind', ['core', 'bonus', 'skip']);
export const messageAuthor = pgEnum('message_author', ['coach', 'student']);
export const messageKind = pgEnum('message_kind', ['encouragement', 'stuck']);

export const sections = pgTable('sections', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  videoMinutes: integer('video_minutes').notNull(),
  kind: sectionKind('kind').notNull(),
  sortOrder: integer('sort_order').notNull(),
});

// append-only sessions: several rows per (study_date, section) are legitimate —
// each check-in is its own study session and read paths aggregate.
export const logEntries = pgTable('log_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  studyDate: date('study_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  sectionId: integer('section_id').references(() => sections.id),
  minutes: integer('minutes').notNull(),
  note: text('note'),
  mood: text('mood'), // free-text emoji (UI constrains to 4 choices) — intentionally relaxed from spec's enum
  finishedSection: boolean('finished_section').notNull().default(false),
});

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  author: messageAuthor('author').notNull(),
  kind: messageKind('kind').notNull(),
  body: text('body').notNull(),
  sectionId: integer('section_id').references(() => sections.id),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});
