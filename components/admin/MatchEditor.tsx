"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Role } from "@/lib/auth/session";
import {
  MAX_SCORE, MAX_SETS, describeDifferences, emptySet, finishCurrentSet, sameInput, setsWon, toInput, withStatus,
  type MatchInput, type MatchRecord, type MatchStatus, type SetScore, type SideStats,
} from "@/lib/match";
import type { Team } from "@/lib/repo/teams";
import { fromLocalInput, toLocalInput } from "./local-time";

type Props = { initial: MatchRecord; teams: Team[]; role: Role; setTypes: string[] };
type Message = { kind: "ok" | "error"; text: string } | null;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const time = (iso: string) => new Date(iso).toLocaleTimeString();

export default function MatchEditor({ initial, teams, role, setTypes }: Props) {
  const isAdmin = role === "admin";
  // `saved` is the last copy we know the server has. `draft` is what is on screen; visitors never see it until it is saved.
  const [saved, setSaved] = useState<MatchRecord>(initial);
  const [draft, setDraft] = useState<MatchInput>(() => toInput(initial));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [conflict, setConflict] = useState<MatchRecord | null>(null);

  const dirty = !sameInput(draft, toInput(saved));
  const teamName = useCallback((id: string) => teams.find((t) => t.id === id)?.name ?? "Unknown team", [teams]);

  const adopt = useCallback((record: MatchRecord) => {
    setSaved(record);
    setDraft(toInput(record));
    setConflict(null);
  }, []);

  // Leaving with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Detect newer saved data while editing: quietly refresh if there are no edits, warn if there are.
  const latest = useRef({ saved, dirty, saving, conflict });
  latest.current = { saved, dirty, saving, conflict };
  useEffect(() => {
    const timer = window.setInterval(async () => {
      const cur = latest.current;
      if (cur.saving || cur.conflict || document.hidden) return;
      try {
        const res = await fetch(`/api/admin/matches/${cur.saved.id}`, { cache: "no-store" });
        if (!res.ok) return;
        const { match } = (await res.json()) as { match: MatchRecord };
        if (match.version <= latest.current.saved.version) return;
        if (latest.current.dirty) setConflict(match);
        else adopt(match);
      } catch { /* offline: try again next tick */ }
    }, 8000);
    return () => window.clearInterval(timer);
  }, [adopt]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/matches/${saved.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: saved.version, match: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        adopt(data.match);
        setMessage({ kind: "ok", text: `Saved at ${time(data.match.updatedAt)}. Visitors now see this version.` });
      } else if (res.status === 409 && data.code === "conflict") {
        setConflict(data.match);
      } else {
        const issues = (data.issues as { message: string }[] | undefined)?.map((i) => i.message).join(" ");
        setMessage({ kind: "error", text: issues || data.error || "The match could not be saved." });
      }
    } catch {
      setMessage({ kind: "error", text: "Could not reach the server. Your edits are still here; try saving again." });
    }
    setSaving(false);
  };

  const reload = async () => {
    if (dirty && !window.confirm("Discard your unsaved edits and load the saved data?")) return;
    try {
      const res = await fetch(`/api/admin/matches/${saved.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      adopt((await res.json()).match);
      setMessage({ kind: "ok", text: "Loaded the latest saved data." });
    } catch {
      setMessage({ kind: "error", text: "Could not load the saved data." });
    }
  };

  const patch = (p: Partial<MatchInput>) => setDraft((d) => ({ ...d, ...p }));
  const patchCurrent = (p: Partial<SetScore>) => setDraft((d) => (d.currentSet ? { ...d, currentSet: { ...d.currentSet, ...p } } : d));
  const patchSet = (i: number, p: Partial<SetScore>) => setDraft((d) => ({ ...d, sets: d.sets.map((s, n) => (n === i ? { ...s, ...p } : s)) }));
  const patchStats = (side: "home" | "away", p: Partial<SideStats>) =>
    setDraft((d) => ({ ...d, stats: { ...d.stats, [side]: { ...d.stats[side], ...p } } }));

  const changeStatus = (status: MatchStatus) => {
    const losing = draft.sets.length > 0 && status === "scheduled";
    if (losing && !window.confirm("Moving this match back to Scheduled clears its set results. Continue?")) return;
    setDraft((d) => withStatus(d, status));
  };

  const won = setsWon(draft.sets);
  const setNo = draft.sets.length + 1;
  const isLive = draft.status === "live" && draft.currentSet;

  return (
    <>
      <div>
        <Link className="muted" href="/admin">← All matches</Link>
        <h1 style={{ marginTop: 6 }}>{teamName(draft.homeTeamId)} vs {teamName(draft.awayTeamId)}</h1>
        <p className="muted">
          Saved version {saved.version}{saved.updatedByName ? ` by ${saved.updatedByName}` : ""} at {time(saved.updatedAt)} ·{" "}
          <span className={saved.status === "live" ? "pill live" : "pill"}>{saved.status}</span>
        </p>
      </div>

      <div className={dirty ? "savebar dirty" : "savebar"} role="region" aria-label="Save changes">
        <span aria-live="polite">{dirty ? "Unsaved changes. Visitors can’t see them yet." : "All changes saved."}</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn small" onClick={() => void reload()} disabled={saving}>Reload saved data</button>
          {dirty && <button className="btn small" onClick={() => setDraft(toInput(saved))} disabled={saving}>Discard changes</button>}
          <button className="btn primary" onClick={() => void save()} disabled={!dirty || saving}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </div>

      {message && <p className={`notice ${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>{message.text}</p>}

      {conflict && (
        <div className="notice warn stack" role="alert">
          <strong>Newer data has been saved{conflict.updatedByName ? ` by ${conflict.updatedByName}` : ""} at {time(conflict.updatedAt)}.</strong>
          <p>Saving now would overwrite it. Here is what differs from your draft:</p>
          <ul className="plain">
            {describeDifferences(draft, toInput(conflict), teamName).map((d) => <li key={d}>{d}</li>)}
          </ul>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn primary" onClick={() => adopt(conflict)}>Load the latest and discard my edits</button>
            <button className="btn" onClick={() => { setSaved(conflict); setConflict(null); setMessage({ kind: "ok", text: "Your edits are kept. Save again to overwrite the newer version." }); }}>
              Keep my edits and review
            </button>
          </div>
        </div>
      )}

      <datalist id="set-types">{setTypes.map((t) => <option key={t} value={t} />)}</datalist>

      <section className="panel stack" aria-labelledby="setup-h">
        <div className="panel-head">
          <h2 id="setup-h">Match setup</h2>
          {!isAdmin && <span className="pill">Admin only</span>}
        </div>
        <div className="grid-2">
          <label className="field">Home team
            <select disabled={!isAdmin} value={draft.homeTeamId} onChange={(e) => patch({ homeTeamId: e.target.value })}>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="field">Away team
            <select disabled={!isAdmin} value={draft.awayTeamId} onChange={(e) => patch({ awayTeamId: e.target.value })}>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="field">Stage
            <input disabled={!isAdmin} maxLength={60} value={draft.stage} list="stages" placeholder="e.g. Semi-final" onChange={(e) => patch({ stage: e.target.value })} />
            <datalist id="stages"><option value="Group stage" /><option value="Quarter-final" /><option value="Semi-final" /><option value="Third place" /><option value="Final" /></datalist>
          </label>
          <label className="field">Scheduled start (your local time)
            <input disabled={!isAdmin} type="datetime-local" value={toLocalInput(draft.scheduledAt)} onChange={(e) => patch({ scheduledAt: fromLocalInput(e.target.value) })} />
          </label>
          <label className="field">Status
            <select disabled={!isAdmin} value={draft.status} onChange={(e) => changeStatus(e.target.value as MatchStatus)}>
              <option value="scheduled">Scheduled (upcoming)</option>
              <option value="live">Live</option>
              <option value="completed">Completed (previous match)</option>
            </select>
          </label>
        </div>
        {draft.homeTeamId === draft.awayTeamId && <p className="notice error">Home and away must be different teams.</p>}
      </section>

      {isLive && draft.currentSet ? (
        <>
          <section className="panel stack" aria-labelledby="live-h">
            <div className="panel-head">
              <h2 id="live-h">Set {setNo} · live scoring</h2>
              <span className="muted">Sets won {won.home}–{won.away}</span>
            </div>
            <label className="field" style={{ maxWidth: 360 }}>Set type
              <input list="set-types" maxLength={60} value={draft.currentSet.type} placeholder="e.g. Mixed (4 ladies + 2 men)" onChange={(e) => patchCurrent({ type: e.target.value })} />
            </label>
            <div className="scorepad">
              {(["home", "away"] as const).map((side) => {
                const value = draft.currentSet![side];
                const name = teamName(side === "home" ? draft.homeTeamId : draft.awayTeamId);
                return (
                  <div className="side" key={side}>
                    <strong>{name}</strong>
                    <div className="big" aria-live="polite">{value}</div>
                    <div className="steps">
                      <button className="btn" onClick={() => patchCurrent({ [side]: clamp(value - 1, 0, MAX_SCORE) })} aria-label={`Remove a point from ${name}`}>−1</button>
                      <button className="btn primary" onClick={() => patchCurrent({ [side]: clamp(value + 1, 0, MAX_SCORE) })} aria-label={`Add a point to ${name}`}>+1</button>
                    </div>
                    <label className="field exact">Exact score
                      <NumberField label={`${name} score`} value={value} min={0} max={MAX_SCORE} onChange={(n) => patchCurrent({ [side]: n })} />
                    </label>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn gold" disabled={draft.sets.length >= MAX_SETS - 1} onClick={() => setDraft((d) => finishCurrentSet(d))}>
                Finish set {setNo} and start set {setNo + 1}
              </button>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={draft.isBroadcasting} onChange={(e) => patch({ isBroadcasting: e.target.checked })} />
              <span>
                <strong>Broadcast on the public scoreboard</strong>
                <br /><span className="muted">{draft.isBroadcasting ? "On" : "Off"} · applied when you press Save changes.</span>
              </span>
            </label>
          </section>

          <section className="panel stack" aria-labelledby="stats-h">
            <div className="panel-head"><h2 id="stats-h">Team statistics</h2></div>
            <div className="grid-2">
              {(["home", "away"] as const).map((side) => {
                const s = draft.stats[side];
                const name = teamName(side === "home" ? draft.homeTeamId : draft.awayTeamId);
                return (
                  <div key={side} className="stack">
                    <strong>{name}</strong>
                    <div className="grid-2">
                      <label className="field">Attack efficiency (%)<NumberField label={`${name} attack efficiency`} value={s.attackEfficiency} min={-100} max={100} decimal onChange={(n) => patchStats(side, { attackEfficiency: n })} /></label>
                      <label className="field">Blocks<NumberField label={`${name} blocks`} value={s.blocks} min={0} max={999} onChange={(n) => patchStats(side, { blocks: n })} /></label>
                      <label className="field">Aces<NumberField label={`${name} aces`} value={s.aces} min={0} max={999} onChange={(n) => patchStats(side, { aces: n })} /></label>
                      <label className="field">Errors<NumberField label={`${name} errors`} value={s.errors} min={0} max={999} onChange={(n) => patchStats(side, { errors: n })} /></label>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <p className="notice">
          {draft.status === "live" ? "" : isAdmin
            ? "Live scoring appears here when the match status is Live."
            : "This match is not live."}
        </p>
      )}

      <section className="panel stack" aria-labelledby="sets-h">
        <div className="panel-head">
          <h2 id="sets-h">Completed sets</h2>
          {!isAdmin && <span className="pill">Admin only</span>}
        </div>
        {draft.status === "scheduled" ? <p className="muted">Sets appear once the match is live or completed.</p> : (
          <>
            {draft.sets.length === 0 && <p className="muted">No completed sets yet.</p>}
            {draft.sets.map((s, i) => (
              <div className="setrow" key={i}>
                <strong>Set {i + 1}</strong>
                <input className="input" aria-label={`Set ${i + 1} type`} list="set-types" maxLength={60} disabled={!isAdmin} placeholder="Set type" value={s.type} onChange={(e) => patchSet(i, { type: e.target.value })} />
                <NumberField label={`Set ${i + 1} ${teamName(draft.homeTeamId)} score`} value={s.home} min={0} max={MAX_SCORE} disabled={!isAdmin} onChange={(n) => patchSet(i, { home: n })} />
                <NumberField label={`Set ${i + 1} ${teamName(draft.awayTeamId)} score`} value={s.away} min={0} max={MAX_SCORE} disabled={!isAdmin} onChange={(n) => patchSet(i, { away: n })} />
                {isAdmin && <button className="btn small danger" onClick={() => setDraft((d) => ({ ...d, sets: d.sets.filter((_, n) => n !== i) }))}>Remove</button>}
              </div>
            ))}
            {isAdmin && (
              <div>
                <button className="btn small" disabled={draft.sets.length >= (draft.status === "live" ? MAX_SETS - 1 : MAX_SETS)} onClick={() => setDraft((d) => ({ ...d, sets: [...d.sets, emptySet()] }))}>Add completed set</button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

/** Text-backed number input: lets people type freely ("-", "12.") and commits valid numbers as they go. */
function NumberField({ value, onChange, min, max, decimal = false, disabled, label }: {
  value: number; onChange: (n: number) => void; min: number; max: number; decimal?: boolean; disabled?: boolean; label: string;
}) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(String(value)); }, [value]);

  return (
    <input
      className="input"
      aria-label={label}
      disabled={disabled}
      inputMode={decimal ? "decimal" : "numeric"}
      value={text}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setText(String(value)); }}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const n = Number(t);
        if (t.trim() !== "" && t !== "-" && Number.isFinite(n)) {
          onChange(clamp(decimal ? Math.round(n * 10) / 10 : Math.trunc(n), min, max));
        }
      }}
    />
  );
}
