const pad = (n: number) => String(n).padStart(2, "0");

/** Time until a match starts, or elapsed time once its scheduled start has passed. */
export function formatCountdown(ms: number): string {
  const elapsed = ms <= 0;
  const total = Math.floor(Math.abs(ms) / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const duration = d > 0 ? `${d}d ${h}h ${m}m`
    : h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s`
      : `${m}m ${pad(s)}s`;
  return elapsed ? `Started ${duration} ago` : duration;
}

/** Shown in the visitor's own timezone. */
export function formatWhen(iso: string | null): string {
  if (!iso) return "Time to be confirmed";
  return new Date(iso).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Share of a bar, 0 to 100. Counts compare against the larger side; efficiency maps -100..100 onto 0..100. */
export function barShare(value: number, other: number, kind: "count" | "efficiency"): number {
  if (kind === "efficiency") return Math.max(0, Math.min(100, (value + 100) / 2));
  const max = Math.max(value, other, 1);
  return Math.round((value / max) * 100);
}
