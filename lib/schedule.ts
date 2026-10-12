import { addDays, addOpenDays, addStudyDays, diffDays, inBreak, isStudyDay, studyDaysBetween, type DayRange } from '@/lib/date';
import type { CourseId } from '@/lib/course-ids';

export type SectionKind = 'core' | 'bonus' | 'skip';
export interface Section { id: number; title: string; videoMinutes: number; kind: SectionKind; sortOrder: number; }
export type LogSource = 'manual' | 'player';
/** one lecture the Course Player saw her complete (JourneySession.lecturesCompleted) */
export interface LectureDone { section: number; lecture: number; title: string; }
export interface LogEntry {
  id: string; studyDate: string; minutes: number; sectionId: number | null;
  finishedSection: boolean; note?: string | null; mood?: string | null; createdAt?: string;
  /** other sections that became 100% done during this session (player rows only).
   *  A player session is ONE row keyed on its main section, but she often finishes the
   *  previous section mid-session — every "is it finished?" read must go through
   *  sectionsFinishedBy(), never `finishedSection && sectionId` alone. */
  alsoFinishedIds?: number[] | null;
  source?: LogSource;
  lecturesCompleted?: LectureDone[] | null;
  startedAt?: string | null; endedAt?: string | null;
}
/** a row to append to log_entries — manual check-in or Course Player session */
export interface NewLog {
  course: CourseId; studyDate: string; sectionId: number | null; minutes: number;
  note: string | null; mood: string | null; finishedSection: boolean;
  alsoFinishedIds: number[]; lecturesCompleted: LectureDone[] | null;
  source: LogSource;
  /** JourneySession.id for player rows (unique — the dedup key); null for manual rows */
  externalId: string | null;
  startedAt: string | null; endedAt: string | null;
  /** she ticked "I'm stuck" on this update — the coach email and view flag it */
  stuck: boolean;
  /** the player closed the session without her (never true for manual rows) */
  autoClosed: boolean;
}
export type PaceLabel = 'ahead' | 'on_track' | 'behind';
/** Days off the plan (Diwali…), inclusive "YYYY-MM-DD" — the shape the Course Player
 *  gets as JourneyStatus.planBreak. No study day falls inside one: the target, the
 *  deadline, weekly goals, section due dates, pace and the daily nudge all skip it. */
export interface PlanBreak extends DayRange { label: string; }
export interface ScheduleConfig {
  startDate: string; dailyHours: number; studyDaysPerWeek: number;
  multiplier: number; graceWeeks: number; timeZone: string;
  /** plan data, not a deadline hack — every study-day count goes through these */
  breaks: readonly PlanBreak[];
}
export interface WeeklyMilestone {
  /** dueDate = the plan's last study day of that week: a Friday, unless a break ends the week early */
  week: number; dueDate: string; cumulativeContentMinutes: number;
  throughSectionId: number; throughSectionTitle: string;
}
export interface PaceResult {
  status: PaceLabel; contentMinutesDone: number; contentMinutesTotal: number; contentPct: number;
  idealContentMinutes: number; idealEffortMinutes: number; gapMinutes: number; daysOffPace: number;
  effortMinutes: number; effortBudgetMinutes: number;
  projectedFinishDate: string | null; weeksElapsed: number;
  studyDaysElapsed: number; notStarted: boolean;
}

