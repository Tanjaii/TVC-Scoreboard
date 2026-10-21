import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import AdminDashboard from "./components/AdminDashboard";
import ScoreboardDashboard from "./components/ScoreboardDashboard";
import { initialLiveMatch, type LiveMatchData } from "./data/liveMatch";
import { authClient } from "./lib/auth-client";
import { isLiveMatchData } from "./server/liveMatchValidation";

type ViewMode = "scoreboard" | "admin";
type SyncStatus = "loading" | "ready" | "saving" | "error";

async function readLiveMatch(response: Response): Promise<LiveMatchData> {
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = result && typeof result === "object" && "error" in result
      ? String(result.error)
      : "The scoreboard service returned an unexpected response.";
    throw new Error(message);
  }

  if (!result || typeof result !== "object" || !("liveMatch" in result)
    || !isLiveMatchData(result.liveMatch)) {
    throw new Error("The scoreboard service returned invalid match data.");
  }

  return result.liveMatch;
}

function AdminSignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message || "Sign-in failed. Check your details and try again.");
      }
    } catch (signInError) {
      setError(signInError instanceof Error
        ? signInError.message
        : "Sign-in is temporarily unavailable.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="admin-auth-panel">
      <p className="panel-eyebrow">TVC tournament control</p>
      <h1>Administrator sign-in</h1>
      <p className="admin-auth-copy">Sign in with an account provisioned by a tournament administrator.</p>
      <form className="admin-auth-form" onSubmit={handleSubmit}>
        <label className="match-entry-field">
          Email
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="match-entry-field">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <p className="admin-auth-error" role="alert">{error}</p> : null}
        <button type="submit" className="decision-button" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

function App() {
  const [view, setView] = useState<ViewMode>("scoreboard");
  const [liveMatch, setLiveMatch] = useState<LiveMatchData>(initialLiveMatch);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [syncError, setSyncError] = useState("");
  const [authError, setAuthError] = useState("");
  const liveMatchRef = useRef(liveMatch);
  const localRevision = useRef(0);
  const isDirty = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const { data: session, isPending: isAuthPending } = authClient.useSession();

  const setMatch = useCallback((match: LiveMatchData) => {
    liveMatchRef.current = match;
    setLiveMatch(match);
  }, []);

  const refreshLiveMatch = useCallback(async () => {
    const revision = localRevision.current;
    const response = await fetch("/api/live-match", { cache: "no-store" });
    const latestMatch = await readLiveMatch(response);

    if (revision === localRevision.current && !isDirty.current) {
      setMatch(latestMatch);
      setSyncError("");
      setSyncStatus("ready");
    }
  }, [setMatch]);

  const persistLatestMatch = useCallback((revision: number) => {
    setSyncStatus("saving");
    saveQueue.current = saveQueue.current.then(async () => {
      if (revision !== localRevision.current) {
        return;
      }

      try {
        const response = await fetch("/api/live-match", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(liveMatchRef.current),
        });
        const savedMatch = await readLiveMatch(response);

        if (revision === localRevision.current) {
          isDirty.current = false;
          setMatch(savedMatch);
          setSyncError("");
          setSyncStatus("ready");
        }
      } catch (error) {
        if (revision === localRevision.current) {
          setSyncStatus("error");
          setSyncError(error instanceof Error
            ? error.message
            : "Live match changes could not be saved.");
        }
      }
    });
  }, [setMatch]);

  const updateLiveMatch = useCallback(
    (updater: (current: LiveMatchData) => LiveMatchData) => {
      const nextMatch = updater(liveMatchRef.current);
      const revision = ++localRevision.current;
      isDirty.current = true;
      setMatch(nextMatch);

      if (saveTimer.current !== undefined) {
        window.clearTimeout(saveTimer.current);
      }
      saveTimer.current = window.setTimeout(
        () => persistLatestMatch(revision),
        300,
      );
    },
    [persistLatestMatch, setMatch],
  );

  useEffect(() => {
    let isCancelled = false;
    let timeoutId: number | undefined;

    const poll = async () => {
      try {
        await refreshLiveMatch();
      } catch (error) {
        if (!isCancelled) {
          setSyncStatus("error");
          setSyncError(error instanceof Error
            ? error.message
            : "Live match data could not be loaded.");
        }
      }

      if (!isCancelled) {
        timeoutId = window.setTimeout(poll, 5_000);
      }
    };

    void poll();
    return () => {
      isCancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      if (saveTimer.current !== undefined) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [refreshLiveMatch]);

  const handleRetry = () => {
    if (isDirty.current) {
      persistLatestMatch(localRevision.current);
      return;
    }

    setSyncStatus("loading");
    void refreshLiveMatch().catch((error: unknown) => {
      setSyncStatus("error");
      setSyncError(error instanceof Error
        ? error.message
        : "Live match data could not be loaded.");
    });
  };

  const handleSignOut = async () => {
    setAuthError("");
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setAuthError(result.error.message || "Sign-out failed.");
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Sign-out failed.");
    }
  };

  const isAdmin = session?.user.role === "admin"
    || (Array.isArray(session?.user.role) && session.user.role.includes("admin"));

  return (
    <div className="app-shell">
      {syncStatus === "error" ? (
        <div className="backend-notice error" role="alert">
          <span>Scoreboard sync failed: {syncError}</span>
          <button type="button" onClick={handleRetry}>Retry</button>
        </div>
      ) : syncStatus === "loading" ? (
        <div className="backend-notice" role="status">Connecting to the live scoreboard…</div>
      ) : syncStatus === "saving" ? (
        <div className="backend-notice" role="status">Saving live match changes…</div>
      ) : null}
      {authError ? <div className="backend-notice error" role="alert">{authError}</div> : null}

      <div className="app-toggle" role="tablist" aria-label="Application mode">
        <button
          type="button"
          className={view === "scoreboard" ? "app-toggle-button active" : "app-toggle-button"}
          onClick={() => setView("scoreboard")}
        >
          Public scoreboard
        </button>
        <button
          type="button"
          className={view === "admin" ? "app-toggle-button active" : "app-toggle-button"}
          onClick={() => setView("admin")}
        >
          Admin console
        </button>
      </div>

      {view === "scoreboard" ? (
        <ScoreboardDashboard liveMatch={liveMatch} />
      ) : isAuthPending ? (
        <main className="admin-auth-panel" role="status">Checking administrator access…</main>
      ) : !session ? (
        <AdminSignIn />
      ) : !isAdmin ? (
        <main className="admin-auth-panel">
          <p className="panel-eyebrow">Access restricted</p>
          <h1>Administrator access required</h1>
          <p className="admin-auth-copy">This account is not authorized to update tournament scores.</p>
          <button type="button" className="decision-button" onClick={() => void handleSignOut()}>
            Sign out
          </button>
        </main>
      ) : (
        <AdminDashboard
          liveMatch={liveMatch}
          onLiveMatchChange={updateLiveMatch}
          currentUser={{
            name: session.user.name || session.user.email,
            email: session.user.email,
          }}
          onSignOut={handleSignOut}
        />
      )}
    </div>
  );
}

export default App;
