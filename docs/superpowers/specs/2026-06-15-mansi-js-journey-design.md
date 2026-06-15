# Mansi's JS Journey — Design Spec

**Status:** Approved (design locked 2026-06-15)
**Author:** Rahul (with Claude)
**Topic:** A daily progress tracker for Mansi's study of *The Complete JavaScript Course* (Jonas Schmedtmann)

---

## 1. Purpose & goals

A small, beautiful, fully deployed web app with two jobs:

1. **For Mansi (student):** make logging her daily study progress a ~15-second joy, never a chore — so her resistance to giving updates drops as far as possible.
2. **For Rahul (coach):** an honest, complete view of her real progress vs. a fixed, date-anchored schedule — effort, content completed, pace, projected finish, and a heads-up when she logs or misses a day.

The app must double as a clean, teachable full-stack backend example for Rahul (frontend engineer learning backend): a real database as source of truth, an API layer, server-side logic, and a deployable architecture.

**North-star design principle:** warm and encouraging on Mansi's surface; honest and complete on Rahul's. The app should feel like *connection and coaching*, not surveillance.

## 2. The course (real curriculum)

- **Course:** *The Complete JavaScript Course: From Zero to Expert!* — Jonas Schmedtmann (2025 ES2024/ES2025 edition).
- **Published total:** ~71.3 video-hours, 332 lectures, 21 Udemy sections.
- **Core teaching content (gates the deadline):** 68.2 video-hours across 18 core sections.
- **Excluded as non-gating:**
  - `[OPTIONAL] HTML & CSS Crash Course` — **skipped entirely** (Mansi has just completed HTML/CSS).
  - `How to Navigate This Course`, `Setting Up Git and Deployment`, `The End!`, `[LEGACY] Access the Old Course` — admin/bonus; she may log them but they don't gate progress.

Per-section durations are estimated (Udemy does not publish them publicly), scaled to sum to the published total and weighted toward the heavy project sections. They are **stored as editable seed data** so they can be corrected from a logged-in Udemy session later.

### Core sections (seed data, in order)

| # | Section | Video-h | Gating |
|---|---------|---------|--------|
| 1 | Welcome, Welcome, Welcome! | 0.4 | core |
| 2 | JavaScript Fundamentals – Part 1 | 5.0 | core |
| 3 | JavaScript Fundamentals – Part 2 | 4.5 | core |
| 4 | How to Navigate This Course | 0.2 | bonus |
| 5 | Developer Skills & Editor Setup | 1.8 | core |
| 6 | [OPTIONAL] HTML & CSS Crash Course | 1.5 | **skip** |
| 7 | JS in the Browser: DOM & Events [PROJECT] | 5.0 | core |
| 8 | How JavaScript Works Behind the Scenes | 3.0 | core |
| 9 | Data Structures, Modern Operators & Strings | 4.5 | core |
| 10 | A Closer Look at Functions | 3.5 | core |
| 11 | Working With Arrays — Bankist [PROJECT] | 6.0 | core |
| 12 | Numbers, Dates, Intl & Timers [PROJECT] | 3.0 | core |
| 13 | Advanced DOM and Events [PROJECT] | 4.5 | core |
| 14 | Object-Oriented Programming (OOP) | 5.5 | core |
| 15 | Mapty App: OOP, Geolocation, Libraries [PROJECT] | 4.5 | core |
| 16 | Asynchronous JS: Promises, Async/Await, AJAX | 5.5 | core |
| 17 | Modern JS Development: Modules, Tooling, Functional | 4.5 | core |
| 18 | Forkify App: Building a Modern Application [PROJECT] | 7.0 | core |
| 19 | Setting Up Git and Deployment | 0.8 | bonus |
| 20 | The End! | 0.2 | bonus |
| 21 | [LEGACY] Access the Old Course | 0.4 | bonus |

Core gating total = **68.2h**.

## 3. The schedule & pace model

- **Pace:** 2.5 h/day × 5 days = **12.5 wall-clock h/week**.
- **Conservatism multiplier:** **2.5×** (accounts for coding-along, pausing, redoing challenges).
- **Study budget:** 68.2 × 2.5 = **170.5 study-hours**.
- **Content completion rate:** 12.5 ÷ 2.5 = **5.0 video-hours of content cleared per week**.
- **Duration:** 170.5 ÷ 12.5 = 13.6 → **14 weeks**.
- **Start:** Monday **22 Jun 2026**. **Study days Mon–Fri; checkpoints fall each Friday.**
- **Core-complete target:** Friday **25 Sep 2026**.
- **Official deadline (1-week grace):** Friday **2 Oct 2026**.

### Weekly milestones (date-anchored)

