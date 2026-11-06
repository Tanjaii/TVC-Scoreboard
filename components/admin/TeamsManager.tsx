"use client";

import { useState } from "react";
import type { Team, TeamInput } from "@/lib/repo/teams";

const blank: TeamInput = { name: "", shortName: "", logoUrl: "", info: "" };

async function call(method: string, url: string, body?: unknown) {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true as const, data };
    const issues = (data.issues as { message: string }[] | undefined)?.map((i) => i.message).join(" ");
    return { ok: false as const, error: issues || data.error || "Something went wrong." };
  } catch {
    return { ok: false as const, error: "Could not reach the server." };
  }
}

export default function TeamsManager({ initial }: { initial: Team[] }) {
  const [teams, setTeams] = useState(initial);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<TeamInput>(blank);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const start = (t?: Team) => { setEditing(t ? t.id : "new"); setForm(t ? { name: t.name, shortName: t.shortName, logoUrl: t.logoUrl, info: t.info } : blank); setError(""); };

  const save = async () => {
    setBusy(true); setError("");
    const r = editing === "new" ? await call("POST", "/api/admin/teams", form) : await call("PUT", `/api/admin/teams/${editing}`, form);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    const team: Team = r.data.team;
    setTeams((list) => (editing === "new" ? [...list, team] : list.map((t) => (t.id === team.id ? team : t))).sort((a, b) => a.name.localeCompare(b.name)));
    setEditing(null);
  };

  const remove = async (t: Team) => {
    if (!window.confirm(`Delete ${t.name}?`)) return;
    const r = await call("DELETE", `/api/admin/teams/${t.id}`);
    if (!r.ok) { setError(r.error); return; }
    setTeams((list) => list.filter((x) => x.id !== t.id));
  };

  return (
    <>
      {error && !editing && <p className="notice error" role="alert">{error}</p>}
      {editing ? (
        <form className="panel stack" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <div className="panel-head"><h2>{editing === "new" ? "New team" : "Edit team"}</h2></div>
          <div className="grid-2">
            <label className="field">Team name<input required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field">Short name (up to 12)<input maxLength={12} value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value })} /></label>
          </div>
          <label className="field">Logo link (https://… or /assets/…)<input maxLength={500} value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} /></label>
          <label className="field">Team information (shown in the Info section)<textarea maxLength={2000} value={form.info} onChange={(e) => setForm({ ...form, info: e.target.value })} /></label>
          {error && <p className="notice error" role="alert">{error}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save team"}</button>
            <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      ) : <div><button className="btn primary" onClick={() => start()}>Add team</button></div>}

      <div className="panel stack">
        <div className="panel-head"><h2>Teams</h2></div>
        {teams.length === 0 ? <p className="muted">No teams yet. Add the teams taking part, then create matches between them.</p> : teams.map((t) => (
          <div className="table-row" key={t.id}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {t.logoUrl ? <img src={t.logoUrl} alt="" width={44} height={44} style={{ borderRadius: 10, objectFit: "cover" }} /> : <div className="logo-fallback" style={{ width: 44, height: 44, borderRadius: 10, fontSize: "1rem" }}>{(t.shortName || t.name).slice(0, 3).toUpperCase()}</div>}
              <div><strong>{t.name}</strong><div className="muted" style={{ fontSize: "0.85rem" }}>{t.shortName}</div></div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn small" onClick={() => start(t)}>Edit</button>
              <button className="btn small danger" onClick={() => void remove(t)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
