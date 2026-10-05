import { TIME_ZONE } from '@/lib/config';
import { addDays, diffDays, studyDaysBetween, todayInTZ } from '@/lib/date';
import { fmtDate, fmtDur, fmtWhen, plural, sectionTag } from '@/lib/format';
import { MOOD_LABELS, isPlayerMood, type CoachMessage, type JourneyFeed, type JourneyStatus, type PlanRow, type StudentUpdate } from '@/lib/player';
import { buildMilestones, coreSections, finishedSectionIds, type ScheduleConfig, type Section } from '@/lib/schedule';
import type { Overview } from '@/lib/overview';

// What the v2 pages (/m hers, /r his) print — pure, over the data layer's shapes, so the words are
// tested once (tests/journey-view.test.ts) and both pages agree.
// MIRRORS of the Course Player (change both apps together, or she reads one thing on her Mac and
// another on her phone): paceLabel + weekView = course-player web/src/lib/week.ts;
// unreadFromRahul / replyContext / snippet = web/src/lib/feed.ts.

const days = (n: number) => plural(Math.abs(n), 'day');

/** The pace pill AND the Due stat's word: "Ahead by 2 days" / "On track" (good) · "Behind by 3 days" (quiet —
 *  never alarm red). Read from the study days alone, so it can never print a bare "Behind"/"Ahead": the
 *  server's pace and daysDelta now come from ONE model (lib/status.ts planPace), but a status from before
 *  that fix paired "behind" with 0 days — the loudest line on both pages, contradicting the plan list. */
export function paceLabel(s: Pick<JourneyStatus, 'daysDelta'>): { label: string; tone: 'good' | 'quiet' } {
  if (s.daysDelta > 0) return { label: `Ahead by ${days(s.daysDelta)}`, tone: 'good' };
  if (s.daysDelta < 0) return { label: `Behind by ${days(s.daysDelta)}`, tone: 'quiet' };
  return { label: 'On track', tone: 'good' };
}

export const goalText = (g: { sectionNumber: number; title: string }) => `Finish ${sectionTag(g.sectionNumber)} ${g.title}`;

export interface WeekView {
  /** "Week 3 of 10" */
  week: string;
  /** the plan's first day while it has not started ("Mon 5 Oct"); pace is null then */
  startsOn: string | null;
  goal: { text: string; due: string } | null;
  /** null on a break and before the start */
  pace: { label: string; tone: 'good' | 'quiet' } | null;
  onBreak: { label: string; back: string } | null;
  /** a break starting within 14 days (planBreakFor's lookahead) */
  upcomingBreak: string | null;
  // No course due date: the Due stat shows it (and /r's plan list) — This week printed it twice
  // (Rahul, 2026-10-01). Mirror: course-player web/src/lib/week.ts describeWeek.
}

/** "This week" — hers on /m, the header line on /r. */
export function weekView(o: Pick<Overview, 'status' | 'today' | 'config'>): WeekView {
  const { status: s, today } = o;
  const brk = s.planBreak;
  const active = brk !== null && brk.start <= today && today <= brk.end ? brk : null;
  const notStarted = today < o.config.startDate;
  return {
    week: `Week ${s.week} of ${s.totalWeeks}`,
    startsOn: notStarted ? fmtDate(o.config.startDate) : null,
    goal: s.goal ? { text: goalText(s.goal), due: fmtDate(s.goal.due) } : null,
    pace: active || notStarted ? null : paceLabel(s),
    // back on = the day after the break (Diwali ends Sun 15 Nov → Mon 16 Nov), like the player
    onBreak: active ? { label: active.label, back: fmtDate(addDays(active.end, 1)) } : null,
    upcomingBreak: brk !== null && brk.start > today ? `${brk.label} from ${fmtDate(brk.start)} to ${fmtDate(brk.end)}` : null,
  };
}

// The row type is part of the player contract (JourneyStatus.plan) — it lives in lib/player.ts.
export type { PlanRow };

/** The coach's plan list AND her plan in the player (GET /api/player/status `plan`): every plan week's
 *  goal with its status, each break placed where it falls. "Done" = every counted section up to the
 *  goal's is finished (sectionsFinishedBy, via finishedSectionIds) — the same rule as JourneyStatus.goal,
 *  so the two never disagree. Changing a row = changing the player contract: course-player
 *  shared/types.ts PlanRow mirrors lib/player.ts PlanRow. */
