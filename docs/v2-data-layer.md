# v2 data layer — for the /m and /r redesign

Spec: `~/Developer/course-player/docs/spec-v2-coaching.md` §B. Every sign-off (player or web) is one **update**
(a `log_entries` row) that Rahul reads and replies to. His **replies** (linked to an update) and standalone
**notes** are `messages` rows. Read state lives on both sides: `log_entries.coach_read_at` (his),
`messages.student_read_at` (hers). The player also pushes a **progress snapshot**, so both pages show the same
stats she sees in the player.

Pages stay `force-dynamic`; load data in the page, render it. The pages built on this: `app/r/[token]/page.tsx`
(coach), `app/m/[token]/page.tsx` (student); their words come from `lib/journey-view.ts`, and `tests/pages.test.ts`
renders both with the fixtures through `tests/page-queries.ts` (no database).

## Loading data (server only — `lib/db/queries.ts`)

| Call | Returns | Use |
|---|---|---|
| `loadOverview(course, now?)` | `Overview` (`lib/overview.ts`) | both pages: plan status + stats row + 30-day chart |
| `getJourneyFeed(course, cursor, limit)` | `JourneyFeed` (`lib/player.ts`) | `/m`: her updates + his replies, his notes, older updates with an unread reply, her unread count |
| `listUpdates({ course, filter, cursor, limit })` | `{ updates: FeedUpdate[]; nextCursor }` | `/r`: `filter: 'unread'` = inbox, `'read'` = history |
| `countUnreadUpdates(course)` | `number` | `/r` tab title ("(2) Mansi") |
| `getCoachNotes(course, recent = RECENT_NOTES)` | `CoachMessage[]` | `/r`: notes he sent in the course's era (unread ones + the 10 newest); the `?course=js` pages pass `HISTORY_NOTES_MAX` |

`course` is `ACTIVE_COURSE` (`lib/courses.ts`), or `'js'` on the JS history pages (`?course=js`, both: `getCourseSummary`
+ `listUpdates({ course: 'js', filter: 'all' })` + `getCoachNotes('js', HISTORY_NOTES_MAX)`, read-only).
**Notes are scoped by time** (v3): a standalone note has no course column — it is the course's whose era it was written in
(`lib/courses.ts` `noteWindow`; React from `REACT_NOTES_FROM`, Fri 2 Oct 00:00 IST). Every note read uses the same window. Cursors: pass `nextCursor` back as-is (e.g. `?before=<cursor>`);
parse a user-supplied one with `decodeCursor` (`lib/feed.ts`, null = invalid → treat as first page). Every list is
paginated in SQL (keyset on `(created_at, id)`, one round trip with its replies).

### Shapes

- **`Overview`** — `today` (IST `YYYY-MM-DD`), `status: JourneyStatus`, `stats: JourneyStats`, `currentSection`
  (first unfinished counted section = "you're here", or null), plus `sections`, `logs`, `config` for the plan list
  (`buildMilestones(sections, config)` in `lib/schedule.ts` = the weekly goals; `finishedSectionIds(logs)` = done).
