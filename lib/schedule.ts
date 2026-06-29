import { addDays, addStudyDays, diffDays, fridayOfWeek, isWeekend, weekdaysBetween } from '@/lib/date';

export type SectionKind = 'core' | 'bonus' | 'skip';
export interface Section { id: number; title: string; videoMinutes: number; kind: SectionKind; sortOrder: number; }
export interface LogEntry {
  id: string; studyDate: string; minutes: number; sectionId: number | null;
  finishedSection: boolean; note?: string | null; mood?: string | null; createdAt?: string;
}
export type PaceLabel = 'ahead' | 'on_track' | 'behind';
export interface ScheduleConfig {
  startDate: string; dailyHours: number; studyDaysPerWeek: number;
  multiplier: number; graceWeeks: number; timeZone: string;
}
export interface WeeklyMilestone {
  week: number; fridayDate: string; cumulativeContentMinutes: number;
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
    out.push({ week: w, fridayDate: fridayOfWeek(config.startDate, w), cumulativeContentMinutes: target, throughSectionId: through.id, throughSectionTitle: through.title });
  }
  return out;
}
export function finishedSectionIds(logs: LogEntry[]): Set<number> {
  const ids = new Set<number>();
  for (const l of logs) if (l.finishedSection && l.sectionId != null) ids.add(l.sectionId);
  return ids;
}
export function currentSection(sections: Section[], logs: LogEntry[]): Section | null {
  const done = finishedSectionIds(logs);
  return coreSections(sections).find((s) => !done.has(s.id)) ?? null;
}
export function studyWeeksElapsed(today: string, config: ScheduleConfig): number {
  const days = diffDays(config.startDate, today);
  if (days < 0) return 0;
  return Math.floor(days / 7);
}
function contentDoneMinutes(sections: Section[], logs: LogEntry[]): number {
  const done = finishedSectionIds(logs);
  return coreSections(sections).filter((s) => done.has(s.id)).reduce((sum, s) => sum + s.videoMinutes, 0);
}
export function computePace(args: { today: string; sections: Section[]; logs: LogEntry[]; config: ScheduleConfig }): PaceResult {
  const { today, sections, logs, config } = args;
  const perWeek = contentMinutesPerWeek(config);
  const total = coreContentMinutes(sections);
  const weeksElapsed = studyWeeksElapsed(today, config);
  // Prorate the expectation by completed weekdays so "expected by today" grows daily
  // (instead of jumping only on Fridays) and reads sensibly within a week.
  const studyDaysElapsed = weekdaysBetween(config.startDate, today);
  const notStarted = diffDays(config.startDate, today) < 0;
  const idealContentMinutes = Math.min(total, Math.round((perWeek / config.studyDaysPerWeek) * studyDaysElapsed));
  const contentMinutesDone = contentDoneMinutes(sections, logs);
  const effortMinutes = logs.reduce((s, l) => s + l.minutes, 0);
  const effortBudgetMinutes = Math.round(total * config.multiplier);
  const gapMinutes = contentMinutesDone - idealContentMinutes;
  const halfWeek = perWeek / 2; // tolerance band (±2.5h)
  const status: PaceLabel = gapMinutes >= halfWeek ? 'ahead' : gapMinutes <= -halfWeek ? 'behind' : 'on_track';
  const daysOffPace = Math.round((gapMinutes / perWeek) * config.studyDaysPerWeek);
  const idealEffortMinutes = Math.round(idealContentMinutes * config.multiplier);

  // projected finish from the TRAILING 14-day content rate; fall back to the plan rate when there's no recent data
  const windowDays = 14;
  const windowStart = addDays(today, -(windowDays - 1));
  const minutesById = new Map(coreSections(sections).map((s) => [s.id, s.videoMinutes]));
  let windowContent = 0;
  for (const l of logs) {
    if (l.finishedSection && l.sectionId != null && l.studyDate >= windowStart && l.studyDate <= today) {
      windowContent += minutesById.get(l.sectionId) ?? 0; // ISO strings compare lexically for YYYY-MM-DD
    }
  }
  // Project in CALENDAR days. Trust the trailing-window rate only once there's enough data
  // (>= 2 weeks elapsed AND content cleared recently); otherwise fall back to the plan rate.
  // (Avoids a tiny early sample like "24 min in 14 days" projecting years into the future.)
  const planRatePerDay = perWeek / 7; // content minutes per calendar day at plan pace
  const enoughRecentData = weeksElapsed >= 2 && windowContent > 0;
  const ratePerDay = enoughRecentData ? windowContent / windowDays : planRatePerDay;
  const remaining = Math.max(0, total - contentMinutesDone);
  let projectedFinishDate: string | null = null;
  if (remaining === 0) projectedFinishDate = today;
  else if (ratePerDay > 0) projectedFinishDate = addDays(today, Math.ceil(remaining / ratePerDay));

  return {
    status, contentMinutesDone, contentMinutesTotal: total,
    contentPct: total ? Math.round((contentMinutesDone / total) * 100) : 0,
    idealContentMinutes, idealEffortMinutes, gapMinutes, daysOffPace, effortMinutes, effortBudgetMinutes,
    projectedFinishDate, weeksElapsed, studyDaysElapsed, notStarted,
  };
}
export function streak(logs: LogEntry[], today: string, config: ScheduleConfig): number {
  void config; // weekends are skipped via isWeekend; config kept for signature stability
  const days = new Set(logs.map((l) => l.studyDate));
  let count = 0;
  let cursor = today;
  for (let i = 0; i < 400; i++) {
    if (isWeekend(cursor)) { cursor = addDays(cursor, -1); continue; }
    if (days.has(cursor)) { count++; cursor = addDays(cursor, -1); }
    else break;
  }
  return count;
}

