import PublicBoard from "@/components/public/PublicBoard";
import { getDb } from "@/lib/db";
import { buildPublicSnapshot, type PublicSnapshot } from "@/lib/public";
import { listMatches } from "@/lib/repo/matches";
import { listTeams } from "@/lib/repo/teams";

export const dynamic = "force-dynamic";

export default async function Home() {
  let initial: PublicSnapshot | null = null;
  try {
    const db = getDb();
    initial = buildPublicSnapshot(await listMatches(db), await listTeams(db));
  } catch (error) {
    // The board still loads and shows its own retry message if the first fetch fails.
    console.error("Initial snapshot failed.", error);
  }
  return <PublicBoard initial={initial} />;
}
