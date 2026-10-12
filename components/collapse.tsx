'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

// Height animation without measuring: a one-row grid whose track goes 0fr <-> 1fr (220 ms). Mirror of the
// Course Player's web/src/components/Collapse.tsx (the coach plan accordion looks like her course content).
// Children mount only while open (and while it closes); an already-open panel renders open on first paint
// (SSR included), it never animates in. The panel clips while it animates, so a focus ring inside must use
// the inset rule (.inset-focus, app/globals.css) or it is cut at the sides. Under prefers-reduced-motion
// globals.css zeroes the transition, so the open/close is instant.

/** a missed transitionend (tab hidden mid-animation) must not leave the children mounted */
const CLOSE_FALLBACK_MS = 400;

export function Collapse({ open, children, id, className = '' }: { open: boolean; children: ReactNode; id?: string; className?: string }) {
  const [mounted, setMounted] = useState(open);
  const [expanded, setExpanded] = useState(open);
  const box = useRef<HTMLDivElement>(null);

  // State follows `open` while rendering (React's "adjust state on a prop change"): a setState in an effect
  // body would render twice and the linter rejects it.
  if (open && !mounted) setMounted(true); // renders once at 0fr, then the effect below grows it
  if (!open && expanded) setExpanded(false);

  // Opening: one frame at 0fr is committed first, so the change to 1fr transitions.
  useEffect(() => {
    if (!open || !mounted || expanded) return;
    const raf = requestAnimationFrame(() => setExpanded(true));
    return () => cancelAnimationFrame(raf);
  }, [open, mounted, expanded]);

  // Closed: unmount the children when the track has collapsed.
  useEffect(() => {
    if (open || !mounted) return;
    const el = box.current;
    const finish = (): void => setMounted(false);
    const t = window.setTimeout(finish, CLOSE_FALLBACK_MS);
    const onEnd = (e: TransitionEvent): void => {
      if (e.target === el && e.propertyName === 'grid-template-rows') finish();
    };
    el?.addEventListener('transitionend', onEnd);
    return () => {
      window.clearTimeout(t);
      el?.removeEventListener('transitionend', onEnd);
    };
  }, [open, mounted]);

  return (
    <div
      ref={box}
      id={id}
      data-open={expanded ? 'true' : 'false'}
      className={`grid transition-[grid-template-rows] duration-[220ms] ease-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'} ${className}`}
    >
      <div className="inset-focus min-h-0 overflow-hidden">{mounted && children}</div>
    </div>
  );
}
