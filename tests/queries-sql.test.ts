import { describe, it, expect, vi, beforeAll } from 'vitest';

// The feed / read-state / snapshot SQL, checked as generated SQL (drizzle .toSQL(): no
// connection is ever opened — the URL below is a dummy). The behaviour against a real
// Postgres (pagination without gaps, idempotent reads, newest snapshot wins) was run on a
// throwaway local cluster; see docs/v2-data-layer.md "Database".
vi.mock('server-only', () => ({}));
let q: typeof import('@/lib/db/queries');
beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/never-connected';
  q = await import('@/lib/db/queries');
});
const norm = (s: string) => s.replace(/\s+/g, ' ');
const ID = '0b8f3c1e-7d2a-4f5b-9c3d-2e1f0a9b8c7d';
const ID2 = 'aa8f3c1e-7d2a-4f5b-9c3d-2e1f0a9b8c7d';
const CURSOR = { createdAt: '2026-10-05T12:00:03.123456Z', id: ID };

describe('feed page (listUpdates)', () => {
  it('keyset pagination in SQL: (created_at, id) < cursor, newest first, limit + 1 rows', () => {
    const { sql, params } = q.updatesPageQuery({ course: 'react-2023', filter: 'all', cursor: CURSOR, limit: 30 }).toSQL();
    expect(norm(sql)).toMatch(/where \("log_entries"."course" = \$1 and \("log_entries"."created_at", "log_entries"."id"\) < \(\$2::timestamptz, \$3::uuid\)\)/);
    expect(norm(sql)).toMatch(/order by "log_entries"."created_at" desc, "log_entries"."id" desc limit \$4$/);
    expect(params).toEqual(['react-2023', CURSOR.createdAt, CURSOR.id, 31]);
  });
  it('selects the cursor key with microseconds and joins the section for number + title', () => {
    const { sql } = q.updatesPageQuery({ course: 'react-2023', filter: 'all', cursor: null, limit: 30 }).toSQL();
    expect(sql).toContain(`to_char("log_entries"."created_at" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`);
    expect(norm(sql)).toMatch(/left join "sections" on "sections"."id" = "log_entries"."section_id"/);
    expect(sql).not.toContain('<'); // first page: no cursor condition
  });
  it('filters unread / read for the coach inbox and history', () => {
    expect(q.updatesPageQuery({ course: 'react-2023', filter: 'unread', cursor: null, limit: 5 }).toSQL().sql).toContain('"log_entries"."coach_read_at" is null');
    expect(q.updatesPageQuery({ course: 'react-2023', filter: 'read', cursor: null, limit: 5 }).toSQL().sql).toContain('"log_entries"."coach_read_at" is not null');
  });
  it('replies for exactly that page, in the same round trip (subquery, not an id list)', () => {
    const { sql } = q.repliesForPageQuery({ course: 'react-2023', filter: 'all', cursor: CURSOR, limit: 30 }).toSQL();
    expect(norm(sql)).toMatch(/"messages"."author" = \$1 and "messages"."log_entry_id" in \(select "id" from "log_entries" where .* order by "log_entries"."created_at" desc, "log_entries"."id" desc limit \$\d+\)/);
  });
});

describe('her unread replies on older updates (first feed page)', () => {
  it('updates of the course that carry an unread coach reply — any age, bounded, newest first', () => {
    const { sql, params } = q.unreadReplyUpdatesQuery('react-2023').toSQL();
    expect(norm(sql)).toMatch(/"log_entries"."course" = \$1 and "log_entries"."id" in \(select "log_entry_id" from "messages" where \("messages"."author" = \$2 and "messages"."student_read_at" is null and "messages"."log_entry_id" is not null\)\)/);
    expect(norm(sql)).toMatch(/order by "log_entries"."created_at" desc, "log_entries"."id" desc limit \$\d+$/);
    expect(params).toEqual(['react-2023', 'coach', q.UNREAD_REPLY_UPDATES_MAX]);
  });
  it('their replies come in the same round trip (subquery, not an id list)', () => {
    const { sql } = q.repliesForUnreadReplyUpdatesQuery('react-2023').toSQL();
    expect(norm(sql)).toMatch(/"messages"."author" = \$1 and "messages"."log_entry_id" in \(select "id" from "log_entries" where .* limit \$\d+\)/);
  });
});

