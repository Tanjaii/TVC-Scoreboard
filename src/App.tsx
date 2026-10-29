
import { useCallback, useEffect, useState } from "react";

import ScoreboardDashboard from "./components/ScoreboardDashboard";
import { initialLiveMatch, type LiveMatchData } from "./data/liveMatch";
import { isLiveMatchData } from "./server/liveMatchValidation";

type SyncStatus = "loading" | "ready" | "error";

async function readLiveMatch(response: Response): Promise<LiveMatchData> {
  const result: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      result &&
      typeof result === "object" &&
      "error" in result
        ? String(result.error)
        : "The scoreboard service returned an unexpected response.";

    throw new Error(message);
  }

  if (
    !result ||
    typeof result !== "object" ||
    !("liveMatch" in result) ||
    !isLiveMatchData(result.liveMatch)
  ) {
    throw new Error("The scoreboard service returned invalid match data.");
  }

  return result.liveMatch;
}

function App() {
  const [liveMatch, setLiveMatch] =
    useState<LiveMatchData>(initialLiveMatch);

  const [syncStatus, setSyncStatus] =
    useState<SyncStatus>("loading");

  const [syncError, setSyncError] = useState("");

  const refreshLiveMatch = useCallback(async () => {
    try {
      const response = await fetch("/api/live-match", {
        cache: "no-store",
      });

      const latestMatch = await readLiveMatch(response);

      setLiveMatch(latestMatch);
      setSyncError("");
      setSyncStatus("ready");
    } catch (error) {
      setSyncStatus("error");
      setSyncError(
        error instanceof Error
          ? error.message
          : "Live match data could not be loaded.",
      );
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;
    let timeoutId: number | undefined;

    const poll = async () => {
      await refreshLiveMatch();

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
    };
  }, [refreshLiveMatch]);

  const handleRetry = () => {
    setSyncStatus("loading");
    void refreshLiveMatch();
  };

  return (
    <div className="app-shell">
      {syncStatus === "error" ? (
        <div className="backend-notice error" role="alert">
          <span>Scoreboard sync failed: {syncError}</span>
          <button type="button" onClick={handleRetry}>
            Retry
          </button>
        </div>
      ) : syncStatus === "loading" ? (
        <div className="backend-notice" role="status">
          Connecting to the live scoreboard…
        </div>
      ) : null}

      <ScoreboardDashboard liveMatch={liveMatch} />
    </div>
  );
}

export default App;
