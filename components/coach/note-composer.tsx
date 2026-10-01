'use client';
import { useState, useTransition } from 'react';
import { sendCoachNoteAction } from '@/lib/actions/message';
import { AutoTextarea } from '@/components/auto-textarea';
import { buttonClass, CheckIcon, ErrorText, SectionHeading } from '@/components/ui';

export interface SentNote { id: string; body: string; when: string; seen: boolean; }

const RECENT = 3;
/** fixed (not useId): the caught-up line's "Send her a note" (unread-updates.tsx) focuses this field */
export const NOTE_FIELD_ID = 'note-to-mansi';

// A standalone note (not a reply to one update) — it tops her "From Rahul" until she has seen it.
// His last few notes sit under the box with whether she has seen them yet.
export function NoteComposer({ notes }: { notes: SentNote[] }) {
  const id = NOTE_FIELD_ID;
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  function send() {
    if (pending || !body.trim()) return;
    const fd = new FormData();
    fd.set('body', body);
    setError(null);
    setSent(false);
    start(async () => {
      try {
        const r = await sendCoachNoteAction(fd);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setBody('');
        setSent(true);
      } catch (e) {
        console.error('[coach] send note failed', e);
        setError('Could not reach JS Journey — check the connection and try again.');
      }
    });
  }

  return (
    <section aria-labelledby="note-title">
      <SectionHeading id="note-title" title="Send Mansi a note" />
      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label htmlFor={id} className="sr-only">Note for Mansi</label>
        <AutoTextarea
          id={id}
          rows={2}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setSent(false);
          }}
          placeholder="Something for her to read next time she opens the app…"
        />
        <div className="mt-3 flex items-center gap-3">
          <button type="submit" disabled={pending || !body.trim()} className={buttonClass('secondary', 'md', 'min-w-28')}>
            {pending ? 'Sending…' : 'Send note'}
          </button>
          <p role="status" className="text-sm text-ink-muted">
            {sent && (
              <span className="inline-flex items-center gap-1.5">
                <CheckIcon className="size-4 animate-check-in text-accent" strokeWidth={2} />
                Sent — she’ll see it at the top of her app.
              </span>
            )}
          </p>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
      </form>
      {notes.length > 0 && (
        <ul className="mt-6 space-y-3" aria-label="Your recent notes">
          {notes.slice(0, RECENT).map((n) => (
            <li key={n.id}>
              <p className="line-clamp-2 max-w-[68ch] text-sm text-ink">{n.body}</p>
              <p className="mt-0.5 text-xs text-ink-subtle">
                {n.when} · {n.seen ? 'Seen' : 'Not seen yet'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
