'use client';
import { useState } from 'react';
import type { FeedUpdate } from '@/lib/feed';
import type { LectureDone } from '@/lib/schedule';
import { plural } from '@/lib/format';
import { CheckIcon, SectionHeading } from '@/components/ui';
import { Replies, UpdateMeta } from '@/components/update-item';
import { ReplyForm, type ReplyOutcome } from './reply-form';
import { NOTE_FIELD_ID } from './note-composer';

// The top of /r: every update Rahul has not read, newest first, each with its own reply box.
// A card leaves as soon as its reply / "Mark read" succeeds (the server re-render then lists it in
// the history); the status line says where it went.
// Nothing unread → ONE line (lib/journey-view.ts caughtUp), never an "all caught up" card: when she has
// gone quiet that card was the loudest thing on his page at the moment he should be writing to her.
export function UnreadUpdates({ updates, today, quiet, more }: {
  updates: FeedUpdate[];
  today: string;
  /** the line shown when nothing is unread; `nudge` = she has been silent for 2+ study days */
  quiet: { nudge: boolean; text: string };
  /** more unread exist than this page holds (reply / mark read to reach them) */
  more: boolean;
}) {
  const [leaving, setLeaving] = useState<string[]>([]);
  const [gone, setGone] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const shown = updates.filter((u) => !gone.includes(u.logId));

  function done(logId: string, outcome: ReplyOutcome) {
    setNotice(outcome === 'replied' ? 'Reply sent — the update is in the history now.' : 'Marked read — it’s in the history now.');
    setLeaving((l) => [...l, logId]);
  }

  return (
    <section aria-labelledby="unread-title">
      <SectionHeading id="unread-title" title="Unread" meta={shown.length > 0 ? plural(shown.length, 'update') : undefined} />
      <p role="status" className="text-sm text-ink-muted">
        {notice && (
          <span className="mt-2 inline-flex items-center gap-1.5">
            <CheckIcon className="size-4 animate-check-in text-accent" strokeWidth={2} />
            {notice}
          </span>
        )}
      </p>
      {shown.length === 0 ? (
        <p className={`mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm ${quiet.nudge ? 'text-ink' : 'text-ink-muted'}`}>
          {quiet.text}
          {quiet.nudge && (
            <a
              href={`#${NOTE_FIELD_ID}`}
              onClick={(e) => {
                // a fragment link scrolls but never focuses a textarea — put the cursor in it
                const field = document.getElementById(NOTE_FIELD_ID);
                if (!field) return;
                e.preventDefault();
                field.focus();
              }}
              className="rounded-sm font-medium text-accent-ink underline-offset-4 hover:underline"
            >
              Send her a note
            </a>
          )}
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {shown.map((u) => (
            <li
              key={u.logId}
              className={leaving.includes(u.logId) ? 'animate-leave' : undefined}
              onAnimationEnd={(e) => {
                if (e.target === e.currentTarget && leaving.includes(u.logId)) setGone((g) => [...g, u.logId]);
              }}
            >
              <UnreadCard update={u} today={today} onDone={(o) => done(u.logId, o)} />
            </li>
          ))}
        </ul>
      )}
      {more && shown.length > 0 && <p className="mt-3 text-sm text-ink-muted">Older unread updates show up here as you clear these.</p>}
    </section>
  );
}

function UnreadCard({ update, today, onDone }: { update: FeedUpdate; today: string; onDone: (o: ReplyOutcome) => void }) {
  return (
    <article className="rounded-lg border border-line bg-surface p-5 shadow-e1 sm:p-6">
      <UpdateMeta update={update} today={today} viewer="coach" />
      {update.note ? (
        <p className="mt-3 max-w-[68ch] whitespace-pre-line text-base leading-7 text-ink">{update.note}</p>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">
          {update.autoClosed ? 'No note — she left without signing off, so the player sent the session itself.' : 'No note this time.'}
        </p>
      )}
      <Lectures lectures={update.lectures} />
      <Replies replies={update.replies} today={today} viewer="coach" />
      <div className="mt-5 border-t border-line pt-5">
        <ReplyForm logId={update.logId} markRead onDone={onDone} />
      </div>
    </article>
  );
}

const SHOWN_LECTURES = 5;

function Lectures({ lectures }: { lectures: LectureDone[] }) {
  if (lectures.length === 0) return null;
  const row = (l: LectureDone) => (
    <li key={`${l.section}-${l.lecture}`} className="flex gap-2 text-sm text-ink-muted">
      <CheckIcon className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} />
      <span className="min-w-0">{l.title}</span>
    </li>
  );
  const rest = lectures.slice(SHOWN_LECTURES);
  return (
    <div className="mt-4">
      <ul className="space-y-1">{lectures.slice(0, SHOWN_LECTURES).map(row)}</ul>
      {rest.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer list-none text-sm font-medium text-accent-ink [&::-webkit-details-marker]:hidden">+{rest.length} more</summary>
          <ul className="mt-1 space-y-1">{rest.map(row)}</ul>
        </details>
      )}
    </div>
  );
}
