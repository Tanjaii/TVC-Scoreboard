import type { Metadata } from "next";
import { InviteForm } from "@/components/admin/AuthForms";
import { getDb } from "@/lib/db";
import { peekInvitation } from "@/lib/repo/invitations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Accept invitation · TVC", robots: { index: false }, referrer: "no-referrer" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = token.length >= 20 && token.length <= 100 ? await peekInvitation(getDb(), token) : null;
  return (
    <main className="auth">
      <div className="panel">
        <div><p className="eyebrow">TVC staff area</p><h1>{invite ? "Create your account" : "Link not valid"}</h1></div>
        {invite ? <InviteForm token={token} role={invite.role} /> : (
          <>
            <p className="notice warn">This invitation link has already been used, has expired, or was cancelled. Ask an administrator for a new one.</p>
            <a className="btn" href="/login">Go to sign-in</a>
          </>
        )}
      </div>
    </main>
  );
}
