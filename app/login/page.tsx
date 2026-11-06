import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/AuthForms";
import { getSessionUser } from "@/lib/session-server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff sign-in · TVC", robots: { index: false } };

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/admin");
  return (
    <main className="auth">
      <div className="panel">
        <div><p className="eyebrow">TVC staff area</p><h1>Sign in</h1></div>
        <LoginForm />
        <p className="muted" style={{ fontSize: "0.85rem" }}>Accounts are created from an invitation link sent by an administrator.</p>
        <a className="muted" href="/">← Back to the scoreboard</a>
      </div>
    </main>
  );
}
