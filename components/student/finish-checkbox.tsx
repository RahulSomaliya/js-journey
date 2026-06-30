'use client';
import type { ReactNode } from 'react';

// Hand-drawn circle check, adapted from Codrops' "Animated SVG Checkboxes"
// (the `ac-circle` variant). A real hidden checkbox keeps it accessible; the
// circle path uses pathLength={1} so the draw-on-check animation is pure CSS
// (stroke-dashoffset 1 → 0), themed with the accent token.
const CIRCLE =
  'M34.745,7.183C25.078,12.703,13.516,26.359,8.797,37.13c-13.652,31.134,9.219,54.785,34.77,55.99c15.826,0.742,31.804-2.607,42.207-17.52c6.641-9.52,12.918-27.789,7.396-39.713C85.873,20.155,69.828-5.347,41.802,13.379';

export function FinishCheckbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-2">
      <span className="relative grid size-7 shrink-0 place-items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
        />
        {/* inner dot */}
        <span className={`size-2.5 rounded-full transition-colors duration-200 ${checked ? 'bg-accent' : 'bg-hair-strong'}`} />
        {/* keyboard focus ring */}
        <span className="pointer-events-none absolute inset-0 rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface" />
        {/* the drawn circle */}
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-7 overflow-visible">
          <path
            d={CIRCLE}
            pathLength={1}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 1,
              strokeDashoffset: checked ? 0 : 1,
              transition: 'stroke-dashoffset 0.45s ease-in-out',
            }}
          />
        </svg>
      </span>
      {children}
    </label>
  );
}