export function planRows(o: Pick<Overview, 'sections' | 'logs' | 'config' | 'status' | 'today'>): PlanRow[] {
  const { sections, logs, config, status, today } = o;
  const done = finishedSectionIds(logs);
  const core = coreSections(sections);
  const byId = new Map(sections.map((s) => [s.id, s]));
  const doneThrough = (s: Section) => core.filter((c) => c.sortOrder <= s.sortOrder).every((c) => done.has(c.id));

  const rows: PlanRow[] = [];
  const placed = new Set<string>();
  let prevThrough: number | null = null;
  for (const m of buildMilestones(sections, config)) {
    const through = byId.get(m.throughSectionId);
    if (!through) continue;
    // a break sits before the first week that ends after it (Diwali: between weeks 4 and 5)
    for (const b of config.breaks) {
      if (b.end >= config.startDate && b.end < m.dueDate && !placed.has(b.start)) {
        placed.add(b.start);
        rows.push({ kind: 'break', label: b.label, start: b.start, end: b.end, now: b.start <= today && today <= b.end });
      }
    }
    // A section longer than a week (React §29 = 7.9 h) leaves the next week's milestone on the SAME
    // section: that week is about the next one — "Keep going", and never "behind" mid-section.
    const repeat = m.throughSectionId === prevThrough;
    const next = repeat ? core.find((c) => c.sortOrder > through.sortOrder) : undefined;
    const target = next ?? through;
    const met = doneThrough(target);
    const state: Extract<PlanRow, { kind: 'week' }>['state'] = met ? 'done'
      : m.dueDate < today ? (next ? 'past' : 'behind')
        : m.week === status.week ? 'current' : 'upcoming';
    rows.push({ kind: 'week', week: m.week, due: m.dueDate, goal: next ? `Keep going: ${sectionTag(next.sortOrder)} ${next.title}` : goalText({ sectionNumber: through.sortOrder, title: through.title }), state });
    prevThrough = m.throughSectionId;
  }
  return rows;
}

/** Study days without an update (today included) from which the coach page nudges him. */
export const QUIET_STUDY_DAYS = 2;

/** The line under the coach's "Unread" when nothing is unread. Not "You're all caught up": with nothing
 *  unread because she has gone SILENT, that card topped his page exactly when his job is to bring her
 *  back (spec: "If she falls off track, he brings her back"). Silence = study days since her last update,
 *  today included — weekends and plan breaks are not study days, so Diwali never reads as silence. */
export function caughtUp(args: {
  /** her newest update (by when it arrived); null = none yet */
  last: Pick<StudentUpdate, 'studyDate' | 'createdAt'> | null;
  today: string;
  config: Pick<ScheduleConfig, 'startDate' | 'breaks'>;
}): { nudge: boolean; text: string } {
  const { last, today, config } = args;
  // (from, today] in study days
  const since = (from: string) => studyDaysBetween(addDays(from, 1), addDays(today, 1), config.breaks);
  if (last === null) {
    if (today < config.startDate || since(addDays(config.startDate, -1)) < QUIET_STUDY_DAYS) {
      return { nudge: false, text: 'Her updates land here when she signs off.' };
    }
    return { nudge: true, text: `No update yet — the plan started ${fmtDate(config.startDate)}` };
  }
  const quiet = since(last.studyDate);
  return quiet >= QUIET_STUDY_DAYS
    ? { nudge: true, text: `No update for ${plural(quiet, 'study day')} — last ${fmtDate(last.studyDate)}` }
    : { nudge: false, text: `Nothing unread · her last update ${updateWhen(last, today)}` };
}

export interface FromRahulItem {
  message: CoachMessage;
  /** the update this reply answers; null for a standalone note */
  replyTo: StudentUpdate | null;
}

/** Every reply/note she has not seen, newest first. Notes and `unreadReplies` ride on the feed's FIRST
 *  page only. Read the replies from `unreadReplies` too: the page alone misses a reply to an update
 *  older than it (Rahul replies from his history) — never shown, never marked read, counted forever. */
export function unreadFromRahul(feed: JourneyFeed): FromRahulItem[] {
  const items: FromRahulItem[] = feed.notes.filter((m) => m.readAt === null).map((message) => ({ message, replyTo: null }));
  const seen = new Set<string>();
  for (const u of [...feed.updates, ...(feed.unreadReplies ?? [])]) {
    for (const r of u.replies) {
      if (r.readAt !== null || seen.has(r.id)) continue;
      seen.add(r.id);
      items.push({ message: r, replyTo: u });
    }
  }
  return items.sort((a, b) => Date.parse(b.message.createdAt) - Date.parse(a.message.createdAt));
}

export type HistoryItem<U extends StudentUpdate = StudentUpdate> = { kind: 'update'; update: U } | { kind: 'note'; note: CoachMessage };

