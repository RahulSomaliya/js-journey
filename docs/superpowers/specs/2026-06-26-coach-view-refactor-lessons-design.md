# Coach View Refactor + Full Curriculum Lessons — Design Spec

**Status:** Approved (design locked 2026-06-26)
**Author:** Rahul (with Claude)
**Topic:** UI/UX refactor of the coach read-only view (`/r/[token]`) and a new collapsible full-curriculum "lessons" view, desktop-only.

---

## 1. Purpose & goals

Two jobs, one screen:

1. **Refactor the coach view** (`app/r/[token]/page.tsx` + `components/coach/*`) from a single narrow 768px column of eight near-identical cards into a hierarchy-driven, horizontally-grouped **desktop dashboard** (~1120px). North star: the *Refactoring UI* principles — clear visual hierarchy, systematic constraints, restraint.
2. **Add a Full Curriculum view:** all 21 course sections as an accordion, **collapsed by default**, where expanding a section reveals Jonas's **real individual lecture titles** as a read-only outline.

**This is the coach (honest) surface, not Mansi's (warm) surface.** Only `/r/[token]` is in scope.

## 2. Constraints & non-goals

- **Desktop-only.** No mobile responsiveness. Every `md:` / responsive breakpoint in the coach components is removed; layout targets a fixed comfortable max width (~1120px).
- **Tokens only, never hardcoded colors.** Reuse the existing role-based theme in `app/globals.css` (`--surface`, `--surface-2`, `--ink`, `--ink-2`, `--muted`, `--faint`, `--accent`, `--accent-deep`, `--accent-soft`, `--hair`, `--hair-strong`, `--warn`/`--amber`, `--warn-soft`). Fraunces (`font-serif`) for display, IBM Plex (`font-sans`) for data. This satisfies both Rahul's standing global-colors rule and Refactoring UI's color-by-role model.
- **No DB / schema changes.** Progress stays section-level. No per-lesson done-state.
- **Out of scope:** student `/m/[token]` view, per-lesson progress tracking, mobile.

## 3. Information architecture (new layout)

Top-to-bottom zones, each full-width but content-sized inside a centered ~1120px container. Hierarchy is built first in grayscale (weight + color + position), color added last.

| Zone | Content | Layout | Hierarchy role |
|------|---------|--------|----------------|
| Top bar | Identity label + theme toggle | inline, quiet | tertiary |
| **1. Status hero** | Pace verdict headline ("Behind by 3h 36m") + sub-line + the 3 "on track?" metrics (Content done · Projected finish · Deadline countdown). Stuck-flag alert banner directly beneath when present. | headline left, key metrics right | **primary** |
| **2. Right now** | *This Week* focus card + *Study Days* heatmap. The remaining 3 lower-priority pace stats (Expected today · Effort · Course target) render as a quiet inline strip. | 2-col | secondary |
| **3. Full Curriculum** | The accordion (new feature, §4). | full width | **primary (new centerpiece)** |
| **4. Activity** | Recent logs feed + Send-Mansi-a-note form. | 2-col | secondary |

**The bottom Schedule Table is removed.** Its per-week "by Friday / through / state" information is folded into each curriculum section row (§4), eliminating a redundant component.

## 4. Full Curriculum view (new feature)

### Component shape
- New **client** component `components/coach/curriculum.tsx` — owns only the open/closed UI state.
- The page (server component) computes per-section status + logged minutes once and passes plain serializable data + the static lessons map down. No data round-trips on expand.

### Collapsed section row
Each of the 21 sections renders a row showing:
- Section number chip (`S2`), title (weight 600).
- `core` / `bonus` / `skip` kind tag (shown for non-core; `skip` visually muted).
- **State badge** — `done ✓` / `in progress` / `overdue` / `upcoming`, conveyed by **color *and* icon/text**, never color alone (`--accent` done, `--accent-deep` in-progress, `--warn` overdue, `--faint` upcoming).
- Video length (e.g. "5h 0m"), formatted via existing `lib/format.ts` humanizer.
- Slim progress bar: minutes logged for that section vs `videoMinutes`.
- Folded-in "by Friday" target date (from the milestone model) where the section is a weekly target.
- A chevron affordance with a real hover state.