export function coreSections(sections: Section[]): Section[] {
  return sections.filter((s) => s.kind === 'core').sort((a, b) => a.sortOrder - b.sortOrder);
}
export function coreContentMinutes(sections: Section[]): number {
  return coreSections(sections).reduce((sum, s) => sum + s.videoMinutes, 0);
}
export function contentMinutesPerWeek(config: ScheduleConfig): number {
  return Math.round((config.dailyHours * config.studyDaysPerWeek / config.multiplier) * 60);
}
export function totalWeeks(sections: Section[], config: ScheduleConfig): number {
  return Math.ceil(coreContentMinutes(sections) / contentMinutesPerWeek(config));
}
// The plan's n-th study day (1-based) counted from the start date — breaks skipped.
// Week w of the plan ends on study day w × studyDaysPerWeek (a Friday when no break cuts the week).
function nthStudyDay(config: ScheduleConfig, n: number): string {
  return addStudyDays(addDays(config.startDate, -1), n, config.breaks);
}
// The fixed plan: `weeks` are STUDY weeks. Core-complete target = the last study day of
// the last week; the deadline adds the grace weeks in study days, so a break pushes both.
export function planTimeline(sections: Section[], config: ScheduleConfig): { weeks: number; target: string; deadline: string } {
  const weeks = totalWeeks(sections, config);
  const target = nthStudyDay(config, weeks * config.studyDaysPerWeek);
  return {
    weeks,
    target,
    deadline: addStudyDays(target, config.graceWeeks * config.studyDaysPerWeek, config.breaks),
  };
}
/** the Mon–Fri days a break takes out of the plan */
export function breakStudyDays(b: DayRange): number {
  return studyDaysBetween(b.start, addDays(b.end, 1), []);
}
export function buildMilestones(sections: Section[], config: ScheduleConfig): WeeklyMilestone[] {
  const core = coreSections(sections);
  const total = coreContentMinutes(sections);
  const perWeek = contentMinutesPerWeek(config);
  const weeks = totalWeeks(sections, config);
  const cum: { id: number; title: string; cumEnd: number }[] = [];
  let running = 0;
  for (const s of core) { running += s.videoMinutes; cum.push({ id: s.id, title: s.title, cumEnd: running }); }
  const out: WeeklyMilestone[] = [];
  for (let w = 1; w <= weeks; w++) {
    const target = Math.min(perWeek * w, total);
    let through = cum[0];
    for (const c of cum) { if (c.cumEnd <= target + 1e-6) through = c; }
    out.push({ week: w, dueDate: nthStudyDay(config, w * config.studyDaysPerWeek), cumulativeContentMinutes: target, throughSectionId: through.id, throughSectionTitle: through.title });
  }
  return out;
}
/** One plan week's stretch of the course — planRows' goal text and the coach page's week → section view
 *  (lib/outline.ts weekOutline) read the same one. `through` = the counted section its goal finishes; `after`
 *  = the section number the previous week's goal finished (0 for week 1); `continues` = for a "keep going"
 *  week whose milestone repeats the previous week's section (React 29 = 7.9 h leaves week 9 on 28 again),
 *  the next counted section — the one that week is really about. */
export interface PlanWeek { milestone: WeeklyMilestone; through: Section; after: number; continues: Section | null; }
export function planWeeks(sections: Section[], config: ScheduleConfig): PlanWeek[] {
  const core = coreSections(sections);
  const byId = new Map(sections.map((s) => [s.id, s]));
  const out: PlanWeek[] = [];
  let prev: Section | null = null;
  for (const milestone of buildMilestones(sections, config)) {
    const through = byId.get(milestone.throughSectionId);
    if (!through) continue;
    const repeat = prev !== null && prev.id === through.id;
    const continues = repeat ? core.find((c) => c.sortOrder > through.sortOrder) ?? null : null;
    out.push({ milestone, through, after: prev?.sortOrder ?? 0, continues });
    prev = through;
  }
  return out;
}
// the sections one log row marks finished: its own section (manual tick / player
// finished its main section) plus any finished mid-session (player only)
export function sectionsFinishedBy(l: LogEntry): number[] {
  const ids = l.finishedSection && l.sectionId != null ? [l.sectionId] : [];
  return l.alsoFinishedIds?.length ? [...ids, ...l.alsoFinishedIds] : ids;
}
/** Section ids the LOGS mark finished. Never the answer to "is it finished?" on its own (v4, 2026-10-12): a
 *  section she finished outside a session, or with one article left unticked, is in no log — that alone made
 *  her "Behind by 3 days" while 2 days ahead. Pages and status read doneSectionIds (logs ∪ the snapshot). */
