const pad = (n: number) => String(n).padStart(2, "0");

/** "2d 3h 4m", "3h 04m 09s", "4m 09s", or "Starting now". */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Starting now";
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
  return `${m}m ${pad(s)}s`;
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
