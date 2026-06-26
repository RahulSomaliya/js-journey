'use client';
import { useRef, useState, useTransition } from 'react';
import { sendCoachNoteAction } from '@/lib/actions/message';

export function SendNoteForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form
      ref={formRef}
      action={(fd) =>
        start(async () => {
          const r = await sendCoachNoteAction(fd);
          if (r.ok) {
            formRef.current?.reset();
            setSent(true);
            setTimeout(() => setSent(false), 3000);
          }
        })
      }
      className="flex h-full flex-col rounded-2xl border border-hair bg-surface p-6 shadow"
    >
      <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Reply to Mansi</div>
      <textarea
        name="body"
        placeholder="A line of encouragement…"
        className="mt-3 w-full flex-1 resize-none rounded-lg border border-hair bg-surface-2 p-3 text-ink placeholder:text-faint focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="mt-3 self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sent ? 'Sent 💚' : pending ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}
