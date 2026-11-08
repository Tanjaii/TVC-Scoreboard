"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { MAX_SCORE, MAX_SETS, newMatchInput, type SetScore } from "@/lib/match";
import type { Team } from "@/lib/repo/teams";
import CustomDropdown from "./CustomDropdown";
import DateTimePicker from "./DateTimePicker";

type SetDraft = { type: string; home: string; away: string };
const emptySetDraft = (): SetDraft => ({ type: "", home: "", away: "" });

export default function NewMatchForm({ teams }: { teams: Team[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<"upcoming" | "previous">("upcoming");
  const [sets, setSets] = useState<SetDraft[]>([emptySetDraft()]);

  if (teams.length < 2) {
    return <p className="notice warn">Add at least two teams under Teams before creating a match.</p>;
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const previous = kind === "previous";
    const completedSets: SetScore[] = previous ? sets.map((set) => ({
      type: set.type,
      home: Number(set.home),
      away: Number(set.away),
    })) : [];
    if (previous && sets.length === 0) {
      setError("Add at least one set result for a previous match.");
      return;
    }

    setBusy(true);
    setError("");
    const body = {
      ...newMatchInput(String(f.get("home")), String(f.get("away"))),
      stage: String(f.get("stage") ?? ""),
      scheduledAt: String(f.get("when") ?? "") || null,
      status: previous ? "completed" : "scheduled",
      sets: completedSets,
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
      <fieldset className="match-kind">
        <legend>Match type</legend>
        <label><input type="radio" name="kind" value="upcoming" checked={kind === "upcoming"} onChange={() => setKind("upcoming")} /> Upcoming match</label>
        <label><input type="radio" name="kind" value="previous" checked={kind === "previous"} onChange={() => setKind("previous")} /> Previous match</label>
      </fieldset>
      {kind === "previous" && (
        <section className="previous-match-sets" aria-labelledby="previous-sets-heading">
          <div className="panel-head">
            <div>
              <h3 id="previous-sets-heading">Set results</h3>
              <p className="muted">Enter the score for each set played in this match.</p>
            </div>
            <span className="pill">{sets.length} / {MAX_SETS} sets</span>
          </div>
          {sets.map((set, index) => (
            <div className="new-set-row" key={index}>
              <strong>Set {index + 1}</strong>
              <label className="field">Set type
                <input
                  maxLength={60}
                  list="set-types"
                  placeholder="e.g. Mixed"
                  value={set.type}
                  onChange={(event) => setSets((current) => current.map((item, i) => i === index ? { ...item, type: event.target.value } : item))}
                />
              </label>
              <label className="field">Home score
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_SCORE}
                  step={1}
                  required
                  aria-label={`Set ${index + 1} home score`}
                  value={set.home}
                  onChange={(event) => setSets((current) => current.map((item, i) => i === index ? { ...item, home: event.target.value } : item))}
                />
              </label>
              <label className="field">Away score
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_SCORE}
                  step={1}
                  required
                  aria-label={`Set ${index + 1} away score`}
                  value={set.away}
                  onChange={(event) => setSets((current) => current.map((item, i) => i === index ? { ...item, away: event.target.value } : item))}
                />
              </label>
              {sets.length > 1 && (
                <button type="button" className="btn small danger" aria-label={`Remove set ${index + 1}`} onClick={() => setSets((current) => current.filter((_, i) => i !== index))}>
                  Remove
                </button>
              )}
            </div>
          ))}
          <datalist id="set-types"><option value="Men" /><option value="Ladies" /><option value="Mixed" /></datalist>
          <div>
            <button type="button" className="btn small" disabled={sets.length >= MAX_SETS} onClick={() => setSets((current) => [...current, emptySetDraft()])}>
              Add set
            </button>
          </div>
        </section>
      )}
      {error && <p className="notice error" role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn primary" disabled={busy}>{busy ? "Creating…" : "Create and open"}</button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
