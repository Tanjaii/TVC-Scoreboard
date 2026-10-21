import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronRight,
  CircleDot,
  X,
  Crown,
  Home,
  Menu,
  Play,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";

import {
  leftNav,
  matchRows,
  recentMatches,
  standings,
} from "../data/competition";
import type { LiveMatchData } from "../data/liveMatch";

const navIcons = {
  home: Home,
  circleDot: CircleDot,
  trophy: Trophy,
  calendar: CalendarDays,
  users: Users,
  shield: ShieldCheck,
  barChart: BarChart3,
} as const;

type Props = {
  liveMatch: LiveMatchData;
};

export default function ScoreboardDashboard({ liveMatch }: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const isWaiting = !liveMatch.isBroadcasting;
  const scheduledStartTime = liveMatch.scheduledStartAt
    ? new Date(liveMatch.scheduledStartAt).getTime()
    : Number.NaN;
  const countdownSeconds = Number.isFinite(scheduledStartTime)
    ? Math.max(0, Math.floor((scheduledStartTime - now) / 1000))
    : 0;
  const shouldShowCountdown = !liveMatch.isBroadcasting
    && Number.isFinite(scheduledStartTime)
    && countdownSeconds > 0;
  const countdownDays = Math.floor(countdownSeconds / 86_400);
  const countdownHours = Math.floor((countdownSeconds % 86_400) / 3_600);
  const countdownMinutes = Math.floor((countdownSeconds % 3_600) / 60);
  const countdownRemainder = countdownSeconds % 60;

  useEffect(() => {
    if (!liveMatch.scheduledStartAt || liveMatch.isBroadcasting) {
      return undefined;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [liveMatch.scheduledStartAt, liveMatch.isBroadcasting]);

  const statRows = [
    { label: "Attack %", home: liveMatch.homeStats.attackPercent, away: liveMatch.awayStats.attackPercent },
    { label: "Blocks", home: liveMatch.homeStats.blocks, away: liveMatch.awayStats.blocks },
    { label: "Aces", home: liveMatch.homeStats.aces, away: liveMatch.awayStats.aces },
    { label: "Errors", home: liveMatch.homeStats.errors, away: liveMatch.awayStats.errors },
    { label: "Total Points", home: liveMatch.homeScore, away: liveMatch.awayScore },
  ];

  return (
    <div className="scoreboard-shell">
      {isMenuOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setIsMenuOpen(false)}
        />
      ) : null}
      <aside className={isMenuOpen ? "sidebar mobile-open" : "sidebar"}>
        <div className="brand-block">
          <img className="brand-logo" src="/assets/tvc-logo.jpeg" alt="TVC logo" />
          <div className="brand-copy">
            <span>Volleyball</span>
            <strong>Championship</strong>
          </div>
          <button
            type="button"
            className="sidebar-close-button"
            aria-label="Close navigation menu"
            onClick={() => setIsMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav id="public-navigation" className="sidebar-nav" aria-label="Sidebar navigation">
          {leftNav.map((item) => {
            const Icon = navIcons[item.icon as keyof typeof navIcons];
            const isActive = "active" in item && Boolean(item.active);

            return (
              <button
                key={item.label}
                type="button"
                className={isActive ? "nav-item active" : "nav-item"}
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="nav-icon"><Icon size={18} /></span>
                <span>{item.label}</span>
                {isActive ? <span className="active-dot" /> : null}
              </button>
            );
          })}
        </nav>

        <div className="spotlight-box">
          <div className="spotlight-glow" />
          <p>
            The best
            <br />
            teams. The
            <br />
            bigger dreams.
          </p>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button
            type="button"
            className="mobile-menu-button"
            aria-label="Open navigation menu"
            aria-expanded={isMenuOpen}
            aria-controls="public-navigation"
            onClick={() => setIsMenuOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="top-links">
            <span>Play</span>
            <span>•</span>
            <span>Compete</span>
            <span>•</span>
            <span>Rise</span>
          </div>

          <div className="header-actions">
            <button type="button" className="icon-button" aria-label="Notifications">
              <Bell size={18} />
            </button>
            <button type="button" className="profile-btn" aria-label="Profile">
              <img src="/assets/tvc-logo.jpeg" alt="TVC logo placeholder" className="profile-ring" />
            </button>
          </div>
        </header>

        <section className="hero-panel">
          <div className="hero-overlay" />
          <div className="match-header">
            <span className={isWaiting ? "live-pill beacon" : "live-pill"}>
              <span className="live-dot" />
              {isWaiting ? "Awaiting input" : "Live Match"}
            </span>
            <div className="competition-copy">
              <h2>TVC Volleyball Championship</h2>
              <div className="meta-row">
                <span>{isWaiting ? "Waiting for admin input" : liveMatch.stage || "Live match"}</span>
                <span>•</span>
                <span>{isWaiting ? "Live data pending" : `Set ${liveMatch.setNumber}`}</span>
              </div>
            </div>
          </div>

          <div className="score-row">
            <div className="team-card left">
              <img src="/assets/tvc-logo.jpeg" alt="TVC team image placeholder" />
              <div className="team-meta">
                <span className="team-name">{isWaiting ? "Awaiting team" : liveMatch.homeTeam}</span>
                <span className="team-side">Home</span>
              </div>
            </div>

            <div className="center-score">
              <div className="set-tag">{isWaiting ? "Awaiting input" : `Set ${liveMatch.setNumber}`}</div>
              <div className="score-numbers">
                <span>{isWaiting ? "--" : liveMatch.homeScore}</span>
                <span className="divider">|</span>
                <span>{isWaiting ? "--" : liveMatch.awayScore}</span>
              </div>
              <div className="set-history">
                <span>{isWaiting ? "Waiting for live set data" : liveMatch.stage || "Live match data"}</span>
              </div>
            </div>

            <div className="team-card right">
              <img src="/assets/tvc-logo.jpeg" alt="TVC team image placeholder" />
              <div className="team-meta">
                <span className="team-name">{isWaiting ? "Awaiting team" : liveMatch.awayTeam}</span>
                <span className="team-side">Away</span>
              </div>
            </div>
          </div>
        </section>

        <div className="status-strip">
          <div className="status-left">
            <span className="live-dot small" />
            <span className="state-text">{isWaiting ? "Awaiting input" : "Live"}</span>
            <span className="score-text">{isWaiting ? "Match data pending admin entry" : `${liveMatch.homeTeam} ${liveMatch.homeScore} - ${liveMatch.awayScore} ${liveMatch.awayTeam}`}</span>
          </div>

          <div className="clock-chip">
            <span>{isWaiting ? "Waiting" : `Set ${liveMatch.setNumber}`}</span>
          </div>
        </div>

        <div className="arena-panel">
          <img src="/assets/tvc-arena.png" alt="TVC volleyball championship arena" />
          {!liveMatch.isBroadcasting && (shouldShowCountdown || !liveMatch.scheduledStartAt) ? (
            <div className="arena-countdown">
              <div className="countdown-content">
                {shouldShowCountdown ? (
                  <>
                    <p>Match starts in</p>
                    <div className="countdown-values" aria-live="off">
                      {countdownDays > 0 ? <span><strong>{countdownDays}</strong><small>Days</small></span> : null}
                      <span><strong>{String(countdownHours).padStart(2, "0")}</strong><small>Hours</small></span>
                      <span><strong>{String(countdownMinutes).padStart(2, "0")}</strong><small>Minutes</small></span>
                      <span><strong>{String(countdownRemainder).padStart(2, "0")}</strong><small>Seconds</small></span>
                    </div>
                  </>
                ) : (
                  <p className="countdown-placeholder">
                    The match countdown will appear when a start time is scheduled.
                  </p>
                )}
              </div>
            </div>
          ) : null}
          </div>

        <div className="stats-grid">
          <section className="panel stats-panel">
            <div className="panel-header">
              <span className="panel-icon"><BarChart3 size={16} /></span>
              <h3>Match Stats</h3>
            </div>

            <div className="stat-columns">
              {isWaiting ? (
                <div className="public-empty-state">
                  <div>
                    <strong>Match statistics are waiting for live data.</strong>
                    <span>They will appear here when an admin starts broadcasting.</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="stat-column">
                    {statRows.map((entry) => (
                      <div key={entry.label} className="stat-row">
                        <span className="stat-label">{entry.label}</span>
                        <div className="bar-wrap">
                          <div className="stat-bar blue" style={{ width: `${entry.label === "Attack %" ? entry.home : Math.min(entry.home, 100)}%` }} />
                        </div>
                        <strong className="stat-value blue">{entry.home}{entry.label === "Attack %" ? "%" : ""}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="stat-column">
                    {statRows.map((entry) => (
                      <div key={`${entry.label}-away`} className="stat-row">
                        <span className="stat-label">{entry.label}</span>
                        <div className="bar-wrap">
                          <div className="stat-bar red" style={{ width: `${entry.label === "Attack %" ? entry.away : Math.min(entry.away, 100)}%` }} />
                        </div>
                        <strong className="stat-value red">{entry.away}{entry.label === "Attack %" ? "%" : ""}</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="panel table-panel">
            <div className="panel-header">
              <span className="panel-icon"><Trophy size={16} /></span>
              <h3>Match Table</h3>
              <span className="soft-badge">Semi Final</span>
            </div>

            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th>P</th>
                  <th>W</th>
                  <th>L</th>
                  <th>PTS</th>
                </tr>
              </thead>
              <tbody>
                {matchRows.map((row, index) => (
                  <tr key={`${row.team}-${index}`}>
                    <td>{index + 1}</td>
                    <td>{row.team}</td>
                    <td>{row.p}</td>
                    <td>{row.w}</td>
                    <td>{row.l}</td>
                    <td>{row.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <aside className="panel ranking-panel">
            <div className="panel-header">
              <span className="panel-icon"><Crown size={16} /></span>
              <h3>Team Rankings</h3>
              <button type="button" className="soft-link">View All</button>
            </div>

            <div className="ranking-list">
              {standings.map((row, index) => (
                <div key={`${row.team}-${index}`} className="ranking-row">
                  <span className="rank">{row.rank}</span>
                  <span className="rank-team">{row.team}</span>
                  <span>{row.wins}</span>
                  <span>{row.losses}</span>
                  <span className="points">{row.points}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <div className="bottom-row">
          <section className="panel previous-panel">
            <div className="panel-header">
              <span className="panel-icon"><Play size={16} /></span>
              <h3>Previous Sets</h3>
            </div>

            <div className="previous-list">
              <div className="public-empty-state">
                <div>
                  <strong>Set history is awaiting input.</strong>
                  <span>Completed set scores will appear here when recorded.</span>
                </div>
              </div>
            </div>
          </section>

          <section className="panel recent-panel">
            <div className="panel-header">
              <span className="panel-icon"><CalendarDays size={16} /></span>
              <h3>Recent Matches</h3>
              <button type="button" className="soft-link">View All</button>
            </div>

            <div className="recent-list">
              {recentMatches.map((match, index) => (
                <div key={`${match.date}-${match.home}-${index}`} className="recent-item">
                  <span className="date">{match.date}</span>
                  <div className="recent-line">
                    <span>{match.home}</span>
                    <strong>{match.score}</strong>
                    <span>{match.away}</span>
                  </div>
                  <ChevronRight size={14} />
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="footer-bar">
          <div className="footer-brand">
            <img src="/assets/tvc-logo.jpeg" alt="TVC championship" />
            <span>TVC Volleyball Championship</span>
          </div>

          <div className="footer-links">
            <span>Live</span>
            <span>Real Time Scores</span>
            <span>Team Rankings</span>
            <span>Match History</span>
            <span>Stats</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
