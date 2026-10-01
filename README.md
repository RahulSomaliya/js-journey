# Mansi's JS Journey

A small, warm web app that tracks Mansi's study — first
[Jonas Schmedtmann's *Complete JavaScript Course*](https://www.udemy.com/course/the-complete-javascript-course/) (done ✓),
now his *Ultimate React Course* (2023) — and lets her coach (Rahul) review it honestly against a date-anchored plan.

- **Student view** (`/m/<token>`) — a phone-friendly mirror of her Course Player home: Rahul's unread replies and notes first (marked read once shown), this week's goal / pace / course due date, the stats she sees in the player (Today · Streak · Complete · Due + the last 30 days), her latest updates with his replies ("See all" pages the rest), and a manual sign-off for study away from the player. The finished JS course is one quiet line at the bottom.
- **Coach view** (`/r/<token>`) — her unread updates on top, each with its own reply box ("Mark read" without replying), a note composer, the same stats she sees (from the player's progress snapshot), the plan week by week with the Diwali break, then the read history with his replies. Unread count in the tab title. `?course=js` = the finished JS course's history.
- Look: the Course Player's design system (`app/globals.css` tokens, system font, light + dark).
- **Course Player API** (`/api/player/*`) — the local Course Player app posts finished study sessions and reads her status, server-to-server with `Authorization: Bearer <student token>`.

## Plans

| Course | Start | Pace | Multiplier | Target | Deadline |
|---|---|---|---|---|---|
| `js` — Complete JavaScript (finished) | Mon 22 Jun 2026 | 2.5 h/day × 5 | 2.5× | Fri 25 Sep | Fri 2 Oct |
| `react-2023` — Ultimate React (active) | Mon 5 Oct 2026 | 2.5 h/day × 5 | 1.75× | Fri 25 Dec | Fri 1 Jan 2027 |

React: 30 counted sections (every folder except §04 *Review of Essential JavaScript*) = 3916 video-min (65.3 h) → 114.2 study-hours → 10 study weeks + 1 grace week.
Plan breaks (`ScheduleConfig.breaks`) are days with no study: **Diwali, Sun 1 – Sun 15 Nov 2026** (10 study days) moves the
target and deadline two weeks later (from Fri 11 / Fri 18 Dec). Pace, due dates and the daily no-log email skip break
days (the streak is the player's: calendar days with ≥ 5 min, so a break ends it — same number in both apps). Constants: `lib/config.ts`; curricula: `lib/curriculum.ts`; pinned in `tests/courses.test.ts`.

## Course Player API

Contract types mirror `~/Developer/course-player/shared/types.ts` (`lib/player.ts`) — change both together.

- `POST /api/player/sessions` — body `JourneySession` (one sign-off = one update for Rahul). 201 stored · 200 duplicate (dedup on `session.id`, unique `log_entries.external_id`) · 400 invalid (message names the field) · 401 bad token · 500 transient (player retries). Section `NN` of the course maps to section id `100 + NN`. `minutes` may be 0 only with a note; `stuck` / `autoClosed` are stored; `progress` is upserted as the course's snapshot (newest `takenAt` wins) — an unusable `progress` is dropped (`progress: "ignored"`), never the update.
- `GET /api/player/status?course=react-2023` — `JourneyStatus`: pace, this plan week's `goal`, `sectionDue` (plan-week Friday per section), `skippedSections`, `planBreak` (the break in progress, else the next within 14 days, else null). 400 without `course`, 404 for an unknown course, 401 bad token.
- `GET /api/player/feed?course=react-2023&cursor=&limit=30` — `JourneyFeed`: her updates newest first with Rahul's replies, his notes and `unreadReplies` (older updates carrying a reply she has not seen — both first page only), her unread count; paginated with the opaque `nextCursor`. 400 bad cursor/limit.
- `POST /api/player/feed/read` — `{ ids }` of coach messages she has seen; idempotent (`{ status: "ok", marked }`).
- `PUT /api/player/progress` — `ProgressSnapshot`; `{ status: "stored" | "stale" }` (newest `takenAt` wins); 400 for a `takenAt` more than 24 h ahead of the server clock (one far-future snapshot would lock out every later one).

All answers are `Cache-Control: no-store`; 4xx only for input that can never succeed (the player's outbox drops it). Data layer for the pages: [`docs/v2-data-layer.md`](docs/v2-data-layer.md).

## Stack

Next.js (App Router) · Neon Postgres · Drizzle ORM · Vercel · Resend · pnpm.

## Docs

- Design spec: [`docs/superpowers/specs/2026-06-15-mansi-js-journey-design.md`](docs/superpowers/specs/2026-06-15-mansi-js-journey-design.md)

> Personal project. Access is by secret link; there are no public accounts.
