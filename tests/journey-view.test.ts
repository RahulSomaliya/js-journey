import { describe, it, expect } from 'vitest';
import { fixtureFeed, fixtureOverview, fixtureUpdates } from '@/lib/fixtures';
import {
  caughtUp, greeting, moodLabel, paceLabel, planRows, replyContext, snippet, unreadFromRahul, updateFacts, updateWhen, weekView, withNotes, type PlanRow,
} from '@/lib/journey-view';
import { REACT_PLAN } from '@/lib/config';
import type { JourneyStatus } from '@/lib/player';

// What the two v2 pages print, as pure functions over the data layer's shapes (lib/fixtures.ts
// scenarios). "This week" and the pace pill MIRROR the Course Player (web/src/lib/week.ts), so
// she reads the same words on her phone as on her Mac.

const status = (pace: JourneyStatus['pace'], daysDelta: number) => ({ ...fixtureOverview('typical').status, pace, daysDelta });

describe('paceLabel (course-player lib/week.ts paceOf)', () => {
  it('reads the study days: ahead / on track = good, behind = quiet — never a bare "Behind" / "Ahead"', () => {
    expect(paceLabel(status('ahead', 2))).toEqual({ label: 'Ahead by 2 days', tone: 'good' });
    expect(paceLabel(status('on-track', 0))).toEqual({ label: 'On track', tone: 'good' });
    expect(paceLabel(status('behind', -1))).toEqual({ label: 'Behind by 1 day', tone: 'quiet' });
    // a JourneyStatus from before the one-model fix could pair a word with 0 days: the number wins
    expect(paceLabel(status('behind', 0))).toEqual({ label: 'On track', tone: 'good' });
    expect(paceLabel(status('ahead', 0))).toEqual({ label: 'On track', tone: 'good' });
  });
  it('the fixtures: typical (week 3, weeks 1–2 met) is On track; behind (stopped Thu 8 Oct) says by how much', () => {
    expect(paceLabel(fixtureOverview('typical').status).label).toBe('On track');
    expect(paceLabel(fixtureOverview('behind').status).label).toBe('Behind by 5 days');
  });
});

describe('weekView', () => {
  it('typical: week 3 goal, pace, the Diwali break coming up — no course due date (the Due stat shows it)', () => {
    expect(weekView(fixtureOverview('typical'))).toEqual({
      week: 'Week 3 of 10',
      startsOn: null,
      goal: { text: 'Finish §12 Effects and Data Fetching', due: 'Fri 23 Oct' },
      pace: { label: 'On track', tone: 'good' },
      onBreak: null,
      upcomingBreak: 'Diwali from Sun 1 Nov to Sun 15 Nov',
    });
  });
  it('on the break: no pace, back Mon 16 Nov', () => {
    const w = weekView(fixtureOverview('diwali'));
    expect([w.pace, w.onBreak, w.upcomingBreak]).toEqual([null, { label: 'Diwali', back: 'Mon 16 Nov' }, null]);
  });
  it('before the plan starts: "starts Mon 5 Oct" instead of a pace', () => {
    const w = weekView(fixtureOverview('empty'));
    expect([w.startsOn, w.pace, w.goal?.due]).toEqual(['Mon 5 Oct', null, 'Fri 9 Oct']);
  });
});

const brief = (rows: PlanRow[]) => rows.map((r) => (r.kind === 'week' ? `${r.week}:${r.state}` : `break:${r.now ? 'now' : 'later'}`));

describe('planRows — the weekly goals with status, and the break where it falls', () => {
  it('typical (Wed 21 Oct): weeks 1–2 done, week 3 this week, Diwali between weeks 4 and 5', () => {
    const rows = planRows(fixtureOverview('typical'));
    expect(brief(rows)).toEqual([
      '1:done', '2:done', '3:current', '4:upcoming', 'break:later', '5:upcoming', '6:upcoming', '7:upcoming', '8:upcoming', '9:upcoming', '10:upcoming',
    ]);
    const w3 = rows.find((r) => r.kind === 'week' && r.week === 3);
    expect(w3).toEqual({ kind: 'week', week: 3, due: '2026-10-23', goal: 'Finish §12 Effects and Data Fetching', state: 'current' });
    expect(rows.find((r) => r.kind === 'break')).toEqual({ kind: 'break', label: 'Diwali', start: '2026-11-01', end: '2026-11-15', now: false });
  });
  it('a week whose goal is the previous week\'s section (a long §29) says "keep going" on the next one', () => {
    const rows = planRows(fixtureOverview('typical'));
    const goal = (w: number) => rows.find((r): r is Extract<PlanRow, { kind: 'week' }> => r.kind === 'week' && r.week === w)?.goal;
    expect(goal(8)).toBe('Finish §28 Advanced React Patterns');
    expect(goal(9)).toBe('Keep going: §29 Implementing More Features - Authentication, Dark Mode, Dashboard, etc. (Optional)');
    expect(goal(10)).toBe('Finish §31 The End!');
  });
  it('behind (stopped Thu 8 Oct): a past week that is not met reads behind', () => {
    expect(brief(planRows(fixtureOverview('behind'))).slice(0, 4)).toEqual(['1:done', '2:behind', '3:current', '4:upcoming']);
  });
  it('on the break: the break row is "now", nothing is "this week"', () => {
    expect(brief(planRows(fixtureOverview('diwali'))).slice(0, 6)).toEqual(['1:done', '2:done', '3:done', '4:done', 'break:now', '5:upcoming']);
  });
  it('before the start: week 1 is this week', () => {
    expect(brief(planRows(fixtureOverview('empty'))).slice(0, 2)).toEqual(['1:current', '2:upcoming']);
  });
});