describe('standalone notes + unread count', () => {
  const BOUNDARY = '2026-10-01T18:30:00.000Z'; // lib/courses.ts REACT_NOTES_FROM (Fri 2 Oct 00:00 IST)
  it('notes = every unread one + the most recent read ones, never replies', () => {
    const { sql, params } = q.notesQuery('react-2023', 10).toSQL();
    expect(norm(sql)).toMatch(/"messages"."log_entry_id" is null/);
    expect(norm(sql)).toMatch(/\("messages"."student_read_at" is null or "messages"."id" in \(select "id" from "messages" where .* limit \$\d+\)\)/);
    expect(params).toContain(10);
  });
  it('v3: notes are scoped to the course\'s era — React from the boundary on, JS before it (outer list AND the "recent" subquery)', () => {
    const react = q.notesQuery('react-2023', 10).toSQL();
    expect(norm(react.sql).match(/"messages"."created_at" >= \$\d+/g)).toHaveLength(2);
    expect(react.sql).not.toMatch(/"messages"."created_at" < /);
    expect(react.params.filter((p) => p === BOUNDARY)).toHaveLength(2);
    const js = q.notesQuery('js', 10).toSQL();
    expect(norm(js.sql).match(/"messages"."created_at" < \$\d+/g)).toHaveLength(2);
    expect(js.sql).not.toMatch(/"messages"."created_at" >= /);
    expect(js.params.filter((p) => p === BOUNDARY)).toHaveLength(2);
  });
  it('the "latest note" (JourneyStatus.coachNote) is scoped the same way', () => {
    const { sql, params } = q.latestCoachNoteQuery('react-2023').toSQL();
    expect(norm(sql)).toMatch(/"messages"."log_entry_id" is null and "messages"."created_at" >= \$\d+/);
    expect(params).toContain(BOUNDARY);
    expect(norm(q.latestCoachNoteQuery('js').toSQL().sql)).toMatch(/"messages"."created_at" < \$\d+/);
  });
  it('unread for her = what the course\'s pages can show: replies on THIS course\'s updates + notes of its era', () => {
    const { sql, params } = q.unreadForStudentQuery('react-2023').toSQL();
    expect(norm(sql)).toMatch(/where \("messages"."author" = \$1 and "messages"."student_read_at" is null and \(/);
    // a reply counts only when its update is this course's (the feed only ever shows this course's updates)
    expect(norm(sql)).toMatch(/"messages"."log_entry_id" in \(select "id" from "log_entries" where "log_entries"."course" = \$\d+\)/);
    // a note counts only inside the era notesQuery lists — the same condition, so the badge and the list agree
    expect(norm(sql)).toMatch(/\("messages"."log_entry_id" is null and "messages"."created_at" >= \$\d+\)/);
    expect(params).toEqual(['coach', 'react-2023', BOUNDARY]);
    const js = q.unreadForStudentQuery('js').toSQL();
    expect(norm(js.sql)).toMatch(/\("messages"."log_entry_id" is null and "messages"."created_at" < \$\d+\)/);
    expect(js.params).toEqual(['coach', 'js', BOUNDARY]);
  });
});

describe('read state is idempotent', () => {
  it('her read: only coach messages, only those still unread — a second call keeps the first timestamp', () => {
    const { sql, params } = q.markCoachMessagesReadQuery([ID, ID2]).toSQL();
    expect(norm(sql)).toBe('update "messages" set "student_read_at" = now() where ("messages"."id" in ($1, $2) and "messages"."author" = $3 and "messages"."student_read_at" is null) returning "id"');
    expect(params).toEqual([ID, ID2, 'coach']);
  });
  it('his read: only updates still unread', () => {
    const { sql } = q.markUpdatesReadQuery([ID]).toSQL();
    expect(norm(sql)).toBe('update "log_entries" set "coach_read_at" = now() where ("log_entries"."id" in ($1) and "log_entries"."coach_read_at" is null) returning "id"');
  });
});

describe('reply = one coach message linked to the update + the update marked read (one transaction)', () => {
  it('builds both statements', () => {
    const [insert, update] = q.replyStatements(ID, 'Cleanup runs before the next effect 💚').map((s) => s.toSQL());
    expect(norm(insert.sql)).toMatch(/^insert into "messages" \(.*"author", "kind", "body", .*"log_entry_id".*\) values/);
    expect(insert.params).toEqual(expect.arrayContaining(['coach', 'encouragement', 'Cleanup runs before the next effect 💚', ID]));
    expect(norm(update.sql)).toBe('update "log_entries" set "coach_read_at" = now() where ("log_entries"."id" = $1 and "log_entries"."coach_read_at" is null)');
  });
});

describe('progress snapshot upsert', () => {
  it('newest takenAt wins: the conflict update only fires when the stored snapshot is older', () => {
    const snap = {
      course: 'react-2023' as const, takenAt: Date.parse('2026-10-05T06:12:05.000Z'), lecturesDone: 1, lecturesTotal: 410,
      videoSecondsDone: 60, videoSecondsTotal: 241_800, sectionsDone: [], current: null, days: {},
    };
    const { sql, params } = q.upsertSnapshotQuery(snap).toSQL();
    expect(norm(sql)).toMatch(/^insert into "progress_snapshots" \("course", "payload", "updated_at"\) values \(\$1, \$2, \$3\) on conflict \("course"\) do update set "payload" = excluded.payload, "updated_at" = excluded.updated_at where "progress_snapshots"."updated_at" < excluded.updated_at returning "course"$/);
    expect(params[0]).toBe('react-2023');
    expect(JSON.parse(String(params[1]))).toEqual(snap);
    expect(params[2]).toBe('2026-10-05T06:12:05.000Z');
  });
});
