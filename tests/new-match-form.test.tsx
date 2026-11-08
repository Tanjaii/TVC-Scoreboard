import "./ui-helpers";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import NewMatchForm from "../components/admin/NewMatchForm";
import type { Team } from "../lib/repo/teams";
import { fakeFetch } from "./ui-helpers";

const teams: Team[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Titan Spikers", shortName: "TTN", logoUrl: "", info: "" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Vortex Spikers", shortName: "VTX", logoUrl: "", info: "" },
];

const router = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
  bfcacheId: "test",
};

describe("new match form", () => {
  it("creates a past completed match with its details and all set scores in one request", async () => {
    const calls = fakeFetch(() => ({ status: 422, body: { error: "test capture" } }));
    render(
      <AppRouterContext.Provider value={router}>
        <NewMatchForm teams={teams} />
      </AppRouterContext.Provider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "New match" }));
    fireEvent.click(screen.getByLabelText("Previous match"));

    fireEvent.click(screen.getByRole("button", { name: "Date and time" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    const firstOfPreviousMonth = screen.getByRole("gridcell", { name: /^\w+, 1 \w+ \d{4}$/ });
    const selectedDate = firstOfPreviousMonth.getAttribute("aria-label");
    fireEvent.click(firstOfPreviousMonth);

    fireEvent.click(screen.getByRole("button", { name: "Stage" }));
    fireEvent.click(screen.getByRole("option", { name: "Final" }));

    fireEvent.change(screen.getByLabelText("Set 1 home score"), { target: { value: "25" } });
    fireEvent.change(screen.getByLabelText("Set 1 away score"), { target: { value: "19" } });
    fireEvent.click(screen.getByRole("button", { name: "Add set" }));
    fireEvent.change(screen.getByLabelText("Set 2 home score"), { target: { value: "22" } });
    fireEvent.change(screen.getByLabelText("Set 2 away score"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Create and open" }));

    await screen.findByRole("alert");
    const call = calls.find((request) => request.method === "POST");
    assert.ok(call);
    const body = call.body as {
      homeTeamId: string;
      awayTeamId: string;
      stage: string;
      scheduledAt: string;
      status: string;
      sets: { type: string; home: number; away: number }[];
    };
    assert.equal(body.homeTeamId, teams[0].id);
    assert.equal(body.awayTeamId, teams[1].id);
    assert.equal(body.stage, "Final");
    assert.equal(body.status, "completed");
    assert.ok(Date.parse(body.scheduledAt) < Date.now());
    assert.ok(selectedDate);
    assert.deepEqual(body.sets, [
      { type: "", home: 25, away: 19 },
      { type: "", home: 22, away: 25 },
    ]);
  });
});
