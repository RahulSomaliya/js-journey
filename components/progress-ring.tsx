export function ProgressRing({ pct, label }: { pct: number; label?: string }) {
  const r = 52, c = 2 * Math.PI * r, off = c - (pct / 100) * c;
  return (
    <div className="relative grid h-32 w-32 place-items-center">
      <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--hair)" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke="var(--accent)" strokeWidth="10"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-serif text-2xl font-semibold text-ink">{pct}%</div>
        {label && <div className="text-[0.7rem] uppercase tracking-wider text-faint">{label}</div>}
      </div>
    </div>
  );
}
