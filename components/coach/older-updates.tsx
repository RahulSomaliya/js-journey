'use client';
import { useState, type ReactNode } from 'react';
import { ChevronDownIcon } from '@/components/ui';

// The coach history shows only the newest study day's updates (spec-v4 "History"); the rest of that page
// sits behind this quiet button. The keyset pager (`after`: "Older updates →" to the next page) is part of
// what it reveals — shown beside the button it would offer two "Older updates" at once.
export function OlderUpdates({ children, after }: { children: ReactNode; after: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (open) {
    return (
      <>
        {children}
        {after}
      </>
    );
  }
  return (
    <div className="border-t border-line pt-4">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
      >
        Older updates
        <ChevronDownIcon className="size-4" />
      </button>
    </div>
  );
}