export function finishedSectionIds(logs: LogEntry[]): Set<number> {
  const ids = new Set<number>();
  for (const l of logs) for (const id of sectionsFinishedBy(l)) ids.add(id);
  return ids;
}
/** "Finished" everywhere a page or the status reads it (plan rows, the goal, the pace's logs path, the
 *  coach page's ✓ marks): the logs (sectionsFinishedBy) ∪ her latest snapshot's `sectionsDone` (section
 *  NUMBERS, mapped to ids through `sections`). Never logs alone — see finishedSectionIds. */
export function doneSectionIds(sections: Section[], logs: LogEntry[], sectionsDone: readonly number[] | null | undefined): Set<number> {
  const ids = finishedSectionIds(logs);
  for (const n of sectionsDone ?? []) {
    const s = sections.find((x) => x.sortOrder === n);
    if (s) ids.add(s.id);
  }
  return ids;
}
// a section counts as finished on its EARLIEST finished-row date: with append-only
// sessions the same section can carry several finished flags, and later duplicates
// must not move when it "really" finished
function earliestFinishDates(logs: LogEntry[]): Map<number, string> {
  const m = new Map<number, string>();
  for (const l of logs) {
    for (const id of sectionsFinishedBy(l)) {
      const prev = m.get(id);
      if (!prev || l.studyDate < prev) m.set(id, l.studyDate);
    }
  }
  return m;
}
/** The first counted section not finished (doneSectionIds: logs ∪ the snapshot's sectionsDone). */
export function currentSection(sections: Section[], logs: LogEntry[], sectionsDone: readonly number[] | null = null): Section | null {
  const done = doneSectionIds(sections, logs, sectionsDone);
  return coreSections(sections).find((s) => !done.has(s.id)) ?? null;
}
// completed STUDY weeks before today (break days don't count)
export function studyWeeksElapsed(today: string, config: ScheduleConfig): number {
  return Math.floor(studyDaysBetween(config.startDate, today, config.breaks) / config.studyDaysPerWeek);
}
function contentDoneMinutes(sections: Section[], logs: LogEntry[], sectionsDone: readonly number[] | null): number {
  const done = doneSectionIds(sections, logs, sectionsDone);
  return coreSections(sections).filter((s) => done.has(s.id)).reduce((sum, s) => sum + s.videoMinutes, 0);
}
// NOT the pace (that is lib/status.ts planPace): only the coach email's "% of the course done" reads this.
// `sectionsDone` = her latest snapshot's (finished = logs ∪ snapshot); omitted = logs only.
export function computePace(args: {
  today: string; sections: Section[]; logs: LogEntry[]; config: ScheduleConfig; sectionsDone?: readonly number[] | null;
}): PaceResult {
  const { today, sections, logs, config } = args;
  const perWeek = contentMinutesPerWeek(config);
  const total = coreContentMinutes(sections);
  const weeksElapsed = studyWeeksElapsed(today, config);
  // Prorate the expectation by completed study days so "expected by today" grows daily
  // (instead of jumping only on Fridays) and reads sensibly within a week. Break days
  // are not study days, so the expectation stands still over Diwali — no pace lost.
  const studyDaysElapsed = studyDaysBetween(config.startDate, today, config.breaks);
  const notStarted = diffDays(config.startDate, today) < 0;
  const idealContentMinutes = Math.min(total, Math.round((perWeek / config.studyDaysPerWeek) * studyDaysElapsed));
  const contentMinutesDone = contentDoneMinutes(sections, logs, args.sectionsDone ?? null);
  const effortMinutes = logs.reduce((s, l) => s + l.minutes, 0);
  const effortBudgetMinutes = Math.round(total * config.multiplier);
  const gapMinutes = contentMinutesDone - idealContentMinutes;
  const halfWeek = perWeek / 2; // tolerance band (±2.5h)
  const status: PaceLabel = gapMinutes >= halfWeek ? 'ahead' : gapMinutes <= -halfWeek ? 'behind' : 'on_track';
  const daysOffPace = Math.round((gapMinutes / perWeek) * config.studyDaysPerWeek);
  const idealEffortMinutes = Math.round(idealContentMinutes * config.multiplier);

  // projected finish from the TRAILING 14-day content rate; fall back to the plan rate when there's no recent data.
  // Both the window and the projection count only days OUTSIDE plan breaks: a window
  // spanning Diwali would otherwise read as a fortnight of zero work after she is back.
  const windowDays = 14;
  const windowStart = trailingOpenWindowStart(today, windowDays, config.breaks);
  const minutesById = new Map(coreSections(sections).map((s) => [s.id, s.videoMinutes]));
  // a section is credited to the window only if it was GENUINELY finished inside it —
  // earliest finished row wins, so duplicate finish flags (append-only sessions) can't inflate the rate
  const finishDates = earliestFinishDates(logs);
  let windowContent = 0;
  for (const [id, d] of finishDates) {
    if (d >= windowStart && d <= today) windowContent += minutesById.get(id) ?? 0; // ISO strings compare lexically
  }
  // Project in CALENDAR days (minus break days). Trust the trailing-window rate only once there's enough data
  // (>= 2 weeks elapsed AND content cleared recently); otherwise fall back to the plan rate.
  // (Avoids a tiny early sample like "24 min in 14 days" projecting years into the future.)
  const planRatePerDay = perWeek / 7; // content minutes per calendar day at plan pace
  const enoughRecentData = weeksElapsed >= 2 && windowContent > 0;
  const ratePerDay = enoughRecentData ? windowContent / windowDays : planRatePerDay;
  const remaining = Math.max(0, total - contentMinutesDone);
  let projectedFinishDate: string | null = null;
  // finished: the date the last core section was (first) finished — "today" would keep
  // moving the finish date of a completed course
  if (remaining === 0) {
    const dates = [...finishDates].filter(([id]) => minutesById.has(id)).map(([, d]) => d); // core only
    projectedFinishDate = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : today;
  }
  else if (ratePerDay > 0) projectedFinishDate = addOpenDays(today, Math.ceil(remaining / ratePerDay), config.breaks);

  return {
    status, contentMinutesDone, contentMinutesTotal: total,
    contentPct: total ? Math.round((contentMinutesDone / total) * 100) : 0,
    idealContentMinutes, idealEffortMinutes, gapMinutes, daysOffPace, effortMinutes, effortBudgetMinutes,
    projectedFinishDate, weeksElapsed, studyDaysElapsed, notStarted,
  };
}
// the first day of the trailing window holding `n` non-break days up to and including `today`
function trailingOpenWindowStart(today: string, n: number, breaks: readonly DayRange[]): string {
  let d = today;
  let open = inBreak(d, breaks) ? 0 : 1;
  while (open < n) {
    d = addDays(d, -1);
    if (!inBreak(d, breaks)) open++;
  }
  return d;
}
// The plan's STUDY week (1-based) that today belongs to; 0 before the start. Weekends and
// break days belong to the week just studied: all of Diwali reads week 4, and week 5 starts
// the Monday she is back — so "week N of totalWeeks" never runs past totalWeeks on plan.
export function currentWeek(today: string, config: ScheduleConfig): number {
  if (diffDays(config.startDate, today) < 0) return 0;
  const studied = studyDaysBetween(config.startDate, addDays(today, 1), config.breaks); // [start, today]
  return Math.max(1, Math.ceil(studied / config.studyDaysPerWeek));
}