// --- monthly phases (the spec's "monthly goals") ---
export interface Phase { n: number; name: string; weekStart: number; weekEnd: number; }
export const PHASES: Phase[] = [
  { n: 1, name: 'Foundations', weekStart: 1, weekEnd: 3 },
  { n: 2, name: 'Core JS', weekStart: 4, weekEnd: 6 },
  { n: 3, name: 'Real apps & data', weekStart: 7, weekEnd: 10 },
  { n: 4, name: 'Modern JS & capstone', weekStart: 11, weekEnd: 14 },
];
export function currentWeek(today: string, config: ScheduleConfig): number {
  const days = diffDays(config.startDate, today);
  if (days < 0) return 0;
  return Math.floor(days / 7) + 1;
}
export function phaseForWeek(week: number): Phase | null {
  return PHASES.find((p) => week >= p.weekStart && week <= p.weekEnd) ?? null;
}
export function sectionEffortMinutes(logs: LogEntry[], sectionId: number): number {
  return logs.filter((l) => l.sectionId === sectionId).reduce((sum, l) => sum + l.minutes, 0);
}

export type SectionStatus = 'done' | 'in_progress' | 'overdue' | 'upcoming';

export interface CurriculumRow {
  section: Section;
  status: SectionStatus;
  minutesLogged: number;
  targetFriday: string | null;
}

export interface DynamicSchedule {
  anchorDate: string;
  currentSection: Section | null;
  currentDueDate: string | null;
  isCurrentOverdue: boolean;
  projectedFinishDate: string;
  originalTargetDate: string;
  daysDelta: number;
  perSectionDue: Record<number, string>;
}

// Dynamic, progress-anchored schedule: deadlines counted forward (in study-days)
// from the date she finished her last section, crediting time banked early — and
// re-anchored to today (honest "behind") once a section's deadline has passed.
export function buildDynamicSchedule(
  sections: Section[],
  logs: LogEntry[],
  config: ScheduleConfig,
  today: string,
): DynamicSchedule {
  const core = coreSections(sections);
  const done = finishedSectionIds(logs);
  const perStudyDay = contentMinutesPerWeek(config) / config.studyDaysPerWeek;
  const originalTargetDate = fridayOfWeek(config.startDate, totalWeeks(sections, config));

  const finishedDates = logs
    .filter((l) => l.finishedSection && l.sectionId != null)
    .map((l) => l.studyDate);
  const anchorDate = finishedDates.length
    ? finishedDates.reduce((a, b) => (a > b ? a : b))
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

  const currentDueAtAnchor = addStudyDays(anchorDate, Math.ceil(current.videoMinutes / perStudyDay));
  const isCurrentOverdue = today > currentDueAtAnchor;
  const projAnchor = isCurrentOverdue ? today : anchorDate;

  const perSectionDue: Record<number, string> = {};
  let cum = 0;
  for (const s of remaining) {
    cum += s.videoMinutes;
    perSectionDue[s.id] = addStudyDays(projAnchor, Math.ceil(cum / perStudyDay));
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

// Maps every section to a display row: how much has been logged against it, its
// status, and (for core sections) the Friday it should be finished by. Bonus/skip
// sections don't gate the schedule, so they carry no target and never go overdue.
export function buildCurriculumRows(
  sections: Section[],
  logs: LogEntry[],
  milestones: WeeklyMilestone[],
  today: string,
): CurriculumRow[] {
  const done = finishedSectionIds(logs);
  const currentId = currentSection(sections, logs)?.id ?? null;
  const ordered = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);

  return ordered.map((section) => {
    const minutesLogged = sectionEffortMinutes(logs, section.id);

    // A core section inherits the Friday of the earliest milestone whose
    // throughSectionId reaches it. Bonus/skip sections don't gate → null.
    let targetFriday: string | null = null;
    if (section.kind === 'core') {
      const m = milestones.find((mi) => mi.throughSectionId >= section.id);
      targetFriday = m?.fridayDate ?? null;
    }

    let status: SectionStatus;
    if (done.has(section.id)) status = 'done';
    else if (section.id === currentId) status = 'in_progress';
    else if (targetFriday && targetFriday < today) status = 'overdue';
    else status = 'upcoming';

    return { section, status, minutesLogged, targetFriday };
  });
}