/** "Your updates" with Rahul's standalone notes interleaved by time, newest first. Her page marks a note
 *  read as soon as "From Rahul" shows it, and read notes rendered nowhere — one visit (the email link)
 *  and a note was gone from both her apps. `complete` = these updates reach her oldest one (no older
 *  page): then the notes older than all of them belong at the end too; otherwise only notes newer than
 *  the oldest update shown (an older note sits among older updates). Notes come on the feed's first
 *  page only, so a note older than that page's oldest update is not listed (≤ 10 recent notes).
 *  `before` (an older page: its cursor's createdAt = the previous page's oldest update) keeps the notes
 *  of NEWER pages off this one — the JS history passes every note of the era to every page; without it a
 *  note showed on its own page and again on every older one. */
export function withNotes<U extends StudentUpdate>(updates: U[], notes: CoachMessage[], complete: boolean, before: string | null = null): HistoryItem<U>[] {
  const oldest = updates.length ? Date.parse(updates[updates.length - 1].createdAt) : null;
  // Date.parse, not string order: a cursor carries Postgres's microseconds ("…00.000000Z" sorts before "…00.000Z")
  const until = before === null ? null : Date.parse(before);
  const shown = notes.filter((n) => {
    const t = Date.parse(n.createdAt);
    return (complete || (oldest !== null && t >= oldest)) && (until === null || t < until);
  });
  const items: HistoryItem<U>[] = [
    ...updates.map((update): HistoryItem<U> => ({ kind: 'update', update })),
    ...shown.map((note): HistoryItem<U> => ({ kind: 'note', note })),
  ];
  const at = (i: HistoryItem<U>) => Date.parse(i.kind === 'update' ? i.update.createdAt : i.note.createdAt);
  return items.sort((a, b) => at(b) - at(a));
}

/** A finished course's record, under its history page's title (both pages, ?course=js):
 *  "Finished · Mon 22 Jun → Sat 26 Sep · 163h 5m over 68 study days · 74 updates". */
export function courseHistoryLine(s: { minutes: number; sessions: number; studyDays: number; firstDate: string | null; lastDate: string | null }): string {
  const span = s.firstDate && s.lastDate ? ` · ${fmtDate(s.firstDate)} → ${fmtDate(s.lastDate)}` : '';
  return `Finished${span} · ${fmtDur(s.minutes)} over ${plural(s.studyDays, 'study day')} · ${plural(s.sessions, 'update')}`;
}

const SNIPPET_MAX = 60;

/** One line, ≤ 60 characters, cut at a word boundary. */
export function snippet(text: string, max = SNIPPET_MAX): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, '')}…`;
}

/** "On your Tue update" + her note as a short quote (null when the update had no note). */
export function replyContext(update: Pick<StudentUpdate, 'studyDate' | 'note'>, today: string): { lead: string; quote: string | null } {
  const ago = diffDays(update.studyDate, today);
  const lead = ago <= 0 ? 'On today’s update'
    : ago === 1 ? 'On yesterday’s update'
      : ago < 7 ? `On your ${fmtDate(update.studyDate).slice(0, 3)} update`
        : `On your ${fmtDate(update.studyDate)} update`;
  return { lead, quote: update.note === null || update.note.trim() === '' ? null : snippet(update.note) };
}

/** "1h 15m · §10 Thinking in React… · 3 lectures"; minutes 0 = a note-only update. */
export function updateFacts(u: Pick<StudentUpdate, 'minutes' | 'sectionNumber' | 'sectionTitle' | 'lectures'>): string[] {
  const facts = [u.minutes > 0 ? fmtDur(u.minutes) : 'Note only'];
  if (u.sectionNumber !== null) facts.push(`${sectionTag(u.sectionNumber)}${u.sectionTitle ? ` ${u.sectionTitle}` : ''}`);
  if (u.lectures.length > 0) facts.push(plural(u.lectures.length, 'lecture'));
  return facts;
}

/** Great / Good / Okay / Tough; null for anything else (old rows may carry the v1 web moods 🚀😊😮‍💨). */
export function moodLabel(mood: string): string | null {
  return isPlayerMood(mood) ? MOOD_LABELS[mood] : null;
}

/** An update's title: its STUDY day, with the time when she sent it that same day ("Today 18:55");
 *  a session sent later (auto-closed overnight) reads as the day she studied ("Mon 19 Oct"). */
export function updateWhen(u: Pick<StudentUpdate, 'studyDate' | 'createdAt'>, today: string): string {
  return todayInTZ(TIME_ZONE, new Date(u.createdAt)) === u.studyDate ? fmtWhen(u.createdAt, today) : fmtDate(u.studyDate);
}

const IST_HOUR = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: TIME_ZONE });

/** Her page's hello, by the hour in India. */
export function greeting(now: Date): string {
  const h = Number(IST_HOUR.format(now));
  if (h < 5) return 'Hi';
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