| Wk | By Friday | Cum content target | Finish through |
|----|-----------|--------------------|----------------|
| 1 | 26 Jun 2026 | 5h | S1–2 · JS Fundamentals Part 1 |
| 2 | 03 Jul 2026 | 10h | S3 · JS Fundamentals Part 2 |
| 3 | 10 Jul 2026 | 15h | S5 · Developer Skills & Setup |
| 4 | 17 Jul 2026 | 20h | S8 · How JS Works Behind the Scenes |
| 5 | 24 Jul 2026 | 25h | S9 · Data Structures & Strings |
| 6 | 31 Jul 2026 | 30h | S10 · A Closer Look at Functions |
| 7 | 07 Aug 2026 | 35h | S11 · Working With Arrays (Bankist) |
| 8 | 14 Aug 2026 | 40h | S12 · Numbers, Dates, Timers |
| 9 | 21 Aug 2026 | 45h | S13 · Advanced DOM & Events |
| 10 | 28 Aug 2026 | 50h | S14 · OOP |
| 11 | 04 Sep 2026 | 55h | S15 · Mapty App |
| 12 | 11 Sep 2026 | 60h | S16 · Asynchronous JS |
| 13 | 18 Sep 2026 | 65h | S17 · Modern JS Tooling |
| 14 | **25 Sep 2026** | 68h | **S18 · Forkify — complete** |

### Monthly phases (the "monthly goals")

- **Phase 1 — Foundations** (Wk1–3, 22 Jun → 10 Jul): Sections 1–5.
- **Phase 2 — Core JS** (Wk4–6, 13 Jul → 31 Jul): Sections 7–10.
- **Phase 3 — Real apps & data** (Wk7–10, 03 Aug → 28 Aug): Sections 11–14.
- **Phase 4 — Modern JS & capstone** (Wk11–14, 31 Aug → 25 Sep): Sections 15–18.

### Pace computation (the engine)

All schedule constants live in one config module so they can be tuned in one place: `START_DATE`, `DAILY_HOURS`, `STUDY_DAYS_PER_WEEK`, `MULTIPLIER`, `GRACE_WEEKS`, and the seeded section list.