- **`JourneyStatus`** (same object the player gets) — `pace` (`ahead | on-track | behind`) + `daysDelta` (study days,
  signed) from ONE model, the weekly goals (`lib/status.ts` `planPace`: behind = a past Friday's goal unmet), `week`,
  `totalWeeks`, `targetDate`, `deadline`, `goal` (**this plan week's goal**: `{ sectionNumber, title, due }`, null
  when the course is done), `sectionDue` (`"7" → "2026-10-16"`, plan-week Friday; skipped sections have none),
  `skippedSections` (`[4]`), `planBreak` (current / next only), `coachNote`, `studyWeekdays` (`[1,2,3,4,5]`, ISO) +
  `planBreaks` (every break) — the calendar the streak walks; `plan` (v3, `GET /api/player/status` only: the coach page's
  `planRows` — the pages print `planRows(overview)` themselves).
- **`JourneyStats`** (`lib/stats.ts`) — the player's row, mirrored:
  - `today { date, seconds }` · `streak` (study days) · `complete { percent, label, lecturesDone, lecturesTotal }` —
    print `label` (`"<1%"`, `"42%"`), never round `percent` yourself; `lecturesTotal` is null without a snapshot
  - `due { date, pace, daysDelta, onBreak }` — `pace` is null before the plan starts and during a break
    (`onBreak = { label }`); print the word with `paceLabel(due)` ("Behind by 3 days"), the day she is back with
    `weekView` (one "back on" rule)
  - `last30 { days: { date, seconds }[30] (oldest → today), averageSeconds }`
  - `current` (the lecture "Continue" points at, or null) · `source` (`snapshot | sessions`) · `asOf` (ISO or null)
- **`FeedUpdate`** (`lib/feed.ts`) = the contract's `StudentUpdate` + `logId` + `autoClosed`:
  `id` (player session id — **not** what actions take), `logId` (**pass this to coach actions**), `source`
  (`player | manual`), `studyDate`, `createdAt`, `minutes` (0 = note-only), `sectionNumber`, `sectionTitle`,
  `lectures[]`, `mood`, `note`, `stuck`, `autoClosed`, `coachReadAt` (null = unread for him),
  `replies: CoachMessage[]` (oldest first; `readAt` null = unread for her).
- **`JourneyFeed`** — `updates: StudentUpdate[]` (newest first), `notes: CoachMessage[]` (the course's era) and `unreadReplies:
  StudentUpdate[]` (older updates, not in `updates`, that carry a reply she has not seen — both **first page only**;
  later pages `[]`), `unreadForStudent` (this course: replies on its updates + notes of its era), `nextCursor`. Her unread =
  replies (in `updates` AND `unreadReplies`) + notes with `readAt === null` — `unreadFromRahul` reads all three.

## Actions (`'use server'`, all return `ActionResult` = `{ ok: true, … } | { ok: false, error }`)

`error` is written for the person on the page — show it as-is. Each checks the role cookie (`/m` = student,
`/r` = coach). For `useActionState`, wrap: `useActionState((_: ActionResult | null, fd: FormData) => replyToUpdateAction(fd), null)`.

| Action | Who | Input | Does |
|---|---|---|---|
| `replyToUpdateAction` (`lib/actions/message.ts`) | coach | form `logId`, `body` | reply linked to the update **and** marks it read (one transaction); revalidates both pages |
| `markUpdatesReadAction` (`lib/actions/log.ts`) | coach | form `logId` (repeatable) | marks read without replying → `{ marked }` |
| `sendCoachNoteAction` (`lib/actions/message.ts`) | coach | form `body` | standalone note, unread for her |
| `markCoachMessagesReadAction` (`lib/actions/message.ts`) | student | `ids: string[]` (message ids) | marks shown replies/notes read → `{ marked }`; revalidates **only /r** so her page keeps its "new" marks while she reads |
| `signOffAction` (`lib/actions/log.ts`) | student | form `minutes` (0–1440; 0 needs `note`), `note`, `mood`, `stuck`=`on`, `sectionId`, `finishedSection`=`on` | one manual update (emails Rahul, stuck flagged) |

Moods: only `PLAYER_MOODS` (😄 🙂 😐 😩) with `MOOD_LABELS` (Great / Good / Okay / Tough) from `lib/player.ts` —
`signOffAction` refuses others (the v1 web moods 🚀 😊 😮‍💨 are gone; `components/student/sign-off-form.tsx`
offers the four). Old rows may still carry v1 moods: render any string (`components/ui.tsx` `Mood`).

## Fixtures (`lib/fixtures.ts`) — render pages without a database

Built through the real pure code (`buildOverview`, `assemblePage`), so they return exactly the production shapes.

| Scenario | Now (IST) | What it exercises |
|---|---|---|
| `typical` | Wed 21 Oct 19:00 | week 3, on track; 2 unread updates for him (one **stuck** with a 539-char note, one **auto-closed**), a note-only manual day, threaded replies; 1 unread reply + 1 unread note for her |
| `behind` | Wed 21 Oct | stopped after Thu 8 Oct: behind, streak 0, nothing unread |
| `diwali` | Wed 4 Nov | on the break (`stats.due.onBreak`), on plan through §16 |
| `empty` | Sat 3 Oct | before the start: no updates, notes, snapshot (stats from sessions = zeros) |

Every scenario also has three JS-era notes (`fixtureNotes(s, 'js')`; one she never saw) — no React list includes them.
`fixtureOverview(s)` → `Overview` · `fixtureFeed(s, limit?)` → `JourneyFeed` (small `limit` = real `nextCursor`) ·
`fixtureInbox(s, historyLimit?)` → `{ unread, unreadCount, history: { updates, nextCursor }, notes }` ·
`fixtureUpdates(s)` → every `FeedUpdate` · `fixtureSnapshot(s)` · `FIXTURE_NOW[s]`. Pinned in `tests/fixtures.test.ts`.

## Traps

- **One streak.** The pages show `stats.streak` = the player's rule (`lib/stats.ts` `streak`, same test table as
  course-player): study days ≥ 5 min walking back from today; a missed plan study day ends it, a quiet weekend /
  break day is skipped, today in progress never ends it. It walks `status.studyWeekdays` + `status.planBreaks` —
  the calendar the player gets — never a second weekday list.
- **Two "current" due dates.** Use `status.sectionDue` / `status.goal` (fixed plan, Fridays) — they always agree.
  `buildDynamicSchedule().perSectionDue` is the v1 projection; using it next to them shows two dates for one section.
- `notes` and `unreadReplies` ride on the first feed page only — don't append later pages' (empty) ones over them.
- "Your updates" on `/m` interleaves his notes (`withNotes`): `/m` marks a note read the moment it shows, so a read
  note must still render there or it is gone after one visit.
- Coach actions take `FeedUpdate.logId`, not `id`.
- With a snapshot, manual (web) minutes are **not** in Today/Streak/chart — the player never sees them either.
- The v1 "stuck" messages (`sendStuckAction`, `resolveStuckAction`, `openStuckFlags`) are gone — v2 flags `stuck` on
  the update. `getCourseSummary` stays: the JS line on `/m` and both `?course=js` headers.
- A note list and its unread count must share the note window (`noteEra` in `lib/db/queries.ts`) — see CLAUDE.md.
- The `?course=js` pages mark nothing read: no `FromRahul`, `newMarks={false}`.
- `/m` reads the feed at limit 30 and shows 5; "From Rahul" = that page's unread replies + `unreadReplies` + notes.

## Database

Migration `drizzle/0003_*.sql` (additive; backfills all existing updates/coach messages as read). **Not applied** —
Rahul applies it as reviewed SQL in ONE transaction before the v2 deploy (after 0002 + the seed). It has no
`IF NOT EXISTS`, so only a whole-file transaction is re-runnable after a failure:
- Neon SQL Editor (no `psql` on the Mac): paste `BEGIN;`, the whole file, `COMMIT;` — run once.
- or `psql` (`brew install libpq`), DATABASE_URL in the shell, never printed:
  `psql "$DATABASE_URL" --single-transaction -v ON_ERROR_STOP=1 -f drizzle/0003_faulty_korg.sql`
- then the two checks in the file's header (both 0). Verified on a throwaway local
Postgres 18 (prod-like rows → 0003 → 0 unread; then the generated SQL for: keyset pagination over same-millisecond
and identical timestamps without gaps/repeats, replies-per-page, notes, idempotent read marks, reply = message +
read, newest-snapshot-wins; and `EXPLAIN` = index scan, 6 buffers at 20k rows).
