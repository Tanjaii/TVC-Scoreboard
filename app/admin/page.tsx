import Link from "next/link";
import NewMatchForm from "@/components/admin/NewMatchForm";
import { getDb } from "@/lib/db";
import { formatWhen } from "@/lib/format";
import { setsWon } from "@/lib/match";
import { can } from "@/lib/permissions";
import { listMatches } from "@/lib/repo/matches";
import { listTeams } from "@/lib/repo/teams";
import { requireStaff } from "@/lib/session-server";

export default async function MatchesPage() {
  const user = await requireStaff();
  const db = getDb();
  const [matches, teams] = await Promise.all([listMatches(db), listTeams(db)]);
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? "Unknown team";
  const isAdmin = can(user.role, "manageMatchSetup");
  const liveMatch = matches.find((m) => m.status === "live");
  const order = { live: 0, scheduled: 1, completed: 2 } as const;
  const sorted = [...matches].sort((a, b) => order[a.status] - order[b.status]);

  return (
    <>
      <div><p className="eyebrow">Staff</p><h1>Matches</h1></div>

      {!isAdmin && (
        <div className="panel">
          {liveMatch ? (
            <div className="panel-head">
              <div><p className="eyebrow">Live now</p><h2>{name(liveMatch.homeTeamId)} vs {name(liveMatch.awayTeamId)}</h2></div>
              <Link className="btn primary" href={`/admin/matches/${liveMatch.id}`}>Open scoring</Link>
            </div>
          ) : <p className="muted">No match is live. An administrator starts a match; it will show up here for scoring.</p>}
        </div>
      )}

      {isAdmin && <NewMatchForm teams={teams} />}

      <div className="panel">
        <div className="panel-head"><h2>All matches</h2></div>
        {sorted.length === 0 ? <p className="muted">No matches yet.</p> : (
          <div className="stack">
            {sorted.map((m) => {
              const won = setsWon(m.sets);
              const canOpen = isAdmin || m.status === "live";
              return (
                <div className="table-row" key={m.id}>
                  <div>
                    <strong>{name(m.homeTeamId)} vs {name(m.awayTeamId)}</strong>
                    <div className="muted" style={{ fontSize: "0.85rem" }}>
                      {[m.stage, formatWhen(m.scheduledAt), m.status !== "scheduled" ? `Sets ${won.home}–${won.away}` : ""].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span className={m.status === "live" ? "pill live" : m.status === "completed" ? "pill ok" : "pill"}>{m.status}</span>
                    {canOpen && <Link className="btn small" href={`/admin/matches/${m.id}`}>{isAdmin ? "Edit" : "Open"}</Link>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