Derived on the server / shared lib:
- `idealContentHoursBy(date)` = `min(coreHours, 5.0 × full_study_weeks_elapsed(date))` — a step function that advances on each Friday checkpoint (weekends don't add expectation). A linear within-week variant may be used for the "soft" student signal.
- `actualContentHours` = sum of `videoHours` of sections marked **finished** (binary credit; the in-progress section shows as "in progress", contributing 0 until ticked).
- `actualEffortHours` = sum of all logged minutes ÷ 60.
- `paceStatus` = compare `actualContentHours` to `idealContentHoursBy(today)`:
  - `ahead` if actual ≥ ideal + 2.5h (half a week)
  - `on_track` if within ±2.5h
  - `behind` if actual < ideal − 2.5h (report the gap in hours and in "≈ N days behind")
- `projectedFinish` = `today + (coreHours − actualContentHours) / recentWeeklyRate`, where `recentWeeklyRate` is content cleared over the trailing ~14 days (fallback to plan rate of 5h/wk if too little data). Compared against 25 Sep / 2 Oct.

## 4. Users & access model

Two people, no account system. Access is by **unguessable secret token in the URL**:

- `/m/<STUDENT_TOKEN>` → Mansi's warm check-in & progress.
- `/r/<COACH_TOKEN>` → Rahul's full dashboard.
- `/` → a calm public cover page (no data), links nowhere sensitive.

Tokens are long random strings stored as environment variables and validated server-side on every request to a protected route/API. The token IS the credential (appropriate for a private two-person app). Optional future hardening: a 4-digit PIN gate. Tokens are never embedded in the public cover page or in client bundles destined for the other party.

## 5. Data model (Postgres via Drizzle)

Kept small and teachable.

- **`sections`** — seeded reference data.
  `id` (int, the course section number), `title` (text), `video_hours` (numeric), `kind` (enum: `core` | `bonus` | `skip`), `sort_order` (int).
- **`log_entries`** — one row per check-in.
  `id` (uuid), `study_date` (date), `created_at` (timestamptz), `section_id` (int → sections, nullable for "review/other"), `minutes` (int), `note` (text, nullable), `mood` (smallint/enum, nullable), `finished_section` (bool, default false).
- **Section completion is NOT a stored table.** It is **computed on read** from `log_entries.finished_section` (a section is "finished" once any log entry for it has the flag set). This keeps a single write path and no cache to invalidate; trivial at this data scale.
- **`messages`** — the mentoring loop (both directions).
  `id` (uuid), `created_at`, `author` (enum: `coach` | `student`), `kind` (enum: `encouragement` | `stuck`), `body` (text), `section_id` (int, nullable, for stuck-on-X), `resolved_at` (timestamptz, nullable, for stuck flags Rahul has addressed).

No migrations framework ceremony beyond Drizzle Kit; the schema is small enough to push.

## 6. Mansi's experience (`/m/...`) — the warm view

- **Greeting + Today's focus:** friendly hello and her current section pre-selected (the first unfinished core section).
- **The check-in (one screen, minimal taps):**
  1. Section (defaulted to current; changeable).
  2. Hours stepper (defaults to 2.5).
  3. Optional one-line note + optional mood emoji.
  4. Optional "✓ I finished this section" toggle.
  5. Submit → confetti + an encouraging, varied line ("Two and a half hours today — that's real progress 🎉").
- **Her progress card:** a soft progress ring (content %), a **streak 🔥** (consecutive study days, weekends don't break it), and a gentle pace pill: *on track* / *just a little behind* / *ahead!* — never a harsh countdown.
- **A note from your coach:** the latest encouragement Rahul leaves appears here. This is the feature that reframes the app as connection.
- **I'm stuck on…:** one tap (optionally tied to the current section) opens a short field; sending it surfaces on Rahul's dashboard so he can help.
- **Tone:** rounder corners, more whitespace, celebratory micro-interactions. Reduced-motion respected.

## 7. Rahul's experience (`/r/...`) — the honest dashboard

- **Headline status:** `on track / ahead / behind by X` + content % + effort hours vs ideal-by-today.
- **Projected finish** vs 25 Sep target and 2 Oct deadline; a live countdown.
- **This week:** expected sections vs done; current section and how long it's taking vs budget.
- **Study-day heatmap:** GitHub-style calendar of logged days (consistency at a glance).
- **Recent logs feed:** date, section, hours, note, mood.
- **Stuck flags:** open items needing his help; mark resolved.
- **Send encouragement:** a box to post a coach note (shows on her side).
- **Full schedule table** with real dates and live "done/expected" marks.

## 8. Notifications

- **Provider:** Resend (free tier). Requires a `RESEND_API_KEY` from Rahul at deploy time.
- **On-log ping:** when a new log is submitted, a one-line email to Rahul ("Mansi logged 2.5h on Working With Arrays — on track 🎉").
- **Daily check:** a Vercel Cron route (~21:00 IST) emails Rahul if no log exists for that study day ("No log from Mansi today"). Weekends optional/quiet.
- **Fallback:** if email is undesirable, the dashboard's last-log + missed-days indicator covers it passively. Email is the chosen default.

## 9. Visual system

Inherits the reference file (`~/Documents/Personal/family-health-insurance.html`) directly:
- Warm `paper` background, `surface` cards, single green accent, full CSS-variable token set, **light/dark theming** with no-flash init.
- **Fraunces** (display serif) + **IBM Plex Sans** (body).
- Animated checkboxes, progress bars/rings, tasteful entrance motion, `prefers-reduced-motion` honored.
- Two moods, one system: Mansi's side rounder/celebratory; Rahul's side denser/data-forward.
- Per user rule: **use the shared CSS-variable color tokens, never static colors.**

## 10. Tech stack & deployment

- **Framework:** Next.js (App Router) — React frontend + route handlers / server actions in one deployable unit.
- **DB:** Neon Postgres (serverless, free tier), accessed via **Drizzle ORM** + Neon serverless driver.
- **Styling:** Tailwind mapped onto the CSS-variable tokens (or plain CSS modules using the tokens) — tokens are the source of truth either way.
- **Hosting:** Vercel (deploy via the Vercel integration / MCP).
- **Email:** Resend.
- **Package manager:** pnpm.
- **Repo:** GitHub (created via GitHub MCP, not the `gh` CLI), linked to Vercel for CI/CD.
- **Env vars:** `DATABASE_URL`, `STUDENT_TOKEN`, `COACH_TOKEN`, `RESEND_API_KEY`, `CRON_SECRET`, `TZ`/timezone handling for IST.

### Deployment sequence (to be detailed in the plan)
1. Scaffold Next.js app, commit.
2. Provision Neon DB (needs Rahul login) → `DATABASE_URL`.
3. Push schema + seed sections.
4. Create GitHub repo (MCP) + push.
5. Create Vercel project, set env vars, deploy.
6. Add Resend key + verify email send.
7. Smoke-test both token routes on the live URL; verify cross-device.

## 11. Non-goals (YAGNI for v1)

- No user accounts / passwords / multi-tenant support.
- No native mobile app (responsive PWA-friendly web only).
- No analytics dashboards beyond what's specified.
- No social/sharing features.
- No editing of past logs beyond same-day correction (v1 keeps it simple; can add later).
- No gamified rewards beyond streak + confetti + coach notes.

## 12. Success criteria

- Mansi can complete a daily check-in in well under 30 seconds on her phone, including section + hours + note.
- Data written on one device is visible on the other within a normal refresh (single source of truth confirmed).
- Rahul's dashboard correctly shows content %, effort hours, pace status, and projected finish against the real dates above.
- Section completion flips content % using binary credit; the schedule table marks done/expected accurately for the current date.
- Coach notes appear on Mansi's side; stuck flags appear on Rahul's side and can be resolved.
- Daily/on-log emails reach Rahul.
- Light/dark theming and reduced-motion both work; visuals are faithful to the reference's design language.
- App is live on a public Vercel URL with both secret routes working.

## 13. Open items / dependencies (need Rahul at deploy time)

- Neon account/login to provision the database.
- Resend account → `RESEND_API_KEY` (and confirm sender/recipient email).
- Vercel + GitHub account confirmation for deploy.
- Confirm Rahul's notification email address and preferred IST cron time.
- (Optional, later) correct per-section durations from a logged-in Udemy session.

---

*Schedule generated 2026-06-15 against the reconciled curriculum (71.3h total / 68.2h core). Constants are centralized and tunable; changing pace/multiplier/start regenerates all milestones.*
