import { useState } from "react";

import AdminDashboard from "./components/AdminDashboard";
import ScoreboardDashboard from "./components/ScoreboardDashboard";
import { initialLiveMatch, type LiveMatchData } from "./data/liveMatch";

type ViewMode = "scoreboard" | "admin";

function App() {
  const [view, setView] = useState<ViewMode>("scoreboard");
  const [liveMatch, setLiveMatch] = useState<LiveMatchData>(initialLiveMatch);

  return (
    <div className="app-shell">
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
      ) : (
        <AdminDashboard liveMatch={liveMatch} onLiveMatchChange={setLiveMatch} />
      )}
    </div>
  );
}

export default App;
