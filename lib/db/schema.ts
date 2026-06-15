import { pgTable, integer, text, uuid, timestamp, boolean, date, pgEnum, unique } from 'drizzle-orm/pg-core';

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

export const logEntries = pgTable(
  'log_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studyDate: date('study_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    sectionId: integer('section_id').references(() => sections.id),
    minutes: integer('minutes').notNull(),
    note: text('note'),
    mood: text('mood'), // free-text emoji (UI constrains to 4 choices) — intentionally relaxed from spec's enum
    finishedSection: boolean('finished_section').notNull().default(false),
  },
  (t) => [
    // one row per (study_date, section) enables same-day correction via upsert.
    // section_id NULL rows are exempt (Postgres NULLS DISTINCT default), so "review/other" entries can repeat.
    unique('uniq_day_section').on(t.studyDate, t.sectionId),
  ],
);

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  author: messageAuthor('author').notNull(),
  kind: messageKind('kind').notNull(),
  body: text('body').notNull(),
  sectionId: integer('section_id').references(() => sections.id),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});
