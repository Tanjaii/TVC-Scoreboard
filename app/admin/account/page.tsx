import { SignOutButton } from "@/components/admin/AuthForms";
import { requireStaff } from "@/lib/session-server";

const CAN = {
  admin: ["Create and edit matches, including previous matches", "Manage teams and set types", "Update scores, sets and statistics", "Start and stop the broadcast", "Create staff invitation links"],
  scorekeeper: ["Update the current set, scores and team statistics for the live match", "Finish sets", "Start and stop the broadcast"],
} as const;

export default async function AccountPage() {
  const user = await requireStaff();
  return (
    <>
      <div><p className="eyebrow">Signed in</p><h1>Account</h1></div>
      <div className="panel stack">
        <div className="table-row"><span className="muted">Name</span><strong>{user.name}</strong></div>
        <div className="table-row"><span className="muted">Email</span><strong>{user.email}</strong></div>
        <div className="table-row"><span className="muted">Role</span><span className="pill ok">{user.role === "admin" ? "Administrator" : "Scorekeeper"}</span></div>
      </div>
      <div className="panel">
        <div className="panel-head"><h2>What you can do</h2></div>
        <ul className="plain">{CAN[user.role].map((c) => <li key={c}>{c}</li>)}</ul>
      </div>
      <div><SignOutButton /></div>
    </>
  );
}
