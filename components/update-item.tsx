import type { ReactNode } from 'react';
import type { CoachMessage, StudentUpdate } from '@/lib/player';
import { fmtWhen } from '@/lib/format';
import { updateFacts, updateWhen } from '@/lib/journey-view';
import { Mood, StuckPill, Tag } from '@/components/ui';

// One of her updates with Rahul's replies threaded under it — her history (/m), his history and
// the JS course history (both pages, ?course=js). Same layout as the Course Player's
// screens/updates/UpdateItem.tsx. `viewer` decides the reply labels: she sees "Rahul · New"; he sees
// "You · Seen / Not seen yet". `newMarks={false}` on a finished course's history: that page marks
// nothing read (v3), so a "New" there could never clear.

export type Viewer = 'coach' | 'student';
type Update = StudentUpdate & { autoClosed?: boolean };

/** Day · mood · flags, then the facts — the head of an update, here and on his unread cards. */
export function UpdateMeta({ update, today, viewer, tags = true }: { update: Update; today: string; viewer: Viewer; tags?: boolean }) {
  return (
    <header className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <h3 className="text-sm font-semibold text-ink">{updateWhen(update, today)}</h3>
        {update.mood && <Mood mood={update.mood} />}
        {update.stuck && <StuckPill />}
        {/* honest to him: how the update reached him (the player is the norm) */}
        {tags && viewer === 'coach' && update.source === 'manual' && <Tag>From the web</Tag>}
        {tags && viewer === 'coach' && update.autoClosed && <Tag>Sent by the player</Tag>}
      </div>
      <p className="mt-0.5 text-sm text-ink-muted">{updateFacts(update).join(' · ')}</p>
    </header>
  );
}

export function Replies({ replies, today, viewer, newMarks = true, className = '' }: { replies: CoachMessage[]; today: string; viewer: Viewer; newMarks?: boolean; className?: string }) {
  if (replies.length === 0) return null;
  return (
    <ul className={`mt-3 space-y-3 border-l border-line pl-4 sm:ml-1 ${className}`}>
      {replies.map((r) => (
        <li key={r.id}>
          <p className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-ink-muted">
            {viewer === 'coach' ? 'You' : 'Rahul'} · <time dateTime={r.createdAt}>{fmtWhen(r.createdAt, today)}</time>
            {viewer === 'student' && newMarks && r.readAt === null && <NewMark />}
            {viewer === 'coach' && <SeenMark readAt={r.readAt} />}
          </p>
          <p className="mt-0.5 max-w-[68ch] whitespace-pre-line text-sm text-ink">{r.body}</p>
        </li>
      ))}
    </ul>
  );
}

function SeenMark({ readAt }: { readAt: string | null }) {
  return <span className="font-normal text-ink-subtle">· {readAt ? 'Seen' : 'Not seen yet'}</span>;
}

function NewMark() {
  return (
    <span className="inline-flex items-center gap-1 text-accent-ink">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
      New
    </span>
  );
}

/** One of Rahul's standalone notes among her updates (lib/journey-view.ts withNotes) — her "Your updates",
 *  and the JS history on both pages — styled like a reply, so his words read the same wherever they sit.
 *  Hers: "New" while she has not seen it (not on a history page: `newMarks`); his: "Seen / Not seen yet". */
export function NoteItem({ note, today, viewer = 'student', newMarks = true }: { note: CoachMessage; today: string; viewer?: Viewer; newMarks?: boolean }) {
  return (
    <article className="border-b border-line py-5 last:border-b-0">
      <div className="border-l border-line pl-4 sm:ml-1">
        <p className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-ink-muted">
          {viewer === 'coach' ? 'You' : 'Rahul'} · note · <time dateTime={note.createdAt}>{fmtWhen(note.createdAt, today)}</time>
          {viewer === 'student' && newMarks && note.readAt === null && <NewMark />}
          {viewer === 'coach' && <SeenMark readAt={note.readAt} />}
        </p>
        <p className="mt-0.5 max-w-[68ch] whitespace-pre-line text-sm text-ink">{note.body}</p>
      </div>
    </article>
  );
}

// A grid, so an action (the coach's quiet "Reply", components/coach/history-reply.tsx) can sit at the
// right of the first line (col 2, row 1) and open its form under the replies (col-span-2).
export function UpdateItem({ update, today, viewer, tags, newMarks, children }: { update: Update; today: string; viewer: Viewer; tags?: boolean; newMarks?: boolean; children?: ReactNode }) {
  return (
    <article className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 border-b border-line py-5 last:border-b-0">
      <UpdateMeta update={update} today={today} viewer={viewer} tags={tags} />
      {update.note && <p className="col-span-2 mt-2 max-w-[68ch] whitespace-pre-line text-base text-ink">{update.note}</p>}
      <Replies replies={update.replies} today={today} viewer={viewer} newMarks={newMarks} className="col-span-2" />
      {children}
    </article>
  );
}

/** "Older updates" / "Newest" — keyset pages (lib/feed.ts cursor, passed back as-is). */
export function Pager({ nextHref, newestHref }: { nextHref: string | null; newestHref: string | null }) {
  if (!nextHref && !newestHref) return null;
  return (
    <nav aria-label="More updates" className="mt-6 flex items-center justify-between gap-4 text-sm font-medium">
      {newestHref ? <a href={newestHref} className="rounded-sm text-accent-ink underline-offset-4 hover:underline">← Newest</a> : <span />}
      {nextHref && <a href={nextHref} className="rounded-sm text-accent-ink underline-offset-4 hover:underline">Older updates →</a>}
    </nav>
  );
}
