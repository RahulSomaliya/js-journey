'use client';
import { useState } from 'react';
import { buttonClass, CheckIcon } from '@/components/ui';
import { ReplyForm } from './reply-form';

// A quiet "Reply" on a READ update in the history (he marked it read, then thought of something).
// Lives in UpdateItem's grid: the button at the right of the first line, the form under the replies.
// The reply lands under the update after the action's revalidation.
export function HistoryReply({ logId }: { logId: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <>
      <div className="col-start-2 row-start-1 -my-1 flex items-center gap-2 self-start">
        {sent && (
          <span role="status" className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
            <CheckIcon className="size-4 animate-check-in text-accent" strokeWidth={2} />
            Sent
          </span>
        )}
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className={buttonClass('ghost', 'sm', '-mr-3')}>
            Reply
          </button>
        )}
      </div>
      {open && (
        <div className="col-span-2 mt-4 sm:ml-1">
          <ReplyForm
            logId={logId}
            autoFocus
            onCancel={() => setOpen(false)}
            onDone={() => {
              setOpen(false);
              setSent(true);
            }}
          />
        </div>
      )}
    </>
  );
}
