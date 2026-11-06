"use client";

import { useState } from "react";
import type { Invitation } from "@/lib/repo/invitations";

export default function InvitationsManager({ initial }: { initial: Invitation[] }) {
  const [list, setList] = useState(initial);
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const res = await fetch("/api/admin/invitations", { cache: "no-store" });
    if (res.ok) setList((await res.json()).invitations);
  };

  const create = async (form: HTMLFormElement) => {
    const f = new FormData(form);
    setBusy(true); setError(""); setLink(null); setCopied(false);
    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: f.get("role"), note: String(f.get("note") ?? "") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Could not create the invitation."); }
      else { setLink({ url: `${window.location.origin}${data.path}`, expiresAt: data.expiresAt }); form.reset(); await reload(); }
    } catch { setError("Could not reach the server."); }
    setBusy(false);
  };

  const revoke = async (id: string) => {
    if (!window.confirm("Cancel this invitation link?")) return;
    const res = await fetch(`/api/admin/invitations/${id}`, { method: "DELETE" });
    if (res.ok) await reload(); else setError("That invitation could not be cancelled.");
  };

  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link.url); setCopied(true); } catch { setCopied(false); }
  };

  return (
    <>
      <form className="panel stack" onSubmit={(e) => { e.preventDefault(); void create(e.currentTarget); }}>
        <div className="panel-head"><h2>Create an invitation</h2></div>
        <div className="grid-2">
          <label className="field">Role
            <select name="role" defaultValue="scorekeeper">
              <option value="scorekeeper">Scorekeeper — scores, sets and stats</option>
              <option value="admin">Administrator — everything, including invitations</option>
            </select>
          </label>
          <label className="field">Who is it for? (optional note)<input name="note" maxLength={80} placeholder="e.g. Court 1 scorer" /></label>
        </div>
        {error && <p className="notice error" role="alert">{error}</p>}
        <div><button className="btn primary" disabled={busy}>{busy ? "Creating…" : "Create one-time link"}</button></div>
      </form>

      {link && (
        <div className="panel stack" role="status">
          <div className="panel-head"><h2>Copy this link now</h2><span className="pill warn">Shown once</span></div>
          <p className="linkbox">{link.url}</p>
          <p className="muted">Send it privately. It works once and expires on {new Date(link.expiresAt).toLocaleString()}. For security it can’t be shown again; create a new one if you lose it.</p>
          <div><button className="btn gold" onClick={() => void copy()}>{copied ? "Copied" : "Copy link"}</button></div>
        </div>
      )}

      <div className="panel stack">
        <div className="panel-head"><h2>Invitations</h2></div>
        {list.length === 0 ? <p className="muted">No invitations yet.</p> : list.map((i) => (
          <div className="table-row" key={i.id}>
            <div>
              <strong>{i.role === "admin" ? "Administrator" : "Scorekeeper"}{i.note ? ` · ${i.note}` : ""}</strong>
              <div className="muted" style={{ fontSize: "0.85rem" }}>
                Created {new Date(i.createdAt).toLocaleString()}{i.createdByName ? ` by ${i.createdByName}` : ""}
                {i.status === "used" && i.usedByName ? ` · joined as ${i.usedByName}` : ""}
                {i.status === "pending" ? ` · expires ${new Date(i.expiresAt).toLocaleString()}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className={i.status === "pending" ? "pill ok" : "pill"}>{i.status}</span>
              {i.status === "pending" && <button className="btn small danger" onClick={() => void revoke(i.id)}>Cancel</button>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
