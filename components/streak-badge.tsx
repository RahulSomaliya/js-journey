export function StreakBadge({ days }: { days: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-3 py-1 text-sm font-semibold text-warn">
      🔥 {days} day{days === 1 ? '' : 's'}
    </span>
  );
}