// The break in progress, else the next one starting within `lookaheadDays`, else null —
// JourneyStatus.planBreak: the Course Player's "This week", her /m "This week", the /r header.
export function planBreakFor(today: string, breaks: readonly PlanBreak[], lookaheadDays = 14): PlanBreak | null {
  const pick = (b: PlanBreak): PlanBreak => ({ label: b.label, start: b.start, end: b.end });
  const now = breaks.find((b) => today >= b.start && today <= b.end);
  if (now) return pick(now);
  const next = breaks
    .filter((b) => b.start > today && diffDays(today, b.start) <= lookaheadDays)
    .reduce<PlanBreak | null>((a, b) => (a === null || b.start < a.start ? b : a), null);
  return next ? pick(next) : null;
}

export type NudgeSkip = 'before-start' | 'break' | 'weekend';
// Why the daily "No log from Mansi today" email stays quiet today (null = send it if
// she hasn't logged). app/api/cron/daily/route.ts checks this BEFORE touching the DB.
export function nudgeSkipReason(today: string, config: ScheduleConfig): NudgeSkip | null {
  if (today < config.startDate) return 'before-start';
  if (inBreak(today, config.breaks)) return 'break';
  if (!isStudyDay(today, config.breaks)) return 'weekend';
  return null;
}

