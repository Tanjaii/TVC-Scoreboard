import { useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  CircleStop,
  LogOut,
  Radio,
  ShieldCheck,
  Trophy,
} from "lucide-react";

import type { LiveMatchData } from "../data/liveMatch";

type Props = {
  liveMatch: LiveMatchData;
  onLiveMatchChange: (updater: (current: LiveMatchData) => LiveMatchData) => void;
  currentUser: { name: string; email: string };
  onSignOut: () => Promise<void>;
};

type Section = "Overview" | "Match control" | "Account";

export default function AdminDashboard({
  liveMatch,
  onLiveMatchChange,
  currentUser,
  onSignOut,
}: Props) {
  const [section, setSection] = useState<Section>("Overview");
  const [signingOut, setSigningOut] = useState(false);

  const updateMatch = (changes: Partial<LiveMatchData>) => {
    onLiveMatchChange((current) => ({ ...current, ...changes }));
  };

  const updateScore = (team: "homeScore" | "awayScore", rawValue: string) => {
    const score = Math.max(0, Math.floor(Number(rawValue) || 0));
    updateMatch({ [team]: score });
  };

  const hasTeams = Boolean(liveMatch.homeTeam.trim() && liveMatch.awayTeam.trim());

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-badge">TVC</div>
          <div><span>Total Volleyball</span><strong>Control room</strong></div>
        </div>

        <div className="admin-user-pill admin-user-pill-top">
          <span className="admin-avatar">{(currentUser.name || currentUser.email).charAt(0).toUpperCase()}</span>
          <span><strong>{currentUser.name || "Administrator"}</strong><small>Administrator access</small></span>
        </div>

        <nav className="admin-nav" aria-label="Admin navigation">
          {([
            { label: "Overview" as const, icon: Activity },
            { label: "Match control" as const, icon: CalendarDays },
            { label: "Account" as const, icon: ShieldCheck },
          ]).map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              className={section === label ? "admin-nav-item active" : "admin-nav-item"}
              aria-current={section === label ? "page" : undefined}
              onClick={() => setSection(label)}
            >
              <span className="admin-nav-icon"><Icon size={17} /></span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="admin-cta">
          <p>Competition status</p>
          <strong>{liveMatch.isBroadcasting ? "Live broadcast" : "Not broadcasting"}</strong>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">TVC · Tournament operations</p>
            <h1>{section}</h1>
            <p className="admin-auth-copy">Manage match information shown on the public scoreboard.</p>
          </div>
          <div className="admin-actions">
            <span className={liveMatch.isBroadcasting ? "status-pill live" : "status-pill waiting"}>
              {liveMatch.isBroadcasting ? "LIVE" : "OFF AIR"}
            </span>
            <button
              type="button"
              className="admin-signout-button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
            >
              <LogOut size={16} /> {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </header>

        {section === "Overview" && (
          <>
            <section className="overview-grid">
              <article className="overview-card">
                <div className="overview-header"><span className="overview-label">Broadcast</span><Radio size={17} /></div>
                <strong>{liveMatch.isBroadcasting ? "Live" : "Off air"}</strong>
                <span className="overview-badge">{liveMatch.isBroadcasting ? "Visible to viewers" : "Not being broadcast"}</span>
              </article>
              <article className="overview-card">
                <div className="overview-header"><span className="overview-label">Current set</span><Trophy size={17} /></div>
                <strong>{liveMatch.setNumber}</strong>
                <span className="overview-badge">Best-of-five match</span>
              </article>
              <article className="overview-card">
                <div className="overview-header"><span className="overview-label">Match status</span><CheckCircle2 size={17} /></div>
                <strong>{hasTeams ? "Prepared" : "Needs setup"}</strong>
                <span className="overview-badge">{hasTeams ? "Team names entered" : "Enter both teams below"}</span>
              </article>
            </section>

            <section className="match-focus">
              <div className="focus-header">
                <div>
                  <p className="panel-eyebrow">Current match</p>
                  <h2>{hasTeams ? `${liveMatch.homeTeam} vs ${liveMatch.awayTeam}` : "Set up the next match"}</h2>
                </div>
                <span className={liveMatch.isBroadcasting ? "status-pill live" : "status-pill waiting"}>
                  {liveMatch.isBroadcasting ? "Broadcasting" : "Waiting"}
                </span>
              </div>

              <div className="match-entry-grid">
                <label className="match-entry-field">Home team
                  <input value={liveMatch.homeTeam} maxLength={100} onChange={(event) => updateMatch({ homeTeam: event.target.value })} placeholder="Enter home team" />
                </label>
                <label className="match-entry-field">Away team
                  <input value={liveMatch.awayTeam} maxLength={100} onChange={(event) => updateMatch({ awayTeam: event.target.value })} placeholder="Enter away team" />
                </label>
                <label className="match-entry-field">Match stage
                  <input value={liveMatch.stage} maxLength={100} onChange={(event) => updateMatch({ stage: event.target.value })} placeholder="e.g. Group stage, Final" />
                </label>
                <label className="match-entry-field">Scheduled start
                  <input type="datetime-local" value={liveMatch.scheduledStartAt} onChange={(event) => updateMatch({ scheduledStartAt: event.target.value })} />
                </label>
              </div>

              <div className="score-entry-grid">
                <div className="score-entry-team">
                  <label htmlFor="tvc-home-score">{liveMatch.homeTeam || "Home team"}</label>
                  <input id="tvc-home-score" type="number" min="0" step="1" value={liveMatch.homeScore} onChange={(event) => updateScore("homeScore", event.target.value)} />
                </div>
                <div className="score-entry-divider">SET {liveMatch.setNumber}</div>
                <div className="score-entry-team">
                  <label htmlFor="tvc-away-score">{liveMatch.awayTeam || "Away team"}</label>
                  <input id="tvc-away-score" type="number" min="0" step="1" value={liveMatch.awayScore} onChange={(event) => updateScore("awayScore", event.target.value)} />
                </div>
              </div>

              <div className="match-entry-grid">
                <label className="match-entry-field">Set number
                  <input type="number" min="1" max="5" step="1" value={liveMatch.setNumber} onChange={(event) => updateMatch({ setNumber: Math.min(5, Math.max(1, Math.floor(Number(event.target.value) || 1)) )})} />
                </label>
              </div>

              <div className="broadcast-actions">
                <span>Changes save through the secured live-match API.</span>
                <button
                  type="button"
                  className="decision-button"
                  disabled={!hasTeams && !liveMatch.isBroadcasting}
                  onClick={() => updateMatch({ isBroadcasting: !liveMatch.isBroadcasting })}
                >
                  {liveMatch.isBroadcasting ? <><CircleStop size={16} /> Stop broadcast</> : <><Radio size={16} /> Start broadcast</>}
                </button>
              </div>
            </section>
          </>
        )}

        {section === "Match control" && (
          <section className="match-focus">
            <div className="focus-header">
              <div><p className="panel-eyebrow">Match details</p><h2>Match control</h2></div>
              <span className={liveMatch.isBroadcasting ? "status-pill live" : "status-pill waiting"}>{liveMatch.isBroadcasting ? "LIVE" : "OFF AIR"}</span>
            </div>
            <p>Update team names, stage, scheduled start, set number, and scores. The public scoreboard reads the same saved match state.</p>
            <div className="match-entry-grid">
              <label className="match-entry-field">Home team<input value={liveMatch.homeTeam} maxLength={100} onChange={(event) => updateMatch({ homeTeam: event.target.value })} /></label>
              <label className="match-entry-field">Away team<input value={liveMatch.awayTeam} maxLength={100} onChange={(event) => updateMatch({ awayTeam: event.target.value })} /></label>
              <label className="match-entry-field">Stage<input value={liveMatch.stage} maxLength={100} onChange={(event) => updateMatch({ stage: event.target.value })} /></label>
              <label className="match-entry-field">Scheduled start<input type="datetime-local" value={liveMatch.scheduledStartAt} onChange={(event) => updateMatch({ scheduledStartAt: event.target.value })} /></label>
              <label className="match-entry-field">Set number<input type="number" min="1" max="5" value={liveMatch.setNumber} onChange={(event) => updateMatch({ setNumber: Math.min(5, Math.max(1, Math.floor(Number(event.target.value) || 1)) )})} /></label>
              <label className="match-entry-field">Home score<input type="number" min="0" value={liveMatch.homeScore} onChange={(event) => updateScore("homeScore", event.target.value)} /></label>
              <label className="match-entry-field">Away score<input type="number" min="0" value={liveMatch.awayScore} onChange={(event) => updateScore("awayScore", event.target.value)} /></label>
            </div>
            <div className="broadcast-actions">
              <span>Broadcast is {liveMatch.isBroadcasting ? "currently on" : "currently off"}.</span>
              <button type="button" className="decision-button" disabled={!hasTeams && !liveMatch.isBroadcasting} onClick={() => updateMatch({ isBroadcasting: !liveMatch.isBroadcasting })}>
                {liveMatch.isBroadcasting ? "Stop broadcast" : "Start broadcast"}
              </button>
            </div>
          </section>
        )}

        {section === "Account" && (
          <section className="match-focus">
            <div className="focus-header"><div><p className="panel-eyebrow">Account security</p><h2>Administrator account</h2></div><ShieldCheck size={20} /></div>
            <div className="matrix-list">
              <div className="matrix-row"><strong>Name</strong><span>{currentUser.name || "Not provided"}</span></div>
              <div className="matrix-row"><strong>Email</strong><span>{currentUser.email}</span></div>
              <div className="matrix-row"><strong>Role</strong><span className="member-status active">Administrator</span></div>
            </div>
            <p className="panel-note">Role verification and match-write authorization are enforced by the application and server. Account provisioning and password resets must be performed through the configured authentication workflow.</p>
            <button type="button" className="admin-signout-button" onClick={() => void handleSignOut()} disabled={signingOut}>
              <LogOut size={16} /> {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
