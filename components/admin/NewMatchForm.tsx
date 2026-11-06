"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { newMatchInput } from "@/lib/match";
import type { Team } from "@/lib/repo/teams";
import { fromLocalInput } from "./local-time";

export default function NewMatchForm({ teams }: { teams: Team[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (teams.length < 2) {
    return <p className="notice warn">Add at least two teams under Teams before creating a match.</p>;
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const previous = f.get("kind") === "previous";
    setBusy(true);
    setError("");
    const body = {
      ...newMatchInput(String(f.get("home")), String(f.get("away"))),
      stage: String(f.get("stage") ?? ""),
      scheduledAt: fromLocalInput(String(f.get("when") ?? "")),
      status: previous ? "completed" : "scheduled",
    };
    try {
      const res = await fetch("/api/admin/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { router.push(`/admin/matches/${data.match.id}`); return; }
      setError(data.issues?.map((i: { message: string }) => i.message).join(" ") || data.error || "Could not create the match.");
    } catch {
      setError("Could not reach the server. Try again.");
    }
    setBusy(false);
  };

  if (!open) return <div><button className="btn primary" onClick={() => setOpen(true)}>New match</button></div>;

  return (
    <form className="panel stack" onSubmit={(e) => void submit(e)}>
      <div className="panel-head"><h2>New match</h2></div>
      <div className="grid-2">
        <label className="field">Home team<select name="home" required defaultValue={teams[0].id}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="field">Away team<select name="away" required defaultValue={teams[1].id}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="field">Stage<input name="stage" maxLength={60} placeholder="e.g. Semi-final" /></label>
        <label className="field">Date and time<input name="when" type="datetime-local" /></label>
      </div>
      <fieldset style={{ border: 0, padding: 0, display: "flex", gap: 20, flexWrap: "wrap" }}>
        <label><input type="radio" name="kind" value="upcoming" defaultChecked /> Upcoming match</label>
        <label><input type="radio" name="kind" value="previous" /> Previous match (enter set results next)</label>
      </fieldset>
      {error && <p className="notice error" role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn primary" disabled={busy}>{busy ? "Creating…" : "Create and open"}</button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
