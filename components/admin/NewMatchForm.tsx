"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { newMatchInput } from "@/lib/match";
import type { Team } from "@/lib/repo/teams";
import CustomDropdown from "./CustomDropdown";
import DateTimePicker from "./DateTimePicker";

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
      scheduledAt: String(f.get("when") ?? "") || null,
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
        <label className="field">Home team
          <CustomDropdown label="Home team" name="home" defaultValue={teams[0].id} options={teams.map((t) => ({ value: t.id, label: t.name }))} />
        </label>
        <label className="field">Away team
          <CustomDropdown label="Away team" name="away" defaultValue={teams[1].id} options={teams.map((t) => ({ value: t.id, label: t.name }))} />
        </label>
        <label className="field">Stage
          <CustomDropdown
            label="Stage"
            name="stage"
            defaultValue=""
            allowCustom
            options={[
              { value: "", label: "No stage" },
              ...["Group stage", "Quarter-final", "Semi-final", "Third place", "Final"].map((stage) => ({ value: stage, label: stage })),
            ]}
          />
        </label>
        <label className="field">Date and time
          <DateTimePicker label="Date and time" name="when" defaultValue={null} />
        </label>
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