describe('From Rahul (course-player lib/feed.ts unreadFromRahul / replyContext / snippet)', () => {
  it('every unread note and reply, newest first; a reply carries the update it answers', () => {
    const items = unreadFromRahul(fixtureFeed('typical'));
    expect(items.map((i) => [i.message.body.slice(0, 12), i.replyTo?.studyDate ?? null])).toEqual([
      ['Three weeks ', null],
      ['Part 2 is wh', '2026-10-20'],
    ]);
    expect(unreadFromRahul(fixtureFeed('behind'))).toEqual([]);
  });
  it('includes replies on OLDER updates (feed.unreadReplies) — a reply to her 31st-newest update is not lost', () => {
    const feed = fixtureFeed('typical');
    const old = { ...feed.updates[feed.updates.length - 1], replies: [{ id: 'r-old', body: 'Late answer', createdAt: '2026-10-21T12:00:00.000Z', readAt: null }] };
    const items = unreadFromRahul({ ...feed, unreadReplies: [old] });
    expect(items.map((i) => i.message.id)).toContain('r-old');
    expect(items.find((i) => i.message.id === 'r-old')?.replyTo?.id).toBe(old.id);
    // an update listed in both (an older server, a stale cache) is counted once
    const twice = unreadFromRahul({ ...feed, unreadReplies: feed.updates.filter((u) => u.replies.some((r) => r.readAt === null)) });
    expect(twice).toHaveLength(unreadFromRahul(feed).length);
  });
  it('replyContext: "On yesterday’s update" + her note as a short quote', () => {
    const [, reply] = unreadFromRahul(fixtureFeed('typical'));
    expect(replyContext(reply.replyTo!, '2026-10-21')).toEqual({ lead: 'On yesterday’s update', quote: 'Split-bill form works. Part 2 starts tomorrow!' });
    expect(replyContext({ ...reply.replyTo!, studyDate: '2026-10-21' }, '2026-10-21').lead).toBe('On today’s update');
    expect(replyContext({ ...reply.replyTo!, studyDate: '2026-10-16' }, '2026-10-21').lead).toBe('On your Fri update');
    expect(replyContext({ ...reply.replyTo!, studyDate: '2026-10-05', note: '  ' }, '2026-10-21')).toEqual({ lead: 'On your Mon 5 Oct update', quote: null });
  });
  it('snippet: one line, at most 60 characters, cut at a word', () => {
    const s = snippet('useEffect cleanup finally makes sense for the timer example — but I am confused why');
    expect(s).toBe('useEffect cleanup finally makes sense for the timer example…');
    expect(s.length).toBeLessThanOrEqual(61);
    expect(snippet('short\n note')).toBe('short note');
  });
});

describe('caughtUp — the line under "Unread" when nothing is (his cue to bring her back)', () => {
  const at = (today: string, last: { studyDate: string; createdAt: string } | null) => caughtUp({ last, today, config: REACT_PLAN });
  const thu8 = { studyDate: '2026-10-08', createdAt: '2026-10-08T15:00:00.000Z' };
  it('silent for 2+ study days (today included): a nudge in ink, with the count and her last day', () => {
    // the `behind` fixture: last update Thu 8 Oct, today Wed 21 Oct — the page used to say "You're all caught up."
    expect(at('2026-10-21', thu8)).toEqual({ nudge: true, text: 'No update for 9 study days — last Thu 8 Oct' });
    expect(at('2026-10-10', thu8)).toEqual({ nudge: false, text: 'Nothing unread · her last update Thu 20:30' }); // only Fri missed
    expect(at('2026-10-13', thu8).nudge).toBe(true); // Fri + Mon + Tue
  });
  it('break days and weekends are not study days: Diwali never reads as silence', () => {
    expect(at('2026-11-13', { studyDate: '2026-10-30', createdAt: '2026-10-30T15:00:00.000Z' })).toEqual({ nudge: false, text: 'Nothing unread · her last update Fri 30 Oct' });
  });
  it('a recent update reads calm with its time; nothing ever: before the start it says what will land', () => {
    expect(at('2026-10-21', { studyDate: '2026-10-21', createdAt: '2026-10-21T13:25:00.000Z' })).toEqual({ nudge: false, text: 'Nothing unread · her last update Today 18:55' });
    expect(at('2026-10-03', null)).toEqual({ nudge: false, text: 'Her updates land here when she signs off.' });
    expect(at('2026-10-07', null)).toEqual({ nudge: true, text: 'No update yet — the plan started Mon 5 Oct' });
  });
});

