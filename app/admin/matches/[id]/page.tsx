import { notFound } from "next/navigation";
import MatchEditor from "@/components/admin/MatchEditor";
import { getDb } from "@/lib/db";
import { isUuid } from "@/lib/http";
import { getMatch, listMatches } from "@/lib/repo/matches";
import { listTeams } from "@/lib/repo/teams";
import { requireStaff } from "@/lib/session-server";

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff();
  const { id } = await params;
  const db = getDb();
  const match = isUuid(id) ? await getMatch(db, id) : null;
  if (!match) notFound();
  // Scorekeepers only ever work on the live match.
  if (user.role === "scorekeeper" && match.status !== "live") notFound();

  const [teams, all] = await Promise.all([listTeams(db), listMatches(db)]);
  const setTypes = [...new Set(all.flatMap((m) => [...m.sets, ...(m.currentSet ? [m.currentSet] : [])].map((s) => s.type).filter(Boolean)))].sort();
  return <MatchEditor initial={match} teams={teams} role={user.role} setTypes={setTypes} />;
}