export interface DynamicSchedule {
  anchorDate: string;
  currentSection: Section | null;
  currentDueDate: string | null;
  isCurrentOverdue: boolean;
  projectedFinishDate: string;
  originalTargetDate: string;
  /** calendar days, projected finish vs original target (> 0 ahead) */
  daysDelta: number;
  perSectionDue: Record<number, string>;
}

// Dynamic, progress-anchored schedule: deadlines counted forward (in study-days)
// from the date she finished her last section, crediting time banked early — and
// re-anchored to today (honest "behind") once a section's deadline has passed.
// NOT the pace pill: its projection swings for a student exactly on plan (+3 on day 1, −5 in the last
// week) — the pill is lib/status.ts planPace; her projection is lib/status.ts planProjection. Since v4 no page
// reads it (Overview.currentSection follows her snapshot's "Continue", lib/overview.ts): only its tests do.
export function buildDynamicSchedule(
  sections: Section[],
  logs: LogEntry[],
  config: ScheduleConfig,
  today: string,
): DynamicSchedule {
  const core = coreSections(sections);
  const done = finishedSectionIds(logs);
  const perStudyDay = contentMinutesPerWeek(config) / config.studyDaysPerWeek;
  const originalTargetDate = planTimeline(sections, config).target;

  // per-section earliest finish, then the max across sections: duplicate finished
  // rows on later dates (stale tab, resubmit) can't drag the anchor forward
  const finishDates = earliestFinishDates(logs);
  const anchorDate = finishDates.size
    ? [...finishDates.values()].reduce((a, b) => (a > b ? a : b))
    : config.startDate;

  const remaining = core.filter((s) => !done.has(s.id));
  const current = remaining[0] ?? null;

  if (!current) {
    return {
      anchorDate,
      currentSection: null,
      currentDueDate: null,
      isCurrentOverdue: false,
      projectedFinishDate: anchorDate,
      originalTargetDate,
      daysDelta: diffDays(anchorDate, originalTargetDate),
      perSectionDue: {},
    };
  }

  // due dates are counted in study days, so they jump over a break: a section due the
  // week before Diwali is not "overdue" during it, and the projection does not drift
  const currentDueAtAnchor = addStudyDays(anchorDate, Math.ceil(current.videoMinutes / perStudyDay), config.breaks);
  const isCurrentOverdue = today > currentDueAtAnchor;
  const projAnchor = isCurrentOverdue ? today : anchorDate;

  const perSectionDue: Record<number, string> = {};
  let cum = 0;
  for (const s of remaining) {
    cum += s.videoMinutes;
    perSectionDue[s.id] = addStudyDays(projAnchor, Math.ceil(cum / perStudyDay), config.breaks);
  }

  const projectedFinishDate = perSectionDue[remaining[remaining.length - 1].id];
  return {
    anchorDate,
    currentSection: current,
    currentDueDate: perSectionDue[current.id],
    isCurrentOverdue,
    projectedFinishDate,
    originalTargetDate,
    daysDelta: diffDays(projectedFinishDate, originalTargetDate),
    perSectionDue,
  };
}