describe('withNotes — Rahul\'s standalone notes stay findable in "Your updates"', () => {
  // /m marks a note read the moment it is shown; read notes used to render nowhere on /m, so after ONE
  // visit (e.g. from the email link) "Dinner is on me Friday" was gone from both her apps
  const feed = fixtureFeed('typical');
  const kinds = (items: ReturnType<typeof withNotes>) => items.map((i) => (i.kind === 'note' ? `note:${i.note.body.slice(0, 5)}` : `u:${i.update.createdAt.slice(5, 16)}`));
  it('interleaves the notes by time, newest first, within the updates shown', () => {
    expect(kinds(withNotes(feed.updates.slice(0, 3), feed.notes, false))).toEqual(['u:10-21T13:25', 'u:10-21T12:15', 'note:Three', 'u:10-20T15:40']);
  });
  it('a note older than the oldest update shown waits for the full list — unless that list is complete', () => {
    expect(kinds(withNotes(feed.updates.slice(0, 1), feed.notes, false))).toEqual(['u:10-21T13:25']);
    const all = withNotes(feed.updates, feed.notes, true);
    expect(kinds(all).at(-1)).toBe('note:React');
    expect(all.filter((i) => i.kind === 'note')).toHaveLength(2);
    expect(withNotes([], feed.notes, true).map((i) => i.kind)).toEqual(['note', 'note']);
  });
  it('an older page (`before` = the cursor: the previous page\'s oldest update) lists only the notes between — each note on ONE page', () => {
    // the JS history pages its updates with ?before= and lists every JS note among them
    const updates = feed.updates; // 14, newest first
    const page1 = updates.slice(0, 3);
    const page2 = updates.slice(3);
    const before = '2026-10-20T15:40:00.000000Z'; // page 1's oldest (Tue 20 Oct 21:10 IST), as a cursor carries it
    expect(page1.at(-1)?.createdAt).toBe('2026-10-20T15:40:00.000Z');
    const notesOn = (items: ReturnType<typeof withNotes>) => items.flatMap((i) => (i.kind === 'note' ? [i.note.body.slice(0, 5)] : []));
    expect(notesOn(withNotes(page1, feed.notes, false))).toEqual(['Three']);
    expect(notesOn(withNotes(page2, feed.notes, true, before))).toEqual(['React']); // not "Three" again
    expect(notesOn(withNotes(page2, feed.notes, true, null))).toEqual(['Three', 'React']); // without it: listed twice
  });
});

describe('updateFacts / moodLabel', () => {
  const all = fixtureUpdates('typical');
  it('time · section · lectures; a note-only update says so', () => {
    const stuck = all.find((u) => u.stuck)!;
    expect(updateFacts(stuck)).toEqual(['1h 15m', '§10 Thinking in React - Components, Composition, and Reusability', '3 lectures']);
    const noteOnly = all.find((u) => u.minutes === 0)!;
    expect(updateFacts(noteOnly)).toEqual(['Note only', '§07 Thinking In React - State Management']);
    expect(updateFacts({ ...noteOnly, minutes: 30, sectionNumber: null, sectionTitle: null, lectures: [{ section: 7, lecture: 1, title: 'x' }] }))
      .toEqual(['30m', '1 lecture']);
  });
  it('the four player moods have words; an old v1 mood has none', () => {
    expect([moodLabel('😩'), moodLabel('😄'), moodLabel('🚀')]).toEqual(['Tough', 'Great', null]);
  });
});

describe('updateWhen / greeting (IST)', () => {
  it('an update is dated by its study day; the time shows when it was sent that same day', () => {
    const base = { studyDate: '2026-10-21', createdAt: '2026-10-21T13:25:00.000Z' };
    expect(updateWhen(base, '2026-10-21')).toBe('Today 18:55');
    expect(updateWhen({ studyDate: '2026-10-20', createdAt: '2026-10-20T14:10:00.000Z' }, '2026-10-21')).toBe('Yesterday 19:40');
    // an auto-closed session sent the next morning still belongs to the day she studied
    expect(updateWhen({ studyDate: '2026-10-19', createdAt: '2026-10-20T04:00:00.000Z' }, '2026-10-21')).toBe('Mon 19 Oct');
    expect(updateWhen({ studyDate: '2026-10-05', createdAt: '2026-10-05T14:40:00.000Z' }, '2026-10-21')).toBe('Mon 5 Oct');
  });
  it('greets by the hour in India', () => {
    expect(greeting(new Date('2026-10-21T02:30:00.000Z'))).toBe('Good morning'); // 08:00 IST
    expect(greeting(new Date('2026-10-21T08:30:00.000Z'))).toBe('Good afternoon'); // 14:00 IST
    expect(greeting(new Date('2026-10-21T13:30:00.000Z'))).toBe('Good evening'); // 19:00 IST
    expect(greeting(new Date('2026-10-20T20:00:00.000Z'))).toBe('Hi'); // 01:30 IST — she should be asleep
  });
});
