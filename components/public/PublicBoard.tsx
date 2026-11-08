"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicMatch, PublicSnapshot, PublicTeam } from "@/lib/public";
import LoadingAnimation from "./LoadingAnimation";
import { barShare, COUNTDOWN_THRESHOLD_MS, formatCountdown, formatWhen } from "@/lib/format";

const POLL_MS = 5000;
const SECTIONS = [
  { id: "match", label: "Match" },
  { id: "stats", label: "Stats" },
  { id: "info", label: "Info" },
] as const;

export default function PublicBoard({ initial }: { initial: PublicSnapshot | null }) {
  const [snap, setSnap] = useState<PublicSnapshot | null>(initial);
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [lastOk, setLastOk] = useState<number | null>(initial ? Date.now() : null);
  // Difference between the server's clock and this device's clock, so countdowns are right for everyone.
  const skew = useRef(initial ? Date.parse(initial.serverTime) - Date.now() : 0);
  const [active, setActive] = useState<string>("match");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/public", { cache: "no-store" });
      const data = (await res.json()) as PublicSnapshot;
      if (!res.ok || !Array.isArray(data.upcoming) || !Array.isArray(data.results)) throw new Error("bad response");
      skew.current = Date.parse(data.serverTime) - Date.now();
      setSnap(data);
      setLastOk(Date.now());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (!initial) void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, POLL_MS);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [initial, refresh]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { const hit = entries.find((e) => e.isIntersecting); if (hit) setActive(hit.target.id); },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    SECTIONS.forEach((s) => { const el = document.getElementById(s.id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const retry = async () => { setRetrying(true); await refresh(); setRetrying(false); };

  if (!snap && !failed) return <LoadingAnimation />;

  return (
    <>
      <header className="site-header">
        <div className="wrap">
          <a className="brand" href="#match">
            <img src="/assets/tvc-logo.jpeg" alt="" />
            <div><strong>TVC Volleyball</strong><span>Total Volleyball Competition</span></div>
          </a>
          <nav className="site-nav" aria-label="Sections">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} aria-current={active === s.id}>{s.label}</a>
            ))}
          </nav>
          <a className="staff-link" href="/admin">Staff area</a>
        </div>
      </header>

      <main className="wrap site-main">
        {failed && (
          <div className="notice error conn" role="alert">
            <span>
              We can’t reach the scoreboard right now.
              {lastOk ? ` Showing the last data received at ${new Date(lastOk).toLocaleTimeString()}.` : ""}
            </span>
            <button className="btn small" onClick={() => void retry()} disabled={retrying}>{retrying ? "Retrying…" : "Retry"}</button>
          </div>
        )}

        {!snap ? (
          <div className="panel empty">Scoreboard unavailable.</div>
        ) : (
          <>
            <section id="match" aria-labelledby="match-title">
              <div className="section-title"><h2 id="match-title">Match centre</h2></div>
              <LiveCentre snap={snap} skew={skew} />
              <Schedule matches={snap.upcoming} skew={skew} />
              <Results matches={snap.results} />
            </section>

            <section id="stats" aria-labelledby="stats-title">
              <div className="section-title"><h2 id="stats-title">Team statistics</h2></div>
              <Stats snap={snap} />
            </section>

            <section id="info" aria-labelledby="info-title">
              <div className="section-title"><h2 id="info-title">Teams</h2></div>
              <TeamsInfo teams={snap.teams} />
            </section>
          </>
        )}
      </main>

      <footer className="site-footer">
        <div className="wrap">TVC Volleyball Championship · Scores refresh every five seconds. · <a href="/admin">Staff area</a></div>
      </footer>
    </>
  );
}

function Logo({ team }: { team: PublicTeam }) {
  return team.logoUrl
    ? <img src={team.logoUrl} alt={`${team.name} logo`} />
    : <div className="logo-fallback" aria-hidden>{team.shortName.slice(0, 3).toUpperCase()}</div>;
}

function useNow(skew: React.RefObject<number>) {
  const [now, setNow] = useState(() => Date.now() + (skew.current ?? 0));
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now() + (skew.current ?? 0)), 1000);
    return () => window.clearInterval(t);
  }, [skew]);
  return now;
}

