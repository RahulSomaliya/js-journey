'use client';
import { useId, useState, useTransition, type KeyboardEvent } from 'react';
import { markUpdatesReadAction } from '@/lib/actions/log';
import { replyToUpdateAction } from '@/lib/actions/message';
import { AutoTextarea } from '@/components/auto-textarea';
import { buttonClass, ErrorText } from '@/components/ui';

export type ReplyOutcome = 'replied' | 'marked';

// Rahul's reply to ONE update (replyToUpdateAction: the message + "read" in one transaction), or
// "Mark read" without replying. Takes FeedUpdate.logId — NOT FeedUpdate.id (the player's session id).
// ⌘/Ctrl+Enter sends. On success the action revalidates /r, so the update moves into the history.
export function ReplyForm({ logId, markRead, onDone, onCancel, autoFocus }: {
  logId: string;
  /** offer "Mark read" (unread cards only) */
  markRead?: boolean;
  onDone: (outcome: ReplyOutcome) => void;
  /** offer "Cancel" (the history's reply, which opens on demand) */
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ReplyOutcome | null>(null);
  const [, start] = useTransition();

  function run(kind: ReplyOutcome) {
    if (busy) return;
    const fd = new FormData();
    fd.set('logId', logId);
    if (kind === 'replied') {
      if (!body.trim()) return;
      fd.set('body', body);
    }
    setError(null);
    setBusy(kind);
    start(async () => {
      try {
        const r = kind === 'replied' ? await replyToUpdateAction(fd) : await markUpdatesReadAction(fd);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setBody('');
        onDone(kind);
      } catch (e) {
        console.error('[coach] reply / mark read failed', { logId, kind, e });
        setError('Could not reach JS Journey — check the connection and try again.');
      } finally {
        setBusy(null);
      }
    });
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      run('replied');
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run('replied');
      }}
    >
      <label htmlFor={id} className="sr-only">Reply to Mansi</label>
      <AutoTextarea id={id} rows={2} value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={onKey} placeholder="Reply to Mansi…" autoFocus={autoFocus} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* secondary until he types: a disabled PRIMARY on every unread card (salmon / muddy brown at 50 %)
            competed for attention with nothing to send — only a reply being written carries the accent */}
        <button type="submit" disabled={busy !== null || !body.trim()} className={buttonClass(body.trim() ? 'primary' : 'secondary', 'md', 'min-w-24')}>
          {busy === 'replied' ? 'Sending…' : 'Reply'}
        </button>
        {markRead && (
          <button type="button" onClick={() => run('marked')} disabled={busy !== null} className={buttonClass('ghost', 'md')}>
            {busy === 'marked' ? 'Marking…' : 'Mark read'}
          </button>
        )}
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={busy !== null} className={buttonClass('ghost', 'md')}>
            Cancel
          </button>
        )}
        <span className="ml-auto hidden text-xs text-ink-subtle sm:inline">⌘ Enter to send</span>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </form>
  );
}
