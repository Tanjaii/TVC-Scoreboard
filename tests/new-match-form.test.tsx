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

const pushed: string[] = [];
let refreshed = 0;
const router = {
  back() {},
  forward() {},
  refresh() { refreshed += 1; },
  push(href: string) { pushed.push(href); },
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
    fireEvent.click(screen.getByRole("button", { name: "Select" }));

    fireEvent.click(screen.getByRole("button", { name: "Stage" }));
    fireEvent.click(screen.getByRole("option", { name: "Final" }));

    assert.equal(screen.queryByLabelText("Set 1 home score"), null);
    fireEvent.click(screen.getByRole("button", { name: "Add completed set" }));
    fireEvent.change(screen.getByLabelText("Set 1 home score"), { target: { value: "25" } });
    fireEvent.change(screen.getByLabelText("Set 1 away score"), { target: { value: "19" } });
    fireEvent.click(screen.getByRole("button", { name: "Add completed set" }));
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
  it("places Add completed set directly above Create and open once Previous match is chosen", () => {
    render(
      <AppRouterContext.Provider value={router}>
        <NewMatchForm teams={teams} />
      </AppRouterContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "New match" }));
    assert.equal(screen.queryByRole("button", { name: "Add completed set" }), null);
    fireEvent.click(screen.getByLabelText("Previous match"));
    const add = screen.getByRole("button", { name: "Add completed set" });
    const create = screen.getByRole("button", { name: "Create and open" });
    assert.ok(add.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING);
    fireEvent.click(screen.getByLabelText("Upcoming match"));
    assert.equal(screen.queryByRole("button", { name: "Add completed set" }), null);
  });

  it("returns to the admin page, not the match page, after a previous match is recorded", async () => {
    pushed.length = 0;
    refreshed = 0;
    fakeFetch(() => ({ status: 201, body: { match: { id: "33333333-3333-4333-8333-333333333333" } } }));
    render(
      <AppRouterContext.Provider value={router}>
        <NewMatchForm teams={teams} />
      </AppRouterContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "New match" }));
    fireEvent.click(screen.getByLabelText("Previous match"));
    fireEvent.click(screen.getByRole("button", { name: "Add completed set" }));
    fireEvent.change(screen.getByLabelText("Set 1 home score"), { target: { value: "25" } });
    fireEvent.change(screen.getByLabelText("Set 1 away score"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Create and open" }));

    await screen.findByText("Match recorded.");
    assert.deepEqual(pushed, ["/admin"]);
    assert.ok(refreshed >= 1);
    assert.ok(screen.getByRole("button", { name: "New match" }));
  });

  it("keeps the picked time exactly as chosen in Lagos time, whatever the device timezone", () => {
    render(
      <AppRouterContext.Provider value={router}>
        <NewMatchForm teams={teams} />
      </AppRouterContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "New match" }));
    fireEvent.click(screen.getByRole("button", { name: "Date and time" }));
    fireEvent.click(screen.getByRole("gridcell", { name: /^\w+, 15 \w+ \d{4}$/ }));
    fireEvent.click(screen.getByRole("button", { name: "3 o'clock" }));
    fireEvent.click(screen.getByRole("button", { name: "00 minutes" }));
    fireEvent.click(screen.getByRole("button", { name: "PM" }));

    // Nothing is applied until Select is pressed.
    const hidden = () => document.querySelector<HTMLInputElement>('input[name="when"]')!.value;
    assert.equal(hidden(), "");
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    assert.match(hidden(), /^\d{4}-\d{2}-15T14:00:00\.000Z$/); // 3:00 PM Lagos (UTC+1) is 14:00 UTC
    assert.match(screen.getByRole("button", { name: "Date and time" }).textContent ?? "", /15 \w+ · 3:00 PM/);
    assert.equal(screen.queryByRole("button", { name: "Clear date and time" }), null);

    // Re-opening shows the same time and it can be edited again.
    fireEvent.click(screen.getByRole("button", { name: "Date and time" }));
    fireEvent.click(screen.getByRole("button", { name: "4 o'clock" }));
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    assert.match(hidden(), /T15:00:00\.000Z$/);
  });
});