function Countdown({ target, skew }: { target: string; skew: React.RefObject<number> }) {
  const targetMs = Date.parse(target);
  const msLeft = targetMs - Date.now();

  // Beyond 24 hours — no live ticker, just static text
  if (msLeft > COUNTDOWN_THRESHOLD_MS) {
    return <span suppressHydrationWarning>{formatWhen(target)}</span>;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const now = useNow(skew);
  const remaining = targetMs - now;
  return (
    <span suppressHydrationWarning>
      {remaining > 0 ? `Starts in ${formatCountdown(remaining)}` : formatCountdown(remaining)}
    </span>
  );
}

function LiveCentre({ snap, skew }: { snap: PublicSnapshot; skew: React.RefObject<number> }) {
  const live = snap.live;

  if (!live) {
    const next = snap.upcoming[0];
    return (
      <div className="panel">
        <div className="centre-meta"><span className="pill">No match in progress</span></div>
        {next ? (
          <div className="stack">
            <p className="muted">Up next{next.stage ? ` · ${next.stage}` : ""}</p>
            <p className="display" style={{ fontSize: "1.8rem" }}>{next.home.name} vs {next.away.name}</p>
            {next.scheduledAt && (
              <p><strong className="display" style={{ fontSize: "1.6rem", color: "var(--gold)" }}><Countdown target={next.scheduledAt} skew={skew} /></strong></p>
            )}
          </div>
        ) : <p className="muted">The next match will appear here once it is scheduled.</p>}
      </div>
    );
  }

  const { match, isBroadcasting } = live;
  const set = match.currentSet;
  const number = match.sets.length + 1;

  return (
    <div className="panel">
      <div className="centre-meta">
        <span className="muted">{match.stage || "Match"}</span>
        {isBroadcasting ? <span className="pill live">Live</span> : <span className="pill warn">Broadcast offline</span>}
      </div>
      <div className="centre">
        <div className="team-side"><Logo team={match.home} /><h3>{match.home.name}</h3></div>
        <div className="scorebox" aria-live="polite">
          {isBroadcasting && set ? (
            <>
              <div className="points"><span>{set.home}</span><span className="sep">:</span><span>{set.away}</span></div>
              <div className="set-label">Set {number}{set.type ? ` · ${set.type}` : ""}</div>
              <div className="muted">Sets won {match.setsWon.home}–{match.setsWon.away}</div>
            </>
          ) : (
            <p className="muted" style={{ maxWidth: 260, textAlign: "center" }}>The broadcast hasn’t started. Scores will appear here as soon as it does.</p>
          )}
        </div>
        <div className="team-side"><Logo team={match.away} /><h3>{match.away.name}</h3></div>
      </div>
      {isBroadcasting && <SetChips sets={match.sets} />}
    </div>
  );
}

function SetChips({ sets }: { sets: PublicMatch["sets"] }) {
  if (sets.length === 0) return <p className="muted" style={{ marginTop: 14 }}>No sets completed yet.</p>;
  return (
    <div className="set-chips" aria-label="Completed sets">
      {sets.map((s, i) => (
        <div className="chip" key={i}>
          Set {i + 1}<strong>{s.home}–{s.away}</strong>
          {s.type && <small>{s.type}</small>}
        </div>
      ))}
    </div>
  );
}

function Schedule({ matches, skew }: { matches: PublicMatch[]; skew: React.RefObject<number> }) {
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head"><h2>Schedule</h2></div>
      {matches.length === 0 ? <div className="empty">No upcoming matches scheduled yet.</div> : (
        <div className="list">
          {matches.map((m, i) => (
            i === 0 ? (
              <div className="court-card" key={m.id}>
                <div className="court-card-content">
                  <p className="eyebrow">Up next</p>
                  <div className="teams">{m.home.name} vs {m.away.name}</div>
                  <div className="meta">
                    <span suppressHydrationWarning>{formatWhen(m.scheduledAt)}</span>
                    {m.stage ? ` · ${m.stage}` : ""}
                  </div>
                  <div className="court-count">
                    {m.scheduledAt ? <Countdown target={m.scheduledAt} skew={skew} /> : "Time to be confirmed"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="row" key={m.id}>
                <div>
                  <div className="teams">{m.home.name} vs {m.away.name}</div>
                  <div className="meta"><span suppressHydrationWarning>{formatWhen(m.scheduledAt)}</span>{m.stage ? ` · ${m.stage}` : ""}</div>
                </div>
                <div className="count">{m.scheduledAt ? <Countdown target={m.scheduledAt} skew={skew} /> : "TBC"}</div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

function Results({ matches }: { matches: PublicMatch[] }) {
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head"><h2>Results</h2></div>
      {matches.length === 0 ? <div className="empty">Completed matches will appear here.</div> : (
        <div className="list">
          {matches.map((m) => (
            <div className="row" key={m.id}>
              <div>
                <div className="teams">{m.home.name} vs {m.away.name}</div>
                <div className="meta">{m.stage || "Match"}</div>
                <SetChips sets={m.sets} />
              </div>
              <div className="result-score">{m.setsWon.home}–{m.setsWon.away}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stats({ snap }: { snap: PublicSnapshot }) {
  const live = snap.live?.isBroadcasting ? snap.live.match : null;
  const match = live ?? snap.results[0];
  if (!match?.stats) return <div className="panel empty">Team statistics will appear here during a broadcast match.</div>;

  const { home, away } = match.stats;
  const rows = [
    { label: "Attack efficiency", kind: "efficiency" as const, h: home.attackEfficiency, a: away.attackEfficiency, fmt: (n: number) => `${n.toFixed(1)}%` },
    { label: "Blocks", kind: "count" as const, h: home.blocks, a: away.blocks, fmt: String },
    { label: "Aces", kind: "count" as const, h: home.aces, a: away.aces, fmt: String },
    { label: "Errors", kind: "count" as const, h: home.errors, a: away.errors, fmt: String },
  ];

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{match.home.name} vs {match.away.name}</h2>
        <span className={live ? "pill live" : "pill"}>{live ? "Live" : "Latest result"}</span>
      </div>
      <div className="compare">
        {rows.map((r) => (
          <div className="compare-row" key={r.label}>
            <div className="home"><div className="val">{r.fmt(r.h)}</div><div className="bar"><i style={{ width: `${barShare(r.h, r.a, r.kind)}%` }} /></div></div>
            <div className="label">{r.label}</div>
            <div className="away"><div className="val">{r.fmt(r.a)}</div><div className="bar"><i style={{ width: `${barShare(r.a, r.h, r.kind)}%` }} /></div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamsInfo({ teams }: { teams: PublicSnapshot["teams"] }) {
  if (teams.length === 0) return <div className="panel empty">Team information will appear here.</div>;
  return (
    <div className="teams-grid">
      {teams.map((t) => (
        <article className="team-card" key={t.id}>
          <header><Logo team={t} /><h3>{t.name}</h3></header>
          {t.info && <p className="muted">{t.info}</p>}
        </article>
      ))}
    </div>
  );
}
