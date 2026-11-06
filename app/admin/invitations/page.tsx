import InvitationsManager from "@/components/admin/InvitationsManager";
import { getDb } from "@/lib/db";
import { listInvitations } from "@/lib/repo/invitations";
import { requireStaff } from "@/lib/session-server";

export default async function InvitationsPage() {
  await requireStaff(["admin"]);
  return (
    <>
      <div><p className="eyebrow">Admin</p><h1>Invitations</h1></div>
      <InvitationsManager initial={await listInvitations(getDb())} />
    </>
  );
}