### Behavior
- **All sections collapsed by default** (per spec).
- The **current in-progress section** gets a subtle `--accent` left-border highlight so it's findable without expanding. (Decision: highlight-only, not auto-expand, to honor "collapsed by default.")
- Header: overall summary ("X / 21 sections done · Ym of Yh watched") + **Expand all / Collapse all** control.

### Expanded section
- Indented, quiet, read-only outline of Jonas's real lecture titles for that section, with per-lecture duration if Udemy exposes it.
- Long sections scroll naturally within the page; no inner scroll trap.

### Empty / edge states
- Section with no lessons data yet → a quiet "Lessons coming soon" placeholder (not a broken empty box).
- `skip`-kind section (HTML/CSS crash course) → still listed, visibly de-emphasized, labeled skipped.

## 5. Data plan

- New `lib/lessons.ts`:
  ```ts
  export type Lesson = { title: string; minutes?: number };
  export const LESSONS: Record<number, Lesson[]>; // keyed by Section.id
  ```
  Populated by fetching the public curriculum of *The Complete JavaScript Course: From Zero to Expert!* (Jonas Schmedtmann, 2025 ES2024/ES2025 edition, 332 lectures / 21 sections) via Chrome browser automation. Rahul spot-checks a couple of sections for fidelity.
- One helper in `lib/schedule.ts`: aggregate logged minutes per section id (`minutesBySectionId(logs)`), reused by the curriculum progress bars. Reuse existing `finishedSectionIds`, `currentSection`, `phaseForWeek`, milestone builders for status.
- **No schema or DB writes.**

## 6. Visual refactor — Refactoring UI principles applied

- **Hierarchy via weight + color, not size.** 3 text tiers (`ink` / `muted` / `faint`); the hero pace number dominates; labels are `faint`, uppercase, tracked.
- **Vary elevation/emphasis.** Hero prominent; secondary/rail cards quieter (fewer borders, less shadow) to kill the "eight identical `rounded-2xl` cards" monotony.
- **Spacing system, generously.** 4px ladder; unambiguous grouping (more space between groups than within).
- **Typography discipline.** Fraunces for display with tight tracking + ~110–120% line-height on large text; Plex for data; dashboard type scale capped.
- **Color last, semantic.** `--accent` (teal) for positive/primary, `--warn` (amber) for behind/overdue; never color alone (pair with ✓ / icon / text).
- **Dark-mode depth = lightness** (`surface` vs `surface-2`), not heavy shadow.
- **Every interaction responds.** Accordion rows, buttons, and the note form get hover/focus/active; the note form gets loading + success feedback.
- **Finishing touches.** Accent left-border on current section, proper empty states, supercharged default controls.

## 7. Files touched (anticipated)

- `app/r/[token]/page.tsx` — re-zone layout, compute per-section data, drop schedule table.
- `components/coach/curriculum.tsx` — **new** client accordion.
- `components/coach/status-headline.tsx`, `pace-card.tsx`, `this-week.tsx`, `heatmap.tsx`, `logs-feed.tsx`, `send-note-form.tsx`, `stuck-list.tsx` — restyle for new zones / hierarchy; remove `md:` breakpoints.
- `components/coach/schedule-table.tsx` — **removed** (logic folded into curriculum).
- `lib/lessons.ts` — **new** static lecture data.
- `lib/schedule.ts` — add `minutesBySectionId` helper.
- `app/globals.css` — additive only if a new token/utility is genuinely needed; prefer reuse.

## 8. Verification

- `pnpm build` must pass (no `--no-verify`, fix root causes).
- Live verification in Chrome (Claude-in-Chrome MCP) against the deployed/local coach view: hierarchy reads at a glance, accordion expands/collapses, current section highlighted, lessons render, dark + light themes both clean, no horizontal overflow at the target width.

## 9. Open decisions resolved (judgment calls, approved)

1. Schedule table **folded into** curriculum rows (removed as a standalone).
2. Current section **highlighted, not auto-expanded** (all collapsed by default).
3. Treated as a **real structural refactor** (re-zoned layout), not a recolor.
