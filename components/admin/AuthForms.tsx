"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

async function post(url: string, body: unknown): Promise<{ ok: boolean; error?: string; issues?: { message: string }[] }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error ?? "Something went wrong.", issues: data.issues };
  } catch {
    return { ok: false, error: "Could not reach the server. Check your connection and try again." };
  }
}

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const r = await post("/api/auth/login", { email: f.get("email"), password: f.get("password") });
    if (r.ok) { router.replace("/admin"); router.refresh(); return; }
    setError(r.error ?? "Sign-in failed.");
    setBusy(false);
  };

  return (
    <form className="stack" onSubmit={(e) => void submit(e)}>
      <label className="field">Email<input name="email" type="email" autoComplete="username" required /></label>
      <label className="field">Password<input name="password" type="password" autoComplete="current-password" required /></label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="btn primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function InviteForm({ token, role }: { token: string; role: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("confirm")) { setError("The passwords do not match."); return; }
    setBusy(true);
    setError("");
    const r = await post("/api/auth/accept-invite", { token, name: f.get("name"), email: f.get("email"), password: f.get("password") });
    if (r.ok) { router.replace("/admin"); router.refresh(); return; }
    setError(r.issues?.map((i) => i.message).join(" ") || r.error || "Could not create the account.");
    setBusy(false);
  };

  return (
    <form className="stack" onSubmit={(e) => void submit(e)}>
      <p className="muted">You’ve been invited as {role === "admin" ? "an administrator" : "a scorekeeper"}.</p>
      <label className="field">Your name<input name="name" required maxLength={100} autoComplete="name" /></label>
      <label className="field">Email<input name="email" type="email" required autoComplete="username" /></label>
      <label className="field">Password (12+ characters)<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
      <label className="field">Confirm password<input name="confirm" type="password" required minLength={12} autoComplete="new-password" /></label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="btn primary" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
    </form>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button className="btn small" disabled={busy} onClick={async () => {
      setBusy(true);
      await post("/api/auth/logout", {});
      router.replace("/login");
      router.refresh();
    }}>{busy ? "Signing out…" : "Sign out"}</button>
  );
}
