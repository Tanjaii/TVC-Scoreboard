import { useState } from "react";

import {
  AlertTriangle,
  Bell,
  Briefcase,
  CalendarRange,
  Clock3,
  FileText,
  LayoutGrid,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";

import { accessMatrix, decisionLog, overviewStats } from "../data/admin";
import type { LiveMatchData, MatchStats } from "../data/liveMatch";

const navItems = [
  { label: "Overview", icon: LayoutGrid },
  { label: "Matches", icon: CalendarRange },
  { label: "Officials", icon: ShieldCheck },
  { label: "Reports", icon: FileText },
  { label: "Settings", icon: Briefcase },
] as const;

const seniorAdmins = ["Richard", "Evans", "Obulor"] as const;
type SeniorAdmin = (typeof seniorAdmins)[number];

type Props = {
  liveMatch: LiveMatchData;
  onLiveMatchChange: (updater: (current: LiveMatchData) => LiveMatchData) => void;
};

const statFields = [
  { key: "attackPercent", label: "Attack %" },
  { key: "blocks", label: "Blocks" },
  { key: "aces", label: "Aces" },
  { key: "errors", label: "Errors" },
] as const satisfies ReadonlyArray<{ key: keyof MatchStats; label: string }>;

export default function AdminDashboard({ liveMatch, onLiveMatchChange }: Props) {
  const [selectedNav, setSelectedNav] = useState<(typeof navItems)[number]["label"]>("Overview");
  const [activeUser] = useState<SeniorAdmin | "Scorekeeper" | "Official - Head Ref">("Richard");
  const [decisions, setDecisions] = useState(() => [...decisionLog]);

  const canAuthorize = seniorAdmins.includes(activeUser as SeniorAdmin) || activeUser === "Official - Head Ref";
  const canViewReviewAccess = seniorAdmins.includes(activeUser as SeniorAdmin);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const updateMatch = (changes: Partial<LiveMatchData>) => {
    onLiveMatchChange((current) => ({ ...current, ...changes }));
  };

  const updateStat = (team: "homeStats" | "awayStats", key: keyof MatchStats, value: number) => {
    onLiveMatchChange((current) => ({
      ...current,
      [team]: { ...current[team], [key]: value },
    }));
  };

  const handleDecisionLog = () => {
    if (!canAuthorize) {
      return;
    }

    const nextEntry = {
      title: "Official ruling logged",
      team: liveMatch.homeTeam && liveMatch.awayTeam
        ? `${liveMatch.homeTeam} vs ${liveMatch.awayTeam}`
        : "Awaiting match",
      by: activeUser,
      time: "Now",
    };

    setDecisions((current) => [nextEntry, ...current].slice(0, 4));
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-badge">TVC</div>
          <div>
            <span>Volleyball</span>
            <strong>Admin</strong>
          </div>
        </div>

        <div className="admin-user-pill admin-user-pill-top beacon">
          <span className="admin-avatar">{activeUser.charAt(0)}</span>
          <span>{greeting}, {activeUser}</span>
        </div>

        <nav className="admin-nav" aria-label="Admin navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              className={selectedNav === label ? "admin-nav-item active" : "admin-nav-item"}
              onClick={() => setSelectedNav(label)}
            >
              <span className="admin-nav-icon"><Icon size={16} /></span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {canViewReviewAccess ? (
          <div className="admin-cta">
            <p>Review access</p>
            <strong>Authorized</strong>
          </div>
        ) : null}
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">Tournament control</p>
            <h1>Administration Console</h1>
          </div>

          <div className="admin-actions">
            <button type="button" className="admin-icon-button" aria-label="Notifications">
              <Bell size={18} />
            </button>
          </div>
        </header>

        <section className="overview-grid">
          {overviewStats.map((item) => (
            <article key={item.label} className={`overview-card ${item.tone}`}>
              <div className="overview-header">
                <span className="overview-label">{item.label}</span>
                <span className="overview-badge">{item.meta}</span>
              </div>
              <strong>{item.value}</strong>
            </article>
          ))}
        </section>

        <section className="match-focus">
          <div className="focus-header">
            <div>
              <p className="panel-eyebrow">Match focus · Live data entry</p>
              <h2>{liveMatch.homeTeam && liveMatch.awayTeam
                ? `${liveMatch.homeTeam} vs ${liveMatch.awayTeam}`
                : "Enter match details"}</h2>
            </div>
            <span className={`status-pill ${liveMatch.isBroadcasting ? "live" : "waiting"}`}>
              {liveMatch.isBroadcasting ? "Broadcasting" : "Waiting"}
            </span>
          </div>

          <div className="match-entry-grid">
            <label className="match-entry-field">
              Home team
              <input
                value={liveMatch.homeTeam}
                onChange={(event) => updateMatch({ homeTeam: event.target.value })}
                placeholder="Enter home team"
              />
            </label>
            <label className="match-entry-field">
              Away team
              <input
                value={liveMatch.awayTeam}
                onChange={(event) => updateMatch({ awayTeam: event.target.value })}
                placeholder="Enter away team"
              />
            </label>
            <label className="match-entry-field">
              Match stage
              <input
                value={liveMatch.stage}
                onChange={(event) => updateMatch({ stage: event.target.value })}
                placeholder="e.g. Semi-final"
              />
            </label>
            <label className="match-entry-field">
              Scheduled start (local time)
              <input
                type="datetime-local"
                value={liveMatch.scheduledStartAt}
                onChange={(event) => updateMatch({ scheduledStartAt: event.target.value })}
              />
            </label>
            <label className="match-entry-field">
              Set
              <input
                type="number"
                min="1"
                step="1"
                value={liveMatch.setNumber}
                onChange={(event) => updateMatch({ setNumber: Math.max(1, Number(event.target.value) || 1) })}
              />
            </label>
            <label className="match-entry-field">
              Home score
              <input
                type="number"
                min="0"
                step="1"
                value={liveMatch.homeScore}
                onChange={(event) => updateMatch({ homeScore: Math.max(0, Number(event.target.value) || 0) })}
              />
            </label>
            <label className="match-entry-field">
              Away score
              <input
                type="number"
                min="0"
                step="1"
                value={liveMatch.awayScore}
                onChange={(event) => updateMatch({ awayScore: Math.max(0, Number(event.target.value) || 0) })}
              />
            </label>
          </div>

          <div className="live-stats-entry">
            <div className="live-stats-heading">
              <h3>Match statistics</h3>
              <span>Changes update the public scoreboard immediately while broadcasting.</span>
            </div>
            <div className="live-stats-table">
              <div className="live-stats-row live-stats-labels">
                <strong>Statistic</strong>
                <strong>{liveMatch.homeTeam || "Home team"}</strong>
                <strong>{liveMatch.awayTeam || "Away team"}</strong>
              </div>
              {statFields.map(({ key, label }) => (
                <div className="live-stats-row" key={key}>
                  <label htmlFor={`home-${key}`}>{label}</label>
                  <input
                    id={`home-${key}`}
                    type="number"
                    min="0"
                    max={key === "attackPercent" ? 100 : undefined}
                    step="1"
                    value={liveMatch.homeStats[key]}
                    onChange={(event) => updateStat(
                      "homeStats",
                      key,
                      Math.max(0, Math.min(key === "attackPercent" ? 100 : Infinity, Number(event.target.value) || 0)),
                    )}
                  />
                  <input
                    aria-label={`${label} for ${liveMatch.awayTeam || "away team"}`}
                    type="number"
                    min="0"
                    max={key === "attackPercent" ? 100 : undefined}
                    step="1"
                    value={liveMatch.awayStats[key]}
                    onChange={(event) => updateStat(
                      "awayStats",
                      key,
                      Math.max(0, Math.min(key === "attackPercent" ? 100 : Infinity, Number(event.target.value) || 0)),
                    )}
                  />
                </div>
              ))}
              <div className="live-stats-row">
                <strong>Total points</strong>
                <strong>{liveMatch.homeScore}</strong>
                <strong>{liveMatch.awayScore}</strong>
              </div>
            </div>
          </div>
          <div className="broadcast-actions">
            <span>Public scoreboard stays hidden until you start broadcasting.</span>
            <button
              type="button"
              className="decision-button"
              onClick={() => updateMatch({ isBroadcasting: !liveMatch.isBroadcasting })}
              disabled={!liveMatch.homeTeam.trim() || !liveMatch.awayTeam.trim()}
            >
              {liveMatch.isBroadcasting ? "Stop broadcast" : "Start broadcast"}
            </button>
          </div>
        </section>

        <section className="admin-panels">
          <div className="panel panel-large">
            <div className="panel-header-row">
              <div>
                <p className="panel-eyebrow">Matches</p>
                <h2>Queue monitor</h2>
              </div>
              <button type="button" className="panel-link">View all</button>
            </div>

            <div className="match-list">
              {liveMatch.isBroadcasting ? (
                <div className="match-row active">
                  <div>
                    <strong>{liveMatch.homeTeam} vs {liveMatch.awayTeam}</strong>
                    <span>{liveMatch.stage || "Match in progress"} · Set {liveMatch.setNumber}</span>
                  </div>
                  <div className="match-meta">
                    <span className="time-chip">{liveMatch.homeScore} - {liveMatch.awayScore}</span>
                    <span className="status-pill live">Live</span>
                  </div>
                </div>
              ) : (
                <div className="empty-row">
                  <span className="decision-icon"><Clock3 size={15} /></span>
                  <div>
                    <strong>Queue is waiting for match input</strong>
                    <span>Enter match details above to prepare a broadcast.</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="panel panel-side">
            <div className="panel-header-row">
              <div>
                <p className="panel-eyebrow">Official log</p>
                <h2>Recent decisions</h2>
              </div>
              <button type="button" className="panel-link">Review</button>
            </div>

            <div className="decision-list empty-state">
              {decisions.length === 0 ? (
                <div className="empty-row">
                  <span className="decision-icon"><AlertTriangle size={15} /></span>
                  <div>
                    <strong>No decisions logged</strong>
                    <span>Please input official decisions to populate this section.</span>
                  </div>
                </div>
              ) : (
                decisions.map((decision) => (
                  <div key={`${decision.title}-${decision.time}-${decision.by}`} className="decision-row">
                    <span className="decision-icon"><AlertTriangle size={15} /></span>
                    <div>
                      <strong>{decision.title}</strong>
                      <span>{decision.team} • {decision.by}</span>
                    </div>
                    <time>{decision.time}</time>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="admin-panels lower-panels">
          <div className="panel panel-large">
            <div className="panel-header-row">
              <div>
                <p className="panel-eyebrow">Permissions</p>
                <h2>Access matrix</h2>
              </div>
              <button type="button" className="panel-link">Manage</button>
            </div>

            <div className="matrix-list">
              {accessMatrix.map((member) => (
                <div key={member.role} className="matrix-row">
                  <div className="matrix-role">
                    <span className="matrix-dot" />
                    <strong>{member.role}</strong>
                  </div>
                  <span>{member.permissions}</span>
                  <span className={`member-status ${member.status.toLowerCase()} ${member.status === "Active" || member.status === "Authorised" ? "beacon" : ""}`}>{member.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel panel-side">
            <div className="panel-header-row">
              <div>
                <p className="panel-eyebrow">Authority</p>
                <h2>Decision control</h2>
              </div>
              <TrendingUp size={18} className="insight-icon" />
            </div>

            <div className="authority-box">
              <div className="authority-status">
                <span className={canAuthorize ? "status-indicator approved beacon" : "status-indicator blocked beacon"} />
                {canAuthorize ? "Authorized to issue ruling" : "Restricted access"}
              </div>
              <p>
                {canAuthorize
                  ? "Senior administration and official review can record and publish official decisions."
                  : "Scorekeeper cannot approve rulings without an assigned senior-admin authority."}
              </p>
              <button type="button" className="decision-button" onClick={handleDecisionLog} disabled={!canAuthorize}>
                Log official decision
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
