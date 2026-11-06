import "./ui-helpers";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import PublicBoard from "../components/public/PublicBoard";
import type { PublicSnapshot, PublicMatch } from "../lib/public";
import { fakeFetch } from "./ui-helpers";

const T1 = "11111111-1111-4111-8111-111111111111";
const T2 = "22222222-2222-4222-8222-222222222222";

const pteam = (id: string, name: string) => ({ id, name, shortName: name.slice(0, 3), logoUrl: "" });
const pm = (patch: Partial<PublicMatch> = {}): PublicMatch => ({
  id: "m1", stage: "Semi-final", scheduledAt: null, status: "live", home: pteam(T1, "Titan Spikers"), away: pteam(T2, "Vortex Spikers"),
  sets: [{ type: "Men", home: 25, away: 20 }], currentSet: { type: "Mixed", home: 12, away: 10 },
  stats: { home: { attackEfficiency: 31.5, blocks: 4, aces: 2, errors: 3 }, away: { attackEfficiency: 12, blocks: 1, aces: 0, errors: 5 } },
  setsWon: { home: 1, away: 0 }, ...patch,
});
const snap = (patch: Partial<PublicSnapshot> = {}): PublicSnapshot => ({
  serverTime: new Date().toISOString(), live: { match: pm(), isBroadcasting: true }, upcoming: [], results: [],
  teams: [{ ...pteam(T1, "Titan Spikers"), info: "Founded to win." }, { ...pteam(T2, "Vortex Spikers"), info: "" }], ...patch,
});

describe("public scoreboard", () => {
  it("shows the live match, completed sets, side-by-side stats, team info and staff link", () => {
    fakeFetch(() => ({ body: snap() }));
    render(<PublicBoard initial={snap()} />);
    assert.ok(screen.getAllByText("Live").length >= 1);
    assert.ok(screen.getByText("Set 2 · Mixed"));
    const sets = screen.getByLabelText("Completed sets");
    assert.ok(within(sets).getByText("25–20"));
    assert.ok(screen.getByText("Attack efficiency"));
    assert.ok(screen.getByText("31.5%"));
    assert.ok(screen.getByText("Founded to win."));
    for (const name of ["Match", "Stats", "Info"]) assert.ok(screen.getByRole("link", { name }));
    assert.equal(screen.getAllByRole("link", { name: /staff area/i })[0].getAttribute("href"), "/admin");
  });

  it("shows broadcast status without any score while the broadcast is off", () => {
    fakeFetch(() => ({ body: snap() }));
    const off = snap({ live: { match: pm({ currentSet: null, sets: [], stats: null, setsWon: { home: 0, away: 0 } }), isBroadcasting: false } });
    render(<PublicBoard initial={off} />);
    assert.ok(screen.getByText("Broadcast offline"));
    assert.ok(screen.getByText(/the broadcast hasn’t started/i));
    assert.equal(screen.queryByText("12"), null);
  });

  it("counts down to the next match and lists results with set scores", () => {
    fakeFetch(() => ({ body: snap() }));
    const s = snap({
      live: null,
      upcoming: [pm({ status: "scheduled", scheduledAt: new Date(Date.now() + 3 * 3600e3 + 120e3).toISOString(), sets: [], currentSet: null, stats: null })],
      results: [pm({ id: "r1", status: "completed", currentSet: null, sets: [{ type: "", home: 25, away: 18 }, { type: "", home: 25, away: 22 }], setsWon: { home: 2, away: 0 } })],
    });
    render(<PublicBoard initial={s} />);
    assert.ok(screen.getAllByText(/^\d+h \d+m \d+s$|^\d+h \d+m$/).length >= 1);
    assert.ok(screen.getByText("2–0"));
    assert.ok(screen.getByText("25–22"));
  });

  it("shows a connection error with Retry, keeps old data, and recovers", async () => {
    let healthy = false;
    const calls = fakeFetch(() => (healthy ? { body: snap() } : { status: 503, body: { error: "down" } }));
    render(<PublicBoard initial={null} />);

    await screen.findByText(/we can’t reach the scoreboard/i);
    assert.ok(screen.getByText("Scoreboard unavailable."));

    healthy = true;
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => assert.ok(screen.queryAllByText("Live").length > 0));
    assert.equal(screen.queryByText(/we can’t reach the scoreboard/i), null);
    assert.ok(calls.length >= 2);
  });
});
