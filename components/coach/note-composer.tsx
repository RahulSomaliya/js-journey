'use client';
import { useEffect, useState, useTransition } from 'react';
import { sendCoachNoteAction } from '@/lib/actions/message';
import { AutoTextarea } from '@/components/auto-textarea';
import { buttonClass, CheckIcon, ErrorText } from '@/components/ui';

export interface SentNote { id: string; body: string; when: string; seen: boolean; }

const RECENT = 3;
/** fixed (not useId): the caught-up line's "Send her a note" (unread-updates.tsx) focuses this field */
export const NOTE_FIELD_ID = 'note-to-mansi';

/** the caught-up line's "Send her a note" (unread-updates.tsx) asks the composer to open: the field is not
 *  in the page while it is folded, so a fragment link / getElementById there would find nothing */
export const OPEN_NOTE_EVENT = 'open-note-composer';

// A standalone note (not a reply to one update) — it tops her "From Rahul" until she has seen it.
// v4 (Rahul 2026-10-12: "much smaller — optional, opens only when clicked"): folded to ONE quiet text
// button; opening shows the box and his last few notes (with whether she has seen them yet). A send folds
// it back with a quiet "Sent".
export function NoteComposer({ notes }: { notes: SentNote[] }) {
  const id = NOTE_FIELD_ID;
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const show = () => {
      setOpen(true);
      setSent(false);
      requestAnimationFrame(() => document.getElementById(NOTE_FIELD_ID)?.focus()); // already open: the effect below will not re-run
    };
    window.addEventListener(OPEN_NOTE_EVENT, show);
    return () => window.removeEventListener(OPEN_NOTE_EVENT, show);
  }, []);
  // focus on every open, however it was opened (the button, or the caught-up line's link)
  useEffect(() => {
    if (open) document.getElementById(NOTE_FIELD_ID)?.focus();
  }, [open]);

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
        setOpen(false);
      } catch (e) {
        console.error('[coach] send note failed', e);
        setError('Could not reach JS Journey — check the connection and try again.');
      }
    });
  }

  return (
    <section aria-label="Note for Mansi">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="note-panel"
          onClick={() => {
            setOpen((o) => !o);
            setSent(false);
          }}
          className="rounded-sm text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Send Mansi a note
        </button>
        <p role="status" className="text-sm text-ink-muted">
          {sent && !open && (
            <span className="inline-flex items-center gap-1.5">
              <CheckIcon className="size-4 animate-check-in text-accent" strokeWidth={2} />
              Sent
            </span>
          )}
        </p>
      </div>
      {open && (
        <div id="note-panel" className="mt-4">
          <form
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
              onChange={(e) => setBody(e.target.value)}
              placeholder="Something for her to read next time she opens the app…"
            />
            <div className="mt-3 flex items-center gap-3">
              <button type="submit" disabled={pending || !body.trim()} className={buttonClass('secondary', 'md', 'min-w-28')}>
                {pending ? 'Sending…' : 'Send note'}
              </button>
              <button type="button" onClick={() => setOpen(false)} className={buttonClass('ghost', 'md')}>
                Cancel
              </button>
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
        </div>
      )}
    </section>
  );
}
