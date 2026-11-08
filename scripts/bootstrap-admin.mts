import { getDb } from "../lib/db";
import { createInvitation } from "../lib/repo/invitations";
import { countUsers } from "../lib/repo/users";

// Creates the very first administrator's invitation. After that, invitations come from the admin area.
const db = getDb();
if ((await countUsers(db)) > 0) {
  console.error("An account already exists. Create further invitations from the admin area (Invitations).");
  process.exit(1);
}
const invite = await createInvitation(db, { role: "admin", note: "First administrator", createdBy: null, days: 1 });
const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
console.log(`\nOpen this one-time link within 24 hours to create the first administrator:\n\n  ${base}/invite/${invite.token}\n`);
process.exit(0);
