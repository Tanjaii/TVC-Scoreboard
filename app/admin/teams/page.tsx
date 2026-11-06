import TeamsManager from "@/components/admin/TeamsManager";
import { getDb } from "@/lib/db";
import { listTeams } from "@/lib/repo/teams";
import { requireStaff } from "@/lib/session-server";

export default async function TeamsPage() {
  await requireStaff(["admin"]);
  return (
    <>
      <div><p className="eyebrow">Admin</p><h1>Teams</h1></div>
      <TeamsManager initial={await listTeams(getDb())} />
    </>
  );
}
