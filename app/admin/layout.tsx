import type { Metadata } from "next";
import type { ReactNode } from "react";
import AdminNav from "@/components/admin/AdminNav";
import { SignOutButton } from "@/components/admin/AuthForms";
import { can } from "@/lib/permissions";
import { requireStaff } from "@/lib/session-server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff · TVC Scoreboard", robots: { index: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireStaff();
  const links = [
    { href: "/admin", label: "Matches" },
    ...(can(user.role, "manageTeams") ? [{ href: "/admin/teams", label: "Teams" }] : []),
    ...(can(user.role, "manageInvitations") ? [{ href: "/admin/invitations", label: "Invitations" }] : []),
    { href: "/admin/account", label: "Account" },
  ];

  return (
    <div className="admin">
      <aside className="admin-side">
        <a className="brand" href="/"><img src="/assets/tvc-logo.jpeg" alt="" /><div><strong>TVC Staff</strong><span>Scoreboard control</span></div></a>
        <AdminNav links={links} />
        <div className="admin-user">
          <div><strong>{user.name}</strong><br /><span className="muted">{user.role === "admin" ? "Administrator" : "Scorekeeper"}</span></div>
          <SignOutButton />
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
